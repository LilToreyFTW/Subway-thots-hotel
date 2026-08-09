export class PlayerStateMachine {
  constructor() { this.state = 'idle'; this.wasAirborne = false; this.landingTime = 0; }
  update({ moving, sprinting, airborne, verticalVelocity = 0, turning = false, delta = 0 }) {
    if (this.wasAirborne && !airborne) this.landingTime = .14;
    this.wasAirborne = airborne;
    this.landingTime = Math.max(0, this.landingTime - delta);
    const next = this.landingTime > 0 ? 'land' : airborne ? (verticalVelocity > 0 ? 'jump' : 'fall') : moving ? (sprinting ? 'sprint' : 'walk') : turning ? 'turn' : 'idle';
    const changed = next !== this.state;
    this.state = next;
    return { state: next, changed };
  }
}
