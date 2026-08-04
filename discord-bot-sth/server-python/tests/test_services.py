"""Membership, moderation, WebSocket ticket, owner, and username-change tests."""
from __future__ import annotations

import time

from auth.membership import on_member_left, on_member_joined, verify_membership
from models import AccountRole, Ban, DiscordAccount, User
from services.moderation_service import ban_user, suspend_user, unban_user, unsuspend_user
from services.websocket_service import issue_ticket, consume_ticket, check_live_access, TicketError
from config import GAME_OWNER_DISCORD_USER_ID


def _make_player(db, discord_id="1513224601751130132", name="Slizzy", roles=None):
    user = User(account_status="active")
    db.add(user)
    db.flush()
    db.add(DiscordAccount(user_id=user.id, discord_user_id=discord_id,
                          discord_username="officialsinland_dev",
                          discord_global_name="officialsinland_dev", guild_member=True))
    db.add(__import__("models", fromlist=["GameProfile"]).GameProfile(
        user_id=user.id, display_name=name, normalized_display_name=name.lower(),
        name_number=738665, full_game_tag=f"{name}#738665"))
    for rid in (roles or []):
        db.add(AccountRole(user_id=user.id, discord_role_id=rid, game_permission="player", source="discord"))
    db.commit()
    return user


def _login_with(client, fake_discord, discord_id="1513224601751130132", name="Slizzy",
               member_roles=None, create_name=True):
    fake_discord.user = {"id": discord_id, "username": "u", "global_name": "u", "avatar": None}
    fake_discord.member = {"roles": member_roles or ["1534021254691033128"]}
    r = client.get("/auth/discord/login")
    state = r.json()["state"]
    resp = client.get(f"/auth/discord/callback?code=fake&state={state}")
    if create_name and resp.status_code == 200 and resp.json().get("needs_player_name"):
        client.post("/account/create-player-name", json={"display_name": name},
                    headers={"X-CSRF-Token": resp.json()["csrf_token"]})
    return resp


def test_banned_user_login(client, fake_discord, db):
    user = _make_player(db, roles=["1534022085146443918"])  # banned role
    # Seed a banned membership cache.
    from auth.membership import _write_cache
    _write_cache(db, user.discord.discord_user_id, is_member=True,
                 role_ids=["1534022085146443918"], permission="banned")
    resp = _login_with(client, fake_discord, member_roles=["1534022085146443918"], create_name=False)
    assert resp.status_code == 403
    assert resp.json()["error"] == "banned"


def test_suspended_user_login(client, fake_discord, db):
    user = _make_player(db)
    suspend_user(db, user, reason="test")
    # Re-login: membership cache is fine but account status is suspended.
    resp = _login_with(client, fake_discord, create_name=False)
    # The login itself succeeds (session created); account status reflects suspended.
    assert resp.status_code == 200
    me = client.get("/auth/session")
    assert me.json()["user"]["account_status"] == "suspended"


def test_membership_lost_during_active_session(client, fake_discord, db):
    _login_with(client, fake_discord, name="Slizzy")
    # Simulate Discord member-remove event.
    on_member_left(db, "1513224601751130132")
    # Issue a WS ticket now -> should be denied (membership missing).
    t = client.post("/account/ws-ticket", headers={"X-CSRF-Token": client.cookies.get("sth_csrf") or ""})
    # The session cookie holds auth; use it.
    t = client.post("/account/ws-ticket")
    assert t.status_code == 403 or t.json().get("error") == "membership_required"


def test_websocket_ticket_replay(client, fake_discord, db):
    _login_with(client, fake_discord, name="Slizzy")
    user = db.query(User).first()
    ticket = issue_ticket(db, user, permissions="player")
    # First consume ok.
    res1 = consume_ticket(db, ticket["ticket"])
    assert res1["game_tag"] == "Slizzy#738665"
    # Replay -> rejected.
    try:
        consume_ticket(db, ticket["ticket"])
        assert False, "replay should fail"
    except TicketError as e:
        assert "replayed" in str(e)


def test_expired_websocket_ticket(client, fake_discord, db):
    _login_with(client, fake_discord, name="Slizzy")
    user = db.query(User).first()
    # Craft an expired ticket by manipulating expires_at.
    ticket = issue_ticket(db, user, permissions="player")
    from models import WebSocketTicket
    row = db.query(WebSocketTicket).filter_by(ticket_id=ticket["ticket_id"]).first()
    row.expires_at = time.time() - 10
    db.commit()
    try:
        consume_ticket(db, ticket["ticket"])
        assert False, "expired should fail"
    except TicketError as e:
        assert "expired" in str(e)


def test_session_revocation_on_ban(client, fake_discord, db):
    _login_with(client, fake_discord, name="Slizzy")
    user = db.query(User).first()
    ban_user(db, user, reason="test ban", moderator_discord_id="staff")
    me = client.get("/auth/session")
    assert me.status_code == 401


def test_owner_permission_by_discord_id(client, fake_discord, db):
    # Owner logs in.
    _login_with(client, fake_discord, discord_id=GAME_OWNER_DISCORD_USER_ID, name="Slizzy",
               member_roles=["1534021734984843364"])
    me = client.get("/auth/session")
    body = me.json()
    assert body["user"]["is_owner"] is True
    assert body["user"]["permissions"] == "owner"


def test_username_change_without_identity_loss(client, fake_discord, db):
    _login_with(client, fake_discord, name="Slizzy")
    user = db.query(User).first()
    # Simulate Discord username change event (id stays the same).
    discord = user.discord
    discord.discord_username = "newname_dev"
    db.commit()
    me = client.get("/auth/session")
    # Discord id unchanged -> still the same account.
    assert me.json()["user"]["discord"]["id"] == "1513224601751130132"
    assert me.json()["user"]["discord"]["username"] == "newname_dev"


def test_unauthorized_admin_command(client, fake_discord, db):
    # Normal player tries to ban via admin API -> 403.
    _login_with(client, fake_discord, name="Slizzy")
    resp = client.post("/admin/ban", json={"identifier": "1513224601751130132",
                       "reason": "nope"})
    assert resp.status_code == 403


def test_discord_api_outage_login(client, fake_discord):
    fake_discord.raise_exchange = True
    r = client.get("/auth/discord/login")
    state = r.json()["state"]
    resp = client.get(f"/auth/discord/callback?code=fake&state={state}")
    assert resp.status_code == 400
    assert resp.json()["error"] == "token_exchange_failed"


def test_database_outage_handling(client, fake_discord, monkeypatch):
    # Force DB errors on session to surface graceful 401/500 rather than crash.
    def boom(*a, **k):
        raise RuntimeError("db down")
    monkeypatch.setattr("api.auth_routes.get_session", boom)
    resp = client.get("/auth/session")
    assert resp.status_code in (401, 500)
