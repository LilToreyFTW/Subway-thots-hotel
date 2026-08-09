import * as THREE from 'three';

export const MaterialCategory = Object.freeze({
  METAL: 'metal', PAINTED_METAL: 'painted-metal', CONCRETE: 'concrete', TILE: 'tile', WOOD: 'wood',
  GLASS: 'glass', FABRIC: 'fabric', PLASTIC: 'plastic', RUBBER: 'rubber', LEATHER: 'leather',
  STONE: 'stone', CARPET: 'carpet', WALL_PAINT: 'wall-paint',
});

const defaults = {
  [MaterialCategory.METAL]: { roughness: .28, metalness: .82 },
  [MaterialCategory.PAINTED_METAL]: { roughness: .48, metalness: .38 },
  [MaterialCategory.CONCRETE]: { roughness: .86, metalness: .02 },
  [MaterialCategory.TILE]: { roughness: .42, metalness: .05 },
  [MaterialCategory.WOOD]: { roughness: .66, metalness: .03 },
  [MaterialCategory.GLASS]: { roughness: .08, metalness: .1, transmission: .22, transparent: true, opacity: .72 },
  [MaterialCategory.FABRIC]: { roughness: .9, metalness: 0 },
  [MaterialCategory.PLASTIC]: { roughness: .48, metalness: .08 },
  [MaterialCategory.RUBBER]: { roughness: .88, metalness: 0 },
  [MaterialCategory.LEATHER]: { roughness: .5, metalness: .02 },
  [MaterialCategory.STONE]: { roughness: .74, metalness: .02 },
  [MaterialCategory.CARPET]: { roughness: .96, metalness: 0 },
  [MaterialCategory.WALL_PAINT]: { roughness: .78, metalness: .01 },
};

/** Shared PBR material cache. Props ask for semantic categories rather than allocating mesh materials. */
export class MaterialLibrary {
  constructor() { this.cache = new Map(); }
  get(category, color, overrides = {}) {
    const spec = { ...defaults[category], ...overrides };
    const hex = new THREE.Color(color).getHexString();
    const key = `${category}:${hex}:${Object.entries(spec).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',')}`;
    if (!this.cache.has(key)) {
      const Type = category === MaterialCategory.GLASS ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
      this.cache.set(key, new Type({ color, ...spec }));
    }
    return this.cache.get(key);
  }
  standard(color, roughness = .66, metalness = .05) {
    const category = metalness >= .65 ? MaterialCategory.METAL : metalness >= .2 ? MaterialCategory.PAINTED_METAL : MaterialCategory.PLASTIC;
    return this.get(category, color, { roughness, metalness });
  }
  named() {
    return {
      asphalt: this.get(MaterialCategory.CONCRETE, 0x171d22, { roughness: .94, metalness: .03 }),
      concrete: this.get(MaterialCategory.CONCRETE, 0x596065),
      wetConcrete: this.get(MaterialCategory.TILE, 0x384047, { roughness: .28, metalness: .08, clearcoat: .55, clearcoatRoughness: .25 }),
      hotelStone: this.get(MaterialCategory.STONE, 0x776b5b),
      darkMetal: this.get(MaterialCategory.METAL, 0x171c21),
      glass: this.get(MaterialCategory.GLASS, 0x8ba8b2),
      gold: this.get(MaterialCategory.METAL, 0xb98c45, { roughness: .25, metalness: .78 }),
      carpet: this.get(MaterialCategory.CARPET, 0x321c24),
      wood: this.get(MaterialCategory.WOOD, 0x4a2f25),
      linen: this.get(MaterialCategory.FABRIC, 0xd8d0c4, { roughness: .91 }),
    };
  }
}
