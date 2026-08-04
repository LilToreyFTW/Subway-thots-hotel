"""Player slash commands + shared helpers.

Commands: /player lookup|verify|unlink|rename|suspend|unsuspend|ban|unban|kick|
rolesync|sessions|force-logout|notes. All responses are ephemeral.
"""
from __future__ import annotations

import time

import discord
from discord import app_commands
from discord.ext import commands

from config import GAME_OWNER_DISCORD_USER_ID, ROLE_TO_PERMISSION
from database import SessionLocal
from models import AccountRole, Ban, DiscordAccount, GameProfile, Session, Suspension, User
from services import audit
from services.account_service import rename_player
from services.moderation_service import (
    add_note, ban_user, force_logout, kick_user, suspend_user, unban_user,
    unsuspend_user,
)
from services.discord_service import DiscordHTTP


# ---------------- shared helpers ----------------
def resolve_user(db, identifier: str) -> User | None:
    ident = identifier.strip().lstrip("<@!").rstrip(">")
    profile = db.query(GameProfile).filter(
        (GameProfile.full_game_tag == ident) |
        (GameProfile.display_name == ident) |
        (GameProfile.normalized_display_name == ident.lower())
    ).first()
    if profile:
        return profile.user
    da = db.query(DiscordAccount).filter(DiscordAccount.discord_user_id == ident).first()
    if da:
        return da.user
    return db.get(User, ident)


def actor_permission(interaction: "discord.Interaction") -> str:
    from config import resolve_permission_from_roles
    role_ids = [str(r.id) for r in interaction.user.roles]
    perm = resolve_permission_from_roles(role_ids)
    if interaction.user.id and str(interaction.user.id) == GAME_OWNER_DISCORD_USER_ID:
        perm = "owner"
    return perm


def is_authorized(interaction: "discord.Interaction", *, staff: bool = True, admin: bool = False) -> bool:
    perm = actor_permission(interaction)
    if admin:
        return perm in ("owner", "admin")
    if staff:
        return perm in ("owner", "admin", "moderator", "staff")
    return perm != "guest"


def embed_for_user(user: User, db) -> discord.Embed:
    profile = user.profile
    discord = user.discord
    ban = db.query(Ban).filter_by(user_id=user.id, active=True).first()
    susp = db.query(Suspension).filter_by(user_id=user.id, active=True).first()
    role_ids = [r.discord_role_id for r in db.query(AccountRole).filter_by(user_id=user.id).all()]
    online = db.query(Session).filter_by(user_id=user.id, revoked=False).count()

    e = discord.Embed(title="Subway-Thots-Hotel — Player Lookup", color=0xE7B764)
    e.add_field(name="Game Tag", value=profile.full_game_tag if profile else "(no name)", inline=True)
    e.add_field(name="Account ID", value=str(user.id), inline=True)
    e.add_field(name="Status", value=user.account_status, inline=True)
    if discord:
        e.add_field(name="Discord", value=f"@{discord.discord_username}", inline=True)
        e.add_field(name="Discord ID", value=discord.discord_user_id, inline=True)
        e.add_field(name="Guild Member", value=str(discord.guild_member), inline=True)
    e.add_field(name="Roles", value=", ".join(role_ids) if role_ids else "player", inline=False)
    e.add_field(name="Created", value=str(user.created_at), inline=True)
    e.add_field(name="Last Login", value=str(user.last_login_at), inline=True)
    e.add_field(name="Online Sessions", value=str(online), inline=True)
    e.add_field(name="Ban", value=f"active={bool(ban)}" + (f" ({ban.reason})" if ban else ""), inline=True)
    e.add_field(name="Suspension", value=f"active={bool(susp)}" + (f" ({susp.reason})" if susp else ""), inline=True)
    return e


