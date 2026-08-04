"""Session management.

Sessions are server-side records keyed by an opaque random token (stored hashed
in the DB; the raw token lives only in an HttpOnly, SameSite cookie). Sessions
expire, can be revoked, and support refresh. CSRF tokens are bound per session.
"""
from __future__ import annotations

import secrets
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from config import COOKIE_SECURE, COOKIE_SAMESITE, SESSION_TTL_SECONDS
from models import OAuthState, Session, User
from security import encode_session, decode_session, make_token, sha256_hex


def create_session(db: DBSession, user: User, *,
                   user_agent: str | None = None,
                   ip_address: str | None = None) -> tuple[str, str, str]:
    """Create a session row. Returns (raw_cookie_token, csrf_token, signed_jwt).

    The raw token is returned to the caller exactly once to set the cookie.
    """
    raw = make_token(32)
    csrf = make_token(24)
    now = time.time()
    session = Session(
        token_hash=sha256_hex(raw),
        user_id=user.id,
        csrf_token=csrf,
        expires_at=now + SESSION_TTL_SECONDS,
        last_seen_at=now,
        user_agent=(user_agent or "")[:256] or None,
        ip_address=sha256_hex(ip_address)[:64] if ip_address else None,
    )
    db.add(session)
    db.commit()
    # A signed, stateless token is also issued for the websocket ticket handshake
    # and frontend convenience; it carries minimal claims and expires with session.
    signed = encode_session(
        {"uid": user.id, "csrf": csrf, "sid": session.id}, SESSION_TTL_SECONDS
    )
    return raw, csrf, signed


def get_session(db: DBSession, raw_token: str | None) -> Session | None:
    """Look up a session by raw token, enforcing expiry and revocation."""
    if not raw_token:
        return None
    token_hash = sha256_hex(raw_token)
    session = db.query(Session).filter(Session.token_hash == token_hash).first()
    if session is None:
        return None
    if session.revoked:
        return None
    if session.expires_at < time.time():
        return None
    return session


def rotate_session(db: DBSession, session: Session, user: User) -> tuple[str, str, str]:
    """Revoke the old session and issue a fresh one (refresh-token rotation)."""
    revoke_session(db, session, reason="rotated")
    return create_session(db, user)


def revoke_session(db: DBSession, session: Session, *, reason: str | None = None) -> None:
    session.revoked = True
    session.revoked_reason = reason
    db.commit()


def revoke_all_sessions(db: DBSession, user_id: str, *, reason: str | None = None,
                        keep: Session | None = None) -> int:
    """Revoke every session for a user. Returns the count revoked."""
    q = db.query(Session).filter(Session.user_id == user_id, Session.revoked.is_(False))
    count = 0
    for s in q.all():
        if keep is not None and s.id == keep.id:
            continue
        s.revoked = True
        s.revoked_reason = reason
        count += 1
    db.commit()
    return count


def touch_session(db: DBSession, session: Session) -> None:
    session.last_seen_at = time.time()
    db.commit()


def verify_csrf(stored: str, provided: str | None) -> bool:
    if not stored or not provided:
        return False
    return secrets.compare_digest(stored, provided)


def cookie_attributes() -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "max_age": SESSION_TTL_SECONDS,
        "path": "/",
    }


def decode_signed_session(token: str) -> dict[str, Any] | None:
    return decode_session(token)
