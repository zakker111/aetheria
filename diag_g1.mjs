import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);
resumed.tick(); sim.tick();
const mR = new Map(resumed.agents.map(a=>[a.id,a])), mS = new Map(sim.agents.map(a=>[a.id,a]));
for (const [id, r] of mR) {
  const d = mS.get(id); if (!d) continue;
  if (Math.abs(r.x-d.x)>1e-9 || Math.abs(r.y-d.y)>1e-9) {
    console.log(`DIVERGED agent ${id}`);
    for (const k of ['x','y','currentAction','wanderTicks','stuckTicks','path','goals','speed','needs','settlementId','job','memories','reputation']) {
      const rv = JSON.stringify(r[k]), dv = JSON.stringify(d[k]);
      if (rv !== dv) console.log(`  ${k}: R=${rv?.slice(0,200)}  D=${dv?.slice(0,200)}`);
    }
  }
}
