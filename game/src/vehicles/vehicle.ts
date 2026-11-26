import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { BodySync } from '../physics/bodySync';
import { isColliderOnly } from '../world/assetNames';
import { instantiate, loadTemplate } from '../world/assets';
import type { VehicleDef } from './vehicleDefs';
import { type DriveInput, type VehicleLayout, VehiclePhysics, type WheelLayout } from './vehiclePhysics';

type Rapier = typeof RAPIER;

export interface Spawn {
  position: THREE.Vector3;
  yaw: number;
}

const WHEEL_NAMES = ['WHEEL_FL', 'WHEEL_FR', 'WHEEL_RL', 'WHEEL_RR'];

/** Read wheel hubs and the chassis hull from the model, in chassis space. */
export function measureLayout(model: THREE.Object3D): { layout: VehicleLayout; wheelObjects: THREE.Object3D[] } {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  const wheels: WheelLayout[] = [];
  const wheelObjects: THREE.Object3D[] = [];
  for (const name of WHEEL_NAMES) {
    const obj = model.getObjectByName(name);
    if (!obj) throw new Error(`vehicle model is missing ${name}`);
    box.setFromObject(obj, true).getCenter(center);
    box.getSize(size);
    wheels.push({
      name,
      position: { x: center.x, y: center.y, z: center.z },
      radius: size.y / 2,
      front: name.startsWith('WHEEL_F'),
    });
    wheelObjects.push(obj);
  }

  let hull: THREE.Object3D | undefined;
  model.traverse((o) => {
    if (!hull && isColliderOnly(o.name)) hull = o;
  });
  if (!hull) throw new Error('vehicle model has no -colonly hull');
  box.setFromObject(hull, true);
  box.getCenter(center);
  box.getSize(size);
  return {
    layout: {
      wheels,
      hullCenter: { x: center.x, y: center.y, z: center.z },
      hullHalfExtents: { x: size.x / 2, y: size.y / 2, z: size.z / 2 },
    },
    wheelObjects,
  };
}

/** A drivable vehicle: physics, visuals, wheel animation. */
export class Vehicle {
  private readonly sync: BodySync;
  private readonly wheelPivots: THREE.Group[] = [];
  private readonly wheelSpin: number[];
  private readonly mountY: number[];

  private constructor(
    readonly physics: VehiclePhysics,
    readonly root: THREE.Object3D,
    wheelObjects: THREE.Object3D[],
    private readonly spawn: Spawn,
  ) {
    this.sync = new BodySync(physics.body, root);
    const { def, layout } = physics;
    const sag = 9.81 / (layout.wheels.length * def.suspensionStiffness);
    this.mountY = layout.wheels.map((w) => w.position.y + def.suspensionRestLength - sag);
    this.wheelSpin = layout.wheels.map(() => 0);

    // Re-parent each wheel under a pivot at its hub so it can steer and spin in place.
    layout.wheels.forEach((w, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(w.position.x, w.position.y, w.position.z);
      const obj = wheelObjects[i];
      obj.position.sub(pivot.position);
      pivot.add(obj);
      root.add(pivot);
      this.wheelPivots.push(pivot);
    });
  }

  static async create(R: Rapier, world: RAPIER.World, scene: THREE.Scene, def: VehicleDef, spawn: Spawn) {
    const root = instantiate(await loadTemplate(def.model));
    const { layout, wheelObjects } = measureLayout(root);

    // One paint material per car so each can have its own color.
    const paint = new THREE.Color(def.paint);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.name === 'MAT_Paint') {
        mesh.material = mat.clone();
        (mesh.material as THREE.MeshStandardMaterial).color.copy(paint);
      }
    });

    const physics = new VehiclePhysics(R, world, def, layout, spawn.position, spawn.yaw);
    scene.add(root);
    return new Vehicle(physics, root, wheelObjects, spawn);
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  get quaternion(): THREE.Quaternion {
    return this.root.quaternion;
  }

  /** Signed forward speed, m/s. */
  get speed(): number {
    return this.physics.speed;
  }

  beforeStep(input: DriveInput, dt: number): void {
    this.physics.applyInput(input, dt);
    this.physics.update(dt);
  }

  afterStep(): void {
    this.sync.capture();
  }

  /** Flip back onto the wheels where the vehicle is now (R key). */
  reset(): void {
    const p = this.physics.body.translation();
    this.physics.reset({ x: p.x, y: p.y + 1.5, z: p.z }, this.physics.yaw);
    this.sync.snap();
  }

  respawn(): void {
    this.physics.reset(this.spawn.position, this.spawn.yaw);
    this.sync.snap();
  }

  render(alpha: number, frameSeconds: number): void {
    this.sync.apply(alpha);
    const c = this.physics.controller;
    const speed = this.speed;
    this.physics.layout.wheels.forEach((w, i) => {
      const pivot = this.wheelPivots[i];
      const suspension = c.wheelSuspensionLength(i) ?? this.physics.def.suspensionRestLength;
      pivot.position.y = this.mountY[i] - suspension;
      this.wheelSpin[i] = (this.wheelSpin[i] + (speed * frameSeconds) / w.radius) % (Math.PI * 2);
      pivot.rotation.set(this.wheelSpin[i], c.wheelSteering(i) ?? 0, 0, 'YXZ');
    });
  }
}
