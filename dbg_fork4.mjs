import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

function instrument(sim, sink) {
  const rng = sim.world.rng;
  const orig = rng.next.bind(rng);
  rng.next = function () {
    const st = new Error().stack.split('\n');
    if (st.some(l => l.includes('agent.js:246') || l.includes('agent.js:247'))) {
      sink.push((sim._actingAgent?.id ?? '?') + ':' + (sim._actingAgent?.currentAction?.type ?? '?'));
    }
    return orig();
  };
}
// monkeypatch executeAction on the prototype via one agent instance
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
console.log('wander draws A:', tA.length, 'C:', tC.length);
let shown = 0;
for (let i = 0; i < Math.max(tA.length, tC.length) && shown < 3; i++) {
  if (tA[i] !== tC[i]) {
    console.log('divergent wander draw @', i, 'A=', tA[i], 'C=', tC[i]);
    console.log('A ctx:', tA.slice(Math.max(0,i-3), i+4).join(' | '));
    console.log('C ctx:', tC.slice(Math.max(0,i-3), i+4).join(' | '));
    shown++;
  }
}
if (tA.join()===tC.join()) console.log('wander traces identical');
