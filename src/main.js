import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ProximityVoiceClient } from './multiplayer/ProximityVoiceClient.js';
import { resolveVoiceServerUrl } from './multiplayer/voiceConfig.js';
import { GameConfig } from './config/GameConfig.js';
import { GameLoop } from './core/GameLoop.js';
import { loadProgression, saveProgression } from './core/ProgressionStore.js';
import { PerformanceDiagnostics } from './core/PerformanceDiagnostics.js';
import { DebugVisuals } from './debug/DebugVisuals.js';
import { ThirdPersonCameraController } from './camera/ThirdPersonCameraController.js';
import { WorldChunkManager } from './world/WorldChunkManager.js';
import { RoadGraph } from './world/RoadGraph.js';
import { RegionCatalog } from './world/RegionCatalog.js';
import { PlayerModel } from './player/PlayerModel.js';
import { NpcModelLibrary } from './npc/NpcModelLibrary.js';
import { PlayerController } from './player/PlayerController.js';
import { CapsuleCollisionWorld } from './player/CapsuleCollisionWorld.js';
import { GroundProbe } from './player/GroundProbe.js';
import { MaterialLibrary } from './rendering/MaterialLibrary.js';
import { TextureLibrary } from './rendering/TextureLibrary.js';
import { DecalSystem } from './world/DecalSystem.js';
import { EnvironmentLighting, LightingProfile } from './rendering/EnvironmentLighting.js';
import { DayNightCycle } from './rendering/DayNightCycle.js';
import { createRoomPlan } from './world/RoomArchetypes.js';
import { StructuralGrid } from './world/StructuralGrid.js';
import { NavigationStandards, hasWalkableOpening } from './world/NavigationStandards.js';
import { DoorController } from './world/DoorController.js';
import { InputController } from './input/InputController.js';
import { InteractionSystem } from './interaction/InteractionSystem.js';
import { WEAPON_CATALOG, VENUE_CATALOG } from './content/WorldContent.js';
import { WORLD_LAYOUT } from './content/WorldLayout.js';
import { VEHICLE_CATALOG, VEHICLE_UPGRADES, getVehicle } from './content/VehicleCatalog.js';
import { CAMO_CATALOG, getCamo } from './content/CamoCatalog.js';
import { VehicleController } from './vehicles/VehicleController.js';
import { CharacterPreview } from './ui/CharacterPreview.js';
import './style.css?v=5';

