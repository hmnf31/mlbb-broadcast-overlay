from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Set

import websockets

from .match_state import MatchState

MAX_FRAME_CHARS = 900000


def empty_assets() -> Dict[str, Any]:
    return {"version": 0, "headerImage": "", "images": {}}


class OverlayWebSocketServer:
    """Simple WebSocket server for broadcasting match state to overlay clients."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8765, match_state: MatchState | None = None):
        self.host = host
        self.port = port
        self.match_state = match_state or MatchState()
        self.connected_clients: Set[websockets.WebSocketServerProtocol] = set()
        self.server = None
        self.assets: Dict[str, Any] = empty_assets()

    @staticmethod
    def _find_free_port(host: str, start_port: int, max_tries: int = 20) -> int:
        import socket

        for port in range(start_port, start_port + max_tries):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    sock.bind((host, port))
                    return port
                except OSError:
                    continue
        raise OSError(f"No free port found starting from {start_port}")

    def snapshot_payload(self) -> Dict[str, Any]:
        payload = self.match_state.snapshot()
        payload["assetsVersion"] = self.assets["version"]
        return payload

    def _split_assets(self, payload: Dict[str, Any]) -> bool:
        """Move inline image data out of the hot state so broadcasts stay small."""
        presentation = payload.get("presentation") or {}
        changed = False

        if isinstance(presentation.get("headerImage"), str):
            value = presentation["headerImage"]
            if value != self.assets["headerImage"]:
                self.assets["headerImage"] = value
                changed = True

        state_items = self.match_state.get(["presentation", "customItems"], []) or []
        for item in state_items:
            if isinstance(item, dict) and item.get("type") == "image":
                item["src"] = ""

        incoming_items = presentation.get("customItems")
        if isinstance(incoming_items, list):
            images: Dict[str, str] = {}
            for item in state_items:
                if not isinstance(item, dict) or item.get("type") != "image":
                    continue
                item_id = item.get("id")
                source = next(
                    (i for i in incoming_items if isinstance(i, dict) and i.get("id") == item_id),
                    None,
                )
                if isinstance(source, dict) and isinstance(source.get("src"), str):
                    value = source["src"]
                else:
                    value = self.assets["images"].get(item_id, "")
                if self.assets["images"].get(item_id, "") != value:
                    changed = True
                images[item_id] = value
            for image_id in self.assets["images"]:
                if image_id not in images:
                    changed = True
            self.assets["images"] = images

        return changed

    def apply_assets(self, payload: Dict[str, Any]) -> bool:
        changed = False
        header_image = payload.get("headerImage")
        if isinstance(header_image, str) and header_image != self.assets["headerImage"]:
            self.assets["headerImage"] = header_image
            changed = True

        incoming = payload.get("images") if isinstance(payload.get("images"), dict) else None
        images: Dict[str, str] = {}
        for item in self.match_state.get(["presentation", "customItems"], []) or []:
            if not isinstance(item, dict) or item.get("type") != "image":
                continue
            item_id = item.get("id")
            if incoming is not None and isinstance(incoming.get(item_id), str):
                images[item_id] = incoming[item_id]
            else:
                images[item_id] = self.assets["images"].get(item_id, "")

        if images != self.assets["images"]:
            changed = True
        self.assets["images"] = images
        return changed

    def apply_update(self, payload: Dict[str, Any]) -> bool:
        """Merge a hot-state update, splitting inline images out of the state.

        Returns True when the stored image payload changed (the caller owns the
        ``assets.version`` counter so there is a single bump site).
        """
        self.match_state.apply_update(payload or {})
        return self._split_assets(payload or {})

    def reset(self) -> None:
        self.match_state = MatchState()
        self.assets = empty_assets()

    async def broadcast(self, payload: dict[str, Any]) -> None:
        message = json.dumps(payload)
        dead_clients: set[websockets.WebSocketServerProtocol] = set()

        for websocket in list(self.connected_clients):
            try:
                await websocket.send(message)
            except Exception:
                dead_clients.add(websocket)

        for websocket in dead_clients:
            self.connected_clients.discard(websocket)

    async def broadcast_state(self, assets_changed: bool = False) -> None:
        await self.broadcast({"type": "snapshot", "payload": self.snapshot_payload()})
        if assets_changed:
            await self.broadcast({"type": "assets_changed", "assetsVersion": self.assets["version"]})

    async def handle_client(self, websocket):
        self.connected_clients.add(websocket)
        await websocket.send(json.dumps({"type": "snapshot", "payload": self.snapshot_payload()}))

        try:
            async for raw_message in websocket:
                if not raw_message or not raw_message.strip():
                    continue
                if len(raw_message) > MAX_FRAME_CHARS:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Frame too large. Shrink the images before sending.",
                    }))
                    continue

                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({"type": "error", "message": "Invalid JSON payload."}))
                    continue

                msg_type = message.get("type")
                if msg_type in ("ping", "pong"):
                    await websocket.send(json.dumps({"type": "pong", "message": "alive"}))
                    continue
                if msg_type == "command" and message.get("command") == "request_state":
                    await websocket.send(json.dumps({"type": "snapshot", "payload": self.snapshot_payload()}))
                    continue

                assets_changed = False
                if msg_type == "update":
                    assets_changed = self.apply_update(message.get("payload"))
                elif msg_type == "assets":
                    assets_changed = self.apply_assets(message.get("payload") or {})
                elif msg_type == "command":
                    command = message.get("command")
                    if command == "tick_timer":
                        self.match_state.tick_timer(int(message.get("value", 1)))
                    elif command == "set_timer":
                        self.match_state.set_value(["match", "timer"], int(message.get("value", 0)))
                    elif command == "reset":
                        self.reset()
                        assets_changed = True
                    else:
                        await websocket.send(json.dumps({"type": "error", "message": f"Unsupported command: {command}"}))
                        continue
                else:
                    await websocket.send(json.dumps({"type": "error", "message": f"Unsupported type: {msg_type}"}))
                    continue

                if assets_changed:
                    self.assets["version"] += 1
                await self.broadcast_state(assets_changed)
        finally:
            self.connected_clients.discard(websocket)

    async def start(self):
        port = self.port
        for _ in range(20):
            try:
                self.server = await websockets.serve(self.handle_client, self.host, port)
                self.port = port
                return self.server
            except OSError as exc:
                if exc.errno not in (10048, 98):
                    raise
                port = self._find_free_port(self.host, port + 1, max_tries=20)
        raise OSError(f"Unable to start WebSocket server on {self.host}:{self.port}")

    async def close(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()