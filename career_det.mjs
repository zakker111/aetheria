import { Simulation } from './src/simulation/simulation.js';

function fingerprint(sim) {
  return sim.agents.map(a => `${a.id}:${a.name}:${a.job}:${a.x.toFixed(4)}:${a.y.toFixed(4)}:${Math.floor(a.age)}:${a._jobAssignedTick ?? -1}:${a._lastJobAssignedTick ?? -2}`).join('|');
}

// Run A: uninterrupted 3000 ticks
const A = new Simulation(9001);
let evA = 0; A.eventBus.on('CAREER_CHANGED', () => evA++);
for (let i = 0; i < 3000; i++) A.tick();
const fpA = fingerprint(A);

// Run B: 1500 ticks -> save/load -> 1500 more
const B = new Simulation(9001);
let evB = 0, evC = 0; B.eventBus.on('CAREER_CHANGED', () => evB++); C.eventBus.on('CAREER_CHANGED', () => evC++);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(cloneSafe(B.serialize())));
const C = Simulation.deserialize(data);
for (let i = 0; i < 1500; i++) C.tick();
const fpC = fingerprint(C);

console.log('career events A:', evA, 'resumed C:', evB + evC === 0 ? '(fresh bus)' : '');
console.log(fpA === fpC ? 'PASS: save/load resume identical to uninterrupted run' : 'FAIL: divergence');
if (fpA !== fpC) {
  const a = fpA.split('|'), c = fpC.split('|');
  for (let i = 0; i < Math.max(a.length, c.length); i++) if (a[i] !== c[i]) { console.log('first diff @', i, a[i], 'vs', c[i]); break; }
  process.exit(1);
}

// job mix sanity: craftsmen must not dominate at 6000 ticks on one seed
const D = new Simulation(4242);
let evD = 0; D.eventBus.on('CAREER_CHANGED', () => evD++);
for (let i = 0; i < 6000; i++) D.tick();
const counts = {};
for (const a of D.agents) if (a.alive) counts[a.job || 'none'] = (counts[a.job || 'none'] || 0) + 1;
const pop = D.agents.filter(a => a.alive).length;
const cpct = ((counts.craftsman || 0) / pop * 100);
console.log('pop', pop, JSON.stringify(counts), 'craftsman%', cpct.toFixed(1), 'careerChanges', evD);
console.log(cpct <= 25 ? 'PASS: craftsman share bounded' : 'WARN: craftsman share high');
function cloneSafe(v){return v;}
