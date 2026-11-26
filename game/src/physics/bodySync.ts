import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';

/**
 * Copies a rigid body's transform onto a scene object, interpolating between
 * the last two fixed physics steps so motion is smooth at any frame rate.
 */
export class BodySync {
  private prevPos = new THREE.Vector3();
  private currPos = new THREE.Vector3();
  private prevQuat = new THREE.Quaternion();
  private currQuat = new THREE.Quaternion();

  constructor(
    readonly body: RAPIER.RigidBody,
    readonly object: THREE.Object3D,
  ) {
    this.snap();
  }

  /** Call after each physics step. */
  capture(): void {
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    const t = this.body.translation();
    const r = this.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currQuat.set(r.x, r.y, r.z, r.w);
  }

  /** Jump without interpolation (spawns, resets). */
  snap(): void {
    this.capture();
    this.capture();
    this.apply(1);
  }

  apply(alpha: number): void {
    this.object.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.object.quaternion.slerpQuaternions(this.prevQuat, this.currQuat, alpha);
  }
}
