export const VEHICLE_CATALOG = Object.freeze([
  { key: 'violet-vandal', name: 'Violet Vandal', class: 'COUPE', price: 18500, topSpeed: 118, acceleration: 72, handling: 68, description: 'Low-slung night runner with a sharp neon silhouette.' },
  { key: 'midnight-sedan', name: 'Midnight Sedan', class: 'SEDAN', price: 26500, topSpeed: 104, acceleration: 61, handling: 78, description: 'Clean executive four-door for city contracts and hotel arrivals.' },
  { key: 'goldline-suv', name: 'Goldline SUV', class: 'SUV', price: 42000, topSpeed: 96, acceleration: 55, handling: 64, description: 'Heavy luxury utility with room for the whole crew.' },
  { key: 'rose-runner', name: 'Rose Runner', class: 'SPORT', price: 58000, topSpeed: 148, acceleration: 91, handling: 86, description: 'A flashy after-dark sports car built for boulevard pulls.' },
  { key: 'chrome-lowrider', name: 'Chrome Lowrider', class: 'LOWRIDER', price: 73500, topSpeed: 112, acceleration: 66, handling: 82, description: 'Custom street presence with a polished, bouncing stance.' },
  { key: 'blacktop-muscle', name: 'Blacktop Muscle', class: 'MUSCLE', price: 89000, topSpeed: 132, acceleration: 88, handling: 61, description: 'Big fictional torque, loud attitude, and a clean getaway line.' },
]);

export const VEHICLE_UPGRADES = Object.freeze({
  engine: { label: 'Engine', stat: 'acceleration', levels: [ { name: 'Street Tune', price: 4200, value: 7 }, { name: 'Cartel Spec', price: 9800, value: 15 }, { name: 'Midnight Race', price: 18500, value: 25 } ] },
  transmission: { label: 'Transmission', stat: 'acceleration', levels: [ { name: 'Quick Shift', price: 3600, value: 5 }, { name: 'Close Ratio', price: 8200, value: 11 }, { name: 'Overdrive', price: 15400, value: 18 } ] },
  turbo: { label: 'Turbo', stat: 'topSpeed', levels: [ { name: 'Spool Kit', price: 6500, value: 8 }, { name: 'Twin Boost', price: 14200, value: 17 }, { name: 'Afterburner', price: 26000, value: 29 } ] },
  brakes: { label: 'Brakes', stat: 'handling', levels: [ { name: 'Sport Pads', price: 2400, value: 5 }, { name: 'Track Brakes', price: 6200, value: 12 }, { name: 'Carbon Stop', price: 12800, value: 21 } ] },
  suspension: { label: 'Suspension', stat: 'handling', levels: [ { name: 'Street Set', price: 3100, value: 6 }, { name: 'Low & Tight', price: 7600, value: 14 }, { name: 'Corner King', price: 15600, value: 24 } ] },
  wheels: { label: 'Wheels', stat: 'topSpeed', levels: [ { name: 'Chrome Fives', price: 2800, value: 4 }, { name: 'Forged Set', price: 6900, value: 9 }, { name: 'Vortex Rims', price: 13200, value: 15 } ] },
});

export function getVehicle(key) { return VEHICLE_CATALOG.find((vehicle) => vehicle.key === key) || null; }
