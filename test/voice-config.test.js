import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveVoiceServerUrl } from '../src/multiplayer/voiceConfig.js';

test('uses the VPS voice gateway for HTTP builds', () => {
  assert.equal(resolveVoiceServerUrl({ protocol: 'http:', hostname: 'game.example' }), 'http://147.189.172.104:7077');
});

test('requires an explicit secure voice URL for HTTPS and desktop builds', () => {
  assert.equal(resolveVoiceServerUrl({ protocol: 'https:', hostname: 'game.example' }), null);
  assert.equal(resolveVoiceServerUrl({ protocol: 'sth:', hostname: 'game' }), null);
  assert.equal(resolveVoiceServerUrl({ protocol: 'https:', hostname: 'game.example', configuredUrl: 'wss://voice.example' }), 'wss://voice.example');
});

test('allows query overrides only for local development', () => {
  assert.equal(resolveVoiceServerUrl({ protocol: 'http:', hostname: 'localhost', queryOverride: 'http://127.0.0.1:7077' }), 'http://127.0.0.1:7077');
  assert.equal(resolveVoiceServerUrl({ protocol: 'http:', hostname: 'game.example', queryOverride: 'https://evil.example' }), 'http://147.189.172.104:7077');
});
