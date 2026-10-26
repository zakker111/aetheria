# Aetheria - God Simulation Game

## 🎮 Project Overview
Aetheria is a 2D god simulation game where players influence a living world, manage resources, spawn agents, and watch civilizations emerge. Built with vanilla JavaScript and HTML5 Canvas, it features a robust entity-component-system architecture.

## ✅ Currently Implemented Features

### Core Systems
- **Simulation Core**: Entity management, event bus, and main game loop running at 38+ ticks/second.
- **World State**: 64x64 tile grid with multiple biomes (Plains, Forest, Desert, Mountain, Water).
- **Spatial Indexing**: Optimized quad-tree-like grid for efficient entity lookups (O(1) perception).
- **Clock System**: Day/hour cycle with adjustable simulation speed and pause functionality.

### Agent System
- **Needs & Drives**: Hunger, thirst, energy, and social needs driving AI behavior.
- **Personality Traits**: Randomized traits affecting movement speed, gathering efficiency, and social interaction.
- **Life Cycle**: Birth, aging, reproduction (marriage system), and death.
- **AI Behavior**: Pathfinding, resource gathering, obstacle avoidance, and urgent need prioritization.
- **Family Trees**: Tracking parents, children, and spouses.

### Economy & Settlements
- **Settlement Detection**: Automatic clustering of agents into named settlements.
- **Job Assignment**: Agents automatically assigned roles (Farmer, Lumberjack, Miner, Builder) based on settlement needs.
- **Market System**: Dynamic resource pricing based on supply and demand.
- **Resource Types**: Food, Water, Wood, Ore, Stone, and Gold.

### Social & Political Systems
- **Relationships**: Friendship, rivalry, and family bonds between agents.
- **Factions**: Emerging groups with diplomacy, shared beliefs, and territory influence.
- **Event System**: 
  - Natural disasters (Fire, Drought, Plague)
  - Positive events (Harvest Festivals, Bonanzas)
  - Random encounters (Traveling merchants, Wild animal attacks)

### Player Interaction (God Mode)
- **Divine Powers**: 
  - Spawn Agents
  - Create/Remove Resources (Food, Water, Wood, Ore)
  - Trigger Events
- **Camera Controls**: Pan (mouse drag), Zoom (scroll wheel), and coordinate conversion.
- **UI Dashboard**: Real-time stats, tool selection, speed controls, and save/load functionality.

### Performance
- Handles 100+ agents and 250+ resources smoothly.
- Optimized rendering and update loops preventing freezes.

---

## 🚀 Future Roadmap

### Phase 1: Deep Economy & Supply Chains (Priority #1)
*Transform simple gathering into a complex industrial simulation.*

- [x] **Crafting System** *(DONE — `src/systems/craftingSystem.js`)*:
  - Recipes implemented: wheat_to_flour → bread, log_to_plank, ore_to_tool (workshop queue with auto-queue from storage).
  - "Craftsman" job role implemented (career switching, bench staffing, churn guards).
  - Crafting stations: Workshop buildings constructed by settlements and tracked per-workshop storage/queues.
