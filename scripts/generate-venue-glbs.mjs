import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

globalThis.self = globalThis;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }).catch((error) => this.onerror?.(error)); }
};

const outputDir = path.resolve('public/assets/models/venues');
await mkdir(outputDir, { recursive: true });
function material(color, metalness = .25, roughness = .45, emissive = 0) { return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: emissive ? 1.2 : 0 }); }
function box(root, x, y, z, sx, sy, sz, mat) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); mesh.position.set(x, y, z); root.add(mesh); return mesh; }
function cylinder(root, x, y, z, radius, height, mat, radial = 20) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), mat); mesh.position.set(x, y, z); root.add(mesh); return mesh; }
function arch(root, x, z, width, height, mat) { box(root, x - width / 2, height / 2, z, .28, height, .35, mat); box(root, x + width / 2, height / 2, z, .28, height, .35, mat); box(root, x, height - .14, z, width + .28, .28, .35, mat); }
function roomShell(root, width, depth, wall, floor) { box(root, 0, -.15, 0, width, .3, depth, floor); box(root, 0, 2.8, -depth / 2, width, 5.6, .28, wall); box(root, -width / 2, 2.8, 0, .28, depth, wall); box(root, width / 2, 2.8, 0, .28, depth, wall); box(root, 0, 5.6, 0, width, .28, depth, wall); }
function chandelier(root, y, radius, accent) { cylinder(root, 0, y, 0, .06, 1.2, accent, 12); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cylinder(root, Math.cos(a) * radius, y - .45, Math.sin(a) * radius, .11, .35, accent, 12); } }
function lobby() { const root = new THREE.Group(); root.name = 'luxury-hotel-lobby'; const wall = material(0x34343a, .18, .5); const floor = material(0x5a3d4f, .14, .42); const gold = material(0xd4a65e, .7, .2); const glass = material(0x6597a3, .18, .12, 0x234f5c); roomShell(root, 28, 24, wall, floor); for (const x of [-10, 10]) cylinder(root, x, 2.8, -7, .38, 5.6, gold, 24); box(root, 0, .8, -8, 13, 1.6, 2.2, material(0x563c2e, .2, .35)); box(root, 0, 1.7, -8, 13.4, .14, 2.4, gold); box(root, 0, 2.8, -11.7, 9, 3.6, .16, glass); for (const x of [-5.7, 0, 5.7]) box(root, x, 2.8, -11.5, .2, 3.7, .22, gold); chandelier(root, 5, 2.4, gold); chandelier(root, 4.5, 1.4, gold); arch(root, 0, 11.7, 5.5, 4.2, gold); return root; }
function suite() { const root = new THREE.Group(); root.name = 'hotel-suite-hosting'; const wall = material(0x3b3944, .14, .55); const floor = material(0x4b3544, .12, .48); const wood = material(0x543b30, .2, .36); const gold = material(0xd1a15c, .68, .22); const linen = material(0xd4c7b9, .06, .72); roomShell(root, 18, 18, wall, floor); box(root, -3.4, .8, -2.4, 5.8, 1.0, 6.5, wood); box(root, -3.4, 1.45, -2.4, 5.5, .35, 6.2, linen); box(root, -3.4, 2.8, -5.7, 5.8, 3.3, .28, wall); for (const x of [-5.2, -1.6]) box(root, x, 1.55, -4.4, 2.2, .28, 1.25, linen); box(root, 5.7, 1.35, 4.9, 3.1, 2.6, .5, material(0xe1e2dc, .08, .32)); box(root, 0, 3.5, 7.7, 7.5, 2.2, .2, material(0x1a2028, .5, .22)); for (const x of [-6.5, 6.5]) cylinder(root, x, 2.6, 1.6, .09, 2.7, gold, 12); return root; }
function arsenal() { const root = new THREE.Group(); root.name = 'neon-arsenal-shop'; const wall = material(0x202a31, .55, .3); const floor = material(0x20242a, .48, .28); const cyan = material(0x62dce7, .32, .22, 0x195e67); const magenta = material(0xe554b4, .25, .25, 0x5f173f); roomShell(root, 16, 11, wall, floor); box(root, 0, 1.2, -4.7, 12, 2.4, .55, material(0x26343a, .56, .22)); for (const x of [-5, -2.5, 0, 2.5, 5]) { box(root, x, 2.8, -4.45, .08, 2.6, .08, cyan); box(root, x, 1.6, -4.45, 1.2, .08, .08, cyan); } for (const x of [-6.2, 6.2]) cylinder(root, x, 2.4, 0, .08, 4.8, magenta, 12); box(root, 0, 4.55, -5.2, 11, .12, .12, cyan); return root; }
function stage() { const root = new THREE.Group(); root.name = 'velvet-stage-club'; const wall = material(0x351b38, .18, .44); const floor = material(0x2b1730, .18, .4); const pink = material(0xf05ab9, .25, .3, 0x5e163d); const gold = material(0xd4a15d, .68, .2); roomShell(root, 18, 14, wall, floor); cylinder(root, 0, .28, 1.2, 3.4, .42, pink, 32); cylinder(root, 0, 2.15, 1.2, .08, 3.4, gold, 16); box(root, 0, 1.1, -5.3, 12, 1.8, .5, material(0x54213d, .26, .34)); for (const x of [-5.5, 5.5]) cylinder(root, x, 2.2, -1.6, 1.0, .28, material(0x3f2740, .18, .52), 20); chandelier(root, 4.6, 2.1, pink); return root; }
function bar() { const root = new THREE.Group(); root.name = 'midnight-mile-bar-28'; const wall = material(0x2e302d, .2, .46); const floor = material(0x3f332d, .18, .48); const wood = material(0x6a4930, .22, .33); const amber = material(0xe0a45e, .35, .3, 0x5b3212); roomShell(root, 20, 15, wall, floor); box(root, 0, 1.15, -5.5, 15, 1.8, 1.1, wood); box(root, 0, 2.05, -5.5, 15.3, .14, 1.25, amber); for (const x of [-6, -3, 0, 3, 6]) cylinder(root, x, .65, -4, .38, 1.0, wood, 16); for (const x of [-6, 6]) cylinder(root, x, 3.0, 0, .08, 3.7, amber, 12); for (const x of [-5, 0, 5]) box(root, x, 2.3, 3.8, 2.2, 1.4, .15, material(0x5b3a2e, .18, .4)); chandelier(root, 4.8, 2.0, amber); return root; }

const assets = [
  ['luxury-hotel-lobby', lobby()],
  ['hotel-suite-hosting', suite()],
  ['neon-arsenal-shop', arsenal()],
  ['velvet-stage-club', stage()],
  ['midnight-mile-bar-28', bar()],
];
const exporter = new GLTFExporter();
for (const [name, scene] of assets) {
  const binary = await new Promise((resolve, reject) => exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true }));
  await writeFile(path.join(outputDir, `${name}.glb`), Buffer.from(binary));
  console.log(`${name}.glb ${binary.byteLength} bytes`);
}
