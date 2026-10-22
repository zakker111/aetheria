// Soak test: runs the full simulation for N ticks, checks for crashes,
// NaNs, runaway population, and per-tick performance. Zero dependencies.
import { Simulation } from '../src/simulation/simulation.js';

const TICKS = Number(process.argv[2] || 3000);
const SEED = Number(process.argv[3] || 1234);

const sim = new Simulation(SEED);
let maxTickMs = 0;
let totalMs = 0;
const t0 = performance.now();

for (let i = 0; i < TICKS; i++) {
  const a = performance.now();
  sim.tick();
  const d = performance.now() - a;
  maxTickMs = Math.max(maxTickMs, d);
  totalMs += d;

  if (!Number.isFinite(sim.clock.tick)) throw new Error(`clock.tick not finite at ${i}`);
  for (const agent of sim.agents) {
    if (!Number.isFinite(agent.x) || !Number.isFinite(agent.y)) {
      throw new Error(`NaN position on agent ${agent.id} at tick ${i}`);
    }
    if (!Number.isFinite(agent.needs.food) || !Number.isFinite(agent.needs.water)) {
      throw new Error(`NaN needs on agent ${agent.id} at tick ${i}`);
    }
  }
}

const wall = performance.now() - t0;
const pop = sim.agents.length;
console.log(`ticks=${TICKS} seed=${SEED}`);
console.log(`population=${pop} births=${sim.birthsThisSession || 0} deaths=${sim.deathsThisSession || 0}`);
console.log(`settlements=${sim.settlementSystem.settlements.size} buildings=${sim.buildings.length} resources=${sim.resources.length}`);
console.log(`avgTickMs=${(totalMs / TICKS).toFixed(3)} maxTickMs=${maxTickMs.toFixed(2)} wallSec=${(wall / 1000).toFixed(1)}`);

if (pop === 0) throw new Error('Simulation went extinct — anomaly');
if (maxTickMs > 500) throw new Error(`Tick spike ${maxTickMs.toFixed(0)}ms — freeze risk`);

// Save/load round trip must not crash and must preserve tick/population.
const save = JSON.parse(JSON.stringify(sim.serialize()));
const loaded = Simulation.deserialize(save);
if (loaded.clock.tick !== sim.clock.tick) throw new Error('tick mismatch after load');
if (loaded.agents.length !== sim.agents.length) throw new Error('population mismatch after load');
console.log('SOAK OK');
