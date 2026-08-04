"""Discord membership enforcement.

Players must remain guild members to play. We cache verification results with a
configurable TTL (MEMBERSHIP_CACHE_TTL_SECONDS) so we never call Discord on every
movement. The cache is checked at: signup, login, session creation, periodically
while online, on reconnect, on region change, and on protected endpoints.

On membership loss we mark the account, revoke sessions, and (via the websocket
service) disconnect the player.
"""
from __future__ import annotations

import time
from typing import Any

from sqlalchemy.orm import Session as DBSession

from config import (
    DISCORD_BANNED_ROLE_ID,
    MEMBERSHIP_CACHE_TTL_SECONDS,
    is_banned_role,
    resolve_permission_from_roles,
)
from models import AccountRole, DiscordAccount, DiscordMembershipCache, User
from services import audit


class MembershipResult:
    def __init__(self, *, ok: bool, reason: str, is_member: bool, role_ids: list[str],
                 permission: str, cached: bool) -> None:
        self.ok = ok
        self.reason = reason
        self.is_member = is_member
        self.role_ids = role_ids
        self.permission = permission
        self.cached = cached

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "reason": self.reason,
            "is_member": self.is_member,
            "role_ids": self.role_ids,
            "permission": self.permission,
            "cached": self.cached,
        }


def _cache_row(db: DBSession, discord_user_id: str) -> DiscordMembershipCache | None:
    return db.query(DiscordMembershipCache).filter(
        DiscordMembershipCache.discord_user_id == discord_user_id).first()


def get_cached_membership(db: DBSession, discord_user_id: str) -> MembershipResult | None:
    row = _cache_row(db, discord_user_id)
    if row is None:
        return None
    if row.expires_at < time.time():
        return None
    permission = row.permission
    if row.is_member and row.permission == "banned":
        # Re-derive: banned role may have changed; but cache says banned.
        pass
    return MembershipResult(
        ok=row.is_member and permission != "banned",
        reason="ok" if (row.is_member and permission != "banned") else "membership_invalid",
        is_member=row.is_member,
        role_ids=[r for r in row.role_ids.split(",") if r],
        permission=permission,
        cached=True,
    )


def verify_membership(db: DBSession, *, discord_user_id: str,
                      live_member: dict | None = None,
                      live_role_ids: list[str] | None = None) -> MembershipResult:
    """Verify (fresh or cached) membership for a Discord user.

    If `live_member`/`live_role_ids` are provided (from the Discord API), the
    cache is refreshed and the fresh result returned. Otherwise the cache is used
    if still valid; if stale, the caller is expected to perform a live check and
    call again with live data. This keeps movement hot-paths cache-only.
    """
    if live_member is not None or live_role_ids is not None:
        role_ids = live_role_ids if live_role_ids is not None else []
        is_member = live_member is not None
        banned = is_banned_role(role_ids)
        permission = "banned" if banned else resolve_permission_from_roles(role_ids)
        _write_cache(db, discord_user_id, is_member, role_ids, permission)
        ok = is_member and not banned
        return MembershipResult(
            ok=ok,
            reason="ok" if ok else ("banned" if banned else "not_member"),
            is_member=is_member,
            role_ids=role_ids,
            permission=permission,
            cached=False,
        )

    cached = get_cached_membership(db, discord_user_id)
    if cached is not None:
        return cached
    # No fresh data and no valid cache -> cannot verify.
    return MembershipResult(
        ok=False, reason="cache_miss", is_member=False, role_ids=[], permission="guest", cached=False
    )


def _write_cache(db: DBSession, discord_user_id: str, is_member: bool, role_ids: list[str],
                 permission: str) -> None:
    row = _cache_row(db, discord_user_id)
    if row is None:
        row = DiscordMembershipCache(discord_user_id=discord_user_id)
        db.add(row)
    row.is_member = is_member
    row.role_ids = ",".join(role_ids)
    row.permission = permission
    row.cached_at = time.time()
    row.expires_at = time.time() + MEMBERSHIP_CACHE_TTL_SECONDS
    db.commit()


def on_member_left(db: DBSession, discord_user_id: str, *,
                   http: Any = None, guild_id: str | None = None) -> None:
    """Called when a guild `member remove` event fires (or a manual re-check).

    Marks the account membership missing, revokes active sessions, and records an
    audit entry. The websocket service disconnects the player on next cached
    check (see websocket_service)."""
    from auth.sessions import revoke_all_sessions
    from models import WebSocketTicket

    # Invalidate cache.
    _write_cache(db, discord_user_id, is_member=False, role_ids=[], permission="guest")

    # Update the Discord account record.
    discord = db.query(DiscordAccount).filter(
        DiscordAccount.discord_user_id == discord_user_id).first()
    if discord is not None:
        discord.guild_member = False
        db.commit()

    user = db.query(User).join(User.discord).filter(
        DiscordAccount.discord_user_id == discord_user_id).first() if discord else None
    if user is not None:
        if user.account_status == "active":
            user.account_status = "discord_membership_missing"
            db.commit()
        revoked = revoke_all_sessions(db, user.id, reason="discord_membership_lost")
        # Mark tickets consumed so reconnect is denied.
        db.query(WebSocketTicket).filter(
            WebSocketTicket.user_id == user.id, WebSocketTicket.consumed.is_(False)
        ).update({WebSocketTicket.consumed: True})
        db.commit()
        audit(db, "membership_lost", user_account_id=user.id,
              discord_user_id=discord_user_id,
              metadata={"sessions_revoked": revoked})


def on_member_joined(db: DBSession, discord_user_id: str, *, role_ids: list[str] | None = None) -> None:
    """Called when a guild `member add` event fires. Restores membership status
    if the player had lost it."""
    discord = db.query(DiscordAccount).filter(
        DiscordAccount.discord_user_id == discord_user_id).first()
    if discord is not None:
        discord.guild_member = True
        db.commit()
    user = db.query(User).join(User.discord).filter(
        DiscordAccount.discord_user_id == discord_user_id).first() if discord else None
    if user is not None and user.account_status == "discord_membership_missing":
        # Only restore if not banned/suspended.
        banned = db.query(AccountRole).filter(
            AccountRole.user_id == user.id,
            AccountRole.discord_role_id == DISCORD_BANNED_ROLE_ID,
        ).first() if DISCORD_BANNED_ROLE_ID else None
        if banned is None:
            user.account_status = "active"
            db.commit()
    if role_ids is not None:
        _write_cache(db, discord_user_id, is_member=True, role_ids=role_ids,
                     permission=resolve_permission_from_roles(role_ids))
