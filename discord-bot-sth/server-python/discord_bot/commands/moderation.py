"""Moderation slash commands: /moderation ban|unban|suspend|unsuspend|kick|
force-logout. These mirror the /player sub-actions but provide a dedicated
moderation namespace. All responses ephemeral."""
from __future__ import annotations

import time

import discord
from discord import app_commands
from discord.ext import commands

from config import GAME_OWNER_DISCORD_USER_ID
from database import SessionLocal
from models import User
from services import audit
from services.moderation_service import (
    ban_user, force_logout, kick_user, suspend_user, unban_user, unsuspend_user,
)
from services.discord_service import DiscordHTTP
from .players import resolve_user, is_authorized


class ModerationCommands(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="moderation", description="Server moderation actions")
    @app_commands.describe(action="Action", target="Player mention / Discord id / account id / name / tag")
    @app_commands.choices(action=[
        app_commands.Choice(name="ban", value="ban"),
        app_commands.Choice(name="unban", value="unban"),
        app_commands.Choice(name="suspend", value="suspend"),
        app_commands.Choice(name="unsuspend", value="unsuspend"),
        app_commands.Choice(name="kick", value="kick"),
        app_commands.Choice(name="force-logout", value="force-logout"),
    ])
    async def moderation(self, interaction: discord.Interaction, action: str, target: str,
                         reason: str | None = None, duration_hours: int | None = None):
        await interaction.response.defer(ephemeral=True)
        if not is_authorized(interaction, staff=True):
            await interaction.followup.send("Not authorized.", ephemeral=True)
            return
        db = SessionLocal()
        try:
            user = resolve_user(db, target)
            if user is None:
                await interaction.followup.send("Player not found.", ephemeral=True)
                return
            actor = str(interaction.user.id)
            if user.discord and user.discord.discord_user_id == GAME_OWNER_DISCORD_USER_ID and action in ("ban", "kick"):
                await interaction.followup.send("Cannot target the owner.", ephemeral=True)
                return
            if action == "ban":
                http = DiscordHTTP()
                expires = None if not duration_hours else time.time() + duration_hours * 3600
                ban_user(db, user, reason=reason, moderator_discord_id=actor, expires_at=expires,
                         apply_discord_role=True, http=http)
                await interaction.followup.send("Banned.", ephemeral=True)
            elif action == "unban":
                http = DiscordHTTP()
                unban_user(db, user, moderator_discord_id=actor, http=http)
                await interaction.followup.send("Unbanned.", ephemeral=True)
            elif action == "suspend":
                expires = None if not duration_hours else time.time() + duration_hours * 3600
                suspend_user(db, user, reason=reason, moderator_discord_id=actor, expires_at=expires)
                await interaction.followup.send("Suspended.", ephemeral=True)
            elif action == "unsuspend":
                unsuspend_user(db, user, moderator_discord_id=actor)
                await interaction.followup.send("Unsuspended.", ephemeral=True)
            elif action == "kick":
                count = kick_user(db, user, moderator_discord_id=actor, reason=reason)
                await interaction.followup.send(f"Kicked ({count} sessions revoked).", ephemeral=True)
            elif action == "force-logout":
                count = force_logout(db, user, moderator_discord_id=actor, reason="forced_logout")
                await interaction.followup.send(f"Force-logout ({count}).", ephemeral=True)
        finally:
            db.close()
