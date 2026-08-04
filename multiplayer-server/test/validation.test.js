import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeLobbyCode, normalizeLobbySize, validatePlayerState, validateSignal } from '../src/validation.js';

test('normalizes safe lobby codes', () => {
  assert.equal(normalizeLobbyCode(' hotel-lobby '), 'HOTEL-LOBBY');
  assert.equal(normalizeLobbyCode(''), 'PUBLIC');
  assert.throws(() => normalizeLobbyCode('../bad-room'));
});

test('normalizes lobby capacity to a finite safe range', () => {
  assert.equal(normalizeLobbySize('invalid'), 16);
  assert.equal(normalizeLobbySize(1), 2);
  assert.equal(normalizeLobbySize(100), 32);
  assert.equal(normalizeLobbySize('12'), 12);
});

test('accepts bounded finite player state and rejects invalid state', () => {
  assert.deepEqual(validatePlayerState({
    position: { x: 12.5, y: 1, z: -4 },
    rotation: 1.2,
    zone: 'hotel',
    roomId: null,
  }), {
    position: { x: 12.5, y: 1, z: -4 },
    rotation: 1.2,
    zone: 'hotel',
    roomId: null,
  });
  assert.equal(validatePlayerState({ position: { x: NaN, y: 0, z: 0 }, rotation: 0 }), null);
  assert.equal(validatePlayerState({ position: { x: 0, y: 0, z: 0 }, rotation: Infinity }), null);
});

test('accepts only bounded WebRTC descriptions or ICE candidates', () => {
  assert.equal(validateSignal({ description: { type: 'offer', sdp: 'v=0' } }), true);
  assert.equal(validateSignal({ candidate: { candidate: 'candidate:1', sdpMid: '0' } }), true);
  assert.equal(validateSignal({ arbitrary: 'payload' }), false);
  assert.equal(validateSignal({ description: { type: 'offer', sdp: 'x'.repeat(70_000) } }), false);
});
