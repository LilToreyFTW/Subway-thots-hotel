import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOTEL_DIRECTION, VENUE_CATALOG, WEAPON_CATALOG, getWeapon } from '../src/content/WorldContent.js';
import { CAMO_CATALOG, getCamo } from '../src/content/CamoCatalog.js';
import { VEHICLE_CATALOG, VEHICLE_UPGRADES, getVehicle } from '../src/content/VehicleCatalog.js';

test('weapon catalog covers the requested fictional equipment categories', () => {
  const categories = new Set(WEAPON_CATALOG.map((weapon) => weapon.category));
  for (const category of ['pistol', 'smg', 'ar', 'rifle', 'sniper', 'minigun', 'rpg', 'explosive', 'emp']) assert.ok(categories.has(category), category);
  assert.equal(getWeapon('pulse-emp').category, 'emp');
});

test('venue catalog contains the shop, adult club, distant bar, and hotel hosting spaces', () => {
  assert.deepEqual(new Set(VENUE_CATALOG.map((venue) => venue.type)), new Set(['gun-shop', 'car-dealership', 'car-mod-shop', 'adult-club', 'bar', 'hotel-hosting']));
});

test('vehicle catalog and upgrade systems cover the dealership and mod shop loop', () => {
  assert.equal(VEHICLE_CATALOG.length, 6);
  assert.equal(getVehicle('rose-runner').class, 'SPORT');
  assert.deepEqual(Object.keys(VEHICLE_UPGRADES), ['engine', 'transmission', 'turbo', 'brakes', 'suspension', 'wheels']);
  for (const upgrade of Object.values(VEHICLE_UPGRADES)) assert.equal(upgrade.levels.length, 3);
});

test('hotel remodel direction preserves the existing room count', () => {
  assert.equal(HOTEL_DIRECTION.rooms, 50);
  assert.equal(HOTEL_DIRECTION.floors, 5);
});

test('every weapon can use the full set of 40 animated camo gradients', () => {
  assert.equal(CAMO_CATALOG.length, 40);
  assert.equal(new Set(CAMO_CATALOG.map((camo) => camo.key)).size, 40);
  assert.equal(getCamo('camo-40').name, 'Black Rose');
  for (const weapon of WEAPON_CATALOG) assert.ok(CAMO_CATALOG.every((camo) => camo.pattern && camo.speed > 0), weapon.key);
});

test('standalone weapon model pack contains valid GLB headers', () => {
  for (const category of ['pistol', 'smg', 'ar', 'rifle', 'sniper', 'shotgun', 'minigun', 'rpg', 'emp', 'explosive']) {
    const header = readFileSync(`public/assets/models/weapons/${category}.glb`).subarray(0, 4).toString('ascii');
    assert.equal(header, 'glTF', category);
  }
});

test('venue model pack contains valid GLB headers', () => {
  for (const name of ['luxury-hotel-lobby', 'hotel-suite-hosting', 'neon-arsenal-shop', 'velvet-stage-club', 'midnight-mile-bar-28']) {
    const header = readFileSync(`public/assets/models/venues/${name}.glb`).subarray(0, 4).toString('ascii');
    assert.equal(header, 'glTF', name);
  }
});
