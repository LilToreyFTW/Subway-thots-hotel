"""Account API routes: player-name creation, availability check, membership status,
reverification, WebSocket ticket issuance, and profile retrieval."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Header, Request, Cookie
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from auth.middleware import (
    AuthError, client_key, check_rate_limit, csrf_dependency, get_current_user,
    get_permissions, require_staff, _signup_limiter,
)
from auth.permissions import Permissions
from auth.sessions import get_session, verify_csrf
from config import DISCORD_INVITE_URL, FRONTEND_URL, MEMBERSHIP_CACHE_TTL_SECONDS
from database import get_db
from models import User
from services import audit
from services.account_service import check_player_name, create_account_for_discord
from services.discord_service import assign_role_safe, send_registration_embed
from services.websocket_service import issue_ticket
from discord_http import DiscordHTTP
from auth.membership import verify_membership, get_cached_membership

router = APIRouter(prefix="/account", tags=["account"])


class NameBody(BaseModel):
    display_name: str


@router.post("/check-player-name")
def check_name(body: NameBody, db: DBSession = Depends(get_db)):
    result = check_player_name(db, body.display_name.strip())
    return result


@router.post("/create-player-name")
def create_name(
    body: NameBody,
    request: Request,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(csrf_dependency),
):
    """Create the in-game name for a verified Discord account. One name per
    Discord id; the server generates the 6-digit number."""
    check_rate_limit(client_key(request), _signup_limiter)
    if user.profile is not None:
        return {"ok": False, "error": "name_already_set"}
    if user.discord is None:
        return {"ok": False, "error": "no_discord_link"}

    http = DiscordHTTP()
    discord_user = type("D", (), {})()
    for attr, val in [
        ("user_id", user.discord.discord_user_id),
        ("username", user.discord.discord_username),
        ("global_name", user.discord.discord_global_name),
        ("avatar_hash", user.discord.discord_avatar_hash),
        ("is_guild_member", user.discord.guild_member),
        ("role_ids", _role_ids(db, user)),
    ]:
        setattr(discord_user, attr, val)

    created, code, payload = create_account_for_discord(
        db, discord_user, game_name=body.display_name.strip(),
        assign_verified_role=True, http=http)
    if created is None:
        return {"ok": False, "error": code}

    # Announce to Discord registration channel (no secrets/IPs).
    try:
        send_registration_embed(
            http,
            game_tag=payload["game_tag"],
            discord_username=user.discord.discord_username or "unknown",
            discord_id=user.discord.discord_user_id,
            account_id=str(user.id),
            member_verified=True,
            roles=_role_ids(db, user),
            created_at=time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
        )
    except Exception:
        pass

    user.last_login_at = time.time()
    db.commit()
    return {
        "ok": True,
        "display_name": body.display_name.strip(),
        "name_number": payload["name_number"],
        "full_game_tag": payload["game_tag"],
    }


@router.get("/me")
def account_me(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    from api.auth_routes import _public_user, _permissions
    perms = _permissions(db, user)
    return _public_user(db, user, perms)


@router.get("/membership")
def membership_status(
    request: Request,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return cached membership status. Does NOT call Discord on every request."""
    if user.discord is None:
        return {"ok": False, "is_member": False, "reason": "no_discord"}
    cached = get_cached_membership(db, user.discord.discord_user_id)
    if cached is None:
        return {"ok": False, "is_member": False, "cached": False,
                "reason": "cache_miss", "invite_url": DISCORD_INVITE_URL}
    return {"ok": cached.ok, "is_member": cached.is_member, "cached": True,
            "permission": cached.permission, "role_ids": cached.role_ids,
            "invite_url": DISCORD_INVITE_URL}


@router.post("/reverify-membership")
def reverify_membership(
    request: Request,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(csrf_dependency),
):
    """Force a fresh membership re-check. Used after the player rejoins Discord."""
    if user.discord is None:
        return {"ok": False, "reason": "no_discord"}
    # We cannot call the OAuth member endpoint without a fresh access token here,
    # so we rely on the bot (which holds a guild token) to refresh the cache via
    # its periodic sweep / member events. If the bot is unavailable, return a
    # 'pending' status rather than falsely denying access.
    cached = get_cached_membership(db, user.discord.discord_user_id)
    if cached is not None and cached.ok:
        return {"ok": True, "is_member": True, "permission": cached.permission}
    return {"ok": False, "is_member": False, "pending": True,
            "reason": "awaiting_bot_verification", "invite_url": DISCORD_INVITE_URL}


@router.post("/ws-ticket")
def request_ws_ticket(
    request: Request,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
    _csrf: None = Depends(csrf_dependency),
):
    """Issue a short-lived, single-use WebSocket ticket for the multiplayer
    connection. Only valid when membership is currently verified."""
    if user.discord is None:
        return {"ok": False, "error": "no_discord"}, 403
    cached = get_cached_membership(db, user.discord.discord_user_id)
    if cached is None or not cached.ok:
        return {"ok": False, "error": "membership_required",
                "invite_url": DISCORD_INVITE_URL}, 403
    perms = get_permissions(user, db)
    try:
        ticket = issue_ticket(db, user, permissions=perms.permission)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}, 403
    return {"ok": True, "ticket": ticket["ticket"], "expires_in": ticket["expires_in"]}


def _role_ids(db: DBSession, user: User) -> list[str]:
    from models import AccountRole
    return [r.discord_role_id for r in db.query(AccountRole).filter(
        AccountRole.user_id == user.id).all()]
