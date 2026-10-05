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
    if (st.some(l => l.includes('ageSystem.js:16'))) {
      const ag = sim._actingAgent;
      sink.push((ag?.id ?? '?') + ':' + (ag?.wanderTicks ?? -1) + ':' + (ag?.path ? 'P' : '-') + ':' + (ag?.alive?'a':'d'));
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
  // also mark during generateGoals/goal override by ageSystem: patch chooseAction? simpler: patch updateAgents loop via agent.updateNeeds? Instead patch Agent.prototype.generateActions to record `this`
  const og = proto.generateGoals;
  proto.generateGoals = function (...args) { args[0]._actingAgent = this; return og.apply(this, args); };
}
const tA = [], tC = [];
instrument(A, tA); instrument(C, tC);
A.tick(); C.tick();
console.log('child draws A:', tA.length, 'C:', tC.length);
for (let i = 0; i < Math.max(tA.length, tC.length); i++) {
  if (tA[i] !== tC[i]) {
    console.log('divergent @', i, 'A=', tA[i], 'C=', tC[i]);
    console.log('A ctx:', tA.slice(Math.max(0,i-4), i+4).join(' | '));
    console.log('C ctx:', tC.slice(Math.max(0,i-4), i+4).join(' | '));
    break;
  }
}
if (tA.join()===tC.join()) console.log('identical');
// Also dump agent 619 & 648 state pre-tick in both sims
for (const id of [619, 648]) {
  const a = A.agents.find(x=>x.id===id), c = C.agents.find(x=>x.id===id);
  console.log(id, 'A:', JSON.stringify({wt:a.wanderTicks,path:a.path,act:a.currentAction?.type,job:a.job,mil:a.militaryDuty,age:a.age,stage:a.lifeStage}),
              'C:', JSON.stringify({wt:c.wanderTicks,path:c.path,act:c.currentAction?.type,job:c.job,mil:c.militaryDuty,age:c.age,stage:c.lifeStage}));
}