# ---------------- player cog ----------------
class PlayerCommands(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="player", description="Player administration")
    @app_commands.describe(action="Sub-action", target="Player mention / Discord id / account id / name / tag")
    @app_commands.choices(action=[
        app_commands.Choice(name="lookup", value="lookup"),
        app_commands.Choice(name="verify", value="verify"),
        app_commands.Choice(name="unlink", value="unlink"),
        app_commands.Choice(name="rename", value="rename"),
        app_commands.Choice(name="suspend", value="suspend"),
        app_commands.Choice(name="unsuspend", value="unsuspend"),
        app_commands.Choice(name="ban", value="ban"),
        app_commands.Choice(name="unban", value="unban"),
        app_commands.Choice(name="kick", value="kick"),
        app_commands.Choice(name="rolesync", value="rolesync"),
        app_commands.Choice(name="sessions", value="sessions"),
        app_commands.Choice(name="force-logout", value="force-logout"),
        app_commands.Choice(name="notes", value="notes"),
    ])
    async def player(self, interaction: discord.Interaction, action: str, target: str,
                     new_name: str | None = None, note: str | None = None,
                     reason: str | None = None, duration_hours: int | None = None):
        await interaction.response.defer(ephemeral=True)
        if not is_authorized(interaction, staff=True, admin=(action == "unlink")):
            await interaction.followup.send("You are not authorized to use this command.", ephemeral=True)
            return

        db = SessionLocal()
        try:
            user = resolve_user(db, target)
            if user is None:
                await interaction.followup.send("Player not found.", ephemeral=True)
                return
            actor = str(interaction.user.id)
            if user.discord and user.discord.discord_user_id == GAME_OWNER_DISCORD_USER_ID and action in ("ban", "unlink", "kick"):
                await interaction.followup.send("You cannot target the owner account.", ephemeral=True)
                return

            if action == "lookup":
                await interaction.followup.send(embed=embed_for_user(user, db), ephemeral=True)
            elif action == "verify":
                await interaction.followup.send(
                    f"Verified: tag={user.profile.full_game_tag if user.profile else 'n/a'}, "
                    f"member={user.discord.guild_member if user.discord else False}.", ephemeral=True)
            elif action == "unlink":
                user.account_status = "deleted"
                db.commit()
                force_logout(db, user, moderator_discord_id=actor, reason="unlinked")
                audit(db, "account_unlinked", user_account_id=user.id, acting_staff_discord_id=actor)
                await interaction.followup.send("Account unlinked (status=deleted).", ephemeral=True)
            elif action == "rename":
                if not new_name:
                    await interaction.followup.send("Provide new_name.", ephemeral=True)
                    return
                ok, code = rename_player(db, user, new_name, changed_by_discord_id=actor,
                                        reason=reason, notify=True)
                await interaction.followup.send(
                    f"Rename {'ok' if ok else 'failed: ' + code}." +
                    (f" New tag: {user.profile.full_game_tag}" if ok else ""), ephemeral=True)
            elif action == "suspend":
                expires = None if not duration_hours else time.time() + duration_hours * 3600
                suspend_user(db, user, reason=reason, moderator_discord_id=actor, expires_at=expires)
                await interaction.followup.send("Player suspended.", ephemeral=True)
            elif action == "unsuspend":
                unsuspend_user(db, user, moderator_discord_id=actor)
                await interaction.followup.send("Player unsuspended.", ephemeral=True)
            elif action == "ban":
                http = DiscordHTTP()
                expires = None if not duration_hours else time.time() + duration_hours * 3600
                ban_user(db, user, reason=reason, moderator_discord_id=actor, expires_at=expires,
                         apply_discord_role=True, http=http)
                await interaction.followup.send("Player banned.", ephemeral=True)
            elif action == "unban":
                http = DiscordHTTP()
                unban_user(db, user, moderator_discord_id=actor, http=http)
                await interaction.followup.send("Player unbanned.", ephemeral=True)
            elif action == "kick":
                count = kick_user(db, user, moderator_discord_id=actor, reason=reason)
                await interaction.followup.send(f"Kicked (sessions revoked: {count}).", ephemeral=True)
            elif action == "rolesync":
                http = DiscordHTTP()
                member = http.get_bot_guild_member(http.client_secret, user.discord.discord_user_id) if user.discord else None
                role_ids = [str(r) for r in (member or {}).get("roles", [])]
                db.query(AccountRole).filter_by(user_id=user.id).delete()
                for rid in role_ids:
                    db.add(AccountRole(user_id=user.id, discord_role_id=rid,
                                       game_permission=ROLE_TO_PERMISSION.get(rid, "player"), source="discord"))
                db.commit()
                audit(db, "role_sync", user_account_id=user.id, acting_staff_discord_id=actor,
                      metadata={"role_ids": role_ids})
                await interaction.followup.send(f"Roles synced: {', '.join(role_ids) or 'player'}.", ephemeral=True)
            elif action == "sessions":
                sessions = db.query(Session).filter_by(user_id=user.id, revoked=False).all()
                await interaction.followup.send(f"Active sessions: {len(sessions)}.", ephemeral=True)
            elif action == "force-logout":
                count = force_logout(db, user, moderator_discord_id=actor, reason="forced_logout")
                await interaction.followup.send(f"Force-logout: {count} session(s) revoked.", ephemeral=True)
            elif action == "notes":
                if not note:
                    await interaction.followup.send("Provide a note.", ephemeral=True)
                    return
                add_note(db, user, note, author_discord_id=actor)
                await interaction.followup.send("Note added.", ephemeral=True)
        finally:
            db.close()
