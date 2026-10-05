import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
let last = Date.now();
for (let i = 0; i < 4000; i++) {
  sim.tick();
  if (i % 500 === 499) {
    const now = Date.now();
    console.log(`tick ${i+1} pop=${sim.agents.length} t=${now - last}ms`);
    last = now;
  }
}
