import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const WHEELS = ['front_left_wheel', 'front_right_wheel', 'rear_left_wheel', 'rear_right_wheel'];
const roundedGeometryCache = new Map();
const cylinderGeometryCache = new Map();

function material(name, color, metalness = .5, roughness = .28, extra = {}) {
  const value = new THREE.MeshPhysicalMaterial({ color, metalness, roughness, ...extra });
  value.name = name;
  return value;
}

function rounded(root, name, position, size, mat, radius = .08) {
  const safeRadius = Math.min(radius, ...size.map((value) => value * .2));
  const key = [...size.map((value) => value.toFixed(4)), safeRadius.toFixed(4)].join(':');
  if (!roundedGeometryCache.has(key)) roundedGeometryCache.set(key, new RoundedBoxGeometry(size[0], size[1], size[2], 2, safeRadius));
  const geometry = roundedGeometryCache.get(key);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function sideProfile(root, name, points, depth, mat, z = 0, bevel = .035) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) shape.lineTo(point[0], point[1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel, curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.z = z;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function cylinder(root, name, position, radius, depth, mat, segments = 24) {
  const key = `${radius.toFixed(4)}:${depth.toFixed(4)}:${segments}`;
  if (!cylinderGeometryCache.has(key)) cylinderGeometryCache.set(key, new THREE.CylinderGeometry(radius, radius, depth, segments));
  const mesh = new THREE.Mesh(cylinderGeometryCache.get(key), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  root.add(mesh);
  return mesh;
}

function wheel(root, name, x, y, z, radius, width, mats, sport) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, y, z);
  const tire = cylinder(group, `${name}_tire`, [0, 0, 0], radius, width, mats.tire, 32);
  tire.geometry.groups.length = 0;
  cylinder(group, `${name}_rim`, [0, 0, z < 0 ? -.012 : .012], radius * .61, width * 1.03, mats.rim, 32);
  cylinder(group, `${name}_disc`, [0, 0, z < 0 ? -.02 : .02], radius * .43, width * 1.05, mats.disc, 28);
  const faceZ = z < 0 ? -width * .54 : width * .54;
  for (let i = 0; i < (sport ? 10 : 7); i++) {
    const angle = i / (sport ? 10 : 7) * Math.PI * 2;
    const spoke = rounded(group, `${name}_spoke_${i}`, [Math.cos(angle) * radius * .27, Math.sin(angle) * radius * .27, faceZ], [radius * .08, radius * .54, .025], mats.spoke, .015);
    spoke.rotation.z = angle;
  }
  rounded(group, `${name}_caliper`, [radius * .3, 0, faceZ], [radius * .13, radius * .38, .045], mats.caliper, .025);
  cylinder(group, `${name}_hub`, [0, 0, faceZ], radius * .11, .05, mats.dark, 20);
  root.add(group);
  return group;
}

function addFrontDetails(root, L, W, H, category, mats) {
  const grilleHeight = category === 'truck' || category === 'suv' || category === 'van' ? H * .32 : H * .2;
  rounded(root, 'front_grille', [L * .493, H * .42, 0], [.055, grilleHeight, W * .56], mats.grille, .025);
  for (let z = -W * .24; z <= W * .24; z += W * .08) rounded(root, `grille_vane_${z.toFixed(2)}`, [L * .526, H * .42, z], [.018, grilleHeight * .82, .018], mats.rim, .008);
  for (const side of [-1, 1]) {
    rounded(root, side < 0 ? 'headlight_left' : 'headlight_right', [L * .51, H * .58, side * W * .33], [.07, H * .105, W * .2], mats.headlight, .03);
    rounded(root, side < 0 ? 'intake_left' : 'intake_right', [L * .515, H * .31, side * W * .36], [.055, H * .13, W * .16], mats.dark, .025);
  }
  rounded(root, 'front_splitter', [L * .5, H * .19, 0], [.2, .055, W * .88], mats.dark, .025);
}

function addRearDetails(root, L, W, H, category, mats) {
  for (const side of [-1, 1]) rounded(root, side < 0 ? 'taillight_left' : 'taillight_right', [-L * .505, H * .55, side * W * .3], [.06, H * .095, W * .22], mats.taillight, .025);
  rounded(root, 'rear_diffuser', [-L * .5, H * .21, 0], [.18, .09, W * .82], mats.dark, .025);
  for (const side of [-1, 1]) cylinder(root, `exhaust_${side}`, [-L * .53, H * .23, side * W * .27], category === 'sport' || category === 'performance' ? .07 : .055, .13, mats.exhaust, 20).rotation.y = Math.PI / 2;
}

export function buildDetailedVehicle({ id, name, brand = 'STH Motors', category = 'car', length: L = 4.6, width: W = 1.9, height: H = 1.45, color = 0x485a6b, years = '2026' }) {
  const root = new THREE.Group();
  root.name = `${id}_root`;
  const type = category.toLowerCase();
  const sport = /sport|performance|supercar|hypercar|roadster|coupe|muscle|lowrider|grand-tourer/.test(type);
  const truck = type === 'truck';
  const van = type === 'van';
  const suv = type === 'suv';
  const convertible = /roadster|convertible|coachbuilt/.test(type);
  const wheelRadius = truck ? .47 : suv || van ? .43 : sport ? .37 : .36;
  const wheelWidth = sport ? .28 : .25;
  const wheelY = wheelRadius;
  const axleX = truck ? L * .34 : L * .32;
  const bodyBottom = wheelRadius * .58;
  const belt = sport ? H * .59 : H * .62;
  const mats = {
    paint: material('vehicle-paint', color, .72, .18, { clearcoat: 1, clearcoatRoughness: .12 }),
    trim: material('vehicle-trim', 0x24292d, .78, .24),
    dark: material('vehicle-dark', 0x101317, .48, .4),
    glass: material('vehicle-glass', 0x213b49, .25, .1, { transparent: true, opacity: .78, transmission: .18, clearcoat: 1 }),
    tire: material('vehicle-tire', 0x111315, .08, .78), rim: material('vehicle-rim', 0xaeb7bc, .95, .12),
    spoke: material('vehicle-spokes', 0x687078, .92, .16), disc: material('vehicle-brake-disc', 0x6b7073, .88, .24),
    caliper: material('vehicle-brake-caliper', sport ? 0xd54a38 : 0x30363b, .76, .2), grille: material('vehicle-grille', 0x171a1d, .7, .3),
    exhaust: material('vehicle-exhaust', 0x858c90, .96, .12),
    headlight: material('vehicle-headlight', 0xe8f7ff, .18, .08, { emissive: 0x72b9d6, emissiveIntensity: 2.1 }),
    taillight: material('vehicle-taillight', 0xc92735, .22, .12, { emissive: 0x630711, emissiveIntensity: 1.8 }),
    interior: material('vehicle-interior', 0x17191c, .12, .58),
  };

  const noseY = sport ? belt * .83 : belt;
  const bodyPoints = [[-L*.5,bodyBottom],[-L*.47,belt*.72],[-L*.35,belt],[-L*.08,belt*1.04],[L*.23,noseY*1.03],[L*.43,noseY],[L*.5,noseY*.72],[L*.48,bodyBottom]];
  sideProfile(root, 'sculpted_body', bodyPoints, W * .9, mats.paint, 0, .045);
  rounded(root, 'lower_chassis', [0, bodyBottom + .1, 0], [L * .9, .22, W * .88], mats.trim, .07);

  if (truck) {
    sideProfile(root, 'cab', [[-.05,belt],[-.02,H*.92],[L*.22,H],[L*.37,H*.86],[L*.4,belt]], W*.76, mats.glass, 0, .035);
    rounded(root, 'cab_roof', [L*.18,H*.96,0], [L*.38,.1,W*.8], mats.paint, .04);
    rounded(root, 'pickup_bed', [-L*.32,belt*.88,0], [L*.34,H*.36,W*.88], mats.paint, .06);
    rounded(root, 'bed_liner', [-L*.32,belt*1.04,0], [L*.31,.055,W*.72], mats.dark, .02);
  } else {
    const cabinRear = van ? -L*.39 : suv ? -L*.32 : -L*.28;
    const cabinFront = van ? L*.28 : suv ? L*.22 : L*.19;
    const roofY = sport ? H*.94 : H*.98;
    sideProfile(root, 'glasshouse', [[cabinRear,belt],[cabinRear+L*.06,roofY*.88],[-L*.16,roofY],[cabinFront-L*.05,roofY*.95],[cabinFront,belt]], W*.72, mats.glass, 0, .025);
    if (!convertible) rounded(root, 'roof', [-L*.07,roofY,0], [van?L*.56:suv?L*.47:L*.36,.09,W*.75], mats.paint, .04);
    rounded(root, 'dashboard', [L*.09,belt+.02,0], [L*.14,.08,W*.59], mats.interior, .025);
    for (const side of [-1,1]) rounded(root, `seat_${side}`, [-L*.13,belt-.02,side*W*.19], [L*.14,H*.3,W*.18], mats.interior, .06);
  }

  rounded(root, 'hood_center', [L*.31,noseY+.045,0], [L*.31,.075,W*.76], mats.paint, .035);
  rounded(root, 'rear_deck', [-L*.39,belt+.015,0], [L*.17,.07,W*.78], mats.paint, .03);
  for (const side of [-1, 1]) {
    rounded(root, `side_skirt_${side}`, [0, bodyBottom+.02,side*W*.465], [L*.68,.11,.075], mats.dark, .025);
    rounded(root, `mirror_${side}`, [L*.08,belt+.16,side*W*.48], [.19,.09,.13], mats.paint, .04);
    rounded(root, `door_handle_front_${side}`, [-L*.02,belt-.09,side*W*.472], [.22,.035,.025], mats.rim, .012);
    if (!sport) rounded(root, `door_handle_rear_${side}`, [-L*.25,belt-.09,side*W*.472], [.2,.035,.025], mats.rim, .012);
    const archMat = mats.trim;
    const frontArch = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius*1.1,.035,10,30,Math.PI),archMat); frontArch.name=`front_arch_${side}`; frontArch.rotation.set(Math.PI/2,0,side<0?0:Math.PI); frontArch.position.set(axleX,wheelY,side*W*.47); root.add(frontArch);
    const rearArch = frontArch.clone(); rearArch.name=`rear_arch_${side}`; rearArch.position.x=-axleX; root.add(rearArch);
  }
  addFrontDetails(root,L,W,H,type,mats);
  addRearDetails(root,L,W,H,type,mats);
  for (const [x,z,key] of [[axleX,-W*.49,WHEELS[0]],[axleX,W*.49,WHEELS[1]],[-axleX,-W*.49,WHEELS[2]],[-axleX,W*.49,WHEELS[3]]]) wheel(root,key,x,wheelY,z,wheelRadius,wheelWidth,mats,sport);
  root.userData = { assetId:id, displayName:name, brand, category, years, scale:'1 unit = 1 meter', wheelNodes:WHEELS, detailLevel:'high' };
  return root;
}

export const vehicleWheelNodes = WHEELS;
