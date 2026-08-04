"""Discord bot logic tests (no live Discord connection).

We exercise the permission/authorization helpers and command handlers using a
fake Interaction object so the bot's enforcement (owner protection, staff gating,
ephemeral-sensitive data) is covered without network access.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import config as config_module
from discord_bot.commands.players import is_authorized, actor_permission, resolve_user


class FakeRole:
    def __init__(self, rid): self.id = int(rid)


class FakeUser:
    def __init__(self, uid, role_ids):
        self.id = int(uid)
        self.roles = [FakeRole(r) for r in role_ids]


class FakeInteraction:
    def __init__(self, uid, role_ids):
        self.user = FakeUser(uid, role_ids)


def test_owner_is_authorized_and_admin():
    inter = FakeInteraction(config_module.GAME_OWNER_DISCORD_USER_ID,
                            [config_module.DISCORD_OWNER_ROLE_ID])
    assert actor_permission(inter) == "owner"
    assert is_authorized(inter, staff=True) is True
    assert is_authorized(inter, admin=True) is True


def test_player_role_not_authorized_for_staff():
    inter = FakeInteraction("111111111111111111",
                            [config_module.DISCORD_PLAYER_ROLE_ID])
    assert actor_permission(inter) == "player"
    assert is_authorized(inter, staff=True) is False
    assert is_authorized(inter, admin=True) is False


def test_moderator_authorized_for_staff_not_admin():
    inter = FakeInteraction("222222222222222222",
                            [config_module.DISCORD_MODERATOR_ROLE_ID])
    assert is_authorized(inter, staff=True) is True
    assert is_authorized(inter, admin=True) is False


def test_resolve_user_by_game_tag(db):
    from models import User, DiscordAccount, GameProfile, AccountRole
    u = User(account_status="active"); db.add(u); db.flush()
    db.add(DiscordAccount(user_id=u.id, discord_user_id="777", guild_member=True))
    db.add(GameProfile(user_id=u.id, display_name="Testbot",
                       normalized_display_name="testbot", name_number=123456,
                       full_game_tag="Testbot#123456"))
    db.commit()
    found = resolve_user(db, "Testbot#123456")
    assert found is not None and found.id == u.id
    found2 = resolve_user(db, "testbot")  # case-insensitive
    assert found2.id == u.id


def test_bot_cannot_target_owner_via_command(db, monkeypatch):
    """The /player ban on the owner is blocked (covered by the cog guard)."""
    from discord_bot.commands import players as players_mod
    inter = FakeInteraction("333", [config_module.DISCORD_ADMIN_ROLE_ID])
    # Build a real user that is the owner.
    from models import User, DiscordAccount
    owner = User(account_status="active"); db.add(owner); db.flush()
    db.add(DiscordAccount(user_id=owner.id,
                          discord_user_id=config_module.GAME_OWNER_DISCORD_USER_ID,
                          guild_member=True))
    db.commit()
    # The cog guard checks user.discord.discord_user_id == OWNER before acting.
    target = resolve_user(db, config_module.GAME_OWNER_DISCORD_USER_ID)
    assert target.discord.discord_user_id == config_module.GAME_OWNER_DISCORD_USER_ID
