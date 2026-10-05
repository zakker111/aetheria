import { Simulation } from './src/simulation/simulation.js';

function jobCounts(sim) {
  const c = {};
  for (const a of sim.agents) if (a.alive) c[a.job || 'none'] = (c[a.job || 'none'] || 0) + 1;
  return c;
}

for (const seed of [4242, 777, 31337]) {
  const sim = new Simulation(seed);
  let careerEvents = 0;
  sim.eventBus.on('CAREER_CHANGED', () => careerEvents++);
  for (let i = 0; i < 6000; i++) sim.tick();
  const c = jobCounts(sim);
  const pop = sim.agents.filter(a => a.alive).length;
  console.log('seed', seed, 'pop', pop, JSON.stringify(c),
    'craftsman%', ((c.craftsman||0)/pop*100).toFixed(1), 'careerChanges', careerEvents);
}
