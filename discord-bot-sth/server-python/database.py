"""Database engine and session factory.

Production uses PostgreSQL (DATABASE_URL=postgresql://...). Local development
falls back to SQLite automatically. The auth schema shares the same database
file/url as the existing world host so accounts and live players live together.
"""
from __future__ import annotations

import os
from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import DATABASE_URL

engine_kwargs: dict[str, Any] = {"pool_pre_ping": True, "future": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_models() -> None:
    """Create all tables. Called from the app lifespan and migration bootstrap."""
    # Import models so they register on Base.metadata before create_all.
    from models import (  # noqa: F401
        AccountRole,
        AuditLog,
        Ban,
        DiscordAccount,
        DiscordMembershipCache,
        GameProfile,
        LoginHistory,
        ModerationNote,
        OAuthState,
        RenameHistory,
        RoleMapping,
        Session,
        Suspension,
        User,
        WebSocketTicket,
    )
    Base.metadata.create_all(bind=engine)
