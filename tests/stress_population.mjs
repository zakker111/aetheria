// High-Agent Population Stress Test: Benchmarks 1,500+ active agents
// with Spatial LOD, time-sliced tick budgeting, and simplified macro simulation.
import { Simulation } from '../src/simulation/simulation.js';
import { Agent } from '../src/simulation/agent.js';

const SEED = 4321;
const TARGET_AGENTS = 1500;
const TICKS = 300;

console.log(`Starting High-Agent Population Stress Test with target ${TARGET_AGENTS} agents...`);
const sim = new Simulation(SEED);

// Set realistic camera viewport to simulate an active player viewing settlement 1 (25x20 tile window)
sim.setViewportBounds({ minX: 50, maxX: 75, minY: 50, maxY: 70, zoom: 14 });

// Advance 30 ticks to allow world & starter settlements to form
for (let i = 0; i < 30; i++) sim.tick();

// Spawn additional agents across the world to reach the high-population stress target
let spawned = 0;
while (sim.agents.length < TARGET_AGENTS && spawned < 2000) {
  const x = 5 + Math.floor(sim._rng().next() * (sim.world.width - 10));
  const y = 5 + Math.floor(sim._rng().next() * (sim.world.height - 10));
  if (sim.world.isWalkable(x, y)) {
    const ag = new Agent(x, y, sim.idGen, 20 + Math.floor(sim._rng().next() * 30), sim.world.rng);
    // Assign some agents to settlements if nearby
    for (const s of sim.settlementSystem.settlements.values()) {
      if (Math.hypot(s.center.x - x, s.center.y - y) < 18) {
        ag.settlementId = s.id;
        s.agentIds.add(ag.id);
        break;
      }
    }
    sim.addAgent(ag);
    sim.world.addToSpatialIndex(x, y, ag);
    spawned++;
  }
}

console.log(`Population initialized: ${sim.agents.length} living agents across world.`);

let totalTickMs = 0;
let maxTickMs = 0;
const tStart = performance.now();

for (let tick = 0; tick < TICKS; tick++) {
  const t0 = performance.now();
  sim.tick();
  const d = performance.now() - t0;
  totalTickMs += d;
  if (d > maxTickMs) maxTickMs = d;

  // Verify numerical stability
  for (let j = 0; j < Math.min(sim.agents.length, 50); j++) {
    const a = sim.agents[j];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) {
      throw new Error(`NaN position on agent ${a.id} at tick ${tick}`);
    }
    if (!Number.isFinite(a.needs.food) || !Number.isFinite(a.needs.water)) {
      throw new Error(`NaN needs on agent ${a.id} at tick ${tick}`);
    }
  }
}

const wallSec = (performance.now() - tStart) / 1000;
const avgTickMs = totalTickMs / TICKS;

console.log(`--- Stress Test Results ---`);
console.log(`Ticks simulated: ${TICKS}`);
console.log(`Final agent count: ${sim.agents.length}`);
console.log(`LOD Distribution: T0(Focus)=${sim.lodStats.tier0} | T1(Active)=${sim.lodStats.tier1} | T2(Macro)=${sim.lodStats.tier2}`);
console.log(`Average tick duration: ${avgTickMs.toFixed(3)} ms`);
console.log(`Maximum tick duration: ${maxTickMs.toFixed(2)} ms`);
console.log(`Total wall-clock duration: ${wallSec.toFixed(2)} s`);

if (sim.agents.length === 0) {
  throw new Error('All agents died during stress test!');
}

if (avgTickMs > 32.0) {
  throw new Error(`Average tick ${avgTickMs.toFixed(2)}ms exceeded 32ms threshold!`);
}

// Test save/load integrity under high population
const save = JSON.parse(JSON.stringify(sim.serialize()));
const loaded = Simulation.deserialize(save);
if (loaded.agents.length !== sim.agents.length) {
  throw new Error(`Save/load mismatch: saved ${sim.agents.length} agents, restored ${loaded.agents.length}`);
}

console.log('HIGH POPULATION STRESS TEST PASSED SUCCESSFULLY!');
