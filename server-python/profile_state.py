"""Pure server-owned profile serialization shared by host tests and runtime."""
from __future__ import annotations

from typing import Any


def profile_snapshot(player: Any) -> dict[str, Any]:
    return {
        'cash': max(0, int(getattr(player, 'money', 0))),
        'reputation': max(0, int(getattr(player, 'reputation', 0))),
        'weapons': sorted(str(item) for item in getattr(player, 'weapons', set())),
        'vehicles': sorted(str(item) for item in getattr(player, 'vehicles', set())),
        'roomLayout': getattr(player, 'room_layout', {}) if isinstance(getattr(player, 'room_layout', {}), dict) else {},
        'needs': getattr(player, 'needs', {'energy': 100, 'hunger': 100, 'hygiene': 100}),
        'jobStep': max(0, min(3, int(getattr(player, 'job_step', 0)))),
        'taskCount': max(0, min(3, int(getattr(player, 'task_count', 0)))),
    }
