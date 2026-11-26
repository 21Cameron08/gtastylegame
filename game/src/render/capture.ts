import * as THREE from 'three/webgpu';

/**
 * Render the scene into an offscreen target and return it as a PNG data URL.
 *
 * Used by automated tests: headless browsers can't screenshot a WebGPU canvas,
 * but they can read back an offscreen render. Render targets skip tone mapping
 * and sRGB output, so both are applied here by hand (ACES approximation).
 */
export async function captureFrame(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width = 640,
  height = 360,
): Promise<string> {
  const target = new THREE.RenderTarget(width, height, { type: THREE.HalfFloatType });
  const aspect = camera.aspect;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height);
  target.dispose();
  const isWebGL = (renderer.backend as { isWebGLBackend?: boolean }).isWebGLBackend === true;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const exposure = renderer.toneMappingExposure;
  const toByte = (linear: number) => {
    const x = linear * exposure;
    const mapped = Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
    const srgb = mapped <= 0.0031308 ? mapped * 12.92 : 1.055 * Math.pow(mapped, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  };
  const half = raw instanceof Uint16Array;
  const read = (i: number) => (half ? THREE.DataUtils.fromHalfFloat(raw[i]) : (raw[i] as number) / 255);
  for (let y = 0; y < height; y++) {
    // WebGL reads rows bottom-up; WebGPU top-down.
    const srcRow = isWebGL ? height - 1 - y : y;
    for (let x = 0; x < width; x++) {
      const s = (srcRow * width + x) * 4;
      const d = (y * width + x) * 4;
      image.data[d] = toByte(read(s));
      image.data[d + 1] = toByte(read(s + 1));
      image.data[d + 2] = toByte(read(s + 2));
      image.data[d + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
