import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDetailedVehicle } from './vehicle-model-kit.mjs';

globalThis.self = globalThis;
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }).catch((error) => this.onerror?.(error)); } };

const output = path.resolve('public/assets/models/vehicles/sth-motors');
await mkdir(output, { recursive: true });
const vehicles = [
  ['violet-vandal', 'Violet Vandal', 'coupe', 4.52, 1.91, 1.29, 0x713a86],
  ['midnight-sedan', 'Midnight Sedan', 'luxury-sedan', 4.92, 1.91, 1.47, 0x252c36],
  ['goldline-suv', 'Goldline SUV', 'suv', 5.02, 2.01, 1.76, 0xa67b35],
  ['rose-runner', 'Rose Runner', 'sport', 4.66, 1.98, 1.19, 0xa82d57],
  ['chrome-lowrider', 'Chrome Lowrider', 'lowrider', 5.18, 1.98, 1.34, 0x60727c],
  ['blacktop-muscle', 'Blacktop Muscle', 'muscle', 4.86, 1.96, 1.32, 0x15191d],
];
const exporter = new GLTFExporter();
for (const [id, name, category, length, width, height, color] of vehicles) {
  const scene = new THREE.Scene();
  scene.add(buildDetailedVehicle({ id, name, brand: 'STH Motors', category, length, width, height, color, years: '2026' }));
  const binary = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true }));
  await writeFile(path.join(output, `${id}.glb`), Buffer.from(binary));
  console.log(`${id}.glb ${binary.byteLength} bytes`);
}
