"""Two-client local world smoke test.

Run a local host first, then execute this module. It verifies welcome ordering,
shared-city chat, and rejection of a forged movement input.
"""
from __future__ import annotations

import asyncio
import json
import os

import websockets


async def receive_type(socket, expected: set[str]) -> dict:
    while True:
        message = json.loads(await socket.recv())
        if message.get('type') in expected:
            return message


async def run() -> None:
    base = os.getenv('WORLD_TEST_URL', 'ws://127.0.0.1:8000')
    async with websockets.connect(f'{base}/ws/sth-city-01?player_id=smoke-a&display_name=SmokeA') as first:
        welcome_a = await receive_type(first, {'welcome'})
        assert welcome_a['type'] == 'welcome'
        async with websockets.connect(f'{base}/ws/sth-city-01?player_id=smoke-b&display_name=SmokeB') as second:
            welcome_b = await receive_type(second, {'welcome'})
            assert welcome_b['type'] == 'welcome'
            await first.send(json.dumps({'type': 'chat', 'text': 'two-client smoke'}))
            chat = await receive_type(second, {'chat'})
            assert chat['text'] == 'two-client smoke'
            await first.send(json.dumps({'type': 'input', 'x': 2, 'z': 0, 'zone': 'city'}))
            rejected = await receive_type(first, {'error'})
            assert rejected['code'] == 'CHEAT_DETECTED'


if __name__ == '__main__':
    asyncio.run(run())
    print('two-client-smoke: PASS')
