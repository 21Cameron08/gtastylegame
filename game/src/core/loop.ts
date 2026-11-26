/**
 * Fixed-timestep accumulator: simulation runs at a constant rate (60 Hz) no
 * matter the display refresh rate; rendering interpolates between steps.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    readonly step = 1 / 60,
    /** Cap on steps per frame so a slow frame can't snowball ("spiral of death"). */
    readonly maxSteps = 5,
  ) {}

  /**
   * Advance by a real frame time. Calls `tick(step)` zero or more times and
   * returns the interpolation factor (0..1) between the last two steps.
   */
  advance(frameSeconds: number, tick: (dt: number) => void): number {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), this.step * this.maxSteps);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxSteps) {
      tick(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxSteps) this.accumulator = Math.min(this.accumulator, this.step);
    return this.accumulator / this.step;
  }
}
