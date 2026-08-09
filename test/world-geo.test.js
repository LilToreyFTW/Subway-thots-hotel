import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../src/core/SeededRandom.js';
import { GeoCoordinateSystem } from '../src/world/GeoCoordinateSystem.js';

test('seeded world generation is deterministic', () => {
  const first = new SeededRandom(843102);
  const second = new SeededRandom(843102);
  assert.deepEqual(Array.from({ length: 8 }, () => first.next()), Array.from({ length: 8 }, () => second.next()));
});

test('WGS84 local coordinates round-trip near the region origin', () => {
  const geo = new GeoCoordinateSystem({ latitude: 47.6086, longitude: -122.3354, altitude: 12 });
  const local = geo.toLocal({ latitude: 47.6091, longitude: -122.3347, altitude: 19 });
  const roundTrip = geo.toGeographic(local);
  assert.ok(Math.abs(roundTrip.latitude - 47.6091) < 0.000001);
  assert.ok(Math.abs(roundTrip.longitude - -122.3347) < 0.000001);
  assert.equal(roundTrip.altitude, 19);
});
