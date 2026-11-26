import * as THREE from 'three/webgpu';

const UP = new THREE.Vector3(0, 1, 0);

/** Third-person camera that trails a vehicle and widens its view with speed. */
export class ChaseCamera {
  private readonly forward = new THREE.Vector3(0, 0, 1);
  private readonly desired = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  update(dt: number, target: THREE.Vector3, rotation: THREE.Quaternion, speed: number): void {
    // Heading on the ground plane, smoothed so bumps don't shake the camera.
    const heading = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).setY(0);
    if (heading.lengthSq() > 1e-4) {
      heading.normalize();
      const k = this.initialized ? 1 - Math.exp(-dt * 4) : 1;
      this.forward.lerp(heading, k).normalize();
    }

    const fast = Math.min(Math.abs(speed), 40) / 40;
    const distance = 8 + fast * 2.5;
    const height = 3.0 + fast * 0.4;
    this.desired.copy(target).addScaledVector(this.forward, -distance).addScaledVector(UP, height);
    this.desired.y = Math.max(this.desired.y, target.y + 1.2, 0.6);

    const lookTarget = target.clone().addScaledVector(UP, 1.4).addScaledVector(this.forward, 3);
    if (!this.initialized) {
      this.camera.position.copy(this.desired);
      this.look.copy(lookTarget);
      this.initialized = true;
    } else {
      this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * 6));
      this.look.lerp(lookTarget, 1 - Math.exp(-dt * 10));
    }
    this.camera.lookAt(this.look);

    const fov = 60 + fast * 12;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 3));
      this.camera.updateProjectionMatrix();
    }
  }
}
