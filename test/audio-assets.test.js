import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const assets = ['car-idle', 'car-acceleration', 'traffic-loop', 'city-night-loop', 'player-footstep', 'player-breath', 'player-effort', 'npc-greeting-a', 'npc-greeting-b', 'npc-chatter-loop'];

test('generated game audio assets are valid non-empty PCM WAV files', () => {
  for (const name of assets) {
    const path = `public/assets/audio/${name}.wav`;
    const header = readFileSync(path).subarray(0, 12);
    assert.equal(header.subarray(0, 4).toString('ascii'), 'RIFF', name);
    assert.equal(header.subarray(8, 12).toString('ascii'), 'WAVE', name);
    assert.ok(statSync(path).size > 20000, name);
  }
});

test('generated weapon models contain production-detail geometry', () => {
  const categories = ['pistol', 'smg', 'ar', 'rifle', 'sniper', 'minigun', 'rpg', 'emp', 'explosive', 'shotgun'];
  for (const category of categories) {
    const path = `public/assets/models/weapons/${category}.glb`;
    const model = readFileSync(path);
    assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF', category);
    assert.ok(statSync(path).size > 150000, `${category}.glb is missing detailed geometry`);
  }
});
