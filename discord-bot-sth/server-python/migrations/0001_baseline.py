"""Idempotent migration bootstrap.

Ensures the auth schema exists. In production, run the SQL in
migrations/0001_auth_schema.sql via your migration tool (or psql). In local dev
SQLite, SQLAlchemy create_all is sufficient. This module is safe to run repeatedly.
"""
from __future__ import annotations

from database import Base, engine, init_models
from models import (  # noqa: F401
    AccountRole, AuditLog, Ban, DiscordAccount, DiscordMembershipCache,
    GameProfile, LoginHistory, ModerationNote, OAuthState, RenameHistory,
    RoleMapping, Session, Suspension, User, WebSocketTicket,
)


def migrate() -> None:
    init_models()
    # Seed default role mappings so the bot/admin can interpret Discord roles.
    from config import (
        DISCORD_OWNER_ROLE_ID, DISCORD_ADMIN_ROLE_ID, DISCORD_MODERATOR_ROLE_ID,
        DISCORD_STAFF_ROLE_ID, DISCORD_PLAYER_ROLE_ID, DISCORD_VERIFIED_ROLE_ID,
    )
    from models import RoleMapping
    from sqlalchemy.orm import Session as DBSession

    defaults = [
        (DISCORD_OWNER_ROLE_ID, "owner", "Discord Owner"),
        (DISCORD_ADMIN_ROLE_ID, "admin", "Discord Admin"),
        (DISCORD_MODERATOR_ROLE_ID, "moderator", "Discord Moderator"),
        (DISCORD_STAFF_ROLE_ID, "staff", "Discord Staff"),
        (DISCORD_PLAYER_ROLE_ID, "player", "Discord Player"),
        (DISCORD_VERIFIED_ROLE_ID, "player", "Discord Verified"),
    ]
    db = DBSession(bind=engine)
    try:
        for role_id, perm, desc in defaults:
            if not role_id:
                continue
            existing = db.query(RoleMapping).filter(
                RoleMapping.discord_role_id == role_id).first()
            if existing is None:
                db.add(RoleMapping(discord_role_id=role_id, game_permission=perm, description=desc))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
    print("Migration complete.")
