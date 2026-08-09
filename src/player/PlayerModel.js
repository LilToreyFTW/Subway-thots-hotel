import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Visible GLB rig and blended animation state; gameplay remains in CharacterMotor. */
export class PlayerModel {
  constructor(host) {
    this.host = host;
    this.mixer = null;
    this.actions = new Map();
    this.current = null;
    this.ready = false;
  }
  async load(url = '/assets/models/soldier.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.scale.setScalar(1);
    model.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    this.host.children.forEach((child) => { if (child.userData?.keepMarker !== true) child.visible = false; });
    this.host.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip)));
    this.ready = true;
    this.play('idle');
  }
  play(name) {
    if (!this.ready) return;
    const action = this.actions.get(name) || this.actions.get('idle');
    if (!action || action === this.current) return;
    action.reset().fadeIn(.18).play();
    this.current?.fadeOut(.18);
    this.current = action;
  }
  update(delta, { moving, sprinting, airborne }) {
    if (!this.ready) return;
    this.play(airborne ? 'run' : moving ? (sprinting ? 'run' : 'walk') : 'idle');
    this.mixer.update(delta);
  }
}
