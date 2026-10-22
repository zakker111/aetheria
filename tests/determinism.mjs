// Determinism test: same seed => identical state; save/load resume must be
// bit-identical to an uninterrupted run (RNG stream restored last in deserialize).
import { Simulation } from '../src/simulation/simulation.js';

function fingerprint(sim) {
  const parts = [
    sim.clock.tick,
    sim.agents.length,
    sim.resources.length,
    sim.buildings.length,
  ];
  for (const a of sim.agents) {
    parts.push(a.id, a.x.toFixed(6), a.y.toFixed(6), a.age.toFixed(4),
      a.needs.food.toFixed(3), a.needs.water.toFixed(3), a.needs.rest.toFixed(3));
  }
  return parts.join('|');
}

function run(seed, ticks) {
  const sim = new Simulation(seed);
  for (let i = 0; i < ticks; i++) sim.tick();
  return sim;
}

const SEED = 9876;
const HALFWAY = 500;
const TOTAL = 1000;

// 1. Same seed twice => identical result
const a = run(SEED, TOTAL);
const b = run(SEED, TOTAL);
if (fingerprint(a) !== fingerprint(b)) {
  console.error('FAIL: same seed produced divergent states');
  process.exit(1);
}
console.log('PASS: same-seed runs are identical');

// 2. Different seed => different result (sanity that seeds matter)
const c = run(SEED + 1, TOTAL);
if (fingerprint(a) === fingerprint(c)) {
  console.error('FAIL: different seeds produced identical states');
  process.exit(1);
}
console.log('PASS: different seeds diverge');

// 3. Save at halfway, resume, compare with uninterrupted run
const sim = new Simulation(SEED);
for (let i = 0; i < HALFWAY; i++) sim.tick();
const save = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(save);
for (let i = 0; i < TOTAL - HALFWAY; i++) resumed.tick();
const fpResume = fingerprint(resumed);
const fpDirect = fingerprint(a);
if (fpResume !== fpDirect) {
  // find first divergence for diagnostics
  const r = fpResume.split('|'), d = fpDirect.split('|');
  for (let i = 0; i < Math.max(r.length, d.length); i++) {
    if (r[i] !== d[i]) { console.error(`first divergence at field ${i}: resumed=${r[i]} direct=${d[i]}`); break; }
  }
  console.error('FAIL: save/load resume is not deterministic');
  process.exit(1);
}
console.log('PASS: save/load resume matches uninterrupted run');
console.log('DETERMINISM OK');
