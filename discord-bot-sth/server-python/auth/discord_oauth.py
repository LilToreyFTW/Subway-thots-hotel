"""Discord OAuth2 flow: state generation + PKCE, authorization URL, and the
secure token exchange + identity verification.

Security properties:
- OAuth `state` is random, stored server-side (oauth_states) with a TTL, and
  verified on callback (CSRF/replay protection).
- PKCE (S256) is supported and used when a verifier was created at login start.
- The access token is used once to fetch identity + membership, never stored in
  the browser and never written to logs.
- We treat the Discord *user id* as the identity, never a client-submitted name.
"""
from __future__ import annotations

import base64
import hashlib
import secrets
import time

from sqlalchemy.orm import Session as DBSession

from config import DISCORD_CLIENT_ID, OAUTH_STATE_TTL_SECONDS
from models import OAuthState
from discord_http import DiscordHTTP, DiscordUser, build_oauth_url, parse_member_roles
from models import DiscordMembershipCache
from security import make_token, sha256_hex


def create_authorization_start(db: DBSession, *, with_pkce: bool = True) -> dict[str, str]:
    """Create a server-side OAuth state (and optional PKCE verifier). Returns the
    values needed by the browser to begin the flow."""
    state = make_token(24)
    csrf = make_token(24)
    verifier = secrets.token_urlsafe(64) if with_pkce else None
    challenge = None
    if verifier:
        digest = hashlib.sha256(verifier.encode("ascii")).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    row = OAuthState(
        state=state,
        csrf_token=csrf,
        pkce_verifier=verifier,
        expires_at=time.time() + OAUTH_STATE_TTL_SECONDS,
    )
    db.add(row)
    db.commit()
    url = build_oauth_url(state, csrf, code_challenge=challenge)
    return {"authorize_url": url, "state": state, "csrf_token": csrf}


def consume_state(db: DBSession, state: str) -> OAuthState | None:
    """Fetch and immediately invalidate an OAuth state. Returns None if missing,
    expired, or already consumed (replay protection)."""
    row = db.query(OAuthState).filter(OAuthState.state == state).first()
    if row is None:
        return None
    if row.consumed:
        return None
    if row.expires_at < time.time():
        return None
    row.consumed = True
    db.commit()
    return row


def handle_callback(db: DBSession, *,
                    code: str | None,
                    state: str | None,
                    code_verifier: str | None = None,
                    http: DiscordHTTP | None = None) -> tuple[bool, str, DiscordUser | None]:
    """Exchange the code for an access token, fetch identity + membership.

    Returns (ok, error_code, discord_user). On failure, discord_user is None and
    error_code explains why (e.g. 'invalid_state', 'missing_code', 'not_member').
    """
    if not code:
        return False, "missing_code", None
    if not state:
        return False, "invalid_state", None

    state_row = consume_state(db, state)
    if state_row is None:
        return False, "invalid_state", None

    # PKCE verifier must match the one created at login start.
    if code_verifier is None and state_row.pkce_verifier is not None:
        return False, "invalid_pkce", None
    if state_row.pkce_verifier is not None and code_verifier != state_row.pkce_verifier:
        return False, "invalid_pkce", None

    http = http or DiscordHTTP()
    try:
        token_resp = http.exchange_code(code, code_verifier=code_verifier)
    except Exception:
        return False, "token_exchange_failed", None

    access_token = token_resp.get("access_token") if isinstance(token_resp, dict) else None
    if not access_token:
        return False, "token_exchange_failed", None

    try:
        user = http.get_user(access_token)
        member = http.get_guild_member(access_token)
    except Exception:
        # Do not cache; treat as transient failure.
        return False, "discord_api_error", None

    user.role_ids = parse_member_roles(member)
    user.is_guild_member = member is not None

    # Refresh the membership cache. We do NOT persist the access token.
    refresh_membership_cache(db, user)
    return True, "ok", user


def refresh_membership_cache(db: DBSession, user: DiscordUser) -> None:
    """Write/update the membership cache row for a Discord user."""
    from config import MEMBERSHIP_CACHE_TTL_SECONDS, resolve_permission_from_roles
    from config import is_banned_role

    permission = "banned" if is_banned_role(user.role_ids) else resolve_permission_from_roles(user.role_ids)
    expires_at = time.time() + MEMBERSHIP_CACHE_TTL_SECONDS
    row = db.query(DiscordMembershipCache).filter(
        DiscordMembershipCache.discord_user_id == user.user_id).first()
    if row is None:
        row = DiscordMembershipCache(discord_user_id=user.user_id)
        db.add(row)
    row.is_member = user.is_guild_member
    row.role_ids = ",".join(user.role_ids)
    row.permission = permission
    row.cached_at = time.time()
    row.expires_at = expires_at
    db.commit()
