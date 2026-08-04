"""Server slash commands: /server status|online|announce|maintenance|
registrations|audit. Staff-only, ephemeral where appropriate."""
from __future__ import annotations

import discord
import time
from discord import app_commands
from discord.ext import commands
from sqlalchemy import func

from config import DISCORD_ANNOUNCEMENT_CHANNEL_ID
from database import SessionLocal
from models import AuditLog, Session, User
from services import audit
from services.discord_service import DiscordHTTP, send_announcement
from .players import is_authorized


class ServerCommands(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="server", description="Server administration")
    @app_commands.describe(action="Action")
    @app_commands.choices(action=[
        app_commands.Choice(name="status", value="status"),
        app_commands.Choice(name="online", value="online"),
        app_commands.Choice(name="announce", value="announce"),
        app_commands.Choice(name="maintenance", value="maintenance"),
        app_commands.Choice(name="registrations", value="registrations"),
        app_commands.Choice(name="audit", value="audit"),
        app_commands.Choice(name="host", value="host"),
    ])
    async def server(self, interaction: discord.Interaction, action: str,
                    message: str | None = None, enabled: bool = False):
        await interaction.response.defer(ephemeral=(action != "announce"))
        if not is_authorized(interaction, staff=True, admin=(action == "maintenance")):
            await interaction.followup.send("Not authorized.", ephemeral=True)
            return
        db = SessionLocal()
        try:
            if action == "status":
                total = db.query(func.count(User.id)).scalar() or 0
                online = db.query(Session).filter_by(revoked=False).count()
                await interaction.followup.send(
                    f"Accounts: {total}\nActive sessions: {online}\nService: online", ephemeral=True)
            elif action == "online":
                sessions = db.query(Session).filter_by(revoked=False).all()
                tags = []
                for s in sessions:
                    u = db.get(User, s.user_id)
                    if u and u.profile:
                        tags.append(u.profile.full_game_tag)
                body = "Online (" + str(len(tags)) + "):\n" + "\n".join(tags) if tags else "No players online."
                await interaction.followup.send(body[:1900], ephemeral=True)
            elif action == "announce":
                if not message:
                    await interaction.followup.send("Provide a message.", ephemeral=True)
                    return
                ok = send_announcement(DiscordHTTP(), message)
                audit(db, "announcement", acting_staff_discord_id=str(interaction.user.id),
                      metadata={"len": len(message), "discord": ok})
                await interaction.followup.send(
                    f"Announcement sent to game + Discord: {ok}.", ephemeral=True)
            elif action == "maintenance":
                audit(db, "maintenance", acting_staff_discord_id=str(interaction.user.id),
                      metadata={"enabled": enabled, "message": message})
                await interaction.followup.send(
                    f"Maintenance mode {'ENABLED' if enabled else 'DISABLED'}.", ephemeral=True)
            elif action == "registrations":
                total = db.query(func.count(User.id)).scalar() or 0
                await interaction.followup.send(f"Total registered accounts: {total}", ephemeral=True)
            elif action == "audit":
                rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(25).all()
                lines = [f"{r.timestamp:%Y-%m-%d %H:%M} · {r.event_type} · {r.user_account_id or '-'}"
                         for r in rows]
                await interaction.followup.send("Recent audit:\n" + "\n".join(lines)[:1900], ephemeral=True)
            elif action == "host":
                from services.host_status_service import check_world_health
                status = check_world_health()
                state = "ONLINE" if status.online else "OFFLINE"
                detail = ""
                if status.detail:
                    detail = f" · regions={status.detail.get('regions')} · tick={status.detail.get('tickRate')}"
                err = f" · {status.error}" if status.error else ""
                await interaction.followup.send(
                    f"VPS multiplayer server: **{state}** (checked {time.strftime('%H:%M:%S', time.gmtime(status.checked_at))} UTC){detail}{err}",
                    ephemeral=True)
        finally:
            db.close()
