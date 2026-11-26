# 08 – Decisions & Open Questions

## Proposed (need your sign-off)

| # | Decision | Proposal | Alternatives |
| --- | --- | --- | --- |
| D1 | Engine | **Godot 4** (latest stable, pinned) | Unreal 5, Unity 6 |
| D3 | Platform | **PC first** (Windows + Linux) | Consoles later |
| D4 | Asset sources | Blender (scripted + hand-made) plus CC0 placeholders (Kenney, Quaternius, Poly Haven) during prototyping | Paid asset packs |
| D5 | Rating / tone | **Mature**: violence, crime, language; satire aimed at systems, not at locals | Toned down |
| D6 | Protagonist | Fixed protagonist (Trip Hollins) | Custom character |

## Open questions

1. **Browser play**: should the game (or a demo) run in a web browser? This
   affects the engine's renderer choice and asset budgets. See D1.
2. **Road-network authoring**: Blender curves exported to JSON, or a custom
   Godot editor tool? (Decide in M0 after a quick prototype of each.)
3. **Music**: original or commissioned music, or licensed tracks?
4. **Hardware**: what GPU will you develop and test on? It sets the performance baseline.

## Decision log

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-11-26 | Plan drafted | |
| 2026-11-26 | Art style: **stylized-realistic** | Real proportions, simplified detail, strong lighting and color |
| 2026-11-26 | Team: **owner + Claude** | No other contributors for now |
| 2026-11-26 | Blender: **Claude's headless Blender in the cloud** (scripted mode) | Upgrade from 4.0.2 to a current LTS and pin it during M0 |
| 2026-11-26 | Names: **keep working names**; setting is a **generic fictional Southeastern state** | RED CLAY, Cane Creek, Bascom County, Port Meridian, Trip Hollins, SaveMore |
