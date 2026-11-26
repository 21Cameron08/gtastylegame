import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';

type Rapier = typeof RAPIER;

const SENSITIVITY = 0.0025;
const MIN_PITCH = -0.45;
const MAX_PITCH = 1.2;
const MIN_DIST = 2;
const MAX_DIST = 9;
const EYE_HEIGHT = 0.65;   // above the capsule center (~1.55 m above the feet)
const SHOULDER = 0.4;      // over-the-right-shoulder offset

/**
 * Third-person orbit camera for walking: mouse to look, wheel to zoom. A ray
 * cast keeps it from passing through walls.
 */
export class OrbitCamera {
  yaw = 0;
  pitch = 0.22;
  distance = 4.5;
  private readonly smoothed = new THREE.Vector3();
  private initialized = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly R: Rapier,
    private readonly world: RAPIER.World,
  ) {}

  look(dx: number, dy: number, wheel: number): void {
    this.yaw -= dx * SENSITIVITY;
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch + dy * SENSITIVITY));
    this.distance = Math.min(MAX_DIST, Math.max(MIN_DIST, this.distance + wheel * 0.6));
  }

  /** Movement directions on the ground relative to the view. */
  get forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  get right(): { x: number; z: number } {
    return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
  }

  /** Start orbiting from wherever the camera is now, so mode switches don't jump. */
  syncFrom(focus: THREE.Vector3): void {
    const off = this.camera.position.clone().sub(focus);
    const len = Math.max(off.length(), 0.001);
    this.yaw = Math.atan2(off.x, off.z);
    this.pitch = Math.min(MAX_PITCH, Math.max(0.05, Math.asin(off.y / len)));
    this.distance = Math.min(MAX_DIST, Math.max(3.5, len * 0.6));
    this.smoothed.copy(focus);
    this.initialized = true;
  }

  update(dt: number, focus: THREE.Vector3, exclude?: RAPIER.Collider): void {
    const k = this.initialized ? 1 - Math.exp(-dt * 16) : 1;
    this.smoothed.lerp(focus, k);
    this.initialized = true;

    const r = this.right;
    const pivot = this.smoothed.clone();
    pivot.y += EYE_HEIGHT;
    pivot.x += r.x * SHOULDER;
    pivot.z += r.z * SHOULDER;
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    // Pull in when something is between the player and the camera.
    const ray = new this.R.Ray(pivot, dir);
    const hit = this.world.castRay(ray, this.distance, true, undefined, undefined, exclude);
    const d = hit ? Math.max(0.5, hit.timeOfImpact - 0.25) : this.distance;
    this.camera.position.copy(pivot).addScaledVector(dir, d);
    this.camera.position.y = Math.max(this.camera.position.y, 0.3);
    this.camera.lookAt(pivot);

    if (Math.abs(this.camera.fov - 60) > 0.05) {
      this.camera.fov += (60 - this.camera.fov) * (1 - Math.exp(-dt * 4));
      this.camera.updateProjectionMatrix();
    }
  }
}
