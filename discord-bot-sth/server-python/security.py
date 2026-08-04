"""Cryptographic helpers for sessions, CSRF tokens, WebSocket tickets, and rate
limiting. No secrets are ever logged. All tokens use HMAC-SHA256 over a payload
with an embedded expiry so they are statelessly verifiable yet tamper-evident.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Any

from config import AUTH_SECRET, SESSION_SECRET

_TOKEN_RE = __import__("re").compile(r"^[A-Za-z0-9._-]+$")


def _b(value: str) -> bytes:
    return value.encode("utf-8")


def _sign(payload: str, secret: str) -> str:
    return hmac.new(_b(secret), _b(payload), hashlib.sha256).digest().hex()


def _timing_safe_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def make_token(byte_count: int = 32) -> str:
    """A high-entropy random opaque token (used for session ids / ticket secrets)."""
    return secrets.token_urlsafe(byte_count)


def encode_signed(payload: dict[str, Any], secret: str, ttl: int) -> str:
    """Encode a JSON payload into a tamper-evident token with expiry.

    Format: <base64url(json)>.<expiry>.<hmac>
    """
    exp = int(time.time()) + ttl
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    encoded = _b64url(body)
    signed = f"{encoded}.{exp}"
    return f"{signed}.{_sign(signed, secret)}"


def decode_signed(token: str, secret: str, now: int | None = None) -> dict[str, Any] | None:
    """Verify and decode a token produced by encode_signed. Returns None on any
    failure (bad signature, expired, malformed). Never raises."""
    try:
        parts = str(token or "").split(".")
        if len(parts) != 3:
            return None
        encoded, exp_str, provided_sig = parts
        if not provided_sig or not exp_str:
            return None
        signed = f"{encoded}.{exp_str}"
        expected_sig = _sign(signed, secret)
        if not _timing_safe_eq(expected_sig, provided_sig):
            return None
        exp = int(exp_str)
        now = int(time.time() if now is None else now)
        if exp <= now:
            return None
        body = _b64url_decode(encoded)
        data = json.loads(body)
        if not isinstance(data, dict):
            return None
        return data
    except Exception:
        return None


def _b64url(data: str) -> str:
    import base64

    return base64.urlsafe_b64encode(_b(data)).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    import base64

    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


@dataclass
class RateBucket:
    """Tiny in-memory sliding fixed-window rate limiter (per process)."""

    limit: int
    window: float

    def __post_init__(self) -> None:
        self._hits: list[float] = []

    def allow(self, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        cutoff = now - self.window
        self._hits = [t for t in self._hits if t > cutoff]
        if len(self._hits) >= self.limit:
            return False
        self._hits.append(now)
        return True

    def retry_after(self, now: float | None = None) -> float:
        now = time.monotonic() if now is None else now
        if not self._hits:
            return 0.0
        return max(0.0, self._hits[0] + self.window - now)


class RateLimiter:
    """Per-key rate limiter used for login/signup throttling."""

    def __init__(self, limit: int, window: float = 60.0) -> None:
        self.limit = limit
        self.window = window
        self._buckets: dict[str, RateBucket] = {}

    def check(self, key: str) -> tuple[bool, float]:
        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = RateBucket(self.limit, self.window)
            self._buckets[key] = bucket
        allowed = bucket.allow()
        retry = 0.0 if allowed else bucket.retry_after()
        return allowed, retry


# Session tokens use the dedicated session secret so cookie rotation and DB
# compromise do not leak the socket HMAC secret.
def encode_session(payload: dict[str, Any], ttl: int) -> str:
    return encode_signed(payload, SESSION_SECRET, ttl)


def decode_session(token: str) -> dict[str, Any] | None:
    return decode_signed(token, SESSION_SECRET)


def encode_ws_ticket(payload: dict[str, Any], ttl: int) -> str:
    return encode_signed(payload, AUTH_SECRET, ttl)


def decode_ws_ticket(token: str) -> dict[str, Any] | None:
    return decode_signed(token, AUTH_SECRET)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(_b(value)).hexdigest()
