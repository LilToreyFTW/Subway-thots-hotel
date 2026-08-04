"""WebSocket ticket service + live-player registry integration.

Connection flow (per spec):
1. Browser authenticates via Discord -> backend creates a secure session.
2. Browser requests a short-lived WebSocket ticket (POST /account/ws-ticket).
3. Browser opens the WS using the ticket (never a long-lived access token).
4. WS server validates + consumes the ticket, loads the verified account, and
   sends auth_success with game tag + permissions.
5. Server periodically re-checks the membership cache validity.
6. If access is revoked, the player is disconnected (access_revoked message).

The world host (existing main.py WS endpoint) calls `consume_ticket` and
`check_live_access`. Live players live in the world host's `regions` dict; this
module exposes helpers the world host imports to validate/revoke.
"""
from __future__ import annotations

import secrets
import time
from typing import Any

from sqlalchemy.orm import Session as DBSession

from config import WEBSOCKET_TICKET_TTL_SECONDS
from models import User, WebSocketTicket
from security import encode_ws_ticket, decode_ws_ticket, make_token


def issue_ticket(db: DBSession, user: User, *, permissions: str = "player") -> dict[str, Any]:
    """Create a short-lived, single-use WebSocket ticket for an authenticated,
    verified, non-banned/suspended user. Returns the ticket string + metadata."""
    if user.profile is None:
        raise ValueError("account has no game profile")
    if user.account_status in ("banned", "suspended", "deleted", "discord_membership_missing"):
        raise ValueError("account access denied")
    ticket_id = make_token(24)
    game_tag = user.profile.full_game_tag
    discord_id = user.discord.discord_user_id if user.discord else ""
    now = time.time()
    row = WebSocketTicket(
        ticket_id=ticket_id,
        user_id=user.id,
        game_tag=game_tag,
        discord_id=discord_id,
        permissions=permissions,
        expires_at=now + WEBSOCKET_TICKET_TTL_SECONDS,
    )
    db.add(row)
    db.commit()
    signed = encode_ws_ticket(
        {"tid": ticket_id, "uid": user.id, "tag": game_tag, "perm": permissions},
        WEBSOCKET_TICKET_TTL_SECONDS,
    )
    return {
        "ticket": signed,
        "ticket_id": ticket_id,
        "game_tag": game_tag,
        "permissions": permissions,
        "expires_in": WEBSOCKET_TICKET_TTL_SECONDS,
    }


class TicketError(Exception):
    pass


def consume_ticket(db: DBSession, ticket: str) -> dict[str, Any]:
    """Validate and consume a WebSocket ticket. Raises TicketError on any failure
    (expired, replayed/already-consumed, forged, unknown)."""
    data = decode_ws_ticket(ticket)
    if data is None:
        raise TicketError("invalid_ticket")
    ticket_id = data.get("tid")
    if not ticket_id:
        raise TicketError("invalid_ticket")

    row = db.query(WebSocketTicket).filter(WebSocketTicket.ticket_id == ticket_id).first()
    if row is None:
        raise TicketError("unknown_ticket")
    if row.consumed:
        # Replay protection: a consumed ticket cannot be reused.
        raise TicketError("ticket_replayed")
    if row.expires_at < time.time():
        raise TicketError("ticket_expired")

    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise TicketError("unknown_user")
    if user.account_status in ("banned", "suspended", "deleted", "discord_membership_missing"):
        raise TicketError("access_denied")

    # Mark consumed (single use).
    row.consumed = True
    db.commit()

    return {
        "user_id": user.id,
        "game_tag": row.game_tag,
        "discord_id": row.discord_id,
        "permissions": row.permissions or "player",
    }


def check_live_access(db: DBSession, user_id: str) -> tuple[bool, str]:
    """Periodic re-check of a connected player's access (membership cache + status).

    Returns (allowed, reason). `reason` is one of: 'ok', 'banned', 'suspended',
    'discord_membership_missing', 'cache_miss'."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return False, "unknown_user"
    if user.account_status == "banned":
        return False, "banned"
    if user.account_status == "suspended":
        return False, "suspended"
    if user.account_status == "discord_membership_missing":
        return False, "discord_membership_missing"
    if user.discord is None:
        return False, "no_discord"
    # Use the cached membership result.
    from auth.membership import get_cached_membership
    cached = get_cached_membership(db, user.discord.discord_user_id)
    if cached is None:
        return False, "cache_miss"
    if not cached.ok:
        return False, "discord_membership_missing"
    return True, "ok"
