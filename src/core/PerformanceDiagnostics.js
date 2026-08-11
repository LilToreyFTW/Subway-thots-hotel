export class PerformanceDiagnostics {
  constructor({ renderer = null, sampleWindow = 60 } = {}) {
    this.renderer = renderer;
    this.sampleWindow = sampleWindow;
    this.frames = 0;
    this.frameTimeMs = 0;
    this.fps = 0;
    this.simulationMs = 0;
    this.renderMs = 0;
    this.lastFrameAt = 0;
    this._frameStart = 0;
    this._simStart = 0;
    this._samples = [];
    this.stats = { fps: 0, frameTimeMs: 0, simulationMs: 0, renderMs: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
  }
  beginFrame(now = performance.now()) { this._frameStart = now; }
  beginSimulation(now = performance.now()) { this._simStart = now; }
  endSimulation(now = performance.now()) { this.simulationMs += now - this._simStart; }
  endFrame(now = performance.now()) {
    const frameMs = Math.max(0, now - this._frameStart);
    this._samples.push(frameMs);
    if (this._samples.length > this.sampleWindow) this._samples.shift();
    const average = this._samples.reduce((sum, value) => sum + value, 0) / this._samples.length;
    this.frameTimeMs = average;
    this.fps = average > 0 ? 1000 / average : 0;
    this.frames += 1;
    if (this.frames % 10 === 0) this.syncRendererStats();
    return this.snapshot();
  }
  syncRendererStats() {
    const info = this.renderer?.info;
    if (!info) return;
    this.stats = { ...this.stats, fps: this.fps, frameTimeMs: this.frameTimeMs, simulationMs: this.simulationMs, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures };
    this.simulationMs = 0;
  }
  snapshot(extra = {}) { return { ...this.stats, fps: this.fps, frameTimeMs: this.frameTimeMs, ...extra }; }
}
