# RED CLAY (working title)

An original open-world crime game set in a small Southeastern US town, with a
mid-size city on the horizon. Cars, guns, missions, and a satirical take on
consumerism and debt.

> Status: **planning / pre-production**. Nothing playable yet.

## Plan documents

| Doc | What it covers |
| --- | --- |
| [01 – Vision & Pillars](docs/01-vision-and-pillars.md) | What the game is, tone, what makes it ours |
| [02 – World & Map](docs/02-world-and-map.md) | Cane Creek, Bascom County, Port Meridian; districts and landmarks |
| [03 – Gameplay Systems](docs/03-gameplay-systems.md) | On-foot, driving, guns, heat/police, economy, NPCs, UI |
| [04 – Story & Missions](docs/04-story-and-missions.md) | Protagonist, factions, three-act outline, Act 1 mission list |
| [05 – Tech Architecture](docs/05-tech-architecture.md) | Engine, project layout, world streaming, data-driven design |
| [06 – Blender Pipeline](docs/06-blender-pipeline.md) | Asset conventions, scripted generation, export to the engine |
| [07 – Roadmap](docs/07-roadmap.md) | Milestones from greybox to the city, with exit criteria |
| [08 – Decisions & Open Questions](docs/08-decisions.md) | What's decided, what's pending |

## Repository layout (planned)

```
blender/      Blender source files (.blend) and Python generator/export scripts
game/         Godot 4 project (scenes, scripts, imported assets)
docs/         Design and technical documentation
tools/        CI and helper scripts
```

Binary assets (`.blend`, `.glb`, textures, audio) are stored with **Git LFS**;
see `.gitattributes`.
