// War visibility regression test (Phase 3c Step D).
// Verifies that after the diplomacy tuning (25-tick cadence, grievance decay,
// population-gated casus belli), at least one war is declared within a
// watchable session (<= 3000 ticks) and warfare reacts to it. Also guards
// determinism: two fresh sims with the same seed must produce identical war
// histories (no wall-clock / RNG-order dependence introduced by Step D).
import { Simulation } from '../src/simulation/simulation.js';

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failures++;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const TICKS = 3000;

function run(seed) {
  const sim = new Simulation(seed);
  let firstWarTick = -1;
  sim.eventBus.on('DIPLOMATIC_EVENT', (e) => {
    if (firstWarTick < 0 && e && typeof e.title === 'string' && e.title.includes('War Declared')) {
      firstWarTick = sim.clock.tick;
    }
  });
  for (let i = 0; i < TICKS; i++) sim.tick();
  return {
    sim,
    firstWarTick,
    activeWars: sim.diplomacySystem.activeWars.filter(w => w.active).length,
    totalWars: sim.diplomacySystem.warHistory.length +
      sim.diplomacySystem.activeWars.filter(w => w.active).length,
    // Compact history signature for determinism comparison
    signature: sim.diplomacySystem.activeWars.map(w =>
      `${w.id}:${w.attackerId}>${w.defenderId}:${w.casusBelli}`).sort().join('|'),
  };
}

const a = run(777);
const b = run(777);

check('at least one war declared by tick 3000', a.activeWars >= 1 || a.totalWars >= 1);
if (a.firstWarTick >= 0) {
  console.log(`INFO: first war declared at tick ${a.firstWarTick}`);
}
check('war has a justified casus belli (not generic fallback)',
  a.signature === '' || /Resource Wars|Diplomatic Rift|Holy War|Militarist Aggression/.test(a.signature));
check('warfare system reacted (warband formed or battle recorded)',
  a.sim.warfareSystem.warbands.size > 0 ||
  a.sim.diplomacySystem.activeWars.some(w => w.battles.length > 0));
check('diplomacy state deterministic across identical seeds', a.signature === b.signature);

// No settlement should be at war with more than every other settlement
// (sanity guard against runaway declaration loops from the faster cadence).
const relCount = [...a.sim.diplomacySystem.relations.values()];
const maxWarShare = Math.max(...relCount.map(r => r.status === 'war' ? 1 : 0));
void maxWarShare;
const warsPerSettlement = new Map();
for (const w of a.sim.diplomacySystem.activeWars) {
  if (!w.active) continue;
  warsPerSettlement.set(w.attackerId, (warsPerSettlement.get(w.attackerId) || 0) + 1);
  warsPerSettlement.set(w.defenderId, (warsPerSettlement.get(w.defenderId) || 0) + 1);
}
const numSettlements = a.sim.settlementSystem.settlements.size;
const runaway = [...warsPerSettlement.values()].some(c => c >= numSettlements - 1 && numSettlements > 3);
check('no settlement simultaneously at war with everyone (runaway guard)', !runaway);

console.log(`\n${failures === 0 ? 'WARVISIBLE TEST PASSED' : `WARVISIBLE TEST FAILED (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
