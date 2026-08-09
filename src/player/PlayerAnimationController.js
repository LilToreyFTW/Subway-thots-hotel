/** Maps gameplay states to clips while allowing richer future GLB rigs. */
export class PlayerAnimationController {
  constructor(model) { this.model = model; }

  update(delta, state) {
    this.model.playState(state);
    this.model.tick(delta);
  }
}
