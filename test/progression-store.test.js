import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgression, saveProgression, PROGRESSION_STORAGE_KEY } from '../src/core/ProgressionStore.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('progression survives reload and is bounded to safe integers', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadProgression(storage, { cash: 420, reputation: 12 }), { cash: 420, reputation: 12 });
  saveProgression(storage, { cash: 1850.9, reputation: 27.8 });
  assert.deepEqual(loadProgression(storage), { cash: 1850, reputation: 27 });
  assert.equal(storage.getItem(PROGRESSION_STORAGE_KEY) !== null, true);
});

test('malformed or negative progression cannot create currency', () => {
  const storage = memoryStorage();
  storage.setItem(PROGRESSION_STORAGE_KEY, '{"cash":-50,"reputation":"not-a-number"}');
  assert.deepEqual(loadProgression(storage, { cash: 240, reputation: 12 }), { cash: 0, reputation: 12 });
});
