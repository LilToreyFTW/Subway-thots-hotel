import test from 'node:test';
import assert from 'node:assert/strict';

import { InteractionSystem } from '../src/interaction/InteractionSystem.js';

test('interaction system chooses the closest enabled target in the active mode', () => {
  const items = [
    { mode: 'city', label: 'Far vending machine', position: { x: 2.8, y: 0, z: 0 } },
    { mode: 'city', label: 'Nearby door', position: { x: 1.2, y: 0, z: 0 } },
    { mode: 'hotel', label: 'Reception', position: { x: 0.4, y: 0, z: 0 } },
    { mode: 'city', label: 'Inactive light', position: { x: 0.2, y: 0, z: 0 }, active: false },
  ];
  const system = new InteractionSystem({ items, range: 3 });
  const target = system.findNearest({ x: 0, y: 0, z: 0 }, 'city');

  assert.equal(target.item.label, 'Nearby door');
  assert.equal(system.prompt(), '[E] Nearby door');
});

test('interaction system only executes a resolved target', () => {
  const system = new InteractionSystem();
  assert.equal(system.execute(() => assert.fail('must not execute')), false);
  system.register({ mode: 'city', label: 'Light switch', position: { x: 0, y: 0, z: 0 } });
  system.findNearest({ x: 0, y: 0, z: 0 }, 'city');
  let label = '';
  assert.equal(system.execute((item) => { label = item.label; }), true);
  assert.equal(label, 'Light switch');
});
