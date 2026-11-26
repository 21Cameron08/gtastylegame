import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { CharacterPhysics, MOVE, type MoveInput } from '../src/player/character';

const DT = 1 / 60;
const STILL: MoveInput = { x: 0, z: 0, sprint: false, jump: false };
const NORTH: MoveInput = { x: 0, z: 1, sprint: false, jump: false }; // +Z

function setup(extra?: (world: RAPIER.World) => void) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.5, 200).setTranslation(0, -0.5, 0));
  extra?.(world);
  const trip = new CharacterPhysics(RAPIER, world, { position: { x: 0, y: 1.0, z: 0 }, yaw: 0 });
  const run = (seconds: number, input: MoveInput) => {
    for (let t = 0; t < seconds - 1e-9; t += DT) {
      trip.step(DT, input);
      world.step();
    }
  };
  return { world, trip, run, pos: () => trip.body.translation() };
}

beforeAll(async () => {
  await RAPIER.init();
});

describe('CharacterPhysics', () => {
  it('stands on the ground with the capsule center at 0.9 m', () => {
    const { trip, run, pos } = setup();
    run(1, STILL);
    expect(trip.grounded).toBe(true);
    expect(pos().y).toBeGreaterThan(0.85);
    expect(pos().y).toBeLessThan(0.97);
  });

  it('runs at the tuned speed and sprints faster', () => {
    const { trip, run, pos } = setup();
    run(0.5, STILL);
    run(1, NORTH);
    expect(trip.speed).toBeCloseTo(MOVE.run, 0);
    const z0 = pos().z;
    run(1, { ...NORTH, sprint: true });
    expect(pos().z - z0).toBeGreaterThan(MOVE.run * 1.1);
  });

  it('turns to face the way it moves', () => {
    const { trip, run } = setup();
    run(0.5, STILL);
    run(0.5, { ...STILL, x: 1 }); // +X is yaw +90°
    expect(trip.facing).toBeCloseTo(Math.PI / 2, 1);
  });

  it('steps up a 15 cm curb without jumping', () => {
    const { run, pos } = setup((w) => {
      w.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.075, 5).setTranslation(0, 0.075, 8)); // curb top at 0.15
    });
    run(0.5, STILL);
    run(3, NORTH);
    expect(pos().z).toBeGreaterThan(5);
    expect(pos().y).toBeGreaterThan(1.0); // now standing on the curb
  });

  it('is stopped by a wall', () => {
    const { run, pos } = setup((w) => {
      w.createCollider(RAPIER.ColliderDesc.cuboid(5, 3, 0.5).setTranslation(0, 3, 6)); // wall face at z = 5.5
    });
    run(0.5, STILL);
    run(4, NORTH);
    expect(pos().z).toBeLessThan(5.5 - 0.25);
    expect(pos().z).toBeGreaterThan(4.5);
  });

  it('jumps about two thirds of a meter and lands', () => {
    const { trip, run, pos } = setup();
    run(0.5, STILL);
    const y0 = pos().y;
    trip.step(DT, { ...STILL, jump: true });
    let peak = y0;
    for (let i = 0; i < 90; i++) {
      run(DT, STILL);
      peak = Math.max(peak, pos().y);
    }
    expect(peak - y0).toBeGreaterThan(0.5);
    expect(peak - y0).toBeLessThan(0.95);
    expect(trip.grounded).toBe(true);
  });
});
