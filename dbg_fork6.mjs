import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// per-agent wander counter: wrap each agent's own rng stream and tag with agent id
function instrument(sim, sink) {
  for (const ag of sim.agents) {
    const orig = ag.rng.next.bind(ag.rng);
    let last = null;
    ag.rng.next = function () {
      const st = new Error().stack.split('\n');
      if (st.some(l => l.includes('agent.js:247') || l.includes('agent.js:248'))) {
        sink.push(ag.id + ':' + (ag.currentAction?.type ?? '?'));
      }
      return orig();
    };
  }
}
const tA = [], tC = [];
instrument(A, tA); instrument(C, tC);
A.tick(); C.tick();
console.log('wander draws A:', tA.length, 'C:', tC.length);
for (let i = 0; i < Math.max(tA.length, tC.length); i++) {
  if (tA[i] !== tC[i]) {
    console.log('first divergent @', i, 'A=', tA[i], 'C=', tC[i]);
    console.log('A ctx:', tA.slice(Math.max(0,i-3), i+3).join(' | '));
    console.log('C ctx:', tC.slice(Math.max(0,i-3), i+3).join(' | '));
    break;
  }
}
if (tA.join()===tC.join()) console.log('identical traces');
