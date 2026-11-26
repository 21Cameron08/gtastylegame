import { describe, expect, it } from 'vitest';
import { buildPowerLines, sagCurve } from '../src/world/powerLines';

describe('sagCurve', () => {
  const a = { x: 0, y: 10, z: 0 };
  const b = { x: 40, y: 10, z: 0 };

  it('starts and ends on the attachment points', () => {
    const pts = sagCurve(a, b, 0.5, 10);
    expect(pts[0]).toEqual(a);
    expect(pts[pts.length - 1]).toEqual(b);
  });

  it('dips by exactly the sag at mid-span and never rises above the ends', () => {
    const pts = sagCurve(a, b, 0.5, 10);
    expect(pts[5].y).toBeCloseTo(9.5, 6);
    expect(Math.max(...pts.map((p) => p.y))).toBeLessThanOrEqual(10);
  });

  it('handles poles at different heights', () => {
    const pts = sagCurve({ x: 0, y: 10, z: 0 }, { x: 0, y: 12, z: 40 }, 0, 4);
    expect(pts[2]).toEqual({ x: 0, y: 11, z: 20 });
  });
});

describe('buildPowerLines', () => {
  it('creates one wire per attachment point per span', () => {
    const pole = (x: number) => [0, 1, 2].map((i) => ({ x, y: 10, z: i }));
    const lines = buildPowerLines([pole(0), pole(40), pole(80)], 0.01, 6);
    // 2 spans x 3 wires x 6 segments x 2 vertices
    expect(lines.geometry.getAttribute('position').count).toBe(2 * 3 * 6 * 2);
  });
});
