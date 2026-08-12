import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_DECORATION_CATALOG, normalizeRoomLayout } from '../src/world/RoomDecorationCatalog.js';

test('room decoration catalog is explicit and bounded', () => {
  assert.ok(ROOM_DECORATION_CATALOG.some((item) => item.type === 'bar'));
  const layout = normalizeRoomLayout({ items: [{ id: 'lamp', type: 'lamp', x: 99, y: -1, z: 0, rotation: 0, scale: 9 }, { type: 'script' }] });
  assert.deepEqual(layout.items[0], { id: 'lamp', type: 'lamp', x: 8.1, y: 0, z: 0, rotation: 0, scale: 2 });
  assert.equal(layout.items.length, 1);
});
