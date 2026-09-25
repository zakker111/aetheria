import { Simulation } from '/workspace/src/simulation/simulation.js';

const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();

const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);
for (let i = 0; i < 500; i++) resumed.tick();
for (let i = 0; i < 500; i++) sim.tick();

const rList = resumed.agents, sList = sim.agents;
console.log('count', rList.length, sList.length);
const rIds = rList.map(a=>a.id).sort((a,b)=>a-b);
const sIds = sList.map(a=>a.id).sort((a,b)=>a-b);
console.log('idsets equal:', JSON.stringify(rIds)===JSON.stringify(sIds));

const gview = a => [...(a.gossipViews?.entries?.() || [])].map(([k,v])=>`${k}=${v.toFixed(6)}`).join(';');
let diffs = {};
for (const id of rIds) {
  const a = rList.find(x=>x.id===id), b = sList.find(x=>x.id===id);
  if (!b) continue;
  for (const k of ['x','y','age','alive','hp','health','state','job','settlementId','partnerId','generation','reproduceCooldown','starvationTicks']) {
    const av=a[k], bv=b[k];
    const same=(typeof av==='number'&&typeof bv==='number')?Math.abs(av-bv)<1e-9:av===bv;
    if(!same){const key=`${k}(${av} vs ${bv})`;diffs[key]=(diffs[key]||0)+1;}
  }
  if (gview(a)!==gview(b)) diffs['gossipViews']=(diffs['gossipViews']||0)+1;
}
console.log(diffs);
console.log('clock', resumed.clock.tick, sim.clock.tick);
