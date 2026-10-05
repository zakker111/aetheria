import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
let last = Date.now(); let acc = {};
for (let i = 0; i < 12000; i++) {
  const t0 = Date.now();
  sim.tick();
  const dt = Date.now() - t0;
  if (dt > 50) console.log(`tick ${i}: ${dt}ms agents=${sim.agents.length}`);
  if ((i+1) % 2000 === 0) console.log(`--- after ${i+1}: total ${((Date.now()-last)/1000).toFixed(1)}s this block, agents=${sim.agents.length}, tickMs~${(dt)}ms`), last = Date.now();
}
console.log('DONE all 12000 ticks');
