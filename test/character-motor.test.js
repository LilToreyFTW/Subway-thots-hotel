import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterMotor } from '../src/player/CharacterMotor.js';

const config = { acceleration: 28, deceleration: 34, jumpVelocity: 6.4, gravity: 18, terminalFallSpeed: 22 };
const still = { x: 0, y: 0, z: 0, lengthSq: () => 0 };

test('motor applies delta-time gravity and lands with zero vertical velocity', () => {
  const motor = new CharacterMotor(config);
  motor.step({ delta: 1 / 60, direction: still, speed: 0, jump: true });
  const rising = motor.resolveVertical(0, 0, 1 / 60);
  assert.ok(rising > 0);
  assert.equal(motor.grounded, false);
  let height = rising;
  for (let i = 0; i < 240 && !motor.grounded; i++) height = motor.resolveVertical(height, 0, 1 / 60);
  assert.equal(height, 0);
  assert.equal(motor.grounded, true);
  assert.equal(motor.velocity.y, 0);
});
