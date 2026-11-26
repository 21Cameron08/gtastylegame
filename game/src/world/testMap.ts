import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { BodySync } from '../physics/bodySync';
import { addStaticColliders, instantiate, loadTemplate } from './assets';
import { addInstanceColliders, instanceTemplate, markerPositions, placementMatrix, seededRandom } from './placement';
import { buildPowerLines } from './powerLines';

type Rapier = typeof RAPIER;

/**
 * M0 greybox of Cane Creek: the courthouse square ringed by storefronts, a road
 * north to the SaveMore lot, a red clay county road west with a jump, pine woods,
 * the water tower, and the Port Meridian skyline in the haze.
 *
 * Buildings, trees, poles, and the skyline are Blender assets (blender/scripts/
 * generators). Roads, sidewalks, the lawn, the ramp, and the crates are still
 * built here until the road network moves to Blender.
 *
 * Coordinates: meters, +Y up. The square's road loop centerline is x = ±60, z = ±40.
 */

const ASSETS = {
  storeA: 'assets/buildings/BLD_Storefront_8m_A.glb',
  storeB: 'assets/buildings/BLD_Storefront_8m_B.glb',
  storeC: 'assets/buildings/BLD_Storefront_12m_C.glb',
  storeD: 'assets/buildings/BLD_Storefront_8m_D.glb',
  courthouse: 'assets/buildings/BLD_Courthouse.glb',
  waterTower: 'assets/buildings/BLD_WaterTower.glb',
  saveMore: 'assets/buildings/BLD_SaveMore.glb',
  oakA: 'assets/foliage/FOL_LiveOak_A.glb',
  oakB: 'assets/foliage/FOL_LiveOak_B.glb',
  pineA: 'assets/foliage/FOL_Pine_A.glb',
  pineB: 'assets/foliage/FOL_Pine_B.glb',
  pole: 'assets/props/PRP_PowerPole.glb',
  skyline: 'assets/skyline/SKY_PortMeridian.glb',
} as const;
type AssetKey = keyof typeof ASSETS;

const STORE_WIDTH: Record<'storeA' | 'storeB' | 'storeC' | 'storeD', number> = { storeA: 8, storeB: 8, storeC: 12, storeD: 8 };
const ROW_PATTERN = ['storeA', 'storeB', 'storeD', 'storeC', 'storeB', 'storeA', 'storeC', 'storeD'] as const;

const COLORS = {
  grass: '#6c7642',
  lawn: '#5f7a3a',
  asphalt: '#3a3b3d',
  asphaltLot: '#45464a',
  line: '#d9b23a',
  stall: '#e8e4d8',
  sidewalk: '#b9b4a8',
  clay: '#a4552f',
  ramp: '#7a6a55',
  crate: '#b08a5a',
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

/** Keep scattered trees off roads, lots, and buildings. */
const CLEARINGS: [number, number, number, number][] = [
  [-130, 130, -60, 60],      // downtown and the square
  [-12, 12, -215, -40],      // north road
  [-100, 100, -410, -205],   // SaveMore and its lot
  [-480, -120, -12, 16],     // county road and power line
  [-170, -130, -110, -70],   // water tower
  [-480, -430, -40, 40],     // turnaround
];
const inClearing = (x: number, z: number) => CLEARINGS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);

export class TestMap {
  /** Where the truck starts, facing the square along the county road. */
  readonly vehicleSpawn = { position: new THREE.Vector3(-92, 0.4, 0), yaw: Math.PI / 2 };
  /** Where Trip starts: beside the truck's driver door, facing the square. */
  readonly playerSpawn = { position: new THREE.Vector3(-90.5, 1.0, -2.8), yaw: Math.PI / 2 };
  private readonly props: BodySync[] = [];
  private templates = {} as Record<AssetKey, THREE.Group>;
  buildingCount = 0;

  private constructor(
    private readonly R: Rapier,
    private readonly world: RAPIER.World,
    private readonly scene: THREE.Scene,
  ) {}

