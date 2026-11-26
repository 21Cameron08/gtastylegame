import type RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleDef } from './vehicleDefs';

type Rapier = typeof RAPIER;
export interface Vec3 { x: number; y: number; z: number }

export interface WheelLayout {
  name: string;
  /** Hub center in chassis space (origin on the ground between the axles). */
  position: Vec3;
  radius: number;
  front: boolean;
}

export interface VehicleLayout {
  wheels: WheelLayout[];
  hullCenter: Vec3;
  hullHalfExtents: Vec3;
}

export interface DriveInput {
  /** 0..1 */
  throttle: number;
  /** 0..1: brakes when moving forward, reverses when stopped. */
  brake: number;
  /** -1 (right) .. 1 (left) */
  steer: number;
  handbrake: boolean;
}

const GRAVITY = 9.81;
const FORWARD_AXIS_Z = 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Ray-cast vehicle on a Rapier rigid body. Chassis space: +Y up, +Z forward,
 * +X left (glTF convention). No rendering here, so it runs in unit tests.
 */
export class VehiclePhysics {
  readonly body: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  private steer = 0;

  constructor(
    R: Rapier,
    private readonly world: RAPIER.World,
    readonly def: VehicleDef,
    readonly layout: VehicleLayout,
    spawn: Vec3,
    yaw = 0,
  ) {
    const h = layout.hullHalfExtents;
    const [w, ht, l] = [h.x * 2, h.y * 2, h.z * 2];
    const m = def.mass;
    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setRotation(yawQuat(yaw))
      .setCcdEnabled(true)
      .setCanSleep(false)
      .setLinearDamping(0.02)
      .setAngularDamping(0.4)
      .setAdditionalMassProperties(
        m,
        { x: 0, y: def.centerOfMassY, z: layout.hullCenter.z },
        { x: (m / 12) * (ht * ht + l * l), y: (m / 12) * (w * w + l * l), z: (m / 12) * (w * w + ht * ht) },
        { w: 1, x: 0, y: 0, z: 0 },
      );
    this.body = world.createRigidBody(bodyDesc);
    world.createCollider(
      R.ColliderDesc.cuboid(h.x, h.y, h.z)
        .setTranslation(layout.hullCenter.x, layout.hullCenter.y, layout.hullCenter.z)
        .setDensity(0)
        .setFriction(0.4),
      this.body,
    );

    const c = world.createVehicleController(this.body);
    c.setIndexForwardAxis = FORWARD_AXIS_Z;
    // Mount points sit high enough that the body rests at its modeled height
    // once the springs settle under the car's weight.
    const sag = GRAVITY / (layout.wheels.length * def.suspensionStiffness);
    for (const wheel of layout.wheels) {
      const p = wheel.position;
      c.addWheel(
        { x: p.x, y: p.y + def.suspensionRestLength - sag, z: p.z },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        def.suspensionRestLength,
        wheel.radius,
      );
    }
    for (let i = 0; i < layout.wheels.length; i++) {
      c.setWheelSuspensionStiffness(i, def.suspensionStiffness);
      c.setWheelSuspensionCompression(i, def.suspensionCompression);
      c.setWheelSuspensionRelaxation(i, def.suspensionRelaxation);
      c.setWheelMaxSuspensionTravel(i, def.suspensionTravel);
      c.setWheelMaxSuspensionForce(i, m * GRAVITY * 3);
      c.setWheelFrictionSlip(i, def.frictionSlip);
      c.setWheelSideFrictionStiffness(i, def.sideFrictionStiffness);
    }
    this.controller = c;
  }

  /** Signed speed along the vehicle's forward axis, m/s. */
  get speed(): number {
    // Computed directly: the controller's own speed value goes stale while the body sleeps.
    const v = this.body.linvel();
    const q = this.body.rotation();
    const fx = 2 * (q.x * q.z + q.w * q.y);
    const fy = 2 * (q.y * q.z - q.w * q.x);
    const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    return v.x * fx + v.y * fy + v.z * fz;
  }

  get steering(): number {
    return this.steer;
  }

  private isDriven(wheel: WheelLayout): boolean {
    return this.def.drive === 'awd' || (this.def.drive === 'fwd') === wheel.front;
  }

  applyInput(input: DriveInput, dt: number): void {
    const { def, controller: c, layout } = this;
    const v = this.speed;

    let engine = 0;
    let brake = 0;
    if (input.throttle > 0) {
      if (v < -1) brake = def.brakeForce * input.throttle;
      // Quadratic fade: strong pull through the midrange, tapering near top speed.
      else engine = def.engineForce * input.throttle * clamp01(1 - (v / def.topSpeed) ** 2);
    }
    if (input.brake > 0) {
      if (v > 1) brake = def.brakeForce * input.brake;
      else engine = -def.reverseForce * input.brake * clamp01(1 + v / (def.topSpeed * 0.35));
    }
    if (input.throttle === 0 && input.brake === 0) brake = def.brakeForce * 0.04; // rolling resistance

    const steerLimit = def.maxSteer + (def.maxSteerAtSpeed - def.maxSteer) * clamp01(Math.abs(v) / 30);
    const target = input.steer * steerLimit;
    const rate = def.steerSpeed * (Math.sign(target - this.steer) !== Math.sign(this.steer) ? 1.6 : 1);
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));

    const driven = layout.wheels.filter((w) => this.isDriven(w)).length;
    layout.wheels.forEach((wheel, i) => {
      c.setWheelSteering(i, wheel.front ? this.steer : 0);
      c.setWheelEngineForce(i, this.isDriven(wheel) ? engine / driven : 0);
      const hand = input.handbrake && !wheel.front;
      c.setWheelBrake(i, hand ? def.handbrakeForce : brake);
      c.setWheelFrictionSlip(i, def.frictionSlip * (hand ? def.handbrakeGrip : 1));
    });
  }

  update(dt: number): void {
    this.controller.updateVehicle(dt);
  }

  /** Put the vehicle back on its wheels, e.g. after a rollover. */
  reset(position: Vec3, yaw: number): void {
    this.body.setTranslation(position, true);
    this.body.setRotation(yawQuat(yaw), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.steer = 0;
  }

  /** Yaw (rotation about +Y) of the chassis, radians; 0 = facing +Z. */
  get yaw(): number {
    const q = this.body.rotation();
    return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
  }

  dispose(): void {
    this.world.removeVehicleController(this.controller);
    this.world.removeRigidBody(this.body);
  }
}

export function yawQuat(yaw: number) {
  return { w: Math.cos(yaw / 2), x: 0, y: Math.sin(yaw / 2), z: 0 };
}