const $ = (selector) => document.querySelector(selector);
const PUBLIC_WORLD_HOST = '147.189.172.104:7076';
const PRODUCTION_WORLD_URL = 'wss://world.subwaythotshotel.com';
const AUTH_REQUIRED = import.meta.env.VITE_STH_AUTH === 'on';
const localDevelopment = ['localhost', '127.0.0.1'].includes(location.hostname);
const desktopRuntime = location.protocol === 'sth:';
const worldOverride = localDevelopment || desktopRuntime ? new URLSearchParams(location.search).get('world') : null;
const WORLD_URL = window.STH_WORLD_URL || import.meta.env.VITE_STH_WORLD_URL || worldOverride || (desktopRuntime || location.protocol === 'https:' ? PRODUCTION_WORLD_URL : location.protocol === 'http:' ? `ws://${PUBLIC_WORLD_HOST}` : null);
const voiceOverride = localDevelopment ? new URLSearchParams(location.search).get('voice') : null;
const VOICE_URL = resolveVoiceServerUrl({
  protocol: location.protocol,
  hostname: location.hostname,
  configuredUrl: window.STH_VOICE_URL || import.meta.env.VITE_STH_VOICE_URL,
  queryOverride: voiceOverride,
});
const VOICE_ICE_SERVERS = [
  { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL ? [{
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME || '',
    credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
  }] : []),
];
const ageGate = $('#age-gate');
const roleCards = [...document.querySelectorAll('.role-card')];
let selectedRole = 'guest';
let started = false;
let onlineProfile = JSON.parse(localStorage.getItem('sth-online-profile') || 'null');
let creatorGender = 'female';
const creatorSelection = { face: 'Face_01', arms: 'Arms_01', torso: 'Torso_01', legs: 'Legs_01' };
let creatorPreview = null;
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
    if (!WORLD_URL) throw new Error('Secure world endpoint is not configured.');
    const base = WORLD_URL.replace(/^ws/, 'http').replace(/\/$/, '');
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
      button.onclick = () => { creatorSelection[category] = key; renderCreatorSlots(); updateCreatorSummary(); updateCreatorPreview(); };
      grid.appendChild(button);
    }
    group.appendChild(grid); root.appendChild(group);
  }
  updateCreatorSummary();
}
function updateCreatorSummary() { const summary = `${creatorGender.toUpperCase()} · ${Object.values(creatorSelection).join(' · ')}`; $('#creator-selection-summary').textContent = summary; $('#creator-preview-state').textContent = summary; }
function updateCreatorPreview() { creatorPreview?.apply({ gender: creatorGender, selections: creatorSelection }); }
function openCreatorModal() { $('#creator-modal').hidden = false; $('#creator-tag').textContent = onlineProfile.tag; if (!creatorPreview) creatorPreview = new CharacterPreview($('#creator-preview-canvas')); creatorPreview.resize(); renderCreatorSlots(); updateCreatorPreview(); }
function closeOnlinePanels() { $('#friends-panel').hidden = true; $('#inventory-hotbar').hidden = true; }
function toggleFriends(force) { const panel = $('#friends-panel'); panel.hidden = typeof force === 'boolean' ? !force : !panel.hidden; if (!panel.hidden) renderFriends(); }
function toggleInventory(force) { const bar = $('#inventory-hotbar'); bar.hidden = typeof force === 'boolean' ? !force : !bar.hidden; if (!bar.hidden) renderHotbar(); }
function renderHotbar() { const root = $('#hotbar-slots'); root.innerHTML = ''; inventoryItems.forEach((item, index) => { const slot = document.createElement('button'); slot.className = `hotbar-slot${selectedInventorySlot === index ? ' selected' : ''}`; slot.innerHTML = `<kbd>${index + 1}</kbd><span class="item-icon">${item?.icon || '·'}</span><strong>${item?.name || 'Empty'}</strong><small>${item?.qty ? `Qty ${item.qty}` : '—'}</small>`; slot.onclick = () => useInventorySlot(index); root.appendChild(slot); }); }
function useInventorySlot(index) { selectedInventorySlot = index; const item = inventoryItems[index]; renderHotbar(); if (!item) return; if (item.key === 'water' || item.key === 'food') { if (item.qty <= 0) return showGlobalToast(`${item.name} is empty.`); item.qty -= 1; window.sthRestoreNeed?.(item.key === 'food' ? 'hunger' : 'hygiene', item.key === 'food' ? 28 : 12); showGlobalToast(`${item.name} used · needs restored.`); } else if (item.key === 'radio') showGlobalToast('Radio menu ready.'); else if (item.key === 'phone') showGlobalToast('Phone opened.'); else if (item.key === 'keys') showGlobalToast('Hotel keys equipped.'); else showGlobalToast(`${item.name} equipped.`); renderHotbar(); }
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
  if (AUTH_REQUIRED) return showGlobalToast('Sign in with Discord to enter the world.');
  if (onlineProfile) { started = true; ageGate.classList.add('hidden'); startGame(selectedRole); return; }
  ageGate.classList.add('hidden'); openGamertagModal();
});
function launchAuthenticatedWorld() {
  if (started || !AUTH_REQUIRED || !window.STH_AUTH_READY) return;
  started = true;
  ageGate.classList.add('hidden');
  startGame(selectedRole);
}
window.STH_START_AUTHENTICATED_WORLD = launchAuthenticatedWorld;
$('#gamertag-input').addEventListener('input', () => { const value = $('#gamertag-input').value.trim(); $('#gamertag-preview').innerHTML = `Your tag: <strong>${/^[A-Za-z0-9._-]{3,16}$/.test(value) ? `${value}#XXXXXX` : '—'}</strong>`; });
$('#gamertag-submit').addEventListener('click', async () => { const name = $('#gamertag-input').value.trim(); if (!/^[A-Za-z0-9._-]{3,16}$/.test(name)) { $('#gamertag-error').textContent = 'Use 3–16 letters, numbers, dots, underscores, or hyphens.'; return; } const submit = $('#gamertag-submit'); submit.disabled = true; submit.textContent = 'RESERVING TAG…'; const reserved = await reserveGamertag(name); onlineProfile = { ...reserved, gender: creatorGender, selections: { ...creatorSelection }, createdAt: new Date().toISOString() }; submit.disabled = false; submit.textContent = 'CONTINUE TO CHARACTER CREATOR →'; $('#gamertag-error').textContent = ''; openCreatorModal(); $('#gamertag-modal').hidden = true; });
document.querySelectorAll('.gender-tabs button').forEach((button) => button.addEventListener('click', () => { creatorGender = button.dataset.gender; document.querySelectorAll('.gender-tabs button').forEach((item) => item.classList.toggle('selected', item === button)); creatorSelection.face = creatorGender === 'male' ? 'Male_Face_01' : 'Face_01'; creatorSelection.arms = creatorGender === 'male' ? 'Male_Arms_01' : 'Arms_01'; creatorSelection.torso = creatorGender === 'male' ? 'Male_Torso_01' : 'Torso_01'; creatorSelection.legs = creatorGender === 'male' ? 'Male_Legs_01' : 'Legs_01'; renderCreatorSlots(); updateCreatorPreview(); }));
$('#creator-submit').addEventListener('click', () => { onlineProfile.gender = creatorGender; onlineProfile.selections = { ...creatorSelection }; localStorage.setItem('sth-online-profile', JSON.stringify(onlineProfile)); $('#creator-modal').hidden = true; started = true; startGame(selectedRole); });
$('#friends-close').addEventListener('click', () => toggleFriends(false)); $('#friend-add-btn').addEventListener('click', addFriendRequest); document.querySelectorAll('[data-friend-tab]').forEach((tab) => tab.addEventListener('click', () => { friendTab = tab.dataset.friendTab; document.querySelectorAll('[data-friend-tab]').forEach((item) => item.classList.toggle('selected', item === tab)); renderFriends(); }));
addEventListener('keydown', (event) => { if (event.target instanceof Element && event.target.matches('input,textarea')) return; const key = event.key.toLowerCase(); if (key === 'f' && !event.repeat) toggleFriends(); if (key === 'z' && !event.repeat) toggleInventory(); if (key >= '1' && key <= '6' && !event.repeat && !$('#creator-modal')?.hidden) return; if (key >= '1' && key <= '6' && !event.repeat && onlineProfile) useInventorySlot(Number(key) - 1); if (key === 'escape') { if (!$('#friends-panel').hidden || !$('#inventory-hotbar').hidden) closeOnlinePanels(); } });

function startGame(role) {
  const canvas = $('#game');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111820);
  scene.fog = new THREE.FogExp2(0x111820, 0.009);

  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, GameConfig.rendering.renderDistance);
  const inputController = new InputController(canvas);
  const cameraController = new ThirdPersonCameraController(camera, GameConfig.camera);
  const audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
  });
  const diagnostics = new PerformanceDiagnostics({ renderer });
  window.sthDiagnostics = diagnostics;
  const isWebGL2 = renderer.capabilities.isWebGL2;
  const maxTextureSize = renderer.capabilities.maxTextureSize;
  const quality = isWebGL2 && maxTextureSize >= 8192 && innerWidth > 700 ? 'high' : 'balanced';
  const pixelRatioCap = quality === 'high' ? GameConfig.rendering.maxPixelRatio : GameConfig.rendering.balancedPixelRatio;
  const updateRendererSize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.setSize(innerWidth, innerHeight);
  };

  THREE.ColorManagement.enabled = true;
  updateRendererSize();
  renderer.setClearColor(0x111820, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = quality === 'high' ? 1.04 : 0.98;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), quality === 'high' ? 0.12 : 0.06, 0.42, 0.9);
  composer.addPass(bloomPass);
  const fxaaPass = new ShaderPass(FXAAShader);
  composer.addPass(fxaaPass);
  composer.addPass(new OutputPass());
  const updatePostProcessing = () => {
    const ratio = renderer.getPixelRatio();
    fxaaPass.material.uniforms.resolution.value.set(1 / (innerWidth * ratio), 1 / (innerHeight * ratio));
    bloomPass.setSize(innerWidth * ratio, innerHeight * ratio);
  };
  updatePostProcessing();

  const clock = new THREE.Clock();
  const city = new THREE.Group();
  const hotel = new THREE.Group();
  const suite = new THREE.Group();
  scene.add(city, hotel, suite);
  hotel.visible = false;
  suite.visible = false;

  let mode = role === 'manager' ? 'hotel' : 'city';
  let cameraMode = 'third';
  let cameraYaw = cameraController.yaw;
  let cameraPitch = cameraController.pitch;
  let cameraDistance = cameraController.distance;
  let cameraDragging = false;
  let jumpQueued = false;
  let currentRoom = null;
  let paused = false;
  const progression = loadProgression(localStorage, { cash: role === 'manager' ? 420 : 240, reputation: 12 });
  let rep = progression.reputation;
  let cash = progression.cash;
  const ownedWeapons = new Set(JSON.parse(localStorage.getItem('sth-owned-weapons') || '[]'));
  let equippedWeaponKey = localStorage.getItem('sth-equipped-weapon') || null;
  const ownedVehicles = new Set(JSON.parse(localStorage.getItem('sth-owned-vehicles') || '[]'));
  let equippedVehicleKey = localStorage.getItem('sth-equipped-vehicle') || null;
  let vehicleUpgrades = {};
  try { vehicleUpgrades = JSON.parse(localStorage.getItem('sth-vehicle-upgrades') || '{}') || {}; } catch { localStorage.removeItem('sth-vehicle-upgrades'); }
  let taskCount = 0;
  let frontDeskReviewed = false;
  const inspectedSuites = new Set();
  let activeJob = null;
  let jobStep = 0;
  let savedNeeds = null;
  try { savedNeeds = JSON.parse(localStorage.getItem('sth-needs') || 'null'); } catch { localStorage.removeItem('sth-needs'); }
  const needs = {
    energy: THREE.MathUtils.clamp(Number(savedNeeds?.energy ?? 100), 0, 100),
    hunger: THREE.MathUtils.clamp(Number(savedNeeds?.hunger ?? 100), 0, 100),
    hygiene: THREE.MathUtils.clamp(Number(savedNeeds?.hygiene ?? 100), 0, 100),
  };
  let lastNeedsSave = 0;
  let checkedIn = false;
  let slept = false;
  let nearby = null;
  let toastTimer;
  let worldSocket = null;
  let voiceClient = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let localPlayerId = localStorage.getItem('sth-player-id') || `browser-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  let sessionToken = localStorage.getItem('sth-session-token') || '';
  localStorage.setItem('sth-player-id', localPlayerId);
  let lastNetworkSend = 0;
  let ambience = null;
  let timeOfNight = 9 * 60 + 20;
  const keys = inputController.keys;
  const cityColliders = [];
  const hotelColliders = [];
  const suiteColliders = [];
  const cityFloors = [];
  const hotelFloors = [];
  const suiteFloors = [];
  const playerCollision = new CapsuleCollisionWorld({ radius: GameConfig.player.radius, height: GameConfig.player.height });
  const groundProbe = new GroundProbe({ radius: GameConfig.player.radius });
  const debugVisuals = GameConfig.debug.enabled || GameConfig.debug.collisions || GameConfig.debug.player || GameConfig.debug.camera || GameConfig.debug.raycasts
    ? new DebugVisuals(scene, GameConfig.debug, GameConfig.player) : null;
  let ragdollUntil = 0;
  const interactables = [];
  const interactionSystem = new InteractionSystem({ items: interactables, range: 3.15 });
  const npcs = [];
  const venueObjects = new Map();
  const weaponDisplays = [];
  const vehicles = [];
  let activeVehicle = null;
  let activeVehicleController = null;
  let driving = false;
  let dealershipVehicles = [...VEHICLE_CATALOG];
  const remotePlayers = new Map();
  const rainDrops = [];
  const doors = [];
  const nightLights = [];
  const targetCamera = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();

  $('#role-stat').textContent = role === 'manager' ? 'MANAGER' : 'GUEST';
  $('#cash').textContent = cash;

  const worldSeed = Math.max(1, Number(localStorage.getItem('sth-world-seed') || GameConfig.world.seed) >>> 0);
  const seeded = (() => {
    let seed = worldSeed;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  })();
  const structuralGrid = new StructuralGrid(2, .25);
  const geometryCache = new Map();
  const cityFootprints = [];
  const roadwayCenters = WORLD_LAYOUT.roads;
  const venueFootprintSizes = Object.fromEntries(Object.entries(WORLD_LAYOUT.venueFootprints).map(([type, size]) => [type, [size.width, size.depth]]));
  const roadGraph = new RoadGraph();
  window.sthRoadGraph = roadGraph;

  const materialLibrary = new MaterialLibrary();
  const materials = materialLibrary.named();
  const textureLibrary = new TextureLibrary();
  const decals = new DecalSystem();

  function material(color, roughness = 0.66, metalness = 0.05) {
    return materialLibrary.standard(color, roughness, metalness);
  }

  // Stable, deliberately narrow variation bands keep procedural rooms cohesive.
  function propVariant(kind, x, z) {
    let hash = 2166136261;
    for (const char of `${kind}:${Math.round(x * 10)}:${Math.round(z * 10)}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    hash >>>= 0;
    return {
      index: hash % 4,
      width: .94 + (hash % 5) * .03,
      depth: .95 + ((hash >>> 3) % 4) * .025,
      wear: (hash >>> 6) % 3,
      accent: [0x5db8c7, 0xbe6b9d, 0xd2a95f, 0x7ba77b][hash % 4],
    };
  }

  function box(parent, x, y, z, sx, sy, sz, meshMaterial, shadows = true) {
    const key = `box:${sx}:${sy}:${sz}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(sx, sy, sz));
    const mesh = new THREE.Mesh(geometryCache.get(key), meshMaterial);
    mesh.position.set(x, y, z);
    const shadowEnabled = shadows && sx * sy * sz >= 0.018;
    mesh.castShadow = shadowEnabled;
    mesh.receiveShadow = shadowEnabled;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, x, y, z, radius, height, meshMaterial, sides = 18) {
    const key = `cylinder:${radius}:${height}:${sides}`;
    if (!geometryCache.has(key)) geometryCache.set(key, new THREE.CylinderGeometry(radius, radius, height, sides));
    const mesh = new THREE.Mesh(geometryCache.get(key), meshMaterial);
    mesh.position.set(x, y, z);
    const shadowEnabled = radius * height >= 0.025;
    mesh.castShadow = shadowEnabled;
    mesh.receiveShadow = shadowEnabled;
    parent.add(mesh);
    return mesh;
  }

  function addCafeTable(parent, x, z, { top = materials.wood, trim = materials.gold } = {}) {
    const variant = propVariant('table', x, z);
    const table = new THREE.Group();
    // A layered tabletop, apron, four legs, cross-braces, and adjustable feet.
    box(table, 0, 1.02, 0, 1.6, 0.12, 1.05, top);
    box(table, 0, .93, 0, 1.48, .12, .92, trim, false);
    for (const sx of [-.63, .63]) for (const sz of [-.38, .38]) {
      cylinder(table, sx, .49, sz, .055, .9, materials.darkMetal, 10);
      cylinder(table, sx, .035, sz, .09, .06, trim, 10);
    }
    box(table, 0, .42, 0, 1.2, .07, .07, materials.darkMetal, false);
    box(table, 0, .42, 0, .07, .07, .72, materials.darkMetal, false);
    table.position.set(x, 0, z);
    table.scale.set(variant.width, 1, variant.depth);
    table.userData.variant = variant;
    parent.add(table);
    return table;
  }

  function addVendingMachine(parent, x, z, accent = 0x4dbbc9) {
    const variant = propVariant('vending', x, z);
    const machine = new THREE.Group();
    const cabinet = material(0x20282d, .36, .7);
    const trimColor = accent === 0x4dbbc9 ? variant.accent : accent;
    const trim = new THREE.MeshStandardMaterial({ color: trimColor, emissive: trimColor, emissiveIntensity: .55 + variant.wear * .1, roughness: .25, metalness: .5 });
    box(machine, 0, 1.42, 0, 1.34, 2.72, .72, cabinet);
    box(machine, 0, 1.54, .374, 1.08, 1.64, .035, new THREE.MeshStandardMaterial({ color: 0x10161a, roughness: .12, metalness: .32 }));
    box(machine, .43, 1.54, .406, .19, 1.48, .055, trim, false);
    box(machine, 0, .74, .41, 1.05, .34, .07, material(0x101719, .3, .4), false);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 4; column++) {
      const product = box(machine, -.33 + column * .22, 1.95 - row * .31, .41, .15, .16, .04, material([0xb34a4d, 0xd29a45, 0x4c92a5, 0x798c4e][(row + column) % 4], .5), false);
      product.rotation.z = (column % 2 ? .08 : -.05) + (variant.index - 1.5) * .015;
    }
    const display = box(machine, .42, 2.37, .42, .18, .18, .04, new THREE.MeshBasicMaterial({ color: 0xcdf5ff }), false);
    box(machine, .42, 1.93, .42, .15, .35, .035, material(0x111416, .3, .65), false);
    for (const side of [-.47, .47]) box(machine, side, .07, 0, .18, .12, .7, materials.darkMetal, false);
    machine.position.set(x, 0, z);
    machine.scale.x = variant.width;
    machine.userData.variant = variant;
    parent.add(machine);
    return machine;
  }

  function addChair(parent, x, z, rotation = 0, upholstery = 0x3b4650) {
    const variant = propVariant('chair', x, z);
    const chair = new THREE.Group();
    const fabric = material(upholstery === 0x3b4650 ? [0x3b4650, 0x4a3a46, 0x3c4b40, 0x4c4137][variant.index] : upholstery, .78 + variant.wear * .05);
    box(chair, 0, .57, 0, .82, .13, .82, fabric);
    box(chair, 0, 1.05, .31, .82, .82, .12, fabric);
    for (const sx of [-.3, .3]) for (const sz of [-.3, .3]) cylinder(chair, sx, .28, sz, .045, .56, materials.darkMetal, 8);
    box(chair, 0, .42, .31, .7, .06, .06, materials.darkMetal, false);
    chair.position.set(x, 0, z); chair.rotation.y = rotation; chair.scale.set(variant.width, 1, variant.depth); chair.userData.variant = variant; parent.add(chair);
    return chair;
  }

  function addFloorLamp(parent, x, z, accent = 0xffc987) {
    const variant = propVariant('lamp', x, z);
    const lamp = new THREE.Group();
    cylinder(lamp, 0, .05, 0, .3, .1, materials.darkMetal, 16);
    cylinder(lamp, 0, .88, 0, .045, 1.65, materials.gold, 10);
    const lightColor = accent === 0xffc987 ? [0xffc987, 0xf0a9c2, 0x9bc8d5, 0xe7c676][variant.index] : accent;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.31 + variant.index * .02, .48, 16, 1, true), new THREE.MeshStandardMaterial({ color: lightColor, emissive: lightColor, emissiveIntensity: .45, roughness: .7, side: THREE.DoubleSide }));
    shade.position.y = 1.88; lamp.add(shade);
    const glow = new THREE.PointLight(lightColor, quality === 'high' ? 2.1 + variant.index * .14 : 1.1, 5, 2); glow.position.y = 1.78; lamp.add(glow);
    lamp.position.set(x, 0, z); lamp.userData.variant = variant; parent.add(lamp); return lamp;
  }

  function addTrashCan(parent, x, z) {
    const variant = propVariant('trash', x, z);
    const can = new THREE.Group();
    cylinder(can, 0, .47, 0, .38, .88, materials.darkMetal, 18);
    cylinder(can, 0, .94, 0, .4, .09, materials.gold, 18);
    cylinder(can, 0, 1.03, -.08, .09, .14, materials.darkMetal, 10);
    for (let i = 0; i < 6; i++) box(can, Math.sin(i) * .34, .49, Math.cos(i) * .34, .025, .65, .025, materials.gold, false);
    if (variant.wear === 2) box(can, .18, .72, .37, .15, .22, .02, material(0x82755d, .7), false);
    can.position.set(x, 0, z); can.scale.x = variant.width; can.userData.variant = variant; parent.add(can); return can;
  }

  function addTicketMachine(parent, x, z) {
    const variant = propVariant('ticket', x, z);
    const kiosk = new THREE.Group();
    box(kiosk, 0, 1.32, 0, 1.18, 2.48, .78, material(0x263239, .35, .72));
    box(kiosk, 0, 1.8, .41, .9, .88, .04, material(0x11191e, .18, .52), false);
    box(kiosk, 0, 2.05, .44, .66, .34, .03, new THREE.MeshBasicMaterial({ color: variant.accent }), false);
    box(kiosk, .31, 1.42, .44, .19, .31, .035, materials.gold, false);
    for (let i = 0; i < 3; i++) cylinder(kiosk, -.28 + i * .18, 1.39, .45, .055, .03, material(0xd4a34f, .25, .5), 10);
    for (const sx of [-.42, .42]) box(kiosk, sx, .08, 0, .16, .15, .72, materials.darkMetal, false);
    kiosk.position.set(x, 0, z); kiosk.scale.x = variant.width; kiosk.userData.variant = variant; parent.add(kiosk); return kiosk;
  }

  function addLuggageCart(parent, x, z) {
    const cart = new THREE.Group();
    box(cart, 0, .15, 0, 1.4, .12, .9, materials.gold);
    box(cart, 0, .27, 0, 1.18, .1, .7, material(0x542f2b, .75), false);
    for (const sx of [-.56, .56]) cylinder(cart, sx, .05, -.32, .1, .08, materials.darkMetal, 12);
    for (const sx of [-.56, .56]) {
      cylinder(cart, sx, 1.25, -.34, .05, 2.2, materials.gold, 10);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(.57, .05, 8, 16, Math.PI), materials.gold); arch.position.set(0, 2.25, -.34); cart.add(arch);
    }
    cart.position.set(x, 0, z); parent.add(cart); return cart;
  }

  function addWallTV(parent, x, y, z, rotation = 0) {
    const tv = new THREE.Group();
    box(tv, 0, 0, 0, 2.25, 1.34, .13, material(0x101518, .18, .62));
    box(tv, 0, .02, .08, 1.98, 1.08, .025, new THREE.MeshBasicMaterial({ color: 0x375864 }), false);
    box(tv, 0, -.76, -.05, .52, .23, .32, materials.darkMetal, false);
    tv.position.set(x, y, z); tv.rotation.y = rotation; parent.add(tv); return tv;
  }

  function addRail(parent, x, z, length, rotation = 0) {
    const rail = new THREE.Group();
    for (const side of [-1, 1]) cylinder(rail, side * length / 2, .48, 0, .045, .95, materials.darkMetal, 10);
    cylinder(rail, 0, .9, 0, .05, length, materials.gold, 10).rotation.z = Math.PI / 2;
    cylinder(rail, 0, .48, 0, .04, length, materials.darkMetal, 10).rotation.z = Math.PI / 2;
    rail.position.set(x, 0, z); rail.rotation.y = rotation; parent.add(rail); return rail;
  }

  function addDisplayShelf(parent, x, z, rotation = 0) {
    const variant = propVariant('shelf', x, z);
    const shelf = new THREE.Group();
    for (const side of [-.62, .62]) cylinder(shelf, side, 1.15, 0, .045, 2.25, materials.darkMetal, 10);
    for (const y of [.18, .82, 1.45, 2.08]) {
      box(shelf, 0, y, 0, 1.42, .08, .42, materials.wood, false);
      for (let i = 0; i < 3; i++) box(shelf, -.4 + i * .4, y + .16, .04 + (variant.index - 1.5) * .025, .22, .22 + ((i + variant.index) % 2) * .12, .18, material([0x657687, 0x8b664c, 0x596f58][(i + variant.index) % 3], .55 + variant.wear * .05), false);
    }
    shelf.position.set(x, 0, z); shelf.rotation.y = rotation; shelf.scale.x = variant.width; shelf.userData.variant = variant; parent.add(shelf); return shelf;
  }

  function addDoor(parent, x, y, z, { style = 'hotel', sliding = false } = {}) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
    const materialByStyle = { hotel: materials.wood, glass: materials.glass, metal: materials.darkMetal, service: material(0x4e5c60, .35, .7), subway: material(0x313d44, .32, .72) };
    const doorWidth = structuralGrid.opening(1.2);
    if (!hasWalkableOpening(doorWidth, NavigationStandards.minimumCeilingHeight)) throw new Error('Door does not meet navigation standards.');
    const leaf = box(pivot, sliding ? 0 : doorWidth / 2, 1.2, 0, doorWidth, 2.4, .13, materialByStyle[style] || materials.wood);
    if (style !== 'glass') cylinder(pivot, sliding ? .38 : 1.02, 1.2, .1, .06, .08, materials.gold, 10).rotation.z = Math.PI / 2;
    const controller = new DoorController(pivot, { type: style, mode: sliding ? 'sliding' : 'hinged', openAmount: sliding ? 1.22 : Math.PI / 2 });
    const door = { controller, position: new THREE.Vector3(x, 0, z), style };
    doors.push(door);
    interactionSystem.register({
      mode: parent === suite ? 'room' : 'hotel',
      type: 'door',
      object: pivot,
      controller,
      style,
      label: `Open ${style} door`,
    });
    return controller;
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

  function addWayfindingSign(parent, text, x, y, z, rotation = 0, width = 2.8) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, .5), new THREE.MeshBasicMaterial({ map: labelTexture(text, '#f0dfab', '#151a1d'), depthWrite: false }));
    sign.position.set(x, y, z); sign.rotation.y = rotation; sign.renderOrder = 3; parent.add(sign); return sign;
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
    return { skyUniforms: skyMaterial.uniforms, moon };
  }

  function addLighting() {
    return new EnvironmentLighting({ scene, roots: { city, hotel, suite }, quality });
  }

  function styleIndex(value, count) {
    let hash = 0;
    for (const char of String(value || '01')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash % count;
  }

  function makeCharacter({ gender = 'female', coat = 0x303844, skin = 0x9a5f43, hair = 0x171310, accent = 0xb7894d, player = false, selections = null, tagText = null } = {}) {
    const skinPalette = [0x5d382b, 0x754632, 0x925b42, 0xb97858, 0xd09a79, 0xe0b08d];
    const outfitPalette = [0x252d38, 0x533344, 0x24433f, 0x57472e, 0x3e3155, 0x5b292c, 0x27445c, 0x3d4146];
    const hairPalette = [0x14100e, 0x352019, 0x6d4528, 0x8e6a3d, 0x24191e, 0x151a21];
    if (selections) {
      skin = skinPalette[styleIndex(selections.face, skinPalette.length)];
      coat = outfitPalette[styleIndex(selections.torso, outfitPalette.length)];
      hair = hairPalette[styleIndex(selections.face, hairPalette.length)];
      accent = outfitPalette[styleIndex(selections.arms, outfitPalette.length)];
    }
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
    root.userData.torso = torso;
    root.userData.head = head;
    root.userData.gender = gender;
    root.userData.walkPhase = seeded() * Math.PI * 2;
    root.userData.arms = [root.userData['arm-1'], root.userData.arm1];
    const outfitStyle = styleIndex(selections?.torso, 4);
    if (outfitStyle === 1) {
      const jacket = box(root, 0, 1.48, 0.17, gender === 'female' ? 0.62 : 0.7, 0.72, 0.16, accentMat);
      jacket.rotation.x = -0.04;
    } else if (outfitStyle === 2) {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 20, Math.PI * 1.25), accentMat);
      chain.position.set(0, 1.82, -0.27);
      chain.rotation.x = Math.PI / 2;
      root.add(chain);
    } else if (outfitStyle === 3) {
      box(root, 0, 1.38, -0.3, gender === 'female' ? 0.48 : 0.58, 0.18, 0.09, accentMat);
    }
    const hairStyle = styleIndex(selections?.face, 3);
    if (hairStyle === 1) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), hairMat);
      bun.position.set(0, 2.55, 0.08);
      root.add(bun);
    } else if (hairStyle === 2) {
      for (const side of [-1, 1]) box(root, side * 0.21, 2.18, 0.02, 0.13, 0.58, 0.15, hairMat, false);
    }
    if (player) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 28), new THREE.MeshBasicMaterial({ color: 0xe7b764, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.018;
      root.add(marker);
      const playerLight = new THREE.PointLight(0x74e8f0, 2.4, 7, 2);
      playerLight.position.set(0, 1.7, 0);
      root.add(playerLight);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(tagText || onlineProfile?.tag || 'YOU', '#7de3e5', '#111820'), transparent: true, depthTest: false }));
      tag.scale.set(2.8, 0.46, 1);
      tag.position.set(0, 3.05, 0);
      root.add(tag);
    } else if (tagText) {
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(tagText, '#f0cb82', '#111820'), transparent: true, depthTest: false }));
      tag.scale.set(2.8, 0.46, 1);
      tag.position.set(0, 3.05, 0);
      root.add(tag);
    }
    const voiceIndicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x68d7a3, transparent: true, opacity: 0.9 }),
    );
    voiceIndicator.position.set(0.37, 2.7, 0);
    voiceIndicator.visible = false;
    root.add(voiceIndicator);
    root.userData.voiceIndicator = voiceIndicator;
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
      light.userData.baseIntensity = 7;
      nightLights.push(light);
      lamp.add(light);
    }
    lamp.position.set(x, 0, z);
    city.add(lamp);
  }

  function footprintsOverlap(a, b) { return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ; }
  function canPlaceDefaultBuilding(x, z, width, depth) {
    const candidate = { minX: x - width / 2 - .7, maxX: x + width / 2 + .7, minZ: z - depth / 2 - .7, maxZ: z + depth / 2 + .7 };
    for (const road of roadwayCenters) {
      if (Math.abs(x - road) < width / 2 + 6.5 || Math.abs(z - road) < depth / 2 + 6.5) return false;
    }
    for (const venue of VENUE_CATALOG) {
      const size = venueFootprintSizes[venue.type];
      if (!size) continue;
      const [vx, , vz] = venue.position;
      if (footprintsOverlap(candidate, { minX: vx - size[0] / 2 - 1, maxX: vx + size[0] / 2 + 1, minZ: vz - size[1] / 2 - 1, maxZ: vz + size[1] / 2 + 1 })) return false;
    }
    return !cityFootprints.some((existing) => footprintsOverlap(candidate, existing));
  }

  function addBuilding(x, z, width, depth, height, color, allowCollider = true) {
    ({ x, z, width, depth, height } = structuralGrid.footprint({ x, z, width, depth, height }));
    if (!canPlaceDefaultBuilding(x, z, width, depth)) return null;
    const structure = new THREE.Group();
    structure.position.set(x, 0, z);
    city.add(structure);
    const texture = windowTexture(color, 0.34 + seeded() * 0.28);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(0x8e7652),
      emissiveIntensity: 0.32,
      roughness: 0.74,
      metalness: 0.05,
    });
    const body = box(structure, 0, height / 2 + 0.35, 0, width, height, depth, buildingMaterial);
    body.castShadow = height < 34;
    const ledgeMat = material(0x272c30, 0.78, 0.12);
    const plinth = material(0x252b2f, .54, .28);
    box(structure, 0, .42, 0, width + .25, .84, depth + .25, plinth);
    for (let y = 4.4; y < height - 1; y += 7.2) box(structure, 0, y, 0, width + 0.18, 0.15, depth + 0.18, ledgeMat, false);
    for (const px of [-width / 2 + .24, width / 2 - .24]) for (const pz of [-depth / 2 + .24, depth / 2 - .24]) box(structure, px, height / 2, pz, .26, height + .12, .26, ledgeMat, false);
    const bays = Math.max(2, Math.floor(width / 3.2));
    const facadeGlass = [materials.glass, material(0x6b8291, .28, .18), material(0x8e7652, .18, .28)][Math.floor(seeded() * 3)];
    for (let y = 2.3; y < height - 1.8; y += 4.4) {
      for (let bay = 0; bay < bays; bay++) {
        const window = box(structure, -width / 2 + (bay + .5) * width / bays, y, -depth / 2 - .025, width / bays * .58, 1.65, .05, facadeGlass, false);
        window.material = facadeGlass;
        if ((bay + Math.round(y)) % 3 === 0) box(structure, -width / 2 + (bay + .5) * width / bays, y, depth / 2 + .025, width / bays * .48, 1.35, .05, materials.glass, false);
      }
    }
    if (width > 18 && height > 16) {
      const balconyMat = material(0x31383d, .72, .16);
      for (let y = 6.2; y < height - 2; y += 6.8) {
        box(structure, 0, y, -depth / 2 - .45, Math.min(width * .52, 8), .12, 1.05, balconyMat, false);
        box(structure, -Math.min(width * .26, 4), y + .55, -depth / 2 - .92, .08, 1.05, .08, balconyMat, false);
        box(structure, Math.min(width * .26, 4), y + .55, -depth / 2 - .92, .08, 1.05, .08, balconyMat, false);
      }
    }
    box(structure, 0, 2.65, -depth / 2 - .48, Math.min(width * .42, 6.4), .16, .82, ledgeMat, false);
    box(structure, 0, height + 0.58, 0, width + 0.35, 1.15, depth + 0.35, material(0x20262b, 0.85), true);
    if (height > 15) {
      box(structure, width * 0.18, height + 1.55, 0, Math.min(3.5, width * 0.35), 1.2, Math.min(3, depth * 0.34), ledgeMat);
      if (seeded() > 0.55) cylinder(structure, -width * 0.22, height + 3.1, 0, 0.07, 4, materials.darkMetal, 8);
      if (seeded() > 0.45) {
        const rooftopSign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(width * .45, 5.5), .75), new THREE.MeshBasicMaterial({ map: labelTexture(['LOFTS', 'STUDIO', 'MARKET', 'SUITES'][Math.floor(seeded() * 4)], '#f4cf8a', '#171b20') }));
        rooftopSign.position.set(0, height + 1.3, -depth / 2 - .06);
        structure.add(rooftopSign);
      }
    }
    cityFootprints.push({ minX: x - width / 2 - .7, maxX: x + width / 2 + .7, minZ: z - depth / 2 - .7, maxZ: z + depth / 2 + .7 });
    if (allowCollider) cityColliders.push({ minX: x - width / 2 - 0.5, maxX: x + width / 2 + 0.5, minZ: z - depth / 2 - 0.5, maxZ: z + depth / 2 + 0.5 });
  }

  function addSubwayStation(parent) {
    const station = new THREE.Group();
    parent.add(station);
    const tile = material(0x394248, .52, .08);
    const track = material(0x15191d, .86, .18);
    const hazard = material(0xd2a95f, .5, .18);
    // Ticket concourse: tile field, turnstiles, stair bank, and ceiling ribs.
    box(station, 0, .04, 0, 16, .08, 11, tile, false);
    for (let x = -4.8; x <= 4.8; x += 2.4) {
      box(station, x, .63, -1.2, .26, 1.15, 1.05, materials.darkMetal);
      box(station, x, 1.13, -1.72, .84, .06, .06, new THREE.MeshBasicMaterial({ color: 0x78cde0 }), false);
    }
    for (let step = 0; step < 6; step++) box(station, 0, .12 + step * .17, -4.15 - step * .42, 8.5, .17, .5, material(0x4c5357, .62, .15));
    for (const x of [-7.1, -3.6, 0, 3.6, 7.1]) box(station, x, 3.4, -2.8, .2, 6.8, 10.2, materials.darkMetal, false);
    // Platform and track trench with rails, sleepers, waiting seats, and signage.
    box(station, 0, .12, -11.2, 16, .24, 7.1, tile);
    box(station, 0, .26, -14.25, 16, .05, .24, hazard, false);
    box(station, 0, -.2, -18.5, 16, .38, 7.4, track);
    for (const x of [-3.3, 3.3]) box(station, x, .03, -18.5, .12, .12, 7.2, materials.darkMetal, false);
    for (let z = -15.6; z >= -21.4; z -= .62) box(station, 0, -.02, z, 7.5, .08, .14, material(0x493f36, .72), false);
    for (const x of [-5.3, -1.8, 1.8, 5.3]) addChair(station, x, -10.3, Math.PI, 0x334c59);
    const platformSign = new THREE.Mesh(new THREE.PlaneGeometry(5.8, .92), new THREE.MeshBasicMaterial({ map: labelTexture('PLATFORM 2 · UPTOWN', '#d8eff1', '#182126') }));
    platformSign.position.set(0, 3.35, -14.65); station.add(platformSign);
    for (const x of [-7.25, 7.25]) { box(station, x, 2.6, -11.5, .35, 5.1, 7.2, materials.hotelStone); addRail(station, x * .92, -11.3, 5.5, Math.PI / 2); }
    // Two tunnel mouths, one active and one sealed abandoned service spur.
    for (const [x, label, color] of [[-4.2, 'EAST TUNNEL', 0x78cde0], [4.2, 'SEALED SPUR', 0xbe6b9d]]) {
      box(station, x, 2.45, -22.25, 4.3, 4.9, .5, materials.darkMetal);
      const portal = new THREE.Mesh(new THREE.TorusGeometry(1.55, .16, 8, 18, Math.PI), material(color, .35, .52)); portal.position.set(x, 1.1, -22.56); station.add(portal);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, .42), new THREE.MeshBasicMaterial({ map: labelTexture(label, '#e6e1d0', '#15181a') })); sign.position.set(x, 3.55, -22.58); station.add(sign);
    }
    // Service rooms, power cabinets, and maintenance storage flank the platform.
    for (const [x, name, accent] of [[-10.5, 'POWER', 0xd2a95f], [10.5, 'MAINTENANCE', 0x7ba77b]]) {
      box(station, x, 1.8, -15, 3.8, 3.6, 5.2, materials.hotelStone);
      box(station, x, 1.55, -12.36, 1.9, 2.8, .12, materials.darkMetal);
      box(station, x, 2.9, -12.3, 2.3, .14, .2, material(accent, .3, .52), false);
      addDisplayShelf(station, x, -15.8); addTrashCan(station, x + 1.2, -14);
      const roomSign = new THREE.Mesh(new THREE.PlaneGeometry(2.5, .45), new THREE.MeshBasicMaterial({ map: labelTexture(name, '#e7d8a0', '#171a1b') })); roomSign.position.set(x, 3.03, -12.23); station.add(roomSign);
    }
    return station;
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

  function addWeaponDisplay(parent, x, y, z, category, accent, weaponKey) {
    const display = new THREE.Group();
    const dark = material(0x111820, .24, .78);
    const metal = new THREE.MeshStandardMaterial({ color: accent, roughness: .25, metalness: .72, emissive: accent, emissiveIntensity: .08 });
    const bodyLength = category === 'sniper' || category === 'rifle' || category === 'ar' ? 2.1 : category === 'rpg' ? 1.8 : 1.35;
    box(display, 0, 0, 0, bodyLength, .24, .28, metal, false);
    box(display, -bodyLength * .28, -.24, 0, .22, .48, .3, dark, false);
    cylinder(display, bodyLength * .56, 0, 0, .08, category === 'minigun' ? .7 : .95, metal, 12);
    if (category === 'sniper' || category === 'rifle' || category === 'ar') {
      box(display, -bodyLength * .55, .02, 0, .46, .34, .36, dark, false);
      if (category !== 'ar') cylinder(display, 0, .22, 0, .06, .45, metal, 10);
    }
    if (category === 'minigun') {
      for (let i = 0; i < 6; i++) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .62, 8), metal);
        barrel.rotation.z = Math.PI / 2; barrel.position.set(.48, Math.cos(i / 6 * Math.PI * 2) * .13, Math.sin(i / 6 * Math.PI * 2) * .13); display.add(barrel);
      }
    }
    if (category === 'emp' || category === 'explosive') {
      const device = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 10), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.8, roughness: .3 }));
      device.position.set(0, .18, 0); display.add(device);
    }
    display.position.set(x, y, z);
    display.rotation.y = -.18;
    display.userData.weaponKey = weaponKey;
    display.userData.camoMaterial = metal;
    display.userData.camoIndex = weaponDisplays.length % CAMO_CATALOG.length;
    parent.add(display);
    weaponDisplays.push(display);
  }

  function addCityVenue(venue) {
    if (!venue) return;
    const [x, , z] = venue.position;
    const isGunShop = venue.type === 'gun-shop';
    const accent = venue.type === 'gun-shop' ? 0x6fd7e4 : venue.type === 'adult-club' ? 0xf04fb8 : venue.type === 'car-dealership' ? 0xf0c05a : venue.type === 'car-mod-shop' ? 0x91d8e8 : 0xd8a95f;
    const width = isGunShop ? 18 : venue.type === 'bar' ? 14 : venue.type === 'car-dealership' || venue.type === 'car-mod-shop' ? 16 : 12;
    const depth = isGunShop ? 16 : venue.type === 'bar' ? 10 : venue.type === 'car-dealership' || venue.type === 'car-mod-shop' ? 12 : 8;
    const building = new THREE.Group();
    building.userData.venueKey = venue.key;
    building.userData.activity = { open: true, state: 'open', crowdLevel: .5 };
    building.position.set(x, 0, z);
    if (isGunShop) {
      // Neon Arsenal is a dedicated outdoor lot, separate from the city's generic buildings.
      box(building, 0, .08, 0, width, .16, depth, material(0x202a30, .46, .36), false);
      box(building, 0, .18, 2.7, width - 1.2, .08, 5.6, material(0x34464d, .38, .3), false);
      for (const lineX of [-6, -2, 2, 6]) box(building, lineX, .24, 2.7, .09, .03, 5.2, material(0x6fd7e4, .24, .5), false);
      for (const markerX of [-8.1, 8.1]) {
        for (const markerZ of [-6.8, 6.8]) {
          cylinder(building, markerX, 1.1, markerZ, .18, 2.2, material(0x6fd7e4, .32, .62), 12);
          const beacon = new THREE.PointLight(accent, 2.5, 7, 2);
          beacon.position.set(markerX, 2.2, markerZ); building.add(beacon);
        }
      }
      // A roofed sales canopy keeps the shop readable without enclosing it in a building.
      box(building, 0, 4.8, -1.5, 14.5, .28, 6.8, material(0x101a20, .28, .62));
      for (const postX of [-6.8, 6.8]) for (const postZ of [-4.5, 1.5]) cylinder(building, postX, 2.4, postZ, .12, 4.6, material(0x6fd7e4, .25, .72), 10);
      box(building, 0, 4.45, -4.95, 14.5, .9, .22, material(0x15252c, .25, .7));
    } else {
      box(building, 0, 2.65, depth / 2, width, 5.3, .35, material(0x151a20, .42, .38));
      box(building, -width / 2, 2.65, 0, .35, 5.3, depth, material(0x151a20, .42, .38));
      box(building, width / 2, 2.65, 0, .35, 5.3, depth, material(0x151a20, .42, .38));
      box(building, 0, 5.3, 0, width, .35, depth, material(0x0b1015, .34, .48));
      box(building, 0, .35, 0, width - .7, .35, depth - .7, material(0x242a31, .32, .25), false);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width * .72, 1.15), new THREE.MeshBasicMaterial({ map: labelTexture(venue.name, venue.type === 'gun-shop' ? '#b9f4ff' : venue.type === 'adult-club' ? '#ffd0f0' : venue.type === 'car-mod-shop' ? '#b8f5ff' : '#ffe1a2', '#17121c') }));
    sign.position.set(0, isGunShop ? 4.9 : 4.35, isGunShop ? -5.08 : -depth / 2 - .22);
    sign.rotation.y = Math.PI;
    building.add(sign);
    const light = new THREE.PointLight(accent, 7, 18, 2);
    light.position.set(0, 3.4, -depth / 2 - 1.2);
    building.add(light);
    building.userData.activityLight = light;
    if (venue.type === 'gun-shop') {
      for (const itemX of [-5.4, -1.8, 1.8, 5.4]) box(building, itemX, 1.25, -.8, 1.5, 1.5, .55, material(0x303940, .26, .72));
      WEAPON_CATALOG.forEach((weapon, index) => addWeaponDisplay(building, -6.3 + (index % 5) * 3.15, 2.08 + Math.floor(index / 5) * .48, -.78, weapon.category, [0x6fd7e4, 0xd3aa61, 0xe45da8][index % 3], weapon.key));
      box(building, 0, 1.0, -3.9, width * .72, 1.2, .42, material(0x27343a, .24, .66));
    } else if (venue.type === 'car-dealership') {
      box(building, 0, 1.1, -depth / 2 + .8, width * .75, 1.5, .45, material(0x2a3036, .42, .28));
      VEHICLE_CATALOG.forEach((vehicle, index) => addVehicleDisplay(building, -5.1 + (index % 3) * 5.1, -2.2 + Math.floor(index / 3) * 3.1, vehicle));
    } else if (venue.type === 'car-mod-shop') {
      box(building, 0, 1.0, -depth / 2 + .8, width * .75, 1.4, .5, material(0x263d45, .45, .24));
      for (const px of [-5.2, 0, 5.2]) { box(building, px, .2, 1.2, 3.3, .12, 5.2, material(0x3e474c, .52, .24), false); cylinder(building, px, 2.4, 1.2, 1.5, .12, material(0x8ed8e5, .28, .3, 0x1a5a68), 24); }
    } else if (venue.type === 'adult-club') {
      const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, .32, 32), material(0x3c1838, .24, .18));
      stage.position.set(0, .55, 1.1); building.add(stage);
      cylinder(building, 0, 2.2, 1.1, .08, 3.2, material(0xd7a8c8, .18, .64), 16);
      for (const px of [-4.2, 4.2]) addCafeTable(building, px, -1.3);
      box(building, 0, 1.1, -depth / 2 + .8, width * .68, 1.6, .45, material(0x4c203a, .38, .2));
    } else {
      box(building, 0, 1.25, -depth / 2 + .8, width * .72, 1.35, .5, material(0x503b2a, .38, .28));
      for (const px of [-4.1, -1.4, 1.4, 4.1]) addCafeTable(building, px, 1.5);
      for (const px of [-4.4, 4.4]) addFloorLamp(building, px, -1.2);
    }
    city.add(building);
    venueObjects.set(venue.key, building);
    if (!isGunShop) cityColliders.push({ minX: x - width / 2 - 0.55, maxX: x + width / 2 + 0.55, minZ: z - depth / 2 - 0.55, maxZ: z + depth / 2 + 0.55 });
    interactables.push({ mode: 'city', venueKey: venue.key, type: venue.type === 'gun-shop' ? 'gunShop' : venue.type === 'car-dealership' ? 'carDealership' : venue.type === 'car-mod-shop' ? 'carModShop' : venue.type === 'adult-club' ? 'adultClub' : 'cityBar', position: new THREE.Vector3(x, 0, z - depth / 2 - 1.8), label: venue.type === 'gun-shop' ? 'Browse Neon Arsenal' : venue.type === 'car-dealership' ? 'Shop Diamond Lane Motors' : venue.type === 'car-mod-shop' ? 'Enter Blacktop Customs' : venue.type === 'adult-club' ? 'Enter Velvet Stage · adults 21+' : 'Buy a drink · Midnight Mile Bar 28' });
  }

  function addCity() {
    const cityFloor = box(city, 0, -0.36, 0, 320, 0.7, 320, textureLibrary.withRepeat(materials.asphalt, 'asphalt', 64), false);
    cityFloors.push(cityFloor);
    decals.floor(city, 7, .03, -23, 8, 4, { kind: 'water', rotation: .35 });
    decals.floor(city, -32, .03, 18, 5, 3, { kind: 'grime', rotation: -.5 });
    decals.floor(city, -45, .04, 7.8, 3.6, 1.2, { kind: 'marking', label: '24' });
    const roadPositions = WORLD_LAYOUT.roads;
    const roadMaterial = material(0x171c20, 0.34, 0.06);
    for (const p of roadPositions) {
      box(city, p, -0.02, 0, 13, 0.08, 320, roadMaterial, false);
      box(city, 0, -0.015, p, 320, 0.08, 13, roadMaterial, false);
      const sidewalk = material(0x535b5d, .58, .32);
      box(city, p - 8.1, 0.01, 0, 2.4, 0.11, 320, sidewalk, false);
      box(city, p + 8.1, 0.01, 0, 2.4, 0.11, 320, sidewalk, false);
      box(city, 0, 0.01, p - 8.1, 320, 0.11, 2.4, sidewalk, false);
      box(city, 0, 0.01, p + 8.1, 320, 0.11, 2.4, sidewalk, false);
      for (let line = -146; line <= 146; line += 7.5) {
        box(city, p, 0.03, line, 0.12, 0.025, 3.4, material(0xc9a95e, 0.7), false);
        box(city, line, 0.035, p, 3.4, 0.025, 0.12, material(0xc9a95e, 0.7), false);
      }
    }
    const crosswalkMat = material(0xd5d0bb, .42, .38);
    for (const x of roadPositions) for (const z of roadPositions) {
      for (let stripe = -4.8; stripe <= 4.8; stripe += 1.6) {
        box(city, x + stripe, 0.055, z - 9.2, 0.72, 0.025, 3.2, crosswalkMat, false);
        box(city, x + stripe, 0.055, z + 9.2, 0.72, 0.025, 3.2, crosswalkMat, false);
        box(city, x - 9.2, 0.055, z + stripe, 3.2, 0.025, 0.72, crosswalkMat, false);
        box(city, x + 9.2, 0.055, z + stripe, 3.2, 0.025, 0.72, crosswalkMat, false);
      }
      for (const [dx, dz] of [[-7.1, -7.1], [7.1, -7.1], [-7.1, 7.1], [7.1, 7.1]]) {
        const planter = new THREE.Group();
        box(planter, 0, .28, 0, .78, .56, .78, material(0x3a3030, .22, .5), false);
        cylinder(planter, 0, 1.05, 0, .28, 1.1, material(0x4a3025, .16, .58), 10);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.78, 1), material(0x255344, .18, .76));
        crown.position.y = 1.65; planter.add(crown);
        planter.position.set(x + dx, 0, z + dz); city.add(planter);
      }
    }
    // Repeated road reflectors are batched into one draw call instead of
    // hundreds of individual meshes.
    const reflectorCount = roadPositions.length * 39 * 2;
    const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .025, .62), material(0xe1be63, .52, .2), reflectorCount);
    const reflectorMatrix = new THREE.Matrix4();
    let reflectorIndex = 0;
    for (const p of roadPositions) {
      for (let line = -144; line <= 144; line += 7.5) {
        reflectorMatrix.makeTranslation(p, .07, line); reflectors.setMatrixAt(reflectorIndex++, reflectorMatrix);
        reflectorMatrix.makeTranslation(line, .07, p); reflectorMatrix.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)); reflectors.setMatrixAt(reflectorIndex++, reflectorMatrix);
      }
    }
    reflectors.count = reflectorIndex; reflectors.instanceMatrix.needsUpdate = true; reflectors.castShadow = false; reflectors.receiveShadow = false;
    city.add(reflectors);

    const venueReservations = VENUE_CATALOG.filter((venue) => venue.type !== 'hotel-hosting').map((venue) => ({ x: venue.position[0], z: venue.position[2], radius: 30 }));
    const isVenueLot = (x, z) => venueReservations.some((lot) => Math.abs(x - lot.x) < lot.radius && Math.abs(z - lot.z) < lot.radius);
    for (let x = -144; x <= 144; x += 48) {
      for (let z = -144; z <= 144; z += 48) {
        const hotelBlock = x === 0 && (z === -48 || z === -96);
        if (hotelBlock || isVenueLot(x, z)) continue;
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
    addCityVenue(VENUE_CATALOG.find((venue) => venue.type === 'gun-shop'));
    addCityVenue(VENUE_CATALOG.find((venue) => venue.type === 'car-dealership'));
    addCityVenue(VENUE_CATALOG.find((venue) => venue.type === 'car-mod-shop'));
    addCityVenue(VENUE_CATALOG.find((venue) => venue.type === 'adult-club'));
    addCityVenue(VENUE_CATALOG.find((venue) => venue.type === 'bar'));

    const plaza = box(city, 0, 0.12, -27, 30, 0.24, 14, materials.wetConcrete, false);
    cityFloors.push(plaza);
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
    addWayfindingSign(metro, 'SUBWAY · PLATFORM ↓', 0, 3.1, 2.86, 0, 5.4);
    addWayfindingSign(metro, 'EXIT ↑', -3, 2.55, -2.8, Math.PI, 1.7);
    addTicketMachine(metro, -2.45, -1.3);
    addTicketMachine(metro, .15, -1.3);
    for (let i = 0; i < 4; i++) addChair(metro, -2.55 + i * 1.7, 1.5, Math.PI, 0x334c59);
    addRail(metro, 0, -2.25, 6.6);
    addSubwayStation(metro);
    cityColliders.push({ minX: -49.3, maxX: -40.7, minZ: 2.1, maxZ: 7.9 });
    interactables.push({ mode: 'city', type: 'jobBoard', position: new THREE.Vector3(-45, 0, 8.3), label: 'View courier jobs' });
    interactables.push({ mode: 'city', type: 'subwayInfo', position: new THREE.Vector3(-45, 0, 0), label: 'Explore 24th Street Station' });

    const foodStand = new THREE.Group();
    foodStand.position.set(0, 0, -36);
    city.add(foodStand);
    box(foodStand, 0, 0.75, 0, 3.4, 1.5, 1.8, material(0x6f3035, 0.55, 0.2));
    box(foodStand, 0, .78, .93, 3.05, .95, .08, material(0x272324, .4, .35), false);
    box(foodStand, 0, 1.45, .98, 2.7, .3, .05, material(0xd4a34f, .32, .46), false);
    for (let i = 0; i < 3; i++) cylinder(foodStand, -1 + i, 1.74, .98, .12, .12, material([0xd16750, 0xe0b657, 0x629e83][i], .5), 12);
    box(foodStand, 0, 2.45, 0, 4.2, 0.18, 2.5, material(0xd4a34f, 0.38, 0.35));
    for (const x of [-1.55, 1.55]) cylinder(foodStand, x, 1.6, 0, 0.07, 3.2, materials.darkMetal, 10);
    const foodSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.72), new THREE.MeshBasicMaterial({ map: labelTexture('NIGHT BITES', '#ffe0a0', '#681e2b'), transparent: false }));
    foodSign.position.set(0, 2.75, 0.02);
    foodStand.add(foodSign);
    cityColliders.push({ minX: -1.9, maxX: 1.9, minZ: -36.9, maxZ: -35.1 });
    interactables.push({ mode: 'city', type: 'foodStand', position: new THREE.Vector3(0, 0, -34.6), label: 'Buy a hot meal · $18' });

    const neonWords = ['OPEN LATE', 'CITY CLUB', 'VINYL', '24 HOUR'];
    [[-69,-39,0],[69,9,Math.PI],[9,69,-Math.PI/2],[-39,69,Math.PI/2]].forEach(([x,z,rotation], index) => {
      const glow = new THREE.MeshBasicMaterial({ map: labelTexture(neonWords[index], index % 2 ? '#66e4ec' : '#ff63c3', '#121018', 640, 150) });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.35), glow);
      sign.position.set(x, 4.1, z);
      sign.rotation.y = rotation;
      city.add(sign);
      const light = new THREE.PointLight(index % 2 ? 0x4ed5e3 : 0xf24cb6, quality === 'high' ? 5 : 2.5, 10, 2);
      light.position.copy(sign.position).add(new THREE.Vector3(0, -0.3, 1.2));
      city.add(light);
    });

    const puddleMaterial = new THREE.MeshPhysicalMaterial({ color: 0x182b35, roughness: 0.08, metalness: 0.25, clearcoat: 1, transparent: true, opacity: 0.72 });
    for (let i = 0; i < 22; i++) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.8 + seeded() * 1.7, 18), puddleMaterial);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.y = 0.35 + seeded() * 0.4;
      puddle.position.set((seeded() - 0.5) * 185, 0.055, (seeded() - 0.5) * 185);
      city.add(puddle);
    }

    for (const [x, z, rotation] of [[12,-43,0],[-18,-35,0],[-55,28,Math.PI/2],[55,28,Math.PI/2]]) {
      const bench = new THREE.Group();
      box(bench, 0, 0.55, 0, 2.5, 0.18, 0.55, materials.wood);
      box(bench, 0, 1.05, 0.25, 2.5, 0.75, 0.14, materials.wood);
      for (const side of [-1,1]) box(bench, side * 0.9, 0.28, 0, 0.12, 0.55, 0.45, materials.darkMetal);
      for (const side of [-1, 1]) {
        box(bench, side * 1.13, .75, .06, .08, .13, .68, materials.darkMetal, false);
        cylinder(bench, side * .9, .06, 0, .09, .08, materials.darkMetal, 10);
      }
      box(bench, 0, .26, -.05, 1.9, .07, .07, materials.darkMetal, false);
      bench.position.set(x, 0, z);
      bench.rotation.y = rotation;
      city.add(bench);
      const halfX = Math.abs(Math.cos(rotation)) * 1.3 + Math.abs(Math.sin(rotation)) * .35;
      const halfZ = Math.abs(Math.sin(rotation)) * 1.3 + Math.abs(Math.cos(rotation)) * .35;
      cityColliders.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
    }

    [[62,-24],[-24,62],[62,62]].forEach(([x,z], index) => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0x5cc8cf, transparent: true, opacity: 0.68 }));
      marker.position.set(x, 0.08, z);
      marker.visible = false;
      city.add(marker);
      interactables.push({ mode: 'city', type: 'courierStop', position: new THREE.Vector3(x, 0, z), object: marker, active: false, stopIndex: index, label: `Deliver package ${index + 1}/3` });
    });

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
      vehicle.userData.route = roadGraph.route(new THREE.Vector3(lane, 0, -96), new THREE.Vector3(lane, 0, 96));
      vehicle.userData.routeIndex = 0;
      city.add(vehicle);
      vehicles.push(vehicle);
    }

    const cityNightlife = [
      ['Elena', 'Nightlife guest', -7, -16], ['Maya', 'Club regular', 8, -13], ['Jules', 'Fashion stylist', -32, 18],
      ['Naomi', 'Music promoter', 33, 12], ['Camille', 'Late-night traveler', -54, -2], ['Ari', 'Hotel visitor', 52, -22],
      ['Vivian', 'Streetwear designer', 47, 48], ['Tess', 'Local creative', -8, 31], ['Sloane', 'VIP guest', 28, -72],
      ['Raina', 'Nightlife host', -30, 72], ['Kiara', 'Event planner', 14, 39], ['Sabrina', 'DJ', -42, -38],
      ['Zara', 'Bar regular', 69, 15], ['Nia', 'Photographer', -70, 31], ['Lola', 'Touring artist', 72, -54],
      ['Brielle', 'Concierge friend', -16, 64], ['Milan', 'Late-night guest', 15, -44], ['Avery', 'Hotel visitor', -61, -63],
    ];
    cityNightlife.forEach(([name, socialRole, x, z], index) => {
      const coat = [0x4a3131,0x283947,0x4c493f,0x2d4540,0x56314f,0x3b2e52][index % 6];
      const skin = [0x8c543b,0xc28163,0x6d402f,0xd0a086,0x9d6045][index % 5];
      const hair = [0x1a1210,0x42271e,0x15171a,0x6a4329][index % 4];
      const accent = [0xd1a15a,0x7db9c2,0xc76a92][index % 3];
      const npc = makeCharacter({ gender: 'female', coat, skin, hair, accent });
      npc.position.set(x, 0, z);
      npc.rotation.y = seeded() * Math.PI * 2;
      npc.userData.name = name;
      npc.userData.socialRole = socialRole;
      npc.userData.appearance = { skin, clothing: coat, hair, accessory: accent };
      npc.userData.base = new THREE.Vector3(x, 0, z);
      npc.userData.roamRadius = 6 + seeded() * 4;
      npc.userData.roamSpeed = 1.05 + seeded() * .45;
      npc.userData.roamTarget = npc.userData.base.clone();
      npc.userData.roamPause = seeded() * 1.5;
      city.add(npc);
      npcs.push(npc);
      interactables.push({ mode: 'city', type: 'person', object: npc, label: `Meet ${name} · ${socialRole}` });
    });
  }

  function addFurniture(parent, x, z, rotation = 0) {
    const variant = propVariant('sofa', x, z);
    const sofa = new THREE.Group();
    const upholstery = [0x3c4142, 0x47353e, 0x34473f, 0x464035][variant.index];
    box(sofa, 0, 0.52, 0, 3.2, 0.7, 1.15, material(upholstery, .84 + variant.wear * .04));
    box(sofa, 0, 1.02, 0.46, 3.2, 0.85, 0.24, material(upholstery, .84 + variant.wear * .04));
    for (const sx of [-1.12, -.38, .38, 1.12]) box(sofa, sx, .93, -.14, .52, .11, .92, material([0x47535a, 0x65424d, 0x3d6656, 0x62583f][variant.index], .84), false);
    for (const side of [-1, 1]) box(sofa, side * 1.55, 0.77, 0, 0.25, 0.9, 1.1, material(0x34393a, 0.86));
    for (const side of [-1, 1]) for (const depth of [-.4, .4]) cylinder(sofa, side * 1.38, .08, depth, .07, .13, materials.gold, 10);
    sofa.position.set(x, 0, z); sofa.scale.set(variant.width, 1, variant.depth); sofa.userData.variant = variant;
    sofa.rotation.y = rotation;
    parent.add(sofa);
    const colliders = parent === hotel ? hotelColliders : parent === suite ? suiteColliders : null;
    if (colliders) {
      const halfX = Math.abs(Math.cos(rotation)) * 1.6 + Math.abs(Math.sin(rotation)) * .58;
      const halfZ = Math.abs(Math.sin(rotation)) * 1.6 + Math.abs(Math.cos(rotation)) * .58;
      colliders.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
    }
  }

  function addHotelZone({ name, type, x, z, width, depth, accent = 0xb98c45 }) {
    ({ x, z, width, depth } = structuralGrid.footprint({ x, z, width, depth }));
    const zone = new THREE.Group();
    zone.position.set(x, 0, z);
    const floor = material(type === 'service' ? 0x3a4144 : 0x473a34, .7, .08);
    box(zone, 0, .025, 0, width, .05, depth, floor, false);
    // Three sided zone shell keeps circulation open from the main hall.
    box(zone, 0, 1.6, -depth / 2, width, 3.2, .22, materials.hotelStone);
    box(zone, -width / 2, 1.6, 0, .22, 3.2, depth, materials.hotelStone);
    box(zone, width / 2, 1.6, 0, .22, 3.2, depth, materials.hotelStone);
    box(zone, 0, 3.18, -depth / 2 - .02, width + .12, .18, .34, materials.gold, false);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(width - .6, 5.5), .65), new THREE.MeshBasicMaterial({ map: labelTexture(name, '#efd18b', '#171b1d'), transparent: false }));
    sign.position.set(0, 2.72, -depth / 2 - .14); zone.add(sign);
    const glow = new THREE.PointLight(accent, 2.4, 7, 2); glow.position.set(0, 2.35, -depth / 2 + .65); zone.add(glow);
    if (type === 'bar') {
      box(zone, 0, .76, -.9, width - 1.2, 1.45, 1.25, materials.wood);
      box(zone, 0, 1.52, -.9, width - .9, .12, 1.48, materials.gold);
      for (let i = -2; i <= 2; i++) { addChair(zone, i * 1.35, .65, Math.PI, 0x493242); cylinder(zone, i * 1.35, 1.85, -1.28, .09, .34, material(0x7da5ad, .25, .35), 12); }
    } else if (type === 'restaurant') {
      for (const [tx, tz] of [[-2, -1.1], [2, -1.1], [-2, 2], [2, 2]]) { addCafeTable(zone, tx, tz); addChair(zone, tx - 1.05, tz, Math.PI / 2); addChair(zone, tx + 1.05, tz, -Math.PI / 2); }
    } else if (type === 'lounge') {
      addFurniture(zone, 0, -.6); addCafeTable(zone, 0, 1.35); addFloorLamp(zone, -width / 2 + .8, 1.2, accent); addWallTV(zone, 0, 2.15, -depth / 2 + .14);
    } else if (type === 'service') {
      addDisplayShelf(zone, -width / 2 + 1.1, 0, Math.PI / 2); addDisplayShelf(zone, width / 2 - 1.1, 0, -Math.PI / 2); addTrashCan(zone, 0, depth / 2 - .8);
      for (let i = -1; i <= 1; i++) box(zone, i * 1.55, .6, -.7, 1.1, 1.1, .85, material(0xc6c4be, .72), false);
    } else if (type === 'security') {
      box(zone, 0, .75, -.65, width - 1, 1.4, 1.05, materials.darkMetal); addWallTV(zone, 0, 2.05, -depth / 2 + .14); addVendingMachine(zone, width / 2 - 1, .8, accent);
    } else if (type === 'stairs') {
      for (let step = 0; step < 7; step++) box(zone, 0, .12 + step * .23, depth / 2 - .65 - step * .45, width - 1.1, .23, .54, material(0x474c4f, .6, .2));
      addRail(zone, -width / 2 + .4, 0, depth - 1.1, Math.PI / 2); addRail(zone, width / 2 - .4, 0, depth - 1.1, Math.PI / 2);
    }
    zone.userData.zoneType = type;
    hotel.add(zone);
    return zone;
  }

  function addHotelInterior() {
    const hotelFloor = box(hotel, 0, -0.3, 0, 48, 0.6, 40, textureLibrary.withRepeat(materials.wetConcrete, 'tile', 12, 10));
    hotelFloors.push(hotelFloor);
    box(hotel, 0, .012, -1.5, 9.5, .035, 32, material(0x5b3d50, .44, .08), false);
    for (const z of [-15, -7.5, 0, 7.5, 15]) box(hotel, 0, .055, z, 9.5, .018, .08, materials.gold, false);
    decals.floor(hotel, 0, .03, 8, 5, 2.5, { kind: 'marking', label: 'S / T / H' });
    decals.floor(hotel, 15.8, .03, 10.5, 3.2, 2.2, { kind: 'grime' });
    box(hotel, 0, 7.5, -19.5, 48, 15, 1, materials.hotelStone);
    box(hotel, -23.5, 7.5, 0, 1, 15, 40, materials.hotelStone);
    box(hotel, 23.5, 7.5, 0, 1, 15, 40, materials.hotelStone);
    box(hotel, 0, 7.5, 19.5, 48, 15, 1, materials.hotelStone);
    box(hotel, 0, 0.03, -2, 7, 0.06, 34, materials.carpet, false);
    for (let z = -15; z <= 15; z += 7.5) box(hotel, 0, 7.2, z, 46, .24, .32, materials.darkMetal, false);
    for (const x of [-18, -9, 9, 18]) box(hotel, x, 7.2, 0, .32, .24, 38, materials.darkMetal, false);

    for (const x of [-9, 9]) {
      cylinder(hotel, x, 3.8, 2, 0.34, 7.6, materials.gold, 24);
      cylinder(hotel, x, 3.8, -10, 0.34, 7.6, materials.gold, 24);
    }
    for (const [x, z, accent] of [[-21.8, -2, 0xd7a35e], [21.8, -2, 0x69d3df], [-21.8, 11, 0xe55da8], [21.8, 11, 0xd7a35e]]) {
      const sconce = new THREE.Group();
      box(sconce, 0, 1.1, 0, .18, 2.2, .24, materials.gold, false);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(.32, .62, 12), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.6, roughness: .3 }));
      shade.position.y = 1.55; sconce.add(shade);
      const glow = new THREE.PointLight(accent, 2.2, 7, 2); glow.position.y = 1.45; sconce.add(glow);
      sconce.position.set(x, 2.2, z); hotel.add(sconce);
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
    box(desk, 0, .4, 1.13, 10.25, .68, .09, material(0x262b2d, .48, .35), false);
    for (const x of [-4.75, -2.4, 0, 2.4, 4.75]) box(desk, x, .7, 1.17, .07, 1.15, .08, materials.gold, false);
    for (const x of [-3.5, .4, 3.5]) {
      box(desk, x, 1.68, -.15, .86, .06, .52, material(0x111a1d, .2, .55), false);
      box(desk, x, 1.72, .14, .64, .04, .04, new THREE.MeshBasicMaterial({ color: 0x84d4e2 }), false);
    }
    desk.position.set(0, 0, -12.2);
    hotel.add(desk);
    hotelColliders.push({ minX: -5.5, maxX: 5.5, minZ: -13.4, maxZ: -11 });
    const deskSign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.25), new THREE.MeshBasicMaterial({ map: labelTexture('RECEPTION', '#d9b66f', '#171719') }));
    deskSign.position.set(0, 4.9, -19.02);
    hotel.add(deskSign);
    addWayfindingSign(hotel, 'LOBBY · RECEPTION', 0, 3.75, -10.95, 0, 4.5);
    addWayfindingSign(hotel, 'ELEVATOR →', 15.8, 3, -15.85, 0, 2.8);
    addWayfindingSign(hotel, 'EXIT → STATION', 0, 3, 18.86, Math.PI, 3.2);
    addWayfindingSign(hotel, 'STAIRS / ROOF', -18.4, 3, -15.95, 0, 2.8);

    for (const x of [-16, -11, 11, 16]) {
      box(hotel, x, 2.45, -18.9, 4.1, 4.7, 0.15, materials.glass);
      box(hotel, x, 4.95, -18.7, 4.3, 0.18, 0.35, materials.gold);
    }

    addFurniture(hotel, -13, 6, Math.PI / 2);
    addFurniture(hotel, 13, 6, -Math.PI / 2);
    addFurniture(hotel, -13, -5, Math.PI / 2);
    addFurniture(hotel, 13, -5, -Math.PI / 2);
    addCafeTable(hotel, -13, 1.2);
    addCafeTable(hotel, 13, 1.2);
    addVendingMachine(hotel, -20.6, -7.5, 0xbd6ab5);
    addLuggageCart(hotel, 18.8, 8.5);
    addLuggageCart(hotel, -18.8, 8.5);
    addFloorLamp(hotel, -5.7, 9.4);
    addFloorLamp(hotel, 5.7, 9.4);
    addTrashCan(hotel, -20.5, 13.5);
    addTrashCan(hotel, 20.5, 13.5);
    addDisplayShelf(hotel, -20.9, 2.5, Math.PI / 2);
    addDisplayShelf(hotel, 20.9, 2.5, -Math.PI / 2);
    hotelColliders.push({ minX: -21.35, maxX: -19.85, minZ: -8, maxZ: -7 });
    for (const [x, z] of [[-13,1],[13,1],[-13,-10],[13,-10]]) {
      cylinder(hotel, x, 0.42, z, 0.72, 0.18, materials.gold, 24);
      cylinder(hotel, x, 0.22, z, 0.08, 0.45, materials.darkMetal, 12);
    }

    const elevatorMat = new THREE.MeshStandardMaterial({ color: 0x606367, roughness: 0.2, metalness: 0.82 });
    for (const x of [-17.5, 17.5]) {
      box(hotel, x, 3, -18.92, 6, 5.9, 0.18, elevatorMat);
      box(hotel, x, 6.15, -18.75, 6.4, 0.32, 0.42, materials.gold);
    }
    addDoor(hotel, -20.7, 0, 1.1, { style: 'service' });
    addDoor(hotel, 20.7, 0, 1.1, { style: 'metal' });

    // Purposeful hotel wings branch off the open main hall; their front edges
    // remain open so every space is discoverable without loading a new scene.
    const hotelZones = [
      { name: 'VELVET BAR', type: 'bar', x: -15.2, z: 13.5, width: 14, depth: 10, accent: 0xbe6b9d },
      { name: 'NIGHT DINING', type: 'restaurant', x: 14.5, z: 13.5, width: 15, depth: 10, accent: 0xd2a95f },
      { name: 'VIP LOUNGE', type: 'lounge', x: -15.5, z: -3.8, width: 11, depth: 7.5, accent: 0x6c9ab1 },
      { name: 'SECURITY', type: 'security', x: 17.3, z: -4, width: 9, depth: 7.5, accent: 0x78cde0 },
      { name: 'LAUNDRY + SERVICE', type: 'service', x: 16.5, z: 4.8, width: 10, depth: 6.6, accent: 0x7ba77b },
      { name: 'STAIRS / ROOF', type: 'stairs', x: -18.4, z: -12.8, width: 7.4, depth: 6.3, accent: 0xd2a95f },
    ];
    hotelZones.forEach((zone) => {
      addHotelZone(zone);
      interactables.push({ mode: 'hotel', type: 'hotelAmenity', subtype: zone.type, position: new THREE.Vector3(zone.x, 0, zone.z + zone.depth / 2 - .7), label: `Enter ${zone.name}` });
    });

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
      ['Dahlia', 'Lounge guest', -8, -7, 0x543240, 0xb77755], ['Monique', 'VIP guest', 8, 6, 0x263b45, 0x71412f],
      ['Iris', 'Hotel regular', -17, 12, 0x4b4234, 0xd09b79], ['Roxy', 'Nightlife host', 15, -7, 0x54283e, 0x9a5a43],
      ['Selene', 'Suite guest', -13, 7, 0x333e5a, 0xc68167], ['Jade', 'Lounge guest', 13, -3, 0x385144, 0x72422f],
      ['Mia', 'Independent adult guest', -4, 12, 0x63374d, 0xbc7d5c], ['Nyla', 'Event host', 5, -11, 0x453359, 0x5f3628],
      ['Carmen', 'Traveling artist', -19, -2, 0x584430, 0xd1a17d], ['Raven', 'Nightlife guest', 19, 12, 0x292f43, 0x7d4b37],
    ];
    hotelNpcData.forEach(([name, socialRole, x, z, coat, skin], index) => {
      const npc = makeCharacter({ gender: 'female', coat, skin, hair: [0x1a1210,0x42271e,0x15171a,0x6a4329][index % 4], accent: [0xd1a15a,0x7db9c2,0xc76a92][index % 3] });
      npc.position.set(x, 0, z);
      npc.userData.name = name;
      npc.userData.socialRole = socialRole;
      npc.userData.appearance = { skin, clothing: coat, hair: [0x1a1210,0x42271e,0x15171a,0x6a4329][index % 4], accessory: [0xd1a15a,0x7db9c2,0xc76a92][index % 3] };
      npc.userData.base = new THREE.Vector3(x, 0, z);
      npc.userData.roamRadius = 2.6 + seeded() * 1.2;
      npc.userData.roamSpeed = .72 + seeded() * .28;
      npc.userData.roamTarget = npc.userData.base.clone();
      npc.userData.roamPause = seeded() * 1.2;
      hotel.add(npc);
      npcs.push(npc);
      interactables.push({ mode: 'hotel', type: 'person', object: npc, label: `Meet ${name} · ${socialRole}` });
    });
  }

  function buildSuite(number) {
    suite.clear();
    suiteFloors.length = 0;
    interactables.splice(0, interactables.length, ...interactables.filter((item) => item.mode !== 'room'));
    const roomPlan = createRoomPlan(number);
    const accent = number % 3 === 0 ? 0x38566b : number % 2 ? 0x64364f : 0x4a5369;
    const suiteFloor = box(suite, 0, -0.28, 0, 18, 0.55, 18, material(0x3e302b, 0.76));
    suiteFloors.push(suiteFloor);
    for (let stripe = -8; stripe <= 8; stripe += 1.1) box(suite, stripe, 0.015, 0, 0.04, 0.025, 17.6, material(0x65534b, 0.78), false);
    box(suite, 0, 4.5, -8.8, 18, 9, 0.4, material(0x4a4643, 0.88));
    box(suite, -8.8, 4.5, 0, 0.4, 9, 18, material(0x423e3c, 0.88));
    box(suite, 8.8, 4.5, 0, 0.4, 9, 18, material(0x423e3c, 0.88));
    box(suite, 0, 8.8, 0, 18, 0.35, 18, material(0x323435, 0.82));
    for (const axis of [-5.8, 0, 5.8]) {
      box(suite, axis, 8.5, 0, .18, .28, 17.4, materials.darkMetal, false);
      box(suite, 0, 8.5, axis, 17.4, .28, .18, materials.darkMetal, false);
    }

    const window = box(suite, 2.8, 4.8, -8.55, 8.5, 5.8, 0.15, materials.glass);
    window.castShadow = false;
    for (const x of [-1.4, 2.8, 7]) box(suite, x, 4.8, -8.42, 0.13, 6, 0.18, materials.darkMetal);

    box(suite, -3.2, 0.5, -2.4, 5.7, 0.8, 6.6, material(0x25272c, 0.69));
    decals.floor(suite, 3.7, .03, -1.8, 2.8, 1.8, { kind: 'water', rotation: .2 });
    box(suite, -3.2, 1.02, -2.4, 5.35, 0.42, 6.2, materials.linen);
    box(suite, -3.2, 1.25, -3.65, 5.2, 0.26, 3.2, material(accent, 0.86));
    box(suite, -3.2, 2.8, -5.6, 5.8, 3.5, 0.35, material(0x3a2d2b, 0.74));
    for (const x of [-4.6, -1.8]) box(suite, x, 1.43, -4.4, 2.1, 0.32, 1.2, materials.linen);
    for (const x of [-5.7, -.7]) cylinder(suite, x, .18, -.15, .09, .24, materials.gold, 10);
    for (const x of [-5.7, -.7]) cylinder(suite, x, .18, -4.6, .09, .24, materials.gold, 10);
    if (roomPlan.props.has('tv')) addWallTV(suite, 8.48, 4.25, 1.3, -Math.PI / 2);
    if (roomPlan.props.has('lamp')) addFloorLamp(suite, 6.8, -5.8);
    if (roomPlan.props.has('dresser')) addDisplayShelf(suite, 7.55, -4.9, Math.PI / 2);
    if (roomPlan.props.has('bathroom')) { box(suite, 6.4, 1.6, 5.7, 3.8, 3.2, .22, materials.hotelStone); box(suite, 6.4, .82, 4.18, 1.4, 1.5, .5, material(0xe0e1db, .38)); }
    if (roomPlan.props.has('closet')) { box(suite, 7.5, 2.3, 6.7, 1.8, 4.5, .45, materials.wood); for (const x of [7.15, 7.85]) box(suite, x, 2.3, 6.45, .04, 3.8, .05, materials.gold, false); }
    addTrashCan(suite, 7.3, 6.4);

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
    if (roomPlan.props.has('desk') || roomPlan.props.has('lounge')) addCafeTable(suite, 4.8, .9, { top: material(0x4b342c, .62), trim: materials.gold });
    if (roomPlan.props.has('chair')) { addChair(suite, 3.75, .9, Math.PI / 2, accent); addChair(suite, 5.85, .9, -Math.PI / 2, accent); }
    box(suite, 4.8, 0.34, -0.2, 2.5, 0.22, 1.3, materials.gold);
    cylinder(suite, 4.8, 0.18, -0.2, 0.09, 0.4, materials.darkMetal, 12);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.5), new THREE.MeshBasicMaterial({ map: labelTexture(`SUITE ${String(number).padStart(2, '0')}`, '#d2ad6d', '#22272a', 640, 360) }));
    art.position.set(8.54, 3.7, 1.2);
    art.rotation.y = -Math.PI / 2;
    suite.add(art);

    const door = box(suite, 0, 2.4, 8.55, 2.4, 4.8, 0.25, materials.wood);
    door.castShadow = true;
    box(suite, 0, 4.84, 8.5, 2.75, .18, .4, materials.gold, false);
    cylinder(suite, .8, 2.32, 8.34, .08, .08, materials.gold, 10).rotation.z = Math.PI / 2;
    for (const x of [-1.32, 1.32]) box(suite, x, 2.4, 8.43, .16, 4.95, .28, materials.darkMetal, false);
    addDoor(suite, 0, 0, 8.32, { style: 'hotel' });
    suite.userData.roomPlan = roomPlan;
    interactables.push({ mode: 'room', type: 'roomExit', position: new THREE.Vector3(0, 0, 6.7), label: 'Return to the hotel lobby' });
    interactables.push({ mode: 'room', type: 'sleep', position: new THREE.Vector3(-3.2, 0, 0.5), label: role === 'guest' ? 'Sleep until morning' : 'Inspect and refresh the suite' });
    interactables.push({ mode: 'room', type: 'roomHosting', position: new THREE.Vector3(2.8, 0, 1.7), label: 'Host a private consenting adult guest' });
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

  function addIndoorAtmosphere() {
    const count = quality === 'high' ? 260 : 120;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seeded() - .5) * 42;
      positions[i * 3 + 1] = 1 + seeded() * 6;
      positions[i * 3 + 2] = (seeded() - .5) * 34;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffd7a0, size: .035, transparent: true, opacity: .18, depthWrite: false }));
    hotel.add(dust);
  }

  const sky = addSky();
  const environmentLighting = addLighting();
  const dayNightCycle = new DayNightCycle({ skyUniforms: sky.skyUniforms, moon: sky.moon, lighting: environmentLighting, nightLights });
  addCity();
  addHotelInterior();
  addRain();
  addIndoorAtmosphere();

  const player = makeCharacter({
    gender: onlineProfile?.gender || (role === 'manager' ? 'female' : 'male'),
    coat: role === 'manager' ? 0x6c3d46 : 0x222c37,
    skin: role === 'manager' ? 0xa66d50 : 0x81533f,
    hair: 0x171411,
    accent: 0xd0a45f,
    selections: onlineProfile?.selections,
    player: true,
  });
  if (role === 'manager') {
    hotel.add(player);
    player.position.set(WORLD_LAYOUT.playerSpawn.x, WORLD_LAYOUT.playerSpawn.y, WORLD_LAYOUT.playerSpawn.z);
    city.visible = false;
    hotel.visible = true;
  } else {
    city.add(player);
    player.position.set(WORLD_LAYOUT.cityStartSpawn.x, WORLD_LAYOUT.cityStartSpawn.y, WORLD_LAYOUT.cityStartSpawn.z);
    player.rotation.y = Math.PI;
    city.visible = true;
    hotel.visible = false;
  }
  environmentLighting.apply(role === 'manager' ? LightingProfile.HOTEL_LOBBY : LightingProfile.CITY);
  const playerFill = new THREE.PointLight(0xffd8b3, 16, 13, 2);
  playerFill.position.set(2.2, 3.1, 3.2);
  playerFill.userData.keepVisible = true;
  player.add(playerFill);
  const playerRim = new THREE.PointLight(0x78cde0, 9, 11, 2);
  playerRim.position.set(-2.6, 2.5, -2.3);
  playerRim.userData.keepVisible = true;
  player.add(playerRim);
  const playerModel = new PlayerModel(player, { clothing: 0x5d8197, shoes: 0x303940, accessory: 0xe0b96d });
  playerModel.load('/assets/models/soldier.glb').catch((error) => console.error('[asset] Failed to load /assets/models/soldier.glb; keeping fallback avatar.', error));
  const playerController = new PlayerController(GameConfig.player, playerModel);
  const npcModelLibrary = new NpcModelLibrary();
  npcModelLibrary.load('/assets/models/soldier.glb')
    .then(() => npcs.forEach((npc) => npcModelLibrary.attach(npc, npc.userData.appearance)))
    .catch((error) => console.error('[asset] Failed to load /assets/models/soldier.glb for NPCs; keeping fallback NPCs.', error));

  // The original hotel district remains hand-authored. Beyond it, the streamed
  // layer uses WGS84 anchored chunks and can later swap procedural lots for
  // licensed road/building data region by region.
  const worldStreamer = new WorldChunkManager({
    parent: city,
    materials,
    config: { ...GameConfig.world, seed: worldSeed },
    onStatus: ({ type, region, geographic }) => {
      if (type === 'region' && region) {
        $('#location').textContent = `${region.city.toUpperCase()} · STREAMING`;
        showGlobalToast(`${region.label} loaded · geographic streaming enabled.`);
      }
      if (geographic) $('#geo-readout').textContent = `${geographic.latitude.toFixed(5)}, ${geographic.longitude.toFixed(5)}`;
      if (type === 'rebase' && GameConfig.debug.coordinates) console.info('Floating origin rebased at', geographic);
    },
  });
  worldStreamer.selectRegion(GameConfig.world.defaultRegion).catch((error) => console.warn('World region fallback:', error));
  loadVehicleLibrary();
  window.sthWorld = {
    regions: RegionCatalog,
    selectRegion: async (id) => worldStreamer.selectRegion(id),
    getPosition: () => worldStreamer.geo?.toGeographic(player.position.clone().add(worldStreamer.originOffset)),
  };

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
    saveProgression(localStorage, { cash, reputation: rep });
  }

  function applyAuthoritativeProfile(profile) {
    if (!profile || typeof profile !== 'object') return;
    if (Number.isFinite(profile.cash)) cash = Math.max(0, Math.trunc(profile.cash));
    if (Number.isFinite(profile.reputation)) rep = Math.max(0, Math.trunc(profile.reputation));
    if (Array.isArray(profile.weapons)) {
      ownedWeapons.clear();
      profile.weapons.forEach((key) => ownedWeapons.add(String(key)));
      saveWeaponLoadout();
    }
    if (Array.isArray(profile.vehicles)) {
      ownedVehicles.clear();
      profile.vehicles.forEach((key) => ownedVehicles.add(String(key)));
      saveVehicleGarage();
    }
    updateStats();
    appendChat('WORLD', 'Authoritative profile synchronized.', true);
  }
  window.addEventListener('sth-profile-sync', (event) => applyAuthoritativeProfile(event.detail));

  function saveWeaponLoadout() {
    localStorage.setItem('sth-owned-weapons', JSON.stringify([...ownedWeapons]));
    if (equippedWeaponKey) localStorage.setItem('sth-equipped-weapon', equippedWeaponKey);
  }

  function renderWeaponShop() {
    const root = $('#weapon-shop-items');
    if (!root) return;
    root.innerHTML = '';
    for (const weapon of WEAPON_CATALOG) {
      const owned = ownedWeapons.has(weapon.key);
      const equipped = equippedWeaponKey === weapon.key;
      const card = document.createElement('article');
      card.className = `weapon-card${equipped ? ' equipped' : ''}`;
      card.innerHTML = `<div class="weapon-card-head"><span>${weapon.category.toUpperCase()}</span><b>${weapon.name}</b><small>${weapon.rarity.toUpperCase()}</small></div><p>${weapon.description}</p><div class="weapon-stats"><span>DMG <b>${weapon.damage}</b></span><span>RPM <b>${Math.round(weapon.fireRate * 60)}</b></span><span>MAG <b>${weapon.magazine}</b></span></div><button>${equipped ? 'EQUIPPED' : owned ? 'EQUIP WEAPON' : `BUY + EQUIP · $${weapon.price}`}</button>`;
      card.querySelector('button').onclick = () => {
        if (!owned) {
          if (cash < weapon.price) return toast(`You need $${weapon.price} for the ${weapon.name}.`);
          cash -= weapon.price;
          ownedWeapons.add(weapon.key);
        }
        equippedWeaponKey = weapon.key;
        saveWeaponLoadout();
        updateStats();
        renderWeaponShop();
        toast(`${weapon.name} equipped. Fictional loadout updated.`);
      };
      root.appendChild(card);
    }
    renderCamoLab();
  }

  function renderCamoLab() {
    const root = $('#camo-grid');
    const label = $('#camo-target');
    if (!root || !label) return;
    const weaponKey = equippedWeaponKey || WEAPON_CATALOG[0].key;
    const weapon = WEAPON_CATALOG.find((item) => item.key === weaponKey) || WEAPON_CATALOG[0];
    label.textContent = `CAMO LAB · ${weapon.name.toUpperCase()} · 40 ANIMATED GRADIENTS`;
    root.innerHTML = '';
    const selected = localStorage.getItem(`sth-camo-${weapon.key}`) || CAMO_CATALOG[0].key;
    CAMO_CATALOG.forEach((camo) => {
      const button = document.createElement('button');
      button.className = `camo-swatch${camo.key === selected ? ' selected' : ''}`;
      button.title = camo.name;
      button.style.setProperty('--camo-hue', `${camo.hue * 360}deg`);
      button.style.setProperty('--camo-accent', `${camo.accentHue * 360}deg`);
      button.innerHTML = `<span></span><b>${String(CAMO_CATALOG.indexOf(camo) + 1).padStart(2, '0')}</b><small>${camo.name}</small>`;
      button.onclick = () => {
        if (!equippedWeaponKey) return toast('Buy and equip a weapon before selecting its camo.');
        localStorage.setItem(`sth-camo-${weapon.key}`, camo.key);
        renderCamoLab();
        toast(`${camo.name} camo applied to ${weapon.name}.`);
      };
      root.appendChild(button);
    });
  }

  function saveVehicleGarage() {
    localStorage.setItem('sth-owned-vehicles', JSON.stringify([...ownedVehicles]));
    if (equippedVehicleKey) localStorage.setItem('sth-equipped-vehicle', equippedVehicleKey);
    localStorage.setItem('sth-vehicle-upgrades', JSON.stringify(vehicleUpgrades));
  }

  function vehicleFromKey(key) { return dealershipVehicles.find((vehicle) => vehicle.key === key) || null; }
  function normalizeManifestVehicle(vehicle, index) {
    const category = vehicle.category === 'performance' ? 'SPORT' : vehicle.category.toUpperCase();
    const base = category === 'SPORT' ? 92 : category === 'TRUCK' ? 68 : category === 'SUV' ? 76 : category === 'VAN' ? 64 : 72;
    return {
      key: vehicle.id,
      name: vehicle.displayName,
      class: category,
      price: Math.round((base * 1000 + index * 137) / 100) * 100,
      topSpeed: base + 18,
      acceleration: category === 'SPORT' ? 88 : base - 5,
      handling: category === 'SPORT' ? 86 : category === 'SUV' ? 68 : 64,
      description: `${vehicle.displayName} · original stylized ${vehicle.brand} game interpretation.`,
      modelPath: `/${vehicle.file}`,
      brand: vehicle.brand,
      dimensionsMeters: vehicle.dimensionsMeters,
      wheelNodes: vehicle.wheelNodes,
      sourceManifest: vehicle.file,
    };
  }
  async function loadVehicleLibrary() {
    const manifests = ['lamborghini', 'rolls-royce', 'chevrolet', 'ford'];
    try {
      const results = await Promise.all(manifests.map(async (brand) => {
        const response = await fetch(`/assets/manifests/${brand}-vehicles.json`);
        if (!response.ok) throw new Error(`${brand} manifest HTTP ${response.status}`);
        return response.json();
      }));
      const imported = results.flatMap((manifest) => manifest.vehicles.map((vehicle, index) => normalizeManifestVehicle(vehicle, index)));
      dealershipVehicles = [...VEHICLE_CATALOG, ...imported.filter((vehicle) => !VEHICLE_CATALOG.some((base) => base.key === vehicle.key))];
      window.sthVehicleLibrary = { count: dealershipVehicles.length, imported: imported.length, vehicles: dealershipVehicles };
      showGlobalToast(`${imported.length} verified vehicle assets loaded into Diamond Lane Motors.`);
      if (!$('#vehicle-shop').hidden) renderVehicleShop('dealership');
    } catch (error) {
      console.error('[vehicle-library] manifest load failed; using starter catalog.', error);
      window.sthVehicleLibrary = { count: dealershipVehicles.length, imported: 0, vehicles: dealershipVehicles, error: String(error) };
    }
  }

  async function spawnEquippedVehicle() {
    const vehicle = vehicleFromKey(equippedVehicleKey);
    if (!vehicle?.modelPath) return toast('Load a verified vehicle from Diamond Lane Motors first.');
    if (activeVehicleController) return toast('You already have an active vehicle. Press X to exit.');
    try {
      const loaded = await new GLTFLoader().loadAsync(vehicle.modelPath);
      const model = loaded.scene;
      const dimensions = vehicle.dimensionsMeters || { length: 4.6, width: 1.9, height: 1.5 };
      const scale = 1;
      model.scale.setScalar(scale);
      model.position.copy(player.position);
      model.position.x += Math.sin(player.rotation.y) * 4.2;
      model.position.z += Math.cos(player.rotation.y) * 4.2;
      model.rotation.y = player.rotation.y;
      model.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      city.add(model);
      const wheelNodes = [];
      model.traverse((node) => { if (node.name.includes('wheel')) wheelNodes.push(node); });
      activeVehicle = model;
      activeVehicleController = new VehicleController({ vehicle: model, stats: vehicleStats(vehicle), dimensions });
      activeVehicleController.wheelNodes = wheelNodes;
      activeVehicleController.enter();
      activeVehicleController.completeEntry();
      driving = true;
      player.visible = false;
      toast(`${vehicle.name} loaded · W/A/S/D drive · X exit.`);
    } catch (error) {
      console.error('[vehicle-runtime] failed to load equipped GLB', vehicle.modelPath, error);
      toast('Vehicle asset failed to load. Check the runtime asset path.');
    }
  }
  function exitActiveVehicle() {
    if (!activeVehicleController || !activeVehicle) return;
    activeVehicleController.exit();
    activeVehicleController.completeExit();
    player.position.set(activeVehicle.position.x + 2.2, 0, activeVehicle.position.z);
    player.rotation.y = activeVehicle.rotation.y;
    city.remove(activeVehicle);
    activeVehicle = null;
    activeVehicleController = null;
    driving = false;
    player.visible = true;
    toast('Exited vehicle.');
  }
  function updateActiveVehicle(delta) {
    if (!activeVehicleController || !driving) return;
    activeVehicleController.update({ throttle: keys.w || keys.arrowup ? 1 : keys.s || keys.arrowdown ? -1 : 0, brake: keys[' '] ? 1 : 0, steer: keys.a || keys.arrowleft ? 1 : keys.d || keys.arrowright ? -1 : 0 }, delta);
    player.position.copy(activeVehicle.position);
    player.position.y = 0;
    player.rotation.y = activeVehicle.rotation.y;
  }

  function vehicleStats(vehicle) {
    const upgrades = vehicleUpgrades[vehicle.key] || {};
    const totals = { topSpeed: vehicle.topSpeed, acceleration: vehicle.acceleration, handling: vehicle.handling };
    for (const [slot, level] of Object.entries(upgrades)) {
      const upgrade = VEHICLE_UPGRADES[slot]?.levels[level - 1];
      if (upgrade) totals[VEHICLE_UPGRADES[slot].stat] += upgrade.value;
    }
    return totals;
  }

  function addVehicleDisplay(parent, x, z, vehicle) {
    const display = new THREE.Group();
    const paint = material([0x6f2c70, 0x252d38, 0xb58b42, 0x992e52, 0x4a5f68, 0x11151b][VEHICLE_CATALOG.indexOf(vehicle) % 6], .52, .24);
    box(display, 0, .62, 0, 2.9, .58, 5.1, paint);
    box(display, 0, 1.08, -.2, 2.35, .54, 2.25, materials.glass);
    for (const sx of [-1.18, 1.18]) for (const sz of [-1.65, 1.65]) { const wheel = cylinder(display, sx, .3, sz, .38, .22, materials.darkMetal, 16); wheel.rotation.z = Math.PI / 2; }
    box(display, -.88, .7, 2.5, .38, .18, .06, material(0xff4f6e, .1, .2), false);
    box(display, .88, .7, 2.5, .38, .18, .06, material(0xff4f6e, .1, .2), false);
    display.position.set(x, .15, z); display.rotation.y = Math.PI / 2;
    parent.add(display);
  }

  function renderVehicleShop(shopMode = 'dealership') {
    const root = $('#vehicle-shop-items');
    if (!root) return;
    const isMods = shopMode === 'mods';
    $('#vehicle-shop-kicker').textContent = isMods ? 'BLACKTOP CUSTOMS · PERFORMANCE & STYLE' : 'DIAMOND LANE MOTORS · ORIGINAL FICTIONAL VEHICLES';
    $('#vehicle-shop-title').textContent = isMods ? 'CAR MOD SHOP' : 'CAR DEALERSHIP';
    $('#vehicle-shop-copy').textContent = isMods ? 'Build your ride one part at a time. Every upgrade changes the saved performance stats.' : 'Buy a car, equip it to your garage, and keep your ride saved locally.';
    root.innerHTML = '';
    if (isMods && !equippedVehicleKey) { root.innerHTML = '<div class="garage-empty">Buy and equip a vehicle at Diamond Lane Motors first.</div>'; return; }
    if (isMods) {
      const vehicle = vehicleFromKey(equippedVehicleKey);
      const stats = vehicleStats(vehicle);
      const summary = document.createElement('div'); summary.className = 'garage-summary';
      summary.innerHTML = `<b>${vehicle.name}</b><span>TOP SPEED <strong>${stats.topSpeed}</strong></span><span>ACCEL <strong>${stats.acceleration}</strong></span><span>HANDLING <strong>${stats.handling}</strong></span>`; root.appendChild(summary);
      for (const [slot, config] of Object.entries(VEHICLE_UPGRADES)) {
        const current = vehicleUpgrades[vehicle.key]?.[slot] || 0;
        const next = config.levels[current];
        const card = document.createElement('article'); card.className = 'vehicle-card mod-card';
        card.innerHTML = `<div class="vehicle-card-head"><span>${config.label.toUpperCase()}</span><b>${current >= 3 ? 'MAXED' : next.name}</b><small>LEVEL ${current}/3</small></div><p>${current >= 3 ? 'This system is fully tuned.' : `+${next.value} ${config.stat.replace('topSpeed', 'top speed').replace('acceleration', 'accel')}`}</p><button>${current >= 3 ? 'MAXED' : `INSTALL · $${next.price}`}</button>`;
        card.querySelector('button').onclick = () => {
          if (!next || cash < next.price) return toast(`You need $${next?.price || 0} for the ${config.label.toLowerCase()} upgrade.`);
          cash -= next.price; vehicleUpgrades[vehicle.key] = { ...(vehicleUpgrades[vehicle.key] || {}), [slot]: current + 1 }; saveVehicleGarage(); updateStats(); renderVehicleShop('mods'); toast(`${config.label} upgraded on ${vehicle.name}.`);
        }; root.appendChild(card);
      }
      return;
    }
    for (const vehicle of dealershipVehicles) {
      const owned = ownedVehicles.has(vehicle.key); const equipped = equippedVehicleKey === vehicle.key; const stats = vehicleStats(vehicle);
      const card = document.createElement('article'); card.className = `vehicle-card${equipped ? ' equipped' : ''}`;
      card.innerHTML = `<div class="vehicle-card-head"><span>${vehicle.class}</span><b>${vehicle.name}</b><small>${owned ? 'OWNED' : `$${vehicle.price}`}</small></div><p>${vehicle.description}</p><div class="vehicle-stats"><span>TOP <b>${stats.topSpeed}</b></span><span>ACCEL <b>${stats.acceleration}</b></span><span>GRIP <b>${stats.handling}</b></span></div><button>${equipped ? 'EQUIPPED' : owned ? 'EQUIP VEHICLE' : `BUY + EQUIP · $${vehicle.price}`}</button>`;
      card.querySelector('button').onclick = () => {
        if (!owned) { if (cash < vehicle.price) return toast(`You need $${vehicle.price} for the ${vehicle.name}.`); cash -= vehicle.price; ownedVehicles.add(vehicle.key); }
        equippedVehicleKey = vehicle.key; saveVehicleGarage(); updateStats(); renderVehicleShop('dealership'); toast(`${vehicle.name} is now your active garage vehicle.`);
      }; root.appendChild(card);
    }
  }

  function openVehicleShop(shopMode) { renderVehicleShop(shopMode); $('#vehicle-shop').hidden = false; }

  $('#vehicle-shop-close').addEventListener('click', () => { $('#vehicle-shop').hidden = true; });
  addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#vehicle-shop').hidden) $('#vehicle-shop').hidden = true; });

  function openWeaponShop() {
    renderWeaponShop();
    $('#weapon-shop').hidden = false;
  }

  $('#weapon-shop-close').addEventListener('click', () => { $('#weapon-shop').hidden = true; });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#weapon-shop').hidden) $('#weapon-shop').hidden = true;
  });

  function updateNeedsUI() {
    for (const key of ['energy', 'hunger', 'hygiene']) {
      const value = Math.round(THREE.MathUtils.clamp(needs[key], 0, 100));
      const bar = $(`#need-${key}`);
      bar.style.width = `${value}%`;
      bar.classList.toggle('low', value < 25);
      $(`#need-${key}-value`).textContent = value;
    }
  }

  function restoreNeed(key, amount) {
    needs[key] = THREE.MathUtils.clamp(needs[key] + amount, 0, 100);
    updateNeedsUI();
    localStorage.setItem('sth-needs', JSON.stringify(needs));
  }
  window.sthRestoreNeed = restoreNeed;
  updateNeedsUI();

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
    environmentLighting.apply(nextMode === 'hotel' ? LightingProfile.HOTEL_LOBBY : nextMode === 'room' ? LightingProfile.HOTEL_ROOM : LightingProfile.CITY);
    updateAmbienceProfile();
    parent.attach(player);
    player.position.copy(position);
    nearby = null;
    $('#context-card').classList.add('hidden-card');
    updateLocation(nextMode === 'city' ? 'STATION DISTRICT' : nextMode === 'hotel' ? 'HOTEL LOBBY' : `SUITE ${String(currentRoom).padStart(2, '0')}`);
  }

  const worldPanel = $('#world-panel');
  const countrySelect = $('#country-select');
  const regionSelect = $('#region-select');
  const worldSeedInput = $('#world-seed');
  worldSeedInput.value = String(worldSeed);
  const setWorldSeed = (seed) => {
    const next = Math.max(1, Number(seed) >>> 0);
    localStorage.setItem('sth-world-seed', String(next));
    location.reload();
  };
  $('#randomize-world-seed').addEventListener('click', () => setWorldSeed(crypto.getRandomValues(new Uint32Array(1))[0]));
  $('#regenerate-world').addEventListener('click', () => setWorldSeed(worldSeedInput.value));
  const renderRegionOptions = (countryCode) => {
    regionSelect.innerHTML = '';
    const country = RegionCatalog.countries.find((item) => item.code === countryCode) || RegionCatalog.countries[0];
    country.regions.forEach((id) => {
      const region = RegionCatalog.regions[id];
      const option = document.createElement('option'); option.value = id; option.textContent = region.label; regionSelect.appendChild(option);
    });
  };
  RegionCatalog.countries.forEach((country) => {
    const option = document.createElement('option'); option.value = country.code; option.textContent = country.label; countrySelect.appendChild(option);
  });
  countrySelect.value = RegionCatalog.regions[GameConfig.world.defaultRegion].country;
  renderRegionOptions(countrySelect.value);
  regionSelect.value = GameConfig.world.defaultRegion;
  countrySelect.addEventListener('change', () => renderRegionOptions(countrySelect.value));
  $('#world-map-toggle').addEventListener('click', () => {
    const opening = worldPanel.hidden;
    worldPanel.hidden = !opening;
    $('#world-map-toggle').setAttribute('aria-expanded', String(opening));
  });
  $('#world-panel-close').addEventListener('click', () => { worldPanel.hidden = true; $('#world-map-toggle').setAttribute('aria-expanded', 'false'); });
  $('#travel-region').addEventListener('click', () => {
    const region = RegionCatalog.regions[regionSelect.value];
    transition('GEOSPATIAL TRAVEL', region.city.toUpperCase(), async () => {
      city.position.set(0, 0, 0);
      await worldStreamer.selectRegion(regionSelect.value);
      switchMode('city', new THREE.Vector3(120, 0, 120), city);
      worldStreamer.update(player.position);
      updateLocation(`${region.city.toUpperCase()} · ${region.country}`);
      showDistrict(region.city.toUpperCase());
      setObjective(`Explore ${region.label} · streamed region active`, 0.5, 'WORLD TRAVEL');
      worldPanel.hidden = true;
      $('#world-map-toggle').setAttribute('aria-expanded', 'false');
    });
  });

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
    if (person.object?.userData.romanceCompleted) return toast(`${name} already shared a private moment with you tonight.`);
    person.object.userData.romanceCompleted = true;
    transition('LATER THAT NIGHT', 'PRIVATE MOMENT', () => {
      rep += 5;
      updateStats();
      toast(`${name} accepted your invitation. The evening continues privately. +5 reputation`);
      setObjective('Get some rest before morning', 0.9, 'CHAPTER 03');
    });
  }

  function interact() {
    if (paused) return;
    if (!nearby) return;
    const item = nearby.item;
    if (item.type === 'door') {
      item.controller.toggle();
      toast(`${item.style.toUpperCase()} door ${item.controller.state === 'opening' ? 'opening' : 'closing'}.`);
      return;
    }
    const venueActivity = item.venueKey && venueObjects.get(item.venueKey)?.userData.activity;
    if (venueActivity && venueActivity.open === false) return toast('This venue is closed right now. Check back during its active hours.');
    if (item.type === 'hotelEntrance') return enterHotel();
    if (item.type === 'gunShop') return openWeaponShop();
    if (item.type === 'carDealership') return openVehicleShop('dealership');
    if (item.type === 'carModShop') return openVehicleShop('mods');
    if (item.type === 'adultClub') { rep += 1; updateStats(); return toast('Velvet Stage is open to adults 21+. Host bookings are private, optional, and consent-first.'); }
    if (item.type === 'cityBar') {
      if (cash < 14) return toast('You need $14 for a house drink.');
      cash -= 14; restoreNeed('hunger', 8); rep += 1; updateStats();
      return toast('House drink served at Midnight Mile Bar 28. -$14 · +1 reputation');
    }
    if (item.type === 'roomHosting') {
      if (role !== 'guest' || !checkedIn) return toast('Check in first. Private hosting is optional and consent-first.');
      cash += 80; rep += 4; updateStats();
      return toast(`Suite ${String(currentRoom).padStart(2, '0')} hosting completed privately. +$80 · +4 reputation`);
    }
    if (item.type === 'subwayInfo') { toast('24th Street Station: ticket concourse, platform, service rooms, active tunnel, and a sealed abandoned spur.'); return; }
    if (item.type === 'hotelExit') return exitHotel();
    if (item.type === 'hotelAmenity') {
      const messages = { bar: 'Velvet Bar is open late. Take a seat and meet the crowd.', restaurant: 'Night Dining is serving a full late menu.', lounge: 'VIP Lounge access granted. The music is low and the seating is private.', security: 'Security desk checked. Cameras and access logs are active.', service: 'Service wing stocked: laundry, maintenance, storage, and staff supplies.', stairs: 'Stairwell connects to guest floors, rooftop access, and the service basement.' };
      toast(messages[item.subtype] || 'This hotel area is ready for use.');
      return;
    }
    if (item.type === 'roomExit') return exitRoom();
    if (item.type === 'rooms') {
      $('#room-panel').classList.add('open');
      toast('Select a secured floor and suite.');
      return;
    }
    if (item.type === 'jobBoard') {
      if (activeJob) return toast(`Courier route active · package ${jobStep + 1}/3`);
      activeJob = 'courier';
      jobStep = 0;
      const stops = interactables.filter((entry) => entry.type === 'courierStop');
      stops.forEach((stop, index) => { stop.active = index === 0; stop.object.visible = index === 0; });
      setObjective('Deliver package 1/3 · east side', 0.12, 'COURIER SHIFT');
      toast('Courier route accepted. Three drops · $120 payout.');
      return;
    }
    if (item.type === 'courierStop') {
      if (activeJob !== 'courier' || item.stopIndex !== jobStep) return;
      item.active = false;
      item.object.visible = false;
      jobStep += 1;
      cash += 20;
      rep += 1;
      restoreNeed('energy', -6);
      updateStats();
      const next = interactables.find((entry) => entry.type === 'courierStop' && entry.stopIndex === jobStep);
      if (next) {
        next.active = true;
        next.object.visible = true;
        setObjective(`Deliver package ${jobStep + 1}/3`, (jobStep + 0.2) / 3, 'COURIER SHIFT');
        toast(`Package delivered. +$20 · next drop marked.`);
      } else {
        cash += 60;
        rep += 5;
        activeJob = null;
        setObjective('Courier route complete · find another job', 1, 'SHIFT COMPLETE');
        toast('Route complete. +$120 total · +8 reputation');
      }
      updateStats();
      return;
    }
    if (item.type === 'foodStand') {
      if (cash < 18) return toast('You need $18 for a hot meal.');
      cash -= 18;
      restoreNeed('hunger', 46);
      updateStats();
      toast('Hot meal finished. Hunger restored. -$18');
      return;
    }
    if (item.type === 'reception') {
      if (role === 'manager') {
        if (frontDeskReviewed) return toast('The front desk log is already reviewed for this shift.');
        frontDeskReviewed = true;
        cash += 35;
        rep += 1;
        updateStats();
        toast('Front desk log reviewed. VIP arrival noted. +$35');
      } else if (!checkedIn) {
        if (cash < 40) return toast('You need $40 to check in for the night.');
        checkedIn = true;
        cash -= 40;
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
        if (inspectedSuites.has(currentRoom)) return toast(`Suite ${String(currentRoom).padStart(2, '0')} is already inspected.`);
        inspectedSuites.add(currentRoom);
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
          restoreNeed('energy', 100);
          restoreNeed('hygiene', 45);
          updateStats();
          setObjective('Night complete · return to the city when ready', 1, 'NIGHT COMPLETE');
          toast('Well rested. Night one complete. +$60 · +3 reputation');
        });
      }
      return;
    }
    if (item.type === 'person') {
      const name = item.object.userData.name;
      const socialRole = item.object.userData.socialRole || 'nightlife guest';
      const firstConversation = !item.object.userData.spokeToPlayer;
      item.object.userData.spokeToPlayer = true;
      if (role === 'manager') {
        const request = taskCount >= 2 && Math.random() > 0.45;
        if (request) {
          toast(`${name} asks whether you would like to meet after your shift. You can politely accept or continue working.`);
          if (firstConversation) rep += 2;
          updateStats();
        } else {
          toast(`${name}: “The hotel looks incredible tonight. Thank you.”${firstConversation ? ' +1 reputation' : ''}`);
          if (firstConversation) rep += 1;
          updateStats();
        }
      } else if (mode === 'hotel' && checkedIn) {
        romanceSequence(item);
      } else {
        toast(`${name}: “${firstConversation ? 'You should check out the hotel lobby. It gets lively after midnight.' : 'Good seeing you again. Enjoy the district.'}”`);
        if (firstConversation) rep += 1;
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
    const panel = $('#pause-panel');
    panel.classList.toggle('open', paused);
    panel.setAttribute('aria-hidden', String(!paused));
    if (paused) {
      $('#pause-kicker').textContent = mode === 'city' ? 'STATION DISTRICT' : mode === 'hotel' ? 'HOTEL LOBBY' : `SUITE ${String(currentRoom).padStart(2, '0')}`;
      $('#pause-location').textContent = $('#location')?.textContent || 'CURRENT LOCATION';
      $('#pause-objective').textContent = $('#objective')?.textContent || 'Explore the world';
      $('#pause-clock').textContent = $('#clock')?.textContent || 'NIGHT SESSION';
      $('#resume-btn')?.focus();
    }
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
    ambience = { context, hum, rain, filter, humGain, master };
    updateAmbienceProfile();
    $('#sound-toggle').textContent = 'SOUND: ON';
  }

  function updateAmbienceProfile() {
    if (!ambience) return;
    const profile = mode === 'room' ? { hum: 66, filter: 850, level: .055 } : mode === 'hotel' ? { hum: 58, filter: 1050, level: .06 } : { hum: 52, filter: 1450, level: .07 };
    const now = ambience.context.currentTime;
    ambience.hum.frequency.linearRampToValueAtTime(profile.hum, now + .4);
    ambience.filter.frequency.linearRampToValueAtTime(profile.filter, now + .4);
    ambience.master.gain.linearRampToValueAtTime(profile.level, now + .4);
  }

  function appendChat(displayName, text, system = false) {
    const feed = $('#chat-feed');
    const line = document.createElement('div');
    line.className = 'chat-line';
    const name = document.createElement('b');
    name.textContent = system ? 'WORLD' : displayName;
    line.append(name, document.createTextNode(` · ${text}`));
    feed.appendChild(line);
    while (feed.children.length > 6) feed.firstElementChild.remove();
    setTimeout(() => line.remove(), 12000);
  }

  function removeRemotePlayer(id) {
    const remote = remotePlayers.get(id);
    if (!remote) return;
    scene.remove(remote.avatar);
    remotePlayers.delete(id);
  }

  function syncRemotePlayers(players) {
    const seen = new Set();
    for (const data of players) {
      if (data.id === localPlayerId) continue;
      seen.add(data.id);
      let remote = remotePlayers.get(data.id);
      if (!remote) {
        const avatar = makeCharacter({ gender: data.gender || 'female', selections: data.selections || null, tagText: data.displayName || 'Player' });
        avatar.position.set(data.position.x, data.position.y || 0, data.position.z);
        scene.add(avatar);
        remote = { avatar, target: avatar.position.clone(), lastPosition: avatar.position.clone(), rotation: data.rotation || 0, zone: data.zone || 'city', roomId: data.roomId ?? null, phase: Math.random() * Math.PI * 2 };
        remotePlayers.set(data.id, remote);
      }
      remote.target.set(data.position.x, data.position.y || 0, data.position.z);
      remote.rotation = data.rotation || 0;
      remote.zone = data.zone || 'city';
      remote.roomId = data.roomId ?? null;
    }
    for (const id of remotePlayers.keys()) if (!seen.has(id)) removeRemotePlayer(id);
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectAttempts += 1;
    const delay = Math.min(10000, 750 * (2 ** Math.min(reconnectAttempts - 1, 4)));
    $('#server-status').textContent = 'RECONNECTING';
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connectWorld(); }, delay);
  }

  function applyWorldActivity(activity) {
    if (!activity || typeof activity !== 'object') return;
    for (const [venueKey, state] of Object.entries(activity.venues || {})) {
      const venue = venueObjects.get(venueKey);
      if (!venue || !state) continue;
      venue.userData.activity = state;
      if (venue.userData.activityLight) venue.userData.activityLight.intensity = state.open ? 7 * (0.8 + Number(state.crowdLevel || 0) * .25) : .35;
    }
    for (const [name, state] of Object.entries(activity.npcs || {})) {
      const npc = npcs.find((candidate) => candidate.userData.name === name);
      if (npc) npc.userData.activityState = state.state;
    }
  }

  function connectWorld() {
    const base = WORLD_URL;
    if (!base) {
      $('#server-status').textContent = desktopRuntime ? 'OFFLINE WORLD' : 'SECURE HOST REQUIRED';
      $('#server-status').dataset.endpoint = '';
      appendChat('WORLD', desktopRuntime ? 'Desktop offline mode is ready. Configure a trusted wss:// world endpoint for multiplayer.' : 'This HTTPS build needs a trusted wss:// endpoint configured by the host.', !desktopRuntime);
      return;
    }
    if (AUTH_REQUIRED && !window.STH_AUTH_TICKET) {
      $('#server-status').textContent = 'AUTHENTICATING';
      appendChat('WORLD', 'Sign in with Discord to receive a secure multiplayer ticket.', true);
      return;
    }
    const tag = onlineProfile?.tag || (role === 'manager' ? 'Manager' : 'Guest');
    const params = new URLSearchParams({ player_id: localPlayerId, display_name: tag });
    if (window.STH_AUTH_TICKET) params.set('ticket', window.STH_AUTH_TICKET);
    else if (sessionToken) params.set('session_token', sessionToken);
    const url = `${base.replace(/\/$/, '')}/ws/sth-city-01?${params}`;
    $('#server-status').textContent = 'CONNECTING';
    $('#server-status').dataset.endpoint = base;
    try {
      worldSocket = new WebSocket(url);
      worldSocket.addEventListener('open', () => {
        reconnectAttempts = 0;
        $('#server-status').textContent = 'ONLINE WORLD';
        appendChat('WORLD', 'Connected to Station District.', true);
      });
      worldSocket.addEventListener('message', (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'welcome') {
          localPlayerId = message.playerId || localPlayerId;
          localStorage.setItem('sth-player-id', localPlayerId);
          if (message.sessionToken) {
            sessionToken = message.sessionToken;
            localStorage.setItem('sth-session-token', sessionToken);
          }
          if (message.profile) window.dispatchEvent(new CustomEvent('sth-profile-sync', { detail: message.profile }));
        } else if (message.type === 'snapshot') {
          syncRemotePlayers(message.players || []);
          applyWorldActivity(message.worldActivity);
        }
        else if (message.type === 'chat') appendChat(message.displayName || 'Player', message.text || '');
        else if (message.type === 'presence') {
          if (message.playerId !== localPlayerId) appendChat('WORLD', `${message.displayName} ${message.action === 'join' ? 'entered' : 'left'} the district.`, true);
          if (message.action === 'leave') removeRemotePlayer(message.playerId);
        } else if (message.type === 'error') appendChat('WORLD', message.message || 'The world server rejected that action.', true);
      });
      worldSocket.addEventListener('close', (event) => {
        remotePlayers.forEach((_, id) => removeRemotePlayer(id));
        if (event.code === 4001) {
          $('#server-status').textContent = 'ACTIVE IN ANOTHER TAB';
          appendChat('WORLD', 'This player session was opened in another tab.', true);
          return;
        }
        if (event.code === 4401) {
          $('#server-status').textContent = AUTH_REQUIRED ? 'AUTH TICKET EXPIRED' : 'SESSION AUTH FAILED';
          appendChat('WORLD', AUTH_REQUIRED ? 'Waiting for a fresh secure multiplayer ticket.' : 'The saved world-session token was rejected.', true);
          return;
        }
        scheduleReconnect();
      });
      worldSocket.addEventListener('error', () => { $('#server-status').textContent = 'LOCAL WORLD'; });
    } catch {
      $('#server-status').textContent = 'LOCAL WORLD';
      scheduleReconnect();
    }
  }
  connectWorld();
  window.STH_RECONNECT_WORLD = () => {
    if (worldSocket?.readyState === WebSocket.OPEN || worldSocket?.readyState === WebSocket.CONNECTING) return;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    connectWorld();
  };

  const micButton = $('#mic-toggle');
  const voiceStatus = $('#voice-status');
  if (VOICE_URL) {
    voiceClient = new ProximityVoiceClient({
      serverUrl: VOICE_URL,
      lobbyCode: 'PUBLIC',
      playerId: localPlayerId,
      displayName: onlineProfile?.tag || (role === 'manager' ? 'Manager' : 'Guest'),
      authToken: window.STH_VOICE_TOKEN || onlineProfile?.voiceToken || null,
      listener: audioListener,
      maxDistance: 25,
      iceServers: VOICE_ICE_SERVERS,
      getLocalState: () => ({
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        rotation: player.rotation.y,
        zone: mode,
        roomId: mode === 'room' ? currentRoom : null,
      }),
      getRemoteObject: (playerId) => remotePlayers.get(playerId)?.avatar || null,
    });
    voiceClient.addEventListener('status', ({ detail }) => { voiceStatus.textContent = detail.label; });
    voiceClient.addEventListener('mutechange', ({ detail }) => {
      micButton.classList.toggle('live', !detail.muted);
      micButton.setAttribute('aria-pressed', String(!detail.muted));
      micButton.querySelector('b').textContent = detail.muted ? 'MIC: MUTED' : 'MIC: LIVE';
    });
    voiceClient.addEventListener('localspeaking', ({ detail }) => micButton.classList.toggle('speaking', detail.speaking));
    voiceClient.addEventListener('speaking', ({ detail }) => {
      const remote = remotePlayers.get(detail.playerId);
      if (remote?.avatar.userData.voiceIndicator) remote.avatar.userData.voiceIndicator.visible = detail.speaking && remote.avatar.visible;
    });
    voiceClient.addEventListener('error', ({ detail }) => {
      voiceStatus.textContent = 'VOICE ERROR';
      appendChat('VOICE', detail.message || 'Voice connection failed.', true);
    });
    voiceClient.connect();
  } else {
    micButton.disabled = true;
    voiceStatus.textContent = 'SECURE VOICE HOST REQUIRED';
    micButton.title = 'Configure VITE_STH_VOICE_URL with an HTTPS/WSS Socket.io endpoint.';
  }

  micButton.addEventListener('click', async () => {
    if (!voiceClient) return;
    try {
      await voiceClient.toggleMicrophone();
    } catch (error) {
      voiceStatus.textContent = 'MIC PERMISSION DENIED';
      appendChat('VOICE', error.message || 'Microphone permission was denied.', true);
    }
  });
  addEventListener('beforeunload', () => voiceClient?.disconnect(), { once: true });

  function openChat() {
    $('#chat-box').hidden = false;
    $('#chat-input').focus();
  }
  function closeChat() { $('#chat-box').hidden = true; $('#chat-input').value = ''; canvas.focus(); }
  $('#chat-box').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('#chat-input').value.trim();
    if (text && worldSocket?.readyState === WebSocket.OPEN) worldSocket.send(JSON.stringify({ type: 'chat', text }));
    else if (text) appendChat('WORLD', 'Chat requires the online world host.', true);
    closeChat();
  });

  function updateNearby() {
    nearby = interactionSystem.findNearest(player.position, mode);
    $('#context-card').classList.toggle('hidden-card', !nearby);
    if (nearby) {
      if (nearby.item.type === 'door') {
        nearby.item.label = `${nearby.item.controller.state === 'open' || nearby.item.controller.state === 'opening' ? 'Close' : 'Open'} ${nearby.item.style} door`;
      }
      $('#context-action').textContent = interactionSystem.prompt();
    }
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
    }
    const needPenalty = needs.energy < 15 || needs.hunger < 10 ? 0.62 : needs.energy < 35 ? 0.82 : 1;
    const canSprint = keys.shift && needs.energy > 8;
    const displacement = playerController.step({
      delta,
      direction: new THREE.Vector3(dx, 0, dz),
      speed: (canSprint ? GameConfig.player.sprintSpeed : GameConfig.player.walkSpeed) * needPenalty,
      jump: jumpQueued,
    });
    jumpQueued = false;
    const activeColliders = mode === 'city' ? cityColliders : mode === 'hotel' ? hotelColliders : suiteColliders;
    const collision = playerCollision.move(player.position, displacement.x, displacement.z, activeColliders);
    const nextX = collision.x;
    const nextZ = collision.z;
    if (mode === 'city') {
      player.position.x = THREE.MathUtils.clamp(nextX, -100000, 100000);
      player.position.z = THREE.MathUtils.clamp(nextZ, -100000, 100000);
    } else if (mode === 'hotel') {
      player.position.x = THREE.MathUtils.clamp(nextX, -22, 22);
      player.position.z = THREE.MathUtils.clamp(nextZ, -18, 18);
    } else {
      player.position.x = THREE.MathUtils.clamp(nextX, -8, 8);
      player.position.z = THREE.MathUtils.clamp(nextZ, -7.8, 7.4);
    }
    let turnDirection = 0;
    if (moving) {
      const desiredRotation = Math.atan2(dx, dz);
      const rotationDelta = Math.atan2(Math.sin(desiredRotation - player.rotation.y), Math.cos(desiredRotation - player.rotation.y));
      turnDirection = rotationDelta;
      player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, desiredRotation, 1 - Math.pow(0.001, delta));
    }
    const activeFloors = mode === 'city' ? cityFloors : mode === 'hotel' ? hotelFloors : suiteFloors;
    // Raycast confirms the physical floor under the capsule; the baseline is
    // retained as an infinite-fall safety net while streamed terrain loads.
    const floor = groundProbe.probe(player.position, activeFloors) ?? playerCollision.groundHeightAt(player.position.x, player.position.z);
    debugVisuals?.update({ player, camera, direction: new THREE.Vector3(dx, 0, dz), floor });
    player.position.y = playerController.motor.resolveVertical(player.position.y, floor, delta);
    const grounded = playerController.motor.grounded;
    const cycle = clock.elapsedTime * (keys.shift ? 12 : 8);
    const walk = moving && grounded ? Math.sin(cycle) * 0.56 : 0;
    const legs = player.userData.legs || [];
    const jumpPose = grounded ? 0 : -0.48;
    if (legs[0]) legs[0].rotation.x = walk + jumpPose;
    if (legs[1]) legs[1].rotation.x = -walk + jumpPose;
    const idle = moving ? 0 : Math.sin(clock.elapsedTime * 1.7) * 0.035;
    if (player.userData['arm-1']) player.userData['arm-1'].rotation.x = -walk * 0.7 + idle;
    if (player.userData.arm1) player.userData.arm1.rotation.x = walk * 0.7 - idle;
    if (player.userData.torso) player.userData.torso.rotation.x = moving ? Math.min(0.12, Math.abs(walk) * 0.08) : idle * 0.22;
    if (player.userData.head) player.userData.head.rotation.y = moving ? 0 : Math.sin(clock.elapsedTime * 0.55) * 0.06;
    return { dx, dz, moving, sprinting: canSprint, airborne: !grounded, verticalVelocity: playerController.motor.velocity.y, turnDirection, blocked: collision.hit };
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
      cameraController.yaw = cameraYaw;
      cameraController.pitch = cameraPitch;
      cameraController.distance = cameraDistance;
      const collisionRoots = mode === 'city' ? city.children.filter((child) => child !== player) : mode === 'hotel' ? hotel.children.filter((child) => child !== player) : suite.children.filter((child) => child !== player);
      const state = cameraController.update(player, delta, collisionRoots);
      cameraYaw = state.yaw;
      cameraPitch = state.pitch;
      cameraDistance = state.distance;
      return;
    }
    camera.updateProjectionMatrix();
    camera.position.lerp(targetCamera, 1 - Math.pow(0.0025, delta));
    camera.lookAt(cameraLook);
  }

  function updateWeaponCamos(elapsed) {
    for (const display of weaponDisplays) {
      const saved = localStorage.getItem(`sth-camo-${display.userData.weaponKey}`);
      const camo = getCamo(saved || CAMO_CATALOG[display.userData.camoIndex].key);
      const wave = Math.sin(elapsed * camo.speed + display.userData.camoIndex * .7) * camo.swing;
      const drift = (camo.hue + wave + 1) % 1;
      const material = display.children.find((child) => child.userData?.camoMetal)?.material || display.userData.camoMaterial;
      if (!material) {
        display.traverse((node) => { if (node.isMesh && node.material?.metalness > .5 && !display.userData.camoMaterial) display.userData.camoMaterial = node.material; });
      }
      const target = display.userData.camoMaterial || material;
      if (target?.color) target.color.setHSL(drift, .72, .39 + Math.sin(elapsed * camo.speed * 1.7) * .05);
      if (target?.emissive) {
        target.emissive.setHSL((camo.accentHue - wave + 1) % 1, .72, .16);
        target.emissiveIntensity = camo.glow * (.72 + Math.sin(elapsed * camo.speed * 2.2) * .22);
      }
    }
  }

  function updateWorld(delta, elapsed) {
    updateWeaponCamos(elapsed);
    environmentLighting.updateShadowFocus(player);
    if (mode === 'city') {
      const inSubwayConcourse = Math.hypot(player.position.x + 45, player.position.z - 5) < 10;
      environmentLighting.apply(inSubwayConcourse ? LightingProfile.SUBWAY : LightingProfile.CITY);
    } else if (mode === 'hotel') {
      const inServiceWing = player.position.x > 10 && player.position.z > 4;
      environmentLighting.apply(inServiceWing ? LightingProfile.SERVICE : LightingProfile.HOTEL_LOBBY);
    }
    doors.forEach((door) => door.controller.update(delta));
    if (mode === 'city' && Math.max(Math.abs(player.position.x), Math.abs(player.position.z)) > 96) {
      const rebase = worldStreamer.update(player.position);
      diagnostics.syncRendererStats();
      if (rebase) {
        city.position.sub(rebase);
        scene.attach(player);
      }
    }
    for (let index = 0; index < npcs.length; index++) {
      const npc = npcs[index];
      if (!npc.parent?.visible) continue;
      const base = npc.userData.base;
      if (!base) continue;
      const target = npc.userData.roamTarget || (npc.userData.roamTarget = base.clone());
      const distance = Math.hypot(target.x - npc.position.x, target.z - npc.position.z);
      if (npc.userData.roamPause > 0) {
        npc.userData.roamPause = Math.max(0, npc.userData.roamPause - delta);
      } else if (distance < .55) {
        const angle = elapsed * .37 + index * 2.41;
        const radius = npc.userData.roamRadius || 3;
        target.set(
          base.x + Math.cos(angle) * radius,
          base.y,
          base.z + Math.sin(angle * .83) * radius,
        );
        npc.userData.roamPause = .35 + ((index * 17) % 5) * .12;
      }
      const dx = target.x - npc.position.x;
      const dz = target.z - npc.position.z;
      const length = Math.hypot(dx, dz);
      const resting = npc.userData.activityState === 'resting';
      const moving = !resting && npc.userData.roamPause <= 0 && length > .08;
      if (moving) {
        const step = Math.min(length, (npc.userData.roamSpeed || 1) * delta * (npc.userData.activityState === 'working' ? 1.08 : 1));
        npc.position.x += (dx / length) * step;
        npc.position.z += (dz / length) * step;
        npc.rotation.y = Math.atan2(dx, dz);
      }
      const npcWalk = moving ? Math.sin(elapsed * 8 + (npc.userData.walkPhase || index)) * 0.26 : 0;
      npcModelLibrary.update(npc, delta, moving);
      if (npc.userData.legs?.[0]) npc.userData.legs[0].rotation.x = npcWalk;
      if (npc.userData.legs?.[1]) npc.userData.legs[1].rotation.x = -npcWalk;
    }
    for (const vehicle of vehicles) {
      const route = vehicle.userData.route;
      if (route?.length > 1) {
        let target = route[Math.min(vehicle.userData.routeIndex + 1, route.length - 1)];
        let dx = target.x - vehicle.position.x;
        let dz = target.z - vehicle.position.z;
        if (Math.hypot(dx, dz) < 1.5) {
          vehicle.userData.routeIndex = vehicle.userData.routeIndex + 1 >= route.length - 1 ? 0 : vehicle.userData.routeIndex + 1;
          target = route[Math.min(vehicle.userData.routeIndex + 1, route.length - 1)];
          dx = target.x - vehicle.position.x;
          dz = target.z - vehicle.position.z;
        }
        const length = Math.hypot(dx, dz) || 1;
        vehicle.position.x += dx / length * vehicle.userData.speed * delta;
        vehicle.position.z += dz / length * vehicle.userData.speed * delta;
        vehicle.rotation.y = Math.atan2(dx, dz);
      } else {
        vehicle.position.z += vehicle.userData.speed * vehicle.userData.direction * delta;
        if (vehicle.position.z > 106) vehicle.position.z = -106;
        if (vehicle.position.z < -106) vehicle.position.z = 106;
        vehicle.rotation.y = vehicle.userData.direction > 0 ? 0 : Math.PI;
      }
      const hitX = Math.abs(player.position.x - vehicle.position.x) < 1.18;
      const hitZ = Math.abs(player.position.z - vehicle.position.z) < 2.05;
      if (mode === 'city' && hitX && hitZ && elapsed > ragdollUntil) {
        const push = new THREE.Vector3(player.position.x - vehicle.position.x, 0, player.position.z - vehicle.position.z).normalize();
        if (push.lengthSq() < .01) push.set(0, 0, vehicle.userData.direction);
        playerController.motor.knockback(push);
        ragdollUntil = elapsed + .65;
        toast('Vehicle impact — knocked down');
      }
    }
    if (ragdollUntil > elapsed) player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -.62, .18);
    else player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, 0, .16);
    for (const rain of rainDrops) {
      const positions = rain.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= delta * 19;
        if (positions[i] < 0) positions[i] = 46;
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    const activity = (keys.w || keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright) ? (keys.shift ? 2.1 : 1.25) : 0.45;
    needs.energy = Math.max(0, needs.energy - delta * 0.055 * activity);
    needs.hunger = Math.max(0, needs.hunger - delta * 0.034);
    needs.hygiene = Math.max(0, needs.hygiene - delta * 0.022 * activity);
    if (elapsed - lastNeedsSave > 5) {
      updateNeedsUI();
      localStorage.setItem('sth-needs', JSON.stringify(needs));
      lastNeedsSave = elapsed;
    }
    for (const remote of remotePlayers.values()) {
      remote.avatar.visible = remote.zone === mode && (mode !== 'room' || String(remote.roomId) === String(currentRoom));
      remote.avatar.position.lerp(remote.target, 1 - Math.pow(0.0008, delta));
      remote.avatar.rotation.y = THREE.MathUtils.lerp(remote.avatar.rotation.y, remote.rotation, 1 - Math.pow(0.002, delta));
      const distance = remote.avatar.position.distanceTo(remote.lastPosition);
      const stride = distance > 0.002 ? Math.sin(elapsed * 9 + remote.phase) * 0.42 : 0;
      if (remote.avatar.userData.legs?.[0]) remote.avatar.userData.legs[0].rotation.x = stride;
      if (remote.avatar.userData.legs?.[1]) remote.avatar.userData.legs[1].rotation.x = -stride;
      if (remote.avatar.userData.arms?.[0]) remote.avatar.userData.arms[0].rotation.x = -stride * 0.7;
      if (remote.avatar.userData.arms?.[1]) remote.avatar.userData.arms[1].rotation.x = stride * 0.7;
      remote.lastPosition.copy(remote.avatar.position);
    }
    timeOfNight = (timeOfNight + delta * .5) % 1440;
    const clockState = dayNightCycle.update(timeOfNight);
    $('#clock').textContent = `${clockState.hours % 12 || 12}:${String(clockState.minutes).padStart(2, '0')} ${clockState.hours >= 12 ? 'PM' : 'AM'}`;
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
    if (event.target instanceof Element && event.target.matches('input,textarea')) {
      if (event.key === 'Escape' && event.target === $('#chat-input')) closeChat();
      return;
    }
    keys[event.key.toLowerCase()] = true;
    if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); openChat(); return; }
    if (event.key === ' ' && !event.repeat) jumpQueued = true;
    if (event.key.toLowerCase() === 'e' && !event.repeat) interact();
    if (event.key.toLowerCase() === 'v' && !event.repeat) spawnEquippedVehicle();
    if (event.key.toLowerCase() === 'x' && !event.repeat) exitActiveVehicle();
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
    cameraController.rotate(event.movementX, event.movementY);
    cameraYaw = cameraController.yaw;
    cameraPitch = cameraController.pitch;
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
  $('#pause-sound-btn').addEventListener('click', () => { startAmbience(); $('#pause-sound-label').textContent = ambience ? 'SOUND: ON' : 'SOUND: OFF'; });
  $('#pause-world-btn').addEventListener('click', () => { togglePause(false); $('#world-map-toggle')?.click(); });
  $('#pause-title-btn').addEventListener('click', () => { if (confirm('Return to the title screen? Unsaved moment-to-moment progress will be lost.')) location.reload(); });
  $('#sound-toggle').addEventListener('click', startAmbience);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    updateRendererSize();
    composer.setSize(innerWidth, innerHeight);
    updatePostProcessing();
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

  let latestMovement = { dx: 0, dz: 0, moving: false };
  const gameLoop = new GameLoop({
    clock,
    input: inputController,
    diagnostics,
    fixedUpdate(delta, elapsed) {
      let movement = { dx: 0, dz: 0, moving: false };
      if (!paused) {
        if (driving) updateActiveVehicle(delta);
        else {
          movement = movePlayer(delta);
          playerController.updateVisual(delta, movement);
          updateNearby();
          updateWorld(delta, elapsed);
          updateMap();
        }
        if (driving) updateWorld(delta, elapsed);
      }
      latestMovement = movement;
    },
    update(delta, elapsed) {
      updateCamera(delta);
      voiceClient?.update();
      if (worldSocket?.readyState === WebSocket.OPEN && elapsed - lastNetworkSend > 0.08) {
        worldSocket.send(JSON.stringify({
          type: 'input',
          x: latestMovement.dx,
          z: latestMovement.dz,
          rotation: player.rotation.y,
          zone: mode,
          roomId: mode === 'room' ? currentRoom : null,
          moving: latestMovement.moving,
          gender: onlineProfile?.gender || (role === 'manager' ? 'female' : 'male'),
          selections: onlineProfile?.selections || null,
        }));
        lastNetworkSend = elapsed;
      }
    },
    render: () => composer.render(),
  });
  addEventListener('beforeunload', () => { gameLoop.stop(); inputController.dispose(); worldStreamer.dispose(); }, { once: true });
  gameLoop.start();
}
