# 03A — Core Simulation Loop

## Purpose
Define the smallest loop from which the whole game can grow.

The game should not simulate “society” as one giant system. Society emerges from many local decisions made by individuals and groups interacting with a changing world.

## Core chain

`World State → Perception → Needs → Goals → Options → Decision → Action → World Change → Memory/Event → New Perception`

Every deeper mechanic should connect to this chain.

## One agent decision cycle
1. Read relevant world state.
2. Update urgent needs.
3. Perceive nearby people, resources, structures, dangers and opportunities.
4. Update memories and relationships from recent events.
5. Select or refresh goals.
6. Generate legal actions.
7. Score actions using needs, personality, skills, distance, risk, reward, obligations and beliefs.
8. Start/continue one action plan.
9. Execute only the amount of work possible this simulation step.
10. Emit resulting events/state changes.

## Important rule
An agent should never magically complete work because a goal says so.

Example:
`Need food` does not directly become `food +20`.

It becomes:
`find food source → travel → inspect → gather → carry → return/use/store → event`.

This makes logistics, roads, danger, resource shortages and social cooperation naturally matter.

## Action model
An action has:
- stable action ID;
- actor ID;
- optional target/entity/location;
- required resources/tools;
- required skill;
- duration/work amount;
- interruption conditions;
- completion result;
- failure result;
- emitted events.

Actions should be deterministic given the same state and RNG stream.

## Job model
Jobs are repeatable action plans with a purpose.

Examples:
`gather_wood`, `haul_food`, `build_house`, `farm_field`, `mine_ore`, `guard_area`, `trade_goods`.

A job is not a personality. It is an available way to satisfy goals.

## Why this is the foundation
Once this loop works, later systems become additions:
- roads reduce travel cost;
- tools improve action efficiency;
- leaders add social goals;
- factions add obligations;
- religion changes beliefs and goal weights;
- wars add danger and military actions;
- god powers change the world and trigger new perceptions.

## Debug requirement
Every current decision should have a compact explanation:
`goal`, `chosen_action`, `top alternatives`, `utility factors`, `blocking reason`.
