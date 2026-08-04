"""Administrative API routes. These implement the same moderation actions as the
Discord bot commands by delegating to the shared services. Every action requires
backend permission checks (staff/admin) and is audited.

Public error messages are generic; no secrets leak.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from auth.middleware import get_current_user, require_admin, require_staff
from auth.permissions import Permissions
from database import get_db
from models import AccountRole, Ban, DiscordAccount, User
from services import audit
from services.account_service import rename_player
from services.audit import audit as _audit
from services.moderation_service import (
    add_note, ban_user, force_logout, kick_user, suspend_user, unban_user,
    unsuspend_user, ban_is_active, suspension_is_active,
)
from services.websocket_service import check_live_access
from discord_http import DiscordHTTP
from config import DISCORD_BANNED_ROLE_ID

router = APIRouter(prefix="/admin", tags=["admin"])


# ---- shared action helpers (also called by the bot) ----
def _resolve_user(db: DBSession, identifier: str) -> User | None:
    from api.player_routes import _resolve_user as resolve
    return resolve(db, identifier)


def do_ban(db, actor_perms: Permissions, identifier: str, *,
           reason: str | None = None, duration_seconds: int | None = None,
           apply_role: bool = False) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    if user.discord and user.discord.discord_user_id == _owner_id():
        raise HTTPException(status_code=403, detail="Cannot ban the owner account")
    http = DiscordHTTP() if apply_role else None
    expires_at = None
    if duration_seconds:
        import time
        expires_at = time.time() + duration_seconds
    ban_user(db, user, reason=reason, moderator_discord_id=actor_perms.discord_user_id,
             expires_at=expires_at, apply_discord_role=apply_role, http=http)
    return {"ok": True, "action": "ban", "target": user.id}


def do_unban(db, actor_perms, identifier, *, apply_role: bool = False) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    http = DiscordHTTP() if apply_role else None
    unban_user(db, user, moderator_discord_id=actor_perms.discord_user_id, http=http)
    return {"ok": True, "action": "unban", "target": user.id}


def do_suspend(db, actor_perms, identifier, *, reason=None, duration_seconds=None) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    expires_at = None
    if duration_seconds:
        import time
        expires_at = time.time() + duration_seconds
    suspend_user(db, user, reason=reason, moderator_discord_id=actor_perms.discord_user_id,
                 expires_at=expires_at)
    return {"ok": True, "action": "suspend", "target": user.id}


def do_unsuspend(db, actor_perms, identifier) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    unsuspend_user(db, user, moderator_discord_id=actor_perms.discord_user_id)
    return {"ok": True, "action": "unsuspend", "target": user.id}


def do_kick(db, actor_perms, identifier, *, reason=None) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    count = kick_user(db, user, moderator_discord_id=actor_perms.discord_user_id, reason=reason)
    return {"ok": True, "action": "kick", "sessions_revoked": count}


def do_force_logout(db, actor_perms, identifier) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    count = force_logout(db, user, moderator_discord_id=actor_perms.discord_user_id)
    return {"ok": True, "action": "force_logout", "sessions_revoked": count}


def do_unlink(db, actor_perms, identifier) -> dict:
    if not actor_perms.is_admin:
        raise HTTPException(status_code=403, detail="Admin permission required")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    if user.discord and user.discord.discord_user_id == _owner_id():
        raise HTTPException(status_code=403, detail="Cannot unlink the owner account")
    user.account_status = "deleted"
    db.commit()
    force_logout(db, user, moderator_discord_id=actor_perms.discord_user_id, reason="unlinked")
    _audit(db, "account_unlinked", user_account_id=user.id,
           acting_staff_discord_id=actor_perms.discord_user_id)
    return {"ok": True, "action": "unlink", "target": user.id}


def do_rename(db, actor_perms, identifier, new_name: str, *, reason=None) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    ok, code = rename_player(db, user, new_name, changed_by_discord_id=actor_perms.discord_user_id,
                             reason=reason, notify=True)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Rename failed: {code}")
    return {"ok": True, "action": "rename", "to": user.profile.full_game_tag}


def do_rolesync(db, actor_perms, identifier) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None or user.discord is None:
        raise HTTPException(status_code=404, detail="Player or discord link not found")
    http = DiscordHTTP()
    member = http.get_bot_guild_member(http.client_secret, user.discord.discord_user_id)
    role_ids = [str(r) for r in member.get("roles", [])] if member else []
    # Replace account roles with synced Discord roles.
    db.query(AccountRole).filter(AccountRole.user_id == user.id).delete()
    from config import ROLE_TO_PERMISSION
    for rid in role_ids:
        db.add(AccountRole(user_id=user.id, discord_role_id=rid,
                           game_permission=ROLE_TO_PERMISSION.get(rid, "player"), source="discord"))
    db.commit()
    _audit(db, "role_sync", user_account_id=user.id,
           acting_staff_discord_id=actor_perms.discord_user_id,
           metadata={"role_ids": role_ids})
    return {"ok": True, "action": "rolesync", "role_ids": role_ids}


def do_note(db, actor_perms, identifier, note: str) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    user = _resolve_user(db, identifier)
    if user is None:
        raise HTTPException(status_code=404, detail="Player not found")
    add_note(db, user, note, author_discord_id=actor_perms.discord_user_id)
    return {"ok": True, "action": "note_added"}


def do_announce(db, actor_perms, message: str) -> dict:
    if not actor_perms.is_staff:
        raise HTTPException(status_code=403, detail="Permission denied")
    http = DiscordHTTP()
    from services.discord_service import send_announcement
    ok = send_announcement(http, message)
    _audit(db, "announcement", acting_staff_discord_id=actor_perms.discord_user_id,
           metadata={"len": len(message), "discord": ok})
    return {"ok": True, "discord_sent": ok}


def do_maintenance(db, actor_perms, enabled: bool, message: str | None = None) -> dict:
    if not actor_perms.is_admin:
        raise HTTPException(status_code=403, detail="Admin permission required")
    _audit(db, "maintenance", acting_staff_discord_id=actor_perms.discord_user_id,
           metadata={"enabled": enabled, "message": message})
    return {"ok": True, "maintenance": enabled}


def _owner_id() -> str | None:
    from config import GAME_OWNER_DISCORD_USER_ID
    return GAME_OWNER_DISCORD_USER_ID or None


# ---- REST endpoints ----
class IdenBody(BaseModel):
    identifier: str
    reason: str | None = None
    duration_seconds: int | None = None

class RenameBody(BaseModel):
    identifier: str
    new_name: str
    reason: str | None = None

class NoteBody(BaseModel):
    identifier: str
    note: str

class AnnounceBody(BaseModel):
    message: str

class MaintenanceBody(BaseModel):
    enabled: bool
    message: str | None = None


@router.post("/ban")
def admin_ban(body: IdenBody, db: DBSession = Depends(get_db),
              perms: Permissions = Depends(require_staff)):
    return do_ban(db, perms, body.identifier, reason=body.reason,
                  duration_seconds=body.duration_seconds, apply_role=True)

@router.post("/unban")
def admin_unban(body: IdenBody, db: DBSession = Depends(get_db),
                perms: Permissions = Depends(require_staff)):
    return do_unban(db, perms, body.identifier, apply_role=True)

@router.post("/suspend")
def admin_suspend(body: IdenBody, db: DBSession = Depends(get_db),
                  perms: Permissions = Depends(require_staff)):
    return do_suspend(db, perms, body.identifier, reason=body.reason,
                      duration_seconds=body.duration_seconds)

@router.post("/unsuspend")
def admin_unsuspend(body: IdenBody, db: DBSession = Depends(get_db),
                    perms: Permissions = Depends(require_staff)):
    return do_unsuspend(db, perms, body.identifier)

@router.post("/kick")
def admin_kick(body: IdenBody, db: DBSession = Depends(get_db),
               perms: Permissions = Depends(require_staff)):
    return do_kick(db, perms, body.identifier, reason=body.reason)

@router.post("/force-logout")
def admin_force_logout(body: IdenBody, db: DBSession = Depends(get_db),
                       perms: Permissions = Depends(require_staff)):
    return do_force_logout(db, perms, body.identifier)

@router.post("/unlink")
def admin_unlink(body: IdenBody, db: DBSession = Depends(get_db),
                 perms: Permissions = Depends(require_admin)):
    return do_unlink(db, perms, body.identifier)

@router.post("/rename")
def admin_rename(body: RenameBody, db: DBSession = Depends(get_db),
                 perms: Permissions = Depends(require_staff)):
    return do_rename(db, perms, body.identifier, body.new_name, reason=body.reason)

@router.post("/rolesync")
def admin_rolesync(body: IdenBody, db: DBSession = Depends(get_db),
                   perms: Permissions = Depends(require_staff)):
    return do_rolesync(db, perms, body.identifier)

@router.post("/notes")
def admin_note(body: NoteBody, db: DBSession = Depends(get_db),
               perms: Permissions = Depends(require_staff)):
    return do_note(db, perms, body.identifier, body.note)

@router.post("/announce")
def admin_announce(body: AnnounceBody, db: DBSession = Depends(get_db),
                   perms: Permissions = Depends(require_staff)):
    return do_announce(db, perms, body.message)

@router.post("/maintenance")
def admin_maintenance(body: MaintenanceBody, db: DBSession = Depends(get_db),
                      perms: Permissions = Depends(require_admin)):
    return do_maintenance(db, perms, body.enabled, message=body.message)


@router.get("/online")
def admin_online(db: DBSession = Depends(get_db), perms: Permissions = Depends(require_staff)):
    from models import Session as Sess
    active = db.query(Sess).filter(Sess.revoked.is_(False)).all()
    users = []
    for s in active:
        u = db.get(User, s.user_id)
        if u and u.profile:
            allowed, reason = check_live_access(db, u.id)
            users.append({"account_id": u.id, "game_tag": u.profile.full_game_tag,
                          "access": allowed, "reason": reason})
    return {"online": users, "count": len(users)}


@router.get("/registrations")
def admin_registrations(db: DBSession = Depends(get_db), perms: Permissions = Depends(require_staff)):
    from sqlalchemy import func
    from models import User as U
    total = db.query(func.count(U.id)).scalar() or 0
    return {"total_accounts": total}


@router.get("/audit")
def admin_audit(q: str | None = Query(None), limit: int = 50,
                db: DBSession = Depends(get_db), perms: Permissions = Depends(require_staff)):
    from models import AuditLog
    query = db.query(AuditLog).order_by(AuditLog.timestamp.desc())
    if q:
        # Resolve identifier to user to filter by account.
        user = _resolve_user(db, q)
        if user:
            query = query.filter(AuditLog.user_account_id == user.id)
    rows = query.limit(limit).all()
    return {"events": [
        {"event": r.event_type, "at": r.timestamp.isoformat() if r.timestamp else None,
         "user": r.user_account_id, "actor": r.acting_staff_discord_id, "reason": r.reason}
        for r in rows
    ]}


@router.get("/host-status")
def admin_host_status(db: DBSession = Depends(get_db), perms: Permissions = Depends(require_staff)):
    from services.host_status_service import check_world_health
    return check_world_health().to_dict()
