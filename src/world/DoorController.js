export class DoorController {
  constructor(node, { type = 'hotel', mode = 'hinged', openAmount = Math.PI / 2, speed = 3 } = {}) {
    this.node = node; this.type = type; this.mode = mode; this.openAmount = openAmount; this.speed = speed;
    this.state = 'closed'; this.progress = 0; this.closedPosition = node.position.clone();
  }
  toggle() { if (this.state === 'closed' || this.state === 'closing') this.state = 'opening'; else this.state = 'closing'; }
  update(delta) {
    const direction = this.state === 'opening' ? 1 : this.state === 'closing' ? -1 : 0;
    this.progress = Math.max(0, Math.min(1, this.progress + direction * this.speed * delta));
    if (this.mode === 'sliding') this.node.position.x = this.closedPosition.x + this.openAmount * this.progress;
    else this.node.rotation.y = this.openAmount * this.progress;
    if (this.progress === 1) this.state = 'open';
    if (this.progress === 0) this.state = 'closed';
  }
}
