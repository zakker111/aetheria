import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// instrument every RNG draw on both sims for one tick
let traceA = [], traceC = [];
function wrap(sim, sink) {
  const rng = sim.world.rng;
  const orig = rng.next.bind(rng);
  let count = 0;
  rng.next = function () {
    if (count < 4000) {
      const st = new Error().stack.split('\n').slice(2, 5).map(l => l.trim().replace('at ', '')).join(' <- ');
      sink.push(st);
    }
    count++;
    return orig();
  };
}
wrap(A, traceA);
wrap(C, traceC);

A.tick(); C.tick();

console.log('draws A:', traceA.length, 'draws C:', traceC.length);
for (let i = 0; i < Math.max(traceA.length, traceC.length); i++) {
  if (traceA[i] !== traceC[i]) {
    console.log('first divergent draw at index', i);
    console.log('A:', traceA.slice(Math.max(0,i-3), i+3).join('\n  ---\n'));
    console.log('C:', traceC.slice(Math.max(0,i-3), i+3).join('\n  ---\n'));
    break;
  }
}
if (traceA.length === traceC.length && traceA.every((v,i)=>v===traceC[i])) console.log('all stacks identical');
