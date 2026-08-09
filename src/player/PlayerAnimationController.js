export class PlayerAnimationController {
  constructor(model) { this.model = model; }
  update(delta, state) {
    const animation = ['sprint', 'fall', 'jump'].includes(state) ? 'run' : state === 'walk' ? 'walk' : 'idle';
    this.model.play(animation);
    if (this.model.mixer) this.model.mixer.update(delta);
  }
}
