"""VPS multiplayer-server status service.

The bot uses this to know whether the VPS-hosted multiplayer world
(E:\\Subway-thots-hotel\\vps_connection) is online. It polls the world host's
/health endpoint (the same host the game connects to: cyan-squirrel-97200.zap.cloud) and
detects online/offline transitions so the bot can announce them in Discord.

No secrets are logged. Network errors are treated as "offline" (fail-closed).
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable

from config import WORLD_HOST_URL
from services import audit


@dataclass
class HostStatus:
    online: bool
    checked_at: float
    detail: dict[str, Any] | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "online": self.online,
            "checked_at": self.checked_at,
            "detail": self.detail,
            "error": self.error,
            "world_host_url": WORLD_HOST_URL,
        }


def check_world_health(url: str | None = None, timeout: float = 5.0) -> HostStatus:
    target = (url or WORLD_HOST_URL).rstrip("/") + "/health"
    now = time.time()
    try:
        req = urllib.request.Request(target, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "ignore")
        import json
        try:
            detail = json.loads(raw)
        except Exception:
            detail = {"raw": raw[:200]}
        return HostStatus(online=True, checked_at=now, detail=detail)
    except urllib.error.HTTPError as exc:
        return HostStatus(online=False, checked_at=now, error=f"HTTP {exc.code}")
    except Exception as exc:
        return HostStatus(online=False, checked_at=now, error=str(exc)[:200])


class HostWatcher:
    """Background poller that tracks online/offline transitions and fires a
    callback on change (used to announce in Discord)."""

    def __init__(self, url: str | None = None, interval: float = 30.0,
                 on_change: Callable[[HostStatus, HostStatus], None] | None = None) -> None:
        self.url = url or WORLD_HOST_URL
        self.interval = interval
        self.on_change = on_change
        self.last: HostStatus | None = None
        self._timer: Any = None
        self._stop = False

    def poll_once(self) -> HostStatus:
        status = check_world_health(self.url)
        if self.last is not None and status.online != self.last.online:
            audit(SessionLocal(), "world_host_status_change",
                  metadata={"online": status.online, "error": status.error})
            if self.on_change:
                try:
                    result = self.on_change(self.last, status)
                    # Support both sync and async callbacks.
                    if hasattr(result, "__await__"):
                        import asyncio
                        try:
                            loop = asyncio.get_running_loop()
                            asyncio.ensure_future(result)  # type: ignore[arg-type]
                        except RuntimeError:
                            pass
                except Exception:
                    pass
        self.last = status
        return status

    def start(self) -> None:
        import threading

        def loop() -> None:
            while not self._stop:
                try:
                    self.poll_once()
                except Exception:
                    pass
                # Sleep in small slices so stop() is responsive.
                for _ in range(int(self.interval)):
                    if self._stop:
                        break
                    time.sleep(1.0)

        self._stop = False
        self._timer = threading.Thread(target=loop, daemon=True)
        self._timer.start()

    def stop(self) -> None:
        self._stop = True


# Imported lazily to avoid circular import at module load.
from database import SessionLocal  # noqa: E402
