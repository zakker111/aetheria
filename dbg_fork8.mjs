import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// per-agent wander refresh log: instrument world rng, tag with sim._actingAgent
function instrument(sim, sink) {
  const rng = sim.world.rng;
  const orig = rng.next.bind(rng);
  let lastTag = null;
  rng.next = function () {
    const st = new Error().stack.split('\n');
    if (st.some(l => l.includes('agent.js:246') || l.includes('agent.js:247'))) {
      const ag = sim._actingAgent;
      const tag = `${ag?.id}:${ag?.wanderTicks}`;
      if (tag !== lastTag) { sink.push(tag + ':REFRESH'); lastTag = tag; }
    }
    return orig();
  };
}
{
  const proto = Object.getPrototypeOf(A.agents[0]);
  const oe = proto.executeAction;
  proto.executeAction = function (action, world, bus, craft, s) {
    s._actingAgent = this;
    const r = oe.call(this, action, world, bus, craft, s);
    s._actingAgent = null;
    return r;
  };
}
const tA = [], tC = [];
instrument(A, tA); instrument(C, tC);
A.tick(); C.tick();
console.log('refreshes A:', tA.length, 'C:', tC.length);
for (let i = 0; i < Math.max(tA.length, tC.length); i++) {
  if (tA[i] !== tC[i]) {
    console.log('first divergent @', i, 'A=', tA[i], 'C=', tC[i]);
    console.log('A ctx:', tA.slice(Math.max(0,i-3), i+3).join(' | '));
    console.log('C ctx:', tC.slice(Math.max(0,i-3), i+3).join(' | '));
    break;
  }
}
if (tA.join()===tC.join()) console.log('identical');
