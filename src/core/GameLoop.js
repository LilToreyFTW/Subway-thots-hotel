/**
 * One authoritative render loop with a fixed simulation step and an accumulator.
 * Simulation systems stay deterministic while rendering remains display-rate driven.
 */
export class GameLoop {
  constructor({ clock, maxDelta = .05, fixedStep = 1 / 60, update, fixedUpdate, render, input, diagnostics }) {
    this.clock = clock;
    this.maxDelta = maxDelta;
    this.fixedStep = fixedStep;
    this.update = update;
    this.fixedUpdate = fixedUpdate;
    this.render = render;
    this.input = input;
    this.diagnostics = diagnostics;
    this.running = false;
    this.accumulator = 0;
    this.simulationTime = 0;
    this.frame = this.frame.bind(this);
  }
  start() {
    if (!this.running) {
      this.running = true;
      this.accumulator = 0;
      requestAnimationFrame(this.frame);
    }
  }
  stop() { this.running = false; }
  frame(now = performance.now()) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    this.diagnostics?.beginFrame(now);
    const delta = Math.min(this.clock.getDelta(), this.maxDelta);
    this.accumulator = Math.min(this.accumulator + delta, this.fixedStep * 5);
    this.diagnostics?.beginSimulation();
    while (this.accumulator >= this.fixedStep) {
      this.simulationTime += this.fixedStep;
      if (this.fixedUpdate) this.fixedUpdate(this.fixedStep, this.simulationTime);
      else this.update?.(this.fixedStep, this.simulationTime);
      this.accumulator -= this.fixedStep;
    }
    this.diagnostics?.endSimulation();
    const alpha = this.accumulator / this.fixedStep;
    this.update?.(delta, this.simulationTime, alpha);
    this.render?.(alpha);
    this.input?.update();
    this.diagnostics?.endFrame(now);
  }
}
