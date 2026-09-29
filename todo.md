# Aetheria — Development Roadmap

## Phase 1 — Deep Economy (current)
- [x] **Ground items / loot drops** — dead agents & animals drop half their inventory as pickups; survivors scavenge them. (Closes `combatSystem.js` TODO.)
- [ ] **Crafting recipes + workshops/forge stations** + "Craftsman" job expansion
- [ ] **Supply chains**: haul raw materials → workshops → distribute finished goods
- [ ] **Inventory limits + settlement stockpiles/warehouses** hardening
- [ ] **Trade routes & caravans** between settlements (extend existing tradeSystem)

## Phase 2 — Agent Psychology
- [ ] **Spatial memory**: recall rich resource nodes; trauma from disasters alters behavior
- [ ] **Skill progression**: XP per task, level-ups unlock advanced recipes
- [ ] **Life stages**: Child (learn) / Adult (work) / Elder (mentor) behaviors

## Phase 3 — Grand Strategy & World Dynamics
- [ ] **Technology ages** progression (stone → bronze → iron)
- [ ] **Migration & expansion**: colonies founding new settlements
- [ ] **Large-scale wars** with conquest/annexation outcomes

## Phase 4 — Polish & Performance
- [ ] Path caching / A* reuse to kill ~83ms tick spikes during heavy events
- [ ] Clean remaining ESLint unused-variable warnings (cosmetic)
- [ ] UI: click-to-inspect agent/settlement panel, event feed in dashboard
