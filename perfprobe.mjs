import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
let last = Date.now();
for (let i = 1; i <= 6000; i++) {
  sim.tick();
  if (i % 500 === 0) {
    const now = Date.now();
    const agents = sim.worldState?.agents?.size ?? -1;
    process.stdout.write(`tick ${i}: ${((now-last)/1000).toFixed(1)}s/500t agents=${agents} ws=${sim.craftingSystem?.workshops?.size ?? '?'} caravans=${sim.tradeSystem?.caravans?.size ?? '?'} routes=${sim.tradeSystem?.routes?.size ?? '?'}\n`);
    last = now;
  }
}
process.stdout.write('DONE\n');
