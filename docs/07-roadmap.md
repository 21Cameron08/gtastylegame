# 07 – Roadmap

Each milestone ends with a playable build and a clear "done when." Later
milestones get re-planned once the earlier ones teach us how fast we actually move.

## M0: Foundation
Set up the tools so everything after this is fast.
- Godot project, folder structure, autoload skeletons
- Blender scripts: export, validate, first modular-kit generator
- Git LFS, CI (headless Godot import and tests, Blender validation)
- Decide the road-network authoring tool
- Greybox test map: flat terrain, a few boxes, one road loop

**Done when**: a scripted Blender asset lands in a running Godot scene through
CI with no manual steps.

## M1: Walk & Drive
The two feelings everything else rests on.
- Third-person character controller and camera
- Vehicle controller (pickup + sedan), enter/exit, surfaces (asphalt, dirt, grass)
- Greybox Downtown Square and the Bypass at true scale
- Day/night cycle, basic minimap

**Done when**: driving a pickup around the square and down a dirt road is fun
for 10 minutes with nothing else to do.

## M2: Guns & Heat
- Pistol, shotgun, bat; health and armor; weapon wheel
- Pedestrians: wander, react, flee, fight
- Heat levels 1–3 with sheriff cruisers that pursue on roads
- CHECKED OUT and PROCESSED flows with bills and fees

**Done when**: causing trouble downtown produces a believable escalation that
you can escape.

## M3: Vertical Slice (~1 km²)
One small piece of the game at near-final quality.
- Downtown Square and the Bypass with real art kits
- Traffic on the lane graph, signals, GPS routing
- Shops: SaveMore, Liberty Arms, Big Earl's (financing + repo), diner (food/save)
- Money, credit score, save/load
- Missions 1–5 from Act 1
- Two radio stations, Port Meridian skyline on the horizon

**Done when**: a new player can play 45 minutes, understand the game, and want more.

## M4: Cane Creek Complete (~9 km²)
- All districts and the outskirts (procedural forest/farm scatter)
- World streaming and HLODs
- All of Act 1 plus side activities: repo jobs, moonshine runs, racing, DashDash
- More vehicles and weapons, mod shop, properties

**Done when**: Act 1 is playable start to finish.

## M5: Bascom County (Act 2)
- Remaining county content, Heat 4–5 (helicopter, tactical team)
- Act 2 missions including the bank heist at the county fair
- NPC schedules, more radio, phone apps

**Done when**: Act 2 is playable start to finish.

## M6: Port Meridian (Act 3)
- The city as a playable district, the I-48 bridge opens
- Act 3 missions and the finale

**Done when**: the game is playable start to finish.

## First concrete steps (after the plan is approved)
1. Lock decisions in [08](08-decisions.md): engine, art style, Blender version, names.
2. Create the Godot project skeleton and the `blender/scripts/` export and validate scripts.
3. Generate the first modular kit (brick downtown storefronts) and import it.
4. Greybox the square and start the vehicle controller.
