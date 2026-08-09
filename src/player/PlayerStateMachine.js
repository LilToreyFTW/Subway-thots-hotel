export class PlayerStateMachine {
  constructor() { this.state = 'idle'; }
  update({ moving, sprinting, airborne }) {
    const next = airborne ? 'fall' : moving ? (sprinting ? 'sprint' : 'walk') : 'idle';
    const changed = next !== this.state;
    this.state = next;
    return { state: next, changed };
  }
}
