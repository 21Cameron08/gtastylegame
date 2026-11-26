/**
 * Keyboard state, edge-triggered "pressed this frame" keys, and mouse look.
 * Mouse movement only counts while the pointer is locked to the game canvas
 * (click the canvas to lock, Esc to release), like most browser shooters.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private wheel = 0;

  constructor(
    target: Window = window,
    private readonly lockElement?: HTMLElement,
  ) {
    target.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Backspace') e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());

    if (lockElement) {
      lockElement.addEventListener('click', () => {
        if (!this.pointerLocked) Promise.resolve(lockElement.requestPointerLock()).catch(() => {});
      });
      document.addEventListener('mousemove', (e) => {
        if (!this.pointerLocked) return;
        this.mouseX += e.movementX;
        this.mouseY += e.movementY;
      });
      lockElement.addEventListener(
        'wheel',
        (e) => {
          this.wheel += Math.sign(e.deltaY);
          e.preventDefault();
        },
        { passive: false },
      );
    }
  }

  get pointerLocked(): boolean {
    return !!this.lockElement && document.pointerLockElement === this.lockElement;
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** -1..1 axis from two sets of keys. */
  axis(negative: string[], positive: string[]): number {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }

  /** Mouse movement (pixels) and wheel steps since the last call. */
  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const out = { dx: this.mouseX, dy: this.mouseY, wheel: this.wheel };
    this.mouseX = 0;
    this.mouseY = 0;
    this.wheel = 0;
    return out;
  }

  /** Call once at the end of each rendered frame. */
  endFrame(): void {
    this.pressed.clear();
  }
}
