import { Simulation } from '/workspace/src/simulation/simulation.js';

const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);

// fingerprint right after deserialize, before any ticks
const fp = s => s.agents.map(a => `${a.id}:${a.x.toFixed(6)},${a.y.toFixed(6)}`).sort().join('|');
console.log('immediately after deserialize identical:', fp(resumed) === fp(sim));

// tick both one at a time and find first divergence
for (let i = 0; i < 500; i++) {
  resumed.tick(); sim.tick();
  if (fp(resumed) !== fp(sim)) {
    console.log('first divergence after', i+1, 'resumed ticks');
    // find which agent differs first
    for (const a of resumed.agents) {
      const b = sim.agents.find(x=>x.id===a.id);
      if (!b) { console.log('agent', a.id, 'exists only in resumed'); continue; }
      if (Math.abs(a.x-b.x)>1e-9 || Math.abs(a.y-b.y)>1e-9) {
        console.log('diverged agent', a.id, a.x, b.x, a.y, b.y, 'state', a.state, b.state, 'job', a.job, b.job);
        break;
      }
    }
    const missing = sim.agents.filter(x=>!resumed.agents.find(y=>y.id===x.id));
    const extra = resumed.agents.filter(x=>!sim.agents.find(y=>y.id===x.id));
    console.log('missing in resumed:', missing.map(m=>m.id), 'extra in resumed:', extra.map(m=>m.id));
    break;
  }
}
