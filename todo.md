# Aetheria — Development Roadmap & Project Status

## ✅ Phase 12 — Core Stability, Bug Fixes & Pathfinding Overhaul (COMPLETE)
- [x] **Upgraded Local A* Pathfinding & Anti-Oscillation**: Bounded deterministic A* pathfinding around rivers/walls/mountains with road preference (`isRoad`), straight-line LOS fast path, oscillation detection, and temporary unreachable-target cooldowns.
- [x] **Settlement Population in Any View**: Display settlement banners & live `Pop` counts across both 2.5D Isometric and 2D Top-Down views (`overlaysPass.js`, `topDownPass.js`).
- [x] **Abandoned Settlements Peace Cleanup**: Automatically close active wars, reset hostile diplomatic statuses, and recall marching warbands as soon as a settlement becomes abandoned/ruined.
- [x] **Visible War Loot & Spoils**: Record siege & battlefield plunder in `war.plundered` / `warband.plunderCargo`, spawn visible spoils piles (`GroundItem`), render warband cargo badges (`💰`), and show floating loot popups.
- [x] **Visible Resource Gathering & Balanced Wood Supply**: Multi-tick chop/mine/harvest animations with floating yield indicators (`+🪵`, `+⛏️`, `+🌾`), carried cargo visuals on agents, fair harvest depletion ratios (`1.5:1`), and non-wasteful construction timber consumption.
- [x] **Dynamic Job Switching (No Stuck Builders / Unemployed)**: Per-settlement pending construction checks, automatic idle-builder pivoting to resource/food jobs, and removal of permanent unemployment lockouts.

## 📋 Phase 13 — Statistics Analytics, Era Mountain Mines, Map-Edge Raids & Civic Autonomy
- [x] **World Statistics Dashboard with SVG Pie Charts**: Dedicated Statistics tab in Civilization modal with interactive SVG donut/pie charts for Causes of Death, Average Lifespan/Age, Religions, and Professions/Demographics plus historical trend curves and realm ledger comparison.
- [ ] **Era-Locked Mountain Resource Deposits & God Spawn Tool**: Huge limited Iron Mountain & Nuclear/Uranium Mountain deposits unlocked by settlement era, plus God Dock spawn tool.
- [ ] **Periodic Map-Edge External Raids**: Raiding bands emerging from map borders to test frontier defenses, plunder wealth, and drop spoils.
- [ ] **Autonomous Demolition, Stronger Need-Seeking & Plausible Peace**: Autonomous clearing of ruined/blocking buildings/roads/walls, stronger hunger/thirst resource seeking, and realistic war-weariness peace treaties.
- [ ] **History of fallen cetlements(wars, born, dead, all other that cetlements hade)

## 📋 Phase 14 — Deep Procedural Religions, Fallen Conjuring & Elder Splintering
- [ ] **Procedural Religions, History, Compatibility & Churches**: Procedurally generated faiths with doctrinal tenets, shared-tenet harmony vs hostility, multi-faith coexistence, prophets/religious leaders, and founding churches/temples/shrines.
- [ ] **Conjuring Fallen Citizens**: Ancestral/priest rituals honoring and conjuring spirits of fallen citizens with spectral visual FX.
- [ ] **Rebellious / Elder Splinter Settlements, Paved Roads/Floors & Wandering**: Disgruntled citizens rebelling or led by Elders to found splinter settlements, settlement road/floor networks boosting prosperity, and adventurous citizens visiting distant towns.
- [ ] **Cemeteries and buildings for religional purposes(clicking cemetry shows all the wallen and there we can chek history of fallen legends)

## ✅ Phase 1 — Deep Economy & Supply Chains (COMPLETE)
- [x] **Ground items / loot drops**: Dead agents & animals drop scavengable loot piles; survivors forage and scavenge equipment.
- [x] **Crafting recipes & workshops**: Multi-tier recipes (wheat→flour→bread, log→plank, ore→tools/weapons/shields); dedicated workshop buildings with task queues.
- [x] **Craftsman profession**: Dedicated craftsmen craft finished goods and haul them to communal stockpiles.
- [x] **Communal stockpiles & granaries**: Track per-commodity lines (food, wood, ore, stone, weapons, armor); emergency distribution when citizens face hunger.
- [x] **Trade routes & caravans**: Automated surplus/deficit bilateral trade routes; caravans navigate between towns exchanging commodities.
- [x] **Dynamic resource depletion & regeneration**: Harvested trees leave stumps, exhausted veins leave spent seams, and depleted grain leaves fallow patches that naturally regrow over seasonal cycles.

