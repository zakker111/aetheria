import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);

// compare at tick 0 (immediately after load)
const mR = new Map(resumed.agents.map(a=>[a.id,a])), mS = new Map(sim.agents.map(a=>[a.id,a]));
let diffs = {};
for (const [id, r] of mR) {
  const d = mS.get(id); if (!d) continue;
  for (const k of ['x','y','currentAction','wanderTicks','reproduceCooldown','settlementId','pioneer','combat','religion','militaryDuty']) {
    const rv = r[k], dv = d[k];
    const same = (typeof rv === 'number' && typeof dv === 'number') ? Math.abs(rv-dv) < 1e-12 : JSON.stringify(rv)===JSON.stringify(dv);
    if (!same) { diffs[k]=(diffs[k]||0)+1; if(diffs[k]<3) console.log(`agent ${id} ${k}: resumed=${JSON.stringify(rv)?.slice(0,120)} direct=${JSON.stringify(dv)?.slice(0,120)}`); }
  }
}
console.log('tick0 diff counts:', diffs);
// rng states
console.log('rng equal:', JSON.stringify(sim.world.rng.getState()) === JSON.stringify(resumed.world.rng.getState()));
// per-tick divergence
for (let t = 1; t <= 10; t++) {
  resumed.tick(); sim.tick();
  let n = 0;
  for (const [id, r] of mR) { const d = mS.get(id); if (!d) continue; if (Math.abs(r.x-d.x)>1e-9 || Math.abs(r.y-d.y)>1e-9) n++; }
  // refresh maps in case of deaths/births
  mR.clear(); for (const a of resumed.agents) mR.set(a.id,a);
  mS.clear(); for (const a of sim.agents) mS.set(a.id,a);
  console.log(`after tick ${t}: diverged agents=${n}, pop ${resumed.agents.length}/${sim.agents.length}`);
}
