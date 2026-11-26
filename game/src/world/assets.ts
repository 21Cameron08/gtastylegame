import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { colliderShapeFor, isColliderOnly } from './assetNames';

type Rapier = typeof RAPIER;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<THREE.Group>>();

/** Load a .glb once; callers get clones that share geometry and materials. */
export function loadTemplate(url: string): Promise<THREE.Group> {
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((gltf) => gltf.scene);
    cache.set(url, pending);
  }
  return pending;
}

/** Clone a template, hide collider-only objects, and enable shadows. */
export function instantiate(template: THREE.Object3D): THREE.Object3D {
  const root = template.clone(true);
  root.traverse((obj) => {
    if (isColliderOnly(obj.name)) {
      obj.visible = false;
    } else if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return root;
}

const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpSize = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();

/**
 * Collider for one mesh, in world space (or at `worldMatrix`, for instances). Uses the
 * geometry's own bounds plus the object's transform, so it stays correct for
 * rotated placements and for compressed (quantized) meshes.
 */
export function colliderDescFor(
  R: Rapier,
  mesh: THREE.Mesh,
  worldMatrix?: THREE.Matrix4,
): RAPIER.ColliderDesc | null {
  const shape = colliderShapeFor(mesh.name, mesh.userData);
  if (!shape) return null;

  if (!worldMatrix) mesh.updateWorldMatrix(true, false);
  const matrix = (worldMatrix ?? mesh.matrixWorld).clone();
  matrix.decompose(tmpPos, tmpQuat, tmpScale);

  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  bb.getSize(tmpSize).multiply(tmpScale);
  bb.getCenter(tmpCenter).applyMatrix4(matrix);
  const hx = Math.abs(tmpSize.x) / 2;
  const hy = Math.abs(tmpSize.y) / 2;
  const hz = Math.abs(tmpSize.z) / 2;

  let desc: RAPIER.ColliderDesc | null;
  switch (shape) {
    case 'box':
      desc = R.ColliderDesc.cuboid(hx, hy, hz);
      break;
    case 'sphere':
      desc = R.ColliderDesc.ball(Math.max(hx, hy, hz));
      break;
    case 'capsule':
      desc = R.ColliderDesc.capsule(Math.max(hy - Math.max(hx, hz), 0.01), Math.max(hx, hz));
      break;
    case 'convex':
    case 'trimesh': {
      // Vertices relative to the bounding-box center, in collider space.
      const pos = geo.getAttribute('position');
      const pts = new Float32Array(pos.count * 3);
      const v = new THREE.Vector3();
      const local = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion(), tmpScale);
      const centerLocal = bb.getCenter(new THREE.Vector3()).applyMatrix4(local);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(local).sub(centerLocal);
        pts.set([v.x, v.y, v.z], i * 3);
      }
      if (shape === 'convex') {
        desc = R.ColliderDesc.convexHull(pts);
      } else {
        const index = geo.getIndex();
        const idx = index ? Uint32Array.from(index.array) : Uint32Array.from({ length: pos.count }, (_, i) => i);
        desc = R.ColliderDesc.trimesh(pts, idx);
      }
      break;
    }
  }
  if (!desc) return null;
  return desc
    .setTranslation(tmpCenter.x, tmpCenter.y, tmpCenter.z)
    .setRotation({ x: tmpQuat.x, y: tmpQuat.y, z: tmpQuat.z, w: tmpQuat.w });
}

/** Add fixed colliders for every collider object under an already-placed root. */
export function addStaticColliders(R: Rapier, world: RAPIER.World, root: THREE.Object3D): number {
  let count = 0;
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const desc = colliderDescFor(R, obj as THREE.Mesh);
    if (desc) {
      world.createCollider(desc);
      count++;
    }
  });
  return count;
}
