const CAMO_NAMES = [
  'Midnight Cartel', 'Purple Haze', 'Chrome Alley', 'Rose Gold Run', 'Neon Vice',
  'Blacktop Heat', 'Cyan Smoke', 'Plum Static', 'Gold Teeth', 'Velvet Reign',
  'Afterhours Acid', 'Blue Note', 'Cherry Lowrider', 'Green Room', 'Hot Magenta',
  'Obsidian Wave', 'Electric Royal', 'Sunset Syndicate', 'Toxic Mint', 'Casino Noir',
  'Silver Serpent', 'Redline Drip', 'Lavender Chrome', 'Streetlight Amber', 'Deep Sea Flex',
  'Pink Motel', 'Copper Ghost', 'Ultraviolet Rain', 'Emerald Static', 'Icebox Blue',
  'Burnt Plum', 'Laser Lemon', 'Night Market', 'Royal Smoke', 'Sapphire Heat',
  'Velvet Voltage', 'Concrete Candy', 'Raspberry Chrome', 'Moonlit Teal', 'Black Rose',
];

const HUES = [0.77, 0.93, 0.55, 0.11, 0.88, 0.02, 0.52, 0.82, 0.12, 0.95,
  0.15, 0.60, 0.98, 0.35, 0.91, 0.68, 0.73, 0.04, 0.42, 0.06,
  0.58, 0.01, 0.79, 0.10, 0.54, 0.94, 0.08, 0.76, 0.39, 0.57,
  0.84, 0.16, 0.64, 0.70, 0.62, 0.89, 0.48, 0.97, 0.50, 0.95];

export const CAMO_CATALOG = Object.freeze(CAMO_NAMES.map((name, index) => ({
  key: `camo-${String(index + 1).padStart(2, '0')}`,
  name,
  hue: HUES[index],
  accentHue: (HUES[index] + (index % 2 ? .18 : -.22) + 1) % 1,
  speed: .35 + (index % 7) * .09,
  swing: .035 + (index % 5) * .012,
  glow: index % 4 === 0 ? .9 : index % 3 === 0 ? .55 : .28,
  pattern: ['wave', 'pulse', 'split', 'drift'][index % 4],
})));

export function getCamo(key) {
  return CAMO_CATALOG.find((camo) => camo.key === key) || CAMO_CATALOG[0];
}
