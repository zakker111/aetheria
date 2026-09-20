# 00 — Browser Platform Requirements

## Non-negotiable platform
This game is **browser-based first**.

The primary game must run from a normal modern web browser without requiring a native desktop executable. A future packaged desktop version may be added later, but it must use the same browser game code and simulation rules whenever practical.

## Browser-first goals
- Start the game from a web URL.
- Use a 3D browser renderer through a dedicated rendering adapter.
- Keep the simulation independent from the renderer and DOM.
- Keep the game playable with mouse and keyboard first; touch support can come later.
- Support pause, save, reload and resume without requiring a server in the first prototype.
- Make large simulation work capable of running away from the UI thread.
- Avoid native-only dependencies in core gameplay.

## Rendering strategy
Prefer a renderer abstraction with this shape:

`Game Simulation -> Render Snapshot -> Browser Renderer`

WebGPU should be treated as the preferred high-performance path when available, while WebGL2 should remain a fallback target for broader browser compatibility. WebGPU is powerful but is not uniformly available across all widely used browsers, while WebGL2 has broad modern-browser support. The game must detect capabilities instead of assuming a specific GPU API. citeturn759896search0turn759896search5

Do not let simulation code call WebGPU, WebGL, DOM or canvas APIs directly.

## Threading model
Design the game so expensive work can move into Web Workers:

- Simulation worker: world ticks, AI scheduling and non-render simulation.
- Main thread: DOM UI, menus, input and coordination.
- Optional render worker: use OffscreenCanvas when the chosen renderer benefits from it.

OffscreenCanvas is widely available and supports rendering from workers, making it a useful option for reducing main-thread pressure. citeturn759896search2

The first prototype does not need every system in a worker. The architecture only needs to avoid making future worker separation impossible.

## Browser storage
The first save system should work locally in the browser:

- IndexedDB for persistent world saves.
- JSON export/import for backup, debugging and sharing.
- Versioned save migrations.
- Optional server/cloud saves later.

IndexedDB is available from workers as well, so persistence should not require the simulation to live on the main UI thread. citeturn759896search10

## Network/server rule
Do **not** make a backend mandatory for the first playable version.

The architecture should leave a clean boundary for a future backend:

`Browser Client <-> Optional Game Service`

Possible later uses:
- cloud saves;
- shared worlds;
- multiplayer observation;
- leaderboards;
- world sharing;
- authenticated accounts.

None of these should be required for the core single-player simulation.

## Browser constraints that affect design
- Use chunked terrain and streaming rather than one giant world mesh.
- Do not create one DOM element per citizen, building or tree.
- Keep simulation state in plain data structures that can be serialized.
- Avoid garbage-heavy allocations in hot simulation loops.
- Use instancing/batching for repeated 3D objects.
- Stream assets and world regions as needed.
- Make graphics quality scalable for weaker hardware.
- Detect lost GPU contexts/devices and recover cleanly.
- Treat browser tab throttling/backgrounding as a possible state change.
- Never depend on frame rate for simulation correctness.

## Browser quality targets
Define explicit quality tiers later:

### Low
Small visible population, reduced terrain detail, simpler shadows/effects.

### Medium
Normal simulation and visual detail.

### High
More visible agents, terrain detail, effects and simulation presentation.

The simulation rules stay the same across quality levels. Quality settings may change how much is rendered or how much detail is displayed, not what the world logically does.

## Prototype requirement
The first vertical slice must prove that the following all work inside a browser:

1. Load a 3D world.
2. Fly the god camera.
3. Modify destructible terrain.
4. Simulate autonomous agents.
5. Inspect an agent.
6. Give/remove resources.
7. Pause and change simulation speed.
8. Save to browser storage.
9. Reload the page and restore the world.
10. Run for a sustained period without the UI becoming unusable.
