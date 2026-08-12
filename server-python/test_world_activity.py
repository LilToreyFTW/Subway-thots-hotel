from datetime import datetime, timezone

from world_activity import is_open, world_activity_snapshot


def test_cross_midnight_schedule_is_open_on_both_sides_of_midnight():
    assert is_open(23 * 60, 20 * 60, 6 * 60)
    assert is_open(2 * 60, 20 * 60, 6 * 60)
    assert not is_open(8 * 60, 20 * 60, 6 * 60)


def test_activity_snapshot_is_deterministic_for_a_world_time():
    now = datetime(2026, 8, 12, 22, 30, tzinfo=timezone.utc)
    first = world_activity_snapshot(now)
    second = world_activity_snapshot(now)
    assert first == second
    assert first['venues']['velvet-stage']['open'] is True
    assert first['venues']['midnight-mile']['open'] is True
    assert first['npcs']['Elena']['state'] == 'working'
