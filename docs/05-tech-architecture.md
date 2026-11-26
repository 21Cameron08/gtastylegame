# 05 – Tech Architecture

## Engine: Godot 4 (recommended)

| | Godot 4 | Unreal 5 | Unity 6 |
| --- | --- | --- | --- |
| Cost | Free, MIT license | 5% royalty past $1M | Subscription tiers |
| Scenes and data in git | **Text** (`.tscn`, `.tres`): diffable, easy to edit by script or AI | Binary `.uasset` | YAML, hard to diff |
| Blender pipeline | Native glTF and `.blend` import, name-suffix import hints | FBX/glTF via plugins | FBX/glTF |
| Open-world tooling | Build our own streaming (moderate work) | Best in class (World Partition) | Middle |
| Iteration speed | Fast; small editor; GDScript hot reload | Slow compiles, heavy editor | Medium |
| Hardware needs | Low | High | Medium |

**Why Godot**: everything stays as text in git, so changes to scenes, missions,
and data can be scripted, reviewed, and generated (including by Claude). The
Blender → Godot path is the smoothest of the three. The cost is that we build
our own world streaming, which is well understood work at our map size.

Version: latest **Godot 4.x stable** at project start, pinned in
`project.godot` and CI. Physics: **Jolt** (built into Godot 4.4+).
Language: **GDScript** first; C# or GDExtension (C++) only for hot spots that
profiling proves need it.

## Project layout (planned)

```
game/
  project.godot
  core/          Autoloads: GameState, EventBus, SaveSystem, TimeOfDay, Economy, Heat
  player/        Character controller, camera rigs, animation tree
  vehicles/      Vehicle controller, vehicle definitions (.tres), audio
  weapons/       Weapon logic, weapon definitions (.tres)
  npc/           Pedestrian AI, reactions, spawner
  traffic/       Lane graph, traffic AI, signals
  missions/      Mission framework + one folder per mission
  economy/       Shops, financing, credit, properties
  ui/            HUD, minimap, phone, menus
  world/         Cell scenes, streamer, road network, skyline backdrop
  assets/        Imported .glb, textures, audio (Git LFS)
blender/
  src/           .blend source files (Git LFS)
  scripts/       bpy generators, batch exporters, validators
tools/           CI scripts, headless import/test runners
```

## Core architecture

- **Autoload singletons** for global state (`GameState`, `EventBus`, `Economy`,
  `Heat`, `TimeOfDay`, `SaveSystem`). Systems talk through `EventBus` signals,
  not direct references.
- **Data-driven definitions** as Godot Resources: `VehicleDef`, `WeaponDef`,
  `ShopItemDef`, `PropertyDef`, `MissionDef`. Designers tune `.tres` files, not code.
- **Mission framework**: `MissionDef` lists objectives built from a library of
  objective types (GoTo, DriveTo, Chase, Kill, Escort, Collect, Deliver,
  SurviveHeat, Timer, Dialogue). Each mission can attach a script for bespoke logic.
- **Save system**: JSON snapshot of `GameState` (money, credit, owned vehicles
  and properties, mission flags, time, weather, position).

## World streaming

The map is split into a grid of **cells (250 m × 250 m)**. Each cell is its own
scene containing terrain, buildings, props, and spawn points.

- A `WorldStreamer` loads cells within a radius of the player using
  `ResourceLoader.load_threaded_request`, and unloads cells that fall out of range.
- **Far LOD**: each cell has a merged low-poly "HLOD" mesh shown beyond the
  streaming radius, using Godot visibility ranges.
- **Skyline**: Port Meridian is a single impostor mesh at the horizon until Act 3.
- **Precision**: at about 3 × 3 km, single-precision floats are fine. If the
  playable world grows past roughly 8 km across, revisit (origin shifting or a
  double-precision build).

## Road network (single source of truth)

Roads are authored once as a graph (nodes = intersections, edges = road segments
with lane counts and speed limits). From that one dataset we generate:

1. Road meshes, sidewalks, and markings
2. The traffic lane graph and intersection rules
3. GPS routing for the minimap
4. Pedestrian navigation along sidewalks
5. Police dispatch routes

Authoring tool (Blender curves vs. a Godot editor plugin) is decided in
milestone M0; see [08](08-decisions.md).

## Performance targets

- 60 fps at 1080p on a mid-range PC (GTX 1660 / RTX 2060 class).
- Shared trim-sheet and palette materials so many objects batch together.
- `MultiMeshInstance3D` for trees, grass, fences, power poles.
- Godot's built-in occlusion culling in town; auto-generated mesh LODs on import.
- Budget: ≤ 40 traffic vehicles and ≤ 60 pedestrians active near the player.

## Testing & CI

- Headless Godot in CI: import every asset, run unit tests (GUT or gdUnit4),
  load each world cell, and fail on errors.
- Headless Blender in CI: run asset validators (naming, scale, triangle budgets)
  and re-export changed `.blend` files.
- Git LFS for binaries; `.godot/` cache is never committed.
