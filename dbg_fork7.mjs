import { Simulation } from './src/simulation/simulation.js';

const A = new Simulation(9001);
for (let i = 0; i < 1500; i++) A.tick();
const B = new Simulation(9001);
for (let i = 0; i < 1500; i++) B.tick();
const data = JSON.parse(JSON.stringify(B.serialize()));
const C = Simulation.deserialize(data);

// log every wander-refresh decision per agent for the tick
function instrument(sim, sink) {
  const proto = Object.getPrototypeOf(sim.agents[0]);
  if (proto._wInst) return;
  const oe = proto.executeAction;
  proto.executeAction = function (action, world, bus, craft, s) {
    if (action && action.type === 'wander') {
      const pre = { wt: this.wanderTicks, path: this.path ? this.path.length : null };
      const r = oe.call(this, action, world, bus, craft, s);
      // did it refresh? wander refresh sets wanderTicks back to 0 and creates a new path
      sink.push(`${this.id}:wt=${pre.wt},p=${pre.path}->${this.path?'Y':'N'},act=${this.currentAction?.type??'null'}`);
      return r;
    }
    return oe.call(this, action, world, bus, craft, s);
  };
  proto._wInst = true;
}
const tA = [], tC = [];
instrument(A, tA); instrument(C, tC);
A.tick(); C.tick();
console.log('wander execs A:', tA.length, 'C:', tC.length);
for (let i = 0; i < Math.max(tA.length, tC.length); i++) {
  if (tA[i] !== tC[i]) {
    console.log('first divergent @', i);
    console.log('A ctx:', tA.slice(Math.max(0,i-4), i+4).join('\n'));
    console.log('C ctx:', tC.slice(Math.max(0,i-4), i+4).join('\n'));
    break;
  }
}
if (tA.join()===tC.join()) console.log('identical');
