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
- [x] **Large-scale wars** — base system exists (`warfareSystem.js`: warbands, battles, sieges, plunder)

## Phase 3b — Wars, Military & Casus Belli (ACTIVE PLAN)
Existing foundation: `diplomacySystem.js` (relations/alliances/war declarations), `warfareSystem.js` (warbands/battles/sieges/plunder), `combatSystem.js` (agent fights), `religionSystem.js`, `cultureSystem.js`. This phase adds *why* societies fight and *what changes after*.

Bite-sized steps (one "continue" per step):
- [x] **Step 1 — War causes engine** (DONE: `evaluateCasusBelli` in diplomacySystem.js — resource/diplomatic/religious/militarist grievances, deterministic best-score pick; wired into TENSION→WAR transition): expand casus belli selection in `diplomacySystem.js`. Score potential targets on: resource scarcity vs neighbor stockpiles (fight for resources), diplomatic rifts (tension/alliance betrayal), religious difference (different dominant faith + zealotry), cultural/militarism drift. Pick highest-scoring justified reason instead of current single border-skirmish trigger. Deterministic RNG only.
- [ ] **Step 2 — Military profession & muster**: agents can take a "soldier" role during war (training at barracks, upkeep from stockpile, stat bonuses); `warfareSystem.onWarDeclared` fills warbands preferentially from soldiers; peace disbands them back to civilian jobs.
- [ ] **Step 3 — Frontline combat depth**: battles use soldier training/equipment (weapon quality from crafting) for damage; casualties drop loot via existing ground-item system; wounded morale penalty for losing side.
- [ ] **Step 4 — Resource-war feedback loop**: raids actually drain target stockpiles (already partially done in plunder) and scarce-resource AI re-triggers new wars; occupied tiles' resource nodes yield to occupier.
- [ ] **Step 5 — Conquest & annexation**: siege success can annex settlement (change ownership/pop loyalty) or raze it; chronicler records era-defining outcomes; defeated faction may sue for peace with tribute.
- [ ] **Step 6 — Religious wars**: heresy/schism events when missionaries convert neighbors; holy-war casus belli with higher intensity, inquisitor actions, temple destruction/rebuilding.
- [ ] **Step 7 — Diplomacy outcomes**: peace treaties with concrete terms (tribute, borders, alliance forced), war-weariness meter preventing endless war, prisoners/executions affecting relations.
- [ ] **Step 8 — UI/renderer**: war overlay (battle markers exist), settlement banners showing at-war/allied, event feed entries for declarations/battles/peace; inspector shows military status.
- [ ] **Step 9 — Tests + determinism**: new `tests/war.mjs` (casus belli fires, annexation round-trips through save/load); full suite green; lint clean.

## Phase 4 — Polish & Performance
- [ ] Path caching / A* reuse to kill ~83ms tick spikes during heavy events
- [x] Clean remaining ESLint unused-variable warnings (cosmetic) — done, 0 errors/0 warnings
- [ ] UI: click-to-inspect agent/settlement panel, event feed in dashboard

## Design Governance
All work on this project must comply with [docs/CORE_DESIGN_RULES.md](docs/CORE_DESIGN_RULES.md) (the design constitution). Before accepting any feature or plan step, apply Rule 30 ("Would I enjoy watching this? Would I want to inspect it? Could it create consequences?") and Rule 20 (no features that answer "no" to all five value questions). Rules 10–13 explicitly forbid drifting into RTS micromanagement, manual city building, guaranteed settlement success, or win-state design.
