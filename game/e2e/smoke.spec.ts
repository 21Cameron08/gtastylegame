import { writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

type Vec = { x: number; y: number; z: number };
interface GameHooks {
  ready: boolean;
  error: string | null;
  backend: string | null;
  frames: number;
  mode: 'foot' | 'vehicle' | null;
  player: Vec | null;
  vehicle: (Vec & { speedMph: number }) | null;
  capture: (width?: number, height?: number) => Promise<string>;
}

const hooks = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { __game: GameHooks }).__game;
    return { ready: g.ready, error: g.error, backend: g.backend, frames: g.frames, mode: g.mode, player: g.player, vehicle: g.vehicle };
  });

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** Boot the game and collect console errors and uncaught exceptions. */
async function boot(page: Page, query = '') {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`/${query}`);
  await expect
    .poll(async () => {
      const h = await hooks(page);
      if (h.error) throw new Error(`game failed to start: ${h.error}`);
      return h.ready && h.frames > 10;
    })
    .toBe(true);
  return errors;
}

/**
 * Save an offscreen render of the current view and return how many distinct
 * colors it has on a coarse grid. Screenshots can't see a WebGPU canvas in
 * headless browsers; the game's capture hook can.
 */
async function captureFrame(page: Page, path: string): Promise<number> {
  const result = await page.evaluate(async () => {
    const g = (window as unknown as { __game: GameHooks }).__game;
    const url = await g.capture(640, 360);
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const colors = new Set<string>();
    for (let y = 5; y < c.height; y += 20) {
      for (let x = 5; x < c.width; x += 20) {
        const [r, gr, b] = ctx.getImageData(x, y, 1, 1).data;
        colors.add(`${r >> 3},${gr >> 3},${b >> 3}`);
      }
    }
    return { url, distinct: colors.size };
  });
  writeFileSync(path, Buffer.from(result.url.split(',')[1], 'base64'));
  return result.distinct;
}

const REQUIRE_WEBGPU = process.env.REQUIRE_WEBGPU === '1';

/**
 * Chromium's software WebGPU adapter (SwiftShader, used on GPU-less machines)
 * renders but its GPU-to-CPU readback is unreliable (hangs or device errors).
 * Pixel checks on WebGPU only run where a real GPU is available: WEBGPU_READBACK=1.
 */
const canReadPixels = (backend: string | null) => backend !== 'WebGPU' || process.env.WEBGPU_READBACK === '1';

/** Errors the software WebGPU adapter logs on its own; real GPUs don't produce them. */
const SOFTWARE_WEBGPU_NOISE = [/Instance dropped in popErrorScope/, /createBuffer failed, size \(\d+\) is too large for the implementation when mappedAtCreation/];

function realErrors(errors: string[], backend: string | null): string[] {
  if (backend !== 'WebGPU') return errors;
  const kept = errors.filter((e) => !SOFTWARE_WEBGPU_NOISE.some((re) => re.test(e)));
  if (kept.length < errors.length) {
    test.info().annotations.push({ type: 'ignored', description: `${errors.length - kept.length} software-WebGPU adapter errors` });
  }
  return kept;
}

for (const [label, query] of [
  ['default renderer', ''],
  ['forced WebGL 2 fallback', '?renderer=webgl'],
] as const) {
  test(`boots, walks, gets in, drives, and gets out (${label})`, async ({ page }, info) => {
    const errors = await boot(page, query);
    const start = await hooks(page);
    if (query) expect(start.backend).toBe('WebGL 2');
    else if (REQUIRE_WEBGPU) expect(start.backend).toBe('WebGPU');

    // A real scene has many colors; a blank or failed render has one or two.
    const pixels = canReadPixels(start.backend);
    if (pixels) expect(await captureFrame(page, info.outputPath('spawn.png'))).toBeGreaterThan(20);

    // Every step polls game state instead of waiting a fixed time, so the test is
    // independent of frame rate (software rendering is slow).
    const poll = (fn: () => Promise<unknown>) => expect.poll(fn, { timeout: 90_000 });
    expect(start.mode).toBe('foot');

    // Get in the truck parked beside the spawn.
    await page.keyboard.press('KeyF');
    await poll(async () => (await hooks(page)).mode).toBe('vehicle');

    // Drive until the truck has covered some ground.
    const parked = start.vehicle!;
    await page.keyboard.down('KeyW');
    await poll(async () => dist((await hooks(page)).vehicle!, parked)).toBeGreaterThan(4);
    await page.keyboard.up('KeyW');
    if (pixels) await captureFrame(page, info.outputPath('driving.png'));

    // Brake to a near stop, then get out.
    await page.keyboard.down('KeyS');
    await poll(async () => (await hooks(page)).vehicle!.speedMph).toBeLessThan(4);
    await page.keyboard.up('KeyS');
    await page.keyboard.press('KeyF');
    await poll(async () => (await hooks(page)).mode).toBe('foot');

    // Walk away from the truck.
    const exitSpot = (await hooks(page)).player!;
    await page.keyboard.down('KeyW');
    await poll(async () => dist((await hooks(page)).player!, exitSpot)).toBeGreaterThan(2);
    await page.keyboard.up('KeyW');
    if (pixels) await captureFrame(page, info.outputPath('walking.png'));

    const end = await hooks(page);
    console.log(`[${label}] backend=${end.backend} frames=${end.frames} drove=${dist(end.vehicle!, parked).toFixed(1)}m`);
    expect(end.vehicle!.y).toBeGreaterThan(-1); // nothing fell through the world
    expect(end.player!.y).toBeGreaterThan(0.5);
    expect(realErrors(errors, end.backend)).toEqual([]);
  });
}
