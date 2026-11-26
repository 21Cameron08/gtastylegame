/** Keyboard state plus edge-triggered "pressed this frame" events. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Call once at the end of each rendered frame. */
  endFrame(): void {
    this.pressed.clear();
  }

  /** -1..1 axis from two sets of keys. */
  axis(negative: string[], positive: string[]): number {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }
}
