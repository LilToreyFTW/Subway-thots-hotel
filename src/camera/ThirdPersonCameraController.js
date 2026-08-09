import * as THREE from 'three';

export class ThirdPersonCameraController {
  constructor(camera, config) {
    this.camera = camera;
    this.config = config;
    this.yaw = Math.PI;
    this.pitch = 0.28;
    this.distance = config.distance;
    this.targetPosition = new THREE.Vector3();
    this.lookPosition = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
  }
  rotate(deltaX, deltaY) {
    this.yaw -= deltaX * this.config.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - deltaY * this.config.sensitivity * 0.68, this.config.minPitch, this.config.maxPitch);
  }
  zoom(delta) { this.distance = THREE.MathUtils.clamp(this.distance + delta * 0.01, this.config.minDistance, this.config.maxDistance); }
  update(player, delta, collisionObjects = []) {
    const horizontal = Math.cos(this.pitch);
    // Positive pitch puts the camera above the player. The prior sign was
    // inverted, which could place the camera below the ground when orbiting.
    const direction = new THREE.Vector3(Math.sin(this.yaw) * horizontal, -Math.sin(this.pitch), Math.cos(this.yaw) * horizontal);
    const head = this.lookPosition.set(player.position.x, player.position.y + this.config.targetHeight, player.position.z);
    const desired = this.targetPosition.copy(head).addScaledVector(direction, -this.distance);
    if (collisionObjects.length) {
      this.raycaster.set(head, desired.clone().sub(head).normalize());
      this.raycaster.far = this.distance;
      const hit = this.raycaster.intersectObjects(collisionObjects, true)[0];
      if (hit) desired.copy(head).addScaledVector(direction, -Math.max(0.55, hit.distance - 0.18));
    }
    this.camera.position.lerp(desired, 1 - Math.pow(this.config.smoothness, delta));
    this.camera.lookAt(head);
    return { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
  }
}
