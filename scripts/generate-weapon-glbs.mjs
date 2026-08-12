import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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

function mat(color, metalness = .72, roughness = .28, name = '') {
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness }); material.name = name; return material;
}
function box(root, x, y, z, sx, sy, sz, material) {
  const radius = Math.min(.055, sx * .12, sy * .18, sz * .18);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(sx, sy, sz, 3, Math.max(.008, radius)), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
}
function barrel(root, x, y, z, length, radius, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
  mesh.rotation.z = Math.PI / 2; mesh.position.set(x, y, z); mesh.castShadow = true; root.add(mesh); return mesh;
}
function ring(root, x, y, z, radius, tube, material, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 28), material); mesh.position.set(x, y, z); mesh.rotation.y = rotationY; root.add(mesh); return mesh;
}
function rail(root, x, y, length, material) {
  box(root, x, y, 0, length, .055, .22, material);
  for (let offset = -length / 2 + .08; offset < length / 2; offset += .13) box(root, x + offset, y + .045, 0, .045, .055, .3, material);
}
function profile(root, points, depth, material) {
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: .025, bevelThickness: .025, curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
}
function grip(root, x, y, material, angle = -.18) {
  const mesh = profile(root, [[-.085,.13],[.095,.12],[.11,-.29],[-.045,-.36],[-.13,-.25]], .19, material); mesh.position.set(x, y, 0); mesh.rotation.z = angle; return mesh;
}
function curvedMagazine(root, x, y, material, scale = 1) {
  const mesh = profile(root, [[-.095,.1],[.1,.1],[.135,-.31],[.04,-.5],[-.09,-.45],[-.13,-.2]], .18, material); mesh.position.set(x, y, 0); mesh.scale.setScalar(scale); return mesh;
}
function detailPack(root, category, dark, trim, accent) {
  const longGun = ['smg', 'ar', 'rifle', 'sniper', 'shotgun'].includes(category);
  if (longGun) {
    rail(root, .12, .34, category === 'sniper' ? 1.55 : 1.05, trim);
    box(root, -.28, -.16, 0, .07, .27, .16, dark);
    ring(root, -.14, -.03, 0, .16, .025, trim, Math.PI / 2);
    for (const x of [.42, .58, .74]) box(root, x, .04, .17, .035, .14, .025, trim);
    box(root, .62, -.11, 0, .56, .09, .3, trim);
    box(root, -.08, .08, .171, .34, .13, .018, dark);
    barrel(root, -.48, .08, .176, .045, .028, trim).rotation.x = Math.PI / 2;
    box(root, .28, .19, .176, .22, .035, .02, accent);
  }
  if (category === 'pistol') {
    for (const x of [-.48, -.39, -.3]) box(root, x, .22, .15, .025, .13, .018, trim);
    box(root, .38, .29, 0, .06, .06, .1, accent); box(root, -.42, .29, 0, .08, .06, .1, trim);
    ring(root, -.03, -.06, 0, .16, .025, trim, Math.PI / 2);
    box(root, .08, .12, .151, .28, .08, .018, dark);
  }
  if (category === 'minigun') { ring(root, .58, .12, 0, .3, .04, trim, Math.PI / 2); ring(root, 1.28, .12, 0, .25, .035, trim, Math.PI / 2); }
  if (category === 'rpg') { ring(root, -.8, .18, 0, .33, .055, trim, Math.PI / 2); ring(root, .82, .18, 0, .34, .05, trim, Math.PI / 2); }
  for (const side of [-1, 1]) box(root, -.02, .13, side * .18, .055, .055, .025, accent);
}
function makeWeapon(category, accent) {
  const root = new THREE.Group();
  root.name = `${category}-weapon`;
  const receiver = mat(0x252b2f, .92, .24, 'weapon-receiver');
  const accentMaterial = mat(accent, .72, .3, 'weapon-accent');
  const dark = mat(0x111417, .72, .38, 'weapon-polymer');
  const trim = mat(0x596168, .96, .17, 'weapon-machined-trim');
  if (category === 'pistol') {
    profile(root, [[-.62,.03],[-.52,.24],[.5,.24],[.62,.12],[.52,-.05],[-.2,-.08],[-.34,-.18]], .25, receiver);
    grip(root, -.27, -.1, dark, -.12); barrel(root, .64, .12, 0, .34, .042, trim); box(root, .08, -.08, 0, .32, .065, .2, dark);
  }
  else if (category === 'smg') {
    profile(root, [[-.72,.27],[.5,.27],[.72,.1],[.58,-.12],[-.62,-.12]], .27, receiver); grip(root, -.35, -.12, dark); curvedMagazine(root, .12, -.12, dark, .78);
    barrel(root, .93, .08, 0, .58, .045, trim); box(root, -.98, .1, 0, .58, .075, .15, trim); profile(root, [[-1.28,.18],[-.92,.2],[-.92,-.05],[-1.3,-.16]], .2, dark);
  }
  else if (category === 'ar') {
    profile(root, [[-.68,.28],[.5,.28],[.7,.1],[.48,-.16],[-.5,-.14],[-.72,.02]], .28, receiver); grip(root, -.38, -.14, dark); curvedMagazine(root, .08, -.14, dark, .88);
    box(root, .92, .08, 0, .92, .18, .23, receiver); barrel(root, 1.62, .09, 0, .72, .035, trim); box(root, -1.02, .08, 0, .62, .075, .13, trim);
    profile(root, [[-1.48,.25],[-.85,.19],[-.85,-.08],[-1.38,-.22],[-1.52,-.1]], .23, dark);
  }
  else if (category === 'rifle') {
    profile(root, [[-.82,.24],[.46,.24],[.66,.08],[.45,-.1],[-.72,-.12],[-.92,.02]], .25, receiver); grip(root, -.5, -.12, dark); curvedMagazine(root, .08, -.12, dark, .65);
    box(root, .92, .08, 0, .95, .145, .2, receiver); barrel(root, 1.72, .09, 0, .95, .03, trim);
    profile(root, [[-1.65,.22],[-.78,.2],[-.8,-.08],[-1.56,-.26],[-1.72,-.1]], .24, dark);
  }
  else if (category === 'sniper') {
    profile(root, [[-1.18,.22],[.62,.22],[.76,.04],[.5,-.12],[-.82,-.12],[-1.05,-.25],[-1.42,-.18]], .24, receiver); grip(root, -.58, -.12, dark); curvedMagazine(root, .14, -.12, dark, .52);
    barrel(root, 1.78, .08, 0, 1.85, .027, trim); barrel(root, .05, .42, 0, .88, .072, trim);
    profile(root, [[-1.82,.18],[-1.08,.18],[-1.08,-.12],[-1.68,-.28],[-1.88,-.14]], .22, dark);
  }
  else if (category === 'shotgun') {
    profile(root, [[-.95,.2],[.48,.2],[.62,.04],[.42,-.12],[-.82,-.1]], .28, receiver); grip(root, -.55, -.1, dark, -.1);
    barrel(root, 1.45, .14, -.055, 1.7, .04, trim); barrel(root, 1.18, -.01, .055, 1.18, .047, trim); box(root, .55, -.04, 0, .58, .15, .27, dark);
    profile(root, [[-1.65,.25],[-.82,.18],[-.84,-.1],[-1.55,-.3],[-1.72,-.12]], .28, dark);
  }
  else if (category === 'minigun') { box(root, -.25, .12, 0, 1.5, .3, .44, receiver); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .8, 12), trim); b.rotation.z = Math.PI / 2; b.position.set(.92, .12 + Math.cos(a) * .15, Math.sin(a) * .15); root.add(b); } box(root, -.45, -.25, 0, .23, .58, .3, dark); }
  else if (category === 'rpg') { barrel(root, 0, .18, 0, 2.4, .22, receiver); box(root, -.65, -.17, 0, .22, .5, .3, dark); box(root, .65, .18, 0, .12, .5, .5, accentMaterial); }
  else if (category === 'emp') { const sphere = new THREE.Mesh(new THREE.SphereGeometry(.48, 24, 16), new THREE.MeshStandardMaterial({ color: accent, emissive: 0x53d9e6, emissiveIntensity: 1.6, metalness: .48, roughness: .2 })); sphere.position.y = .35; root.add(sphere); box(root, 0, -.2, 0, .52, .18, .52, dark); }
  else if (category === 'explosive') { box(root, 0, .3, 0, .72, .52, .72, receiver); box(root, 0, .3, -.38, .28, .28, .035, accentMaterial); box(root, 0, .75, 0, .06, .32, .06, dark); }
  detailPack(root, category, dark, trim, accentMaterial);
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
