import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiFloorPlan } from '../src/world/MultiFloorPlan.js';

test('multi-floor plan indexes aligned floor and ceiling elevations', () => {
  const plan = createMultiFloorPlan(19);
  assert.equal(plan.floorCount, 4);
  assert.equal(plan.alignedHeight, 16);
  assert.deepEqual(plan.floors[2], { index: 2, y: 8, ceilingY: 12 });
});
