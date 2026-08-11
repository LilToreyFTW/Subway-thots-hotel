import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

globalThis.self = globalThis;
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }).catch((error) => this.onerror?.(error)); } };

const rootDir = path.resolve('public/assets/models/vehicles/lamborghini');
await mkdir(rootDir, { recursive: true });
const exporter = new GLTFExporter();
const names = [
  ['lambo_diablo_2000', 'Diablo', 'supercar', 4.47, 1.94, 1.12, 0xe3b64f, '2000-2001'],
  ['lambo_murcielago', 'Murciélago', 'supercar', 4.58, 2.05, 1.13, 0x3a536b, '2001-2010'],
  ['lambo_gallardo', 'Gallardo', 'supercar', 4.34, 1.90, 1.16, 0xd94d46, '2003-2013'],
  ['lambo_reventon', 'Reventón', 'supercar', 4.70, 2.05, 1.13, 0x687177, '2007-2009'],
  ['lambo_sesto_elemento', 'Sesto Elemento', 'hypercar', 4.48, 1.95, 1.05, 0x383b42, '2010-2012'],
  ['lambo_aventador', 'Aventador', 'supercar', 4.78, 2.03, 1.14, 0xe2c247, '2011-2022'],
  ['lambo_veneno', 'Veneno', 'hypercar', 5.02, 2.10, 1.08, 0xb8b9b4, '2013-2014'],
  ['lambo_huracan', 'Huracán', 'supercar', 4.52, 1.94, 1.16, 0xf06a39, '2014-2024'],
  ['lambo_centenario', 'Centenario', 'hypercar', 4.92, 2.07, 1.10, 0x4d5965, '2016-2017'],
  ['lambo_urus', 'Urus', 'suv', 5.11, 2.02, 1.64, 0x252a31, '2018-2026'],
  ['lambo_sian_fkp_37', 'Sián FKP 37', 'hypercar', 4.98, 2.08, 1.13, 0x91a13e, '2019-2022'],
  ['lambo_sian_roadster', 'Sián Roadster', 'roadster', 4.98, 2.08, 1.12, 0x7d9d79, '2020-2022'],
  ['lambo_countach_lpi_800_4', 'Countach LPI 800-4', 'supercar', 4.87, 2.10, 1.14, 0xf0f0e8, '2021-2022'],
  ['lambo_revuelto', 'Revuelto', 'hypercar', 4.95, 2.03, 1.16, 0x642f88, '2023-2026'],
  ['lambo_urus_s', 'Urus S', 'suv', 5.14, 2.02, 1.64, 0x54606a, '2022-2026'],
  ['lambo_urus_performante', 'Urus Performante', 'suv', 5.14, 2.03, 1.60, 0xb64735, '2022-2026'],
  ['lambo_urus_se', 'Urus SE', 'suv', 5.14, 2.03, 1.66, 0x2e6675, '2024-2026'],
  ['lambo_temperario', 'Temerario', 'supercar', 4.75, 2.02, 1.20, 0x32a3a0, '2024-2026'],
  ['lambo_fenomeno', 'Fenomeno', 'hypercar', 5.05, 2.10, 1.08, 0x332e42, '2025-2026'],
  ['lambo_fenomeno_roadster', 'Fenomeno Roadster', 'roadster', 5.05, 2.10, 1.07, 0xc1c5bb, '2026'],
];
const mat = (color, metalness = .4, roughness = .28) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const box = (root, name, x, y, z, sx, sy, sz, material) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material); mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh; };
function wheel(root, name, x, y, z, radius) { const group = new THREE.Group(); group.name = name; const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .22, 20), mat(0x101215, .78, .32)); tire.rotation.z = Math.PI / 2; group.add(tire); const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * .55, radius * .55, .24, 16), mat(0xb6bdc0, .84, .18)); rim.rotation.z = Math.PI / 2; group.add(rim); group.position.set(x, y, z); root.add(group); return group; }
function buildCar(id, name, category, length, width, height, color, years) {
  const root = new THREE.Group(); root.name = `${id}_root`;
  const body = mat(color, .68, .22); const trim = mat(0x15191e, .78, .2); const glass = mat(0x263d48, .34, .12); const light = new THREE.MeshStandardMaterial({ color: 0xe9f5ff, emissive: 0x79c4dc, emissiveIntensity: 1.8, metalness: .1, roughness: .12 }); const red = new THREE.MeshStandardMaterial({ color: 0xcc3041, emissive: 0x520914, emissiveIntensity: 1.3 });
  const suv = category === 'suv'; const roadster = category === 'roadster'; const roofZ = suv ? -0.15 : -.25;
  box(root, 'body', 0, height * .42, 0, length, height * .46, width, body);
  box(root, 'hood', length * .30, height * .68, 0, length * .28, height * .14, width * .86, body);
  box(root, 'cabin', -length * .08, height * .78, roofZ, length * (suv ? .43 : .38), height * (suv ? .38 : .32), width * .74, glass);
  if (!roadster) box(root, 'roof', -length * .08, height * .98, roofZ, length * (suv ? .43 : .38), .08, width * .76, body);
  box(root, 'front_bumper', length * .49, height * .36, 0, .16, height * .2, width * .9, trim);
  box(root, 'rear_bumper', -length * .49, height * .36, 0, .16, height * .2, width * .9, trim);
  box(root, 'headlight_l', length * .49, height * .55, -width * .29, .05, .14, width * .17, light);
  box(root, 'headlight_r', length * .49, height * .55, width * .29, .05, .14, width * .17, light);
  box(root, 'taillight_l', -length * .49, height * .55, -width * .30, .05, .13, width * .14, red);
  box(root, 'taillight_r', -length * .49, height * .55, width * .30, .05, .13, width * .14, red);
  for (const [x, z, key] of [[length * .32, -width * .48, 'front_left_wheel'], [length * .32, width * .48, 'front_right_wheel'], [-length * .32, -width * .48, 'rear_left_wheel'], [-length * .32, width * .48, 'rear_right_wheel']]) wheel(root, key, x, height * .22, z, suv ? .43 : .34);
  box(root, 'interior', -length * .08, height * .66, 0, length * .30, height * .18, width * .57, mat(0x191b20, .18, .48));
  root.userData = { assetId: id, displayName: name, brand: 'Lamborghini', category, years, scale: '1 unit = 1 meter', wheelNodes: ['front_left_wheel', 'front_right_wheel', 'rear_left_wheel', 'rear_right_wheel'] };
  return root;
}
const manifest = [];
for (const [id, name, category, length, width, height, color, years] of names) {
  const scene = new THREE.Scene(); scene.add(buildCar(id, name, category, length, width, height, color, years));
  const binary = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true }));
  const file = `public/assets/models/vehicles/lamborghini/${id}.glb`;
  await writeFile(path.resolve(file), Buffer.from(binary));
  manifest.push({ id, displayName: name, brand: 'Lamborghini', category, years, file, lods: ['lod0'], drivable: true, trafficEligible: category !== 'hypercar', parkedEligible: true, colorOptions: ['black', 'white', 'silver', 'gray', 'red', 'blue', 'yellow'], dimensionsMeters: { length, width, height }, collision: { type: 'box', size: [length, height, width] }, wheelNodes: ['front_left_wheel', 'front_right_wheel', 'rear_left_wheel', 'rear_right_wheel'], polycountNote: 'Procedural real-time mesh; inspect GLB for exact primitive counts.' });
  console.log(`${id}.glb ${binary.byteLength} bytes`);
}
await writeFile(path.resolve('assets/manifests/lamborghini-vehicles.json'), JSON.stringify({ version: 1, source: 'original stylized game interpretations', brand: 'Lamborghini', vehicles: manifest }, null, 2));
