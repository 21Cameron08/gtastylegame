import { describe, expect, it } from 'vitest';
import { colliderShapeFor, isColliderOnly, parseObjectName } from '../src/world/assetNames';

describe('parseObjectName', () => {
  it('splits known suffixes', () => {
    expect(parseObjectName('BLD_Storefront_8m_A-colonly')).toEqual({ base: 'BLD_Storefront_8m_A', suffix: 'colonly' });
    expect(parseObjectName('BLD_Courthouse-col')).toEqual({ base: 'BLD_Courthouse', suffix: 'col' });
    expect(parseObjectName('PRP_Bench-lod2')).toEqual({ base: 'PRP_Bench', suffix: 'lod2' });
  });

  it('accepts Blender duplicate numbering after three.js strips the dot', () => {
    expect(parseObjectName('PRP_Crate-colonly001')).toEqual({ base: 'PRP_Crate', suffix: 'colonly' });
  });

  it('leaves names without a suffix alone', () => {
    expect(parseObjectName('WHEEL_FL')).toEqual({ base: 'WHEEL_FL', suffix: null });
    expect(parseObjectName('KIT-Thing-colonlyish')).toEqual({ base: 'KIT-Thing-colonlyish', suffix: null });
  });
});

describe('colliders', () => {
  it('identifies collider-only objects', () => {
    expect(isColliderOnly('VEH_Pickup_Work_Hull-colonly')).toBe(true);
    expect(isColliderOnly('VEH_Pickup_Work_Body')).toBe(false);
    expect(isColliderOnly('BLD_Courthouse-col')).toBe(false); // visible and collides
  });

  it('reads the shape from the custom property, defaulting to box', () => {
    expect(colliderShapeFor('X-colonly', {})).toBe('box');
    expect(colliderShapeFor('X-colonly', { collider: 'capsule' })).toBe('capsule');
    expect(colliderShapeFor('X-colonly', { collider: 'nonsense' })).toBe('box');
    expect(colliderShapeFor('X-convcolonly', {})).toBe('convex');
    expect(colliderShapeFor('X-col', {})).toBe('trimesh');
    expect(colliderShapeFor('X', { collider: 'box' })).toBeNull();
  });
});
