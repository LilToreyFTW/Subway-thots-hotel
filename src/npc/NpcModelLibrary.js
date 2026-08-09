import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { PlayerAppearance } from '../player/PlayerAppearance.js';

/** Shares one loaded humanoid asset while giving every NPC its own skeleton,
 * animation mixer, and cloned PBR materials. */
export class NpcModelLibrary {
  constructor() {
    this.source = null;
    this.clips = [];
    this.ready = false;
  }

  async load(url = '/assets/models/soldier.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    this.source = gltf.scene;
    this.clips = gltf.animations;
    this.ready = true;
  }

  attach(npc, appearance = {}) {
    if (!this.ready) return null;
    const model = cloneSkeleton(this.source);
    model.rotation.y = Math.PI;
    new PlayerAppearance(appearance).apply(model);
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });
    npc.children.forEach((child) => { child.visible = false; });
    npc.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const idle = this.findAction(mixer, 'idle');
    const walk = this.findAction(mixer, 'walk', 'run', 'jog');
    idle?.play();
    npc.userData.modelAnimation = { mixer, idle, walk, active: idle };
    return model;
  }

  update(npc, delta, moving) {
    const animation = npc.userData.modelAnimation;
    if (!animation) return;
    const next = moving ? animation.walk || animation.idle : animation.idle;
    if (next && next !== animation.active) {
      next.reset().fadeIn(.18).play();
      animation.active?.fadeOut(.18);
      animation.active = next;
    }
    animation.mixer.update(delta);
  }

  findAction(mixer, ...names) {
    const clip = this.clips.find((candidate) => names.some((name) => candidate.name.toLowerCase().includes(name)));
    return clip ? mixer.clipAction(clip) : null;
  }
}
