import * as THREE from 'three';

export const VehicleState = Object.freeze({ PARKED: 'PARKED', ENTERING: 'ENTERING', DRIVING: 'DRIVING', EXITING: 'EXITING' });

export class VehicleController {
  constructor({ vehicle, stats = {}, dimensions = {} } = {}) {
    this.vehicle = vehicle;
    this.state = VehicleState.PARKED;
    this.speed = 0;
    this.heading = vehicle?.rotation?.y || 0;
    this.steering = 0;
    this.stats = { topSpeed: stats.topSpeed ?? 72, acceleration: stats.acceleration ?? 70, handling: stats.handling ?? 65 };
    this.dimensions = { length: dimensions.length ?? 4.6, width: dimensions.width ?? 1.9, height: dimensions.height ?? 1.5 };
    this.velocity = new THREE.Vector3();
    this.wheelNodes = [];
  }
  enter() { if (this.state !== VehicleState.PARKED) return false; this.state = VehicleState.ENTERING; return true; }
  completeEntry() { if (this.state !== VehicleState.ENTERING) return false; this.state = VehicleState.DRIVING; return true; }
  exit() { if (this.state !== VehicleState.DRIVING) return false; this.state = VehicleState.EXITING; return true; }
  completeExit() { if (this.state !== VehicleState.EXITING) return false; this.speed = 0; this.velocity.set(0, 0, 0); this.state = VehicleState.PARKED; return true; }
  update(input = {}, delta = 1 / 60) {
    if (this.state !== VehicleState.DRIVING || !this.vehicle) return { state: this.state, speed: this.speed, steering: this.steering };
    const throttle = THREE.MathUtils.clamp(Number(input.throttle || 0), -1, 1);
    const brake = THREE.MathUtils.clamp(Number(input.brake || 0), 0, 1);
    const steer = THREE.MathUtils.clamp(Number(input.steer || 0), -1, 1);
    const maxSpeed = this.stats.topSpeed / 3.6;
    const accel = this.stats.acceleration / 18;
    const resistance = 1.25 + Math.abs(this.speed) * .11;
    this.speed += throttle * accel * delta;
    if (brake > 0 || throttle === 0) this.speed -= Math.sign(this.speed) * (brake * 16 + resistance) * delta;
    this.speed = THREE.MathUtils.clamp(this.speed, -maxSpeed * .35, maxSpeed);
    this.steering = THREE.MathUtils.damp(this.steering, steer, 7, delta);
    const grip = THREE.MathUtils.clamp(this.stats.handling / 100, .35, 1);
    this.heading += this.steering * grip * (this.speed / Math.max(4, maxSpeed)) * 2.4 * delta;
    this.vehicle.rotation.y = this.heading;
    this.velocity.set(Math.sin(this.heading) * this.speed, 0, Math.cos(this.heading) * this.speed);
    this.vehicle.position.addScaledVector(this.velocity, delta);
    for (const wheel of this.wheelNodes) wheel.rotation.y = this.steering * .42;
    return { state: this.state, speed: this.speed, steering: this.steering, velocity: this.velocity.clone() };
  }
}
