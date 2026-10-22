// Phase 3b Step 3 regression test: combat depth — wounds, routs, veterans.
import { Simulation } from '../src/simulation/simulation.js';

let failures = 0;
const check = (name, cond) => { if (!cond) { console.error(`FAIL: ${name}`); failures++; } else console.log(`PASS: ${name}`); };

function runWarring(seed, ticks) {
  const sim = new Simulation(seed, 128, 128, { scenario: 'warring' });
  let woundedSeen = 0, routedSeen = 0, recoveredSeen = 0, maxVeteranCampaigns = 0;
  sim.eventBus.on('SOLDIER_WOUNDED', () => woundedSeen++);
  sim.eventBus.on('WARBAND_ROUTED', () => routedSeen++);
  sim.eventBus.on('SOLDIER_RECOVERED', () => recoveredSeen++);
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const wb of sim.warfareSystem.warbands.values()) {
      if (!wb.active) continue;
      for (const sid of wb.soldiers) {
        const a = sim._agentById(sid);
        if (a && a.veteranCampaigns > maxVeteranCampaigns) maxVeteranCampaigns = a.veteranCampaigns;
      }
    }
  }
  return { sim, woundedSeen, routedSeen, recoveredSeen, maxVeteranCampaigns };
}

const r = runWarring(777, 5000);
console.log(`INFO: seed=777 t=5000 wounds=${r.woundedSeen} routs=${r.routedSeen} recoveries=${r.recoveredSeen} maxVeteranCampaigns=${r.maxVeteranCampaigns}`);

// Battles are recorded on the live war record (activeWars) and carried into
// warHistory when a war ends — check both so mid-war runs still pass.
const allWars = [...r.sim.diplomacySystem.activeWars, ...r.sim.diplomacySystem.warHistory];
check('battles fought & recorded across wars',
  allWars.some(w => (w.battles?.length ?? 0) > 0 || Object.values(w.casualties ?? {}).some(c => c > 0)));
check('soldiers got wounded on the battlefield', r.woundedSeen > 0);
check('veteran campaign counter increments across musters', r.maxVeteranCampaigns >= 1);
check('world survives combat without collapse', r.sim.agents.filter(a => a.alive).length > 20);

// Determinism: identical seeds produce identical wound counts.
const r2 = runWarring(777, 5000);
check(`wound/veteran outcomes deterministic (${r.woundedSeen}==${r2.woundedSeen})`,
  r.woundedSeen === r2.woundedSeen && r.maxVeteranCampaigns === r2.maxVeteranCampaigns);

if (failures > 0) { console.error(`\nCOMBATDEPTH FAILED (${failures})`); process.exit(1); }
console.log('\nCOMBATDEPTH OK');