## ✅ Phase 2 — Agent Psychology, Lineage & Social Systems (COMPLETE)
- [x] **Spatial memory**: Autonomous agents recall rich groves, mines, and settlement centers across a bounded memory ring.
- [x] **Skill progression & specializations**: Dynamic skill XP accumulation (farming, woodcutting, mining, building, combat) with diminishing returns and masteries.
- [x] **Life stages & demographics**: Children (learning, playing), Adults (labor, family, warfare), Elders (wisdom, slower travel).
- [x] **Gossip & interpersonal relations**: Memory-grounded gossip network spreading reputations and feuds across settlement hearths.
- [x] **Heroic epithets & slayer lore**: Warriors earn legendary cultural titles ("the Blooded", "the Slayer", "the Fierce", "the Undefeated") based on combat triumphs.

## ✅ Phase 3 — Dynasties, Warfare & Grand Strategy (COMPLETE)
- [x] **Noble houses & dynastic lineages**: Royal dynasties with hereditary succession, monarch crowns, royal mottos, and lineage graphs.
- [x] **Royal marriages & treaties**: Cross-dynastic unions forging non-aggression pacts and inter-kingdom alliances.
- [x] **Casus Belli engine**: Resource scarcity, religious heresy, territory disputes, and long-standing grudges trigger justified wars.
- [x] **Military equipment & tactical roles**: Swords, spears, bows, and shields craftable at armories; distinct tactical formations (commanders, archers, shieldbearers, vanguards).
- [x] **Multi-stage siege warfare**: Encirclement, battering ram breach, and fortress assault mechanics.
- [x] **Conquest & vassalage**: Conquered realms appoint governors or pay seasonal tributary tithes.
- [x] **Peace conferences**: Automated peace summits resolving wars with formal treaties, demilitarization, and prisoner exchanges.
- [x] **Lethal combat & casualties**: Health drops to zero result in genuine mortal casualties, war casualty tracking, and loot drops.
- [x] **Named historic battles**: Clashes generate storied battle names ("Battle of Oakhaven Ridge", "The Slaughter at Highpass Ford") preserved in war archives.

## ✅ Phase 4 — Visual Polish, Smooth Locomotion & High-Agent LOD Performance (COMPLETE)
- [x] **Smooth continuous locomotion**: Adaptive velocity-aware glide interpolation eliminating tick stutter and rubber-banding.
- [x] **Directional sprite facing**: Humanoid sprites intelligently flip horizontally to face their movement and combat targets.
- [x] **Animated combat FX & feedback**: Metallic shield blocks, hit-sparks, arrow streaks, and rising casualty markers.
- [x] **Smooth Day/Night transitions**: Continuous sinusoidal ambient lighting and smoothstep sky color blending across 24-hour cycles.
- [x] **Wounded locomotion & status indicators**: Staggering limps with arm bandages for wounded soldiers; real-time overhead mini health bars.
- [x] **Spatial LOD Architecture (1,500–2,500 Agents)**:
  - *Tier 0 (Focus)*: Full 60Hz micro-steering and full visual rendering.
  - *Tier 1 (Periphery)*: Sub-sampled simulation every 3 ticks.
  - *Tier 2 (Macro)*: Lightweight off-screen demographic simulation every 12 ticks.
  - $O(1)$ spatial grid clustering keeping tick durations under 25ms at 1,800+ agents.
- [x] **Zero memory leak footprint**: In-place render coordinates, scalar water projection, and pooled entity buffers.

