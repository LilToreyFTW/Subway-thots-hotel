import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PlayerAppearance } from './PlayerAppearance.js';

/** Visible GLB rig and blended animation state; gameplay remains in CharacterMotor. */
export class PlayerModel {
  constructor(host, appearance = {}) {
    this.host = host;
    this.mixer = null;
    this.actions = new Map();
    this.current = null;
    this.ready = false;
    this.appearance = new PlayerAppearance(appearance);
  }
  async load(url = '/assets/models/soldier.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.scale.setScalar(1);
    // Soldier.glb is authored facing its local -Z axis while the controller
    // treats local +Z as forward. Correct that asset-space offset once so the
    // host rotation always points the visible body in its travel direction.
    model.rotation.y = Math.PI;
    this.appearance.apply(model);
    model.traverse((node) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
    this.host.children.forEach((child) => { if (child.userData?.keepVisible !== true) child.visible = false; });
    this.host.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => this.actions.set(this.normalize(clip.name), this.mixer.clipAction(clip)));
    this.ready = true;
    this.playState('idle');
  }
  normalize(name) { return name.toLowerCase().replace(/[ _]/g, '-'); }
  findAction(...names) {
    for (const name of names) {
      const exact = this.actions.get(this.normalize(name));
      if (exact) return exact;
      const partial = [...this.actions].find(([key]) => key.includes(this.normalize(name)));
      if (partial) return partial[1];
    }
    return this.actions.get('idle');
  }
  playState(state) {
    const clips = {
      idle: ['idle'], walk: ['walk'], run: ['run', 'jog'], sprint: ['sprint', 'run'],
      jump: ['jump', 'idle'], fall: ['fall', 'idle'], land: ['land', 'idle'],
      'turn-left': ['turn-left', 'turn', 'idle'], 'turn-right': ['turn-right', 'turn', 'idle'],
      crouch: ['crouch', 'idle'], 'crouch-walk': ['crouch-walk', 'crouch', 'walk'],
      interact: ['interact', 'idle'], pickup: ['pickup', 'interact', 'idle'],
      'open-door': ['open-door', 'interact', 'idle'], sit: ['sit', 'idle'], stand: ['stand', 'idle'],
      'use-object': ['use-object', 'interact', 'idle'], emote: ['emote', 'idle'],
      dance: ['dance', 'emote', 'idle'], talk: ['talk', 'idle'], climb: ['climb', 'idle'], stairs: ['stairs', 'walk'],
    };
    const speed = state === 'sprint' ? 1.22 : state === 'run' ? 1.08 : 1;
    this.play(clips[state] || clips.idle, speed);
  }
  play(names, timeScale = 1) {
    if (!this.ready) return;
    const action = this.findAction(...names);
    if (!action) return;
    if (action === this.current) { action.setEffectiveTimeScale(timeScale); return; }
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(timeScale);
    if (this.current) action.crossFadeFrom(this.current, .2, false);
    else action.fadeIn(.2);
    action.play();
    this.current = action;
  }
  tick(delta) { if (this.mixer) this.mixer.update(delta); }
}
