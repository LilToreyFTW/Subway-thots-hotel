// Authoritative gameplay offsets for the shared city slice.
// Keep browser rendering, collision, interaction, and native migration aligned.
export const WORLD_LAYOUT = Object.freeze({
  bounds: Object.freeze({ min: -150, max: 150 }),
  playerSpawn: Object.freeze({ x: 0, y: 0, z: 9 }),
  cityStartSpawn: Object.freeze({ x: -24, y: 0, z: -24 }),
  hotel: Object.freeze({ x: 0, y: 0, z: -46, entranceZ: -34.5 }),
  roads: Object.freeze([-120, -72, -24, 24, 72, 120]),
  venueFootprints: Object.freeze({
    'gun-shop': Object.freeze({ width: 18, depth: 16, outdoor: true }),
    'adult-club': Object.freeze({ width: 12, depth: 8, outdoor: false }),
    bar: Object.freeze({ width: 14, depth: 10, outdoor: false }),
    'car-dealership': Object.freeze({ width: 16, depth: 12, outdoor: false }),
    'car-mod-shop': Object.freeze({ width: 16, depth: 12, outdoor: false }),
  }),
});

export function layoutPosition(x, y, z) {
  return Object.freeze({ x, y, z });
}
