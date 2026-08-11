import * as THREE from 'three';

export class RoadGraph {
  constructor({ positions = [-120, -72, -24, 24, 72, 120], laneOffset = 4.1, speedLimit = 13 } = {}) {
    this.nodes = new Map();
    this.edges = new Map();
    this.laneOffset = laneOffset;
    for (const x of positions) for (const z of positions) this.addNode(`${x}:${z}`, new THREE.Vector3(x, 0, z));
    for (const x of positions) for (const z of positions) {
      if (positions.includes(x + 48)) this.connect(`${x}:${z}`, `${x + 48}:${z}`);
      if (positions.includes(z + 48)) this.connect(`${x}:${z}`, `${x}:${z + 48}`);
    }
    this.speedLimit = speedLimit;
  }
  addNode(id, position) { this.nodes.set(id, { id, position: position.clone(), neighbors: [] }); this.edges.set(id, []); }
  connect(from, to, speed = this.speedLimit) {
    const a = this.nodes.get(from), b = this.nodes.get(to);
    if (!a || !b) return false;
    const length = a.position.distanceTo(b.position);
    this.edges.get(from).push({ from, to, length, speed });
    this.edges.get(to).push({ from: to, to: from, length, speed });
    a.neighbors.push(to); b.neighbors.push(from);
    return true;
  }
  nearest(position) {
    let best = null; let distance = Infinity;
    for (const node of this.nodes.values()) { const next = node.position.distanceToSquared(position); if (next < distance) { distance = next; best = node; } }
    return best;
  }
  route(fromPosition, toPosition) {
    const start = this.nearest(fromPosition), goal = this.nearest(toPosition);
    if (!start || !goal) return [];
    const frontier = [start.id]; const previous = new Map([[start.id, null]]);
    while (frontier.length) {
      const current = frontier.shift();
      if (current === goal.id) break;
      for (const edge of this.edges.get(current) || []) if (!previous.has(edge.to)) { previous.set(edge.to, current); frontier.push(edge.to); }
    }
    if (!previous.has(goal.id)) return [];
    const path = []; for (let current = goal.id; current; current = previous.get(current)) path.unshift(this.nodes.get(current).position.clone());
    return path;
  }
  toJSON() { return { nodes: [...this.nodes.values()].map(({ id, position }) => ({ id, position: position.toArray() })), edges: [...this.edges.values()].flat() }; }
}
