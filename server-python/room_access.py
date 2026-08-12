"""Pure private-suite ownership and invitation rules."""


def can_enter(player, room_id: str) -> bool:
    return str(room_id) == str(player.home_room_id) or str(room_id) in player.room_access


def can_manage(player, room_id: str) -> bool:
    return str(room_id) == str(player.home_room_id)


def grant_access(player, room_id: str) -> bool:
    room_id = str(room_id)
    if room_id == str(player.home_room_id) or room_id in player.room_access:
        return False
    player.room_access.add(room_id)
    return True


def revoke_access(player, room_id: str) -> bool:
    room_id = str(room_id)
    if room_id not in player.room_access:
        return False
    player.room_access.remove(room_id)
    return True
