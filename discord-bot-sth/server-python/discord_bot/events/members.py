"""Discord guild event handlers.

Keeps the backend membership cache and account statuses in sync with Discord:
- member join  -> mark membership restored (if not banned)
- member remove -> revoke sessions, mark membership_missing
- member update (roles) -> refresh permission cache; immediate revoke on banned role
- username/global name change -> update stored identity (Discord id stays key)
- ban / unban -> reflect in game account status
"""
from __future__ import annotations

import discord
from discord.ext import commands

from config import (
    DISCORD_BANNED_ROLE_ID, DISCORD_GUILD_ID, GAME_OWNER_DISCORD_USER_ID,
    is_banned_role,
)
from database import SessionLocal
from models import AccountRole, DiscordAccount, User
from services import audit
from auth.membership import on_member_left, on_member_joined, _write_cache
from config import resolve_permission_from_roles


class MemberEvents(commands.Cog):
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member) -> None:
        if DISCORD_GUILD_ID and str(member.guild.id) != DISCORD_GUILD_ID:
            return
        db = SessionLocal()
        try:
            role_ids = [str(r.id) for r in member.roles]
            on_member_joined(db, str(member.id), role_ids=role_ids)
            audit(db, "discord_member_join", discord_user_id=str(member.id),
                  metadata={"roles": role_ids})
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member) -> None:
        if DISCORD_GUILD_ID and str(member.guild.id) != DISCORD_GUILD_ID:
            return
        db = SessionLocal()
        try:
            # Never auto-revoke the owner.
            if str(member.id) == GAME_OWNER_DISCORD_USER_ID:
                return
            on_member_left(db, str(member.id))
            audit(db, "discord_member_leave", discord_user_id=str(member.id))
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        if DISCORD_GUILD_ID and str(after.guild.id) != DISCORD_GUILD_ID:
            return
        db = SessionLocal()
        try:
            role_ids = [str(r.id) for r in after.roles]
            # Refresh cache.
            _write_cache(db, str(after.id), is_member=True, role_ids=role_ids,
                         permission=("banned" if is_banned_role(role_ids)
                                     else resolve_permission_from_roles(role_ids)))
            # Sync DiscordAccount identity (username/global name may change).
            discord = db.query(DiscordAccount).filter(
                DiscordAccount.discord_user_id == str(after.id)).first()
            if discord is not None:
                discord.discord_username = after.name
                discord.discord_global_name = after.global_name
                # avatar hash
                discord.discord_avatar_hash = after.avatar.key if after.avatar else None
                db.commit()

            # Banned role added -> immediate revoke.
            before_role_ids = {str(r.id) for r in before.roles}
            if DISCORD_BANNED_ROLE_ID and DISCORD_BANNED_ROLE_ID in role_ids and \
               DISCORD_BANNED_ROLE_ID not in before_role_ids:
                user = db.query(User).join(User.discord).filter(
                    DiscordAccount.discord_user_id == str(after.id)).first() if discord else None
                if user is not None:
                    from services.moderation_service import ban_user
                    from services.discord_service import DiscordHTTP
                    ban_user(db, user, reason="Discord banned role assigned",
                             moderator_discord_id="discord", apply_discord_role=False,
                             http=DiscordHTTP())
                    audit(db, "discord_banned_role", user_account_id=user.id,
                          discord_user_id=str(after.id))
            # Keep account_roles table in sync.
            if discord is not None:
                db.query(AccountRole).filter_by(user_id=discord.user_id).delete()
                for rid in role_ids:
                    db.add(AccountRole(user_id=discord.user_id, discord_role_id=rid,
                                       game_permission=("banned" if rid == DISCORD_BANNED_ROLE_ID
                                                        else resolve_permission_from_roles([rid])),
                                       source="discord"))
                db.commit()
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_user_update(self, before: discord.User, after: discord.User) -> None:
        # Username or global name change (not necessarily in our guild).
        db = SessionLocal()
        try:
            discord = db.query(DiscordAccount).filter(
                DiscordAccount.discord_user_id == str(after.id)).first()
            if discord is not None:
                discord.discord_username = after.name
                discord.discord_global_name = after.global_name
                db.commit()
                audit(db, "discord_username_change", discord_user_id=str(after.id),
                      metadata={"username": after.name})
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User) -> None:
        if DISCORD_GUILD_ID and str(guild.id) != DISCORD_GUILD_ID:
            return
        db = SessionLocal()
        try:
            discord = db.query(DiscordAccount).filter(
                DiscordAccount.discord_user_id == str(user.id)).first()
            if discord is not None:
                from services.moderation_service import ban_user
                from services.discord_service import DiscordHTTP
                ban_user(db, discord.user, reason="Banned from Discord guild",
                         moderator_discord_id="discord", apply_discord_role=False,
                         http=DiscordHTTP())
                audit(db, "discord_ban", discord_user_id=str(user.id))
        finally:
            db.close()

    @commands.Cog.listener()
    async def on_member_unban(self, guild: discord.Guild, user: discord.User) -> None:
        if DISCORD_GUILD_ID and str(guild.id) != DISCORD_GUILD_ID:
            return
        db = SessionLocal()
        try:
            discord = db.query(DiscordAccount).filter(
                DiscordAccount.discord_user_id == str(user.id)).first()
            if discord is not None:
                from services.moderation_service import unban_user
                from services.discord_service import DiscordHTTP
                unban_user(db, discord.user, http=DiscordHTTP())
                audit(db, "discord_unban", discord_user_id=str(user.id))
        finally:
            db.close()
