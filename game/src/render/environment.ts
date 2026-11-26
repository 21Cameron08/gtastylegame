import * as THREE from 'three/webgpu';

/** Humid late-afternoon haze: warm low sun, red-clay bounce light, long fog. */
const HAZE = new THREE.Color('#d6cfbd');
const ZENITH = new THREE.Color('#87acd6');
const GROUND_BOUNCE = new THREE.Color('#8a5a3c');
const SUN_DIR = new THREE.Vector3(-0.55, 0.62, 0.42).normalize();
const SHADOW_RANGE = 70;
const SKY_RADIUS = 4500;

/** Sphere with a vertical color gradient: haze at the horizon, blue overhead, clay below. */
function skyDome(radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / radius;
    if (t >= 0) c.copy(HAZE).lerp(ZENITH, Math.pow(t, 0.55));
    else c.copy(HAZE).lerp(GROUND_BOUNCE, Math.min(1, -t * 3));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

export class Environment {
  readonly sun: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;

  constructor(scene: THREE.Scene, renderer: THREE.WebGPURenderer) {
    scene.background = HAZE.clone();
    scene.fog = new THREE.Fog(HAZE.clone(), 90, 2600);

    // Reflections for paint, chrome, and glass come from a blurred copy of the sky.
    const envScene = new THREE.Scene();
    envScene.add(skyDome(10));
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.sky = skyDome(SKY_RADIUS);
    scene.add(this.sky);

    scene.add(new THREE.HemisphereLight('#cfe0f5', '#8a5a3c', 0.7));

    const sun = new THREE.DirectionalLight('#ffe0b0', 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.left = -SHADOW_RANGE;
    cam.right = SHADOW_RANGE;
    cam.top = SHADOW_RANGE;
    cam.bottom = -SHADOW_RANGE;
    cam.near = 1;
    cam.far = 500;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    this.sun = sun;
  }

  /** Keep the sky around the camera and the shadow area centered on the player. */
  follow(focus: THREE.Vector3, camera: THREE.Camera): void {
    this.sky.position.copy(camera.position);
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(SUN_DIR, 200);
  }
}
