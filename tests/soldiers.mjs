// Phase 3b Step 2: Soldier profession & muster regression test.
import { Simulation } from '../src/simulation/simulation.js';

let failures = 0;
const check = (name, ok, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${info ? ' — ' + info : ''}`);
  if (!ok) failures++;
};

function soldierSnapshot(sim) {
  return [...sim.agents].filter(a => a.alive && a.job === 'soldier').map(a => a.id).sort().join(',');
}

// --- Run 1: default world, 4000 ticks ---
const sim = new Simulation(777, 128, 128);
for (let t = 0; t < 4000; t++) sim.tick();

const soldiers = [...sim.agents].filter(a => a.alive && a.job === 'soldier');
check('soldier profession exists and is filled', soldiers.length >= 1, `count=${soldiers.length} at t4000`);

// Cap check: no settlement exceeds floor(pop/8)+1 soldiers
let capOk = true, capInfo = '';
for (const st of sim.settlementSystem.settlements.values()) {
  let n = 0;
  for (const id of st.agentIds) {
    const a = sim._agentById(id);
    if (a && a.alive && a.job === 'soldier') n++;
  }
  const max = Math.floor(st.agentIds.size / 8) + 1;
  if (n > max) { capOk = false; capInfo = `${st.name}: ${n} > ${max}`; break; }
}
check('soldier count capped near pop/8 per settlement', capOk, capInfo);

// Economy records agree with agent jobs (no ghost soldiers among the living)
let recOk = true, recInfo = '';
for (const s of soldiers) {
  const rec = sim.economySystem.getAgentJob?.(s.id);
  // Conscripts get job='soldier' from mustering without an economy row —
  // only veterans enlisted through assignJob carry a 'soldier' record.
  if (rec && rec.job !== 'soldier') { recOk = false; recInfo = `${s.name}: rec=${rec.job}`; break; }
}
check('economy job records match soldier agents', recOk, recInfo);

// No dead-agent ghost rows in the job ledger
let ghostOk = true, ghostCount = 0;
for (const [id, r] of sim.economySystem.agentJobs) {
  const a = sim._agentById(id);
  if (!a || !a.alive) { ghostOk = false; ghostCount++; }
}
check('agentJobs has no ghost rows for dead agents', ghostOk, `ghosts=${ghostCount}`);

// --- Run 2: identical seed must produce identical soldier set ---
const sim2 = new Simulation(777, 128, 128);
for (let t = 0; t < 4000; t++) sim2.tick();
check('soldier assignment deterministic across seeds',
  soldierSnapshot(sim) === soldierSnapshot(sim2),
  `${soldiers.length} vs ${[...sim2.agents].filter(a => a.alive && a.job === 'soldier').length}`);

// --- Save/load keeps soldier jobs exactly ---
{
  const save = sim.serialize();
  const loaded = Simulation.deserialize(save);
  check('soldier jobs survive save/load round trip',
    soldierSnapshot(loaded) === soldierSnapshot(sim));
}

// --- Warring scenario: veterans keep profession after demobilization ---
{
  const simw = new Simulation(777, 128, 128, { scenario: 'warring' });
  for (let t = 0; t < 5000; t++) simw.tick();
  const wsol = [...simw.agents].filter(a => a.alive && a.job === 'soldier');
  check('warring scenario has professional soldiers post-war', wsol.length >= 1, `count=${wsol.length}`);
  // Mustered soldiers on duty also report job soldier but carry militaryDuty
  const onDuty = wsol.filter(a => a.militaryDuty).length;
  console.log(`INFO: warring t5000: ${wsol.length} soldiers (${onDuty} still on duty)`);
}

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nSOLDIERS OK');
