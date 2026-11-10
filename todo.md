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
- [x] **10 Comprehensive Automated Test Suites** (`npm test`):
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
- [x] **GitHub Actions CI & GitHub Pages Deployment**: Fully automated build, test, and zero-config deployment workflows.
