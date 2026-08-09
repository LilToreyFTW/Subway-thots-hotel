import * as THREE from 'three';

export const LightingProfile = Object.freeze({
  CITY: 'city',
  HOTEL_LOBBY: 'hotelLobby',
  HOTEL_ROOM: 'hotelRoom',
  SUBWAY: 'subway',
  SERVICE: 'service',
  TUNNEL: 'tunnel',
});

const PROFILES = {
  [LightingProfile.CITY]: { root: 'city', sky: 0x101b2a, fog: 0x111820, density: 0.009, hemiSky: 0x66829b, hemiGround: 0x121417, hemi: 1.2, key: 1.9, keyColor: 0xa9bfd0, fixtures: [] },
  [LightingProfile.HOTEL_LOBBY]: { root: 'hotel', sky: 0x302922, fog: 0x312921, density: 0.017, hemiSky: 0xf0bb7c, hemiGround: 0x24150e, hemi: 1.55, key: 1.25, keyColor: 0xffd5a1, fixtures: [[-14, 5.3, 10, 0xffbd72, 5.2, 13], [14, 5.3, 10, 0xffbd72, 5.2, 13], [-13, 4.6, -9, 0xffcb89, 4.6, 11], [13, 4.6, -9, 0xffcb89, 4.6, 11]] },
  [LightingProfile.HOTEL_ROOM]: { root: 'suite', sky: 0x2c211c, fog: 0x2b211d, density: 0.026, hemiSky: 0xffc98c, hemiGround: 0x170f0d, hemi: 1.3, key: 0.72, keyColor: 0xffd7a5, fixtures: [[-3, 2.3, -2.5, 0xffc27d, 4.4, 8], [3, 2.3, -2.5, 0xffc27d, 4.4, 8], [4.2, 3, 5.8, 0x91bfd2, 2.5, 7]] },
  [LightingProfile.SUBWAY]: { root: 'city', sky: 0x18232a, fog: 0x1a2429, density: 0.016, hemiSky: 0xa3c5c8, hemiGround: 0x172125, hemi: 1.15, key: 0.82, keyColor: 0xb6e3e2, fixtures: [[-48, 3.7, 6, 0xc2e9e6, 4.4, 10], [-42, 3.7, 6, 0xc2e9e6, 4.4, 10], [-48, 3.7, 1, 0x9dc7c8, 3.5, 9], [-42, 3.7, 1, 0x9dc7c8, 3.5, 9]] },
  [LightingProfile.SERVICE]: { root: 'hotel', sky: 0x252b28, fog: 0x1b211f, density: 0.022, hemiSky: 0x93b8a0, hemiGround: 0x101411, hemi: 0.9, key: 0.6, keyColor: 0xb6d6b4, fixtures: [[16, 3.3, 7, 0xb9ddbb, 3.2, 8], [16, 3.3, 12, 0xb9ddbb, 3.2, 8]] },
  [LightingProfile.TUNNEL]: { root: 'city', sky: 0x101416, fog: 0x101416, density: 0.035, hemiSky: 0x5b7579, hemiGround: 0x080a0b, hemi: 0.45, key: 0.22, keyColor: 0x8db5b8, fixtures: [] },
};

export class EnvironmentLighting {
  constructor({ scene, roots, quality = 'balanced' }) {
    this.scene = scene;
    this.roots = roots;
    this.hemisphere = new THREE.HemisphereLight(0x66829b, 0x121417, 1.2);
    this.key = new THREE.DirectionalLight(0xa9bfd0, 1.9);
    this.key.position.set(-55, 85, 35);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    this.key.shadow.camera.left = -70; this.key.shadow.camera.right = 70;
    this.key.shadow.camera.top = 70; this.key.shadow.camera.bottom = -70;
    this.key.shadow.camera.far = 190; this.key.shadow.bias = -0.00018;
    scene.add(this.hemisphere, this.key);
    this.groups = new Map();
    for (const [name, profile] of Object.entries(PROFILES)) {
      const group = new THREE.Group();
      group.visible = false;
      for (const [x, y, z, color, intensity, distance] of profile.fixtures) {
        const light = new THREE.PointLight(color, intensity, distance, 2);
        light.position.set(x, y, z);
        light.castShadow = false;
        group.add(light);
      }
      roots[profile.root].add(group);
      this.groups.set(name, group);
    }
    this.active = null;
  }

  apply(name) {
    if (this.active === name) return;
    const profile = PROFILES[name] || PROFILES[LightingProfile.CITY];
    this.active = name;
    this.scene.background.set(profile.sky);
    this.scene.fog.color.set(profile.fog);
    this.scene.fog.density = profile.density;
    this.hemisphere.color.set(profile.hemiSky);
    this.hemisphere.groundColor.set(profile.hemiGround);
    this.hemisphere.intensity = profile.hemi;
    this.key.color.set(profile.keyColor);
    this.key.intensity = profile.key;
    for (const [profileName, group] of this.groups) group.visible = profileName === name;
  }
}
