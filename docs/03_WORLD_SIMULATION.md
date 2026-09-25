# 03 — World Simulation

## Responsibilities
Own world seed, simulation time, tick scheduling, global entities and world-level environmental state.

## Simulation model
Use a fixed simulation tick. Rendering can run at a different rate, pause independently, or be temporarily throttled by the browser. The simulation clock is the source of truth, never `requestAnimationFrame`.

High-level tick:
1. Update environment.
2. Update urgent agent needs.
3. Complete/advance jobs.
4. Resolve movement and interactions.
5. Process production/consumption.
6. Run social/faction decisions on schedule.
7. Process events.
8. Record important history.

## Simulation frequency
Not every system needs to run every tick.
- Movement/physics: frequent.
- Needs: frequent but batched.
- Individual planning: periodic or when state changes.
- Diplomacy: slow interval.
- Cultural drift: slow interval.
- World history summaries: event-driven.

## Browser execution
The simulation must be able to run as an isolated service/worker without requiring the 3D renderer to be active. This makes background processing, headless tests and future server execution easier.

## Pause/speed
Player can pause, slow, normal, fast and very fast.

## Determinism
Same seed + same player actions + same content version should reproduce the simulation closely. Record god actions as deterministic inputs for debugging.
