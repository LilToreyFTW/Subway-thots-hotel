"""Aggregate model imports so `from models import User, DiscordAccount, ...` works."""
from __future__ import annotations

from models.bans import (  # noqa: F401
    AccountRole,
    AuditLog,
    Ban,
    DiscordMembershipCache,
    LoginHistory,
    ModerationNote,
    RenameHistory,
    RoleMapping,
    Suspension,
)
from models.sessions import (  # noqa: F401
    OAuthState,
    Session,
    WebSocketTicket,
)
from models.users import (  # noqa: F401
    AccountStatus,
    GameProfile,
    User,
    DiscordAccount,
)

__all__ = [
    "User",
    "DiscordAccount",
    "GameProfile",
    "AccountStatus",
    "Session",
    "WebSocketTicket",
    "DiscordMembershipCache",
    "OAuthState",
    "RoleMapping",
    "AccountRole",
    "Ban",
    "Suspension",
    "RenameHistory",
    "ModerationNote",
    "AuditLog",
    "LoginHistory",
]
