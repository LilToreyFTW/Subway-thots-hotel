import * as THREE from 'three';

/** Small procedural repeat textures avoid stretched single-image surfaces. */
export class TextureLibrary {
  constructor() { this.cache = new Map(); }

  texture(kind) {
    if (this.cache.has(kind)) return this.cache.get(kind);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = kind === 'carpet' ? '#c8bcc0' : kind === 'wood' ? '#d0c0ad' : '#c2c5c4';
    ctx.fillRect(0, 0, 96, 96);
    for (let i = 0; i < 210; i++) {
      const alpha = kind === 'tile' ? .035 : .08;
      ctx.fillStyle = `rgba(30,32,32,${alpha})`;
      ctx.fillRect(Math.random() * 96, Math.random() * 96, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    if (kind === 'tile') {
      ctx.strokeStyle = 'rgba(30,35,38,.16)'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 94, 94);
    }
    if (kind === 'wood') {
      ctx.strokeStyle = 'rgba(73,49,33,.16)'; ctx.lineWidth = 1;
      for (let y = 6; y < 96; y += 12) { ctx.beginPath(); ctx.moveTo(0, y + Math.random() * 3); ctx.lineTo(96, y + Math.random() * 3); ctx.stroke(); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.cache.set(kind, texture);
    return texture;
  }

  withRepeat(material, kind, repeatX, repeatY = repeatX) {
    const styled = material.clone();
    styled.map = this.texture(kind).clone();
    styled.map.wrapS = styled.map.wrapT = THREE.RepeatWrapping;
    styled.map.repeat.set(repeatX, repeatY);
    styled.map.needsUpdate = true;
    styled.needsUpdate = true;
    return styled;
  }
}
