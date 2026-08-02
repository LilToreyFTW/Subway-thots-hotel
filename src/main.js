import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const ageGate = $('#age-gate');
const roleCards = [...document.querySelectorAll('.role-card')];
let selectedRole = 'guest';
let started = false;
let onlineProfile = JSON.parse(localStorage.getItem('sth-online-profile') || 'null');
let creatorGender = 'female';
const creatorSelection = { face: 'Face_01', arms: 'Arms_01', torso: 'Torso_01', legs: 'Legs_01' };
const inventoryItems = [
  { key: 'phone', icon: '▣', name: 'Phone', qty: 1 },
  { key: 'water', icon: '♒', name: 'Water Bottle', qty: 2 },
  { key: 'food', icon: '◆', name: 'Street Food', qty: 1 },
  { key: 'radio', icon: '◉', name: 'Radio', qty: 1 },
  { key: 'keys', icon: '⌁', name: 'Hotel Keys', qty: 1 },
  null,
];
let selectedInventorySlot = 0;
let friends = JSON.parse(localStorage.getItem('sth-online-friends') || '[]');
let friendTab = 'online';

function profileTag(name) {
  const used = new Set(JSON.parse(localStorage.getItem('sth-used-gamertags') || '[]'));
  let number;
  do number = String(100000 + Math.floor(Math.random() * 900000)); while (used.has(`${name}#${number}`));
  const tag = `${name}#${number}`;
  used.add(tag);
  localStorage.setItem('sth-used-gamertags', JSON.stringify([...used]));
  return { name, number, tag };
}
async function reserveGamertag(name) {
  try {
    const protocol = location.protocol === 'https:' ? 'https' : 'http';
    const base = window.STH_WORLD_URL ? window.STH_WORLD_URL.replace(/^ws/, 'http').replace(/\/$/, '') : `${protocol}://${location.hostname || '127.0.0.1'}:8000`;
    const response = await fetch(`${base}/gamertag/allocate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) });
    const result = await response.json();
    if (result.ok) return result;
  } catch (_) { /* local fallback keeps the first-playable client usable offline */ }
  return profileTag(name);
}
function showGlobalToast(message) { const el = $('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(window.sthToastTimer); window.sthToastTimer = setTimeout(() => el.classList.remove('show'), 2400); }
function openGamertagModal() { $('#gamertag-modal').hidden = false; $('#gamertag-input').focus(); }
function creatorPrefix(category) { return creatorGender === 'male' ? `Male_${category[0].toUpperCase()}${category.slice(1)}` : category[0].toUpperCase() + category.slice(1); }
function renderCreatorSlots() {
  const root = $('#creator-slots'); root.innerHTML = '';
  for (const category of ['face', 'arms', 'torso', 'legs']) {
    const group = document.createElement('section'); group.className = 'creator-group';
    const title = document.createElement('h3'); title.textContent = category.toUpperCase(); group.appendChild(title);
    const grid = document.createElement('div'); grid.className = 'slot-grid';
    const prefix = creatorPrefix(category);
    for (let i = 1; i <= 10; i++) {
      const key = `${prefix}_${String(i).padStart(2, '0')}`; const button = document.createElement('button'); button.textContent = key; button.dataset.category = category; button.dataset.key = key; button.classList.toggle('selected', creatorSelection[category] === key);
      button.onclick = () => { creatorSelection[category] = key; renderCreatorSlots(); updateCreatorSummary(); };
      grid.appendChild(button);
    }
    group.appendChild(grid); root.appendChild(group);
  }
  updateCreatorSummary();
}
function updateCreatorSummary() { $('#creator-selection-summary').textContent = `${creatorGender.toUpperCase()} · ${Object.values(creatorSelection).join(' · ')}`; }
function openCreatorModal() { $('#creator-modal').hidden = false; $('#creator-tag').textContent = onlineProfile.tag; renderCreatorSlots(); }
function closeOnlinePanels() { $('#friends-panel').hidden = true; $('#inventory-hotbar').hidden = true; }
function toggleFriends(force) { const panel = $('#friends-panel'); panel.hidden = typeof force === 'boolean' ? !force : !panel.hidden; if (!panel.hidden) renderFriends(); }
function toggleInventory(force) { const bar = $('#inventory-hotbar'); bar.hidden = typeof force === 'boolean' ? !force : !bar.hidden; if (!bar.hidden) renderHotbar(); }
function renderHotbar() { const root = $('#hotbar-slots'); root.innerHTML = ''; inventoryItems.forEach((item, index) => { const slot = document.createElement('button'); slot.className = `hotbar-slot${selectedInventorySlot === index ? ' selected' : ''}`; slot.innerHTML = `<kbd>${index + 1}</kbd><span class="item-icon">${item?.icon || '·'}</span><strong>${item?.name || 'Empty'}</strong><small>${item?.qty ? `Qty ${item.qty}` : '—'}</small>`; slot.onclick = () => useInventorySlot(index); root.appendChild(slot); }); }
function useInventorySlot(index) { selectedInventorySlot = index; const item = inventoryItems[index]; renderHotbar(); if (!item) return; if (item.key === 'water' || item.key === 'food') { if (item.qty > 0) item.qty -= 1; showGlobalToast(`${item.name} used · needs restored.`); } else if (item.key === 'radio') showGlobalToast('Radio menu ready.'); else if (item.key === 'phone') showGlobalToast('Phone opened.'); else if (item.key === 'keys') showGlobalToast('Hotel keys equipped.'); else showGlobalToast(`${item.name} equipped.`); renderHotbar(); }
function renderFriends() {
  const list = $('#friends-list'); list.innerHTML = '';
  const visible = friends.filter((friend) => friendTab === 'pending' ? friend.status === 'Pending' : friend.status.toLowerCase().includes(friendTab === 'online' ? 'online' : 'offline'));
  $('#friends-online-count').textContent = `${friends.filter((friend) => friend.status === 'Online').length} ONLINE`;
  if (!visible.length) { list.innerHTML = '<p class="friend-empty">No players in this list yet.</p>'; return; }
  visible.forEach((friend) => { const row = document.createElement('article'); row.className = 'friend-entry'; row.innerHTML = `<div class="friend-avatar">${friend.tag[0]}</div><div><strong>${friend.tag}</strong><small>${friend.status}</small></div><div class="friend-actions"><button data-action="invite">INVITE</button><button data-action="message">MESSAGE</button><button data-action="remove">REMOVE</button></div>`; row.querySelector('[data-action="remove"]').onclick = () => { friends = friends.filter((item) => item.tag !== friend.tag); localStorage.setItem('sth-online-friends', JSON.stringify(friends)); renderFriends(); }; list.appendChild(row); });
}
function addFriendRequest() { const input = $('#friend-search'); const tag = input.value.trim(); if (!/^[A-Za-z0-9._-]{3,16}#\d{6}$/.test(tag)) return showGlobalToast('Use a full Name#XXXXXX gamertag.'); if (friends.some((friend) => friend.tag === tag)) return showGlobalToast('That gamertag is already in your friends list.'); friends.push({ tag, status: 'Pending' }); localStorage.setItem('sth-online-friends', JSON.stringify(friends)); input.value = ''; friendTab = 'pending'; document.querySelectorAll('[data-friend-tab]').forEach((tab) => tab.classList.toggle('selected', tab.dataset.friendTab === friendTab)); renderFriends(); showGlobalToast(`Friend request queued for ${tag}.`); }

roleCards.forEach((card) => {
  card.addEventListener('click', () => {
    roleCards.forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    card.querySelector('input').checked = true;
    selectedRole = card.querySelector('input').value;
  });
});

$('#enter-btn').addEventListener('click', () => {
  if (started) return;
  if (onlineProfile) { started = true; ageGate.classList.add('hidden'); startGame(selectedRole); return; }
  ageGate.classList.add('hidden'); openGamertagModal();
});
$('#gamertag-input').addEventListener('input', () => { const value = $('#gamertag-input').value.trim(); $('#gamertag-preview').innerHTML = `Your tag: <strong>${/^[A-Za-z0-9._-]{3,16}$/.test(value) ? `${value}#XXXXXX` : '—'}</strong>`; });
$('#gamertag-submit').addEventListener('click', async () => { const name = $('#gamertag-input').value.trim(); if (!/^[A-Za-z0-9._-]{3,16}$/.test(name)) { $('#gamertag-error').textContent = 'Use 3–16 letters, numbers, dots, underscores, or hyphens.'; return; } const submit = $('#gamertag-submit'); submit.disabled = true; submit.textContent = 'RESERVING TAG…'; const reserved = await reserveGamertag(name); onlineProfile = { ...reserved, gender: creatorGender, selections: { ...creatorSelection }, createdAt: new Date().toISOString() }; submit.disabled = false; submit.textContent = 'CONTINUE TO CHARACTER CREATOR →'; $('#gamertag-error').textContent = ''; openCreatorModal(); $('#gamertag-modal').hidden = true; });
document.querySelectorAll('.gender-tabs button').forEach((button) => button.addEventListener('click', () => { creatorGender = button.dataset.gender; document.querySelectorAll('.gender-tabs button').forEach((item) => item.classList.toggle('selected', item === button)); creatorSelection.face = creatorGender === 'male' ? 'Male_Face_01' : 'Face_01'; creatorSelection.arms = creatorGender === 'male' ? 'Male_Arms_01' : 'Arms_01'; creatorSelection.torso = creatorGender === 'male' ? 'Male_Torso_01' : 'Torso_01'; creatorSelection.legs = creatorGender === 'male' ? 'Male_Legs_01' : 'Legs_01'; renderCreatorSlots(); }));
$('#creator-submit').addEventListener('click', () => { onlineProfile.gender = creatorGender; onlineProfile.selections = { ...creatorSelection }; localStorage.setItem('sth-online-profile', JSON.stringify(onlineProfile)); $('#creator-modal').hidden = true; started = true; startGame(selectedRole); });
$('#friends-close').addEventListener('click', () => toggleFriends(false)); $('#friend-add-btn').addEventListener('click', addFriendRequest); document.querySelectorAll('[data-friend-tab]').forEach((tab) => tab.addEventListener('click', () => { friendTab = tab.dataset.friendTab; document.querySelectorAll('[data-friend-tab]').forEach((item) => item.classList.toggle('selected', item === tab)); renderFriends(); }));
addEventListener('keydown', (event) => { if (event.target instanceof Element && event.target.matches('input,textarea')) return; const key = event.key.toLowerCase(); if (key === 'f' && !event.repeat) toggleFriends(); if (key === 'z' && !event.repeat) toggleInventory(); if (key >= '1' && key <= '6' && !event.repeat && !$('#creator-modal')?.hidden) return; if (key >= '1' && key <= '6' && !event.repeat && onlineProfile) useInventorySlot(Number(key) - 1); if (key === 'escape') { if (!$('#friends-panel').hidden || !$('#inventory-hotbar').hidden) closeOnlinePanels(); } });

function startGame(role) {
  const canvas = $('#game');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111820);
  scene.fog = new THREE.FogExp2(0x111820, 0.009);

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, 310);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  const isWebGL2 = renderer.capabilities.isWebGL2;
  const maxTextureSize = renderer.capabilities.maxTextureSize;
  const quality = isWebGL2 && maxTextureSize >= 8192 && innerWidth > 700 ? 'high' : 'balanced';

  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.7 : 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (quality === 'high') {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.13, 0.48, 0.88));
  }
  composer.addPass(new OutputPass());

  const clock = new THREE.Clock();
  const city = new THREE.Group();
  const hotel = new THREE.Group();
  const suite = new THREE.Group();
  scene.add(city, hotel, suite);
  hotel.visible = false;
  suite.visible = false;

  let mode = role === 'manager' ? 'hotel' : 'city';
  let cameraMode = 'third';
  let cameraYaw = Math.PI;
  let cameraPitch = 0.28;
  let cameraDistance = 7.4;
  let cameraDragging = false;
  let jumpQueued = false;
  let verticalVelocity = 0;
  let currentRoom = null;
  let paused = false;
  let rep = 12;
  let cash = role === 'manager' ? 420 : 240;
  let taskCount = 0;
  let checkedIn = false;
  let slept = false;
  let nearby = null;
  let toastTimer;
  let worldSocket = null;
  let lastNetworkSend = 0;
  let ambience = null;
  let timeOfNight = 23 * 60 + 48;
  const keys = Object.create(null);
  const cityColliders = [];
  const interactables = [];
  const npcs = [];
  const vehicles = [];
  const rainDrops = [];
  const tempWorld = new THREE.Vector3();
  const targetCamera = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();

  $('#role-stat').textContent = role === 'manager' ? 'MANAGER' : 'GUEST';
  $('#cash').textContent = cash;

  const seeded = (() => {
    let seed = 47381;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  })();

  const materials = {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x171d22, roughness: 0.94, metalness: 0.03 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x596065, roughness: 0.85 }),
    wetConcrete: new THREE.MeshPhysicalMaterial({ color: 0x384047, roughness: 0.28, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.25 }),
    hotelStone: new THREE.MeshStandardMaterial({ color: 0x776b5b, roughness: 0.72 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x171c21, roughness: 0.28, metalness: 0.82 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8ba8b2, roughness: 0.08, metalness: 0.1, transmission: 0.22, transparent: true, opacity: 0.72 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xb98c45, roughness: 0.25, metalness: 0.78 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x321c24, roughness: 0.96 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a2f25, roughness: 0.65 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.91 }),
  };

  function material(color, roughness = 0.66, metalness = 0.05) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function box(parent, x, y, z, sx, sy, sz, meshMaterial, shadows = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), meshMaterial);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, x, y, z, radius, height, meshMaterial, sides = 18) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), meshMaterial);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function labelTexture(text, foreground = '#e9c27b', background = '#111519', width = 768, height = 180) {
    const label = document.createElement('canvas');
    label.width = width;
    label.height = height;
    const ctx = label.getContext('2d');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.strokeRect(5, 5, width - 10, height - 10);
    ctx.fillStyle = foreground;
    ctx.font = `600 ${Math.floor(height * 0.48)}px Arial Narrow, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + 3);
    const texture = new THREE.CanvasTexture(label);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  function windowTexture(base, warmChance = 0.48) {
    const surface = document.createElement('canvas');
    surface.width = 256;
    surface.height = 512;
    const ctx = surface.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 512);
    for (let y = 18; y < 495; y += 42) {
      for (let x = 15; x < 245; x += 35) {
        const lit = seeded() < warmChance;
        ctx.fillStyle = lit ? (seeded() < 0.74 ? '#d7b878' : '#7aa3a5') : '#11191d';
        ctx.fillRect(x, y, 20, 25);
        ctx.fillStyle = lit ? 'rgba(255,238,190,.18)' : 'rgba(0,0,0,.2)';
        ctx.fillRect(x + 2, y + 2, 16, 3);
      }
    }
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  function addSky() {
    const geometry = new THREE.SphereGeometry(260, 32, 18);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { topColor: { value: new THREE.Color(0x091421) }, bottomColor: { value: new THREE.Color(0x3b4344) }, offset: { value: 12 }, exponent: { value: 0.75 } },
      vertexShader: 'varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition+offset).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }',
    });
    scene.add(new THREE.Mesh(geometry, skyMaterial));

    const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 18), new THREE.MeshBasicMaterial({ color: 0xcbd2d3 }));
    moon.position.set(-78, 92, -148);
    scene.add(moon);
  }

  function addLighting() {
    const hemisphere = new THREE.HemisphereLight(0x6f8798, 0x16110f, 1.35);
    scene.add(hemisphere);
    const moonlight = new THREE.DirectionalLight(0xa8b8c8, 2.2);
    moonlight.position.set(-55, 85, 35);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    moonlight.shadow.camera.left = -70;
    moonlight.shadow.camera.right = 70;
    moonlight.shadow.camera.top = 70;
    moonlight.shadow.camera.bottom = -70;
    moonlight.shadow.camera.far = 190;
    moonlight.shadow.bias = -0.00018;
    scene.add(moonlight);
  }

  function makeCharacter({ gender = 'female', coat = 0x303844, skin = 0x9a5f43, hair = 0x171310, accent = 0xb7894d, player = false } = {}) {
    const root = new THREE.Group();
    const cloth = material(coat, 0.72, 0.04);
    const skinMat = material(skin, 0.75, 0.01);
    const hairMat = material(hair, 0.9, 0.01);
    const shoeMat = material(0x111315, 0.35, 0.25);
    const accentMat = material(accent, 0.5, 0.15);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(gender === 'female' ? 0.29 : 0.34, 0.78, 6, 12), cloth);
    torso.position.y = 1.45;
    torso.scale.z = gender === 'female' ? 0.76 : 0.82;
    torso.castShadow = true;
    root.add(torso);

    const neck = cylinder(root, 0, 2.02, 0, 0.115, 0.25, skinMat, 12);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14), skinMat);
    head.position.y = 2.24;
    head.scale.set(0.9, 1.08, 0.9);
    head.castShadow = true;
    root.add(head);

    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.256, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hairMesh.position.set(0, 2.33, 0.015);
    hairMesh.rotation.x = -0.08;
    root.add(hairMesh);

    const hip = box(root, 0, 0.94, 0, gender === 'female' ? 0.52 : 0.58, 0.25, 0.34, cloth);
    hip.geometry.translate(0, 0, 0);
    const limbGeometry = new THREE.CapsuleGeometry(0.105, 0.62, 4, 8);
    const legMaterial = gender === 'female' ? material(0x25292d, 0.78) : cloth;
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      const legMesh = new THREE.Mesh(limbGeometry, legMaterial);
      legMesh.position.y = -0.38;
      legMesh.castShadow = true;
      leg.add(legMesh);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.42), shoeMat);
      shoe.position.set(0, -0.82, -0.07);
      shoe.castShadow = true;
      leg.add(shoe);
      leg.position.set(side * 0.17, 0.84, 0);
      root.add(leg);
      legs.push(leg);

      const arm = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.58, 4, 8), cloth);
      sleeve.position.y = -0.35;
      sleeve.castShadow = true;
      arm.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), skinMat);
      hand.position.y = -0.74;
      arm.add(hand);
      arm.position.set(side * (gender === 'female' ? 0.35 : 0.4), 1.8, 0);
      arm.rotation.z = side * -0.045;
      root.add(arm);
      root.userData[`arm${side}`] = arm;
    }
    root.userData.legs = legs;
    root.userData.gender = gender;
    root.userData.walkPhase = seeded() * Math.PI * 2;
    if (player) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 28), new THREE.MeshBasicMaterial({ color: 0xe7b764, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.018;
      root.add(marker);
      const playerLight = new THREE.PointLight(0x74e8f0, 2.4, 7, 2);
      playerLight.position.set(0, 1.7, 0);
      root.add(playerLight);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(onlineProfile?.tag || 'YOU', '#7de3e5', '#111820'), transparent: true, depthTest: false }));
      tag.scale.set(2.8, 0.46, 1);
      tag.position.set(0, 3.05, 0);
      root.add(tag);
    }
    return root;
  }

  function addStreetLight(x, z, rotation = 0) {
    const lamp = new THREE.Group();
    cylinder(lamp, 0, 2.6, 0, 0.07, 5.2, materials.darkMetal, 12);
    const arm = box(lamp, 0.35, 5.12, 0, 0.75, 0.07, 0.07, materials.darkMetal);
    arm.rotation.y = rotation;
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffdda0, emissive: 0xffc774, emissiveIntensity: 4.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), bulbMat);
    bulb.position.set(0.7, 5.06, 0);
    lamp.add(bulb);
    if (quality === 'high' && Math.abs(x + z) % 60 < 1) {
      const light = new THREE.PointLight(0xffc777, 7, 17, 2);
      light.position.set(0.7, 4.9, 0);
      lamp.add(light);
    }
    lamp.position.set(x, 0, z);
    city.add(lamp);
  }

  function addBuilding(x, z, width, depth, height, color, allowCollider = true) {
    const texture = windowTexture(color, 0.34 + seeded() * 0.28);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(0x8e7652),
      emissiveIntensity: 0.32,
      roughness: 0.74,
      metalness: 0.05,
    });
    const body = box(city, x, height / 2 + 0.35, z, width, height, depth, buildingMaterial);
    body.castShadow = height < 34;
    const ledgeMat = material(0x272c30, 0.78, 0.12);
    for (let y = 4.4; y < height - 1; y += 7.2) box(city, x, y, z, width + 0.18, 0.15, depth + 0.18, ledgeMat, false);
    box(city, x, height + 0.58, z, width + 0.35, 1.15, depth + 0.35, material(0x20262b, 0.85), true);
    if (height > 15) {
      box(city, x + width * 0.18, height + 1.55, z, Math.min(3.5, width * 0.35), 1.2, Math.min(3, depth * 0.34), ledgeMat);
      if (seeded() > 0.55) cylinder(city, x - width * 0.22, height + 3.1, z, 0.07, 4, materials.darkMetal, 8);
    }
    if (allowCollider) cityColliders.push({ minX: x - width / 2 - 0.5, maxX: x + width / 2 + 0.5, minZ: z - depth / 2 - 0.5, maxZ: z + depth / 2 + 0.5 });
  }

  function addHotelExterior() {
    const group = new THREE.Group();
    group.position.set(0, 0, -46);
    city.add(group);
    const stone = materials.hotelStone;
    box(group, 0, 12.2, 0, 30, 24, 18, stone);
    box(group, 0, 1.8, 9.2, 24, 3.1, 1.1, material(0x26292a, 0.5, 0.2));

    const windowMat = new THREE.MeshStandardMaterial({ color: 0x78909b, emissive: 0xb98a4f, emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.1 });
    for (let floor = 0; floor < 6; floor++) {
      for (let column = -5; column <= 5; column++) {
        if (floor === 0 && Math.abs(column) < 2) continue;
        const window = box(group, column * 2.35, 3.3 + floor * 3.25, 9.07, 1.25, 1.75, 0.12, windowMat, false);
        window.material = windowMat;
      }
    }
    for (const x of [-5.7, -3.8, 3.8, 5.7]) cylinder(group, x, 3.4, 10, 0.23, 6.8, materials.gold, 20);
    box(group, 0, 6.85, 9.5, 15, 0.45, 4.6, materials.darkMetal);
    box(group, 0, 6.58, 11.4, 14.5, 0.12, 3.9, materials.gold);

    const entranceGlass = box(group, 0, 2.9, 9.62, 6.8, 5.6, 0.18, materials.glass);
    entranceGlass.castShadow = false;
    box(group, 0, 5.85, 9.58, 8.1, 0.28, 0.3, materials.gold);
    box(group, -3.45, 2.9, 9.58, 0.24, 5.8, 0.32, materials.gold);
    box(group, 3.45, 2.9, 9.58, 0.24, 5.8, 0.32, materials.gold);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.45), new THREE.MeshBasicMaterial({ map: labelTexture('S / T / H', '#e6bd75', '#111416'), transparent: false }));
    sign.position.set(0, 10.25, 9.58);
    group.add(sign);
    const signLight = new THREE.PointLight(0xe4b56e, 11, 24, 2);
    signLight.position.set(0, 8.3, 12.2);
    group.add(signLight);

    for (const x of [-10.6, 10.6]) {
      const planter = cylinder(group, x, 0.55, 11.5, 0.8, 1.1, material(0x252a2a, 0.7), 22);
      planter.scale.z = 0.85;
      const plant = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.6, 12), material(0x18382c, 0.9));
      plant.position.set(x, 2.6, 11.5);
      plant.castShadow = true;
      group.add(plant);
    }
    cityColliders.push({ minX: -15.3, maxX: 15.3, minZ: -55.5, maxZ: -37.2 });
    interactables.push({ mode: 'city', type: 'hotelEntrance', object: group, position: new THREE.Vector3(0, 0, -34.5), label: 'Enter Subway Thots Hotel' });
  }

  function addCity() {
    box(city, 0, -0.36, 0, 220, 0.7, 220, materials.asphalt, false);
    const roadPositions = [-72, -24, 24, 72];
    const roadMaterial = material(0x171c20, 0.34, 0.06);
    for (const p of roadPositions) {
      box(city, p, -0.02, 0, 13, 0.08, 212, roadMaterial, false);
      box(city, 0, -0.015, p, 212, 0.08, 13, roadMaterial, false);
      for (let line = -98; line <= 98; line += 7.5) {
        box(city, p, 0.03, line, 0.12, 0.025, 3.4, material(0xc9a95e, 0.7), false);
        box(city, line, 0.035, p, 3.4, 0.025, 0.12, material(0xc9a95e, 0.7), false);
      }
    }

    for (let x = -96; x <= 96; x += 48) {
      for (let z = -96; z <= 96; z += 48) {
        const hotelBlock = x === 0 && (z === -48 || z === -96);
        if (hotelBlock) continue;
        box(city, x, 0.15, z, 31, 0.3, 31, materials.concrete, false);
        const count = seeded() > 0.48 ? 2 : 1;
        if (count === 1) {
          const w = 21 + seeded() * 7;
          const d = 20 + seeded() * 8;
          addBuilding(x, z, w, d, 10 + seeded() * 30, ['#30373d', '#3a3534', '#293840', '#3e3d39'][Math.floor(seeded() * 4)]);
        } else {
          const vertical = seeded() > 0.5;
          for (const side of [-1, 1]) {
            const bx = x + (vertical ? side * 8 : 0);
            const bz = z + (vertical ? 0 : side * 8);
            addBuilding(bx, bz, vertical ? 12.5 : 25, vertical ? 25 : 12.5, 8 + seeded() * 22, ['#30373d', '#3a3534', '#293840', '#413a36'][Math.floor(seeded() * 4)]);
          }
        }
      }
    }

    addHotelExterior();

    const plaza = box(city, 0, 0.12, -27, 30, 0.24, 14, materials.wetConcrete, false);
    plaza.receiveShadow = true;
    for (let x = -12; x <= 12; x += 4) box(city, x, 0.245, -27, 0.065, 0.02, 13.2, material(0x798083, 0.45), false);

    const metro = new THREE.Group();
    metro.position.set(-45, 0, 5);
    city.add(metro);
    box(metro, 0, 1.6, 0, 8, 3.2, 5.5, materials.darkMetal);
    box(metro, 0, 1.65, 2.78, 6.7, 2.5, 0.12, materials.glass);
    const metroSign = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture('24TH STREET', '#d9d9d5', '#20262a') }));
    metroSign.position.set(0, 3.65, 2.82);
    metro.add(metroSign);

    for (let p = -92; p <= 92; p += 16) {
      for (const road of roadPositions) {
        addStreetLight(road + 8.5, p);
        addStreetLight(p, road + 8.5);
      }
    }

    const park = new THREE.Group();
    park.position.set(48, 0, 48);
    city.add(park);
    box(park, 0, 0.12, 0, 31, 0.24, 31, material(0x163029, 0.96), false);
    box(park, 0, 0.24, 0, 3, 0.08, 31, material(0x74736b, 0.82), false);
    box(park, 0, 0.24, 0, 31, 0.08, 3, material(0x74736b, 0.82), false);
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.399;
      const radius = 5 + (i % 4) * 3.1;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      cylinder(park, tx, 1.6, tz, 0.18, 3.2, material(0x4b3122, 0.94), 9);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 + seeded() * 0.55, 1), material(0x1e4739, 0.92));
      crown.position.set(tx, 3.65, tz);
      crown.castShadow = true;
      park.add(crown);
    }

    for (let i = 0; i < 8; i++) {
      const lane = i % 2 ? -24 : 24;
      const vehicle = new THREE.Group();
      const bodyMat = material([0x313a43, 0x5a2828, 0x726c60, 0x1e2125][i % 4], 0.35, 0.45);
      box(vehicle, 0, 0.48, 0, 1.7, 0.52, 3.5, bodyMat);
      box(vehicle, 0, 0.88, -0.2, 1.48, 0.52, 1.8, materials.glass);
      for (const x of [-0.72, 0.72]) for (const z of [-1.05, 1.05]) {
        const wheel = cylinder(vehicle, x, 0.25, z, 0.24, 0.18, material(0x0b0d0f, 0.88), 12);
        wheel.rotation.z = Math.PI / 2;
      }
      const tail = new THREE.MeshBasicMaterial({ color: 0xe04435 });
      box(vehicle, -0.52, 0.52, 1.77, 0.25, 0.15, 0.05, tail, false);
      box(vehicle, 0.52, 0.52, 1.77, 0.25, 0.15, 0.05, tail, false);
      vehicle.position.set(lane, 0, -95 + i * 24);
      vehicle.userData.speed = 4.5 + (i % 3) * 1.1;
      vehicle.userData.direction = i % 2 ? 1 : -1;
      city.add(vehicle);
      vehicles.push(vehicle);
    }

    const npcNames = ['Elena', 'Maya', 'Jules', 'Naomi', 'Camille', 'Ari', 'Jordan', 'Nico', 'Vivian', 'Tess'];
    const npcSpots = [[-7,-16],[8,-13],[-32,18],[33,12],[-54,-2],[52,-22],[47,48],[-8,31],[28,-72],[-30,72]];
    npcSpots.forEach(([x, z], index) => {
      const npc = makeCharacter({ gender: index === 5 || index === 8 ? 'male' : 'female', coat: [0x4a3131,0x283947,0x4c493f,0x2d4540][index % 4], skin: [0x8c543b,0xc28163,0x6d402f,0xd0a086][index % 4], hair: [0x1a1210,0x42271e,0x15171a][index % 3] });
      npc.position.set(x, 0, z);
      npc.rotation.y = seeded() * Math.PI * 2;
      npc.userData.name = npcNames[index];
      npc.userData.base = new THREE.Vector3(x, 0, z);
      npc.userData.radius = 1.4 + seeded() * 2;
      city.add(npc);
      npcs.push(npc);
      interactables.push({ mode: 'city', type: 'person', object: npc, label: `Talk to ${npcNames[index]}` });
    });
  }

  function addFurniture(parent, x, z, rotation = 0) {
    const sofa = new THREE.Group();
    box(sofa, 0, 0.52, 0, 3.2, 0.7, 1.15, material(0x3c4142, 0.89));
    box(sofa, 0, 1.02, 0.46, 3.2, 0.85, 0.24, material(0x3c4142, 0.89));
    for (const side of [-1, 1]) box(sofa, side * 1.55, 0.77, 0, 0.25, 0.9, 1.1, material(0x34393a, 0.86));
    sofa.position.set(x, 0, z);
    sofa.rotation.y = rotation;
    parent.add(sofa);
  }

  function addHotelInterior() {
    box(hotel, 0, -0.3, 0, 48, 0.6, 40, materials.wetConcrete);
    box(hotel, 0, 7.5, -19.5, 48, 15, 1, materials.hotelStone);
    box(hotel, -23.5, 7.5, 0, 1, 15, 40, materials.hotelStone);
    box(hotel, 23.5, 7.5, 0, 1, 15, 40, materials.hotelStone);
    box(hotel, 0, 7.5, 19.5, 48, 15, 1, materials.hotelStone);
    box(hotel, 0, 0.03, -2, 7, 0.06, 34, materials.carpet, false);

    for (const x of [-9, 9]) {
      cylinder(hotel, x, 3.8, 2, 0.34, 7.6, materials.gold, 24);
      cylinder(hotel, x, 3.8, -10, 0.34, 7.6, materials.gold, 24);
    }
    const chandelier = new THREE.Group();
    cylinder(chandelier, 0, 7.3, 0, 0.05, 3.2, materials.gold, 12);
    for (let i = 0; i < 10; i++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffe2ac, emissive: 0xffc86a, emissiveIntensity: 3 }));
      const angle = i / 10 * Math.PI * 2;
      bulb.position.set(Math.cos(angle) * 2.3, 5.7 + (i % 2) * 0.35, Math.sin(angle) * 2.3);
      chandelier.add(bulb);
    }
    const chandelierLight = new THREE.PointLight(0xffd79a, 19, 27, 2);
    chandelierLight.position.y = 5.8;
    chandelierLight.castShadow = quality === 'high';
    chandelier.add(chandelierLight);
    hotel.add(chandelier);

    const desk = new THREE.Group();
    box(desk, 0, 0.72, 0, 11, 1.45, 2.2, materials.wood);
    box(desk, 0, 1.5, 0, 11.3, 0.14, 2.45, materials.gold);
    desk.position.set(0, 0, -12.2);
    hotel.add(desk);
    const deskSign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.25), new THREE.MeshBasicMaterial({ map: labelTexture('RECEPTION', '#d9b66f', '#171719') }));
    deskSign.position.set(0, 4.9, -19.02);
    hotel.add(deskSign);

    for (const x of [-16, -11, 11, 16]) {
      box(hotel, x, 2.45, -18.9, 4.1, 4.7, 0.15, materials.glass);
      box(hotel, x, 4.95, -18.7, 4.3, 0.18, 0.35, materials.gold);
    }

    addFurniture(hotel, -13, 6, Math.PI / 2);
    addFurniture(hotel, 13, 6, -Math.PI / 2);
    addFurniture(hotel, -13, -5, Math.PI / 2);
    addFurniture(hotel, 13, -5, -Math.PI / 2);
    for (const [x, z] of [[-13,1],[13,1],[-13,-10],[13,-10]]) {
      cylinder(hotel, x, 0.42, z, 0.72, 0.18, materials.gold, 24);
      cylinder(hotel, x, 0.22, z, 0.08, 0.45, materials.darkMetal, 12);
    }

    const elevatorMat = new THREE.MeshStandardMaterial({ color: 0x606367, roughness: 0.2, metalness: 0.82 });
    for (const x of [-17.5, 17.5]) {
      box(hotel, x, 3, -18.92, 6, 5.9, 0.18, elevatorMat);
      box(hotel, x, 6.15, -18.75, 6.4, 0.32, 0.42, materials.gold);
    }

    interactables.push({ mode: 'hotel', type: 'hotelExit', position: new THREE.Vector3(0, 0, 16.7), label: 'Return to Station District' });
    interactables.push({ mode: 'hotel', type: 'reception', position: new THREE.Vector3(0, 0, -9.7), label: role === 'manager' ? 'Review the front desk log' : 'Check in at reception' });
    interactables.push({ mode: 'hotel', type: 'rooms', position: new THREE.Vector3(17.5, 0, -15.5), label: 'Use the guest elevator' });

    const taskData = [
      { type: 'spill', x: -12.8, z: 9, label: 'Clean the lobby spill' },
      { type: 'laundry', x: 15.5, z: 10.5, label: 'Collect fresh laundry' },
      { type: 'trash', x: -18, z: -7.5, label: 'Empty the waste bin' },
    ];
    taskData.forEach((task, index) => {
      const prop = new THREE.Group();
      if (task.type === 'spill') {
        const spill = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshPhysicalMaterial({ color: 0x4a301e, roughness: 0.12, clearcoat: 0.8 }));
        spill.rotation.x = -Math.PI / 2;
        spill.position.y = 0.012;
        prop.add(spill);
      } else if (task.type === 'laundry') {
        box(prop, 0, 0.32, 0, 1.2, 0.65, 0.8, material(0xcac5bb, 0.92));
        for (let i = 0; i < 4; i++) box(prop, (i % 2 - .5) * .45, 0.75 + Math.floor(i / 2) * .2, 0, 0.42, 0.18, 0.62, materials.linen);
      } else {
        cylinder(prop, 0, 0.48, 0, 0.4, 0.95, materials.darkMetal, 18);
      }
      prop.position.set(task.x, 0, task.z);
      hotel.add(prop);
      interactables.push({ mode: 'hotel', type: 'managerTask', subtype: task.type, object: prop, label: task.label, completed: false, index });
    });

    const hotelNpcData = [
      ['Dahlia', -8, -7, 0x543240, 0xb77755],
      ['Monique', 8, 6, 0x263b45, 0x71412f],
      ['Iris', -17, 12, 0x4b4234, 0xd09b79],
      ['Marcus', 15, -7, 0x2e333b, 0x744631],
    ];
    hotelNpcData.forEach(([name, x, z, coat, skin], index) => {
      const npc = makeCharacter({ gender: index === 3 ? 'male' : 'female', coat, skin });
      npc.position.set(x, 0, z);
      npc.userData.name = name;
      npc.userData.base = new THREE.Vector3(x, 0, z);
      npc.userData.radius = 1.3;
      hotel.add(npc);
      npcs.push(npc);
      interactables.push({ mode: 'hotel', type: 'person', object: npc, label: `Talk to ${name}` });
    });
  }

  function buildSuite(number) {
    suite.clear();
    interactables.splice(0, interactables.length, ...interactables.filter((item) => item.mode !== 'room'));
    const accent = number % 3 === 0 ? 0x38566b : number % 2 ? 0x64364f : 0x4a5369;
    box(suite, 0, -0.28, 0, 18, 0.55, 18, material(0x3e302b, 0.76));
    for (let stripe = -8; stripe <= 8; stripe += 1.1) box(suite, stripe, 0.015, 0, 0.04, 0.025, 17.6, material(0x65534b, 0.78), false);
    box(suite, 0, 4.5, -8.8, 18, 9, 0.4, material(0x4a4643, 0.88));
    box(suite, -8.8, 4.5, 0, 0.4, 9, 18, material(0x423e3c, 0.88));
    box(suite, 8.8, 4.5, 0, 0.4, 9, 18, material(0x423e3c, 0.88));
    box(suite, 0, 8.8, 0, 18, 0.35, 18, material(0x323435, 0.82));

    const window = box(suite, 2.8, 4.8, -8.55, 8.5, 5.8, 0.15, materials.glass);
    window.castShadow = false;
    for (const x of [-1.4, 2.8, 7]) box(suite, x, 4.8, -8.42, 0.13, 6, 0.18, materials.darkMetal);

    box(suite, -3.2, 0.5, -2.4, 5.7, 0.8, 6.6, material(0x25272c, 0.69));
    box(suite, -3.2, 1.02, -2.4, 5.35, 0.42, 6.2, materials.linen);
    box(suite, -3.2, 1.25, -3.65, 5.2, 0.26, 3.2, material(accent, 0.86));
    box(suite, -3.2, 2.8, -5.6, 5.8, 3.5, 0.35, material(0x3a2d2b, 0.74));
    for (const x of [-4.6, -1.8]) box(suite, x, 1.43, -4.4, 2.1, 0.32, 1.2, materials.linen);

    for (const x of [-6.6, 0.2]) {
      box(suite, x, 0.68, -2.6, 1.2, 1.25, 1.25, materials.wood);
      cylinder(suite, x, 1.72, -2.6, 0.07, 1.25, materials.gold, 12);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 20, 1, true), material(0xe3d5c1, 0.7));
      shade.position.set(x, 2.45, -2.6);
      suite.add(shade);
    }
    const warm = new THREE.PointLight(0xffc988, 12, 18, 2);
    warm.position.set(-2, 5.2, -1);
    warm.castShadow = quality === 'high';
    suite.add(warm);
    const cityGlow = new THREE.PointLight(0x6da0b8, 8, 20, 2);
    cityGlow.position.set(4, 4.5, -7);
    suite.add(cityGlow);

    addFurniture(suite, 4.8, 2.5, Math.PI);
    box(suite, 4.8, 0.34, -0.2, 2.5, 0.22, 1.3, materials.gold);
    cylinder(suite, 4.8, 0.18, -0.2, 0.09, 0.4, materials.darkMetal, 12);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.5), new THREE.MeshBasicMaterial({ map: labelTexture(`SUITE ${String(number).padStart(2, '0')}`, '#d2ad6d', '#22272a', 640, 360) }));
    art.position.set(8.54, 3.7, 1.2);
    art.rotation.y = -Math.PI / 2;
    suite.add(art);

    const door = box(suite, 0, 2.4, 8.55, 2.4, 4.8, 0.25, materials.wood);
    door.castShadow = true;
    interactables.push({ mode: 'room', type: 'roomExit', position: new THREE.Vector3(0, 0, 6.7), label: 'Return to the hotel lobby' });
    interactables.push({ mode: 'room', type: 'sleep', position: new THREE.Vector3(-3.2, 0, 0.5), label: role === 'guest' ? 'Sleep until morning' : 'Inspect and refresh the suite' });
  }

  function addRain() {
    const count = quality === 'high' ? 1450 : 650;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seeded() - 0.5) * 210;
      positions[i * 3 + 1] = seeded() * 48;
      positions[i * 3 + 2] = (seeded() - 0.5) * 210;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x9bb7c5, size: 0.075, transparent: true, opacity: 0.38, depthWrite: false }));
    city.add(points);
    rainDrops.push(points);
  }

  addSky();
  addLighting();
  addCity();
  addHotelInterior();
  addRain();

  const player = makeCharacter({
    gender: onlineProfile?.gender || (role === 'manager' ? 'female' : 'male'),
    coat: role === 'manager' ? 0x6c3d46 : 0x222c37,
    skin: role === 'manager' ? 0xa66d50 : 0x81533f,
    hair: 0x171411,
    accent: 0xd0a45f,
    player: true,
  });
  if (role === 'manager') {
    hotel.add(player);
    player.position.set(0, 0, 9);
    city.visible = false;
    hotel.visible = true;
  } else {
    city.add(player);
    player.position.set(-24, 0, -24);
    player.rotation.y = Math.PI;
    city.visible = true;
    hotel.visible = false;
  }

  function showDistrict(name) {
    $('#district-name').textContent = name;
    const card = $('#district-title');
    card.classList.remove('show');
    void card.offsetWidth;
    card.classList.add('show');
  }

  function setObjective(text, progress = 0.15, chapter = null) {
    $('#objective').textContent = text;
    $('#objective-fill').style.width = `${Math.max(5, Math.min(100, progress * 100))}%`;
    if (chapter) $('#chapter').textContent = chapter;
  }

  function updateLocation(label) {
    $('#location').textContent = label;
  }

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  function updateStats() {
    $('#rep').textContent = rep;
    $('#cash').textContent = cash;
  }

  function transition(kicker, title, callback) {
    const fade = $('#fade');
    $('#fade-kicker').textContent = kicker;
    $('#fade-title').textContent = title;
    fade.classList.add('show');
    setTimeout(() => {
      callback();
      setTimeout(() => fade.classList.remove('show'), 380);
    }, 520);
  }

  function switchMode(nextMode, position, parent) {
    mode = nextMode;
    city.visible = nextMode === 'city';
    hotel.visible = nextMode === 'hotel';
    suite.visible = nextMode === 'room';
    parent.attach(player);
    player.position.copy(position);
    nearby = null;
    $('#context-card').classList.add('hidden-card');
    updateLocation(nextMode === 'city' ? 'STATION DISTRICT' : nextMode === 'hotel' ? 'HOTEL LOBBY' : `SUITE ${String(currentRoom).padStart(2, '0')}`);
  }

  function enterHotel() {
    transition('S/T/H', 'HOTEL LOBBY', () => {
      switchMode('hotel', new THREE.Vector3(0, 0, 14), hotel);
      showDistrict('SUBWAY THOTS HOTEL');
      if (role === 'guest') setObjective(checkedIn ? 'Use the elevator or meet someone in the lobby' : 'Check in at the reception desk', 0.34);
      else setObjective(`Complete the opening inspection · ${taskCount}/3`, taskCount / 3, 'SHIFT 01');
    });
  }

  function exitHotel() {
    transition('STATION DISTRICT', 'CITY AFTER DARK', () => {
      switchMode('city', new THREE.Vector3(0, 0, -31.5), city);
      showDistrict('STATION DISTRICT');
      setObjective(role === 'guest' ? 'Explore the district or return to the hotel' : 'Return to the hotel before the end of shift', 0.45);
    });
  }

  function enterRoom(number) {
    currentRoom = number;
    transition('FLOOR ' + Math.ceil(number / 10), `SUITE ${String(number).padStart(2, '0')}`, () => {
      buildSuite(number);
      switchMode('room', new THREE.Vector3(0, 0, 6.2), suite);
      if (role === 'guest') setObjective('Rest, or invite a consenting adult guest upstairs', 0.78, 'CHAPTER 02');
      else setObjective('Inspect the suite and refresh the linens', 0.76, 'SHIFT 01');
    });
  }

  function exitRoom() {
    transition('S/T/H', 'HOTEL LOBBY', () => {
      switchMode('hotel', new THREE.Vector3(17.5, 0, -13.5), hotel);
      setObjective(role === 'manager' ? `Complete the opening inspection · ${taskCount}/3` : 'Enjoy the lobby or head back into the city', role === 'manager' ? taskCount / 3 : 0.7);
    });
  }

  function romanceSequence(person) {
    const name = person.object?.userData.name || 'your date';
    transition('LATER THAT NIGHT', 'PRIVATE MOMENT', () => {
      rep += 5;
      updateStats();
      toast(`${name} accepted your invitation. The evening continues privately. +5 reputation`);
      setObjective('Get some rest before morning', 0.9, 'CHAPTER 03');
    });
  }

  function interact() {
    if (!nearby || paused) return;
    const item = nearby.item;
    if (item.type === 'hotelEntrance') return enterHotel();
    if (item.type === 'hotelExit') return exitHotel();
    if (item.type === 'roomExit') return exitRoom();
    if (item.type === 'rooms') {
      $('#room-panel').classList.add('open');
      toast('Select a secured floor and suite.');
      return;
    }
    if (item.type === 'reception') {
      if (role === 'manager') {
        cash += 35;
        rep += 1;
        updateStats();
        toast('Front desk log reviewed. VIP arrival noted. +$35');
      } else if (!checkedIn) {
        checkedIn = true;
        cash = Math.max(0, cash - 40);
        updateStats();
        setObjective('Use the guest elevator and choose a suite', 0.56);
        toast('Checked in for the night. Your room key is active. -$40');
      } else toast('Your room key remains active until noon.');
      return;
    }
    if (item.type === 'managerTask') {
      if (role !== 'manager') {
        toast('Hotel staff will handle this area.');
        return;
      }
      if (item.completed) return;
      item.completed = true;
      taskCount += 1;
      cash += 30;
      rep += 2;
      if (item.object) item.object.visible = false;
      updateStats();
      if (taskCount >= 3) {
        setObjective('Opening inspection complete · greet hotel guests', 1, 'SHIFT COMPLETE');
        toast('Hotel inspection complete. The property is ready for guests. +$90 total');
      } else {
        setObjective(`Complete the opening inspection · ${taskCount}/3`, taskCount / 3, 'SHIFT 01');
        toast(`${item.label} complete. +$30 · +2 reputation`);
      }
      return;
    }
    if (item.type === 'sleep') {
      if (role === 'manager') {
        taskCount = Math.max(taskCount, 3);
        cash += 45;
        updateStats();
        toast('Suite inspected, amenities replenished and linens refreshed. +$45');
        setObjective('Return to the lobby and continue the shift', 0.92);
      } else if (!slept) {
        slept = true;
        transition('6:42 AM', 'A NEW MORNING', () => {
          cash += 60;
          rep += 3;
          updateStats();
          setObjective('Night complete · return to the city when ready', 1, 'NIGHT COMPLETE');
          toast('Well rested. Night one complete. +$60 · +3 reputation');
        });
      }
      return;
    }
    if (item.type === 'person') {
      const name = item.object.userData.name;
      if (role === 'manager') {
        const request = taskCount >= 2 && Math.random() > 0.45;
        if (request) {
          toast(`${name} asks whether you would like to meet after your shift. You can politely accept or continue working.`);
          rep += 2;
          updateStats();
        } else {
          toast(`${name}: “The hotel looks incredible tonight. Thank you.” +1 reputation`);
          rep += 1;
          updateStats();
        }
      } else if (mode === 'hotel' && checkedIn) {
        romanceSequence(item);
      } else {
        toast(`${name}: “You should check out the hotel lobby. It gets lively after midnight.”`);
        rep += 1;
        updateStats();
      }
    }
  }

  function makeRoomDirectory() {
    const roomList = $('#room-list');
    for (let number = 1; number <= 50; number++) {
      const button = document.createElement('button');
      button.textContent = `F${Math.ceil(number / 10)} · SUITE ${String(number).padStart(2, '0')}`;
      button.addEventListener('click', () => {
        $('#room-panel').classList.remove('open');
        enterRoom(number);
      });
      roomList.appendChild(button);
    }
  }
  makeRoomDirectory();

  function togglePause(force) {
    paused = typeof force === 'boolean' ? force : !paused;
    $('#pause-panel').classList.toggle('open', paused);
  }

  function startAmbience() {
    if (ambience) {
      ambience.context.close();
      ambience = null;
      $('#sound-toggle').textContent = 'SOUND: OFF';
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return toast('Audio ambience is unavailable in this browser.');
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.07;
    master.connect(context.destination);
    const hum = context.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 52;
    const humGain = context.createGain();
    humGain.gain.value = 0.12;
    hum.connect(humGain).connect(master);
    hum.start();
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.18;
    const rain = context.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    rain.connect(filter).connect(master);
    rain.start();
    ambience = { context, hum, rain };
    $('#sound-toggle').textContent = 'SOUND: ON';
  }

  function connectWorld() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const base = window.STH_WORLD_URL || `${protocol}://${location.hostname || '127.0.0.1'}:8000`;
    const tag = onlineProfile?.tag || (role === 'manager' ? 'Manager' : 'Guest');
    const url = `${base.replace(/\/$/, '')}/ws/sth-city-01?player_id=browser-${Math.random().toString(36).slice(2, 10)}&display_name=${encodeURIComponent(tag)}`;
    try {
      worldSocket = new WebSocket(url);
      worldSocket.addEventListener('open', () => { $('#server-status').textContent = 'ONLINE WORLD'; });
      worldSocket.addEventListener('close', () => { $('#server-status').textContent = 'LOCAL WORLD'; });
      worldSocket.addEventListener('error', () => { $('#server-status').textContent = 'LOCAL WORLD'; });
    } catch {
      $('#server-status').textContent = 'LOCAL WORLD';
    }
  }
  connectWorld();

  function itemWorldPosition(item) {
    if (item.position) return tempWorld.copy(item.position);
    if (item.object) return item.object.getWorldPosition(tempWorld);
    return tempWorld.set(0, 0, 0);
  }

  function updateNearby() {
    let best = null;
    let bestDistance = 3.15;
    for (const item of interactables) {
      if (item.mode !== mode || item.completed || (item.object && !item.object.visible)) continue;
      const position = itemWorldPosition(item);
      const distance = Math.hypot(player.position.x - position.x, player.position.z - position.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }
    nearby = best ? { item: best, distance: bestDistance } : null;
    $('#context-card').classList.toggle('hidden-card', !nearby);
    if (nearby) $('#context-action').textContent = nearby.item.label;
  }

  function cityBlocked(x, z) {
    for (const collider of cityColliders) {
      if (x > collider.minX && x < collider.maxX && z > collider.minZ && z < collider.maxZ) return true;
    }
    return false;
  }

  function movePlayer(delta) {
    let inputX = 0;
    let inputZ = 0;
    if (keys.w || keys.arrowup) inputZ -= 1;
    if (keys.s || keys.arrowdown) inputZ += 1;
    if (keys.a || keys.arrowleft) inputX -= 1;
    if (keys.d || keys.arrowright) inputX += 1;
    const moving = inputX !== 0 || inputZ !== 0;
    const forwardX = Math.sin(cameraYaw);
    const forwardZ = Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    let dx = rightX * inputX + forwardX * -inputZ;
    let dz = rightZ * inputX + forwardZ * -inputZ;
    if (moving) {
      const length = Math.hypot(dx, dz);
      dx /= length;
      dz /= length;
      const speed = (keys.shift ? 7.2 : 4.25) * delta;
      const nextX = player.position.x + dx * speed;
      const nextZ = player.position.z + dz * speed;
      if (mode === 'city') {
        if (!cityBlocked(nextX, player.position.z)) player.position.x = THREE.MathUtils.clamp(nextX, -103, 103);
        if (!cityBlocked(player.position.x, nextZ)) player.position.z = THREE.MathUtils.clamp(nextZ, -103, 103);
      } else if (mode === 'hotel') {
        player.position.x = THREE.MathUtils.clamp(nextX, -22, 22);
        player.position.z = THREE.MathUtils.clamp(nextZ, -18, 18);
      } else {
        player.position.x = THREE.MathUtils.clamp(nextX, -8, 8);
        player.position.z = THREE.MathUtils.clamp(nextZ, -7.8, 7.4);
      }
      const desiredRotation = Math.atan2(dx, dz);
      player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, desiredRotation, 1 - Math.pow(0.001, delta));
    }
    if (jumpQueued && player.position.y <= 0.001) { verticalVelocity = 6.4; jumpQueued = false; }
    verticalVelocity -= 18 * delta;
    player.position.y += verticalVelocity * delta;
    if (player.position.y <= 0) { player.position.y = 0; verticalVelocity = 0; }
    const grounded = player.position.y <= 0.001;
    const walk = moving && grounded ? Math.sin(clock.elapsedTime * (keys.shift ? 12 : 8)) * 0.56 : 0;
    const legs = player.userData.legs || [];
    if (legs[0]) legs[0].rotation.x = walk;
    if (legs[1]) legs[1].rotation.x = -walk;
    if (player.userData['arm-1']) player.userData['arm-1'].rotation.x = -walk * 0.7;
    if (player.userData.arm1) player.userData.arm1.rotation.x = walk * 0.7;
    return { dx, dz, moving };
  }

  function updateCamera(delta) {
    cameraMode = cameraDistance <= 1.7 ? 'first' : 'third';
    const horizontal = Math.cos(cameraPitch);
    const viewX = Math.sin(cameraYaw) * horizontal;
    const viewZ = Math.cos(cameraYaw) * horizontal;
    if (cameraMode === 'first') {
      player.visible = false;
      camera.fov = 74;
      targetCamera.set(player.position.x, player.position.y + 1.62, player.position.z);
      cameraLook.set(player.position.x + viewX * 10, player.position.y + 1.62 + Math.sin(cameraPitch) * 10, player.position.z + viewZ * 10);
    } else {
      player.visible = true;
      camera.fov = 52;
      targetCamera.set(player.position.x - viewX * cameraDistance, player.position.y + 1.35 + Math.sin(cameraPitch) * cameraDistance, player.position.z - viewZ * cameraDistance);
      cameraLook.set(player.position.x, player.position.y + 1.2, player.position.z);
    }
    camera.updateProjectionMatrix();
    camera.position.lerp(targetCamera, 1 - Math.pow(0.0025, delta));
    camera.lookAt(cameraLook);
  }

  function updateWorld(delta, elapsed) {
    for (let index = 0; index < npcs.length; index++) {
      const npc = npcs[index];
      if (!npc.parent?.visible) continue;
      const base = npc.userData.base;
      if (!base) continue;
      const angle = elapsed * 0.18 + index * 1.7;
      npc.position.x = base.x + Math.sin(angle) * npc.userData.radius;
      npc.position.z = base.z + Math.cos(angle * 0.83) * npc.userData.radius;
      npc.rotation.y = angle + Math.PI / 2;
      const npcWalk = Math.sin(elapsed * 4.5 + npc.userData.walkPhase) * 0.26;
      if (npc.userData.legs?.[0]) npc.userData.legs[0].rotation.x = npcWalk;
      if (npc.userData.legs?.[1]) npc.userData.legs[1].rotation.x = -npcWalk;
    }
    for (const vehicle of vehicles) {
      vehicle.position.z += vehicle.userData.speed * vehicle.userData.direction * delta;
      if (vehicle.position.z > 106) vehicle.position.z = -106;
      if (vehicle.position.z < -106) vehicle.position.z = 106;
      vehicle.rotation.y = vehicle.userData.direction > 0 ? 0 : Math.PI;
    }
    for (const rain of rainDrops) {
      const positions = rain.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= delta * 19;
        if (positions[i] < 0) positions[i] = 46;
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    timeOfNight += delta * 0.46;
    const hours = Math.floor(timeOfNight / 60) % 24;
    const minutes = Math.floor(timeOfNight) % 60;
    $('#clock').textContent = `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  }

  function updateMap() {
    if (mode !== 'city') {
      $('#map-hotel').style.left = '50%';
      $('#map-hotel').style.top = '50%';
      return;
    }
    const relativeX = THREE.MathUtils.clamp(50 + (-player.position.x / 110) * 70, 8, 86);
    const relativeZ = THREE.MathUtils.clamp(50 + ((-46 - player.position.z) / 110) * 70, 8, 86);
    $('#map-hotel').style.left = `${relativeX}%`;
    $('#map-hotel').style.top = `${relativeZ}%`;
  }

  addEventListener('keydown', (event) => {
    keys[event.key.toLowerCase()] = true;
    if (event.key === ' ' && !event.repeat) jumpQueued = true;
    if (event.key.toLowerCase() === 'e' && !event.repeat) interact();
    if (event.key.toLowerCase() === 'r' && !event.repeat && mode !== 'city') $('#room-panel').classList.toggle('open');
    if (event.key === 'Escape' && !event.repeat) {
      if ($('#room-panel').classList.contains('open')) $('#room-panel').classList.remove('open');
      else togglePause();
    }
  });
  addEventListener('keyup', (event) => { keys[event.key.toLowerCase()] = false; });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 2) { cameraDragging = true; canvas.setPointerCapture?.(event.pointerId); }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button === 2) { cameraDragging = false; canvas.releasePointerCapture?.(event.pointerId); }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!cameraDragging || paused) return;
    cameraYaw -= event.movementX * 0.006;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch - event.movementY * 0.004, 0.05, 1.15);
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const wasFirstPerson = cameraDistance <= 1.7;
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.01, 1.35, 12);
    const isFirstPerson = cameraDistance <= 1.7;
    if (wasFirstPerson !== isFirstPerson) showGlobalToast(isFirstPerson ? 'FIRST-PERSON POV' : 'THIRD-PERSON POV');
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  $('#interact').addEventListener('click', interact);
  $('#close-rooms').addEventListener('click', () => $('#room-panel').classList.remove('open'));
  $('#resume-btn').addEventListener('click', () => togglePause(false));
  $('#sound-toggle').addEventListener('click', startAmbience);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.7 : 1.25));
  });


  if (role === 'manager') {
    updateLocation('HOTEL LOBBY');
    setObjective('Complete the opening inspection · 0/3', 0.05, 'SHIFT 01');
    setTimeout(() => showDistrict('SUBWAY THOTS HOTEL'), 900);
  } else {
    setObjective('Walk to the hotel entrance', 0.14, 'CHAPTER 01');
    setTimeout(() => showDistrict('STATION DISTRICT'), 900);
  }

  camera.position.set(player.position.x, player.position.y + 4.25, player.position.z + 7.4);
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);

  function loop() {
    requestAnimationFrame(loop);
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    let movement = { dx: 0, dz: 0, moving: false };
    if (!paused) {
      movement = movePlayer(delta);
      updateNearby();
      updateWorld(delta, elapsed);
      updateMap();
    }
    updateCamera(delta);
    if (worldSocket?.readyState === WebSocket.OPEN && elapsed - lastNetworkSend > 0.08) {
      worldSocket.send(JSON.stringify({ type: 'input', x: movement.dx, z: movement.dz, zone: mode }));
      lastNetworkSend = elapsed;
    }
    composer.render();
  }
  loop();
}
