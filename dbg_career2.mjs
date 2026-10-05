import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// compare full agent serialize() at tick 1500 to find any other lost field
const diffs = [];
for (let k = 0; k < Math.max(A.agents.length, C.agents.length); k++) {
  const a = A.agents[k], c = C.agents[k];
  if (!a || !c) { diffs.push(`len mismatch @${k}`); break; }
  const sa = JSON.stringify(a.serialize()), sc = JSON.stringify(c.serialize());
  if (sa !== sc) {
    // locate differing keys
    const oa = JSON.parse(sa), oc = JSON.parse(sc);
    for (const key of new Set([...Object.keys(oa), ...Object.keys(oc)])) {
      if (JSON.stringify(oa[key]) !== JSON.stringify(oc[key])) diffs.push(`agent#${k}(${a.id}/${c.id}) key=${key}: ${String(JSON.stringify(oa[key])).slice(0,80)} vs ${String(JSON.stringify(oc[key])).slice(0,80)}`);
    }
  }
}
console.log(diffs.length ? diffs.slice(0,15).join('\n') : 'agents identical after load');

// RNG state identical?
console.log('rng equal:', JSON.stringify(A.world.rng.getState()) === JSON.stringify(C.world.rng.getState()));
// jobChangeCount equal?
const ja = [...A._jobChangeCount.entries()].sort((x,y)=>x[0]-y[0]);
const jc = [...C._jobChangeCount.entries()].sort((x,y)=>x[0]-y[0]);
console.log('jobChangeCount equal:', JSON.stringify(ja) === JSON.stringify(jc));
// economy records equal?
console.log('economy equal:', JSON.stringify(A.economySystem.serialize()) === JSON.stringify(C.economySystem.serialize()));
