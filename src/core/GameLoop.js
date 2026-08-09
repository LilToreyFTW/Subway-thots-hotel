/** Fixed frame order with delta clamping prevents background-tab hitches from
 * causing physics or animation jumps. */
export class GameLoop {
  constructor({ clock, maxDelta = .05, update, render, input }) {
    this.clock = clock; this.maxDelta = maxDelta; this.update = update; this.render = render; this.input = input;
    this.running = false; this.frame = this.frame.bind(this);
  }
  start() { if (!this.running) { this.running = true; requestAnimationFrame(this.frame); } }
  stop() { this.running = false; }
  frame() {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const delta = Math.min(this.clock.getDelta(), this.maxDelta);
    this.update(delta, this.clock.elapsedTime);
    this.render();
    this.input?.update();
  }
}
