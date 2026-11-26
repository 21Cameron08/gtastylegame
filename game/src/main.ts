import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { Input } from './core/input';
import { FixedStepper } from './core/loop';
import { Character } from './player/character';
import { ChaseCamera } from './player/chaseCamera';
import { OrbitCamera } from './player/orbitCamera';
import { Player, type PlayerMode } from './player/player';
import { captureFrame } from './render/capture';
import { Environment } from './render/environment';
import { createRenderer, fitToWindow } from './render/renderer';
import { Hud } from './ui/hud';
import { Vehicle } from './vehicles/vehicle';
import { PICKUP_WORK } from './vehicles/vehicleDefs';
import { TestMap } from './world/testMap';

type Vec = { x: number; y: number; z: number };

/** Read-only hooks for automated browser tests (e2e/). */
interface DebugHooks {
  ready: boolean;
  error: string | null;
  backend: string | null;
  frames: number;
  mode: PlayerMode | null;
  player: Vec | null;
  vehicle: (Vec & { speedMph: number }) | null;
  /** Offscreen render of the current view as a PNG data URL (works on WebGPU in headless browsers). */
  capture: (width?: number, height?: number) => Promise<string>;
}
const debug: DebugHooks = {
  ready: false,
  error: null,
  backend: null,
  frames: 0,
  mode: null,
  player: null,
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
  const [truck, trip] = await Promise.all([
    Vehicle.create(RAPIER, world, scene, PICKUP_WORK, map.vehicleSpawn),
    Character.create(RAPIER, world, scene, map.playerSpawn),
  ]);
  const input = new Input(window, canvas);
  const orbit = new OrbitCamera(camera, RAPIER, world);
  orbit.yaw = map.playerSpawn.yaw + Math.PI; // start behind Trip, looking the way he faces
  const player = new Player(RAPIER, world, trip, truck, new ChaseCamera(camera), orbit, input, hud);

  // ?cam=x,y,z,lookX,lookY,lookZ pins the camera (screenshots, scene review).
  const pinned = params.get('cam')?.split(',').map(Number);
  const camPinned = !!pinned && pinned.length === 6 && pinned.every(Number.isFinite);
  hud.setStatus('');
  debug.capture = (width, height) => captureFrame(renderer, scene, camera, width, height);

  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;

    if (input.wasPressed('KeyH')) hud.toggleHelp();
    player.frame();
    const alpha = stepper.advance(frame, (dt) => {
      player.fixedStep(dt);
      world.step();
      player.afterStep();
      map.afterStep();
    });
    player.render(alpha, frame);
    map.render(alpha);
    if (camPinned) {
      camera.position.set(pinned[0], pinned[1], pinned[2]);
      camera.lookAt(pinned[3], pinned[4], pinned[5]);
    }
    env.follow(camPinned ? new THREE.Vector3(pinned[3], 0, pinned[5]) : player.focus, camera);
    hud.update(frame, truck.speed, backend);
    renderer.render(scene, camera);
    input.endFrame();

    debug.frames++;
    debug.mode = player.mode;
    const c = trip.position;
    debug.player = { x: c.x, y: c.y, z: c.z };
    const v = truck.position;
    debug.vehicle = { x: v.x, y: v.y, z: v.z, speedMph: Math.abs(truck.speed) * 2.23694 };
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
