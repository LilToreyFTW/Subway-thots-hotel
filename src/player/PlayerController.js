import { CharacterMotor } from './CharacterMotor.js';
import { PlayerStateMachine } from './PlayerStateMachine.js';
import { PlayerAnimationController } from './PlayerAnimationController.js';

export class PlayerController {
  constructor(config, model) {
    this.motor = new CharacterMotor(config);
    this.stateMachine = new PlayerStateMachine();
    this.animations = new PlayerAnimationController(model);
  }
  step(input) { return this.motor.step(input); }
  land() { this.motor.land(); }
  updateVisual(delta, movement) {
    const state = this.stateMachine.update({ ...movement, verticalVelocity: this.motor.velocity.y, delta });
    this.animations.update(delta, state.state);
    return state;
  }
}
