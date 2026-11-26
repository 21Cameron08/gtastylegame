import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { PICKUP_WORK } from '../src/vehicles/vehicleDefs';
import { type DriveInput, type VehicleLayout, VehiclePhysics } from '../src/vehicles/vehiclePhysics';

// Matches the scripted pickup: axles at z = ±1.65, track ±0.84, wheel radius 0.4.
const LAYOUT: VehicleLayout = {
  wheels: [
    { name: 'WHEEL_FL', position: { x: 0.84, y: 0.4, z: 1.65 }, radius: 0.4, front: true },
    { name: 'WHEEL_FR', position: { x: -0.84, y: 0.4, z: 1.65 }, radius: 0.4, front: true },
    { name: 'WHEEL_RL', position: { x: 0.84, y: 0.4, z: -1.65 }, radius: 0.4, front: false },
    { name: 'WHEEL_RR', position: { x: -0.84, y: 0.4, z: -1.65 }, radius: 0.4, front: false },
  ],
  hullCenter: { x: 0, y: 1.18, z: 0 },
  hullHalfExtents: { x: 1, y: 0.68, z: 2.8 },
};

const DT = 1 / 60;
const IDLE: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

function setup() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));
  const car = new VehiclePhysics(RAPIER, world, PICKUP_WORK, LAYOUT, { x: 0, y: 0.3, z: 0 });
  const run = (seconds: number, input: DriveInput) => {
    for (let t = 0; t < seconds; t += DT) {
      car.applyInput(input, DT);
      car.update(DT);
      world.step();
    }
  };
  return { world, car, run };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe('VehiclePhysics', () => {
  it('settles on its wheels at roughly the modeled ride height', () => {
    const { car, run } = setup();
    run(2, IDLE);
    const p = car.body.translation();
    expect(Math.abs(p.y)).toBeLessThan(0.08);
    expect(Math.abs(car.speed)).toBeLessThan(0.05);
  });

  it('throttle drives forward along +Z and stays upright', () => {
    const { car, run } = setup();
    run(1, IDLE);
    run(4, { ...IDLE, throttle: 1 });
    const p = car.body.translation();
    expect(p.z).toBeGreaterThan(20);
    expect(Math.abs(p.x)).toBeLessThan(1);
    expect(car.speed).toBeGreaterThan(12);
    const q = car.body.rotation();
    expect(1 - 2 * (q.x * q.x + q.z * q.z)).toBeGreaterThan(0.95); // up vector stays up
  });

  it('brakes to a stop, then reverses', () => {
    const { car, run } = setup();
    run(1, IDLE);
    run(3, { ...IDLE, throttle: 1 });
    run(4, { ...IDLE, brake: 1 });
    expect(car.speed).toBeLessThan(0.5);
    run(2, { ...IDLE, brake: 1 });
    expect(car.speed).toBeLessThan(-1);
  });

  it('positive steer turns left (toward +X)', () => {
    const { car, run } = setup();
    run(1, IDLE);
    run(2, { ...IDLE, throttle: 0.6 });
    run(1.5, { ...IDLE, throttle: 0.6, steer: 1 });
    expect(car.yaw).toBeGreaterThan(0.3);
    expect(car.body.translation().x).toBeGreaterThan(0.5);
  });
});
