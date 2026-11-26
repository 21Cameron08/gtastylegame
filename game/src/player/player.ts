import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import type { Input } from '../core/input';
import type { Hud } from '../ui/hud';
import type { Vehicle } from '../vehicles/vehicle';
import type { DriveInput } from '../vehicles/vehiclePhysics';
import { CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, type Character, type MoveInput } from './character';
import type { ChaseCamera } from './chaseCamera';
import type { OrbitCamera } from './orbitCamera';

type Rapier = typeof RAPIER;
export type PlayerMode = 'foot' | 'vehicle';

/** Within this distance of the vehicle's center, F gets you in. */
export const ENTER_RANGE = 4;
/** You can only get out below this speed (m/s, about 9 mph). */
export const EXIT_MAX_SPEED = 4;
const PARKED: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: true };

/**
 * The player: on foot or behind the wheel. Owns mode switching (F to get in or
 * out), maps input to whichever is being controlled, and picks the camera.
 */
export class Player {
  mode: PlayerMode = 'foot';
  private move: MoveInput = { x: 0, z: 0, sprint: false, jump: false };
  private drive: DriveInput = PARKED;
  private jumpQueued = false;

  constructor(
    private readonly R: Rapier,
    private readonly world: RAPIER.World,
    readonly character: Character,
    readonly vehicle: Vehicle,
    private readonly chase: ChaseCamera,
    private readonly orbit: OrbitCamera,
    private readonly input: Input,
    private readonly hud: Hud,
  ) {
    hud.setMode(this.mode);
  }

  /** Where the action is: for the shadow camera, streaming, and so on. */
  get focus(): THREE.Vector3 {
    return this.mode === 'foot' ? this.character.position : this.vehicle.position;
  }

  get nearVehicle(): boolean {
    return this.character.position.distanceTo(this.vehicle.position) < ENTER_RANGE;
  }

  /** Once per rendered frame, before physics steps: read input, handle getting in/out. */
  frame(): void {
    const { input } = this;
    const mouse = input.consumeMouse();

    if (input.wasPressed('KeyF')) {
      if (this.mode === 'foot' && this.nearVehicle) this.enterVehicle();
      else if (this.mode === 'vehicle' && Math.abs(this.vehicle.speed) < EXIT_MAX_SPEED) this.exitVehicle();
    }

    if (this.mode === 'foot') {
      this.orbit.look(mouse.dx, mouse.dy, mouse.wheel);
      const f = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
      const r = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      const fw = this.orbit.forward;
      const rt = this.orbit.right;
      this.move = {
        x: fw.x * f + rt.x * r,
        z: fw.z * f + rt.z * r,
        sprint: input.isDown('ShiftLeft', 'ShiftRight'),
        jump: false,
      };
      if (input.wasPressed('Space')) this.jumpQueued = true;
      this.drive = PARKED;
      this.hud.setPrompt(this.nearVehicle ? 'F  Get in' : null);
      this.hud.setLookHint(!input.pointerLocked);
    } else {
      if (input.wasPressed('KeyR')) this.vehicle.reset();
      if (input.wasPressed('Backspace')) this.vehicle.respawn();
      this.drive = {
        throttle: input.isDown('KeyW', 'ArrowUp') ? 1 : 0,
        brake: input.isDown('KeyS', 'ArrowDown') ? 1 : 0,
        steer: input.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
        handbrake: input.isDown('Space'),
      };
      const slow = Math.abs(this.vehicle.speed) < EXIT_MAX_SPEED;
      this.hud.setPrompt(slow ? 'F  Get out' : null);
      this.hud.setLookHint(false);
    }
  }

  /** Each fixed physics step, before world.step(). */
  fixedStep(dt: number): void {
    if (this.mode === 'foot') {
      this.character.step(dt, { ...this.move, jump: this.jumpQueued });
      this.jumpQueued = false;
    }
    // The truck simulates either way; parked means handbrake on.
    this.vehicle.beforeStep(this.drive, dt);
  }

  afterStep(): void {
    this.character.afterStep();
    this.vehicle.afterStep();
  }

  render(alpha: number, frameSeconds: number): void {
    this.character.render(alpha, frameSeconds);
    this.vehicle.render(alpha, frameSeconds);
    if (this.mode === 'foot') this.orbit.update(frameSeconds, this.character.position, this.character.collider);
    else this.chase.update(frameSeconds, this.vehicle.position, this.vehicle.quaternion, this.vehicle.speed);
    if (this.mode === 'foot' && this.character.position.y < -30) this.respawnOnFoot();
  }

  private enterVehicle(): void {
    this.mode = 'vehicle';
    this.character.setEnabled(false);
    this.chase.begin();
    this.hud.setMode(this.mode);
  }

  private exitVehicle(): void {
    const spot = this.findExitSpot();
    if (!spot) return; // boxed in: stay put
    this.mode = 'foot';
    this.character.setEnabled(true);
    this.character.teleport(spot, this.vehicle.physics.yaw);
    this.orbit.syncFrom(this.character.position);
    this.hud.setMode(this.mode);
  }

  /** Driver's side first, then passenger side, then the roof. */
  private findExitSpot(): THREE.Vector3 | null {
    const body = this.vehicle.physics.body;
    const t = body.translation();
    const r = body.rotation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    const rot = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const shape = new this.R.Capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS);
    const identity = { x: 0, y: 0, z: 0, w: 1 };
    for (const local of [new THREE.Vector3(1.7, 1.0, 0.2), new THREE.Vector3(-1.7, 1.0, 0.2), new THREE.Vector3(0, 2.8, 0)]) {
      const p = local.applyQuaternion(rot).add(pos);
      p.y = Math.max(p.y, t.y + 0.95);
      const blocked = this.world.intersectionWithShape(p, identity, shape, undefined, undefined, undefined, body);
      if (!blocked) return p;
    }
    return null;
  }

  private respawnOnFoot(): void {
    const v = this.vehicle.position;
    this.character.teleport({ x: v.x + 3, y: v.y + 2, z: v.z + 3 }, 0);
  }
}
