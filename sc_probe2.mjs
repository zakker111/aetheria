import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
for (let i = 0; i < 12000; i++) {
  const t0 = process.hrtime.bigint();
  sim.tick();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (i % 250 === 0 || ms > 300) {
    const agents = [...sim.worldState.agents.values()];
    const actions = {};
    for (const a of agents) actions[a.currentAction] = (actions[a.currentAction] || 0) + 1;
    console.log(`tick=${i} ms=${ms.toFixed(0)} pop=${agents.length} acts=${JSON.stringify(actions)}`);
  }
}
console.log('DONE');
