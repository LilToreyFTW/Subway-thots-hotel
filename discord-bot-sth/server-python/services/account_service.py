"""Account creation + game-name (gamertag) allocation service.

Game-name rules (from spec):
- 3..16 chars, allowed chars: letters, numbers, underscore, period, hyphen.
- Unique case-insensitively. Stored as display_name + normalized_display_name
  + name_number + full_game_tag.
- Block reserved words (staff/owner/system) and a configurable blocked-word list.
- The 6-digit number is server-generated and uniqueness-checked before saving.
- One Discord id -> one account; one game tag -> one Discord id.
"""
from __future__ import annotations

import re
import secrets
import time
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from config import BLOCKED_WORDS, RESERVED_NAMES
from models import (
    AccountRole,
    DiscordAccount,
    GameProfile,
    RenameHistory,
    User,
)
from services import audit

NAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,16}$")

INVALID_NAME = "invalid_name"
RESERVED_NAME = "reserved_name"
BLOCKED_NAME = "blocked_name"
TOO_SHORT = "too_short"
TOO_LONG = "too_long"
DUPLICATE_NAME = "duplicate_name"
TAKEN_NUMBER = "taken_number"


def validate_game_name(name: str) -> tuple[bool, str]:
    """Return (ok, error_code). Does not check DB uniqueness."""
    if not name:
        return False, INVALID_NAME
    if len(name) < 3:
        return False, TOO_SHORT
    if len(name) > 16:
        return False, TOO_LONG
    if not NAME_RE.match(name):
        return False, INVALID_NAME
    lower = name.lower()
    if lower in RESERVED_NAMES:
        return False, RESERVED_NAME
    for word in BLOCKED_WORDS:
        if word and word in lower:
            return False, BLOCKED_NAME
    return True, "ok"


def _is_name_taken(db: DBSession, normalized: str) -> bool:
    return db.query(GameProfile).filter(
        GameProfile.normalized_display_name == normalized).first() is not None


def generate_name_number(db: DBSession) -> int:
    """Generate a unique 6-digit number, checking uniqueness in the DB."""
    for _ in range(100):
        number = secrets.randbelow(900000) + 100000
        exists = db.query(GameProfile).filter(GameProfile.name_number == number).first()
        if exists is None:
            return number
    # Extremely unlikely fallback.
    return secrets.randbelow(900000) + 100000


def check_player_name(db: DBSession, name: str) -> dict[str, Any]:
    ok, code = validate_game_name(name)
    if not ok:
        return {"available": False, "reason": code}
    if _is_name_taken(db, name.lower()):
        return {"available": False, "reason": DUPLICATE_NAME}
    return {"available": True, "reason": "ok"}


def create_account_for_discord(db: DBSession, discord_user: Any, *,
                               game_name: str,
                               assign_verified_role: bool = False,
                               http: Any = None) -> tuple[User | None, str, dict[str, Any]]:
    """Create a full account (User + DiscordAccount + GameProfile) for a verified
    Discord user. Returns (user, error_code, payload).

    `discord_user` is a discord_http.DiscordUser (with user_id, username,
    global_name, avatar_hash, role_ids)."""
    # Guard: one account per Discord id.
    existing = db.query(DiscordAccount).filter(
        DiscordAccount.discord_user_id == discord_user.user_id).first()
    if existing is not None:
        return None, "discord_already_linked", {}

    ok, code = validate_game_name(game_name)
    if not ok:
        return None, code, {}
    normalized = game_name.lower()
    if _is_name_taken(db, normalized):
        return None, DUPLICATE_NAME, {}

    number = generate_name_number(db)
    full_tag = f"{game_name}#{number}"

    user = User(account_status="active")
    db.add(user)
    db.flush()  # populate user.id

    discord = DiscordAccount(
        user_id=user.id,
        discord_user_id=discord_user.user_id,
        discord_username=discord_user.username,
        discord_global_name=discord_user.global_name,
        discord_avatar_hash=discord_user.avatar_hash,
        guild_member=discord_user.is_guild_member,
        last_verified_at=time.time(),
    )
    db.add(discord)

    profile = GameProfile(
        user_id=user.id,
        display_name=game_name,
        normalized_display_name=normalized,
        name_number=number,
        full_game_tag=full_tag,
    )
    db.add(profile)

    # Persist roles derived from Discord.
    for role_id in discord_user.role_ids:
        db.add(AccountRole(
            user_id=user.id,
            discord_role_id=role_id,
            game_permission=_role_to_permission(role_id),
            source="discord",
        ))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Race: duplicate name or discord id. Surface a safe error.
        if db.query(DiscordAccount).filter(
                DiscordAccount.discord_user_id == discord_user.user_id).first():
            return None, "discord_already_linked", {}
        return None, DUPLICATE_NAME, {}

    audit(db, "account_created", user_account_id=user.id,
          discord_user_id=discord_user.user_id,
          metadata={"game_tag": full_tag, "roles": discord_user.role_ids})

    if assign_verified_role and http is not None:
        from discord_bot_role_utils import assign_role_safe
        assign_role_safe(http, discord_user.user_id, "verified")

    return user, "ok", {"game_tag": full_tag, "name_number": number}


def rename_player(db: DBSession, user: User, new_name: str, *,
                  changed_by_discord_id: str | None = None,
                  reason: str | None = None, notify: bool = True) -> tuple[bool, str]:
    """Admin-initiated rename. Checks uniqueness, preserves history, logs staff."""
    ok, code = validate_game_name(new_name)
    if not ok:
        return False, code
    normalized = new_name.lower()
    if _is_name_taken(db, normalized):
        return False, DUPLICATE_NAME

    profile = user.profile
    if profile is None:
        return False, "no_profile"
    previous_tag = profile.full_game_tag
    previous_name = profile.display_name

    history = RenameHistory(
        user_id=user.id,
        previous_display_name=previous_name,
        previous_full_game_tag=previous_tag,
        new_display_name=new_name,
        new_full_game_tag=f"{new_name}#{profile.name_number}",
        changed_by_discord_id=changed_by_discord_id,
        reason=reason,
    )
    db.add(history)

    profile.display_name = new_name
    profile.normalized_display_name = normalized
    profile.full_game_tag = f"{new_name}#{profile.name_number}"
    profile.updated_at = time.time()
    db.commit()

    audit(db, "name_changed", user_account_id=user.id,
          discord_user_id=user.discord.discord_user_id if user.discord else None,
          acting_staff_discord_id=changed_by_discord_id,
          reason=reason, metadata={"from": previous_tag, "to": profile.full_game_tag})

    if notify and user.discord:
        try:
            from discord_bot_role_utils import notify_user_dm
            notify_user_dm(user.discord.discord_user_id,
                           f"Your in-game name was changed to {profile.full_game_tag} by staff.")
        except Exception:
            pass
    return True, "ok"


def _role_to_permission(role_id: str) -> str:
    from config import ROLE_TO_PERMISSION
    return ROLE_TO_PERMISSION.get(role_id, "player")
