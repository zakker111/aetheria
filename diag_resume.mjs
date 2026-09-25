import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);
for (let t = 1; t <= 500; t++) { resumed.tick(); sim.tick(); }

// fingerprint helpers
const fpA = s => s.agents.map(a => `${a.id}:${a.x.toFixed(6)},${a.y.toFixed(6)}`).sort().join('|');
console.log('pos match:', fpA(resumed) === fpA(sim));
const idsR = new Set(resumed.agents.map(a=>a.id)), idsS = new Set(sim.agents.map(a=>a.id));
console.log('resumed-only ids:', [...idsR].filter(i=>!idsS.has(i)).slice(0,10));
console.log('direct-only ids:', [...idsS].filter(i=>!idsR.has(i)).slice(0,10));
// compare common agents field-by-field
let diffs = {};
const mR = new Map(resumed.agents.map(a=>[a.id,a])), mS = new Map(sim.agents.map(a=>[a.id,a]));
for (const [id, r] of mR) {
  const d = mS.get(id); if (!d) continue;
  for (const k of ['x','y','age','health','currentAction','wanderTicks','stuckTicks','job','settlementId','reproduceCooldown','starvationTicks','alive']) {
    const rv = r[k], dv = d[k];
    const same = (typeof rv === 'number' && typeof dv === 'number') ? Math.abs(rv-dv) < 1e-9 : JSON.stringify(rv)===JSON.stringify(dv);
    if (!same) { diffs[k] = (diffs[k]||0)+1; if (diffs[k]<3) console.log(`agent ${id} ${k}: resumed=${JSON.stringify(rv)} direct=${JSON.stringify(dv)}`); }
  }
}
console.log('diff counts:', diffs);
console.log('pop:', resumed.agents.length, sim.agents.length);