  static async build(R: Rapier, world: RAPIER.World, scene: THREE.Scene): Promise<TestMap> {
    const map = new TestMap(R, world, scene);
    const entries = await Promise.all(
      (Object.keys(ASSETS) as AssetKey[]).map(async (k) => [k, await loadTemplate(ASSETS[k])] as const),
    );
    map.templates = Object.fromEntries(entries) as Record<AssetKey, THREE.Group>;
    map.ground();
    map.roads();
    map.square();
    map.downtownRows();
    map.westOutskirts();
    map.woods();
    map.northToSaveMore();
    map.skyline();
    return map;
  }

  afterStep(): void {
    for (const p of this.props) p.capture();
  }

  render(alpha: number): void {
    for (const p of this.props) p.apply(alpha);
  }

  // ---------------------------------------------------------------- helpers

  /** One copy of an asset, with its colliders. */
  private placeOne(key: AssetKey, x: number, z: number, yaw = 0): THREE.Object3D {
    const obj = instantiate(this.templates[key]);
    obj.position.set(x, 0, z);
    obj.rotation.y = yaw;
    this.scene.add(obj);
    addStaticColliders(this.R, this.world, obj);
    return obj;
  }

  /** Many copies of an asset as instanced meshes, with colliders for each. */
  private placeMany(key: AssetKey, placements: THREE.Matrix4[], { colliders = true, shadows = true } = {}): void {
    if (placements.length === 0) return;
    this.scene.add(instanceTemplate(this.templates[key], placements, shadows));
    if (colliders) addInstanceColliders(this.R, this.world, this.templates[key], placements);
  }

  /** Box from min/max corners; optional fixed collider. */
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
    walk(-55.5, 55.5, -35.5, -32.5);
    walk(-55.5, 55.5, 32.5, 35.5);
    walk(-55.5, -52.5, -32.5, 32.5);
    walk(52.5, 55.5, -32.5, 32.5);
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
    // Bascom County Courthouse, portico facing south.
    this.placeOne('courthouse', 0, 0, 0);
    this.buildingCount++;

