"""FastAPI authentication dependencies and guards.

- get_current_user: reads the HttpOnly session cookie, validates the session, and
  returns the User. Rejects when unauthenticated.
- require_permission(level): factory returning a dependency that enforces a
  minimum permission level (backend-validated, never client-trusted).
- csrf_protect: validates the CSRF token header against the session's token.
- RateLimiter instance for login/signup throttling.
"""
from __future__ import annotations

import time
from typing import Callable

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session as DBSession

from auth.permissions import Permissions, permission_for_user
from auth.sessions import get_session, verify_csrf
from config import RATE_LIMIT_PER_MINUTE
from database import get_db
from models import User
from security import RateLimiter

# Global login/signup rate limiter keyed by IP (per process).
_login_limiter = RateLimiter(limit=RATE_LIMIT_PER_MINUTE, window=60.0)
_signup_limiter = RateLimiter(limit=10, window=60.0)


def client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(key: str, limiter: RateLimiter) -> None:
    allowed, retry = limiter.check(key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please slow down.",
            headers={"Retry-After": str(int(retry) + 1)},
        )


class AuthError(HTTPException):
    def __init__(self, detail: str = "Authentication required") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_current_user(
    request: Request,
    db: DBSession = Depends(get_db),
    sth_session: str | None = Cookie(default=None),
) -> User:
    """Resolve the authenticated user from the session cookie."""
    session = get_session(db, sth_session)
    if session is None:
        raise AuthError("Invalid or expired session")
    user = db.get(User, session.user_id)
    if user is None:
        raise AuthError("Account not found")
    if user.account_status in ("deleted",):
        raise AuthError("Account unavailable")
    # Touch session last-seen (cheap; ignores failure).
    try:
        session.last_seen_at = time.time()
        db.commit()
    except Exception:
        pass
    return user


def get_permissions(user: User = Depends(get_current_user),
                    db: DBSession = Depends(get_db)) -> Permissions:
    return permission_for_user(db, user)


def require_permission(level: str) -> Callable[..., Permissions]:
    def dependency(perms: Permissions = Depends(get_permissions)) -> Permissions:
        if not perms.can(level):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return perms
    return dependency


def require_staff(perms: Permissions = Depends(get_permissions)) -> Permissions:
    if not perms.is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Staff permission required.")
    return perms


def require_admin(perms: Permissions = Depends(get_permissions)) -> Permissions:
    if not perms.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Administrator permission required.")
    return perms


def csrf_dependency(
    request: Request,
    db: DBSession = Depends(get_db),
    sth_session: str | None = Cookie(default=None),
    x_csrf_token: str | None = Header(default=None),
) -> None:
    """Validate the CSRF token header against the session's stored token.

    Reads the same session cookie used by get_current_user. Must be combined with
    get_current_user (or called after it) so the cookie is guaranteed valid.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    session = get_session(db, sth_session)
    if session is None:
        raise AuthError("Invalid session")
    if not verify_csrf(session.csrf_token, x_csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token mismatch.",
        )
