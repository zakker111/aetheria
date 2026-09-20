# Aetheria

A browser-based god simulation game built with pure JavaScript and ES modules.

## Features

- **Autonomous Agents**: Agents with needs (food, water, rest, social, safety), personality traits, and skills make their own decisions
- **Emergent Societies**: Settlements and social structures emerge from agent interactions, not scripted scenarios
- **Physical World**: Terrain, resources, and environmental factors affect what agents can do
- **God Powers**: Influence the world as a remote deity - spawn agents, create resources, reshape terrain
- **Readable Simulation**: Inspect agents to see why they make their decisions
- **Persistent Consequences**: Agents remember events, form relationships, and react to changes

## Architecture

Built following modular architecture principles:

- **Core**: RNG, EventBus, ID generation, WorldState
- **Simulation**: Clock, EntityStore, Agents, Resources, Buildings
- **Presentation**: Canvas-based 2D renderer
- **Interaction**: God powers and player tools

All simulation code is independent of the renderer and DOM, enabling headless testing and future worker-based execution.

## Running

Simply open `index.html` in a modern browser. No build step or server required.

## Controls

- **Mouse Drag**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Click**: Use selected tool
- **1-6 Keys**: Select tool
- **Space**: Pause/resume

## Tools

1. Spawn Agent - Create a new agent
2. Food - Create food resource
3. Water - Create water source
4. Wood - Create wood resource
5. Ore - Create ore deposit
6. Remove - Remove resource at location

## Saving/Loading

- **Save**: Save current world state to browser storage
- **Load**: Load saved world state

## Technical Details

- Pure ES6 modules (no build step)
- Canvas 2D rendering
- Deterministic simulation with seeded RNG
- Event-driven architecture for decoupled systems
- Component-based agent design

## License

MIT
