import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
let t0 = Date.now();
for (let i = 1; i <= 9000; i++) {
  sim.tick();
  if (i % 500 === 0) {
    console.log('tick', i, 'ms/tick=', ((Date.now()-t0)/500).toFixed(1), 'agents=', sim.agents.length);
    t0 = Date.now();
  }
}
