const ONE_SHOT_STATES = new Set(['land', 'interact', 'pickup', 'open-door', 'sit', 'stand', 'use-object', 'emote', 'dance', 'talk', 'climb']);

/**
 * Selects a semantic character state independently from the animation asset.
 * New rigs can supply clips for every state without changing movement code.
 */
export class PlayerStateMachine {
  constructor() {
    this.state = 'idle';
    this.wasAirborne = false;
    this.lockedState = null;
    this.lockTime = 0;
  }

  request(state, duration = .45) {
    if (!ONE_SHOT_STATES.has(state)) return false;
    this.lockedState = state;
    this.lockTime = duration;
    return true;
  }

  update({ moving, sprinting, airborne, verticalVelocity = 0, turnDirection = 0, delta = 0 }) {
    if (this.wasAirborne && !airborne) this.request('land', .18);
    this.wasAirborne = airborne;
    this.lockTime = Math.max(0, this.lockTime - delta);
    if (this.lockTime === 0) this.lockedState = null;

    const locomotion = airborne
      ? (verticalVelocity > .15 ? 'jump' : 'fall')
      : moving
        ? (sprinting ? 'sprint' : 'walk')
        : turnDirection < -.01 ? 'turn-left'
          : turnDirection > .01 ? 'turn-right'
            : 'idle';
    const next = this.lockedState || locomotion;
    const changed = next !== this.state;
    this.state = next;
    return { state: next, changed };
  }
}
