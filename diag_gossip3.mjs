import { Simulation } from '/workspace/src/simulation/simulation.js';

const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);

function ser(v) {
  if (v instanceof Map) return 'MAP:' + [...v.entries()].map(([k,val])=>`${k}=>${ser(val)}`).join(',');
  if (Array.isArray(v)) return '[' + v.map(ser).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k=>`${k}:${ser(v[k])}`).join(',') + '}';
  return String(v);
}

for (const id of [904, ...resumed.agents.slice(0, 100).map(a=>a.id)]) {
  const a0 = resumed.agents.find(a=>a.id===id);
  const b0 = sim.agents.find(a=>a.id===id);
  if (!a0 || !b0) continue;
  const keys = new Set([...Object.keys(a0), ...Object.keys(b0)]);
  const diffs = [];
  for (const k of keys) {
    if (k === 'sim' || k === 'rng') continue;
    const av = ser(a0[k]), bv = ser(b0[k]);
    if (av !== bv) diffs.push(`${k}: resumed=${av.slice(0,120)} | live=${bv.slice(0,120)}`);
  }
  if (diffs.length) {
    console.log(`AGENT ${id}:`);
    diffs.forEach(d => console.log('  ', d));
    break; // just first diverging agent
  }
}
console.log('done');
