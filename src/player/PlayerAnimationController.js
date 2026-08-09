export class PlayerAnimationController {
  constructor(model) { this.model = model; }
  update(delta, state) {
    const animation = state === 'sprint' || state === 'fall' ? 'run' : state === 'walk' ? 'walk' : 'idle';
    this.model.play(animation);
    if (this.model.mixer) this.model.mixer.update(delta);
  }
}
