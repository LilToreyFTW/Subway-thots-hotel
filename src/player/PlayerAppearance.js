import * as THREE from 'three';

// Slot-based PBR styling. GLBs with named skin/clothing/shoe/hair meshes receive
// independent treatment; unknown meshes use a conservative clothing fallback.
export class PlayerAppearance {
  constructor(options = {}) {
    this.options = { skin: 0xc99573, clothing: 0x526f82, shoes: 0x242a30, hair: 0x2d2019, accessory: 0xd6a85c, ...options };
  }
  apply(model) {
    model.traverse((node) => {
      if (!node.isMesh) return;
      const slot = this.slotFor(node.name);
      const source = Array.isArray(node.material) ? node.material[0] : node.material;
      const material = source?.clone?.() || new THREE.MeshStandardMaterial();
      material.color.set(this.options[slot]);
      material.metalness = slot === 'accessory' ? .72 : slot === 'shoes' ? .2 : 0;
      material.roughness = slot === 'skin' ? .52 : slot === 'hair' ? .78 : slot === 'clothing' ? .7 : .48;
      material.envMapIntensity = slot === 'skin' ? .45 : .8;
      material.needsUpdate = true;
      node.material = material;
    });
  }
  slotFor(name = '') {
    const value = name.toLowerCase();
    if (/skin|face|head|body/.test(value)) return 'skin';
    if (/hair/.test(value)) return 'hair';
    if (/shoe|boot|foot/.test(value)) return 'shoes';
    if (/metal|watch|chain|ring|glass/.test(value)) return 'accessory';
    return 'clothing';
  }
}
