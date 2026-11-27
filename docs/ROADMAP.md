# Aetheria - Roadmap & Architectural Evolution

## 🎮 Project Overview
Aetheria is an emergent 2.5D isometric civilization and history simulation game built with React 19, TypeScript, and HTML5 Canvas. The simulation models autonomous agents with psychological drives, dynastic lineages, multi-tier economies, organized warfare, and living historical chronicles.

---

## 🏛️ Implemented Feature Architecture

### 1. World & Environmental Simulation
- **2.5D Isometric & 2D Top-Down Viewports**: Seamless switching with dynamic 3D elevation relief scaling.
- **Dynamic Resource Depletion & Ecology**: Harvested timber leaves cut stumps, mined veins leave spent seams, and harvested fields leave fallow patches that regrow over seasonal cycles.
- **Continuous Day/Night Transitions**: Sinusoidal ambient lighting with smoothstep sky gradients across dawn, noon, dusk, and midnight.
- **Biomes & Elevation**: Coastal sands, lush grasslands, dense forests, alpine rock, and snow-capped peaks.

### 2. Autonomous Citizens & Social Dynamics
- **Needs & Psychological Hierarchy**: Food, Water, Rest, and Social fulfillment driving real-time agent decisions.
- **Spatial Memory**: Bounded memory ring tracking productive resource groves, quarries, and town centers.
- **Skill Progression**: Experience accumulation across gathering, farming, mining, crafting, and warfare.
- **Gossip & Reputations**: Interpersonal conversation spreading social sentiment and faction opinions.
- **Slayer Titles & Lore**: Warriors earn cultural epithets (*"the Blooded"*, *"the Slayer"*, *"the Fierce"*, *"the Undefeated"*) upon winning lethal duels.

### 3. Economy, Crafting & Trade
- **Multi-Tier Supply Chains**: Raw materials (wheat, logs, iron ore) hauled to workshops and forged into flour, planks, weapons, armor, and tools.
- **Communal Stockpiles**: Settlement granaries and warehouses with automated emergency rationing.
- **Bilateral Trade Routes & Caravans**: Automated pairing of surplus and deficit settlements; merchant caravans traversing roads.

### 4. Dynasties, Warfare & Grand Strategy
- **Noble Houses & Royal Successions**: Royal crowns, coats of arms, hereditary succession, and lineage tracking.
- **Royal Marriages**: Dynastic unions cementing non-aggression treaties and military pacts.
- **Casus Belli Engine**: Scarcity, religious differences, and historical grievances triggering justified wars.
- **Military Equipment & Tactical Roles**: Swords, spears, bows, and shields with distinct unit roles (commanders, archers, shieldbearers, vanguards).
- **Multi-Stage Sieges**: Encirclement, battering ram breach, and fortress assault.
- **Lethal Combat & Casualties**: Health drops to zero cause permanent death, battle gear drops, and named battles (*"Battle of Oakhaven Ridge"*).
- **Peace Conferences**: Treaties with vassalage, tribute, demilitarization, and prisoner ransoming.

### 5. Coastal, Naval, Fortifications & Era 1–7 Progression
- **Great Lakes, Harbors & Bridges (`navalSystem.js`, `infrastructureSystem.js`)**: Organic watersheds, shoreline docks, fishing boats, river cargo barges, amphibious raid longboats, and multi-tile timber bridges.
- **City Walls, Watchtowers & Siege Breaches (`fortificationSystem.js`)**: Era-scaled 4-connected walls, friendly/hostile gates, active watchtowers, and physical siege breaches into rubble gaps.
- **Era 1–7 Structures, Wonders & Espionage**: Lv 1–3 civic upgrades, enduring Era 1–7 heritage landmarks, outward urban expansion & Metropolis mergers, 3-stage Cultural Wonders, guild espionage, and Modern/Nuclear Total War deterrence.
- **Historical Lives, Religion & Analytics**: Deterministic multi-generation surnames, Era-stamped `lifeHistory`, heirloom inheritance, procedural faiths with doctrinal diplomacy, cemeteries with conjured ancestor spirits, paved Era 2+ avenues, fallen realm histories, inline renaming, and interactive World Statistics SVG charts inside Chancellery (`C`).

