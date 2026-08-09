// Deterministic random source: identical region id + chunk coordinate gives identical content.
export class SeededRandom {
  constructor(seed = 1) { this.state = (seed >>> 0) || 1; }
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(values) { return values[Math.floor(this.next() * values.length)]; }
  weighted(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = this.next() * total;
    for (const entry of entries) { cursor -= entry.weight; if (cursor <= 0) return entry.value; }
    return entries.at(-1)?.value;
  }
}

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
