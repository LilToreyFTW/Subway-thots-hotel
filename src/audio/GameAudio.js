const ASSETS = {
  city: '/assets/audio/city-night-loop.wav', traffic: '/assets/audio/traffic-loop.wav', idle: '/assets/audio/car-idle.wav',
  acceleration: '/assets/audio/car-acceleration.wav', footstep: '/assets/audio/player-footstep.wav', breath: '/assets/audio/player-breath.wav',
  effort: '/assets/audio/player-effort.wav', npcA: '/assets/audio/npc-greeting-a.wav', npcB: '/assets/audio/npc-greeting-b.wav', chatter: '/assets/audio/npc-chatter-loop.wav',
};

export class GameAudio {
  constructor() { this.context = null; this.master = null; this.buffers = new Map(); this.loops = new Map(); this.footstepAt = 0; this.breathAt = 0; this.npcVoice = 0; this.starting = null; }
  async start() {
    if (this.context) return;
    if (this.starting) return this.starting;
    this.starting = this.initialize();
    try { await this.starting; } finally { this.starting = null; }
  }
  async initialize() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Web Audio unavailable');
    this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = .55; this.master.connect(this.context.destination);
    await Promise.all(Object.entries(ASSETS).map(async ([key, url]) => { const response = await fetch(url); if (!response.ok) throw new Error(`${url} ${response.status}`); this.buffers.set(key, await this.context.decodeAudioData(await response.arrayBuffer())); }));
    this.loop('city', .25); this.loop('traffic', .18); this.loop('chatter', .04); this.loop('idle', 0); this.loop('acceleration', 0);
  }
  stop() { this.context?.close(); this.context = null; this.master = null; this.buffers.clear(); this.loops.clear(); this.starting = null; }
  loop(key, gainValue) { const source = this.context.createBufferSource(); source.buffer = this.buffers.get(key); source.loop = true; const gain = this.context.createGain(); gain.gain.value = gainValue; source.connect(gain).connect(this.master); source.start(); this.loops.set(key, { source, gain }); }
  oneShot(key, gainValue = .5, rate = 1) { if (!this.context || !this.buffers.has(key)) return; const source = this.context.createBufferSource(); const gain = this.context.createGain(); source.buffer = this.buffers.get(key); source.playbackRate.value = rate; gain.gain.value = gainValue; source.connect(gain).connect(this.master); source.start(); }
  update({ mode = 'city', driving = false, moving = false, sprinting = false, speed = 0, nearbyNpc = false, energy = 100 } = {}) {
    if (!this.context) return;
    const now = this.context.currentTime; const set = (key, value) => this.loops.get(key)?.gain.gain.setTargetAtTime(value, now, .16);
    set('city', mode === 'city' ? .25 : .035); set('traffic', mode === 'city' ? .2 : 0); set('chatter', nearbyNpc ? .075 : mode === 'hotel' ? .028 : 0);
    set('idle', driving ? Math.max(.08, .22 - speed * .002) : 0); set('acceleration', driving ? Math.min(.38, .08 + speed * .004) : 0);
    const accel = this.loops.get('acceleration'); if (accel) accel.source.playbackRate.setTargetAtTime(.78 + Math.min(1.25, speed / 85), now, .12);
    if (moving && !driving && now >= this.footstepAt) { this.oneShot('footstep', sprinting ? .48 : .35, .9 + Math.random() * .16); this.footstepAt = now + (sprinting ? .29 : .43); }
    if (sprinting && energy < 45 && now >= this.breathAt) { this.oneShot('breath', .22 + (45 - energy) * .004, .92 + Math.random() * .08); this.breathAt = now + 2.4; }
  }
  playerEffort() { this.oneShot('effort', .34, .92 + Math.random() * .12); }
  npcGreeting() { this.oneShot(this.npcVoice++ % 2 ? 'npcB' : 'npcA', .42, .95 + Math.random() * .1); }
}
