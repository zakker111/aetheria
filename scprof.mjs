import { Simulation } from './src/simulation/simulation.js';
const sim = new Simulation(4242);
for (let i = 0; i < 6500; i++) sim.tick(); // grow to ~700 agents
const session = await import('inspector').then(m => { const m2 = new m.Session(); m2.connect(); return m2; });
await new Promise(res => session.post('Profiler.enable', res));
await new Promise(res => session.post('Profiler.start', res));
for (let i = 0; i < 300; i++) sim.tick();
const { profile } = await new Promise(res => session.post('Profiler.stop', (e, r) => res(r)));
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const total = profile.samples.length;
const counts = {};
for (const id of profile.samples) counts[id] = (counts[id] || 0) + 1;
const rows = Object.entries(counts).map(([id, c]) => {
  const n = byId.get(Number(id));
  if (!n) return { t: '(unknown)', pct: (c/total*100) };
  const f = n.callFrame;
  return { t: `${f.functionName||'(anon)'} ${(f.url||'').replace('file:///workspace/','')}:${f.lineNumber}`, pct: (c/total*100) };
}).sort((a,b)=>b.pct-a.pct).slice(0, 30);
for (const r of rows) console.log(r.pct.toFixed(1).padStart(5), r.t);
