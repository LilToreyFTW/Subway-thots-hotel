import * as THREE from 'three';

export class DecalSystem {
  constructor() { this.materials = new Map(); }

  material(kind, label = '') {
    const key = `${kind}:${label}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (kind === 'graffiti') {
      ctx.fillStyle = 'rgba(220,74,124,.72)'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label || 'NIGHT', 64, 76);
      ctx.strokeStyle = 'rgba(75,220,224,.55)'; ctx.lineWidth = 3; ctx.strokeText(label || 'NIGHT', 64, 76);
    } else if (kind === 'marking') {
      ctx.fillStyle = 'rgba(238,206,125,.7)'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label || '24', 64, 74);
    } else {
      const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
      gradient.addColorStop(0, kind === 'water' ? 'rgba(20,34,40,.44)' : 'rgba(24,21,18,.48)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: .9, polygonOffset: true, polygonOffsetFactor: -1 });
    this.materials.set(key, material);
    return material;
  }

  floor(parent, x, y, z, width, depth, { kind = 'grime', label = '', rotation = 0 } = {}) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.material(kind, label));
    decal.rotation.set(-Math.PI / 2, 0, rotation); decal.position.set(x, y + .012, z);
    decal.renderOrder = 2; parent.add(decal); return decal;
  }
}
