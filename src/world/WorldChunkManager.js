import * as THREE from 'three';
import { SeededRandom, hashString } from '../core/SeededRandom.js';
import { GeoCoordinateSystem } from './GeoCoordinateSystem.js';
import { RegionCatalog } from './RegionCatalog.js';
import { StructuralGrid } from './StructuralGrid.js';

const disposeChunk = (node) => {
  // Chunk geometry/materials are intentionally shared and owned by the manager;
  // removing a chunk must not dispose assets still used by its neighbors.
  node.clear();
};

/**
 * Streams deterministic world cells around a geospatial player location.
 * It is deliberately provider-agnostic: a region manifest can replace the
 * generated roads and lots later without changing the game coordinate system.
 */
export class WorldChunkManager {
  constructor({ parent, materials, config, onStatus = () => {} }) {
    this.config = config;
    this.materials = materials;
    this.onStatus = onStatus;
    this.root = new THREE.Group();
    this.root.name = 'streamed-world';
    parent.add(this.root);
    this.activeChunks = new Map();
    this.originOffset = new THREE.Vector3();
    this.currentRegion = null;
    this.geo = null;
    this.regionManifest = null;
    this.geometries = {
      ground: new THREE.BoxGeometry(1, 0.22, 1),
      building: new THREE.BoxGeometry(1, 1, 1),
      roof: new THREE.BoxGeometry(1, 1, 1),
      facade: new THREE.BoxGeometry(1, 1, 1),
    };
    this.materialPool = new Map();
    this.structuralGrid = new StructuralGrid(2, .25);
  }

  material(color, roughness = 0.76, metalness = 0.04) {
    const key = `${color}-${roughness}-${metalness}`;
    if (!this.materialPool.has(key)) this.materialPool.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return this.materialPool.get(key);
  }

  async selectRegion(regionId) {
    const region = RegionCatalog.regions[regionId];
    if (!region) throw new Error(`Unknown streaming region: ${regionId}`);
    this.clear();
    this.currentRegion = { id: regionId, ...region };
    this.geo = new GeoCoordinateSystem(region);
    this.originOffset.set(0, 0, 0);
    this.root.position.set(0, 0, 0);
    this.regionManifest = null;
    if (region.assetManifest) {
      try {
        const response = await fetch(region.assetManifest);
        if (response.ok) this.regionManifest = await response.json();
      } catch (_) { /* Procedural fallback keeps travel available offline. */ }
    }
    this.onStatus({ type: 'region', region: this.currentRegion, manifest: this.regionManifest });
    return this.currentRegion;
  }

  update(playerPosition) {
    if (!this.geo) return null;
    const global = playerPosition.clone().add(this.originOffset);
    const playerChunk = this.geo.chunkForLocal(global, this.config.chunkSizeMeters);
    const required = new Set();
    for (let z = -this.config.activeChunkRadius; z <= this.config.activeChunkRadius; z++) {
      for (let x = -this.config.activeChunkRadius; x <= this.config.activeChunkRadius; x++) {
        const cx = playerChunk.x + x;
        const cz = playerChunk.z + z;
        const key = `${cx}:${cz}`;
        required.add(key);
        if (!this.activeChunks.has(key)) this.activeChunks.set(key, this.createChunk(cx, cz));
      }
    }
    for (const [key, chunk] of this.activeChunks) {
      const [cx, cz] = key.split(':').map(Number);
      if (Math.abs(cx - playerChunk.x) > this.config.unloadChunkRadius || Math.abs(cz - playerChunk.z) > this.config.unloadChunkRadius) {
        this.root.remove(chunk);
        disposeChunk(chunk);
        this.activeChunks.delete(key);
      }
    }
    if (playerPosition.length() > this.config.floatingOriginThresholdMeters) {
      const rebase = new THREE.Vector3(
        Math.round(playerPosition.x / this.config.chunkSizeMeters) * this.config.chunkSizeMeters,
        0,
        Math.round(playerPosition.z / this.config.chunkSizeMeters) * this.config.chunkSizeMeters,
      );
      if (rebase.lengthSq() > 0) {
        this.originOffset.add(rebase);
        this.root.position.sub(rebase);
        this.onStatus({ type: 'rebase', offset: this.originOffset.clone(), geographic: this.geo.toGeographic(global) });
        return rebase;
      }
    }
    this.onStatus({ type: 'position', chunk: playerChunk, geographic: this.geo.toGeographic(global), activeChunks: this.activeChunks.size });
    return null;
  }

