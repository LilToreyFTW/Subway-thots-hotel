import asyncio
import json
import os
import uuid
from urllib.parse import quote

import websockets

BASE_URL = os.getenv("WORLD_TEST_URL", "ws://127.0.0.1:8000")


async def receive_type(socket, expected, attempts=60):
    for _ in range(attempts):
        message = json.loads(await asyncio.wait_for(socket.recv(), 3))
        if message.get("type") == expected:
            return message
    raise AssertionError(f"Did not receive {expected}")


async def main():
    player_id = f"security-{uuid.uuid4()}"
    base = f"{BASE_URL}/ws/sth-city-01?player_id={quote(player_id)}&display_name=SecurityTest"

    first = await websockets.connect(base)
    welcome = await receive_type(first, "welcome")
    token = welcome.get("sessionToken")
    assert token and len(token) >= 32, welcome

    unauthorized = await websockets.connect(base)
    try:
        await unauthorized.recv()
    except websockets.exceptions.ConnectionClosed as closed:
        assert closed.code == 4401, closed
    else:
        raise AssertionError("Connection without the issued session token was accepted")

    authorized = await websockets.connect(f"{base}&session_token={quote(token)}")
    await receive_type(authorized, "welcome")
    for _ in range(60):
        try:
            await asyncio.wait_for(first.recv(), 3)
        except websockets.exceptions.ConnectionClosed as closed:
            assert closed.code == 4001, closed
            break
    else:
        raise AssertionError("Superseded connection stayed open")

    await authorized.send(json.dumps({"type": "state", "position": {"x": 100, "y": 0, "z": 100}}))
    error = await receive_type(authorized, "error")
    assert error.get("code") == "STATE_NOT_ALLOWED", error

    await authorized.send(json.dumps({
        "type": "input",
        "x": 1,
        "z": 0,
        "zone": "room",
        "roomId": 7,
        "rotation": 1.2,
        "moving": True,
        "gender": "male",
        "selections": {"face": "Male_Face_04"},
    }))
    moved = None
    for _ in range(60):
        snapshot = await receive_type(authorized, "snapshot")
        player = next(item for item in snapshot["players"] if item["id"] == player_id)
        if player["zone"] == "room" and player["roomId"] == "7" and player["position"]["x"] > 0:
            moved = player
            break
    assert moved, "Server-authoritative input did not advance the player"

    await authorized.close()
    print(json.dumps({
        "session_token": True,
        "identity_rejection": True,
        "duplicate_replacement": True,
        "absolute_state_rejected": True,
        "server_input_movement": True,
    }))


asyncio.run(main())
