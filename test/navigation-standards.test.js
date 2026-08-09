import test from 'node:test';
import assert from 'node:assert/strict';
import { hasWalkableOpening, validatePlacement } from '../src/world/NavigationStandards.js';
import { SeededRandom } from '../src/core/SeededRandom.js';

test('navigation standards reject undersized doorways and overlapping placements', () => {
  assert.equal(hasWalkableOpening(1.2, 2.45), true);
  assert.equal(hasWalkableOpening(1.1, 2.45), false);
  assert.equal(validatePlacement({ minX: 2, maxX: 3, minZ: 2, maxZ: 3 }, [{ minX: 0, maxX: 2.9, minZ: 0, maxZ: 3 }]), false);
});

test('weighted seeded choices are deterministic', () => {
  const one = new SeededRandom(582193);
  const two = new SeededRandom(582193);
  const options = [{ value: 'small', weight: 5 }, { value: 'large', weight: 1 }];
  assert.deepEqual(Array.from({ length: 8 }, () => one.weighted(options)), Array.from({ length: 8 }, () => two.weighted(options)));
});
