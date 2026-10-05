import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// check the flagged resources in both sims
for (const rid of [148, 167, 360, 36]) {
  const a = A.resources.find(r => r.id === rid), c = C.resources.find(r => r.id === rid);
  console.log(rid, 'A:', JSON.stringify({amt:a.amount, dep:a.depleted, rec:a.recoveryTicks, destroyed:a.destroyed}),
              'C:', JSON.stringify({amt:c.amount, dep:c.depleted, rec:c.recoveryTicks, destroyed:c.destroyed}));
}
