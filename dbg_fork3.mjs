import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// Wrap each agent's rng.next to log draws with agent id + action type
function instrument(sim, sink) {
  for (const ag of sim.agents) {
    if (ag._wrapped) continue;
    ag._wrapped = true;
    const orig = ag.rng.next.bind(ag.rng);
    ag.rng = Object.create(Object.getPrototypeOf(ag.rng));
    Object.assign(ag.rng, { seed: 0, state: 0 });
    // simpler: just wrap the shared world rng but tag with current acting agent
  }
  const rng = sim.world.rng;
  const orig = rng.next.bind(rng);
  rng.next = function () {
    const st = new Error().stack;
    if (st.includes('agent.js:246') || st.includes('agent.js:247')) {
      // wander draw — find which agent via updateAgents loop? use chosenAction marker
      sink.push((sim._actingAgent?.id ?? '?') + ':' + (sim._actingAgent?.currentAction?.type ?? '?'));
    }
    return orig();
  };
}
// Mark currently-acting agent in updateAgents via monkeypatch of executeAction
function markActing(sim) {
  const proto = Object.getPrototypeOf(sim.agents[0]);
  if (!proto._execWrapped) {
    const oe = proto.executeAction;
    proto.executeAction = function (action, world, bus, craft, s) {
      s._actingAgent = this;
      const r = oe.call(this, action, world, bus, craft, s);
      s._actingAgent = null;
      return r;
    };
    proto._execWrapped = true;
  }
}
markActing(A); markActing(C);
const tA = [], tC = [];
instrument(A, tA); instrument(C, tC);
A.tick(); C.tick();
console.log('wander draws A:', tA.length, 'C:', tC.length);
for (let i = 0; i < Math.max(tA.length, tC.length); i++) {
  if (tA[i] !== tC[i]) {
    console.log('first divergent wander draw @', i, 'A=', tA[i], 'C=', tC[i]);
    console.log('A ctx:', tA.slice(Math.max(0,i-4), i+4).join(' | '));
    console.log('C ctx:', tC.slice(Math.max(0,i-4), i+4).join(' | '));
    break;
  }
}
if (tA.join()===tC.join()) console.log('wander traces identical');
