WEAPON_PRICES = {
    'velvet-9': 420, 'afterglow-45': 760, 'metro-smg': 980, 'nightline-carbine': 1550,
    'hotel-security-rifle': 2100, 'skyline-precision': 3450, 'velvet-minigun': 6200,
    'redline-rpg': 4800, 'pulse-emp': 1800, 'flash-charge': 650,
}


def purchase_weapon(player, key: str) -> tuple[bool, str, int]:
    weapon_key = str(key)[:80]
    price = WEAPON_PRICES.get(weapon_key)
    if price is None:
        return False, 'UNKNOWN_ITEM', 0
    if weapon_key in player.weapons:
        return True, 'ALREADY_OWNED', 0
    if player.money < price:
        return False, 'INSUFFICIENT_FUNDS', price
    player.money -= price
    player.weapons.add(weapon_key)
    return True, 'PURCHASED', price
