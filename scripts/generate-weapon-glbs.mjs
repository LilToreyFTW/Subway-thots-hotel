import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('public/assets/models/weapons');
await mkdir(outputDir, { recursive: true });

globalThis.self = globalThis;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }).catch((error) => this.onerror?.(error));
  }
};

function mat(color, metalness = .72, roughness = .28) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function box(root, x, y, z, sx, sy, sz, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
}
function barrel(root, x, y, z, length, radius, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
  mesh.rotation.z = Math.PI / 2; mesh.position.set(x, y, z); mesh.castShadow = true; root.add(mesh); return mesh;
}
function makeWeapon(category, accent) {
  const root = new THREE.Group();
  root.name = `${category}-weapon`;
  const metal = mat(accent); const dark = mat(0x111820, .84, .24); const glow = mat(0x53d9e6, .45, .2);
  if (category === 'pistol') { box(root, 0, .12, 0, 1.35, .25, .32, metal); box(root, -.27, -.25, 0, .28, .6, .34, dark); barrel(root, .79, .12, 0, .35, .08, dark); }
  else if (category === 'smg') { box(root, 0, .12, 0, 1.65, .3, .36, metal); box(root, -.42, -.28, 0, .28, .74, .38, dark); barrel(root, .94, .12, 0, .46, .09, dark); box(root, .1, -.2, 0, .28, .45, .24, glow); }
  else if (category === 'ar') { box(root, 0, .12, 0, 2.25, .3, .38, metal); box(root, -.72, -.28, 0, .3, .76, .4, dark); box(root, -.98, .12, 0, .54, .38, .42, dark); barrel(root, 1.38, .12, 0, .72, .08, dark); box(root, .1, -.23, 0, .25, .48, .25, glow); }
  else if (category === 'rifle') { box(root, 0, .12, 0, 2.65, .28, .34, metal); box(root, -.98, -.25, 0, .3, .68, .36, dark); box(root, -1.25, .12, 0, .62, .34, .4, dark); barrel(root, 1.64, .12, 0, .95, .07, dark); box(root, .15, .35, 0, .45, .16, .22, glow); }
  else if (category === 'sniper') { box(root, 0, .12, 0, 3.2, .27, .32, metal); box(root, -1.15, -.25, 0, .32, .7, .38, dark); box(root, -1.52, .12, 0, .62, .35, .42, dark); barrel(root, 2.02, .12, 0, 1.22, .065, dark); barrel(root, .15, .42, 0, .72, .12, glow); }
  else if (category === 'shotgun') { box(root, 0, .12, 0, 2.35, .32, .42, metal); box(root, -.82, -.28, 0, .32, .72, .44, dark); box(root, -1.18, .12, 0, .58, .38, .46, dark); barrel(root, 1.48, .12, -.11, .85, .09, dark); barrel(root, 1.48, .12, .11, .85, .09, dark); }
  else if (category === 'minigun') { box(root, -.25, .12, 0, 1.5, .34, .52, metal); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .8, 12), dark); b.rotation.z = Math.PI / 2; b.position.set(.92, .12 + Math.cos(a) * .18, Math.sin(a) * .18); root.add(b); } box(root, -.45, -.3, 0, .3, .7, .42, dark); }
  else if (category === 'rpg') { barrel(root, 0, .18, 0, 2.4, .28, metal); box(root, -.65, -.2, 0, .32, .6, .42, dark); box(root, .65, .18, 0, .18, .58, .62, glow); }
  else if (category === 'emp') { const sphere = new THREE.Mesh(new THREE.SphereGeometry(.48, 24, 16), new THREE.MeshStandardMaterial({ color: accent, emissive: 0x53d9e6, emissiveIntensity: 1.6, metalness: .48, roughness: .2 })); sphere.position.y = .35; root.add(sphere); box(root, 0, -.2, 0, .62, .22, .62, dark); }
  else if (category === 'explosive') { box(root, 0, .3, 0, .82, .62, .82, metal); box(root, 0, .3, -.46, .35, .34, .05, glow); box(root, 0, .82, 0, .08, .42, .08, dark); }
  root.rotation.y = Math.PI / 2;
  return root;
}

const weapons = [
  ['pistol', 0xe45da8], ['smg', 0x6fd7e4], ['ar', 0xd3aa61], ['rifle', 0x8f75d5], ['sniper', 0x58b7c3],
  ['minigun', 0xe6784f], ['rpg', 0x8ac46a], ['emp', 0x58dbe8], ['explosive', 0xd84d6d], ['shotgun', 0xc18b57],
];
const exporter = new GLTFExporter();
for (const [category, accent] of weapons) {
  const scene = new THREE.Scene(); scene.add(makeWeapon(category, accent));
  const binary = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true }));
  await writeFile(path.join(outputDir, `${category}.glb`), Buffer.from(binary));
  console.log(`${category}.glb ${binary.byteLength} bytes`);
}
