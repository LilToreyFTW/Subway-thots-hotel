from types import SimpleNamespace

from economy import purchase_weapon


def test_weapon_purchase_uses_server_price_and_persists_ownership():
    player = SimpleNamespace(money=500, weapons=set())
    assert purchase_weapon(player, 'velvet-9') == (True, 'PURCHASED', 420)
    assert player.money == 80
    assert player.weapons == {'velvet-9'}


def test_weapon_purchase_rejects_unknown_and_insufficient_funds():
    poor = SimpleNamespace(money=10, weapons=set())
    assert purchase_weapon(poor, 'velvet-9')[0] is False
    assert purchase_weapon(poor, 'money-hack')[1] == 'UNKNOWN_ITEM'
