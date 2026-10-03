import asyncio
import json

import websockets

from backend.match_state import MatchState
from backend.websocket_server import OverlayWebSocketServer


async def main() -> None:
    server = OverlayWebSocketServer(host='127.0.0.1', port=8766, match_state=MatchState())
    await server.start()
    try:
        async with websockets.connect('ws://127.0.0.1:8766') as ws:
            first = json.loads(await ws.recv())
            assert first['type'] == 'snapshot'
            await ws.send(json.dumps({
                'type': 'update',
                'payload': {'teams': {'blue': {'kills': 12}}},
            }))
            second = json.loads(await ws.recv())
            assert second['type'] == 'snapshot'
            assert second['payload']['teams']['blue']['kills'] == 12
            print('websocket_ok', first['payload']['match']['timer'], second['payload']['teams']['blue']['kills'])
    finally:
        await server.close()


if __name__ == '__main__':
    asyncio.run(main())
