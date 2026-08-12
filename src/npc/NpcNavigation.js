export function createWaypointNavigator({ base = { x: 0, z: 0 }, waypoints = [] } = {}) {
  const points = waypoints.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.z)).map((point) => ({ x: point.x, z: point.z }));
  return { base: { x: base.x, z: base.z }, waypoints: points, index: 0, stuckTime: 0 };
}

function blocked(x, z, colliders, radius = 0.35) {
  return colliders.some((collider) => x > collider.minX - radius && x < collider.maxX + radius && z > collider.minZ - radius && z < collider.maxZ + radius);
}

export function advanceWaypointNavigator(navigator, position, delta, { colliders = [], speed = 1, radius = 0.35, bounds = null } = {}) {
  if (!navigator?.waypoints?.length) return { moving: false, target: navigator?.base || position };
  const target = navigator.waypoints[navigator.index % navigator.waypoints.length];
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.55) {
    navigator.index = (navigator.index + 1) % navigator.waypoints.length;
    navigator.stuckTime = 0;
    return { moving: false, target };
  }
  const step = Math.min(distance, Math.max(0, speed) * Math.max(0, delta));
  const nextX = position.x + (dx / distance) * step;
  const nextZ = position.z + (dz / distance) * step;
  const clampedX = bounds ? Math.max(bounds.minX, Math.min(bounds.maxX, nextX)) : nextX;
  const clampedZ = bounds ? Math.max(bounds.minZ, Math.min(bounds.maxZ, nextZ)) : nextZ;
  const canX = !blocked(clampedX, position.z, colliders, radius);
  const canZ = !blocked(position.x, clampedZ, colliders, radius);
  if (canX) position.x = clampedX;
  if (canZ) position.z = clampedZ;
  navigator.stuckTime = canX || canZ ? 0 : navigator.stuckTime + Math.max(0, delta);
  if (navigator.stuckTime > 1.2) {
    navigator.index = (navigator.index + 1) % navigator.waypoints.length;
    navigator.stuckTime = 0;
  }
  return { moving: canX || canZ, target };
}
