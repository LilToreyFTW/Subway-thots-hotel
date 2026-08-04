"""Player lookup API (used by the frontend profile / admin tooling). Sensitive
results require staff permission."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as DBSession

from auth.middleware import get_current_user, require_staff
from database import get_db
from models import (
    AccountRole, AuditLog, Ban, DiscordAccount, GameProfile, LoginHistory,
    ModerationNote, Session, Suspension, User, WebSocketTicket,
)

router = APIRouter(prefix="/players", tags=["players"])


def _resolve_user(db: DBSession, identifier: str) -> User | None:
    # Try game tag, display name, account id, discord id, mention.
    ident = identifier.strip().lstrip("<@!").rstrip(">")
    profile = db.query(GameProfile).filter(
        (GameProfile.full_game_tag == ident) |
        (GameProfile.display_name == ident) |
        (GameProfile.normalized_display_name == ident.lower())
    ).first()
    if profile:
        return profile.user
    discord = db.query(DiscordAccount).filter(
        DiscordAccount.discord_user_id == ident).first()
    if discord:
        return discord.user
    user = db.get(User, ident)
    if user:
        return user
    return None


@router.get("/lookup")
def lookup(
    q: str = Query(...),
    db: DBSession = Depends(get_db),
    staff: object = Depends(require_staff),
):
    user = _resolve_user(db, q)
    if user is None:
        return {"found": False}
    profile = user.profile
    discord = user.discord
    role_ids = [r.discord_role_id for r in db.query(AccountRole).filter(
        AccountRole.user_id == user.id).all()]
    active_sessions = db.query(Session).filter(
        Session.user_id == user.id, Session.revoked.is_(False)).count()
    ban = db.query(Ban).filter(Ban.user_id == user.id, Ban.active.is_(True)).first()
    susp = db.query(Suspension).filter(
        Suspension.user_id == user.id, Suspension.active.is_(True)).first()
    notes = db.query(ModerationNote).filter(
        ModerationNote.user_id == user.id).order_by(ModerationNote.created_at.desc()).limit(10).all()
    last_login = db.query(LoginHistory).filter(
        LoginHistory.user_id == user.id, LoginHistory.outcome == "success"
    ).order_by(LoginHistory.created_at.desc()).first()

    return {
        "found": True,
        "account_id": user.id,
        "account_status": user.account_status,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "discord": {
            "id": discord.discord_user_id if discord else None,
            "username": discord.discord_username if discord else None,
            "global_name": discord.discord_global_name if discord else None,
            "guild_member": discord.guild_member if discord else False,
        },
        "game": {
            "display_name": profile.display_name if profile else None,
            "name_number": profile.name_number if profile else None,
            "full_game_tag": profile.full_game_tag if profile else None,
        },
        "roles": role_ids,
        "ban": {"active": bool(ban), "reason": ban.reason if ban else None} if ban else {"active": False},
        "suspension": {"active": bool(susp), "reason": susp.reason if susp else None} if susp else {"active": False},
        "active_sessions": active_sessions,
        "last_login": last_login.created_at.isoformat() if last_login else None,
        "notes": [{"note": n.note, "by": n.author_discord_id, "at": n.created_at.isoformat()} for n in notes],
    }
