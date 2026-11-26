import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { BodySync } from '../physics/bodySync';
import { instantiate, loadTemplate } from '../world/assets';

type Rapier = typeof RAPIER;

export const CHARACTER_MODEL = 'assets/characters/CHR_Trip.glb';

/** Capsule for a 1.8 m person; the body's origin sits at the capsule center. */
export const CAPSULE_RADIUS = 0.3;
export const CAPSULE_HALF_HEIGHT = 0.6;
const CENTER_Y = CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT;

/** On-foot tuning. Speeds in m/s; gravity is stronger than real for snappy jumps. */
export const MOVE = {
  run: 4.6,
  sprint: 7.2,
  jump: 5.4,
  gravity: 20,
  accelGround: 28,
  accelAir: 6,
  turnRate: 12,
};

export interface MoveInput {
  /** Desired direction on the ground plane (world space); length up to 1. */
  x: number;
  z: number;
  sprint: boolean;
  jump: boolean;
}

type JointName = 'spine' | 'head' | 'legL' | 'legR' | 'armL' | 'armR';
const JOINT_NODES: Record<JointName, string> = {
  spine: 'JOINT_Spine',
  head: 'JOINT_Head',
  legL: 'JOINT_LegL',
  legR: 'JOINT_LegR',
  armL: 'JOINT_ArmL',
  armR: 'JOINT_ArmR',
};

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * On-foot physics: a Rapier kinematic character controller (walks up curbs,
 * slides along walls, pushes crates). No rendering, so it runs in unit tests.
 */
export class CharacterPhysics {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  facing: number;
  grounded = false;
  /** Horizontal speed actually achieved last step, m/s. */
  speed = 0;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly velocity = { x: 0, z: 0 };
  private vy = 0;

  constructor(
    private readonly R: Rapier,
    world: RAPIER.World,
    spawn: { position: { x: number; y: number; z: number }; yaw: number },
  ) {
    const p = spawn.position;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
    this.collider = world.createCollider(R.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), this.body);
    const c = world.createCharacterController(0.02);
    c.enableAutostep(0.35, 0.15, false);   // curbs and steps
    c.enableSnapToGround(0.35);            // stay planted walking downhill
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(true);
    c.setCharacterMass(80);
    this.controller = c;
    this.facing = spawn.yaw;
  }

  teleport(position: { x: number; y: number; z: number }, yaw: number): void {
    this.body.setTranslation(position, true);
    this.body.setNextKinematicTranslation(position);
    this.facing = yaw;
    this.velocity.x = this.velocity.z = 0;
    this.vy = 0;
  }

  /** Call before world.step(). */
  step(dt: number, input: MoveInput): void {
    const len = Math.min(1, Math.hypot(input.x, input.z));
    const wants = len > 0.05;
    const top = input.sprint ? MOVE.sprint : MOVE.run;
    const norm = wants ? Math.hypot(input.x, input.z) : 1;
    const tx = wants ? (input.x / norm) * top * len : 0;
    const tz = wants ? (input.z / norm) * top * len : 0;

    // Accelerate toward the target velocity; much less control in the air.
    const accel = (this.grounded ? MOVE.accelGround : MOVE.accelAir) * dt;
    const dx = tx - this.velocity.x;
    const dz = tz - this.velocity.z;
    const d = Math.hypot(dx, dz);
    if (d <= accel) {
      this.velocity.x = tx;
      this.velocity.z = tz;
    } else {
      this.velocity.x += (dx / d) * accel;
      this.velocity.z += (dz / d) * accel;
    }

    if (wants) {
      const diff = wrapAngle(Math.atan2(input.x, input.z) - this.facing);
      this.facing = wrapAngle(this.facing + Math.sign(diff) * Math.min(Math.abs(diff), MOVE.turnRate * dt));
    }

    if (this.grounded) this.vy = input.jump ? MOVE.jump : -2;
    else this.vy = Math.max(this.vy - MOVE.gravity * dt, -50);

    const desired = { x: this.velocity.x * dt, y: this.vy * dt, z: this.velocity.z * dt };
    this.controller.computeColliderMovement(this.collider, desired, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
    const m = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if (desired.y > 0 && m.y < desired.y * 0.5) this.vy = 0; // bumped head
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    // Keep the intended velocity even when blocked: the controller already slides
    // along walls, and shrinking it here would stop curb steps from triggering.
    this.speed = Math.hypot(m.x, m.z) / dt;
  }
}

