import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);

// snapshot all agent fields at tick0, diff keys
const setA = new Set(Object.keys(sim.agents[0]));
const setB = new Set(Object.keys(resumed.agents.find(a=>a.id===sim.agents[0].id)));
console.log('only in live:', [...setA].filter(k=>!setB.has(k)).join(','));
console.log('only in loaded:', [...setB].filter(k=>!setA.has(k)).join(','));

// find first divergent tick for agents 914-919
for (let t = 1; t <= 30; t++) {
  resumed.tick(); sim.tick();
  const r = resumed.agents.find(a=>a.id===917), d = sim.agents.find(a=>a.id===917);
  if (!r || !d) continue;
  if (Math.abs(r.x-d.x)>1e-9) { console.log(`first divergence at resume-tick ${t} (clock ${resumed.clock.tick}/${sim.clock.tick})`); break; }
}
