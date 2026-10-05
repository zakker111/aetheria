import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// snapshot rngState before the extra tick
const ra = JSON.stringify(A.world.rng.getState()), rc = JSON.stringify(C.world.rng.getState());
console.log('rng equal pre-tick:', ra === rc, ra.slice(0,80));

A.tick(); C.tick();
const sa = JSON.parse(JSON.stringify(A.serialize())), sc = JSON.parse(JSON.stringify(C.serialize()));
if (JSON.stringify(sa.rngState) !== JSON.stringify(sc.rngState)) {
  console.log('rngState diverged:', JSON.stringify(sa.rngState).slice(0,120), 'vs', JSON.stringify(sc.rngState).slice(0,120));
}
for (const key of ['agents','resources','animals']) {
  const a = sa[key], c = sc[key];
  if (JSON.stringify(a) === JSON.stringify(c)) { console.log(key, 'identical'); continue; }
  console.log(key, 'DIFFERS len', a.length, c.length);
  for (let i = 0; i < Math.min(a.length, c.length); i++) {
    const j1 = JSON.stringify(a[i]), j2 = JSON.stringify(c[i]);
    if (j1 !== j2) {
      const oa = a[i], oc = c[i];
      for (const k of Object.keys(oa)) {
        if (JSON.stringify(oa[k]) !== JSON.stringify(oc[k])) {
          console.log(`  first diff ${key}[${i}] field "${k}":`, JSON.stringify(oa[k]).slice(0,200), 'VS', JSON.stringify(oc[k]).slice(0,200));
          break;
        }
      }
      break;
    }
  }
}
