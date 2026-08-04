import test from 'node:test';
import assert from 'node:assert/strict';

import { createJoinToken, verifyJoinToken } from '../src/auth.js';

test('signed join token binds a player identity and expiration', () => {
  const secret = 'test-secret-at-least-32-characters-long';
  const token = createJoinToken({ playerId: 'player-123', expiresAt: 2_000_000_000 }, secret);
  assert.equal(verifyJoinToken(token, secret, 1_900_000_000), 'player-123');
  assert.equal(verifyJoinToken(token, secret, 2_100_000_000), null);
  assert.equal(verifyJoinToken(`${token}tampered`, secret, 1_900_000_000), null);
});
