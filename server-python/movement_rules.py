from __future__ import annotations

import math

ZONES = {'city', 'hotel', 'room'}
TRANSITIONS = {('city', 'hotel'), ('hotel', 'city'), ('hotel', 'room'), ('room', 'hotel')}


def validate_input(x, z) -> tuple[bool, str]:
    try:
        x, z = float(x), float(z)
    except (TypeError, ValueError):
        return False, 'INVALID_INPUT'
    if not all(math.isfinite(value) for value in (x, z)):
        return False, 'NON_FINITE_INPUT'
    if abs(x) > 1 or abs(z) > 1:
        return False, 'INVALID_INPUT_RANGE'
    return True, 'OK'


def validate_transition(current_zone: str, requested_zone: str, debug: bool = False) -> tuple[bool, str]:
    if requested_zone not in ZONES:
        return False, 'INVALID_ZONE'
    if current_zone == requested_zone or debug or (current_zone, requested_zone) in TRANSITIONS:
        return True, 'OK'
    return False, 'INVALID_ZONE_TRANSITION'


def bounds_for(zone: str) -> float:
    return 110.0 if zone == 'city' else 22.0 if zone == 'hotel' else 12.0


def clamp_position(x: float, z: float, zone: str) -> tuple[float, float]:
    bound = bounds_for(zone)
    return max(-bound, min(bound, float(x))), max(-bound, min(bound, float(z)))
