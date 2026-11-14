# Aetheria — Development Roadmap & Project Status

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

## 🚧 Upcoming Pipeline Candidates
- [ ] **Cultural Wonders & Great Monuments**: Multi-stage civilization mega-projects (Great Lighthouse, Stonehenge, Grand Citadel) yielding regional buffs.
- [ ] **Espionage, Sabotage & Guild Factions**: Spy networks, bridge/granary sabotage, and merchant guild charters.
- [ ] **Save Slot Export / Replay Highlights**: Downloadable JSON chronicle/world snapshots and era-by-era history timeline filters.
