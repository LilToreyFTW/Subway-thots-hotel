"""Shared test fixtures: an in-memory SQLite database, a FastAPI TestClient, and a
fake DiscordHTTP that records calls and returns canned responses. No live Discord
requests are made in tests.
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

# Make the auth backend importable.
_PKG = Path(__file__).resolve().parent.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

# Use an isolated, throwaway SQLite DB for tests.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-0123456789abcdef")
os.environ.setdefault("AUTH_SECRET", "test-auth-secret-0123456789abcdef")
os.environ.setdefault("DISCORD_GUILD_ID", "1534020917825503282")
os.environ.setdefault("DISCORD_PLAYER_ROLE_ID", "1534021254691033128")
os.environ.setdefault("DISCORD_VERIFIED_ROLE_ID", "1534021354767253654")
os.environ.setdefault("DISCORD_BANNED_ROLE_ID", "1534022085146443918")
os.environ.setdefault("DISCORD_OWNER_ROLE_ID", "1534021734984843364")
os.environ.setdefault("DISCORD_ADMIN_ROLE_ID", "1534021562561466440")
os.environ.setdefault("DISCORD_MODERATOR_ROLE_ID", "1534021495511056485")
os.environ.setdefault("DISCORD_STAFF_ROLE_ID", "1534021351256494080")
os.environ.setdefault("GAME_OWNER_DISCORD_USER_ID", "1513224601751130132")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

import config as config_module
from database import Base, engine as _real_engine, SessionLocal
from models import (  # noqa: F401
    AccountRole, AuditLog, Ban, DiscordAccount, DiscordMembershipCache, GameProfile,
    LoginHistory, ModerationNote, OAuthState, RenameHistory, RoleMapping,
    Session, Suspension, User, WebSocketTicket,
)


class FakeDiscordHTTP:
    """Configurable fake of discord_http.DiscordHTTP for tests."""

    def __init__(self, *, user=None, member=None, roles=None, raise_exchange=False,
                 raise_user=False):
        self.user = user or {"id": "1513224601751130132", "username": "officialsinland_dev",
                            "global_name": "officialsinland_dev", "avatar": None}
        self.member = member  # dict with 'roles' or None
        self.roles = roles
        self.raise_exchange = raise_exchange
        self.raise_user = raise_user
        self.calls = []
        self.assigned_roles = []
        self.removed_roles = []

    def exchange_code(self, code, code_verifier=None):
        self.calls.append(("exchange_code", code))
        if self.raise_exchange:
            raise RuntimeError("simulated token exchange failure")
        return {"access_token": "fake-access-token", "token_type": "Bearer"}

    def get_user(self, access_token):
        self.calls.append(("get_user", access_token))
        if self.raise_user:
            raise RuntimeError("simulated user fetch failure")
        return self.user

    def get_guild_member(self, access_token, guild_id=None):
        self.calls.append(("get_guild_member", guild_id))
        return self.member

    def get_bot_guild_member(self, bot_token, user_id, guild_id=None):
        return self.member

    def _request(self, method, url, **kwargs):
        # Capture role assignments/removals used by discord_service.
        if method == "PUT" and "/roles/" in url:
            self.assigned_roles.append(url)
        elif method == "DELETE" and "/roles/" in url:
            self.removed_roles.append(url)
        return {"id": "fake-channel"}


@pytest.fixture()
def fake_discord(monkeypatch):
    """Patch DiscordHTTP construction to return a controllable fake."""
    fake = FakeDiscordHTTP()

    def _factory(*a, **k):
        return fake

    # Patch every module that references DiscordHTTP at import time.
    targets = [
        "discord_http.DiscordHTTP",
        "services.discord_service.DiscordHTTP",
        "api.account_routes.DiscordHTTP",
        "api.admin_routes.DiscordHTTP",
        "discord_bot.commands.players.DiscordHTTP",
        "discord_bot.commands.moderation.DiscordHTTP",
        "discord_bot.events.members.DiscordHTTP",
    ]
    for t in targets:
        module_name, attr = t.rsplit(".", 1)
        import importlib
        try:
            mod = importlib.import_module(module_name)
        except Exception:
            continue
        if hasattr(mod, attr):
            monkeypatch.setattr(t, _factory)
    return fake


@pytest.fixture()
def client(fake_discord):
    """A TestClient with a fresh in-memory DB and tables created."""
    import database as db_module
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    db_module.engine = engine
    db_module.SessionLocal.configure(bind=engine)
    Base.metadata.create_all(bind=engine)

    import main as main_module
    app = main_module.app
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    import database as db_module
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    db_module.engine = engine
    db_module.SessionLocal.configure(bind=engine)
    Base.metadata.create_all(bind=engine)
    s = db_module.SessionLocal()
    try:
        yield s
    finally:
        s.close()
        Base.metadata.drop_all(bind=engine)
