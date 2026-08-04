import test from 'node:test';
import assert from 'node:assert/strict';
import { io as createClient } from 'socket.io-client';

import { createJoinToken } from '../src/auth.js';
import { createVoiceServer } from '../src/server.js';

function once(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

test('joins a lobby and relays state, signaling, and leave events only inside that lobby', async () => {
  const service = createVoiceServer({ host: '127.0.0.1', port: 0, corsOrigins: ['*'] });
  await service.start();
  const url = `http://127.0.0.1:${service.address().port}`;
  const a = createClient(url, { transports: ['websocket'], forceNew: true });
  const b = createClient(url, { transports: ['websocket'], forceNew: true });
  const outsider = createClient(url, { transports: ['websocket'], forceNew: true });

  try {
    await Promise.all([once(a, 'connect'), once(b, 'connect'), once(outsider, 'connect')]);
    assert.equal((await emitAck(a, 'lobby:join', { lobbyCode: 'PUBLIC', playerId: 'a', displayName: 'Alice' })).ok, true);
    const joined = once(a, 'player:joined');
    assert.equal((await emitAck(b, 'lobby:join', { lobbyCode: 'PUBLIC', playerId: 'b', displayName: 'Bob' })).ok, true);
    assert.equal((await joined).playerId, 'b');
    assert.equal((await emitAck(outsider, 'lobby:join', { lobbyCode: 'OTHER', playerId: 'x', displayName: 'X' })).ok, true);

    const statePromise = once(a, 'player:state');
    b.emit('player:state', { position: { x: 2, y: 0, z: 3 }, rotation: 1, zone: 'city', roomId: null });
    const state = await statePromise;
    assert.equal(state.playerId, 'b');
    assert.deepEqual(state.position, { x: 2, y: 0, z: 3 });

    const signalPromise = once(b, 'webrtc:signal');
    const signalAck = await emitAck(a, 'webrtc:signal', { targetId: b.id, signal: { description: { type: 'offer', sdp: 'v=0' } } });
    assert.equal(signalAck.ok, true);
    assert.equal((await signalPromise).fromId, a.id);

    const blocked = await emitAck(a, 'webrtc:signal', { targetId: outsider.id, signal: { description: { type: 'offer', sdp: 'v=0' } } });
    assert.equal(blocked.ok, false);

    const leftPromise = once(a, 'player:left');
    b.disconnect();
    assert.equal((await leftPromise).playerId, 'b');
  } finally {
    a.disconnect();
    b.disconnect();
    outsider.disconnect();
    await service.stop();
  }
});

test('production authentication rejects unsigned sockets and identity spoofing', async () => {
  const secret = 'production-test-secret-32-characters-minimum';
  const service = createVoiceServer({ host: '127.0.0.1', port: 0, corsOrigins: ['*'], authSecret: secret, allowAnonymous: false });
  await service.start();
  const url = `http://127.0.0.1:${service.address().port}`;
  const unsigned = createClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const token = createJoinToken({ playerId: 'verified-player', expiresAt: Math.floor(Date.now() / 1000) + 60 }, secret);
  const signed = createClient(url, { transports: ['websocket'], forceNew: true, reconnection: false, auth: { token } });
  try {
    const authError = await once(unsigned, 'connect_error');
    assert.match(authError.message, /authentication/i);
    await once(signed, 'connect');
    const spoof = await emitAck(signed, 'lobby:join', { lobbyCode: 'PUBLIC', playerId: 'somebody-else', displayName: 'Spoof' });
    assert.equal(spoof.ok, false);
    const valid = await emitAck(signed, 'lobby:join', { lobbyCode: 'PUBLIC', playerId: 'verified-player', displayName: 'Verified' });
    assert.equal(valid.ok, true);
  } finally {
    unsigned.disconnect();
    signed.disconnect();
    await service.stop();
  }
});