### 6. High-Agent Spatial LOD Architecture
- **Tier 0 (Focus)**: Full 60Hz cognitive steering and animation.
- **Tier 1 (Periphery)**: Time-sliced updates every 3 ticks.
- **Tier 2 (Macro)**: Background demographic simulation every 12 ticks.
- **O(1) Spatial Partitioning**: Cell-based spatial hashing maintaining <26ms average tick durations at 1,500+ living agents.

---

## 🧪 Automated Test Suites (27/27)

1. `tests/soak.mjs` — 1,000+ tick longevity benchmark ensuring 0 crashes and demographic balance.
2. `tests/determinism.mjs` — Bit-exact RNG and state progression across identical seeds and save/load resumes.
3. `tests/gossip.mjs` — Interpersonal gossip networks and emotional memory persistence.
4. `tests/supplychain.mjs` — 9-phase supply chain validation (harvest, forge, stockpile, trade routes, caravans).
5. `tests/warvisible.mjs` — Grudge accumulation and autonomous war declarations.
6. `tests/scenario_warring.mjs` — Default Warring Kingdoms seed and feud resolution.
7. `tests/stress_population.mjs` — 1,500+ agent stress test verifying <32ms/tick with Spatial LOD (~25.6 ms/tick).
8. `tests/war_phase3b.mjs` — Equipment crafting, tactical roles, plundering, and conquest.
9. `tests/dynasty_warfare.mjs` — Dynastic lineages, royal marriages, sieges, and peace conferences.
10. `tests/combat_lethality_lore.mjs` — Mortal combat lethality, slayer titles, named battles, and lore serialization.
11. `tests/phase6_succession_heroes.mjs` — Succession laws, pretenders, civil wars, relics, and Hall of Heroes.
12. `tests/phase6_coastal_river.mjs` — Shoreline docks, fishing boats, river barges, and amphibious raids.
13. `tests/phase7_lakes_bridges.mjs` — Major lakes, wide navigable rivers, and autonomous/divine bridging.
14. `tests/phase8_tactical_mergers.mjs` — Carrying capacity `maxAgents`, tactical ranged combat, and Metropolis mergers.
15. `tests/chaos_diplomacy_nukes_history.mjs` — Multi-front wars, rebellions, causal diplomacy, nuclear strikes, and memorials.
16. `tests/wonders_espionage_archive.mjs` — 3-stage Cultural Wonders, guild sabotage, and Era chronicle filters.
17. `tests/fortifications_siege_breach.mjs` — Perimeter walls, gates, active watchtowers, and physical siege breaches.
18. `tests/modern_nuclear_total_war.mjs` — Era 7 Nuclear Age progression, dual rocket artillery, Total Wars, and MAD retaliation.
19. `tests/spawning_and_diplomacy.mjs` — Wall-safe citizen spawning, pioneer colonization, alliances, and diplomatic logs.
20. `tests/deep_structures_ecology_diplomacy.mjs` — Tanks/aircraft overflight, nuclear infrastructure gating, ecology, and vassalage.
21. `tests/era_buildings_upgrades.mjs` — Era 1–6 civic structures, Lv 1–3 upgrades, buffs, and save/load parity.
22. `tests/city_expansion_era_landmarks.mjs` — Distinct Era 1–7 monuments, disaster survival, and outward urban sprawl.
23. `tests/historical_lives_and_people.mjs` — Deterministic surnames, inheritance, `lifeHistory`, heirlooms, and people roster.
24. `tests/combatdepth.mjs` — Battlefield wounds, veteran campaign counters, and deterministic combat recovery.
25. `tests/soldiers.mjs` — Professional soldier recruitment, population caps, economy tracking, and save/load parity.
26. `tests/phase13_features.mjs` — World Statistics snapshots, Era 2/6 mountain deposits, external border raids, ruin salvage, and stalemate peace.
27. `tests/phase14_features.mjs` — Obsolete wall/road salvage, fallen realms archive, inline renaming, diverse mortality causes, procedural creeds, cemeteries & spirits, paved roads, inter-town visits, and splinter settlements.

---

## 📜 Open Source & Licensing
Aetheria is open source under the [MIT License](../LICENSE).

