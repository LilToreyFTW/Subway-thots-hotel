"""Discord-side helpers: role assignment/removal, registration announcement,
and DM notifications. These wrap the bot token and are only used from trusted
server-side contexts (bot process or backend with bot token). Failures are
swallowed and audited, never fatal to the game flow.
"""
from __future__ import annotations

from typing import Any

from config import (
    DISCORD_ANNOUNCEMENT_CHANNEL_ID,
    DISCORD_BANNED_ROLE_ID,
    DISCORD_MODERATION_CHANNEL_ID,
    DISCORD_REGISTRATION_CHANNEL_ID,
    DISCORD_VERIFIED_ROLE_ID,
)
from services import audit
from discord_http import DiscordHTTP


def assign_role_safe(http: DiscordHTTP, user_id: str, role_key: str,
                     guild_id: str | None = None, db: Any = None,
                     actor_discord_id: str | None = None) -> bool:
    """Add a role to a guild member. `role_key` is one of verified/banned/player.

    Returns success boolean. Always audited when db is provided.
    """
    from config import DISCORD_GUILD_ID
    guild_id = guild_id or DISCORD_GUILD_ID
    role_map = {
        "verified": DISCORD_VERIFIED_ROLE_ID,
        "banned": DISCORD_BANNED_ROLE_ID,
    }
    role_id = role_map.get(role_key)
    if not role_id:
        return False
    try:
        http._request("PUT", f"https://discord.com/api/v10/guilds/{guild_id}/members/{user_id}/roles/{role_id}",
                      token=http.client_secret and None)  # placeholder; real call below
    except Exception:
        pass
    # Real call (bot token required). We route via a dedicated method.
    try:
        _bot_put_role(http, guild_id, user_id, role_id)
        if db is not None:
            audit(db, "role_assigned", discord_user_id=user_id,
                  acting_staff_discord_id=actor_discord_id,
                  metadata={"role": role_key, "role_id": role_id})
        return True
    except Exception as exc:
        if db is not None:
            audit(db, "role_assignment_failed", discord_user_id=user_id,
                  metadata={"role": role_key, "error": str(exc)[:200]})
        return False


def remove_role_safe(http: DiscordHTTP, user_id: str, role_key: str,
                     guild_id: str | None = None, db: Any = None,
                     actor_discord_id: str | None = None) -> bool:
    from config import DISCORD_GUILD_ID
    guild_id = guild_id or DISCORD_GUILD_ID
    role_map = {
        "verified": DISCORD_VERIFIED_ROLE_ID,
        "banned": DISCORD_BANNED_ROLE_ID,
    }
    role_id = role_map.get(role_key)
    if not role_id:
        return False
    try:
        _bot_delete_role(http, guild_id, user_id, role_id)
        if db is not None:
            audit(db, "role_removed", discord_user_id=user_id,
                  acting_staff_discord_id=actor_discord_id,
                  metadata={"role": role_key, "role_id": role_id})
        return True
    except Exception as exc:
        if db is not None:
            audit(db, "role_removal_failed", discord_user_id=user_id,
                  metadata={"role": role_key, "error": str(exc)[:200]})
        return False


def _bot_put_role(http: DiscordHTTP, guild_id: str, user_id: str, role_id: str) -> None:
    """Add a role using the bot token. The bot must have Manage Roles permission
    and a higher role position than the target role."""
    http._request(
        "PUT",
        f"https://discord.com/api/v10/guilds/{guild_id}/members/{user_id}/roles/{role_id}",
        token=http.client_secret,  # bot token is passed via client_secret slot in stub; real bot sets Authorization
    )


def _bot_delete_role(http: DiscordHTTP, guild_id: str, user_id: str, role_id: str) -> None:
    http._request(
        "DELETE",
        f"https://discord.com/api/v10/guilds/{guild_id}/members/{user_id}/roles/{role_id}",
        token=http.client_secret,
    )


def notify_user_dm(user_id: str, message: str, http: DiscordHTTP | None = None) -> bool:
    http = http or DiscordHTTP()
    try:
        # Open DM channel then send.
        channel = http._request("POST", "https://discord.com/api/v10/users/@me/channels",
                                token=http.client_secret,
                                data={"recipient_id": user_id})
        if not channel or "id" not in channel:
            return False
        http._request("POST", f"https://discord.com/api/v10/channels/{channel['id']}/messages",
                      token=http.client_secret, data={"content": message[:2000]})
        return True
    except Exception:
        return False


def send_registration_embed(http: DiscordHTTP, *, game_tag: str, discord_username: str,
                            discord_id: str, account_id: str, member_verified: bool,
                            roles: list[str], created_at: str) -> bool:
    """Post a NEW PLAYER embed to the registration channel. No secrets/IPs/session
    ids are included (per spec)."""
    if not DISCORD_REGISTRATION_CHANNEL_ID:
        return False
    embed = {
        "title": "NEW SUBWAY-THOTS-HOTEL PLAYER",
        "color": 0xE7B764,
        "fields": [
            {"name": "Game Tag", "value": game_tag, "inline": True},
            {"name": "Discord", "value": f"@{discord_username}", "inline": True},
            {"name": "Discord ID", "value": discord_id, "inline": True},
            {"name": "Account ID", "value": account_id, "inline": True},
            {"name": "Member Verified", "value": "Yes" if member_verified else "No", "inline": True},
            {"name": "Roles", "value": ", ".join(roles) if roles else "player", "inline": False},
            {"name": "Created", "value": created_at, "inline": True},
        ],
    }
    try:
        http._request(
            "POST",
            f"https://discord.com/api/v10/channels/{DISCORD_REGISTRATION_CHANNEL_ID}/messages",
            token=http.client_secret, data={"embeds": [embed]},
        )
        return True
    except Exception:
        return False


def send_announcement(http: DiscordHTTP, message: str, *, to_channel: bool = True) -> bool:
    """Broadcast an announcement to the Discord announcement channel."""
    if not (to_channel and DISCORD_ANNOUNCEMENT_CHANNEL_ID):
        return False
    try:
        http._request(
            "POST",
            f"https://discord.com/api/v10/channels/{DISCORD_ANNOUNCEMENT_CHANNEL_ID}/messages",
            token=http.client_secret, data={"content": message[:2000]},
        )
        return True
    except Exception:
        return False


def send_moderation_log(http: DiscordHTTP, message: str) -> bool:
    if not DISCORD_MODERATION_CHANNEL_ID:
        return False
    try:
        http._request(
            "POST",
            f"https://discord.com/api/v10/channels/{DISCORD_MODERATION_CHANNEL_ID}/messages",
            token=http.client_secret, data={"content": message[:2000]},
        )
        return True
    except Exception:
        return False
