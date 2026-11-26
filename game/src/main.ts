import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { Input } from './core/input';
import { FixedStepper } from './core/loop';
import { ChaseCamera } from './player/chaseCamera';
import { captureFrame } from './render/capture';
import { Environment } from './render/environment';
import { createRenderer, fitToWindow } from './render/renderer';
import { Hud } from './ui/hud';
import { Vehicle } from './vehicles/vehicle';
import { PICKUP_WORK } from './vehicles/vehicleDefs';
import type { DriveInput } from './vehicles/vehiclePhysics';
import { TestMap } from './world/testMap';

/** Read-only hooks for automated browser tests (e2e/). */
interface DebugHooks {
  ready: boolean;
  error: string | null;
  backend: string | null;
  frames: number;
  vehicle: { x: number; y: number; z: number; speedMph: number } | null;
  /** Offscreen render of the current view as a PNG data URL (works on WebGPU in headless browsers). */
  capture: (width?: number, height?: number) => Promise<string>;
}
const debug: DebugHooks = {
  ready: false,
  error: null,
  backend: null,
  frames: 0,
  vehicle: null,
  capture: () => Promise.reject(new Error('game not started')),
};
(window as unknown as { __game: DebugHooks }).__game = debug;

async function boot(): Promise<void> {
  const hud = new Hud(document.getElementById('hud')!);
  hud.setStatus('Loading Cane Creek…');

  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const [{ renderer, backend }] = await Promise.all([
    createRenderer(canvas, params.get('renderer') === 'webgl'),
    RAPIER.init(),
  ]);
  debug.backend = backend;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
  window.addEventListener('resize', () => fitToWindow(renderer, camera));
  const env = new Environment(scene, renderer);

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const stepper = new FixedStepper();
  world.timestep = stepper.step;

  const map = await TestMap.build(RAPIER, world, scene);
  const truck = await Vehicle.create(RAPIER, world, scene, PICKUP_WORK, map.spawn);
  const input = new Input();
  const chase = new ChaseCamera(camera);
  // ?cam=x,y,z,lookX,lookY,lookZ pins the camera (screenshots, scene review).
  const pinned = params.get('cam')?.split(',').map(Number);
  if (pinned && pinned.length === 6 && pinned.every(Number.isFinite)) {
    camera.position.set(pinned[0], pinned[1], pinned[2]);
    camera.lookAt(pinned[3], pinned[4], pinned[5]);
  }
  hud.setStatus('');
  debug.capture = (width, height) => captureFrame(renderer, scene, camera, width, height);

  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;

    if (input.wasPressed('KeyR')) truck.reset();
    if (input.wasPressed('Backspace')) truck.respawn();
    if (input.wasPressed('KeyH')) hud.toggleHelp();
    const drive: DriveInput = {
      throttle: input.isDown('KeyW', 'ArrowUp') ? 1 : 0,
      brake: input.isDown('KeyS', 'ArrowDown') ? 1 : 0,
      steer: input.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      handbrake: input.isDown('Space'),
    };

    const alpha = stepper.advance(frame, (dt) => {
      truck.beforeStep(drive, dt);
      world.step();
      truck.afterStep();
      map.afterStep();
    });
    truck.render(alpha, frame);
    map.render(alpha);
    if (!pinned) chase.update(frame, truck.position, truck.quaternion, truck.speed);
    env.follow(truck.position, camera);
    hud.update(frame, truck.speed, backend);
    renderer.render(scene, camera);
    input.endFrame();

    debug.frames++;
    const p = truck.position;
    debug.vehicle = { x: p.x, y: p.y, z: p.z, speedMph: Math.abs(truck.speed) * 2.23694 };
    debug.ready = true;
  });
}

boot().catch((err: unknown) => {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  debug.error = message;
  console.error(err);
  const hudRoot = document.getElementById('hud');
  if (hudRoot) new Hud(hudRoot).setStatus(`Failed to start:\n${message}`, true);
});
