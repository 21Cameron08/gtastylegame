import * as THREE from 'three/webgpu';

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Points along a sagging wire from a to b. A parabola is indistinguishable from
 * a true catenary at power-line spans; `sag` is the drop at mid-span (meters).
 */
export function sagCurve(a: Point3, b: Point3, sag: number, segments: number): Point3[] {
  const pts: Point3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t - 4 * sag * t * (1 - t),
      z: a.z + (b.z - a.z) * t,
    });
  }
  return pts;
}

/**
 * Wires between consecutive poles. Each pole lists its attachment points
 * (WIRE_0, WIRE_1, ... in world space); wire i runs between point i of each pair.
 */
export function buildPowerLines(poles: Point3[][], sagPerMeter = 0.013, segments = 12): THREE.LineSegments {
  const positions: number[] = [];
  for (let p = 0; p + 1 < poles.length; p++) {
    const from = poles[p];
    const to = poles[p + 1];
    for (let w = 0; w < Math.min(from.length, to.length); w++) {
      const a = from[w];
      const b = to[w];
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      const pts = sagCurve(a, b, span * sagPerMeter, segments);
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#2a2622' }));
}
