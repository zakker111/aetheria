import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// wrap executeAction: log chosen action type per agent id, and also the
// proposed actions list for agents with wander in them
function instrument(sim, sink) {
  const proto = Object.getPrototypeOf(sim.agents[0]);
  if (proto._instF9) return;
  const oe = proto.executeAction;
  proto.executeAction = function (action, world, bus, craft, s) {
    if (s._ticklog) s._ticklog.push(this.id + ':' + (action?.type ?? 'null'));
    return oe.call(this, action, world, bus, craft, s);
  };
  const oa = proto.generateActions;
  proto.generateActions = function (...args) {
    const acts = oa.apply(this, args);
    if (this.sim._ticklog && acts.some(a => a.type === 'wander')) {
      this.sim._ticklog.push('W[' + this.id + ']:' + acts.map(a=>a.type+'='+a.score.toFixed(2)).join(','));
    }
    return acts;
  };
  const oc = proto.chooseAction;
  proto.chooseAction = function (actions, opts) {
    const r = oc.call(this, actions, opts);
    if (this.sim._ticklog && actions.some(a => a.type === 'wander')) {
      this.sim._ticklog.push('CH[' + this.id + ']:' + (r?.type ?? 'null'));
    }
    return r;
  };
  proto._instF9 = true;
}
A._ticklog = []; C._ticklog = [];
instrument(A, null); instrument(C, null);
A.tick(); C.tick();
const la = A._ticklog, lc = C._ticklog;
console.log('log lines A:', la.length, 'C:', lc.length);
for (let i = 0; i < Math.max(la.length, lc.length); i++) {
  if (la[i] !== lc[i]) {
    console.log('first divergent line @', i);
    console.log('A:\n' + la.slice(Math.max(0,i-6), i+4).join('\n'));
    console.log('C:\n' + lc.slice(Math.max(0,i-6), i+4).join('\n'));
    break;
  }
}
if (la.join('\n')===lc.join('\n')) console.log('identical');
