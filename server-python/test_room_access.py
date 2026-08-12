from dataclasses import dataclass, field

from room_access import can_enter, can_manage, grant_access, revoke_access


@dataclass
class Player:
    home_room_id: int = 12
    room_access: set[str] = field(default_factory=set)


def test_owner_can_manage_and_enter_home_suite():
    player = Player()
    assert can_manage(player, '12')
    assert can_enter(player, '12')
    assert not can_manage(player, '13')


def test_invite_grants_and_revokes_private_access():
    player = Player()
    assert grant_access(player, '13')
    assert can_enter(player, '13')
    assert revoke_access(player, '13')
    assert not can_enter(player, '13')
