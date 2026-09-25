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

- [ ] **Crafting System**: 
  - Define recipes (e.g., Wood + Stone = Tools; Ore + Wood = Weapons).
  - Add "Craftsman" job role.
  - Implement crafting stations (Workshops, Forges).
- [ ] **Supply Chains**: 
  - Agents must transport raw materials to workshops.
  - Finished goods distributed to settlements or stored.
- [ ] **Inventory Management**: 
  - Individual agent inventories (carry limits).
  - Settlement stockpiles and warehouses.
- [ ] **Trade Routes**: 
  - Automated paths between settlements for surplus resources.
  - Caravans and trade value calculation.

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

- [ ] **Combat Mechanics**: 
  - Melee and ranged attack logic.
  - Health bars, armor, and damage types.
  - Fleeing behavior when health is low.
- [ ] **Militia & Armies**: 
  - Agents equip weapons from inventory.
  - Formation marching and group tactics.
- [ ] **Siege Warfare**: 
  - Attacking enemy settlements.
  - Destroying walls/gates.
  - Pillaging resources.
- [ ] **Territory Control**: 
  - Dynamic borders based on military presence.
  - Capture points and occupation mechanics.

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

---

## 🛠 Technical Debt & Refactoring
- [ ] **Save/Load Optimization**: Compress save files for large worlds.
- [ ] **Multithreading**: Offload pathfinding to Web Workers if lag occurs.
- [ ] **Modding Support**: Expose JSON configs for items, recipes, and events.
- [ ] **Testing Suite**: Expand unit tests for new combat and crafting logic.

## 📜 License
MIT License - Free to use and modify.
