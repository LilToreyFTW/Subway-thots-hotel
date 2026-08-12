import { WORLD_LAYOUT } from './WorldLayout.js';

export const WEAPON_CATALOG = Object.freeze([
  { key: 'velvet-9', name: 'Velvet 9', category: 'pistol', price: 420, rarity: 'common', damage: 18, fireRate: 4.2, magazine: 12, description: 'Compact sidearm tuned for close-quarters defense.' },
  { key: 'afterglow-45', name: 'Afterglow .45', category: 'pistol', price: 760, rarity: 'rare', damage: 31, fireRate: 2.8, magazine: 8, description: 'Heavy-hitting luxury sidearm with a bright-trace slide.' },
  { key: 'metro-smg', name: 'Metro SMG', category: 'smg', price: 980, rarity: 'common', damage: 14, fireRate: 10.5, magazine: 32, description: 'Fast, controllable automatic for the station district.' },
  { key: 'nightline-carbine', name: 'Nightline Carbine', category: 'ar', price: 1550, rarity: 'rare', damage: 24, fireRate: 8.1, magazine: 30, description: 'Balanced automatic rifle for city patrols and escort jobs.' },
  { key: 'hotel-security-rifle', name: 'Hotel Security Rifle', category: 'rifle', price: 2100, rarity: 'rare', damage: 42, fireRate: 4.6, magazine: 20, description: 'Longer-range rifle assigned to premium security teams.' },
  { key: 'skyline-precision', name: 'Skyline Precision', category: 'sniper', price: 3450, rarity: 'epic', damage: 92, fireRate: 0.8, magazine: 5, description: 'Precision platform for overwatch contracts beyond the lobby lights.' },
  { key: 'velvet-minigun', name: 'Velvet Minigun', category: 'minigun', price: 6200, rarity: 'legendary', damage: 12, fireRate: 24, magazine: 120, description: 'A fictional high-volume crowd-control platform for arcade missions.' },
  { key: 'redline-rpg', name: 'Redline RPG', category: 'rpg', price: 4800, rarity: 'epic', damage: 150, fireRate: 0.35, magazine: 1, description: 'Single-shot cinematic launcher for scripted vehicle encounters.' },
  { key: 'pulse-emp', name: 'Pulse EMP', category: 'emp', price: 1800, rarity: 'rare', damage: 0, fireRate: 0.5, magazine: 2, description: 'Non-lethal fictional device that disables drones and electronics.' },
  { key: 'flash-charge', name: 'Flash Charge', category: 'explosive', price: 650, rarity: 'common', damage: 55, fireRate: 0.4, magazine: 2, description: 'Arcade-safe throwable for scripted breach encounters.' },
]);

export const VENUE_CATALOG = Object.freeze([
  { key: 'neon-arsenal', name: 'Neon Arsenal', type: 'gun-shop', district: 'station', position: [10, 0, -36], footprint: WORLD_LAYOUT.venueFootprints['gun-shop'], tagline: 'Licensed fictional equipment for city contracts.' },
  { key: 'diamond-lane-motors', name: 'Diamond Lane Motors', type: 'car-dealership', district: 'station', position: [55, 0, -40], footprint: WORLD_LAYOUT.venueFootprints['car-dealership'], tagline: 'Buy original fictional cars for your city garage.' },
  { key: 'blacktop-customs', name: 'Blacktop Customs', type: 'car-mod-shop', district: 'station', position: [88, 0, -40], footprint: WORLD_LAYOUT.venueFootprints['car-mod-shop'], tagline: 'Upgrade engines, drivetrains, stopping power, and stance.' },
  { key: 'velvet-stage', name: 'Velvet Stage', type: 'adult-club', district: 'station', position: [38, 0, 36], footprint: WORLD_LAYOUT.venueFootprints['adult-club'], tagline: 'Adults-only nightlife, performances, and host bookings.' },
  { key: 'midnight-mile', name: 'Midnight Mile Bar 28', type: 'bar', district: 'station', position: [38, 0, 56], footprint: WORLD_LAYOUT.venueFootprints.bar, tagline: 'A late-night social bar twenty-eight miles down the route.' },
  { key: 'hotel-hosting', name: 'Hotel Hosting Suites', type: 'hotel-hosting', district: 'hotel', position: [0, 0, 0], footprint: Object.freeze({ width: 0, depth: 0, outdoor: false }), tagline: 'Private, consent-first adult hosting inside individual guest rooms.' },
]);

export const HOTEL_DIRECTION = Object.freeze({
  rooms: 50,
  floors: 5,
  style: 'luxury-after-dark',
  palette: ['champagne gold', 'smoked glass', 'deep plum', 'warm walnut', 'midnight teal'],
  upgrades: ['marble reception spine', 'layered chandelier lighting', 'quiet VIP lounge', 'signature bar', 'wayfinding signage', 'soft acoustic zoning'],
});

export function getWeapon(key) {
  return WEAPON_CATALOG.find((weapon) => weapon.key === key) || null;
}
