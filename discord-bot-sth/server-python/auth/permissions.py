"""Permission resolution and authorization checks.

All permission decisions are validated on the backend. The owner Discord id is
centralized in config and is the single source of truth for owner permission —
no scattered `if discord_id == '...'` bypasses around the code.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from config import (
    ADMIN_PERMISSIONS,
    GAME_OWNER_DISCORD_USER_ID,
    STAFF_PERMISSIONS,
    resolve_permission_from_roles,
)
from models import User


@dataclass
class Permissions:
    """Computed permission set for a user, derived from DB roles + owner config."""

    permission: str  # top-level: owner | admin | moderator | staff | player | guest
    discord_user_id: str | None
    role_ids: list[str]
    is_owner: bool = False

    @property
    def is_admin(self) -> bool:
        return self.permission in ADMIN_PERMISSIONS

    @property
    def is_staff(self) -> bool:
        return self.permission in STAFF_PERMISSIONS

    def can(self, required: str) -> bool:
        """Check a required capability level."""
        levels = {"guest": 0, "player": 1, "staff": 2, "moderator": 3, "admin": 4, "owner": 5}
        have = levels.get(self.permission, 0)
        need = levels.get(required, 1)
        return have >= need


def compute_permissions(discord_user_id: str | None, role_ids: Iterable[str]) -> Permissions:
    roles = list(role_ids or [])
    base = resolve_permission_from_roles(roles)
    is_owner = bool(GAME_OWNER_DISCORD_USER_ID) and discord_user_id == GAME_OWNER_DISCORD_USER_ID
    if is_owner:
        base = "owner"
    return Permissions(permission=base, discord_user_id=discord_user_id, role_ids=roles, is_owner=is_owner)


def permission_for_user(db, user: User) -> Permissions:
    """Build Permissions for a persisted user by reading their DB roles."""
    from models import AccountRole

    role_rows = db.query(AccountRole).filter(AccountRole.user_id == user.id).all()
    role_ids = [r.discord_role_id for r in role_rows]
    discord_id = user.discord.discord_user_id if user.discord else None
    return compute_permissions(discord_id, role_ids)
