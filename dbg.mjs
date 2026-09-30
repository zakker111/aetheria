import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
for (let i = 0; i < 12000; i++) {
  sim.tick();
  if (i % 2000 === 0) {
    const wsList = [...sim.craftingSystem.workshops.values()].map(ws => `${ws.type||'?'}@${ws.id}:{${[...ws.storage].map(([k,v])=>k+'='+v)}}`);
    console.log(`tick ${i}: workshops=[${wsList.join(', ')}]`);
  }
}
console.log('FINAL workshops:', JSON.stringify([...sim.craftingSystem.workshops.values()].map(ws => ({id: ws.id, type: ws.type, keys: Object.fromEntries(ws.storage), workers: ws.workers?.length}))));
const jobs = {};
for (const a of sim.agents) { const j = sim.economySystem?.getAgentJob?.(a.id)?.job || 'none'; jobs[j] = (jobs[j]||0)+1; }
console.log('jobs:', JSON.stringify(jobs));
console.log('settlements:', JSON.stringify([...sim.settlementSystem.settlements.values()].map(s=>({name:s.name, stockpile:s.stockpile, surplus: s.tradeProfile?.surplus}))));
console.log('routes:', sim.tradeSystem.tradeRoutes.length, 'caravans:', sim.tradeSystem.caravans.length);
