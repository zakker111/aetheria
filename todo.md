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

## Phase 3c — Stabilize, Verify, Ship (ACTIVE PLAN)

Context: a deep audit found that several previously "claimed complete" items were NOT actually in the codebase (wars panel, battle FX, starter scenario, war/colonization tests missing). No git remote is configured, so nothing has been pushed. This phase fixes the real foundation first, then rebuilds the visible-war features honestly, one bite-sized step per "continue". Every step ends with actual test/lint output as proof — no claims without verification.

- [ ] **Step A — Fix gossip save/load determinism** (`tests/gossip.mjs` currently FAILS): root-cause pass on fresh-vs-resumed divergence using field-by-field state diffing at the first divergent tick; apply a real fix (candidates: Map insertion-order float accumulation, currentAction target snapshot asymmetry, agent ordering); re-run until green. *Highest priority: silent world divergence on reload corrupts everything else.*
- [ ] **Step B — Fix supplychain test timeout** (`tests/supplychain.mjs` times out >90s): profile the slow path (tick time vs test loop count), confirm scan-cache perf fix is really wired, reduce test tick budget or speed hot loops; must finish <60s and pass. *Blocks CI/GitHub Actions, which blocks Pages.*
- [ ] **Step C — Reconcile todo.md/docs with reality**: mark only genuinely implemented items as done (audit each checkbox against code before flipping); document verified state of war system (casus belli ✅, warfareSystem warbands/siege/plunder ✅, soldier profession status TBD by audit). Remove stale claims from README/ROADMAP.
- [ ] **Step D — War visibility Step 1: tuning** — lower pop thresholds (~80→35), grievance decay instead of hard expiry, faster diplomacy tick cadence so wars start within a watchable session; add `tests/warvisible.mjs` asserting ≥1 war declared by tick 3000. Determinism-safe (no wall-clock/RNG-order changes).
- [ ] **Step E — War visibility Step 2: event feed** — war-start/end entries with ⚔️/🕊️ icons + click-to-jump camera to the front line (Rule 16 discoverability). Wire into existing chronicle/event system; verify existing tests still pass.
- [ ] **Step F — War visibility Step 3: Wars panel UI** — new tab listing active wars (casus belli, sides, strength, exhaustion, battles fought), peace-treaty history, click → jump camera. Inspector shows settlement/faction military status (Rule 4 inspection-as-gameplay).
- [ ] **Step G — War visibility Step 4: battle visuals** — clashing army band markers, casualty pips, routing tint, smoke particles on canvas renderer (Rule 18 visual activity). Pure render-layer, zero sim-state impact.
- [ ] **Step H — War visibility Step 5: "Warring Kingdoms" starter scenario** — pre-seeded rival factions with grievances so conflict starts ~tick 200; scenario loader hook in main.js. Optional playstyle entry point (Rules 13/20: interesting, not win-state).
- [ ] **Step I — Full validation + docs**: run entire suite (determinism, gossip, soak, supplychain, warvisible) + lint 0/0; update README/ROADMAP/todo with evidence; commit clean tree.
- [ ] **Step J — GitHub push + Pages**: requires user-provided remote URL (`git remote add origin …`). Then push, enable Pages via workflow (Settings → Source: GitHub Actions), verify live site serves index.html with relative imports. *Blocked until user supplies remote.*

Recommended order: A → B → C → D → E → F → G → H → I → J. Steps A–C are bug-fixes/foundation; D–H deliver the "I don't see any wars" fix; I–J ship it.

## Phase 4 — Polish & Performance
- [ ] Path caching / A* reuse to kill ~83ms tick spikes during heavy events
- [x] Clean remaining ESLint unused-variable warnings (cosmetic) — done, 0 errors/0 warnings
- [ ] UI: click-to-inspect agent/settlement panel, event feed in dashboard

## Design Governance
All work on this project must comply with [docs/CORE_DESIGN_RULES.md](docs/CORE_DESIGN_RULES.md) (the design constitution). Before accepting any feature or plan step, apply Rule 30 ("Would I enjoy watching this? Would I want to inspect it? Could it create consequences?") and Rule 20 (no features that answer "no" to all five value questions). Rules 10–13 explicitly forbid drifting into RTS micromanagement, manual city building, guaranteed settlement success, or win-state design.
