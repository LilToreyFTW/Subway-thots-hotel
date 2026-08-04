"""Discord HTTP client wrapper.

Handles OAuth2 token exchange, user identification, guild membership and roles.
All network access goes through `DiscordHTTP`, which is fully mockable: tests
inject a stub with the same method signatures so no live Discord request is
needed. No token is ever logged.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

from config import (
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    DISCORD_GUILD_ID,
    DISCORD_REDIRECT_URI,
)

API_BASE = "https://discord.com/api/v10"


class DiscordAPIError(Exception):
    def __init__(self, message: str, status: int | None = None, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


@dataclass
class DiscordUser:
    user_id: str
    username: str | None
    global_name: str | None
    avatar_hash: str | None
    # Members + roles are populated when guild checks succeed.
    is_guild_member: bool = False
    role_ids: list[str] = field(default_factory=list)


def avatar_url(user_id: str, avatar_hash: str | None) -> str | None:
    """Reconstruct a public CDN avatar URL from the stored hash. No token needed."""
    if not avatar_hash:
        # Default avatar (5 possible, based on user id modulo).
        index = (int(user_id) >> 22) % 6 if user_id.isdigit() else 0
        return f"https://cdn.discordapp.com/embed/avatars/{index}.png"
    ext = "gif" if avatar_hash.startswith("a_") else "png"
    return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.{ext}"


class DiscordHTTP:
    """Real implementation using urllib. Swap with a stub in tests."""

    def __init__(self, client_id: str | None = None, client_secret: str | None = None,
                 redirect_uri: str | None = None) -> None:
        self.client_id = client_id or DISCORD_CLIENT_ID
        self.client_secret = client_secret or DISCORD_CLIENT_SECRET
        self.redirect_uri = redirect_uri or DISCORD_REDIRECT_URI

    # --- low-level ---
    def _request(self, method: str, url: str, *, token: str | None = None,
                 data: dict | None = None, headers: dict | None = None) -> Any:
        req_headers: dict[str, str] = {"Accept": "application/json"}
        if token:
            req_headers["Authorization"] = f"Bearer {token}"
        if data is not None:
            req_headers["Content-Type"] = "application/x-www-form-urlencoded"
            body = urllib.parse.urlencode(data).encode("utf-8")
        else:
            body = None
        req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                raw = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "ignore")
            raise DiscordAPIError(f"Discord HTTP {exc.code}: {detail}", status=exc.code) from exc
        except urllib.error.URLError as exc:
            raise DiscordAPIError(f"Discord network error: {exc.reason}") from exc
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise DiscordAPIError("Invalid JSON from Discord") from exc

    # --- OAuth2 ---
    def exchange_code(self, code: str, code_verifier: str | None = None) -> dict[str, Any]:
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
        }
        if code_verifier:
            data["code_verifier"] = code_verifier
        return self._request("POST", f"{API_BASE}/oauth2/token", data=data)

    def revoke_token(self, token: str) -> None:
        try:
            self._request("POST", f"{API_BASE}/oauth2/token/revoke",
                          data={"client_id": self.client_id,
                                "client_secret": self.client_secret,
                                "token": token})
        except DiscordAPIError:
            # Revocation is best-effort; ignore failures.
            pass

    def get_user(self, access_token: str) -> DiscordUser:
        payload = self._request("GET", f"{API_BASE}/users/@me", token=access_token)
        return DiscordUser(
            user_id=str(payload["id"]),
            username=payload.get("username"),
            global_name=payload.get("global_name"),
            avatar_hash=payload.get("avatar"),
        )

    def get_guild_member(self, access_token: str, guild_id: str = DISCORD_GUILD_ID) -> dict | None:
        """Use the OAuth identity endpoint to check guild membership. Requires the
        `guilds.members.read` scope. Returns the member object, or None if not a
        member. Falls back to bot-side lookup when the bot client is supplied."""
        try:
            return self._request("GET", f"{API_BASE}/users/@me/guilds/{guild_id}/member",
                                 token=access_token)
        except DiscordAPIError as exc:
            if exc.status in (403, 404):
                return None
            raise

    def get_bot_guild_member(self, bot_token: str, user_id: str,
                             guild_id: str = DISCORD_GUILD_ID) -> dict | None:
        """Bot-side member lookup (used for periodic checks / events)."""
        try:
            return self._request("GET", f"{API_BASE}/guilds/{guild_id}/members/{user_id}",
                                 token=bot_token)
        except DiscordAPIError as exc:
            if exc.status == 404:
                return None
            raise


def build_oauth_url(state: str, csrf: str, *, prompt: str = "consent",
                    scopes: list[str] | None = None, code_challenge: str | None = None) -> str:
    """Build the Discord OAuth2 authorization URL.

    Required scopes for this game:
      identify            -> verify the user
      guilds.members.read -> confirm server membership
    """
    scopes = scopes or ["identify", "guilds.members.read"]
    params = {
        "client_id": DISCORD_CLIENT_ID,
        "redirect_uri": DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(scopes),
        "state": state,
        "prompt": prompt,
    }
    if code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = "S256"
    return f"{API_BASE}/oauth2/authorize?" + urllib.parse.urlencode(params)


def parse_member_roles(member: dict | None) -> list[str]:
    if not member:
        return []
    return [str(r) for r in member.get("roles", [])]
