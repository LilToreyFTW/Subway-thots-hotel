import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWaypointNavigator, createWaypointNavigator } from '../src/npc/NpcNavigation.js';

test('waypoint navigator advances and cycles through deterministic points', () => {
  const navigator = createWaypointNavigator({ waypoints: [{ x: 2, z: 0 }, { x: 2, z: 2 }] });
  const position = { x: 0, z: 0 };
  const first = advanceWaypointNavigator(navigator, position, 1, { speed: 2 });
  assert.equal(first.moving, true);
  assert.equal(position.x, 2);
  advanceWaypointNavigator(navigator, position, 1, { speed: 2 });
  assert.equal(navigator.index, 1);
});

test('waypoint navigator slides around blocked axes and skips a stuck target', () => {
  const navigator = createWaypointNavigator({ waypoints: [{ x: 2, z: 0 }, { x: 0, z: 2 }] });
  const position = { x: 0, z: 0 };
  const collider = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  advanceWaypointNavigator(navigator, position, 0.5, { speed: 2, colliders: [collider] });
  assert.deepEqual(position, { x: 0, z: 0 });
  advanceWaypointNavigator(navigator, position, 1, { speed: 2, colliders: [collider] });
  advanceWaypointNavigator(navigator, position, 1, { speed: 2, colliders: [collider] });
  assert.equal(navigator.index, 1);
});
