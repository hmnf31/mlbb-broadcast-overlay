from __future__ import annotations

import argparse
import asyncio
import json
import socket
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

from .match_state import MatchState
from .websocket_server import OverlayWebSocketServer

MAX_BODY_BYTES = 8 * 1024 * 1024


def find_free_port(host: str, port: int, max_tries: int = 20) -> int:
    for port in range(port, port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
                return port
            except OSError:
                continue
    raise OSError(f"No free port found starting from {port}")


def _is_plain_object(value: Any) -> bool:
    return isinstance(value, dict)


class ApiHandler(SimpleHTTPRequestHandler):
    """Static file handler plus the HTTP parity endpoints of the Cloudflare Worker.

    Local development only: the Worker never trusts these, and neither should
    anything exposed publicly. There is no ownerKey enforcement here because the
    local backend always serves a single unclaimed profile.
    """

    websocket_server: OverlayWebSocketServer

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        if "api/" in (self.path or ""):
            print(f"[http] {format % args}")

    def _send_json(self, body: Dict[str, Any], status: int = 200, headers: Dict[str, str] | None = None) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_text(self, text: str, status: int, headers: Dict[str, str] | None = None) -> None:
        payload = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _read_json(self) -> Any:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return None
        if length <= 0 or length > MAX_BODY_BYTES:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    def _schedule_broadcast(self, assets_changed: bool) -> None:
        server = self.websocket_server

        def runner() -> None:
            try:
                asyncio.run(server.broadcast_state(assets_changed))
            except Exception as exc:  # pragma: no cover - best effort
                print(f"[http] broadcast failed: {exc}")

        threading.Thread(target=runner, daemon=True).start()

    # --- routing ---------------------------------------------------------

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]

        if path == "/runtime-config.json":
            self._send_json({"websocketPort": self.websocket_server.port}, headers={"Cache-Control": "no-store"})
            return
        if path == "/api/registry":
            self._serve_registry()
            return
        if path == "/api/state":
            snapshot = self.websocket_server.snapshot_payload()
            self._send_text(json.dumps({"type": "snapshot", "payload": snapshot}),
                            headers={"Cache-Control": "no-store"})
            return
        if path == "/api/assets":
            assets = self.websocket_server.assets
            self._send_json(assets, headers={"Cache-Control": "no-store"})
            return
        if path in ("/", "/frontend/overlay/gameplay"):
            self.send_response(302)
            self.send_header("Location", "/frontend/overlay/gameplay/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        super().do_GET()

    def do_PUT(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/api/state":
            self._send_json({"error": "Not found"}, 404)
            return

        payload = self._read_json()
        if not _is_plain_object(payload):
            self._send_json({"error": "Body harus JSON object."}, 400)
            return

        server = self.websocket_server
        assets_changed = server.apply_update(payload)
        if assets_changed:
            server.assets["version"] += 1
        self._schedule_broadcast(assets_changed)
        self._send_json({"ok": True, "assetsVersion": server.assets["version"]},
                        headers={"Cache-Control": "no-store"})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/api/assets":
            self._send_json({"error": "Not found"}, 404)
            return

        payload = self._read_json()
        if not _is_plain_object(payload):
            self._send_json({"error": "Body harus JSON object."}, 400)
            return

        server = self.websocket_server
        assets_changed = server.apply_assets(payload)
        if assets_changed:
            server.assets["version"] += 1
        self._schedule_broadcast(assets_changed)
        self._send_json({"ok": True, "assetsVersion": server.assets["version"]},
                        headers={"Cache-Control": "no-store"})

    def _serve_registry(self) -> None:
        registry_path = Path(self.directory) / "assets" / "registry.json"
        try:
            body = registry_path.read_text(encoding="utf-8")
        except OSError:
            self._send_json({"error": "assets/registry.json belum ada. Jalankan npm run build:cloudflare."}, 404)
            return
        self._send_text(body, headers={"Cache-Control": "no-store"})


def start_http_server(directory: Path, host: str, port: int, websocket_server: OverlayWebSocketServer) -> ThreadingHTTPServer:
    actual_port = port
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind((host, port))
    except OSError:
        actual_port = find_free_port(host, port + 1)

    handler = partial(ApiHandler, directory=str(directory))
    ApiHandler.websocket_server = websocket_server
    httpd = ThreadingHTTPServer((host, actual_port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print(f"HTTP server running at http://{host}:{actual_port}/")
    print(f"  overlay  http://{host}:{actual_port}/frontend/overlay/gameplay/")
    print(f"  control  http://{host}:{actual_port}/frontend/control/")
    print(f"  home     http://{host}:{actual_port}/frontend/home/")
    return httpd


async def main() -> None:
    parser = argparse.ArgumentParser(description="MLBB Broadcast Engine: Gameplay Overlay backend")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--ws-port", type=int, default=8765)
    parser.add_argument("--http-port", type=int, default=8000)
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    static_root = project_root
    match_state = MatchState(state_path=project_root / "data" / "current-match.json")

    ws_port = find_free_port(args.host, args.ws_port)
    http_port = find_free_port(args.host, args.http_port) if args.http_port == args.ws_port else args.http_port
    websocket_server = OverlayWebSocketServer(host=args.host, port=ws_port, match_state=match_state)

    await websocket_server.start()
    print(f"WebSocket server listening on ws://{args.host}:{websocket_server.port}")
    httpd = start_http_server(static_root, args.host, http_port, websocket_server)

    try:
        await asyncio.Event().wait()
    finally:
        await websocket_server.close()
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    asyncio.run(main())