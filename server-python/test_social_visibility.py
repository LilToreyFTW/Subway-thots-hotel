from dataclasses import dataclass

from social_visibility import can_share_presence


@dataclass
class Player:
    player_id: str
    zone: str
    room_id: str | None = None


def test_city_and_hotel_presence_is_shared_with_the_same_zone():
    assert can_share_presence(Player('a', 'city'), Player('b', 'city'))
    assert not can_share_presence(Player('a', 'city'), Player('b', 'hotel'))


def test_private_room_presence_requires_the_same_room():
    assert can_share_presence(Player('a', 'room', '12'), Player('b', 'room', '12'))
    assert not can_share_presence(Player('a', 'room', '12'), Player('b', 'room', '13'))
    assert not can_share_presence(Player('a', 'room', None), Player('b', 'room', '12'))
