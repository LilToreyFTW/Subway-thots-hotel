from __future__ import annotations

import json
from pathlib import Path

BASE_VEHICLE_PRICES = {
    'violet-vandal': 18500, 'midnight-sedan': 26500, 'goldline-suv': 42000,
    'rose-runner': 58000, 'chrome-lowrider': 73500, 'blacktop-muscle': 89000,
}
UPGRADE_PRICES = {
    'engine': [4200, 9800, 18500], 'transmission': [3600, 8200, 15400],
    'turbo': [6500, 14200, 26000], 'brakes': [2400, 6200, 12800],
    'suspension': [3100, 7600, 15600], 'wheels': [2800, 6900, 13200],
}


def vehicle_prices() -> dict[str, int]:
    prices = dict(BASE_VEHICLE_PRICES)
    root = Path(__file__).resolve().parent.parent / 'assets' / 'manifests'
    for manifest in ('lamborghini', 'rolls-royce', 'chevrolet', 'ford'):
        try:
            vehicles = json.loads((root / f'{manifest}-vehicles.json').read_text(encoding='utf-8')).get('vehicles', [])
        except (OSError, ValueError, TypeError):
            continue
        for index, vehicle in enumerate(vehicles):
            category = 'SPORT' if vehicle.get('category') == 'performance' else str(vehicle.get('category', '')).upper()
            base = 92 if category == 'SPORT' else 68 if category == 'TRUCK' else 76 if category == 'SUV' else 64 if category == 'VAN' else 72
            prices[str(vehicle.get('id', ''))] = round((base * 1000 + index * 137) / 100) * 100
    return {key: value for key, value in prices.items() if key}


def purchase_vehicle(player, key: str) -> tuple[bool, str, int]:
    key = str(key)[:80]
    price = vehicle_prices().get(key)
    if price is None: return False, 'UNKNOWN_VEHICLE', 0
    if key in player.vehicles: return True, 'ALREADY_OWNED', 0
    if player.money < price: return False, 'INSUFFICIENT_FUNDS', price
    player.money -= price; player.vehicles.add(key)
    return True, 'PURCHASED', price


def upgrade_vehicle(player, vehicle_key: str, slot: str) -> tuple[bool, str, int]:
    vehicle_key, slot = str(vehicle_key)[:80], str(slot)[:40]
    if vehicle_key not in player.vehicles: return False, 'VEHICLE_NOT_OWNED', 0
    prices = UPGRADE_PRICES.get(slot)
    if not prices: return False, 'UNKNOWN_UPGRADE', 0
    current = int(player.upgrades.get(vehicle_key, {}).get(slot, 0))
    if current >= len(prices): return False, 'UPGRADE_MAXED', 0
    price = prices[current]
    if player.money < price: return False, 'INSUFFICIENT_FUNDS', price
    player.money -= price
    player.upgrades.setdefault(vehicle_key, {})[slot] = current + 1
    return True, 'UPGRADED', price
