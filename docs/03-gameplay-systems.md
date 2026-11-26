# 03 – Gameplay Systems

Each system lists an **MVP** (what the vertical slice needs) and **Later** (what
comes after). The roadmap in [07](07-roadmap.md) orders them.

## 1. Player on foot
- **MVP**: third-person walk/run/sprint, jump, crouch, vault low obstacles,
  melee (punch, bat), enter/exit vehicles, interact prompt.
- **Later**: cover system, climbing ladders and fences, swimming in the lake, stamina.

## 2. Camera
- **MVP**: orbit camera on foot, chase camera in vehicles, over-shoulder aim
  camera, collision so it doesn't clip through walls.
- **Later**: cinematic camera for cutscenes, hood/bumper cams.

## 3. Vehicles
Driving has to feel good before anything else ships.
- **MVP**: custom raycast-suspension vehicle controller (arcade-leaning: forgiving
  grip, handbrake slides on dirt), surface types (asphalt, dirt, grass, mud),
  one pickup truck and one sedan, basic damage (smoke, then fire, then explode),
  engine audio.
- **Later**: vehicle classes below, visual deformation, tire popping, mod shop
  (paint, wheels, lift kits, engine upgrades), boats on the lake and river,
  motorcycles and ATVs.

| Class | Examples (original designs) |
| --- | --- |
| Pickups | Work truck, lifted 4x4, rusted farm truck |
| Sedans | Grandma sedan, ex-cop cruiser |
| Muscle | Classic 70s V8, modern muscle |
| Sports | Import tuner, dealership's halo car |
| Utility | Tow truck (repo jobs), box van, semi |
| Emergency | Sheriff cruiser, state trooper interceptor, ambulance, fire truck |
| Two-wheel | Dirt bike, cruiser motorcycle |

## 4. Weapons & combat
- **MVP**: pistol, shotgun, bat; hitscan with tracers, ammo and reload, health
  and armor, hit reactions, weapon wheel.
- **Later**: revolver, hunting rifle (scoped), AR, SMG, tire iron, machete,
  throwables (Molotovs, fireworks!), drive-by shooting, lock-on assist.
- Bought at **Liberty Arms** (gun counter, range challenges). Ammo is a recurring
  cost.

## 5. Heat (police) system
Heat level 1–5, shown as sheriff badges.

| Heat | Response |
| --- | --- |
| 1 | Nearby deputy investigates |
| 2 | Multiple deputies, pursuit |
| 3 | State troopers, interceptors, roadblocks on main roads |
| 4 | State police helicopter, spike strips |
| 5 | Tactical team |

- **Rural twist**: response time scales with distance from the sheriff's office.
  Crime on a backroad is quiet for a while; crime on the square gets an
  immediate response.
- **Escape**: break line of sight and leave the search zone, then cool down. A
  paint shop clears it for a fee.
- **Busted → PROCESSED**: lose weapons, pay bail, take a credit score hit.
- **Death → CHECKED OUT**: wake at the hospital with an itemized bill.

## 6. Economy & consumerism (signature system)
Money is the core loop: earn it, spend it, owe it.

- **Income**: missions, side jobs, robberies, selling cars to the chop shop,
  pawning loot, gig-app deliveries, races, bounties.
- **Spending**: cars, guns and ammo, clothes, food (healing), properties, mod
  shop, bail, hospital bills, fines.
- **Credit score (300–850)**: rises with on-time payments, drops with missed
  payments, arrests, and hospital debt. Gates financing terms and property.
- **Financing & repo**: buy a car with a small down payment. Weekly in-game
  payments come out of your bank automatically. Miss them and a repo truck comes
  for the car; you can hide it, pay up, or fight.
- **SaveMore Rewards**: loyalty points with absurd perks; Black Friday event days
  with doorbuster chaos.
- **Properties**: motel room → trailer → house in Mill Village → lake house →
  (Act 3) city penthouse. Each is a safehouse, some produce income.
- **Ads everywhere**: billboards, radio spots, and phone notifications push you to
  spend. It's world-building, and occasionally a real deal.

## 7. NPCs & traffic
- **MVP**: pedestrians that wander sidewalks and react (flee, cower, fight back,
  call the sheriff); traffic that follows a lane graph, obeys signals and stop
  signs, and yields.
- **Later**: daily schedules (church on Sunday, diner breakfast rush, Friday-night
  football traffic), district-specific populations, NPCs who remember you (the
  diner waitress, the gas station clerk).

## 8. Missions & activities
- **Mission framework**: data-driven objectives (go to, drive to, chase, kill,
  escort, collect, deliver, survive Heat, timer), checkpoints, fail conditions,
  dialogue and cutscene triggers. Mission givers appear as letter icons on the map.
- **Side activities** (Southeastern flavor):
  - Repo jobs for Big Earl (tow truck)
  - Moonshine runs on backroads at night
  - Dirt-track and backroad street racing
  - Gig-app food delivery ("DashDash")
  - Bounty hunting for the bail bondsman
  - Fishing at Lake Tullis, hunting in the pine woods
  - Fireworks-store chaos challenges

## 9. UI / HUD
- **MVP**: minimap with GPS route, health and armor, money, Heat badges, ammo,
  pause map with waypoints, interaction prompts.
- **Phone**: contacts and mission calls, bank and credit app, DashDash gig app,
  "Feedr" social feed (satire), camera (later).

## 10. Radio & audio
- **MVP**: 2 stations with placeholder royalty-free music.
- **Later**: 5–6 stations (country, Southern rock, Atlanta-style hip-hop, gospel,
  talk radio satire, classic soul) with DJ chatter and fake ads. All music must
  be original, commissioned, or licensed for use in games.

## 11. World simulation
- Day/night cycle (1 in-game day ≈ 48 real minutes; tunable), weather states,
  shop opening hours.
- Save at safehouses and Dot's Diner; autosave after missions.
