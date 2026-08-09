import * as THREE from 'three';

/** Dev-only helpers: created only when a matching debug query flag is enabled. */
export class DebugVisuals {
  constructor(scene, flags, { radius, height }) {
    this.flags = flags;
    this.root = new THREE.Group(); this.root.name = 'debug-visuals'; scene.add(this.root);
    const collisionMaterial = new THREE.LineBasicMaterial({ color: 0xff5b7f });
    if (flags.collisions || flags.player) {
      const capsule = new THREE.Group();
      capsule.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(radius, radius, Math.max(.01, height - radius * 2), 12)), collisionMaterial));
      capsule.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(radius, 12, 8)), collisionMaterial));
      capsule.children[1].position.y = height - radius;
      this.capsule = capsule; this.root.add(capsule);
    }
    if (flags.player || flags.raycasts) {
      this.groundRay = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 2, 0x6ee7ff);
      this.movement = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.01, 0x69e399);
      this.root.add(this.groundRay, this.movement);
    }
    if (flags.camera) {
      this.cameraLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffd86b }));
      this.root.add(this.cameraLine);
    }
  }
  update({ player, camera, direction, floor }) {
    if (this.capsule) this.capsule.position.copy(player.position);
    if (this.groundRay) this.groundRay.position.copy(player.position).add(new THREE.Vector3(0, 1.8, 0));
    if (this.movement) { this.movement.position.copy(player.position).add(new THREE.Vector3(0, .1, 0)); this.movement.setDirection(direction.lengthSq() ? direction.clone().normalize() : new THREE.Vector3(0, 0, 1)); this.movement.setLength(Math.min(2, direction.length() * 8)); }
    if (this.cameraLine) this.cameraLine.geometry.setFromPoints([player.position.clone().add(new THREE.Vector3(0, 1.4, 0)), camera.position]);
    if (floor !== null && this.groundRay) this.groundRay.setLength(Math.max(.2, player.position.y + 1.8 - floor));
  }
}
