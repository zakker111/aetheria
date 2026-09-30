import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
let crafts = 0, distEvents = 0;
sim.eventBus.on('crafting_complete', e => { if (e.outputType==='bread'||e.outputType==='wood_plank') crafts++; });
sim.eventBus.on('GOODS_DISTRIBUTED', () => distEvents++);
for (let i = 0; i < 12000; i++) {
  sim.tick();
  if (i === 3000) {
    for (const s of sim.settlementSystem.settlements.values()) {
      s.stockpile.wheat = 60; s.stockpile.wood_log = 40; s.stockpile.flour = 20;
    }
    console.log('seeded stockpiles at tick 3000');
  }
  if (i % 3000 === 0 && i >= 3000) {
    const wsTotals = {};
    for (const ws of sim.craftingSystem.workshops.values())
      for (const [k,v] of ws.storage) wsTotals[k]=(wsTotals[k]||0)+v;
    const spTotals = {};
    for (const s of sim.settlementSystem.settlements.values())
      for (const [k,v] of Object.entries(s.stockpile)) spTotals[k]=(spTotals[k]||0)+v;
    const jobs={}; for (const a of sim.agents){ if(!a.alive) continue; const j=sim.economySystem.getAgentJob(a.id)?.job||'none'; jobs[j]=(jobs[j]||0)+1;}
    console.log(`t${i}: ws=${JSON.stringify(wsTotals)} sp=${JSON.stringify(spTotals)} jobs=${JSON.stringify(jobs)} routes=${sim.tradeSystem.tradeRoutes.length} caravans=${sim.tradeSystem.caravans.length} crafts=${crafts} dist=${distEvents}`);
  }
}
