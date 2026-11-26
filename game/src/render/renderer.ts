import * as THREE from 'three/webgpu';

export type Backend = 'WebGPU' | 'WebGL 2';

/**
 * WebGPU when the browser has it, WebGL 2 otherwise (or when forced with
 * ?renderer=webgl, which is how tests exercise the fallback path).
 */
export async function createRenderer(canvas: HTMLCanvasElement, forceWebGL: boolean) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  await renderer.init();
  const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  const backend: Backend = isWebGPU ? 'WebGPU' : 'WebGL 2';
  return { renderer, backend };
}

export function fitToWindow(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
