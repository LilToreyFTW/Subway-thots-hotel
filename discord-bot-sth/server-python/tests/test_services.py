"""Membership, moderation, WebSocket ticket, owner, and username-change tests."""
from __future__ import annotations

import time

from models import DiscordAccount, User, WebSocketTicket
from services.moderation_service import ban_user, suspend_user
from services.websocket_service import issue_ticket, consume_ticket, TicketError
from auth.membership import on_member_left
from config import GAME_OWNER_DISCORD_USER_ID


def _login_with(client, fake_discord, *, discord_id="1513224601751130132",
               name="Slizzy", member=None, create_name=True):
    fake_discord.user = {"id": discord_id, "username": "u",
                         "global_name": "U", "avatar": None}
    fake_discord.member = member
    r = client.get("/auth/discord/login")
    state = r.json()["state"]
    resp = client.get(f"/auth/discord/callback?code=fake&state={state}")
    if create_name and resp.status_code == 200 and resp.json().get("needs_player_name"):
        client.post("/account/create-player-name", json={"display_name": name},
                    headers={"X-CSRF-Token": resp.cookies.get("sth_csrf", "")})
    return resp


def test_banned_user_login(client, fake_discord):
    resp = _login_with(client, fake_discord, name="Slizzy",
                       member={"roles": ["1534022085146443918"]}, create_name=False)
    assert resp.status_code == 403
    assert resp.json()["error"] == "banned"


def test_suspended_user_login(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
                member={"roles": ["1534021254691033128"]})
    db = __import__("database").SessionLocal()
    user = db.query(User).first()
    suspend_user(db, user, reason="test")
    db.close()
    me = client.get("/auth/session")
    assert me.json()["user"]["account_status"] == "suspended"


def test_membership_lost_during_active_session(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
               member={"roles": ["1534021254691033128"]})
    db = __import__("database").SessionLocal()
    discord = db.query(DiscordAccount).first()
    on_member_left(db, discord.discord_user_id)
    db.close()
    t = client.post("/account/ws-ticket")
    assert t.status_code == 403
    assert t.json()["error"] == "membership_required"


def test_websocket_ticket_replay(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
               member={"roles": ["1534021254691033128"]})
    db = __import__("database").SessionLocal()
    user = db.query(User).first()
    ticket = issue_ticket(db, user, permissions="player")
    db.close()
    res1 = consume_ticket(db, ticket["ticket"])
    assert res1["game_tag"] == "Slizzy#738665"
    try:
        consume_ticket(db, ticket["ticket"])
        assert False, "replay should fail"
    except TicketError as e:
        assert "replayed" in str(e)


def test_expired_websocket_ticket(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
               member={"roles": ["1534021254691033128"]})
    db = __import__("database").SessionLocal()
    user = db.query(User).first()
    ticket = issue_ticket(db, user, permissions="player")
    row = db.query(WebSocketTicket).filter_by(ticket_id=ticket["ticket_id"]).first()
    row.expires_at = int(time.time()) - 10
    db.commit()
    try:
        consume_ticket(db, ticket["ticket"])
        assert False, "expired should fail"
    except TicketError as e:
        assert "expired" in str(e)
    db.close()


def test_session_revocation_on_ban(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
               member={"roles": ["1534021254691033128"]})
    db = __import__("database").SessionLocal()
    user = db.query(User).first()
    ban_user(db, user, reason="test ban", moderator_discord_id="staff")
    db.close()
    me = client.get("/auth/session")
    assert me.status_code == 401


def test_owner_permission_by_discord_id(client, fake_discord):
    _login_with(client, fake_discord, discord_id=GAME_OWNER_DISCORD_USER_ID,
               name="Slizzy", member={"roles": ["1534021734984843364"]})
    me = client.get("/auth/session")
    body = me.json()
    assert body["user"]["is_owner"] is True
    assert body["user"]["permissions"] == "owner"


def test_username_change_without_identity_loss(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
               member={"roles": ["1534021254691033128"]})
    db = __import__("database").SessionLocal()
    user = db.query(User).first()
    discord = user.discord
    discord.discord_username = "newname_dev"
    db.commit()
    db.close()
    me = client.get("/auth/session")
    assert me.json()["user"]["discord"]["id"] == "1513224601751130132"
    assert me.json()["user"]["discord"]["username"] == "newname_dev"


def test_unauthorized_admin_command(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
               member={"roles": ["1534021254691033128"]})
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
    def boom(*a, **k):
        raise RuntimeError("db down")
    import api.auth_routes as auth_routes
    monkeypatch.setattr(auth_routes, "get_session", boom)
    resp = client.get("/auth/session")
    assert resp.status_code in (401, 500)
