"""Deterministic world-clock activity for venues and named NPC routines."""
from __future__ import annotations

from datetime import datetime, timezone

VENUE_SCHEDULES = {
    'neon-arsenal': (10 * 60, 2 * 60),
    'diamond-lane-motors': (9 * 60, 23 * 60),
    'blacktop-customs': (9 * 60, 1 * 60),
    'velvet-stage': (18 * 60, 4 * 60),
    'midnight-mile': (20 * 60, 6 * 60),
    'hotel-hosting': (0, 24 * 60),
}

NPC_VENUES = {
    'Elena': 'velvet-stage', 'Maya': 'velvet-stage', 'Jules': 'blacktop-customs',
    'Naomi': 'velvet-stage', 'Camille': 'hotel-hosting', 'Ari': 'hotel-hosting',
    'Vivian': 'midnight-mile', 'Tess': 'midnight-mile', 'Sloane': 'midnight-mile',
    'Raina': 'velvet-stage', 'Kiara': 'velvet-stage', 'Sabrina': 'velvet-stage',
    'Zara': 'midnight-mile', 'Nia': 'midnight-mile', 'Lola': 'velvet-stage',
    'Brielle': 'hotel-hosting', 'Milan': 'hotel-hosting', 'Avery': 'hotel-hosting',
    'Dahlia': 'hotel-hosting', 'Monique': 'hotel-hosting', 'Iris': 'hotel-hosting',
    'Roxy': 'velvet-stage', 'Selene': 'hotel-hosting', 'Jade': 'hotel-hosting',
    'Mia': 'velvet-stage', 'Nyla': 'velvet-stage', 'Carmen': 'hotel-hosting',
    'Raven': 'midnight-mile',
}


def is_open(minutes: int, opening: int, closing: int) -> bool:
    minutes %= 1440
    if opening == closing:
        return True
    return opening <= minutes < closing if opening < closing else minutes >= opening or minutes < closing


def current_world_minutes(now: datetime | None = None) -> int:
    moment = now or datetime.now(timezone.utc)
    return moment.hour * 60 + moment.minute


def venue_activity(minutes: int) -> dict[str, dict[str, object]]:
    result = {}
    for key, (opening, closing) in VENUE_SCHEDULES.items():
        open_now = is_open(minutes, opening, closing)
        result[key] = {
            'open': open_now,
            'state': 'open' if open_now else 'closed',
            'crowdLevel': (0.35 + ((minutes * 7 + len(key) * 13) % 45) / 100) if open_now else 0.0,
            'openingMinute': opening,
            'closingMinute': closing,
        }
    return result


def npc_activity(minutes: int) -> dict[str, dict[str, object]]:
    venues = venue_activity(minutes)
    result = {}
    for name, venue_key in NPC_VENUES.items():
        venue = venues[venue_key]
        result[name] = {
            'venueKey': venue_key,
            'state': 'working' if venue['open'] else 'resting',
            'available': bool(venue['open']),
        }
    return result


def world_activity_snapshot(now: datetime | None = None) -> dict[str, object]:
    minutes = current_world_minutes(now)
    return {'minuteOfDay': minutes, 'venues': venue_activity(minutes), 'npcs': npc_activity(minutes)}
