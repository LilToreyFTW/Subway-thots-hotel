"""Central configuration for the Subway-Thots-Hotel auth + Discord bot system.

All secrets come from environment variables. Never hardcode real tokens.
A .env file is loaded when present (see .env.example for the full list).
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load .env (and .env.local) from the auth package directory if present.
_PKG_DIR = Path(__file__).resolve().parent
for _env_name in (".env.local", ".env"):
    _env_path = _PKG_DIR / _env_name
    if _env_path.exists():
        load_dotenv(_env_path)

# Discord OAuth2 / bot application
DISCORD_APPLICATION_ID = os.getenv("DISCORD_APPLICATION_ID", "")
# DISCORD_CLIENT_ID defaults to the application id when not set explicitly.
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", DISCORD_APPLICATION_ID)
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_REDIRECT_URI = os.getenv("DISCORD_REDIRECT_URI", "http://147.189.172.104/7076/auth/discord/callback")
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID", "")
DISCORD_INVITE_URL = os.getenv("DISCORD_INVITE_URL", "https://discord.gg/6BHMKxzCbF")

# Discord role ids
DISCORD_PLAYER_ROLE_ID = os.getenv("DISCORD_PLAYER_ROLE_ID", "")
DISCORD_VERIFIED_ROLE_ID = os.getenv("DISCORD_VERIFIED_ROLE_ID", "")
DISCORD_STAFF_ROLE_ID = os.getenv("DISCORD_STAFF_ROLE_ID", "")
DISCORD_MODERATOR_ROLE_ID = os.getenv("DISCORD_MODERATOR_ROLE_ID", "")
DISCORD_ADMIN_ROLE_ID = os.getenv("DISCORD_ADMIN_ROLE_ID", "")
DISCORD_OWNER_ROLE_ID = os.getenv("DISCORD_OWNER_ROLE_ID", "")
DISCORD_BANNED_ROLE_ID = os.getenv("DISCORD_BANNED_ROLE_ID", "")

# Discord channel ids
DISCORD_AUDIT_CHANNEL_ID = os.getenv("DISCORD_AUDIT_CHANNEL_ID", "")
DISCORD_REGISTRATION_CHANNEL_ID = os.getenv("DISCORD_REGISTRATION_CHANNEL_ID", "")
DISCORD_MODERATION_CHANNEL_ID = os.getenv("DISCORD_MODERATION_CHANNEL_ID", "")
DISCORD_ANNOUNCEMENT_CHANNEL_ID = os.getenv("DISCORD_ANNOUNCEMENT_CHANNEL_ID", "")

# Owner account (Discord id). Centralized so owner permission is auditable.
GAME_OWNER_DISCORD_USER_ID = os.getenv("GAME_OWNER_DISCORD_USER_ID", "")

# Application URLs
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:7076")
# Where the world host actually listens. The auth server and the world host
# share one process in this build, so this is the same host/port.
WORLD_BIND_HOST = os.getenv("WORLD_BIND_HOST", "0.0.0.0")
WORLD_BIND_PORT = int(os.getenv("WORLD_BIND_PORT", "7076"))

# Secrets
SESSION_SECRET = os.getenv("SESSION_SECRET", "")
# Generate a session secret at runtime if one was not provided (dev only).
if not SESSION_SECRET:
    SESSION_SECRET = os.urandom(32).hex()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./subway_thots_hotel.db")

# Security knobs
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "86400"))  # 24h
WEBSOCKET_TICKET_TTL_SECONDS = int(os.getenv("WS_TICKET_TTL_SECONDS", "120"))  # 2m
OAUTH_STATE_TTL_SECONDS = int(os.getenv("OAUTH_STATE_TTL_SECONDS", "600"))  # 10m
MEMBERSHIP_CACHE_TTL_SECONDS = int(os.getenv("MEMBERSHIP_CACHE_TTL_SECONDS", "600"))  # 10m
CSRF_TOKEN_TTL_SECONDS = int(os.getenv("CSRF_TOKEN_TTL_SECONDS", "1800"))  # 30m
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

# Multiplayer socket HMAC secret (shared with the existing voice/WS system).
AUTH_SECRET = os.getenv("AUTH_SECRET", "")
if not AUTH_SECRET:
    AUTH_SECRET = SESSION_SECRET

# Where the VPS-hosted multiplayer world server listens (health endpoint).
# Used by the bot to detect when the VPS is hosting the game. Default is the
# project VPS IP on the world port; override for local/dev.
WORLD_HOST_URL = os.getenv("WORLD_HOST_URL", "https://cyan-squirrel-97200.zap.cloud")

# Comma-separated list of Staff/owner reserved words that players may not claim.
RESERVED_NAMES = [w.strip().lower() for w in os.getenv(
    "RESERVED_NAMES",
    "admin,administrator,owner,mod,moderator,staff,dev,developer,official,sth,subwaythotshotel,subway,thots,bot,system,support,help",
).split(",") if w.strip()]

# Comma-separated blocked words for offensive-name screening.
BLOCKED_WORDS = [w.strip().lower() for w in os.getenv(
    "BLOCKED_WORDS",
    "nigger,nigga,faggot,retard,slur,rape,kkk",
).split(",") if w.strip()]

# Permission groups -> Discord role mapping
ROLE_TO_PERMISSION = {
    DISCORD_OWNER_ROLE_ID: "owner",
    DISCORD_ADMIN_ROLE_ID: "admin",
    DISCORD_MODERATOR_ROLE_ID: "moderator",
    DISCORD_STAFF_ROLE_ID: "staff",
    DISCORD_PLAYER_ROLE_ID: "player",
    DISCORD_VERIFIED_ROLE_ID: "player",
}
# Roles that grant administrative capabilities in game/Discord commands.
ADMIN_PERMISSIONS = {"owner", "admin"}
STAFF_PERMISSIONS = {"owner", "admin", "moderator", "staff"}


def resolve_permission_from_roles(role_ids: list[str]) -> str:
    """Map a set of Discord role ids to the highest game permission.

    Order matters: owner > admin > moderator > staff > player.
    """
    role_ids = list(role_ids or [])
    if not role_ids:
        return "player"
    if DISCORD_OWNER_ROLE_ID and DISCORD_OWNER_ROLE_ID in role_ids:
        return "owner"
    if DISCORD_ADMIN_ROLE_ID and DISCORD_ADMIN_ROLE_ID in role_ids:
        return "admin"
    if DISCORD_MODERATOR_ROLE_ID and DISCORD_MODERATOR_ROLE_ID in role_ids:
        return "moderator"
    if DISCORD_STAFF_ROLE_ID and DISCORD_STAFF_ROLE_ID in role_ids:
        return "staff"
    if (DISCORD_PLAYER_ROLE_ID and DISCORD_PLAYER_ROLE_ID in role_ids) or \
       (DISCORD_VERIFIED_ROLE_ID and DISCORD_VERIFIED_ROLE_ID in role_ids):
        return "player"
    return "guest"


def is_banned_role(role_ids: list[str]) -> bool:
    return bool(DISCORD_BANNED_ROLE_ID) and DISCORD_BANNED_ROLE_ID in role_ids
