import asyncio
import json
import urllib.request
import websockets

health = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/health').read())
assert health['ok'] is True, health

async def main():
    uri = 'ws://127.0.0.1:8000/ws/sth-city-01?player_id=smoke-player&display_name=SmokeTest'
    async with websockets.connect(uri) as ws:
        welcome = json.loads(await ws.recv())
        assert welcome['type'] == 'welcome', welcome
        await ws.send(json.dumps({'type': 'input', 'x': 1, 'z': 0}))
        snapshot = None
        for _ in range(10):
            message = json.loads(await ws.recv())
            if message.get('type') == 'snapshot':
                snapshot = message
                break
        assert snapshot and snapshot['players'], snapshot
        await ws.send(json.dumps({'type': 'chat', 'text': 'hello region'}))
        chat = json.loads(await ws.recv())
        assert chat['type'] == 'chat', chat
        print(json.dumps({'health': health, 'welcome': welcome, 'snapshot_players': len(snapshot['players']), 'chat': chat}, indent=2))

asyncio.run(main())
