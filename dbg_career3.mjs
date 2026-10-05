import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// full sim state compare at the save point
const sa = JSON.stringify(A.serialize()), sc = JSON.stringify(C.serialize());
console.log('full serialize identical at load point:', sa === sc);
if (sa !== sc) {
  const oa = JSON.parse(sa), oc = JSON.parse(sc);
  for (const key of Object.keys(oa)) {
    if (JSON.stringify(oa[key]) !== JSON.stringify(oc[key])) console.log('DIFF KEY:', key);
  }
}

// run both one more tick, then compare again
A.tick(); C.tick();
const sa2 = JSON.stringify(A.serialize()), sc2 = JSON.stringify(C.serialize());
console.log('after 1 tick identical:', sa2 === sc2);
if (sa2 !== sc2) {
  const oa = JSON.parse(sa2), oc = JSON.parse(sc2);
  for (const key of Object.keys(oa)) {
    if (JSON.stringify(oa[key]) !== JSON.stringify(oc[key])) console.log('DIFF KEY after tick:', key);
  }
}