  createChunk(chunkX, chunkZ) {
    const size = this.config.chunkSizeMeters;
    const centerX = chunkX * size + size / 2;
    const centerZ = chunkZ * size + size / 2;
    const random = new SeededRandom(hashString(`${this.currentRegion.seed}:${chunkX}:${chunkZ}`));
    const chunk = new THREE.Group();
    chunk.name = `world-chunk-${chunkX}-${chunkZ}`;
    chunk.position.set(centerX, 0, centerZ);

    const ground = new THREE.Mesh(this.geometries.ground, this.materials.asphalt);
    ground.scale.set(size, 1, size);
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    chunk.add(ground);

    const roadWidth = 16;
    const roadMaterial = this.material(0x171d22, 0.58, 0.04);
    for (const axis of ['x', 'z']) {
      const road = new THREE.Mesh(this.geometries.ground, roadMaterial);
      road.scale.set(axis === 'x' ? size : roadWidth, 1.2, axis === 'x' ? roadWidth : size);
      road.position.y = -0.02;
      road.receiveShadow = true;
      chunk.add(road);
    }

    const palette = [0x343b42, 0x4a4640, 0x34424c, 0x4a3e42, 0x303438];
    const corners = [[-1,-1], [1,-1], [-1,1], [1,1]];
    corners.forEach(([sx, sz], index) => {
      const count = 2 + random.int(0, 2);
      for (let i = 0; i < count; i++) {
        const width = this.structuralGrid.snapSize(random.range(12, 24));
        const depth = this.structuralGrid.snapSize(random.range(12, 24));
        const height = this.structuralGrid.snapSize(random.range(9, 42));
        const position = new THREE.Vector3(sx * (roadWidth / 2 + width / 2 + 8 + random.range(0, 16)), 0, sz * (roadWidth / 2 + depth / 2 + 8 + random.range(0, 16)));
        chunk.add(this.createStructure({ random, width, depth, height, color: random.pick(palette), position }));
      }
    });

    if (this.config.debug?.chunks) {
      const helper = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(-size / 2, 0, -size / 2), new THREE.Vector3(size / 2, 14, size / 2)), 0x56d8e2);
      chunk.add(helper);
    }
    this.root.add(chunk);
    return chunk;
  }

  createStructure({ random, width, depth, height, color, position }) {
    const group = new THREE.Group();
    const facade = this.material(color, .7, .08);
    const dark = this.material(0x20262b, .82, .18);
    const trim = this.material(random.pick([0x677078, 0x70685e, 0x4d5961]), .5, .28);
    const glass = this.material(random.pick([0x6d8790, 0x997c58]), .2, .32);
    const add = (geometry, material, x, y, z, sx, sy, sz) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = height < 25; mesh.receiveShadow = true; group.add(mesh); return mesh;
    };
    add(this.geometries.building, facade, 0, height / 2, 0, width, height, depth);
    add(this.geometries.facade, dark, 0, .45, 0, width + .28, .9, depth + .28);
    add(this.geometries.roof, dark, 0, height + .52, 0, width + .55, 1.04, depth + .55);
    const floors = Math.max(2, Math.floor(height / 4.2));
    for (let floor = 1; floor < floors; floor++) add(this.geometries.facade, trim, 0, floor * height / floors, 0, width + .18, .13, depth + .18);
    for (const cx of [-width / 2 + .22, width / 2 - .22]) for (const cz of [-depth / 2 + .22, depth / 2 - .22]) add(this.geometries.facade, trim, cx, height / 2, cz, .24, height + .1, .24);
    const bayCount = Math.max(2, Math.floor(width / 3.4));
    for (let floor = 0; floor < floors; floor++) for (let bay = 0; bay < bayCount; bay++) {
      const x = -width / 2 + (bay + .5) * width / bayCount;
      add(this.geometries.facade, glass, x, 1.5 + floor * height / floors, -depth / 2 - .025, width / bayCount * .58, height / floors * .48, .06);
    }
    // A shallow, road-facing storefront canopy gives each generated block an entrance hierarchy.
    add(this.geometries.facade, trim, 0, 2.55, -depth / 2 - .5, Math.min(5.5, width * .4), .16, .85);
    group.position.copy(position);
    return group;
  }

  clear() {
    for (const chunk of this.activeChunks.values()) {
      this.root.remove(chunk);
      disposeChunk(chunk);
    }
    this.activeChunks.clear();
  }

  dispose() {
    this.clear();
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.materialPool.forEach((material) => material.dispose());
  }
}
