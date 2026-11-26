# 08 – Decisions & Open Questions

## Proposed (need your sign-off)

| # | Decision | Proposal | Alternatives |
| --- | --- | --- | --- |
| D4 | Asset sources | Blender (scripted + hand-made) plus CC0 placeholders (Kenney, Quaternius, Poly Haven) during prototyping | Paid asset packs |
| D5 | Rating / tone | **Mature**: violence, crime, language; satire aimed at systems, not at locals | Toned down |
| D6 | Protagonist | Fixed protagonist (Trip Hollins) | Custom character |
| D7 | Road-network authoring | **Blender** curve/edge graph exported to JSON (Blender is already the level editor); prototype in M0 | Custom in-game editor |

## Open questions

1. **Hosting**: is the GitHub repo public or private? Public → free GitHub Pages
   for playable builds. Private → itch.io or Cloudflare Pages.
2. **Music**: original or commissioned music, or licensed tracks?
3. **Your hardware**: which computer and browser will you play builds on? It
   sets the performance baseline.

## Decision log

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-11-26 | Plan drafted | |
| 2026-11-26 | Art style: **stylized-realistic** | Real proportions, simplified detail, strong lighting and color |
| 2026-11-26 | Team: **owner + Claude** | No other contributors for now |
| 2026-11-26 | Blender: **Claude's headless Blender in the cloud** (scripted mode) | Upgrade from 4.0.2 to a current LTS and pin it during M0 |
| 2026-11-26 | Names: **keep working names**; setting is a **generic fictional Southeastern state** | RED CLAY, Cane Creek, Bascom County, Port Meridian, Trip Hollins, SaveMore |
| 2026-11-26 | Platform: **browser first** (desktop Chrome, Edge, Firefox; Safari best effort) | Mobile out of scope for v1; desktop app wrapper possible later |
| 2026-11-26 | Engine: **Three.js + TypeScript + Rapier**, built with Vite | Replaces the Godot proposal. Godot's browser builds are limited to its WebGL 2 renderer and a large upfront download; Three.js is web-native with WebGPU and a WebGL 2 fallback |
