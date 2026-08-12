"""Server-side anti-cheat primitives for the authoritative world host.

The browser is never trusted with position, economy, inventory, health, or
privilege state.  Debug access is an expiring HMAC token minted outside the
game server and bound to one player id.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

LOG = logging.getLogger("sth.anti_cheat")
DEBUG_SCOPE = "sth:debug"
FORBIDDEN_MESSAGES = {
    "money", "cash", "give_money", "give_weapon", "weapon_give",
    "inventory", "health", "damage", "god_mode", "noclip", "teleport",
    "set_position", "admin", "execute", "eval",
}


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def create_debug_token(player_id: str, expires_at: int, secret: str) -> str:
    """Create a token for an operator tool, not for the game client."""
    payload = _b64(json.dumps({"playerId": player_id, "exp": expires_at, "scope": DEBUG_SCOPE}, separators=(",", ":")).encode())
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64(signature)}"


def verify_debug_token(token: str, player_id: str, secret: str, now: int | None = None) -> bool:
    try:
        payload, signature = token.split(".", 1)
        expected = _b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return False
        decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return (decoded.get("playerId") == player_id and decoded.get("scope") == DEBUG_SCOPE
                and int(decoded.get("exp", 0)) > int(time.time() if now is None else now))
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError, binascii.Error):
        return False


@dataclass
class AntiCheatState:
    strikes: int = 0
    recent_input_at: list[float] = field(default_factory=list)
    debug_mode: bool = False


@dataclass(frozen=True)
class AntiCheatConfig:
    max_strikes: int = 3
    max_inputs_per_second: int = 40
    debug_secret: str = ""

    @classmethod
    def from_env(cls) -> "AntiCheatConfig":
        return cls(
            max_strikes=max(1, int(os.getenv("ANTI_CHEAT_MAX_STRIKES", "3"))),
            max_inputs_per_second=max(10, int(os.getenv("ANTI_CHEAT_INPUTS_PER_SECOND", "40"))),
            debug_secret=os.getenv("ANTI_CHEAT_DEBUG_SECRET", ""),
        )


class AntiCheat:
    def __init__(self, config: AntiCheatConfig | None = None):
        self.config = config or AntiCheatConfig.from_env()

    def debug_enabled(self, player_id: str, token: str) -> bool:
        return bool(self.config.debug_secret and verify_debug_token(token, player_id, self.config.debug_secret))

    def violation(self, player_id: str, state: AntiCheatState, code: str, details: dict[str, Any] | None = None) -> bool:
        state.strikes += 1
        LOG.warning("anti_cheat_violation player=%s code=%s strikes=%d details=%s", player_id, code, state.strikes, details or {})
        return state.strikes >= self.config.max_strikes

    def input_allowed(self, player_id: str, state: AntiCheatState, now: float) -> bool:
        state.recent_input_at[:] = [stamp for stamp in state.recent_input_at if now - stamp < 1.0]
        state.recent_input_at.append(now)
        if len(state.recent_input_at) <= self.config.max_inputs_per_second:
            return True
        self.violation(player_id, state, "INPUT_RATE_LIMIT", {"count": len(state.recent_input_at)})
        return False

    def forbidden_message(self, message_type: str) -> bool:
        return message_type in FORBIDDEN_MESSAGES
