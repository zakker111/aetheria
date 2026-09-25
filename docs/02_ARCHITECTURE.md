# 02 — Architecture

## Goal
A highly modular **browser-first** simulation where every mechanic can be implemented, tested and replaced independently.

## Layer model
- **Browser shell:** web lifecycle, input, menus, loading, browser capability detection, storage.
- **Presentation:** renderer, VFX, audio, UI, camera.
- **Interaction:** god tools, selection, inspection and player commands.
- **Simulation:** clock, agents, actions, jobs, resources, buildings, factions, diplomacy, religion, economy, history, combat.
- **World:** terrain, spatial queries, navigation, climate/environment.
- **Persistence:** saves, versioning, migrations.
- **Content:** data assets for items, buildings, traits, jobs, powers, cultures, factions and events.

## Core simulation interfaces
Keep these concepts explicit:
- `WorldState`
- `EntityStore`
- `SimulationClock`
- `PerceptionService`
- `ActionSystem`
- `JobSystem`
- `EventBus`
- `MemorySystem`
- `SpatialQuery`
- `NavigationSystem`
- `PersistenceService`

## Dependency direction
Preferred:
`Content → Rules → Simulation → World State → Events → Presentation`

Do not let UI or renderer own gameplay truth.

## Agent architecture
Avoid a giant NPC class.

Use small components/services such as:
- identity;
- needs;
- physical state;
- skills;
- inventory;
- knowledge;
- goals;
- relationships;
- memories;
- beliefs;
- faction membership.

The decision system reads these components and produces actions.

## Action architecture
Actions are explicit stateful operations.

`ActionDefinition → validation → execution progress → completion/failure → events`

Jobs are reusable action sequences selected by goals.

## World architecture
World state must distinguish:
- terrain truth;
- entity state;
- spatial indexes;
- navigation data;
- derived/temporary caches.

Derived caches may be rebuilt; authoritative state must be saved.

## Browser architecture rules
- Core simulation has no DOM/canvas/WebGPU/WebGL dependencies.
- Simulation can run headless in tests.
- Worker-compatible execution is preferred for expensive simulation.
- Renderer receives snapshots/queries rather than owning authoritative state.
- Rendering FPS must never determine simulation speed.
- Web APIs are isolated behind platform adapters.

## Event architecture
Major state changes should emit explicit events.

Examples:
`RESOURCE_GATHERED`, `RESOURCE_CONSUMED`, `BUILDING_COMPLETED`, `BUILDING_DAMAGED`, `AGENT_BORN`, `AGENT_DIED`, `RELATIONSHIP_CHANGED`, `SETTLEMENT_FOUNDED`, `FACTION_JOINED`, `FACTION_SPLIT`, `WAR_STARTED`, `WAR_ENDED`, `MIGRATION_STARTED`, `GOD_POWER_USED`, `TERRAIN_CHANGED`, `MIRACLE_WITNESSED`.

Events are inputs to memory/history/reactive systems. They should not become an excuse for hidden cross-module writes.

## Determinism
All simulation randomness goes through one seeded RNG service.

Persist:
- world seed;
- content/ruleset version;
- simulation time;
- RNG state when required;
- player action log when replay/debugging is enabled.

## Testing target
Every core subsystem should support a small headless test scenario with no renderer:
- 10 agents gather food;
- resources move physically between locations;
- homes are built;
- one agent dies;
- another agent reacts;
- a settlement emerges;
- a god action changes terrain;
- witnesses remember it.
