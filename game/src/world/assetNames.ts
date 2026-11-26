/**
 * Object-name conventions from docs/06-blender-pipeline.md.
 * Blender duplicates like "X-colonly.001" arrive as "X-colonly001" because
 * three.js strips '.' from node names, so trailing digits are allowed.
 */
export type NameSuffix = 'col' | 'colonly' | 'convcolonly' | 'nav' | 'lod1' | 'lod2' | 'lod3' | 'noexp';

export type ColliderShape = 'box' | 'sphere' | 'capsule' | 'convex' | 'trimesh';

const SUFFIX_RE = /-(colonly|convcolonly|col|nav|lod[1-3]|noexp)(\d*)$/;
const SHAPES: readonly ColliderShape[] = ['box', 'sphere', 'capsule', 'convex', 'trimesh'];

export interface ParsedName {
  base: string;
  suffix: NameSuffix | null;
}

export function parseObjectName(name: string): ParsedName {
  const m = SUFFIX_RE.exec(name);
  if (!m) return { base: name, suffix: null };
  return { base: name.slice(0, m.index), suffix: m[1] as NameSuffix };
}

/** True for objects that only exist as physics shapes and must not render. */
export function isColliderOnly(name: string): boolean {
  const { suffix } = parseObjectName(name);
  return suffix === 'colonly' || suffix === 'convcolonly';
}

/** Collider shape for a collider object, from its suffix and `collider` custom property. */
export function colliderShapeFor(name: string, userData: Record<string, unknown>): ColliderShape | null {
  const { suffix } = parseObjectName(name);
  if (suffix === 'convcolonly') return 'convex';
  if (suffix === 'col') return 'trimesh';
  if (suffix !== 'colonly') return null;
  const requested = userData['collider'];
  return typeof requested === 'string' && (SHAPES as readonly string[]).includes(requested)
    ? (requested as ColliderShape)
    : 'box';
}
