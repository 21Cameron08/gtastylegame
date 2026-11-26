export type HudMode = 'foot' | 'vehicle';

const HELP: Record<HudMode, string> = {
  foot: `<b>WASD</b> move &nbsp; <b>Shift</b> sprint &nbsp; <b>Space</b> jump &nbsp; <b>Mouse</b> look
    &nbsp; <b>Wheel</b> zoom &nbsp; <b>F</b> get in &nbsp; <b>H</b> hide`,
  vehicle: `<b>W/S</b> gas / brake-reverse &nbsp; <b>A/D</b> steer &nbsp; <b>Space</b> handbrake
    &nbsp; <b>F</b> get out &nbsp; <b>R</b> flip upright &nbsp; <b>Backspace</b> respawn &nbsp; <b>H</b> hide`,
};

/** DOM overlay: title, speedometer, renderer/fps readout, prompts, controls, status. */
export class Hud {
  private readonly speed: HTMLElement;
  private readonly speedBox: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly status: HTMLElement;
  private readonly help: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly lookHint: HTMLElement;
  private fpsFrames = 0;
  private fpsTime = 0;
  private promptText: string | null = null;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-title">RED CLAY <span>M0 test build</span></div>
      <div class="hud-perf" data-hud="perf"></div>
      <div class="hud-status" data-hud="status"></div>
      <div class="hud-hint" data-hud="look">Click to look around</div>
      <div class="hud-prompt" data-hud="prompt"></div>
      <div class="hud-help" data-hud="help"></div>
      <div class="hud-speed" data-hud="speedbox"><span data-hud="speed">0</span><small>MPH</small></div>`;
    this.speed = root.querySelector('[data-hud="speed"]')!;
    this.speedBox = root.querySelector('[data-hud="speedbox"]')!;
    this.perf = root.querySelector('[data-hud="perf"]')!;
    this.status = root.querySelector('[data-hud="status"]')!;
    this.help = root.querySelector('[data-hud="help"]')!;
    this.prompt = root.querySelector('[data-hud="prompt"]')!;
    this.lookHint = root.querySelector('[data-hud="look"]')!;
    this.setPrompt(null);
    this.setLookHint(false);
  }

  setStatus(text: string, isError = false): void {
    this.status.textContent = text;
    this.status.classList.toggle('error', isError);
    this.status.style.display = text ? 'block' : 'none';
  }

  setMode(mode: HudMode): void {
    this.help.innerHTML = HELP[mode];
    this.speedBox.style.display = mode === 'vehicle' ? 'block' : 'none';
  }

  /** Context action shown at the bottom center, e.g. "F  Get in". */
  setPrompt(text: string | null): void {
    if (text === this.promptText) return;
    this.promptText = text;
    this.prompt.textContent = text ?? '';
    this.prompt.style.display = text ? 'block' : 'none';
  }

  setLookHint(show: boolean): void {
    this.lookHint.style.display = show ? 'block' : 'none';
  }

  toggleHelp(): void {
    this.help.classList.toggle('hidden');
  }

  update(frameSeconds: number, speedMps: number, backend: string): void {
    this.fpsFrames++;
    this.fpsTime += frameSeconds;
    if (this.fpsTime >= 0.5) {
      const fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
      this.perf.textContent = `${backend} · ${fps} fps`;
    }
    this.speed.textContent = String(Math.round(Math.abs(speedMps) * 2.23694));
  }
}
