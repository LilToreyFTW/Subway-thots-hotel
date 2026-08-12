import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOTEL_DIRECTION, VENUE_CATALOG, WEAPON_CATALOG, getWeapon } from '../src/content/WorldContent.js';
import { CAMO_CATALOG, getCamo } from '../src/content/CamoCatalog.js';
import { VEHICLE_CATALOG, VEHICLE_UPGRADES, getVehicle } from '../src/content/VehicleCatalog.js';
import { GameLoop } from '../src/core/GameLoop.js';
import * as THREE from 'three';
import { VehicleController, VehicleState } from '../src/vehicles/VehicleController.js';
import { RoadGraph } from '../src/world/RoadGraph.js';
import { WORLD_LAYOUT, isHotelWalkIn } from '../src/content/WorldLayout.js';

test('weapon catalog covers the requested fictional equipment categories', () => {
  const categories = new Set(WEAPON_CATALOG.map((weapon) => weapon.category));
  for (const category of ['pistol', 'smg', 'ar', 'rifle', 'sniper', 'minigun', 'rpg', 'explosive', 'emp']) assert.ok(categories.has(category), category);
  assert.equal(getWeapon('pulse-emp').category, 'emp');
});

test('venue catalog contains the shop, adult club, distant bar, and hotel hosting spaces', () => {
  assert.deepEqual(new Set(VENUE_CATALOG.map((venue) => venue.type)), new Set(['gun-shop', 'car-dealership', 'car-mod-shop', 'adult-club', 'bar', 'hotel-hosting']));
});

test('gameplay offsets are centralized and venue footprints match the catalog', () => {
  assert.deepEqual([...WORLD_LAYOUT.roads], [-120, -72, -24, 24, 72, 120]);
  assert.deepEqual(WORLD_LAYOUT.playerSpawn, { x: 0, y: 0, z: 9 });
  for (const venue of VENUE_CATALOG.filter((item) => item.type !== 'hotel-hosting')) {
    assert.equal(venue.footprint.width, WORLD_LAYOUT.venueFootprints[venue.type].width);
    assert.equal(venue.footprint.depth, WORLD_LAYOUT.venueFootprints[venue.type].depth);
  }
  assert.equal(VENUE_CATALOG.find((venue) => venue.type === 'gun-shop').footprint.outdoor, true);
});

test('the hotel approach stays clear of the Night Bites stand', () => {
  const stand = WORLD_LAYOUT.nightBites;
  const approach = WORLD_LAYOUT.hotel.approach;
  const standBounds = {
    minX: stand.x - stand.width / 2,
    maxX: stand.x + stand.width / 2,
    minZ: stand.z - stand.depth / 2,
    maxZ: stand.z + stand.depth / 2,
  };
  const overlapsEntranceApproach = standBounds.maxX > approach.minX && standBounds.minX < approach.maxX
    && standBounds.maxZ > approach.minZ && standBounds.minZ < approach.maxZ;
  assert.equal(overlapsEntranceApproach, false);
  assert.ok(Math.hypot(stand.x - WORLD_LAYOUT.hotel.x, stand.interactionZ - WORLD_LAYOUT.hotel.entranceZ) > 3.15);
  assert.ok(WORLD_LAYOUT.hotel.walkInTriggerZ < WORLD_LAYOUT.hotel.entranceZ);
  assert.equal(isHotelWalkIn({ x: 0, z: WORLD_LAYOUT.hotel.walkInTriggerZ }), true);
  assert.equal(isHotelWalkIn({ x: 4, z: WORLD_LAYOUT.hotel.walkInTriggerZ }), false);
});

test('street venues clear the 13 meter roadway bands', () => {
  const widths = Object.fromEntries(Object.entries(WORLD_LAYOUT.venueFootprints).map(([type, footprint]) => [type, footprint.width]));
  const depths = Object.fromEntries(Object.entries(WORLD_LAYOUT.venueFootprints).map(([type, footprint]) => [type, footprint.depth]));
  const roads = [-120, -72, -24, 24, 72, 120];
  for (const venue of VENUE_CATALOG.filter((item) => item.type !== 'hotel-hosting')) {
    const [x, , z] = venue.position;
    for (const road of roads) {
      assert.ok(Math.abs(x - road) >= widths[venue.type] / 2 + 6.5, `${venue.name} overlaps vertical road ${road}`);
      assert.ok(Math.abs(z - road) >= depths[venue.type] / 2 + 6.5, `${venue.name} overlaps horizontal road ${road}`);
    }
  }
});

test('vehicle catalog and upgrade systems cover the dealership and mod shop loop', () => {
  assert.equal(VEHICLE_CATALOG.length, 6);
  assert.equal(getVehicle('rose-runner').class, 'SPORT');
  assert.deepEqual(Object.keys(VEHICLE_UPGRADES), ['engine', 'transmission', 'turbo', 'brakes', 'suspension', 'wheels']);
  for (const upgrade of Object.values(VEHICLE_UPGRADES)) assert.equal(upgrade.levels.length, 3);
});

test('hotel remodel direction preserves the existing room count', () => {
  assert.equal(HOTEL_DIRECTION.rooms, 50);
  assert.equal(HOTEL_DIRECTION.floors, 5);
});

