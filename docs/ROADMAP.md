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

### 5. High-Agent Spatial LOD Architecture
- **Tier 0 (Focus)**: Full 60Hz cognitive steering and animation.
- **Tier 1 (Periphery)**: Time-sliced updates every 3 ticks.
- **Tier 2 (Macro)**: Background demographic simulation every 12 ticks.
- **O(1) Spatial Partitioning**: Cell-based spatial hashing maintaining <25ms tick durations at 1,800+ living agents.

---

## 🧪 Automated Test Suites (10/10)

1. `tests/determinism.mjs` — Bit-exact RNG and state progression across identical seeds and save/load resumes.
2. `tests/gossip.mjs` — Interpersonal gossip networks and emotional memory persistence.
3. `tests/supplychain.mjs` — 9-phase supply chain validation (harvest, forge, stockpile, trade routes, caravans).
4. `tests/warvisible.mjs` — Grudge accumulation and autonomous war declarations.
5. `tests/scenario_warring.mjs` — Default Warring Kingdoms seed and feud resolution.
6. `tests/soak.mjs` — 1,000+ tick longevity benchmark ensuring 0 crashes and demographic balance.
7. `tests/stress_population.mjs` — High-agent stress test verifying <25ms/tick at 1,800+ agents.
8. `tests/war_phase3b.mjs` — Equipment crafting, tactical roles, plundering, and conquest.
9. `tests/dynasty_warfare.mjs` — Dynastic lineages, royal marriages, sieges, and peace conferences.
10. `tests/combat_lethality_lore.mjs` — Mortal combat lethality, slayer titles, named battles, and lore serialization.

---

## 📜 Open Source & Licensing
Aetheria is open source under the [MIT License](../LICENSE).
