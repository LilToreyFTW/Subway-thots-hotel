from types import SimpleNamespace

from vehicle_economy import purchase_vehicle, upgrade_vehicle


def test_vehicle_purchase_and_upgrade_are_server_priced():
    player = SimpleNamespace(money=25000, vehicles=set(), upgrades={})
    assert purchase_vehicle(player, 'violet-vandal') == (True, 'PURCHASED', 18500)
    assert upgrade_vehicle(player, 'violet-vandal', 'engine') == (True, 'UPGRADED', 4200)
    assert player.upgrades['violet-vandal']['engine'] == 1


def test_vehicle_economy_rejects_unowned_or_unknown_items():
    player = SimpleNamespace(money=100000, vehicles=set(), upgrades={})
    assert purchase_vehicle(player, 'not-a-car')[1] == 'UNKNOWN_VEHICLE'
    assert upgrade_vehicle(player, 'violet-vandal', 'engine')[1] == 'VEHICLE_NOT_OWNED'
