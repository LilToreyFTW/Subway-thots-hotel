import * as THREE from 'three';

/** Downward ray probe used to validate capsule contact with marked walkable floors. */
export class GroundProbe {
  constructor({ radius = .32, maxDistance = 36, snapDistance = .1 } = {}) {
    this.radius = radius;
    this.maxDistance = maxDistance;
    this.snapDistance = snapDistance;
    this.raycaster = new THREE.Raycaster();
    this.origin = new THREE.Vector3();
    this.down = new THREE.Vector3(0, -1, 0);
  }

  probe(position, floors) {
    if (!floors.length) return null;
    this.origin.set(position.x, position.y + this.radius + this.snapDistance, position.z);
    this.raycaster.set(this.origin, this.down);
    this.raycaster.far = this.maxDistance;
    const hit = this.raycaster.intersectObjects(floors, false)[0];
    return hit ? hit.point.y : null;
  }
}
