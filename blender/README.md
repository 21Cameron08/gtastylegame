# blender/

Blender is the content tool and level editor. Conventions are in
[docs/06-blender-pipeline.md](../docs/06-blender-pipeline.md).

```
scripts/
  generators/   gen_*.py: each builds assets from code and exports .glb
  redclay/      Shared helpers (materials, box builder, export) and validation rules
  validate.py   Validate a hand-made .blend against the pipeline rules
  preview.py    Render preview images of exported assets (Cycles, CPU)
src/            Hand-authored .blend files (Git LFS)
```

Generators today: storefronts (4 variants), courthouse, SaveMore, water tower,
live oaks and loblolly pines, power pole, Port Meridian skyline, the work
pickup, and Trip (blockout).

Build every scripted asset (runs all generators headless, validates,
compresses into `game/public/assets/`):

```bash
cd game && npm run assets
```

Preview assets (after `npm run assets`, or point it at any .glb):

```bash
blender -b --factory-startup -P blender/scripts/preview.py -- preview.png game/public/assets/buildings/BLD_Courthouse.glb
```

Validate a hand-made file:

```bash
blender -b blender/src/<file>.blend --python-exit-code 1 -P blender/scripts/validate.py -- --kind vehicle
```

Blender is pinned to **4.0.2** (Ubuntu 24.04's package), the version used by
the cloud dev environment and CI.
