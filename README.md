# Aetheria - God Simulation Game

A browser-based god simulation game built with pure JavaScript and ES modules where players influence a living world, manage resources, spawn agents, and watch civilizations emerge.

> **Design constitution:** all features are governed by [docs/CORE_DESIGN_RULES.md](docs/CORE_DESIGN_RULES.md) — *"Aetheria is not about controlling the world. It is about watching the world become a story."* The loop: **WATCH → NOTICE → INSPECT → UNDERSTAND → INTERVENE → WAIT → DISCOVER**.

## 🎮 Project Overview

Aetheria is a 2D god simulation game featuring a robust entity-component-system architecture. Watch autonomous agents form settlements, develop relationships, and build societies while you shape their world as a deity.

**Current Performance**: Handles 200+ agents and 400+ resources at 80-250 ticks/second (headless soak: ~4-12 ms/tick depending on population phase) without freezing.

## ✅ Currently Implemented Features

### Core Systems
- **Simulation Core**: Entity management, event bus, and optimized main game loop
- **World State**: 64x64 tile grid with multiple biomes (Plains, Forest, Desert, Mountain, Water)
- **Spatial Indexing**: Optimized grid system for efficient entity lookups (O(1) perception)
- **Clock System**: Day/hour cycle with adjustable simulation speed and pause functionality

### Agent System
- **Needs & Drives**: Hunger, thirst, energy, and social needs driving AI behavior
- **Personality Traits**: Randomized traits affecting movement speed, gathering efficiency, and social interaction
- **Life Cycle**: Birth, aging, reproduction (marriage system), and death
- **AI Behavior**: Pathfinding, resource gathering, obstacle avoidance, and urgent need prioritization
- **Family Trees**: Tracking parents, children, and spouses

### Economy & Settlements
- **Settlement Detection**: Automatic clustering of agents into named settlements
- **Job Assignment**: Agents automatically assigned roles (Farmer, Lumberjack, Miner, Builder, Craftsman) based on settlement needs
- **Crafting & Supply Chains**: Workshops craft bread/planks/tools from raw materials; craftsmen haul goods into town stockpiles
- **Trade Routes & Caravans**: Surplus/deficit pairing between settlements spawns automated caravans
- **Market System**: Dynamic resource pricing based on supply and demand
- **Resource Types**: Food, Water, Wood, Ore, Stone, and Gold

### Wars & Diplomacy
- **Casus Belli Engine**: Wars are declared for justified reasons — resource scarcity, diplomatic rifts, religious difference, militarist drift — driven by a decaying grievance ledger
- **Warfare**: Warbands mobilize, march in formation, fight battles and sieges, and plunder stockpiles
- **War Visibility**: ⚔️/🕊️ chronicle entries, clickable HUD front-line banner (jumps camera), [W]ars panel with casualties/battles/peace history, canvas battle markers with morale bars, smoke and routing effects
- **"Warring Kingdoms" Starter Scenario**: Open `index.html?scenario=warring` (or use the in-game launcher overlay) for hereditary rival settlements where the first war breaks out around tick 225 instead of ~2925 — instantly watchable conflict

### Social & Political Systems
- **Relationships**: Friendship, rivalry, and family bonds between agents
- **Factions**: Emerging groups with diplomacy, shared beliefs, and territory influence
- **Event System**: 
  - Natural disasters (Fire, Drought, Plague)
  - Positive events (Harvest Festivals, Bonanzas)
  - Random encounters (Traveling merchants, Wild animal attacks)

### Player Interaction (God Mode)
- **Divine Powers**: 
  - Spawn Agents
  - Create/Remove Resources (Food, Water, Wood, Ore)
  - Trigger Events
- **Camera Controls**: Pan (mouse drag), Zoom (scroll wheel), and coordinate conversion
- **UI Dashboard**: Real-time stats, tool selection, speed controls, and save/load functionality

## 🎯 Controls

- **Mouse Drag**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Left Click**: Use selected tool
- **Keys 1-6**: Select tool
  - `1`: Spawn Agent
  - `2`: Create Food
  - `3`: Create Water
  - `4`: Create Wood
  - `5`: Create Ore
  - `6`: Remove Resource
- **Space**: Pause/resume simulation
- **W**: Toggle the Wars panel (active wars, casualties, peace history; click a row to jump to the front line)

## 💾 Saving/Loading

- **Save Button**: Save current world state to browser storage
- **Load Button**: Load saved world state

## ⚔️ Starter Scenarios

- **Warring Kingdoms**: open `index.html?scenario=warring` — founding settlements are hereditary rivals with warlike cultures, so the first war breaks out around tick 225 (vs ~tick 2925 in a default world). Default worlds are byte-identical; the scenario only changes diplomacy bookkeeping.

## 🚀 Future Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for detailed future development plans including:

1. **Phase 1**: Deep Economy & Supply Chains (Priority #1)
2. **Phase 2**: Advanced Agent AI & Psychology
3. **Phase 3**: Combat & Warfare
4. **Phase 4**: Dynamic World & Ecosystem
5. **Phase 5**: Construction & City Building
6. **Phase 6**: Religion, Culture & Story
7. **Phase 7**: Polish & User Experience

## 🛠 Technical Details

- Pure ES6 modules (no build step required)
- Canvas 2D rendering
- Deterministic simulation with seeded RNG
- Event-driven architecture for decoupled systems
- Component-based agent design
- Optimized spatial indexing for performance

## 📁 Project Structure

```
/workspace
├── index.html          # Main entry point
├── src/
│   ├── core/           # RNG, EventBus, ID generation, WorldState
│   ├── simulation/     # Clock, EntityStore, Agents, Resources
│   ├── systems/        # Game systems (Economy, Events, Factions, etc.)
│   ├── renderer/       # Canvas-based 2D renderer
│   └── ui/             # UI controls and interaction
├── tests/              # Unit and integration tests
└── docs/               # Documentation files
```

## 🏃 Running the Game

Simply open `index.html` in a modern browser. No build step or server required.

## 📄 License

MIT License - Free to use and modify.
