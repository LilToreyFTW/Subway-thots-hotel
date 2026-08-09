/** Lightweight capsule-footprint collision: independent of rendered meshes. */
export class CapsuleCollisionWorld {
  constructor({ radius = .32, height = 1.78, stepHeight = .42 } = {}) {
    this.radius = radius;
    this.height = height;
    this.stepHeight = stepHeight;
  }

  overlaps(x, z, collider) {
    return x > collider.minX - this.radius && x < collider.maxX + this.radius
      && z > collider.minZ - this.radius && z < collider.maxZ + this.radius;
  }

  move(position, dx, dz, colliders) {
    let x = position.x;
    let z = position.z;
    let hit = false;
    const tryAxis = (axis, amount) => {
      const candidateX = axis === 'x' ? x + amount : x;
      const candidateZ = axis === 'z' ? z + amount : z;
      if (colliders.some((collider) => this.overlaps(candidateX, candidateZ, collider))) { hit = true; return; }
      x = candidateX;
      z = candidateZ;
    };
    // Resolve axes independently: the capsule slides along walls instead of sticking.
    tryAxis('x', dx);
    tryAxis('z', dz);
    return { x, z, hit };
  }

  groundHeightAt(x, z, surfaces = []) {
    let height = 0;
    for (const surface of surfaces) {
      if (x >= surface.minX && x <= surface.maxX && z >= surface.minZ && z <= surface.maxZ) height = Math.max(height, surface.height);
    }
    return height;
  }
}
