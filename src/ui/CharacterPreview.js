import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PlayerAppearance } from '../player/PlayerAppearance.js';

export class CharacterPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1015);
    this.camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
    this.camera.position.set(0, 1.55, 4.1);
    this.camera.lookAt(0, 1.1, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.add(new THREE.HemisphereLight(0xaed8e4, 0x17151c, 2.2));
    const key = new THREE.DirectionalLight(0xffd5a2, 3.2); key.position.set(2.5, 4, 3); this.scene.add(key);
    const rim = new THREE.PointLight(0x61d9e4, 10, 8); rim.position.set(-2, 2, -2); this.scene.add(rim);
    this.model = null;
    this.appearance = new PlayerAppearance();
    this.selection = { gender: 'female', selections: {} };
    this.ready = false;
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    this.resize();
    this.load();
  }
  async load() {
    try {
      const gltf = await new GLTFLoader().loadAsync('/assets/models/soldier.glb');
      this.model = gltf.scene;
      this.model.rotation.y = Math.PI;
      this.model.position.y = 0;
      this.model.scale.setScalar(1.05);
      this.model.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      this.scene.add(this.model);
      this.ready = true;
      this.apply(this.selection);
      this.render();
    } catch (error) { console.error('[character-preview] failed to load preview model', error); }
  }
  paletteFor({ gender = 'female', selections = {} } = {}) {
    const text = `${gender}:${Object.values(selections).join(':')}`;
    let hash = 2166136261; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); hash >>>= 0;
    const colors = [0x617fa6, 0x824f75, 0x7d9b72, 0xb47c4f, 0x554e88, 0x9b5e5e];
    return { skin: gender === 'male' ? 0xa97052 : 0xc99573, clothing: colors[hash % colors.length], shoes: 0x202a32, accessory: 0xd6a85c };
  }
  apply(selection) { this.selection = { gender: selection.gender, selections: { ...selection.selections } }; if (this.model) this.appearance = new PlayerAppearance(this.paletteFor(this.selection)), this.appearance.apply(this.model); }
  resize() { const width = this.canvas.clientWidth || 360; const height = this.canvas.clientHeight || 420; this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); }
  render() { if (!this.ready) return; this.model.rotation.y = Math.PI + Math.sin(performance.now() * .00045) * .12; this.renderer.render(this.scene, this.camera); requestAnimationFrame(() => this.render()); }
  dispose() { removeEventListener('resize', this.resize); this.renderer.dispose(); }
}
