import * as THREE from 'three';

/**
 * Keeps world-object discovery separate from the game-specific result of using
 * an object.  Systems can register any object that exposes a mode and label.
 */
export class InteractionSystem {
  constructor({ items = [], range = 3.15 } = {}) {
    this.items = items;
    this.range = range;
    this.current = null;
    this._worldPosition = new THREE.Vector3();
  }

  register(item) {
    this.items.push(item);
    return item;
  }

  unregister(item) {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
  }

  worldPosition(item) {
    if (item.object) return item.object.getWorldPosition(this._worldPosition);
    if (item.position) return this._worldPosition.copy(item.position);
    return this._worldPosition.set(0, 0, 0);
  }

  findNearest(playerPosition, mode) {
    let best = null;
    let bestDistance = this.range;
    for (const item of this.items) {
      if (item.mode !== mode || item.completed || item.active === false || item.enabled === false) continue;
      if (item.object && !item.object.visible) continue;
      const position = this.worldPosition(item);
      const distance = Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
    this.current = best ? { item: best, distance: bestDistance } : null;
    return this.current;
  }

  prompt(target = this.current) {
    return target ? `[E] ${target.item.label}` : '';
  }

  execute(handler, target = this.current) {
    if (!target) return false;
    handler(target.item, target);
    return true;
  }
}
