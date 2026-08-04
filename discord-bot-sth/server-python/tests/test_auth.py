"""Authentication + account creation tests (mocked Discord)."""
from __future__ import annotations

from auth.discord_oauth import create_authorization_start, consume_state, handle_callback
from models import User


def _oauth_start_and_code(client, fake_discord, *, member_roles=None, not_member=False,
                          bad_state=False, no_code=False, pkce_fail=False):
    # Begin login to get a valid state row.
    resp = client.get("/auth/discord/login")
    assert resp.status_code == 200, resp.text
    state = resp.json()["state"]
    # Configure the fake Discord response.
    if not_member:
        fake_discord.member = None
    else:
        fake_discord.member = {"roles": member_roles or ["1534021254691033128"]}
    code = "" if no_code else "fake-code"
    if bad_state:
        state = "bogus-state"
    return client.get(f"/auth/discord/callback?code={code}&state={state}")


def test_successful_discord_login_creates_session(client, fake_discord):
    resp = _oauth_start_and_code(client, fake_discord)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["needs_player_name"] is True
    assert "sth_session" in resp.cookies
    # Session is valid.
    me = client.get("/auth/session")
    assert me.status_code == 200
    assert me.json()["authenticated"] is True


def test_invalid_oauth_state(client, fake_discord):
    resp = _oauth_start_and_code(client, fake_discord, bad_state=True)
    assert resp.status_code == 400
    assert resp.json()["error"] == "invalid_state"
    # No session cookie issued.
    assert "sth_session" not in resp.cookies


def test_user_not_in_server_denied(client, fake_discord):
    resp = _oauth_start_and_code(client, fake_discord, not_member=True)
    assert resp.status_code == 403
    assert resp.json()["error"] == "membership_required"
    assert "invite_url" in resp.json()


def test_missing_required_role(client, fake_discord):
    # Member but without the player/verified role.
    resp = _oauth_start_and_code(client, fake_discord, member_roles=["999999999999999"])
    assert resp.status_code == 403
    assert resp.json()["error"] == "role_required"


def test_role_automatically_assigned_on_signup(client, fake_discord, db):
    # Player role present -> account created, verified role assignment attempted.
    resp = _oauth_start_and_code(client, fake_discord, member_roles=["1534021254691033128"])
    assert resp.status_code == 200
    # The fake HTTP records a PUT to assign the verified role.
    assert any("roles" in c[0] for c in fake_discord.assigned_roles)


def test_duplicate_discord_account(client, fake_discord):
    # First login creates the user; second should still succeed (returning player).
    r1 = _oauth_start_and_code(client, fake_discord)
    assert r1.status_code == 200
    # Create the game name.
    client.post("/account/create-player-name", json={"display_name": "Slizzy"},
                headers={"X-CSRF-Token": r1.json()["csrf_token"]})
    # Second login with same discord id.
    r2 = _oauth_start_and_code(client, fake_discord)
    assert r2.status_code == 200
    assert r2.json()["needs_player_name"] is False


def test_create_player_name_and_tag_format(client, fake_discord):
    login = _oauth_start_and_code(client, fake_discord)
    csrf = login.json()["csrf_token"]
    resp = client.post("/account/create-player-name", json={"display_name": "Slizzy"},
                      headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 200, resp.text
    tag = resp.json()["full_game_tag"]
    assert tag.startswith("Slizzy#")
    number = int(tag.split("#")[1])
    assert 100000 <= number <= 999999


def test_invalid_game_name(client, fake_discord):
    login = _oauth_start_and_code(client, fake_discord)
    csrf = login.json()["csrf_token"]
    for bad in ["ab", "SuperLongNameThatExceeds", "Bad Name", "a!b"]:
        resp = client.post("/account/create-player-name", json={"display_name": bad},
                          headers={"X-CSRF-Token": csrf})
        assert resp.status_code == 400, (bad, resp.text)


def test_reserved_game_name(client, fake_discord):
    login = _oauth_start_and_code(client, fake_discord)
    csrf = login.json()["csrf_token"]
    resp = client.post("/account/create-player-name", json={"display_name": "Owner"},
                      headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 400
    assert resp.json()["error"] == "reserved_name"


def test_duplicate_game_name_case_insensitive(client, fake_discord):
    login = _oauth_start_and_code(client, fake_discord)
    csrf = login.json()["csrf_token"]
    r1 = client.post("/account/create-player-name", json={"display_name": "Slizzy"},
                     headers={"X-CSRF-Token": csrf})
    assert r1.status_code == 200
    # Second, different discord account with same name (different case).
    fake_discord.user = {"id": "999999999999999999", "username": "other", "global_name": "other", "avatar": None}
    r2 = _oauth_start_and_code(client, fake_discord, member_roles=["1534021254691033128"])
    csrf2 = r2.json()["csrf_token"]
    r3 = client.post("/account/create-player-name", json={"display_name": "slizzy"},
                     headers={"X-CSRF-Token": csrf2})
    assert r3.status_code == 400
    assert r3.json()["error"] == "duplicate_name"


def test_csrf_protection_on_create_name(client, fake_discord):
    login = _oauth_start_and_code(client, fake_discord)
    # No CSRF header -> rejected.
    resp = client.post("/account/create-player-name", json={"display_name": "Slizzy"})
    assert resp.status_code == 403
