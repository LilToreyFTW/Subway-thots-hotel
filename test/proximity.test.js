import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateProximityGain, canShareAudioSpace, isSpeakingLevel } from '../src/multiplayer/proximity.js';

test('proximity gain smoothly falls to zero at maximum distance', () => {
  assert.equal(calculateProximityGain(0, 25), 1);
  assert.equal(calculateProximityGain(25, 25), 0);
  assert.equal(calculateProximityGain(40, 25), 0);
  assert.ok(calculateProximityGain(5, 25) > calculateProximityGain(15, 25));
  assert.ok(calculateProximityGain(15, 25) > calculateProximityGain(24, 25));
});

test('speaking indicator applies a noise threshold', () => {
  assert.equal(isSpeakingLevel(0.01, 0.035), false);
  assert.equal(isSpeakingLevel(0.08, 0.035), true);
});

test('voice is isolated between zones and private rooms', () => {
  assert.equal(canShareAudioSpace({ zone: 'city' }, { zone: 'city' }), true);
  assert.equal(canShareAudioSpace({ zone: 'city' }, { zone: 'hotel' }), false);
  assert.equal(canShareAudioSpace({ zone: 'room', roomId: '12' }, { zone: 'room', roomId: '12' }), true);
  assert.equal(canShareAudioSpace({ zone: 'room', roomId: '12' }, { zone: 'room', roomId: '13' }), false);
});
