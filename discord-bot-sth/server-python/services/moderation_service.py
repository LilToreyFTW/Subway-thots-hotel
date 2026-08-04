"""Moderation service: ban, unban, suspend, unsuspend, kick, force-logout,
notes, and session revocation. Every action is audited and permission-checked by
the caller (admin_routes / bot commands) before invoking these helpers.
"""
from __future__ import annotations

import time
from typing import Any

from sqlalchemy.orm import Session as DBSession

from config import DISCORD_BANNED_ROLE_ID
from models import (
    AccountRole,
    Ban,
    LoginHistory,
    ModerationNote,
    Session,
    Suspension,
    User,
)
from services import audit
from auth.sessions import revoke_all_sessions


def ban_user(db: DBSession, user: User, *, reason: str | None = None,
             moderator_discord_id: str | None = None,
             expires_at: float | None = None,
             apply_discord_role: bool = False,
             http: Any = None) -> None:
    """Ban a game account: record ban, revoke sessions, disconnect, optional role."""
    # Deactivate any existing active ban.
    db.query(Ban).filter(Ban.user_id == user.id, Ban.active.is_(True)).update(
        {Ban.active: False})
    ban = Ban(user_id=user.id, reason=reason, moderator_discord_id=moderator_discord_id,
              expires_at=expires_at)
    db.add(ban)
    user.account_status = "banned"
    db.commit()
    revoke_all_sessions(db, user.id, reason="banned")
    _consume_tickets(db, user.id)
    if apply_discord_role and DISCORD_BANNED_ROLE_ID and http is not None:
        from services.discord_service import assign_role_safe
        assign_role_safe(http, user.discord.discord_user_id, "banned", db=db,
                         actor_discord_id=moderator_discord_id)
    audit(db, "ban", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=moderator_discord_id, reason=reason,
          metadata={"expires_at": expires_at, "apply_role": apply_discord_role})


def unban_user(db: DBSession, user: User, *, moderator_discord_id: str | None = None,
               http: Any = None) -> None:
    db.query(Ban).filter(Ban.user_id == user.id, Ban.active.is_(True)).update(
        {Ban.active: False})
    if user.account_status == "banned":
        user.account_status = "active"
    db.commit()
    if DISCORD_BANNED_ROLE_ID and http is not None and user.discord:
        from services.discord_service import remove_role_safe
        remove_role_safe(http, user.discord.discord_user_id, "banned", db=db,
                        actor_discord_id=moderator_discord_id)
    audit(db, "unban", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=moderator_discord_id)


def suspend_user(db: DBSession, user: User, *, reason: str | None = None,
                 moderator_discord_id: str | None = None,
                 expires_at: float | None = None) -> None:
    db.query(Suspension).filter(Suspension.user_id == user.id,
                                Suspension.active.is_(True)).update({Suspension.active: False})
    suspension = Suspension(user_id=user.id, reason=reason,
                            moderator_discord_id=moderator_discord_id, expires_at=expires_at)
    db.add(suspension)
    if user.account_status == "active":
        user.account_status = "suspended"
    db.commit()
    revoke_all_sessions(db, user.id, reason="suspended")
    _consume_tickets(db, user.id)
    audit(db, "suspension", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=moderator_discord_id, reason=reason,
          metadata={"expires_at": expires_at})


def unsuspend_user(db: DBSession, user: User, *,
                   moderator_discord_id: str | None = None) -> None:
    db.query(Suspension).filter(Suspension.user_id == user.id,
                                Suspension.active.is_(True)).update({Suspension.active: False})
    if user.account_status == "suspended":
        user.account_status = "active"
    db.commit()
    audit(db, "unsuspension", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=moderator_discord_id)


def force_logout(db: DBSession, user: User, *, moderator_discord_id: str | None = None,
                 reason: str = "forced_logout") -> int:
    count = revoke_all_sessions(db, user.id, reason=reason)
    _consume_tickets(db, user.id)
    audit(db, "force_logout", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=moderator_discord_id, metadata={"sessions": count})
    return count


def kick_user(db: DBSession, user: User, *, moderator_discord_id: str | None = None,
              reason: str | None = None) -> int:
    """Kick disconnects the player by revoking live tickets + sessions (no ban)."""
    count = revoke_all_sessions(db, user.id, reason="kicked")
    _consume_tickets(db, user.id)
    audit(db, "kick", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=moderator_discord_id, reason=reason)
    return count


def add_note(db: DBSession, user: User, note: str, *, author_discord_id: str | None = None) -> None:
    db.add(ModerationNote(user_id=user.id, author_discord_id=author_discord_id, note=note[:1024]))
    db.commit()
    audit(db, "note_added", user_account_id=user.id,
          acting_staff_discord_id=author_discord_id, metadata={"len": len(note)})


def _consume_tickets(db: DBSession, user_id: str) -> None:
    from models import WebSocketTicket
    db.query(WebSocketTicket).filter(
        WebSocketTicket.user_id == user_id, WebSocketTicket.consumed.is_(False)
    ).update({WebSocketTicket.consumed: True})
    db.commit()


def ban_is_active(user: User, now: float | None = None) -> bool:
    now = now or time.time()
    for ban in user.bans:
        if ban.active and (ban.expires_at is None or ban.expires_at > now):
            return True
    return False


def suspension_is_active(user: User, now: float | None = None) -> bool:
    now = now or time.time()
    for s in user.suspensions:
        if s.active and (s.expires_at is None or s.expires_at > now):
            return True
    return False
