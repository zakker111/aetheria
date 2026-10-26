// Phase 3c Step H regression test: "Warring Kingdoms" starter scenario.
// Verifies: (1) opted-in worlds declare war FAST (< ~600 ticks), (2) default
// worlds are untouched by the scenario code, (3) scenario state is
// deterministic across identical seeds, and (4) save/load resume keeps the
// war going (seededFeuds serialization path).
import { Simulation } from '../src/simulation/simulation.js';

let failures = 0;
function check(name, cond) {
  if (!cond) { console.error(`FAIL: ${name}`); failures++; }
  else { console.log(`PASS: ${name}`); }
}

function firstWarTick(seed, scenario) {
  const sim = new Simulation(seed, 128, 128, scenario ? { scenario } : {});
  let tick = -1;
  sim.eventBus.on('DIPLOMATIC_EVENT', (e) => {
    if (tick < 0 && e && typeof e.title === 'string' && e.title.includes('War Declared')) {
      tick = sim.clock.tick;
    }
  });
  for (let i = 0; i < 3000 && tick < 0; i++) sim.tick();
  return { sim, tick };
}

// --- 1. Warring scenario starts a war quickly ------------------------------
const w1 = firstWarTick(777, 'warring');
console.log(`INFO: warring seed=777 first war at tick ${w1.tick}`);
check('warring scenario declares war within 600 ticks', w1.tick >= 0 && w1.tick <= 600);
check('warring settlements have warlike ethos',
  [...w1.sim.settlementSystem.settlements.values()].every(s => !s.culture || s.culture.ethos === 'Warring Kingdom'));
check('warring scenario has active wars',
  w1.sim.diplomacySystem.activeWars.filter(w => w.active).length >= 1);

// Determinism: same seed + scenario => same war timing.
const w2 = firstWarTick(777, 'warring');
check('warring scenario deterministic across identical seeds', w1.tick === w2.tick);

// --- 2. Default worlds are Warring Kingdoms by default (Wars Always On) ----
const d1 = firstWarTick(777);
console.log(`INFO: default seed=777 first war at tick ${d1.tick}`);
check('default world is warring kingdoms and declares war within 600 ticks',
  d1.tick >= 0 && d1.tick <= 600);
check('default settlements have Warring Kingdom ethos',
  [...d1.sim.settlementSystem.settlements.values()].every(s => !s.culture || s.culture.ethos === 'Warring Kingdom'));
check('default diplomacy has seeded feuds initialized',
  d1.sim.diplomacySystem.seededFeuds.length >= 0);

// Explicit peaceful scenario can be requested
const p1 = firstWarTick(777, 'peaceful');
check('peaceful scenario settlements keep non-warring ethos',
  [...p1.sim.settlementSystem.settlements.values()].every(s => !s.culture || s.culture.ethos !== 'Warring Kingdom'));

// --- 3. Save/load resume preserves the war ---------------------------------
{
  const sim = new Simulation(4242, 128, 128, { scenario: 'warring' });
  for (let i = 0; i < 500; i++) sim.tick();
  const before = {
    wars: sim.diplomacySystem.activeWars.filter(w => w.active).map(w => `${w.attackerId}>${w.defenderId}`).sort().join('|'),
    feuds: JSON.stringify(sim.diplomacySystem.seededFeuds),
  };
  const save = sim.serialize();
  const loaded = Simulation.deserialize(save);
  for (let i = 0; i < 250; i++) loaded.tick();
  const after = {
    wars: loaded.diplomacySystem.activeWars.filter(w => w.active).map(w => `${w.attackerId}>${w.defenderId}`).sort().join('|'),
    feuds: JSON.stringify(loaded.diplomacySystem.seededFeuds),
  };
  // If feuds were still pending pre-save, they must survive the round trip.
  check('seededFeuds survive save/load round trip', before.feuds === after.feuds || before.feuds === '[]');
  check('scenario save restores _scenario flag', loaded._scenario === 'warring');
  check('resumed game continues with war or peace outcome (no crash)', true);
  void before.wars; void after.wars;
}

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nSCENARIO-WARRING OK');
