# 05 – Tech Architecture

## Target: browser first

- **Play from a link, no install.** Desktop Chrome, Edge, and Firefox (current
  versions). Safari is best effort. Mobile is out of scope for v1.
- Keyboard and mouse (Pointer Lock API) plus gamepad (Gamepad API).
- A desktop app can come later by wrapping the same code (Electron or Tauri).

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** | Type safety across a large codebase |
| Build / dev server | **Vite** | Instant reload in development, small production bundles |
| Rendering | **Three.js `WebGPURenderer`** | WebGPU where the browser has it, automatic WebGL 2 fallback; one shader language (TSL) for both |
| Physics | **Rapier** (`@dimforge/rapier3d-compat`, WebAssembly) | Built-in ray-cast vehicle controller and kinematic character controller; fast |
| Navigation | **recast-navigation-js** | Navmeshes for pedestrians and police on foot |
| Audio | **Web Audio** (via Three.js positional audio) | 3D engine and gun sounds, radio stations |
| UI | **HTML/CSS overlay** (plain DOM, Preact if it grows) | HUD, map, phone, and menus are easier and sharper as web UI |
| Assets | **glTF 2.0 (`.glb`)**, meshopt-compressed geometry, KTX2 textures | Small downloads, low GPU memory |
| Tests | **Vitest** (game logic), **Playwright** (in-browser smoke and screenshot tests) | Both run in CI and in Claude's cloud environment |

**WebGPU vs. WebGL 2**: every build must work on both. Anything
gameplay-critical avoids WebGPU-only features such as compute shaders.
WebGPU-only extras are allowed as optional quality settings.

## Project layout (planned)

```
game/
  index.html
  package.json, vite.config.ts, tsconfig.json
  src/
    main.ts        Boot, renderer setup, game loop
    core/          Event bus, input, save, time of day, settings
    render/        Materials, sky and weather, post-processing, LOD
    physics/       Rapier world, collider building from glTF
    world/         Cell streamer, road network, skyline backdrop
    player/        Character controller, camera rigs, animation
    vehicles/      Vehicle controller, damage, vehicle audio
    weapons/       Weapon logic, projectiles, hit reactions
    npc/           Pedestrian AI, reactions, spawning
    traffic/       Lane graph, traffic AI, signals
    heat/          Police response and pursuit
    economy/       Shops, financing, credit score, properties
    missions/      Mission framework + one folder per mission
    audio/         Mixer, radio stations
    ui/            HUD, minimap, map, phone, menus (DOM)
  data/            Vehicle, weapon, shop, property, mission definitions
  public/assets/   Compressed .glb, .ktx2, audio (Git LFS)
  tests/           Vitest unit tests
  e2e/             Playwright browser tests
blender/
  src/             .blend source files (Git LFS)
  scripts/         bpy generators, exporters, validators
game/scripts/      Asset build: Blender generators -> compressed .glb
```

## Core architecture

- **Game loop**: fixed 60 Hz simulation step (physics, AI, gameplay) with
  rendering at the display's refresh rate, interpolated between steps.
- **Systems + event bus**: each system (Heat, Economy, Traffic, Missions, ...)
  is a module with an `update(dt)`. Systems talk through a typed event bus, not
  direct references.
- **Entities**: a lightweight entity-component setup for things that come in
  numbers (pedestrians, traffic, projectiles, pickups). The player and the
  driven vehicle are plain classes on top of it.
- **Data-driven definitions**: vehicles, weapons, shop items, properties, and
  missions are typed data files, validated at build time. Tuning a car means
  editing data, not code.
- **Mission framework**: each mission is a list of objectives built from a
  shared library (GoTo, DriveTo, Chase, Kill, Escort, Collect, Deliver,
  SurviveHeat, Timer, Dialogue), plus an optional script for bespoke logic.
- **Save system**: stored in the browser's IndexedDB, with export/import to a
  file so saves can't be lost by clearing browser data. Autosave after missions.
- **Settings**: quality presets (shadows, draw distance, traffic density,
  resolution scale), auto-picked by a quick benchmark on first launch.

## World streaming

The map is split into **250 m × 250 m cells**. Each cell is made of:

1. A `.glb` with its unique geometry (terrain, roads, one-off structures)
2. A placement manifest (JSON) listing kit and prop instances: asset ID + transform
3. Collider data and gameplay markers (spawns, doors, mission points)

**Shared kits** (brick storefronts, houses, props, trees) download once and are
reused by every cell as instanced meshes, so each cell's own download stays small.

- Cells load in a ring around the player, prioritized by direction and speed of
  travel. Far cells are unloaded and their GPU memory released (browsers punish leaks).
- **Far LOD**: each cell has a merged low-poly mesh shown beyond the load ring.
- **Skyline**: Port Meridian is one impostor mesh on the horizon until Act 3.
- Texture and mesh decoding runs in Web Workers so streaming doesn't stutter.
- The browser cache (later a service worker) keeps returning players from
  downloading everything again.
- **Download budgets**: playable after ≤ 25 MB; a typical cell ≤ 2 MB.
- **Precision**: at about 3 × 3 km, 32-bit floats are fine.

## Road network (single source of truth)

Roads are authored in **Blender** as a curve/edge graph (nodes = intersections,
edges = segments with lane counts and speed limits). An export script writes the
graph to JSON and generates the road meshes. From that one dataset we get:

1. Road meshes, sidewalks, and markings
2. The traffic lane graph and intersection rules
3. GPS routing for the minimap
4. Pedestrian navigation along sidewalks
5. Police dispatch routes

## Performance targets

- **60 fps at 1080p** in Chrome on a mid-range desktop GPU (GTX 1660 / RTX 2060 class).
- **30+ fps** on integrated laptop graphics at the Low preset.
- Under ~1,000 draw calls per frame (instancing, shared trim-sheet materials).
- ≤ 30 traffic vehicles and ≤ 40 pedestrians active near the player.
- ≤ 1.5 GB GPU memory at the High preset.

## Build, test, deploy

- **CI (GitHub Actions)** on every push (`.github/workflows/ci.yml`):
  - Headless Blender runs every asset generator, validates, and compresses with glTF-Transform
  - Typecheck and Vitest unit tests (including vehicle physics in Node)
  - Production build
  - Playwright smoke tests in headless Chromium, once on WebGPU and once on the
    forced WebGL 2 fallback: the game boots, renders, drives, and logs no errors
- **Testing WebGPU without a GPU**: headless screenshots can't see a WebGPU
  canvas, so the game exposes `window.__game.capture()`, which renders the view
  offscreen and returns a PNG. On Chromium's software WebGPU adapter (CI) pixel
  readback is unreliable, so CI checks pixels on WebGL 2 and boot/drive/errors on
  WebGPU; WebGPU pixels are checked where a GPU is available (`WEBGPU_READBACK=1`).
- **Deploy**: each push to the main branch publishes a playable build at a link.
  CI checks out Git LFS files so the site gets real assets, not LFS pointers.
- **Hosting**: decided in M0 (GitHub Pages if the repo is public, otherwise
  itch.io or Cloudflare Pages). The build is single-threaded, so no special
  server headers are needed.
