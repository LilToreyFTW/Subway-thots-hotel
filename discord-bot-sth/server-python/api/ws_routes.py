"""WebSocket endpoint for the multiplayer world host.

This endpoint is mounted on the same FastAPI app that serves auth. It:
- accepts a single-use WebSocket ticket (never a long-lived access token),
- validates + consumes the ticket,
- loads the verified account and sends auth_success,
- periodically re-checks membership/status and disconnects on revocation.
"""
from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from database import SessionLocal
from models import User, WebSocketTicket
from services.websocket_service import consume_ticket, check_live_access, TicketError
from config import MEMBERSHIP_CACHE_TTL_SECONDS

router = APIRouter()

LIVE: dict[str, WebSocket] = {}  # user_id -> ws (in-process registry)


async def _send(ws: WebSocket, payload: dict) -> None:
    try:
        await ws.send_json(payload)
    except Exception:
        pass


@router.websocket("/ws/{region_id}")
async def region_socket(ws: WebSocket, region_id: str, ticket: str = ""):
    await ws.accept()

    db = SessionLocal()
    try:
        result = consume_ticket(db, ticket)
    except TicketError as exc:
        await _send(ws, {"type": "auth_failed", "reason": str(exc)})
        await ws.close(code=4401)
        db.close()
        return
    except Exception:
        await _send(ws, {"type": "auth_failed", "reason": "error"})
        await ws.close(code=4401)
        db.close()
        return

    user_id = result["user_id"]
    LIVE[user_id] = ws
    await _send(ws, {
        "type": "auth_success",
        "accountId": user_id,
        "gameTag": result["game_tag"],
        "discordId": result["discord_id"],
        "permissions": [result["permissions"]],
        "regionId": region_id,
    })

    try:
        last_check = time.time()
        while True:
            # Periodic membership/status re-check (cached, cheap).
            if time.time() - last_check > MEMBERSHIP_CACHE_TTL_SECONDS:
                allowed, reason = check_live_access(db, user_id)
                last_check = time.time()
                if not allowed:
                    await _send(ws, {"type": "access_revoked", "reason": reason})
                    break
            try:
                message = await asyncio.wait_for(ws.receive_json(), timeout=MEMBERSHIP_CACHE_TTL_SECONDS + 5)
            except asyncio.TimeoutError:
                # No traffic; just loop and re-check access.
                continue
            except WebSocketDisconnect:
                break
            # The game would process movement/chat here and broadcast to region.
            # For auth scope we only enforce access; existing world host logic is
            # preserved in server-python/main.py and runs alongside.
    finally:
        LIVE.pop(user_id, None)
        try:
            db.close()
        except Exception:
            pass