test('every weapon can use the full set of 40 animated camo gradients', () => {
  assert.equal(CAMO_CATALOG.length, 40);
  assert.equal(new Set(CAMO_CATALOG.map((camo) => camo.key)).size, 40);
  assert.equal(getCamo('camo-40').name, 'Black Rose');
  for (const weapon of WEAPON_CATALOG) assert.ok(CAMO_CATALOG.every((camo) => camo.pattern && camo.speed > 0), weapon.key);
});

test('standalone weapon model pack contains valid GLB headers', () => {
  for (const category of ['pistol', 'smg', 'ar', 'rifle', 'sniper', 'shotgun', 'minigun', 'rpg', 'emp', 'explosive']) {
    const header = readFileSync(`public/assets/models/weapons/${category}.glb`).subarray(0, 4).toString('ascii');
    assert.equal(header, 'glTF', category);
  }
});

test('venue model pack contains valid GLB headers', () => {
  for (const name of ['luxury-hotel-lobby', 'hotel-suite-hosting', 'neon-arsenal-shop', 'velvet-stage-club', 'midnight-mile-bar-28']) {
    const header = readFileSync(`public/assets/models/venues/${name}.glb`).subarray(0, 4).toString('ascii');
    assert.equal(header, 'glTF', name);
  }
});

test('Lamborghini vehicle batch has 20 validated manifest entries', () => {
  const manifest = JSON.parse(readFileSync('assets/manifests/lamborghini-vehicles.json', 'utf8'));
  assert.equal(manifest.vehicles.length, 20);
  for (const vehicle of manifest.vehicles) {
    assert.equal(vehicle.brand, 'Lamborghini');
    assert.equal(vehicle.wheelNodes.length, 4);
    assert.equal(vehicle.drivable, true);
    assert.equal(readFileSync(vehicle.file).subarray(0, 4).toString('ascii'), 'glTF');
  }
});

test('Rolls-Royce vehicle batch has 27 validated manifest entries', () => {
  const manifest = JSON.parse(readFileSync('assets/manifests/rolls-royce-vehicles.json', 'utf8'));
  assert.equal(manifest.vehicles.length, 27);
  for (const vehicle of manifest.vehicles) {
    assert.equal(vehicle.brand, 'Rolls-Royce');
    assert.equal(vehicle.wheelNodes.length, 4);
    assert.equal(readFileSync(vehicle.file).subarray(0, 4).toString('ascii'), 'glTF');
  }
});

test('Chevrolet vehicle batch has 65 validated manifest entries', () => {
  const manifest = JSON.parse(readFileSync('assets/manifests/chevrolet-vehicles.json', 'utf8'));
  assert.equal(manifest.vehicles.length, 65);
  for (const vehicle of manifest.vehicles) {
    assert.equal(vehicle.brand, 'Chevrolet');
    assert.equal(vehicle.wheelNodes.length, 4);
    assert.equal(readFileSync(vehicle.file).subarray(0, 4).toString('ascii'), 'glTF');
  }
});

test('Ford vehicle batch has 55 validated manifest entries', () => {
  const manifest = JSON.parse(readFileSync('assets/manifests/ford-vehicles.json', 'utf8'));
  assert.equal(manifest.vehicles.length, 55);
  for (const vehicle of manifest.vehicles) {
    assert.equal(vehicle.brand, 'Ford');
    assert.equal(vehicle.wheelNodes.length, 4);
    assert.equal(readFileSync(vehicle.file).subarray(0, 4).toString('ascii'), 'glTF');
  }
});

test('game loop caps catch-up and separates fixed simulation from render updates', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => {};
  let fixedSteps = 0;
  let renderUpdates = 0;
  const loop = new GameLoop({ clock: { getDelta: () => 1 }, fixedStep: 1 / 60, fixedUpdate: () => { fixedSteps += 1; }, update: () => { renderUpdates += 1; } });
  loop.running = true;
  loop.frame(1000);
  assert.equal(fixedSteps, 3);
  assert.equal(renderUpdates, 1);
  globalThis.requestAnimationFrame = originalRaf;
});

test('vehicle controller supports enter, fixed-step handling, wheel steering, and exit', () => {
  const vehicle = new THREE.Group();
  const wheels = [new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D(), new THREE.Object3D()];
  const controller = new VehicleController({ vehicle, stats: { topSpeed: 100, acceleration: 80, handling: 90 }, dimensions: { length: 4.8, width: 1.9, height: 1.4 } });
  controller.wheelNodes = wheels;
  assert.equal(controller.state, VehicleState.PARKED);
  assert.equal(controller.enter(), true);
  assert.equal(controller.completeEntry(), true);
  const result = controller.update({ throttle: 1, steer: .6 }, .5);
  assert.equal(result.state, VehicleState.DRIVING);
  assert.ok(result.speed > 0);
  assert.notEqual(vehicle.position.lengthSq(), 0);
  assert.notEqual(wheels[0].rotation.y, 0);
  assert.equal(controller.exit(), true);
  assert.equal(controller.completeExit(), true);
  assert.equal(controller.state, VehicleState.PARKED);
  assert.equal(controller.speed, 0);
});

test('road graph exposes deterministic nodes, edges, nearest lookup, and routes', () => {
  const graph = new RoadGraph({ positions: [0, 48, 96] });
  assert.equal(graph.nodes.size, 9);
  assert.ok(graph.edges.get('0:0').length >= 2);
  const route = graph.route(new THREE.Vector3(0, 0, 0), new THREE.Vector3(96, 0, 96));
  assert.equal(route[0].x, 0);
  assert.equal(route.at(-1).z, 96);
  assert.ok(route.length >= 5);
});
