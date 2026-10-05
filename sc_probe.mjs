import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
for (let i = 0; i < 12000; i++) {
  const t0 = process.hrtime.bigint();
  sim.tick();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (i % 500 === 0 || ms > 200) {
    console.log(`tick=${i} ms=${ms.toFixed(1)} pop=${sim.worldState.agents.size} settlements=${sim.settlementSystem.settlements.size}`);
  }
}
console.log('DONE');
