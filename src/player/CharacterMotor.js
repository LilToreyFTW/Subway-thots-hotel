import * as THREE from 'three';

/** Gameplay-only capsule motor. The visible model can be replaced by any GLTF rig. */
export class CharacterMotor {
  constructor(config) {
    this.config = config;
    this.velocity = new THREE.Vector3();
    this.grounded = true;
  }

  step({ delta, direction, speed, jump }) {
    const targetX = direction.x * speed;
    const targetZ = direction.z * speed;
    const rate = direction.lengthSq() > 0 ? this.config.acceleration : this.config.deceleration;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetX, rate, delta);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetZ, rate, delta);
    if (jump && this.grounded) {
      this.velocity.y = this.config.jumpVelocity;
      this.grounded = false;
    }
    return new THREE.Vector3(this.velocity.x * delta, 0, this.velocity.z * delta);
  }

  land() { this.grounded = true; this.velocity.y = 0; }
  resolveVertical(currentY, groundY, delta) {
    // A surface may disappear under a grounded player (edge of a platform).
    if (this.grounded && currentY > groundY + .02) this.grounded = false;
    if (this.grounded) return groundY;
    this.velocity.y = Math.max(this.velocity.y - this.config.gravity * delta, -this.config.terminalFallSpeed);
    const nextY = currentY + this.velocity.y * delta;
    if (nextY <= groundY) {
      this.land();
      return groundY;
    }
    return nextY;
  }
  knockback(direction, force = 7.5) {
    this.velocity.x = direction.x * force;
    this.velocity.z = direction.z * force;
    this.velocity.y = Math.max(this.velocity.y, 3.2);
    this.grounded = false;
  }
}
