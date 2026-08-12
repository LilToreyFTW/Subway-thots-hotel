import json

from dataclasses import dataclass, field

from profile_state import profile_snapshot


@dataclass
class Player:
    money: int = 0
    reputation: int = 0
    weapons: set[str] = field(default_factory=set)
    vehicles: set[str] = field(default_factory=set)
    room_layout: dict = field(default_factory=dict)


def test_profile_snapshot_exposes_authoritative_progression_only():
    player = Player(
        money=1250, reputation=31, weapons={'velvet-9'},
        vehicles={'violet-vandal'}, room_layout={'theme': 'teal'},
    )
    assert profile_snapshot(player) == {
        'cash': 1250, 'reputation': 31,
        'weapons': ['velvet-9'], 'vehicles': ['violet-vandal'],
        'roomLayout': {'theme': 'teal'},
    }


def test_profile_snapshot_never_returns_negative_cash():
    player = Player(money=-50)
    assert profile_snapshot(player)['cash'] == 0