## ✅ Phase 5 — Testing & Open Source Readiness (COMPLETE)
- [x] **14 Comprehensive Automated Test Suites** (`npm test`):
  1. `tests/determinism.mjs`: Byte-identical RNG reproducibility and save/load state parity.
  2. `tests/gossip.mjs`: Gossip network and emotional memory persistence.
  3. `tests/supplychain.mjs`: Multi-tier commodity crafting and caravan trade routes.
  4. `tests/warvisible.mjs`: Grievance accumulation and autonomous war declarations.
  5. `tests/scenario_warring.mjs`: Default Warring Kingdoms seed and feud resolution.
  6. `tests/soak.mjs`: 1,000+ tick stability and demographic balance.
  7. `tests/stress_population.mjs`: 1,500+ agent stress test achieving <25ms/tick.
  8. `tests/war_phase3b.mjs`: Equipment crafting, tactical roles, plundering, and conquest.
  9. `tests/dynasty_warfare.mjs`: Dynastic lineages, royal marriages, sieges, and peace conferences.
  10. `tests/combat_lethality_lore.mjs`: Mortal combat lethality, slayer titles, named battles, and lore serialization.
  11. `tests/phase6_succession_heroes.mjs`: Succession laws, pretender detection, civil war warbands, usurpation, legendary relics, and Hall of Heroes persistence.
  12. `tests/phase6_coastal_river.mjs`: Shoreline Dock snapping, fishing boats, river barges, amphibious raid embarkation/disembarkation, and mid-voyage save/load determinism.
  13. `tests/phase7_lakes_bridges.mjs`: Major inland lakes, multi-tile wide navigable rivers, autonomous/divine bridge spanning, and boat-vs-bridge crossing logic.
  14. `tests/phase8_tactical_mergers.mjs`: Carrying-capacity `maxAgents` cap, zero double-counting, lethal warfare, Era 5–6 modern tactical combat, and Metropolis city mergers/civil wars.
- [x] **GitHub Actions CI & GitHub Pages Deployment**: Fully automated build, test, and zero-config deployment workflows.

## ✅ Phase 6 — Succession Crises, Civil Wars & Maritime Expansion (COMPLETE)
- [x] **Succession Crises & Civil Wars**: Realm succession laws (primogeniture/elective), rival pretender tracking, tension escalation on weak legitimacy or disputed monarch deaths, loyalist vs. rebel warband mobilization, and usurpation/loyalist resolution.
- [x] **Hall of Heroes & Legendary Relics**: Combat champions forging named relic weapons at 3+ kills and permanent Hall of Heroes memorial archival upon death.
- [x] **Coastal & River Gameplay (`navalSystem.js`)**:
  - **Harbor Docks**: Autonomous coastal/river dock planning plus `⚓ Dock` divine placement tool with shoreline snapping.
  - **Fishing Boats**: Docks launch fishing vessels that harvest coastal waters and land catches directly into settlement food stockpiles.
  - **River Barges**: Water-connected trade routes classify as `barge` transport and dispatch cargo barges across rivers and channels.
  - **Amphibious Raids**: Warbands confronting unbridged water embark onto dragon-prowed raid longboats, cross water deterministically, and disembark onto enemy shores.

## ✅ Phase 7 — Great Lakes, Wide Rivers & Bridge Engineering (COMPLETE)
- [x] **Major Inland Lakes & Connected Watershed Rivers (`worldState.js`)**: Procedural 16–28 tile wide organic inland lakes sorted high-to-low, winding connecting rivers linking lakes naturally with flared inlets/outlets and gently sloped riparian banks, highland feeder tributaries, and sea outflows.
- [x] **Bridge Construction & Crossings (`infrastructureSystem.js`)**: Autonomous river bridging for trade routes & neighboring towns (1–7 tiles wide), full `world.setBridge` + shoreline road approaches, `🌉 Bridge` divine placement tool (up to 10 tiles), and boat fallback across wide lakes (>10 tiles).

