import test from 'node:test';
import assert from 'node:assert/strict';
import { GameConfig } from '../src/config/GameConfig.js';

test('central config provides performance and generation controls', () => {
  assert.ok(GameConfig.player.sprintSpeed > GameConfig.player.walkSpeed);
  assert.equal(GameConfig.rendering.maxPixelRatio, 2);
  assert.ok(GameConfig.world.roomDensity > 0 && GameConfig.world.propDensity > 0);
});
