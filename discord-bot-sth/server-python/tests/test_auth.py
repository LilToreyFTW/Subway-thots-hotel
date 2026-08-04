"""Authentication API tests (mocked Discord)."""
from __future__ import annotations

import time

from models import DiscordAccount, GameProfile, User


def _login_with(client, fake_discord, *, discord_id="1513224601751130132",
               name="Slizzy", member=None, create_name=True):
    """Drive the full Discord OAuth callback. `member` is the guild member
    payload (dict with 'roles') or None when not a server member."""
    fake_discord.user = {"id": discord_id, "username": "u",
                         "global_name": "U", "avatar": None}
    fake_discord.member = member  # None => not a member
    r = client.get("/auth/discord/login")
    state = r.json()["state"]
    resp = client.get(f"/auth/discord/callback?code=fake&state={state}")
    if create_name and resp.status_code == 200 and resp.json().get("needs_player_name"):
        client.post("/account/create-player-name", json={"display_name": name},
                    headers={"X-CSRF-Token": resp.cookies.get("sth_csrf", "")})
    return resp


def test_successful_discord_login_creates_session(client, fake_discord):
    resp = _login_with(client, fake_discord,
                       member={"roles": ["1534021254691033128"]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["needs_player_name"] is True
    # Session cookie + CSRF cookie issued.
    assert client.cookies.get("sth_session")
    assert client.cookies.get("sth_csrf")


def test_invalid_oauth_state(client, fake_discord):
    fake_discord.member = {"roles": ["1534021254691033128"]}
    resp = client.get("/auth/discord/callback?code=fake&state=bogus")
    assert resp.status_code == 400
    assert resp.json()["error"] == "invalid_state"


def test_user_not_in_server_denied(client, fake_discord):
    # Not a member => 403 with invite.
    resp = _login_with(client, fake_discord, member=None, create_name=False)
    assert resp.status_code == 403
    assert resp.json()["error"] == "membership_required"
    assert "invite_url" in resp.json()


def test_missing_required_role(client, fake_discord):
    # Member but lacks Player/Verified role => 403 role_required.
    resp = _login_with(client, fake_discord,
                       member={"roles": ["999999999999999999"]},
                       create_name=False)
    assert resp.status_code == 403
    assert resp.json()["error"] == "role_required"


def test_role_automatically_assigned_on_signup(client, fake_discord):
    _login_with(client, fake_discord, member={"roles": ["1534021254691033128"]})
    # Bot should have assigned the Verified role during registration.
    assert any("roles" in url for url in fake_discord.assigned_roles)


def test_duplicate_discord_account(client, fake_discord):
    # Logging in twice with the same Discord id reuses the account (200), not 400.
    a = _login_with(client, fake_discord, member={"roles": ["1534021254691033128"]})
    assert a.status_code == 200
    b = _login_with(client, fake_discord, member={"roles": ["1534021254691033128"]})
    assert b.status_code == 200
    db = __import__("database").SessionLocal()
    count = db.query(DiscordAccount).filter(
        DiscordAccount.discord_user_id == "1513224601751130132").count()
    db.close()
    assert count == 1


def test_create_player_name_and_tag_format(client, fake_discord):
    _login_with(client, fake_discord, name="Slizzy",
                member={"roles": ["1534021254691033128"]})
    me = client.get("/auth/session")
    assert me.status_code == 200
    assert me.json()["user"]["game"]["full_game_tag"] == "Slizzy#738665"
    assert me.json()["user"]["game"]["name_number"] == 738665


def test_invalid_game_name(client, fake_discord):
    _login_with(client, fake_discord, create_name=False,
                member={"roles": ["1534021254691033128"]})
    resp = client.post("/account/create-player-name", json={"display_name": "ab"},
                       headers={"X-CSRF-Token": client.cookies.get("sth_csrf", "")})
    assert resp.status_code == 400
    assert resp.json()["error"] == "too_short"


def test_reserved_game_name(client, fake_discord):
    _login_with(client, fake_discord, create_name=False,
                member={"roles": ["1534021254691033128"]})
    resp = client.post("/account/create-player-name", json={"display_name": "admin"},
                       headers={"X-CSRF-Token": client.cookies.get("sth_csrf", "")})
    assert resp.status_code == 400
    assert resp.json()["error"] == "reserved_name"


def test_duplicate_game_name_case_insensitive(client, fake_discord):
    # First account takes Slizzy.
    _login_with(client, fake_discord, name="Slizzy",
                member={"roles": ["1534021254691033128"]})
    # Second Discord id tries SLIZZY (case-insensitive dup).
    fake_discord.user = {"id": "222222222222222222", "username": "v",
                         "global_name": "V", "avatar": None}
    fake_discord.member = {"roles": ["1534021254691033128"]}
    r = client.get("/auth/discord/login")
    state = r.json()["state"]
    resp = client.get(f"/auth/discord/callback?code=fake&state={state}")
    dup = client.post("/account/create-player-name", json={"display_name": "SLIZZY"},
                      headers={"X-CSRF-Token": resp.cookies.get("sth_csrf", "")})
    assert dup.status_code == 400
    assert dup.json()["error"] == "duplicate_name"


def test_csrf_protection_on_create_name(client, fake_discord):
    _login_with(client, fake_discord, create_name=False,
                member={"roles": ["1534021254691033128"]})
    # No CSRF header => 403.
    resp = client.post("/account/create-player-name", json={"display_name": "Slizzy"})
    assert resp.status_code == 403