## ✅ Phase 8 — Carrying Capacity, Modernized Tactical Warfare & City Mergers (COMPLETE)
- [x] **Demographic Balance, Agent Cap & Late-Age Speed**: Logistic reproduction gating, `58–82` elder longevity balance, `maxAgents` carrying capacity (`360` default), exact birth/death metric tracking without double-counting, throttled relationship decay, zero RNG spam in `ageSystem.js`, and periodic pruning of ancient ruins & destroyed resources.
- [x] **Lethal Wars & Era 5–6 Tactical Combat**: Combat regen suppression (`_lastCombatTick`), slower wounded retreats, critical/execute strikes, commander rally auras, siege storming fatalities, **Industrial & Gunpowder Era** (`musket`, `cannon` AOE), **Modern Tactical Era** (`rifle`, heavy `artillery` AOE), tactical ranged standoff/kiting, shieldbearer screening, and 2.5D weapon/explosion rendering.
- [x] **Metropolis Tier & City Mergers**: Neighboring large peaceful towns unite into a `Metropolis` (`🌆`, `pop >= 40`), consolidating citizens, stockpiles, buildings, and territories while escalating union dynasty tension into occasional succession civil wars.

## ✅ Phase 9 — Cultural Wonders, Espionage Guilds & Era Archives (COMPLETE)
- [x] **Cultural Wonders & Great Monuments**: 3-stage civilization mega-projects (`Ancestral Cairn`, `Great Maritime Lighthouse`, `Colosseum of Champions`, `Grand Imperial Citadel`, `Grand Iron Foundry Bastion`, `Atomic Reactor Complex`) yielding real gameplay buffs across trade, morale, siege defense, armory output, and nuclear enrichment.
- [x] **Espionage, Sabotage & Guild Factions**: Autonomous and player-directed covert operations (`sabotage_granary`, `sabotage_bridge`, `sabotage_warhead`, `steal_blueprints`, `incite_revolt`, `counter_espionage`) plus Merchant Guild, Masons & Engineers Guild, and Shadow Syndicate charters.
- [x] **Save Slot Export / Import & Era-by-Era Replay Highlights**: Downloadable JSON world snapshots and chronicle archives, save file import, and Era 1–6 timeline filters in both World Chronicle and Chancellery Archives.
- [x] **16 Automated Test Suites** (`tests/chaos_diplomacy_nukes_history.mjs`, `tests/wonders_espionage_archive.mjs`).

## ✅ Phase 10 — City Walls, Watchtowers & Physical Siege Breaches (COMPLETE)
- [x] **Perimeter City Walls & Gatehouses (`fortificationSystem.js`)**: 4-connected octagonal defense rings with Era-scaled tiers (`Timber Palisade`, `Stone Curtain Wall`, `Reinforced Bastion Wall`) stacked with the `Grand Imperial Citadel` Wonder (`1.35x` HP).
- [x] **Physical Blocking & Gate Funneling**: Solid walls block traversal for all agents while gatehouses open for friendly citizens/caravans and slam shut against hostile warbands.
- [x] **Active Defensive Watchtowers**: Corner bastions and castles actively fire era-scaled arrows, muskets, and tracers at approaching invaders with full combat FX and kill attribution.
- [x] **Physical Siege Breaches**: Besieging warbands enter `"breaching"` state against intact perimeters, pound walls with catapults/artillery/rams until `hp === 0`, carve open scorched `"breach"` rubble gaps (`WALL_BREACHED`), and storm into the city center.
- [x] **Divine Fortification Tools & UI**: `🧱 Wall` & `🗼 Tower` dock powers plus Settlement Fortifications inspector telemetry and `"Fortify Perimeter"` / `"Repair Breaches"` actions.
- [x] **17 Automated Test Suites** (`tests/fortifications_siege_breach.mjs`).

