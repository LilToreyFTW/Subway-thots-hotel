/** Single source of keyboard and pointer state; gameplay actions remain explicit consumers. */
export class InputController {
  constructor(target = window) {
    this.keys = Object.create(null);
    this.pressed = new Set();
    this.released = new Set();
    this.pointer = { x: 0, y: 0, deltaX: 0, deltaY: 0, rightButton: false };
    this.target = target;
    this.onKeyDown = (event) => {
      if (event.target instanceof Element && event.target.matches('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (!this.keys[key]) this.pressed.add(key);
      this.keys[key] = true;
    };
    this.onKeyUp = (event) => { if (event.target instanceof Element && event.target.matches('input, textarea, select')) return; const key = event.key.toLowerCase(); this.keys[key] = false; this.released.add(key); };
    this.onPointerDown = (event) => { if (event.button === 2) this.pointer.rightButton = true; };
    this.onPointerUp = (event) => { if (event.button === 2) this.pointer.rightButton = false; };
    this.onPointerMove = (event) => { if (!this.pointer.rightButton) return; this.pointer.deltaX += event.movementX; this.pointer.deltaY += event.movementY; };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener?.('pointerdown', this.onPointerDown);
    target.addEventListener?.('pointerup', this.onPointerUp);
    target.addEventListener?.('pointermove', this.onPointerMove);
  }
  isDown(key) { return Boolean(this.keys[key]); }
  wasPressed(key) { return this.pressed.has(key); }
  update() { this.pressed.clear(); this.released.clear(); this.pointer.deltaX = 0; this.pointer.deltaY = 0; }
  dispose() {
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener?.('pointerdown', this.onPointerDown); this.target.removeEventListener?.('pointerup', this.onPointerUp); this.target.removeEventListener?.('pointermove', this.onPointerMove);
  }
}
