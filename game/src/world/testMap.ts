import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { BodySync } from '../physics/bodySync';
import { addStaticColliders, instantiate, loadTemplate } from './assets';

type Rapier = typeof RAPIER;

/**
 * M0 greybox: a courthouse square ringed by scripted storefronts, a road north
 * to a SaveMore lot, a red clay dirt road west with a jump, and the Port
 * Meridian skyline in the haze. Placeholder geometry until real kits exist.
 *
 * Coordinates: meters, +Y up. The square's road loop centerline is x = ±60, z = ±40.
 */

const COLORS = {
  grass: '#6c7642',
  lawn: '#5f7a3a',
  asphalt: '#3a3b3d',
  asphaltLot: '#45464a',
  line: '#d9b23a',
  sidewalk: '#b9b4a8',
  clay: '#a4552f',
  courthouse: '#e8e0cc',
  courthouseRoof: '#5b6b62',
  trunk: '#5a4632',
  canopy: '#3e5a2c',
  tower: '#d7dadc',
  pole: '#6b5440',
  crate: '#b08a5a',
  skyline: '#8e99a6',
  saveMore: '#d9dde2',
  saveMoreBand: '#1f5fae',
} as const;

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.9): THREE.MeshStandardMaterial {
  const key = `${color}/${roughness}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness });
    materials.set(key, m);
  }
  return m;
}

const BUILDING_MODELS = {
  A: 'assets/buildings/BLD_Storefront_8m_A.glb',
  B: 'assets/buildings/BLD_Storefront_8m_B.glb',
  C: 'assets/buildings/BLD_Storefront_12m_C.glb',
  D: 'assets/buildings/BLD_Storefront_8m_D.glb',
} as const;
const BUILDING_WIDTH: Record<keyof typeof BUILDING_MODELS, number> = { A: 8, B: 8, C: 12, D: 8 };
const ROW_PATTERN: (keyof typeof BUILDING_MODELS)[] = ['A', 'B', 'D', 'C', 'B', 'A', 'C', 'D'];

interface DynamicProp {
  sync: BodySync;
}

export class TestMap {
  readonly spawn = { position: new THREE.Vector3(-92, 0.4, 0), yaw: Math.PI / 2 };
  private readonly props: DynamicProp[] = [];
  buildingCount = 0;

  constructor(
    private readonly R: Rapier,
    private readonly world: RAPIER.World,
    private readonly scene: THREE.Scene,
  ) {}

  static async build(R: Rapier, world: RAPIER.World, scene: THREE.Scene): Promise<TestMap> {
    const map = new TestMap(R, world, scene);
    map.ground();
    map.roads();
    map.square();
    map.westOutskirts();
    map.northToSaveMore();
    map.skyline();
    await map.downtownRows();
    return map;
  }

  afterStep(): void {
    for (const p of this.props) p.sync.capture();
  }

  render(alpha: number): void {
    for (const p of this.props) p.sync.apply(alpha);
  }

  // ---------------------------------------------------------------- helpers

  /** Box from min/max corners on the ground plane; optional fixed collider. */
  private box(
    x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    color: string, opts: { collider?: boolean; shadow?: boolean; roughness?: number } = {},
  ): THREE.Mesh {
    const { collider = false, shadow = true, roughness = 0.9 } = opts;
    const size = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat(color, roughness));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collider) {
      this.world.createCollider(
        this.R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setTranslation(
          mesh.position.x, mesh.position.y, mesh.position.z,
        ),
      );
    }
    return mesh;
  }

  private cylinder(x: number, z: number, y0: number, height: number, radius: number, color: string, collider = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 10), mat(color));
    mesh.position.set(x, y0 + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collider) {
      this.world.createCollider(this.R.ColliderDesc.cylinder(height / 2, radius).setTranslation(x, y0 + height / 2, z));
    }
    return mesh;
  }

  // ---------------------------------------------------------------- layout

  private ground(): void {
    // Subdivided and sunk 2 cm: one giant quad loses depth precision and the
    // roads drawn just above it flicker away.
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 60, 60), mat(COLORS.grass, 1));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.02;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.world.createCollider(this.R.ColliderDesc.cuboid(3000, 1, 3000).setTranslation(0, -1, 0).setFriction(0.9));
  }

  private roads(): void {
    const top = 0.03;
    const road = (x0: number, x1: number, z0: number, z1: number, color: string = COLORS.asphalt) =>
      this.box(x0, x1, 0, top, z0, z1, color, { shadow: false });
    // Square loop (corners belong to the north/south strips so nothing overlaps).
    road(-64.5, 64.5, -44.5, -35.5);
    road(-64.5, 64.5, 35.5, 44.5);
    road(-64.5, -55.5, -35.5, 35.5);
    road(55.5, 64.5, -35.5, 35.5);
    // Exits: west toward the county road, north toward the Bypass.
    road(-130, -64.5, -4.5, 4.5);
    road(-4.5, 4.5, -210, -44.5);

    // Double yellow center lines.
    const line = (x0: number, x1: number, z0: number, z1: number) =>
      this.box(x0, x1, top, top + 0.005, z0, z1, COLORS.line, { shadow: false, roughness: 0.6 });
    for (const z of [-40, 40]) {
      line(-55, 55, z - 0.2, z - 0.08);
      line(-55, 55, z + 0.08, z + 0.2);
    }
    for (const x of [-60, 60]) {
      line(x - 0.2, x - 0.08, -35, 35);
      line(x + 0.08, x + 0.2, -35, 35);
    }
    line(-128, -70, -0.2, -0.08);
    line(-128, -70, 0.08, 0.2);
    line(-0.2, -0.08, -205, -50);
    line(0.08, 0.2, -205, -50);

    // Sidewalks with real 15 cm curbs (wheels bump over them).
    const walk = (x0: number, x1: number, z0: number, z1: number) =>
      this.box(x0, x1, 0, 0.15, z0, z1, COLORS.sidewalk, { collider: true, shadow: false });
    // Inner ring around the courthouse lawn.
    walk(-55.5, 55.5, -35.5, -32.5);
    walk(-55.5, 55.5, 32.5, 35.5);
    walk(-55.5, -52.5, -32.5, 32.5);
    walk(52.5, 55.5, -32.5, 32.5);
    // Outer ring in front of the storefronts, with gaps for the exits.
    walk(-67.5, -4.5, -47.5, -44.5);
    walk(4.5, 67.5, -47.5, -44.5);
    walk(-67.5, 67.5, 44.5, 47.5);
    walk(64.5, 67.5, -44.5, 44.5);
    walk(-67.5, -64.5, -44.5, -4.5);
    walk(-67.5, -64.5, 4.5, 44.5);
  }

  private square(): void {
    // Lawn, slightly below the sidewalk so the curb reads.
    this.box(-52.5, 52.5, 0, 0.1, -32.5, 32.5, COLORS.lawn, { collider: true, shadow: false });

    // Bascom County Courthouse: main block, portico, clock tower.
    const c = COLORS.courthouse;
    this.box(-17, 17, 0, 14, -11, 11, c, { collider: true });
    this.box(-18, 18, 14, 15, -12, 12, c);                       // cornice
    this.box(-8, 8, 0, 1.2, 11, 16, c, { collider: true });      // steps
    for (let i = 0; i < 6; i++) this.cylinder(-6.5 + i * 2.6, 14.5, 1.2, 10.5, 0.55, c, true);
    this.box(-8, 8, 11.7, 13.4, 11, 15.5, c);                    // portico beam
    const gable = new THREE.Shape([new THREE.Vector2(-8.6, 0), new THREE.Vector2(8.6, 0), new THREE.Vector2(0, 3)]);
    const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 4.5, bevelEnabled: false }), mat(c));
    pediment.position.set(0, 13.4, 11);
    pediment.castShadow = true;
    this.scene.add(pediment);
    this.box(-4, 4, 15, 27, -4, 4, c, { collider: true });       // tower
    for (const [x, z, ry] of [[0, 4.02, 0], [0, -4.02, Math.PI], [4.02, 0, Math.PI / 2], [-4.02, 0, -Math.PI / 2]]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), mat('#f6f2e6', 0.5));
      face.position.set(x, 23, z);
      face.rotation.y = ry;
      this.scene.add(face);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 6, 4), mat(COLORS.courthouseRoof));
    roof.position.set(0, 30, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    this.scene.add(roof);

    // Live oaks on the lawn.
    const trees: [number, number][] = [
      [-40, -24], [-26, -26], [26, -26], [40, -24], [-44, 0], [44, 0],
      [-40, 24], [-26, 26], [26, 26], [40, 24], [-30, 12], [30, -12],
    ];
    for (const [x, z] of trees) this.tree(x, z, 1);
  }

  private tree(x: number, z: number, scale: number): void {
    this.cylinder(x, z, 0, 4 * scale, 0.35 * scale, COLORS.trunk, true);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6 * scale, 1), mat(COLORS.canopy));
    canopy.position.set(x, 6 * scale, z);
    canopy.scale.set(1.25, 0.8, 1.25);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    this.scene.add(canopy);
  }

  private async downtownRows(): Promise<void> {
    const templates = Object.fromEntries(
      await Promise.all(
        Object.entries(BUILDING_MODELS).map(async ([k, url]) => [k, await loadTemplate(url)] as const),
      ),
    ) as Record<keyof typeof BUILDING_MODELS, THREE.Group>;

    let pattern = 0;
    const place = (along: number, line: number, axis: 'x' | 'z', yaw: number, key: keyof typeof BUILDING_MODELS) => {
      const b = instantiate(templates[key]);
      if (axis === 'x') b.position.set(along, 0, line);
      else b.position.set(line, 0, along);
      b.rotation.y = yaw;
      this.scene.add(b);
      addStaticColliders(this.R, this.world, b);
      this.buildingCount++;
    };
    /** Fill [from, to] along one street edge with storefronts, facades on `line`. */
    const row = (from: number, to: number, line: number, axis: 'x' | 'z', yaw: number) => {
      let cursor = from;
      for (;;) {
        const key = ROW_PATTERN[pattern % ROW_PATTERN.length];
        const w = BUILDING_WIDTH[key];
        if (cursor + w > to) break;
        place(cursor + w / 2, line, axis, yaw, key);
        cursor += w;
        pattern++;
      }
    };
    // Facades face the square: north row faces +Z (yaw 0), south row -Z,
    // east row -X (yaw -90°), west row +X (yaw +90°).
    row(-67, -5, -47.5, 'x', 0);
    row(5, 67, -47.5, 'x', 0);
    row(-67, 67, 47.5, 'x', Math.PI);
    row(-44, 44, 67.5, 'z', -Math.PI / 2);
    row(-44, -5, -67.5, 'z', Math.PI / 2);
    row(5, 44, -67.5, 'z', Math.PI / 2);
  }

  private westOutskirts(): void {
    // Red clay county road with a jump at the end.
    this.box(-440, -130, 0, 0.025, -4, 4, COLORS.clay, { shadow: false, roughness: 1 });
    this.box(-470, -440, 0, 0.025, -30, 30, COLORS.clay, { shadow: false, roughness: 1 });

    const ramp = this.box(-6, 6, -0.3, 0.3, -4, 4, '#7a6a55');
    const angle = 0.22;
    ramp.position.set(-360, 6 * Math.sin(angle) - 0.25, 0);
    ramp.rotation.z = -angle; // rises toward -X, the direction you drive out of town
    const q = ramp.quaternion;
    this.world.createCollider(
      this.R.ColliderDesc.cuboid(6, 0.3, 4)
        .setTranslation(ramp.position.x, ramp.position.y, ramp.position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );

    // Power poles along the county road.
    for (let x = -140; x > -440; x -= 40) {
      this.cylinder(x, 9, 0, 10, 0.16, COLORS.pole, true);
      this.box(x - 0.1, x + 0.1, 9.0, 9.2, 7.6, 10.4, COLORS.pole, { shadow: true });
    }

    // Pine stands along the road.
    for (let i = 0; i < 40; i++) {
      const x = -150 - ((i * 53) % 280);
      const side = i % 2 === 0 ? 1 : -1;
      const z = side * (18 + ((i * 37) % 60));
      this.pine(x, z, 0.8 + ((i * 7) % 5) * 0.12);
    }

    // Water tower.
    for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) this.cylinder(-150 + dx, -90 + dz, 0, 26, 0.4, COLORS.tower, true);
    this.cylinder(-150, -90, 26, 9, 7, COLORS.tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(7.2, 3, 20), mat(COLORS.tower));
    cap.position.set(-150, 36.5, -90);
    cap.castShadow = true;
    this.scene.add(cap);

    // A stack of SaveMore boxes to drive through.
    const size = 0.9;
    for (let layer = 0; layer < 4; layer++) {
      for (let i = 0; i < 4 - layer; i++) {
        this.crate(-112, size / 2 + layer * size, -1.6 + i * size + layer * size * 0.5, size);
      }
    }
  }

  private pine(x: number, z: number, s: number): void {
    this.cylinder(x, z, 0, 9 * s, 0.25 * s, COLORS.trunk, true);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6 * s, 9 * s, 7), mat('#34502b'));
    crown.position.set(x, 11 * s, z);
    crown.castShadow = true;
    this.scene.add(crown);
  }

  private crate(x: number, y: number, z: number, size: number): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(COLORS.crate));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(x, y, z));
    this.world.createCollider(this.R.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setDensity(60), body);
    this.props.push({ sync: new BodySync(body, mesh) });
  }

  private northToSaveMore(): void {
    // SaveMore Supercenter placeholder at the top of the north road.
    this.box(-90, 90, 0, 0.035, -330, -210, COLORS.asphaltLot, { shadow: false });
    for (let x = -84; x <= 84; x += 6) this.box(x - 0.06, x + 0.06, 0.035, 0.04, -300, -290, '#e8e4d8', { shadow: false });
    this.box(-70, 70, 0, 11, -400, -330, COLORS.saveMore, { collider: true });
    this.box(-70.2, 70.2, 8, 11, -330.2, -329.8, COLORS.saveMoreBand);
    this.box(-14, 14, 0, 4, -330.4, -329.9, '#2b3640');                // entrance glass
  }

  private skyline(): void {
    // Port Meridian on the northeast horizon: silhouettes only, no shadows or physics.
    const dir = new THREE.Vector3(0.62, 0, -0.78).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const center = dir.clone().multiplyScalar(1750);
    for (let i = 0; i < 34; i++) {
      const t = (i / 33 - 0.5) * 520;
      const h = 30 + ((i * 97) % 11) * 12 + (Math.abs(t) < 90 ? 70 : 0) + (i === 17 ? 60 : 0);
      const w = 18 + ((i * 31) % 4) * 8;
      const p = center.clone().addScaledVector(side, t).addScaledVector(dir, ((i * 41) % 5) * 30);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(COLORS.skyline, 0.8));
      mesh.position.set(p.x, h / 2, p.z);
      mesh.lookAt(p.x - dir.x, h / 2, p.z - dir.z);
      this.scene.add(mesh);
    }
  }
}
