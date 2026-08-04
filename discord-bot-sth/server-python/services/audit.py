"""Audit logging. Every security-relevant action records an AuditLog row.

Never log tokens, secrets, raw IPs, or passwords here. IPs are hashed before
storage. Metadata must be a JSON-serializable dict of safe values only.
"""
from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session as DBSession

from models import AuditLog


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def audit(
    db: DBSession,
    event_type: str,
    *,
    user_account_id: str | None = None,
    discord_user_id: str | None = None,
    acting_staff_discord_id: str | None = None,
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
    commit: bool = True,
) -> AuditLog:
    """Create an audit log entry. Always best-effort; DB failures are caught so
    the main action still completes, but we record a fallback error event."""
    try:
        safe_meta = _sanitize(metadata)
        row = AuditLog(
            event_type=event_type,
            user_account_id=user_account_id,
            discord_user_id=discord_user_id,
            acting_staff_discord_id=acting_staff_discord_id,
            reason=_truncate(reason, 512) if reason else None,
            metadata_json=json.dumps(safe_meta) if safe_meta else None,
        )
        db.add(row)
        if commit:
            db.commit()
            db.refresh(row)
        return row
    except Exception:
        # Never let audit logging break the primary action.
        try:
            db.rollback()
        except Exception:
            pass
        # Re-create without metadata as a fallback.
        try:
            row = AuditLog(
                event_type=event_type,
                user_account_id=user_account_id,
                discord_user_id=discord_user_id,
                acting_staff_discord_id=acting_staff_discord_id,
                reason="audit_fallback",
                metadata_json=json.dumps({"error": "audit_serialization_failed"}),
            )
            db.add(row)
            if commit:
                db.commit()
            return row
        except Exception:
            return AuditLog(event_type=event_type)


def _truncate(value: str, length: int) -> str:
    return value if len(value) <= length else value[: length - 3] + "..."


_SENSITIVE_KEYS = {
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "cookie",
    "password",
    "authorization",
    "bot_token",
    "client_secret",
    "session_cookie",
}

_SENSITIVE_VALUE_HINTS = ("token", "secret", "password", "cookie", "key", "auth")


def _sanitize(metadata: dict[str, Any] | None) -> dict[str, Any]:
    if not metadata:
        return {}
    out: dict[str, Any] = {}
    for key, value in metadata.items():
        k = str(key).lower()
        if k in _SENSITIVE_KEYS:
            out[key] = "<redacted>"
            continue
        if any(h in k for h in _SENSITIVE_VALUE_HINTS) and isinstance(value, str) and len(value) > 12:
            out[key] = "<redacted>"
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            out[key] = value
        elif isinstance(value, (list, tuple)):
            out[key] = [str(v)[:200] for v in value[:50]]
        elif isinstance(value, dict):
            out[key] = {str(k2)[:60]: str(v2)[:200] for k2, v2 in list(value.items())[:50]}
        else:
            out[key] = str(value)[:200]
    return out
