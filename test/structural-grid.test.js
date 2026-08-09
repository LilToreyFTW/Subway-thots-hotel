import test from 'node:test';
import assert from 'node:assert/strict';
import { StructuralGrid } from '../src/world/StructuralGrid.js';

test('structural grid aligns footprints and preserves minimum spans', () => {
  const grid = new StructuralGrid(2);
  assert.deepEqual(grid.footprint({ x: 3.1, z: -5.2, width: 13.2, depth: 7.1, height: 9.4 }), { x: 4, z: -6, width: 14, depth: 8, height: 10 });
  assert.equal(grid.opening(.4), 1);
});
