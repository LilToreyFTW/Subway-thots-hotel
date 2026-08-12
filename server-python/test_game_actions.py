from types import SimpleNamespace

from game_actions import apply_action


def player(**overrides):
    values = dict(money=100, reputation=12, home_room_id=7, needs={'energy': 100, 'hunger': 100, 'hygiene': 100}, job_step=0, task_count=0)
    values.update(overrides)
    return SimpleNamespace(**values)


def test_actions_are_server_authoritative_and_bounded():
    item = player()
    ok, reason, _ = apply_action(item, 'drink', zone='city')
    assert (ok, reason) == (True, 'DRINK_SERVED')
    assert item.money == 86 and item.needs['hunger'] == 100
    ok, reason, _ = apply_action(item, 'host', zone='room', room_id='7')
    assert (ok, reason) == (True, 'HOSTING_COMPLETE')
    assert item.money == 166 and item.reputation == 17
    assert apply_action(item, 'adult_club', zone='city')[0] is True


def test_actions_reject_wrong_zone_and_invalid_job_state():
    item = player(job_step=3)
    assert apply_action(item, 'drink', zone='hotel')[1] == 'WRONG_ZONE'
    assert apply_action(item, 'courier_drop', zone='city')[1] == 'INVALID_JOB_STATE'
