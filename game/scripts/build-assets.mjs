// Build all scripted assets: run every Blender generator headless, then
// compress the exported .glb files (meshopt) into public/assets/.
//
// usage: npm run assets            (BLENDER=/path/to/blender to override)

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const generatorsDir = join(repo, 'blender', 'scripts', 'generators');
const outDir = join(repo, 'game', 'public', 'assets');
const blender = process.env.BLENDER || 'blender';

function listGlb(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? listGlb(p) : p.endsWith('.glb') ? [p] : [];
  });
}

const rawDir = mkdtempSync(join(tmpdir(), 'redclay-raw-'));
try {
  const generators = readdirSync(generatorsDir).filter((f) => f.startsWith('gen_') && f.endsWith('.py'));
  for (const gen of generators) {
    console.log(`[assets] blender: ${gen}`);
    execFileSync(
      blender,
      ['-b', '--factory-startup', '--python-exit-code', '1', '-P', join(generatorsDir, gen), '--', '--out', rawDir],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
  }

  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

  let total = 0;
  for (const rawPath of listGlb(rawDir)) {
    const rel = relative(rawDir, rawPath);
    const outPath = join(outDir, rel);
    mkdirSync(dirname(outPath), { recursive: true });
    const doc = await io.read(rawPath);
    // keepLeaves: gameplay markers are empty leaf nodes and must survive.
    await doc.transform(dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(outPath, doc);
    const kb = statSync(outPath).size / 1024;
    total += kb;
    console.log(`[assets] ${rel}  ${statSync(rawPath).size / 1024 | 0} KB -> ${kb.toFixed(1)} KB`);
  }
  console.log(`[assets] done: ${total.toFixed(1)} KB total`);
} finally {
  rmSync(rawDir, { recursive: true, force: true });
}
