import test from 'node:test';
import assert from 'node:assert/strict';
import { HOTEL_DIRECTION, VENUE_CATALOG, WEAPON_CATALOG, getWeapon } from '../src/content/WorldContent.js';

test('weapon catalog covers the requested fictional equipment categories', () => {
  const categories = new Set(WEAPON_CATALOG.map((weapon) => weapon.category));
  for (const category of ['pistol', 'smg', 'ar', 'rifle', 'sniper', 'minigun', 'rpg', 'explosive', 'emp']) assert.ok(categories.has(category), category);
  assert.equal(getWeapon('pulse-emp').category, 'emp');
});

test('venue catalog contains the shop, adult club, distant bar, and hotel hosting spaces', () => {
  assert.deepEqual(new Set(VENUE_CATALOG.map((venue) => venue.type)), new Set(['gun-shop', 'adult-club', 'bar', 'hotel-hosting']));
});

test('hotel remodel direction preserves the existing room count', () => {
  assert.equal(HOTEL_DIRECTION.rooms, 50);
  assert.equal(HOTEL_DIRECTION.floors, 5);
});
