import test from 'node:test';
import assert from 'node:assert/strict';
import { MaterialCategory, MaterialLibrary } from '../src/rendering/MaterialLibrary.js';

test('material library returns shared PBR instances for matching definitions', () => {
  const library = new MaterialLibrary();
  const first = library.get(MaterialCategory.WOOD, 0x4a2f25);
  assert.equal(first, library.get(MaterialCategory.WOOD, 0x4a2f25));
  assert.notEqual(first, library.get(MaterialCategory.FABRIC, 0x4a2f25));
});
