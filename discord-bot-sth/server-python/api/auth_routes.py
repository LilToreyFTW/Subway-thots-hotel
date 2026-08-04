"""Authentication API routes (Discord OAuth2 + session management)."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Request, Response, Cookie
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from auth.discord_oauth import create_authorization_start, handle_callback
from auth.membership import verify_membership
from auth.sessions import (
    create_session, cookie_attributes, get_session, revoke_session,
    rotate_session, touch_session,
)
from auth.discord_oauth import consume_state
from config import (
    DISCORD_GUILD_ID, DISCORD_INVITE_URL, DISCORD_PLAYER_ROLE_ID,
    DISCORD_VERIFIED_ROLE_ID, FRONTEND_URL, MEMBERSHIP_CACHE_TTL_SECONDS,
)
from database import get_db
from models import DiscordAccount, User
from services import audit
from auth.middleware import AuthError, client_key, check_rate_limit, _login_limiter

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshBody(BaseModel):
    pass


@router.get("/discord/login")
def discord_login(request: Request, db: DBSession = Depends(get_db)):
    """Begin Discord OAuth2. Returns the authorization URL (and CSRF token for the
    SPA to include as a header after redirect)."""
    check_rate_limit(client_key(request), _login_limiter)
    start = create_authorization_start(db, with_pkce=True)
    # Stash CSRF in a short-lived cookie so the callback can verify it too.
    resp = JSONResponse({"authorize_url": start["authorize_url"], "state": start["state"]})
    resp.set_cookie("sth_oauth_csrf", start["csrf_token"], max_age=600, httponly=True,
                    secure=False, samesite="lax")
    return resp


@router.get("/discord/callback")
def discord_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    db: DBSession = Depends(get_db),
):
    """OAuth2 redirect target. Verifies state, exchanges code, verifies guild
    membership, and either issues a session cookie or returns an error result the
    frontend can render (membership required / role required)."""
    check_rate_limit(client_key(request), _login_limiter)
    # The PKCE verifier is looked up from the stored state inside handle_callback.
    ok, error_code, discord_user = handle_callback(db, code=code, state=state)
    if not ok:
        audit(db, "login_failed", discord_user_id=None,
              metadata={"error": error_code})
        return JSONResponse(
            {"ok": False, "error": error_code},
            status_code=400,
        )

    # Guild membership check (cached or fresh from the OAuth member lookup).
    member = None
    if discord_user.is_guild_member:
        member = {"roles": discord_user.role_ids}
    result = verify_membership(db, discord_user_id=discord_user.user_id, live_member=member,
                               live_role_ids=discord_user.role_ids)
    if not result.ok:
        if not result.is_member:
            return JSONResponse(
                {"ok": False, "error": "membership_required",
                 "invite_url": DISCORD_INVITE_URL,
                 "message": "You must be a member of the Subway-Thots-Hotel Discord server to play."},
                status_code=403,
            )
        if result.permission == "banned":
            return JSONResponse(
                {"ok": False, "error": "banned",
                 "message": "Your Discord account is banned from this community."},
                status_code=403,
            )
        # Missing the required player/verified role.
        missing = []
        if DISCORD_PLAYER_ROLE_ID and DISCORD_PLAYER_ROLE_ID not in discord_user.role_ids:
            missing.append("Player")
        if DISCORD_VERIFIED_ROLE_ID and DISCORD_VERIFIED_ROLE_ID not in discord_user.role_ids:
            missing.append("Verified")
        return JSONResponse(
            {"ok": False, "error": "role_required",
             "missing_roles": missing,
             "message": "Join the server and obtain the required role(s) to play."},
            status_code=403,
        )

    # Find or create the user linked to this Discord id.
    discord = db.query(DiscordAccount).filter(
        DiscordAccount.discord_user_id == discord_user.user_id).first()
    if discord is None:
        # New player: they need to create a game name next (account not yet created).
        # We store a pre-session so the name-creation screen is authenticated.
        user = User(account_status="active")
        db.add(user)
        db.flush()
        discord = DiscordAccount(
            user_id=user.id,
            discord_user_id=discord_user.user_id,
            discord_username=discord_user.username,
            discord_global_name=discord_user.global_name,
            discord_avatar_hash=discord_user.avatar_hash,
            guild_member=True,
            last_verified_at=time.time(),
        )
        db.add(discord)
        db.commit()
    else:
        user = discord.user
        # Refresh identity (username/global name/avatar may have changed).
        discord.discord_username = discord_user.username
        discord.discord_global_name = discord_user.global_name
        discord.discord_avatar_hash = discord_user.avatar_hash
        discord.guild_member = True
        discord.last_verified_at = time.time()
        if user.account_status == "discord_membership_missing":
            user.account_status = "active"
        db.commit()

    raw_token, csrf, signed = create_session(db, user, user_agent=request.headers.get("user-agent"))
    audit(db, "login", user_account_id=user.id,
          discord_user_id=discord_user.user_id, metadata={"method": "discord_oauth"})

    # Determine whether the player still needs to create a game name.
    needs_name = user.profile is None
    resp = JSONResponse({
        "ok": True,
        "needs_player_name": needs_name,
        "session_token": signed,
        "csrf_token": csrf,
        "discord": {
            "id": discord_user.user_id,
            "username": discord_user.username,
            "global_name": discord_user.global_name,
            "avatar": _avatar_url(discord_user.user_id, discord_user.avatar_hash),
        },
        "permissions": result.permission,
    })
    attrs = cookie_attributes()
    resp.set_cookie("sth_session", raw_token, **attrs)
    resp.set_cookie("sth_csrf", csrf, max_age=attrs["max_age"], httponly=False,
                    secure=attrs["secure"], samesite=attrs["samesite"])
    return resp


def _avatar_url(user_id: str, avatar_hash: str | None) -> str | None:
    from discord_http import avatar_url as _av
    return _av(user_id, avatar_hash)


@router.get("/session")
def get_session_status(
    db: DBSession = Depends(get_db),
    sth_session: str | None = Cookie(default=None),
):
    session = get_session(db, sth_session)
    if session is None:
        return JSONResponse({"authenticated": False}, status_code=401)
    user = db.get(User, session.user_id)
    if user is None:
        return JSONResponse({"authenticated": False}, status_code=401)
    touch_session(db, session)
    perms = _permissions(db, user)
    payload = {
        "authenticated": True,
        "user": _public_user(db, user, perms),
        "csrf_token": session.csrf_token,
    }
    return JSONResponse(payload)


@router.post("/logout")
def logout(
    db: DBSession = Depends(get_db),
    sth_session: str | None = Cookie(default=None),
):
    session = get_session(db, sth_session)
    if session is not None:
        revoke_session(db, session, reason="logout")
        audit(db, "logout", user_account_id=session.user_id)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("sth_session")
    resp.delete_cookie("sth_csrf")
    return resp


@router.post("/refresh")
def refresh(
    request: Request,
    db: DBSession = Depends(get_db),
    sth_session: str | None = Cookie(default=None),
):
    session = get_session(db, sth_session)
    if session is None:
        return JSONResponse({"ok": False, "error": "invalid_session"}, status_code=401)
    user = db.get(User, session.user_id)
    if user is None:
        return JSONResponse({"ok": False, "error": "invalid_session"}, status_code=401)
    raw_token, csrf, signed = rotate_session(db, session, user)
    resp = JSONResponse({"ok": True, "session_token": signed, "csrf_token": csrf})
    attrs = cookie_attributes()
    resp.set_cookie("sth_session", raw_token, **attrs)
    resp.set_cookie("sth_csrf", csrf, max_age=attrs["max_age"], httponly=False,
                    secure=attrs["secure"], samesite=attrs["samesite"])
    return resp


def _permissions(db: DBSession, user: User):
    from auth.permissions import permission_for_user
    return permission_for_user(db, user)


def _public_user(db: DBSession, user: User, perms) -> dict:
    from config import MEMBERSHIP_CACHE_TTL_SECONDS
    discord = user.discord
    profile = user.profile
    return {
        "account_id": user.id,
        "account_status": user.account_status,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "discord": {
            "id": discord.discord_user_id if discord else None,
            "username": discord.discord_username if discord else None,
            "global_name": discord.discord_global_name if discord else None,
            "avatar": _avatar_url(discord.discord_user_id, discord.discord_avatar_hash)
            if discord else None,
            "guild_member": discord.guild_member if discord else False,
        },
        "game": {
            "display_name": profile.display_name if profile else None,
            "name_number": profile.name_number if profile else None,
            "full_game_tag": profile.full_game_tag if profile else None,
        } if profile else None,
        "permissions": perms.permission,
        "is_owner": perms.is_owner,
        "role_ids": perms.role_ids,
    }
