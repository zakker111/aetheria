import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

console.log('A jobChangeCount size:', A._jobChangeCount.size);
console.log('C jobChangeCount size:', C._jobChangeCount.size);
console.log('career field in save:', JSON.stringify(data.career));

// per-agent compare of the fields that drive career decisions
const diffs = [];
for (let k = 0; k < Math.max(A.agents.length, C.agents.length); k++) {
  const a = A.agents[k], c = C.agents[k];
  if (!a || !c) { diffs.push(`len mismatch @${k}`); break; }
  if (a.id !== c.id) { diffs.push(`id order mismatch @${k}: ${a.id} vs ${c.id}`); continue; }
  const recA = A.economySystem.getAgentJob(a.id);
  const recC = C.economySystem.getAgentJob(c.id);
  const s = x => `${x.job}|${x._jobAssignedTick}|${x._lastJobAssignedTick}|rec:${x.rec?.job}->${x.rec?.assignedAt}`;
  const fa = s({ ...a, rec: recA }), fc = s({ ...c, rec: recC });
  if (fa !== fc) diffs.push(`agent ${a.id}:\n  A=${fa}\n  C=${fc}`);
}
console.log(diffs.length ? diffs.slice(0, 8).join('\n') : 'no per-agent career-state diffs at tick 1500');
