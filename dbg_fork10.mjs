import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// compare spatial index cell-by-cell before the tick
function snap(sim) {
  const m = sim.world.spatialIndex;
  const out = new Map();
  for (const [k, arr] of m) out.set(k, arr.map(e => e.type + '#' + e.id));
  return out;
}
const sA = snap(A), sC = snap(C);
let diffs = 0;
const allKeys = new Set([...sA.keys(), ...sC.keys()]);
for (const k of [...allKeys].sort((a,b)=>a-b)) {
  const a = (sA.get(k)||[]).join(','), c = (sC.get(k)||[]).join(',');
  if (a !== c) {
    console.log('CELL', k, '\n  A:', a.slice(0,200), '\n  C:', c.slice(0,200));
    if (++diffs >= 6) break;
  }
}
console.log('cell diffs shown:', diffs, 'total cells A/C:', sA.size, sC.size);
// also compare resource array order
const ra = A.resources.map(r=>r.id).join(','), rc = C.resources.map(r=>r.id).join(',');
console.log('resource order identical:', ra === rc);
