"""Validated, creator-ready room layout contract.

The renderer may add richer assets later, but the server owns the bounded
placement data and rejects arbitrary scene or script payloads.
"""
from __future__ import annotations

import math

ALLOWED_DECORATIONS = frozenset({'sofa', 'lamp', 'plant', 'art', 'table', 'bar', 'rug'})
MAX_ITEMS = 40


def validate_room_layout(value) -> dict:
    if not isinstance(value, dict):
        return {'version': 1, 'items': []}
    raw_items = value.get('items', [])
    if not isinstance(raw_items, list):
        return {'version': 1, 'items': []}
    items = []
    for index, raw in enumerate(raw_items):
        if len(items) >= MAX_ITEMS:
            break
        if not isinstance(raw, dict) or raw.get('type') not in ALLOWED_DECORATIONS:
            continue
        numbers = [raw.get(key) for key in ('x', 'y', 'z', 'rotation', 'scale')]
        if not all(isinstance(number, (int, float)) and math.isfinite(number) for number in numbers):
            continue
        items.append({
            'id': str(raw.get('id') or f'decoration-{index}')[:64],
            'type': raw['type'],
            'x': max(-8.1, min(8.1, float(raw['x']))),
            'y': max(0.0, min(6.8, float(raw['y']))),
            'z': max(-8.1, min(8.1, float(raw['z']))),
            'rotation': max(-math.pi * 4, min(math.pi * 4, float(raw['rotation']))),
            'scale': max(0.5, min(2.0, float(raw['scale']))),
        })
    return {'version': 1, 'items': items}
