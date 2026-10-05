import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
let ev = 0;
sim.eventBus.on('CAREER_CHANGED', e => { ev++; if (ev<=5) console.log('career', e.tick, e.name, e.from, '->', e.to, e.reason); });
for (let i = 0; i < 6000; i++) {
  sim.tick();
  if ((i+1) % 1000 === 0) {
    const c = {};
    for (const a of sim.agents) if (a.alive) c[a.job||'none']=(c[a.job||'none']||0)+1;
    let ws=0, benchSum=0;
    for (const [id,w] of sim.craftingSystem.workshops) { ws++; benchSum+=w.assignedWorkers.length; }
    console.log('tick', i+1, 'pop', sim.agents.filter(a=>a.alive).length, JSON.stringify(c), 'workshops', ws, 'benchWorkers', benchSum, 'events', ev);
  }
}
