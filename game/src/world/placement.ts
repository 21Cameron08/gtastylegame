import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { isColliderOnly } from './assetNames';
import { colliderDescFor } from './assets';

type Rapier = typeof RAPIER;

/** World transform for a placed asset: position, rotation about +Y, uniform scale. */
export function placementMatrix(x: number, y: number, z: number, yaw = 0, scale = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(scale, scale, scale),
  );
}

/**
 * Draw many copies of one asset cheaply: one InstancedMesh per sub-mesh
 * (i.e. per material), instead of one draw call per copy per material.
 */
export function instanceTemplate(template: THREE.Object3D, placements: THREE.Matrix4[], shadows = true): THREE.Group {
  template.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = `${template.name || 'asset'}-instances`;
  template.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || isColliderOnly(mesh.name)) return;
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    const m = new THREE.Matrix4();
    placements.forEach((p, i) => inst.setMatrixAt(i, m.multiplyMatrices(p, mesh.matrixWorld)));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = shadows;
    inst.receiveShadow = true;
    inst.name = mesh.name;
    group.add(inst);
  });
  return group;
}

/** Fixed colliders for every collider object in the template, at every placement. */
export function addInstanceColliders(
  R: Rapier,
  world: RAPIER.World,
  template: THREE.Object3D,
  placements: THREE.Matrix4[],
): number {
  template.updateMatrixWorld(true);
  let count = 0;
  const m = new THREE.Matrix4();
  template.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const p of placements) {
      const desc = colliderDescFor(R, mesh, m.multiplyMatrices(p, mesh.matrixWorld));
      if (desc) {
        world.createCollider(desc);
        count++;
      }
    }
  });
  return count;
}

/** World positions of named marker empties (e.g. WIRE_0..2) for one placement. */
export function markerPositions(template: THREE.Object3D, prefix: string, placement: THREE.Matrix4): THREE.Vector3[] {
  template.updateMatrixWorld(true);
  const found: { name: string; pos: THREE.Vector3 }[] = [];
  template.traverse((obj) => {
    if (obj.name.startsWith(prefix)) {
      found.push({ name: obj.name, pos: new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld).applyMatrix4(placement) });
    }
  });
  return found.sort((a, b) => a.name.localeCompare(b.name)).map((f) => f.pos);
}

/** Small deterministic PRNG so scattered scenery is the same on every load. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
