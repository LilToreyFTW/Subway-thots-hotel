from __future__ import annotations


def _needs(player):
    current = getattr(player, 'needs', None)
    if not isinstance(current, dict):
        current = {'energy': 100, 'hunger': 100, 'hygiene': 100}
        player.needs = current
    for key in ('energy', 'hunger', 'hygiene'):
        current[key] = max(0, min(100, int(current.get(key, 100))))
    return current


def _bounded_needs(player):
    current = _needs(player)
    for key in current:
        current[key] = max(0, min(100, int(current[key])))


def apply_action(player, action: str, *, zone: str, room_id: str | None = None, role: str = 'guest') -> tuple[bool, str, dict]:
    action = str(action)[:40]
    needs = _needs(player)
    if action == 'drink':
        if zone != 'city': return False, 'WRONG_ZONE', {}
        if player.money < 14: return False, 'INSUFFICIENT_FUNDS', {}
        player.money -= 14; player.reputation += 1; needs['hunger'] += 8; _bounded_needs(player)
        return True, 'DRINK_SERVED', {'cashDelta': -14, 'reputationDelta': 1}
    if action == 'meal':
        if zone != 'city': return False, 'WRONG_ZONE', {}
        if player.money < 18: return False, 'INSUFFICIENT_FUNDS', {}
        player.money -= 18; needs['hunger'] += 46; _bounded_needs(player)
        return True, 'MEAL_SERVED', {'cashDelta': -18}
    if action == 'host':
        if zone != 'room' or str(room_id) != str(player.home_room_id): return False, 'ROOM_PERMISSION_DENIED', {}
        if role != 'guest': return False, 'ROLE_NOT_ALLOWED', {}
        player.money += 80; player.reputation += 4
        return True, 'HOSTING_COMPLETE', {'cashDelta': 80, 'reputationDelta': 4}
    if action == 'adult_club':
        if zone != 'city': return False, 'WRONG_ZONE', {}
        player.reputation += 1
        return True, 'VENUE_VISITED', {'reputationDelta': 1}
    if action == 'courier_drop':
        if zone != 'city' or player.job_step not in (0, 1, 2): return False, 'INVALID_JOB_STATE', {}
        player.job_step += 1; player.money += 20; player.reputation += 1; needs['energy'] -= 6; _bounded_needs(player)
        if player.job_step == 3:
            player.money += 60; player.reputation += 5; player.job_step = 0
            return True, 'COURIER_COMPLETE', {'cashDelta': 80, 'reputationDelta': 6}
        return True, 'COURIER_DROP', {'cashDelta': 20, 'reputationDelta': 1}
    if action == 'inspect_task':
        if zone != 'hotel' or role != 'manager' or player.task_count >= 3: return False, 'INVALID_INSPECTION_STATE', {}
        player.task_count += 1; player.money += 30; player.reputation += 2
        return True, 'INSPECTION_TASK_COMPLETE', {'cashDelta': 30, 'reputationDelta': 2}
    if action == 'inspect_suite':
        if zone != 'room' or role != 'manager' or player.task_count >= 3: return False, 'INVALID_INSPECTION_STATE', {}
        player.task_count = 3; player.money += 45
        return True, 'SUITE_INSPECTED', {'cashDelta': 45}
    if action == 'sleep':
        if zone != 'room': return False, 'WRONG_ZONE', {}
        player.money += 60; player.reputation += 3; needs['energy'] = 100; needs['hygiene'] += 45; _bounded_needs(player)
        return True, 'REST_COMPLETE', {'cashDelta': 60, 'reputationDelta': 3}
    if action == 'front_desk_review':
        if zone != 'hotel' or role != 'manager': return False, 'ROLE_NOT_ALLOWED', {}
        player.money += 35; player.reputation += 1
        return True, 'FRONT_DESK_REVIEWED', {'cashDelta': 35, 'reputationDelta': 1}
    if action == 'check_in':
        if zone != 'hotel' or role != 'guest': return False, 'ROLE_NOT_ALLOWED', {}
        if player.money < 40: return False, 'INSUFFICIENT_FUNDS', {}
        player.money -= 40
        return True, 'CHECKED_IN', {'cashDelta': -40}
    return False, 'UNKNOWN_ACTION', {}