## ✅ Phase 11 — Modern & Nuclear Age Total Wars (COMPLETE)
- [x] **Modern & Nuclear Dev Starter Scenario (`modern_nuclear`)**: Live app boots into fortified Era 6–7 powers with workshops, farms, granaries, barracks, bastion walls, armed nuclear warheads, and an active devastating Total War (with a header selector to switch between `☢️ Modern & Nuclear` and `⚔️ Tribal Kingdoms`).
- [x] **Era 7 `Nuclear Age` (`☢️`)**: Automatic progression from Modern Era via resources/Atomic Reactor/warheads, expanding warhead capacity to 5, boosting enrichment, mobilizing up to 12-troop squads with dual heavy rocket artillery (`dmg 72+`, `splash 3.8`) and upgraded rifles (`dmg 52+`).
- [x] **Devastating Total Wars & MAD Retaliation**: `totalWar` flag propagation on high-stakes & Nuclear Age wars with higher casualty tolerance (`78%` pop / `125` weariness), brutal siege bombardment/urban destruction, autonomous nuclear escalation, atomic casualty tracking in war ledgers, and automatic Mutual Assured Destruction (MAD) nuclear counter-strikes.
- [x] **18 Automated Test Suites** (`tests/modern_nuclear_total_war.mjs`).

## ✅ Phase 12 — Era 1–7 Heritage Landmarks, City Expansion & Historical Agent Lives (COMPLETE)
- [x] **Era 1–6 Upgradable Civic Buildings & Era 1–7 Heritage Landmarks**: Lv 1–3 civic structure scaling (Windmill, Inn, Library, Apothecary, Castle, Bank, Factory, Research Lab, Radar Station, Nuclear Plant) plus distinct resilient Era 1–7 Grand Landmarks surviving cross-era conflicts and fires into the Modern Era.
- [x] **Outward Urban Sprawl**: Continuously growing settlements expand outward into surrounding districts and Grand Metropolises.
- [x] **Full Historical Lives, Houses & People Browser**: Deterministic multi-generation family surnames, Era-stamped `lifeHistory` timelines, landmark builder/upgrade attributions, heirloom weapon/artifact inheritance, synthesized biographies/epitaphs, and the searchable **People & Legends** roster inside Chancellery (`C`).
- [x] **25 Automated Test Suites** (`tests/era_buildings_upgrades.mjs`, `tests/city_expansion_era_landmarks.mjs`, `tests/historical_lives_and_people.mjs`, `tests/combatdepth.mjs`, `tests/soldiers.mjs`).

## ✅ Phase 13 — Bug Audit, Fixes & GitHub Release Hardening (COMPLETE)
- [x] **Diplomatic Feed Chronological Fix (`App.tsx`, `CivilizationModal.tsx`)**: Removed erroneous `.reverse()` on `diplomacySystem.diplomaticHistory` (already `unshift()`-ordered newest-first) so latest treaties, ultimatums, and wars appear at the top.
- [x] **Modal Hotkey Gating & Duplicate Listener Removal (`App.tsx`, `godPowers.js`)**: Removed the duplicate `'1'..'0'` `keydown` listener in `godPowers.js` and gated `App.tsx` world shortcuts (`1..0`, `Space`, `W`) behind `civilizationOpenRef` / `helpOpenRef` while keeping `Escape` and `C` active.
- [x] **Clean `Remove` Tool & Registry Cleanup (`godPowers.js`, `simulation.js`)**: Fixed `case "remove"` to clean `ownerSettlement.buildings`, `world.entityRegistry`, `craftingSystem.workshops`, and inspector selections; added wall/gate and bridge erasure plus empty-tile feedback; updated `removeResource()` to delete stale `entityRegistry` entries.
- [x] **Ruined Building Inspection & Dead Agent Selection (`App.tsx`, `renderer.js`)**: Preserved live inspection of ruined structures (`health <= 0` / `RUINED` badge) and suppressed canvas selection halos for deceased agents inspected via Memorial Dossiers.
- [x] **Lifecycle Reset, Safe LocalStorage Save & Fallen Hero Export (`App.tsx`, `CivilizationModal.tsx`)**: Reset tool/selection/chronicle/diplomacy UI state on new world init and save load, cleared `CivilizationModal` selections/filters across simulation swaps, wrapped `localStorage.setItem` in `try/catch` quota handling, and fixed `handleExportChronicle()` to export `sim.fallenHeroes`.
- [x] **Strict TS & CI Alignment (`CivilizationModal.tsx`, `package.json`, `.gitignore`, `README.md`, `docs/ROADMAP.md`)**: Removed unused `useMemo`/`Simulation` imports so `tsc --noEmit --noUnusedLocals --noUnusedParameters` passes cleanly, wired `combatdepth.mjs` & `soldiers.mjs` into `npm test` (25/25 suites), ignored Playwright artifacts, and reconciled repo documentation.