/**
 * The on-foot player: CharacterPhysics driving a jointed blockout model with a
 * procedural walk cycle.
 */
export class Character {
  readonly physics: CharacterPhysics;
  /** Follows the physics body (interpolated); the model hangs inside it. */
  readonly holder = new THREE.Group();
  private readonly sync: BodySync;
  private readonly joints: Record<JointName, THREE.Object3D>;
  private phase = 0;
  private enabled = true;

  private constructor(
    R: Rapier,
    world: RAPIER.World,
    private readonly model: THREE.Object3D,
    spawn: { position: THREE.Vector3; yaw: number },
  ) {
    this.physics = new CharacterPhysics(R, world, spawn);
    model.position.y = -CENTER_Y;
    this.holder.add(model);
    this.joints = Object.fromEntries(
      (Object.keys(JOINT_NODES) as JointName[]).map((k) => {
        const node = model.getObjectByName(JOINT_NODES[k]);
        if (!node) throw new Error(`character model is missing ${JOINT_NODES[k]}`);
        return [k, node];
      }),
    ) as Record<JointName, THREE.Object3D>;
    this.sync = new BodySync(this.physics.body, this.holder);
  }

  static async create(R: Rapier, world: RAPIER.World, scene: THREE.Scene, spawn: { position: THREE.Vector3; yaw: number }) {
    const model = instantiate(await loadTemplate(CHARACTER_MODEL));
    const character = new Character(R, world, model, spawn);
    scene.add(character.holder);
    return character;
  }

  get collider(): RAPIER.Collider {
    return this.physics.collider;
  }

  /** Interpolated position of the capsule center. */
  get position(): THREE.Vector3 {
    return this.holder.position;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Hide and stop colliding (e.g. while driving), or bring back. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.physics.collider.setEnabled(on);
    this.holder.visible = on;
  }

  teleport(position: { x: number; y: number; z: number }, yaw: number): void {
    this.physics.teleport(position, yaw);
    this.sync.snap();
  }

  step(dt: number, input: MoveInput): void {
    if (this.enabled) this.physics.step(dt, input);
  }

  afterStep(): void {
    this.sync.capture();
  }

  /** Interpolate the body and animate a simple procedural walk/run/jump. */
  render(alpha: number, frameSeconds: number): void {
    this.sync.apply(alpha);
    this.holder.quaternion.identity();
    this.model.rotation.y = this.physics.facing;

    const speed = this.physics.speed;
    const k = Math.min(speed / MOVE.run, 1.4);
    let legL = 0;
    let legR = 0;
    let armL = 0;
    let armR = 0;
    let lean = 0;
    let bob = 0;
    if (!this.physics.grounded) {
      legL = -0.6;
      legR = 0.35;
      armL = armR = -0.9;
    } else if (speed > 0.2) {
      this.phase += frameSeconds * (3 + speed * 1.5);
      const swing = Math.sin(this.phase) * 0.55 * Math.min(k, 1.2);
      legL = swing;
      legR = -swing;
      armL = -swing * 0.8;
      armR = swing * 0.8;
      lean = 0.08 * k;
      bob = Math.abs(Math.cos(this.phase)) * 0.045 * Math.min(k, 1);
    }
    const blend = 1 - Math.exp(-frameSeconds * 14);
    const j = this.joints;
    j.legL.rotation.x += (legL - j.legL.rotation.x) * blend;
    j.legR.rotation.x += (legR - j.legR.rotation.x) * blend;
    j.armL.rotation.x += (armL - j.armL.rotation.x) * blend;
    j.armR.rotation.x += (armR - j.armR.rotation.x) * blend;
    j.spine.rotation.x += (lean - j.spine.rotation.x) * blend;
    this.model.position.y = -CENTER_Y + bob;
  }
}
