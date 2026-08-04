"""Subway-Thots-Hotel Discord bot.

The bot:
- assigns the verified role after successful account creation,
- removes it on permanent account deletion,
- detects bans / staff roles,
- syncs Discord roles into game permissions,
- handles join/leave/role/member events to keep membership + permission caches fresh,
- exposes slash commands for player + server administration.

Commands delegate to the same backend services used by the REST admin API, so the
bot and the API never diverge. All administrative responses are ephemeral so
sensitive data is only visible to authorized staff.
"""
from __future__ import annotations

import asyncio
import sys

# Ensure this package's parent (server-python) is importable.
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

import discord
from discord.ext import commands

from config import (
    DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    GAME_OWNER_DISCORD_USER_ID,
)
from database import SessionLocal
from services import audit
from discord_bot.commands.players import PlayerCommands
from discord_bot.commands.moderation import ModerationCommands
from discord_bot.commands.server import ServerCommands
from discord_bot.events.members import MemberEvents

# Required intents: members (join/leave/role changes) + guilds + message content
# is NOT required for slash commands. Presence not needed.
intents = discord.Intents.default()
intents.members = True
intents.guilds = True


class STHBot(commands.Bot):
    def __init__(self) -> None:
        super().__init__(
            command_prefix="!",
            intents=intents,
            application_id=int(DISCORD_APPLICATION_ID) if DISCORD_APPLICATION_ID.isdigit() else None,
        )

    async def setup_hook(self) -> None:
        # Load command + event cogs.
        await self.add_cog(PlayerCommands(self))
        await self.add_cog(ModerationCommands(self))
        await self.add_cog(ServerCommands(self))
        await self.add_cog(MemberEvents(self))
        try:
            synced = await self.tree.sync(guild=discord.Object(id=int(DISCORD_GUILD_ID)) if DISCORD_GUILD_ID.isdigit() else None)
            print(f"[bot] Synced {len(synced)} slash commands.")
        except Exception as exc:
            print(f"[bot] Command sync warning: {exc}")

    async def on_ready(self) -> None:
        print(f"[bot] Logged in as {self.user} (guild={DISCORD_GUILD_ID})")
        audit(SessionLocal(), "bot_ready", metadata={"bot": str(self.user)})
        # Begin watching the VPS multiplayer world host for online/offline changes.
        try:
            from services.host_status_service import HostWatcher
            if getattr(self, "_host_watcher", None) is None:
                self._host_watcher = HostWatcher(
                    on_change=self._announce_host_change)
                self._host_watcher.start()
        except Exception as exc:
            print(f"[bot] host watcher warning: {exc}")

    async def _announce_host_change(self, previous, current) -> None:
        from services.discord_service import send_announcement
        if current.online:
            msg = "🌐 **Subway-Thots-Hotel multiplayer server is now ONLINE.**"
        else:
            reason = current.error or "no response"
            msg = f"⚠️ **Subway-Thots-Hotel multiplayer server is OFFLINE** (reason: {reason})."
        try:
            send_announcement(DiscordHTTP(), msg)
        except Exception:
            pass

    async def on_guild_unavailable(self, guild: discord.Guild) -> None:
        audit(SessionLocal(), "bot_guild_unavailable", metadata={"guild_id": str(guild.id)})

    async def on_disconnect(self) -> None:
        audit(SessionLocal(), "bot_disconnected")

    async def on_resumed(self) -> None:
        audit(SessionLocal(), "bot_resumed")


def main() -> None:
    if not DISCORD_BOT_TOKEN:
        print("DISCORD_BOT_TOKEN is not set. Bot cannot start.")
        raise SystemExit(1)
    bot = STHBot()
    bot.run(DISCORD_BOT_TOKEN, log_handler=None)


if __name__ == "__main__":
    main()
