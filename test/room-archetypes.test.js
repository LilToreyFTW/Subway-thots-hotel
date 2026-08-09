import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomArchetypes, createRoomPlan } from '../src/world/RoomArchetypes.js';

test('hotel room plans always include their required props', () => {
  const plan = createRoomPlan(12);
  for (const prop of plan.archetype.requiredProps) assert.equal(plan.props.has(prop), true);
  assert.ok(plan.width >= plan.archetype.minimumSize.width);
  assert.equal(RoomArchetypes.VipSuite.doorRules.wall, 'south');
});