## ✅ Technical Debt & Refactoring Backlog (COMPLETE)
- [x] **Split Renderer Monolith (`src/presentation/renderer.js` -> `passes/*`)**: Extracted 2.5D rendering into 6 focused pass modules (`terrainPass.js`, `structuresPass.js`, `entitiesPass.js`, `overlaysPass.js`, `topDownPass.js`, `hudPass.js`), trimming `renderer.js` from 4,657 lines to a 958-line orchestrator with full backward-compatible API.
- [x] **Split Remaining Monolithic Engine & UI Files**:
  - [x] **Split Simulation Orchestrator (`src/simulation/simulation.js` -> `modules/*`)**: Extracted world seeding/resources, diplomacy/nuclear strikes, warfare/espionage, demographics/buildings, and serialization into focused modules (4,209 -> 1,549 lines).
  - [x] **Split Agent AI & Execution (`src/simulation/agent.js` -> `agentModules/*`)**: Extracted perception/memory/gossip, goal/action selection, and execution/navigation into focused modules (3,646 -> 898 lines) with byte-identical RNG determinism.
  - [x] **Split Inspector Panel & World Snapshot Builders (`InspectorPanel.tsx` -> `inspector/*`, `App.tsx` -> `worldSnapshot.ts`)**: Decomposed agent/settlement/building/resource inspector views and centralized HUD/inspection payload assembly.
  - [x] **Split Chancellery & War Room Modal (`src/components/CivilizationModal.tsx` -> `civilization/*`)**: Decomposed 2,472-line modal into 5 focused tab modules (`DynastiesTab.tsx`, `DiplomacyTab.tsx`, `WarRoomTab.tsx`, `WondersTab.tsx`, `HeroesAndArchivesTab.tsx`) plus a 258-line shell with `WeakMap` simulation instance keying.
- [x] **Strict TypeScript & Full-Codebase ESLint**: Enabled `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`, and `"noFallthroughCasesInSwitch": true` in `tsconfig.json`, and extended `eslint.config.js` with `typescript-eslint` + `eslint-plugin-react-hooks` rules across `.ts`/`.tsx` alongside `.js`/`.mjs`.
- [x] **Bundle Code-Splitting & Asset Optimization**: Lazy-loaded `CivilizationModal` and `GuideModal` (`React.lazy`), added Vite `manualChunks` (`vendor-react`, `engine-sim`, `engine-render`), shrinking `dist/assets/index-*.js` from ~1.9 MB to ~190 KB, and optimized banner/emblem JPEGs from ~2.1 MB total down to ~245 KB.
- [x] **Typed State Subscriptions Over Event Bus / Scattered Polling**: Introduced `src/state/worldUiStore.ts` (`useSyncExternalStore` selectors + typed pub/sub event channels), replacing `window.dispatchEvent(CustomEvent)` channels and scattered HUD `useState` hooks across `App.tsx`, `renderer.js`, and `godPowers.js`.
- [x] **Tailwind Consolidation & Narrow-Viewport HUD**: Migrated React UI components and panels from large inline `React.CSSProperties` objects to Tailwind CSS utility classes, wrapped base resets cleanly in `@layer base`, added `< 960px` responsive StartScreen/HUD drawers, and added `hudPass.js` narrow-viewport war-banner clamping and offset support.
- [x] **IndexedDB / Compressed Save Storage (`src/utils/saveStorage.ts`)**: Added gzip-compressed (`CompressionStream` / `DecompressionStream`) IndexedDB save storage (`aetheria_db`) with automatic `localStorage` fallback and legacy save migration.
- [x] **Fast vs. Deep Test Tiers (`package.json`)**: Separated quick verification/determinism suites (`npm run test:fast`) from multi-thousand-tick endurance suites (`npm run test:deep`) while keeping `npm test` / `npm run test:full` at full CI parity.
