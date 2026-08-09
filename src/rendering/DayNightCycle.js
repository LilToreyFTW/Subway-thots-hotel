import * as THREE from 'three';

const smooth = (value, min, max) => THREE.MathUtils.smoothstep(value, min, max);

/** City-scale clock driving sky, sun angle, fog color, and night fixtures. */
export class DayNightCycle {
  constructor({ skyUniforms, moon, lighting, nightLights = [] }) {
    this.skyUniforms = skyUniforms; this.moon = moon; this.lighting = lighting; this.nightLights = nightLights;
    this.nightTop = new THREE.Color(0x07111e); this.dawnTop = new THREE.Color(0xc66e6a); this.dayTop = new THREE.Color(0x4b93c2);
    this.nightBottom = new THREE.Color(0x1a2630); this.dawnBottom = new THREE.Color(0xffb477); this.dayBottom = new THREE.Color(0xc6e4ec);
    this.current = 0;
  }
  update(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440 / 1440;
    const angle = (normalized - .25) * Math.PI * 2;
    const elevation = Math.sin(angle);
    const daylight = smooth(elevation, -.16, .24);
    const warmth = smooth(elevation, -.18, .36) * (1 - smooth(elevation, .48, .9));
    const top = this.nightTop.clone().lerp(this.dawnTop, warmth).lerp(this.dayTop, daylight);
    const bottom = this.nightBottom.clone().lerp(this.dawnBottom, warmth).lerp(this.dayBottom, daylight);
    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.bottomColor.value.copy(bottom);
    this.moon.position.set(Math.cos(angle) * -150, -elevation * 110 + 18, Math.sin(angle) * -150);
    this.moon.visible = daylight < .38;
    this.lighting.setDaylight({ daylight, direction: new THREE.Vector3(Math.cos(angle), Math.max(.16, elevation), Math.sin(angle)) });
    for (const light of this.nightLights) light.intensity = light.userData.baseIntensity * (1 - daylight * .94);
    this.current = daylight;
    return { daylight, hours: Math.floor(minutes / 60) % 24, minutes: Math.floor(minutes) % 60 };
  }
}
