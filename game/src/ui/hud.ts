/** DOM overlay: title, speedometer, renderer/fps readout, controls, status. */
export class Hud {
  private readonly speed: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly status: HTMLElement;
  private readonly help: HTMLElement;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-title">RED CLAY <span>M0 test build</span></div>
      <div class="hud-perf" data-hud="perf"></div>
      <div class="hud-status" data-hud="status"></div>
      <div class="hud-help" data-hud="help">
        <b>W/S</b> gas / brake-reverse &nbsp; <b>A/D</b> steer &nbsp; <b>Space</b> handbrake
        &nbsp; <b>R</b> flip upright &nbsp; <b>Backspace</b> respawn &nbsp; <b>H</b> hide
      </div>
      <div class="hud-speed"><span data-hud="speed">0</span><small>MPH</small></div>`;
    this.speed = root.querySelector('[data-hud="speed"]')!;
    this.perf = root.querySelector('[data-hud="perf"]')!;
    this.status = root.querySelector('[data-hud="status"]')!;
    this.help = root.querySelector('[data-hud="help"]')!;
  }

  setStatus(text: string, isError = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
    this.status.style.display = text ? 'block' : 'none';
  }

  toggleHelp(): void {
    this.help.classList.toggle('hidden');
  }

  update(frameSeconds: number, speedMps: number, backend: string): void {
    this.fpsFrames++;
    this.fpsTime += frameSeconds;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
      this.perf.textContent = `${backend} · ${this.fps} fps`;
    }
    this.speed.textContent = String(Math.round(Math.abs(speedMps) * 2.23694));
  }
}
