import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
// warm up
for (let i = 0; i < 3800; i++) sim.tick();

function timeIt(label, fn, reps) {
  const t0 = process.hrtime.bigint();
  for (let r = 0; r < reps; r++) fn();
  const t1 = process.hrtime.bigint();
  console.log(label, Number(t1 - t0) / 1e6 / reps, 'ms/call');
}
const agents = sim.agents.filter(a => a.alive);
console.log('pop', agents.length);
timeIt('perceive', () => { for (const a of agents) a.perceive(sim.world, []); }, 50);
timeIt('generateGoals', () => { for (const a of agents) a.generateGoals(sim, null); }, 50);
timeIt('generateActions', () => { for (const a of agents) a.generateActions(a._perception || {nearbyAgents:[],nearbyResources:[],nearbyBuildings:[],nearbyAnimals:[],nearbyItems:[]}, sim.world, sim); }, 50);
timeIt('chooseAction', () => { for (const a of agents) a.chooseAction([{type:'explore',priority:1}], {}); }, 50);
timeIt('updateNeeds', () => { for (const a of agents) a.updateNeeds(); }, 50);
timeIt('fullTick', () => { sim.tick(); }, 50);