    // Live oaks on the lawn, varied by rotation and size.
    const spots: [number, number][] = [
      [-40, -24], [-26, -26], [26, -26], [40, -24], [-44, 0], [44, 0],
      [-40, 24], [-24, 26], [24, 26], [40, 24], [-31, 10], [31, -10],
    ];
    const rand = seededRandom(17);
    const oaks: Record<'oakA' | 'oakB', THREE.Matrix4[]> = { oakA: [], oakB: [] };
    spots.forEach(([x, z], i) => {
      oaks[i % 2 === 0 ? 'oakA' : 'oakB'].push(placementMatrix(x, 0.1, z, rand() * Math.PI * 2, 0.9 + rand() * 0.25));
    });
    this.placeMany('oakA', oaks.oakA);
    this.placeMany('oakB', oaks.oakB);
  }

  private downtownRows(): void {
    const placements: Record<(typeof ROW_PATTERN)[number], THREE.Matrix4[]> = { storeA: [], storeB: [], storeC: [], storeD: [] };
    let pattern = 0;
    /** Fill [from, to] along one street edge with storefronts, facades on `line`. */
    const row = (from: number, to: number, line: number, axis: 'x' | 'z', yaw: number) => {
      let cursor = from;
      for (;;) {
        const key = ROW_PATTERN[pattern % ROW_PATTERN.length];
        const w = STORE_WIDTH[key];
        if (cursor + w > to) break;
        const along = cursor + w / 2;
        placements[key].push(axis === 'x' ? placementMatrix(along, 0, line, yaw) : placementMatrix(line, 0, along, yaw));
        cursor += w;
        pattern++;
        this.buildingCount++;
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
    for (const key of Object.keys(placements) as (keyof typeof placements)[]) this.placeMany(key, placements[key]);
  }

  private westOutskirts(): void {
    // Red clay county road with a turnaround and a jump.
    this.box(-440, -130, 0, 0.025, -4, 4, COLORS.clay, { shadow: false, roughness: 1 });
    this.box(-470, -440, 0, 0.025, -30, 30, COLORS.clay, { shadow: false, roughness: 1 });

    const ramp = this.box(-6, 6, -0.3, 0.3, -4, 4, COLORS.ramp);
    const angle = 0.22;
    ramp.position.set(-360, 6 * Math.sin(angle) - 0.25, 0);
    ramp.rotation.z = -angle; // rises toward -X, the direction you drive out of town
    const q = ramp.quaternion;
    this.world.createCollider(
      this.R.ColliderDesc.cuboid(6, 0.3, 4)
        .setTranslation(ramp.position.x, ramp.position.y, ramp.position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );

    // Power line along the county road. The pole's crossarm is across its
    // local X, so yaw 90° runs the wires along the road (world X).
    const poles: THREE.Matrix4[] = [];
    for (let x = -140; x >= -440; x -= 40) poles.push(placementMatrix(x, 0, 9, Math.PI / 2));
    this.placeMany('pole', poles);
    const wires = poles.map((p) => markerPositions(this.templates.pole, 'WIRE_', p));
    this.scene.add(buildPowerLines(wires));

    // The water tower, lettering turned toward the square.
    this.placeOne('waterTower', -150, -90, Math.atan2(150, 90));
    this.buildingCount++;

    // A stack of SaveMore boxes to drive through.
    const size = 0.9;
    for (let layer = 0; layer < 4; layer++) {
      for (let i = 0; i < 4 - layer; i++) {
        this.crate(-112, size / 2 + layer * size, -1.6 + i * size + layer * size * 0.5, size);
      }
    }
  }

  /** Loblolly pine woods around town (seeded, so the same on every load). */
  private woods(): void {
    const rand = seededRandom(42);
    const pines: Record<'pineA' | 'pineB', THREE.Matrix4[]> = { pineA: [], pineB: [] };
    const scatter = (count: number, x0: number, x1: number, z0: number, z1: number) => {
      for (let placed = 0, tries = 0; placed < count && tries < count * 10; tries++) {
        const x = x0 + rand() * (x1 - x0);
        const z = z0 + rand() * (z1 - z0);
        if (inClearing(x, z)) continue;
        const key = rand() < 0.5 ? 'pineA' : 'pineB';
        pines[key].push(placementMatrix(x, 0, z, rand() * Math.PI * 2, 0.85 + rand() * 0.35));
        placed++;
      }
    };
    scatter(110, -470, -135, -140, 140);   // along the county road
    scatter(70, 110, 320, -260, 260);      // east of downtown
    scatter(60, -130, 130, 90, 300);       // south of downtown
    scatter(40, -330, -110, -260, -150);   // northwest
    this.placeMany('pineA', pines.pineA);
    this.placeMany('pineB', pines.pineB);
  }

  private crate(x: number, y: number, z: number, size: number): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(COLORS.crate));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(x, y, z));
    this.world.createCollider(this.R.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setDensity(60), body);
    this.props.push(new BodySync(body, mesh));
  }

  private northToSaveMore(): void {
    // Parking lot with striped stalls, then the store with its facade facing the lot.
    this.box(-95, 95, 0, 0.035, -322, -210, COLORS.asphaltLot, { shadow: false });
    const stripes: THREE.Matrix4[] = [];
    for (const z of [-300, -270, -240]) {
      for (let x = -84; x <= 84; x += 3) {
        if (Math.abs(x) >= 6) stripes.push(placementMatrix(x, 0.0375, z)); // skip the drive aisle
      }
    }
    const stripe = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.005, 10), mat(COLORS.stall), stripes.length);
    stripes.forEach((m, i) => stripe.setMatrixAt(i, m));
    stripe.computeBoundingSphere();
    stripe.receiveShadow = true;
    this.scene.add(stripe);
    this.placeOne('saveMore', 0, -330, 0);
    this.buildingCount++;
  }

  private skyline(): void {
    // Port Meridian on the northeast horizon: a silhouette in the haze, no physics.
    const dir = new THREE.Vector3(0.62, 0, -0.78).normalize();
    const at = dir.clone().multiplyScalar(1750);
    this.placeMany('skyline', [placementMatrix(at.x, 0, at.z, Math.atan2(-dir.x, -dir.z))], { colliders: false, shadows: false });
  }
}