- [x] **Supply Chains** *(DONE — verified by `tests/supplychain.mjs`, 9/9 green)*:
  - Raw-material haul goals feed nearby workshops (wellbeing-gated so harvesters don't starve while hauling).
  - Finished goods (bread/plank) distributed into settlement stockpile commodity lines by craftsmen.
- [x] **Inventory Management** *(DONE)*:
  - Individual agent inventories with numeric carry capacity (`agent.inventory.capacity`).
  - Settlement stockpiles with per-commodity lines; workshop storage separate from town stockpile.
- [x] **Trade Routes** *(DONE — `src/systems/tradeSystem.js`)*:
  - Surplus/deficit pairing between settlements establishes automated routes.
  - Caravans spawn along routes moving surplus goods (verified in supplychain test).

### Phase 2: Advanced Agent AI & Psychology
*Make agents feel like real individuals with memories and goals.*

- [ ] **Memory System**: 
  - Remember locations of rich resource nodes.
  - Recall past interactions (friend/enemy lists).
  - Trauma from disasters affecting future behavior.
- [ ] **Skill Progression**: 
  - XP system for specific tasks (mining, farming).
  - Level-ups improve efficiency and unlock advanced recipes.
- [ ] **Life Stages**: 
  - Child (play, learn), Adult (work, reproduce), Elder (mentor, retire).
  - Age-specific behaviors and capabilities.
- [ ] **Complex Social Interactions**: 
  - Gossip system spreading news/events.
  - Forming parties/groups for hunting or travel.

### Phase 3: Combat & Warfare
*Introduce conflict and territorial expansion.*

- [x] **Combat Mechanics** *(DONE — `src/systems/combatSystem.js`)*:
  - Melee attack logic between agents/animals; fleeing behavior when health is low.
- [x] **Militia & Armies** *(DONE — `warfareSystem.js` + `formationSystem.js`)*:
  - Warbands mobilize from settlement populations on war declaration and march in formation toward objectives.
- [x] **Siege Warfare** *(DONE — `warfareSystem.js`)*:
  - Attacking enemy settlements, battles with casualties, pillaging/plunder of stockpiles.
- [ ] **Territory Control**:
  - Dynamic borders based on military presence.
  - Capture points and occupation mechanics.

### Phase 3c — Wars, Diplomacy & Watchability (ACTIVE, shipped)
*Make wars actually happen in a watchable session and be visible.* Done: casus belli engine (resource/diplomatic/religious/militarist grievances), grievance ledger with decay, war visibility pipeline (⚔️/🕊️ chronicle icons, clickable HUD front-line banner, [W]ars panel, battle markers with morale bars/smoke/routing tint), and the "Warring Kingdoms" simulation mode active by default (first war ~tick 225, continuous border conflicts). Verified by `tests/warvisible.mjs` (5/5) and `tests/scenario_warring.mjs` (10/10). Production deployment configured for GitHub Actions & GitHub Pages with relative asset bundling.

### Phase 4: Dynamic World & Ecosystem
*Make the world alive beyond just agents.*

- [ ] **Animals & Wildlife**: 
  - Passive mobs (Deer, Rabbits) for hunting.
  - Predators (Wolves, Bears) that hunt agents.
  - Animal migration patterns.
- [ ] **Seasons & Weather**: 
  - Spring (growth), Summer (heat), Autumn (harvest), Winter (snow/scarcity).
  - Weather effects (Rain boosts crops, Snow slows movement).
- [ ] **Terrain Modification**: 
  - Agents can chop forests permanently (deforestation).
  - Mining creates pits/caves.
  - Building roads changes movement cost.
- [ ] **Ecology**: 
  - Over-hunting leads to species extinction.
  - Pollution from industry affects health.

### Phase 5: Construction & City Building
*Allow agents to shape their environment.*

- [ ] **Building System**: 
  - Construct houses, walls, towers, and farms.
  - Blueprint planning and material requirements.
- [ ] **Settlement Expansion**: 
  - Villages grow into Towns then Cities.
  - Visual changes based on population tier.
- [ ] **Infrastructure**: 
  - Roads for faster movement.
  - Irrigation for farming in deserts.
  - Bridges for crossing water.

### Phase 6: Religion, Culture & Story
*Emergent narratives and belief systems.*

- [ ] **Religion System**: 
  - Agents develop faith based on events (miracles/disasters).
  - Build temples to boost faith.
  - Religious factions and holy wars.
- [ ] **Culture & Traditions**: 
  - Unique names, clothing colors, or flags per faction.
  - Cultural values (Warlike vs. Peaceful).
- [ ] **Quest System**: 
  - Generated quests (e.g., "Find lost child", "Kill alpha wolf").
  - Rewards and reputation gains.
- [ ] **Legends & History**: 
  - Record famous agents and great battles.
  - "History Book" viewable by player.

### Phase 7: Polish & User Experience
- [ ] **Visual Enhancements**: 
  - Particle effects (fire, rain, magic).
  - Animated sprites for agents and animals.
  - Lighting and shadows.
- [ ] **UI Improvements**: 
  - Agent inspector panel (view stats, inventory, memory).
  - Heatmaps (happiness, danger, resources).
  - Minimap.
- [ ] **Scenario Mode**: 
  - Pre-defined challenges (Survive winter, Defeat the Orc King).
  - Victory/Defeat conditions.
  - ⚠️ *Design note:* per [CORE_DESIGN_RULES.md](CORE_DESIGN_RULES.md) Rules 13 & 20, win states are secondary to emergent storytelling — scenarios must not become mandatory micromanagement.

---

## 🛠 Technical Debt & Refactoring
- [ ] **Save/Load Optimization**: Compress save files for large worlds.
- [ ] **Multithreading**: Offload pathfinding to Web Workers if lag occurs.
- [ ] **Modding Support**: Expose JSON configs for items, recipes, and events.
- [ ] **Testing Suite**: Expand unit tests for new combat and crafting logic.

## 📜 License
MIT License - Free to use and modify.
