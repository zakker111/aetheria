// Gossip regression test: second-hand opinions must actually spread through
// the population, must influence behavior-relevant affect, and must survive
// save/load without perturbing determinism. Deterministic (fixed seed).
import { Simulation } from '../src/simulation/simulation.js';

function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exit(1);
  }
  console.log(`PASS: ${name}`);
}

// --- Run A: uninterrupted long sim ---
const sim = new Simulation(20260926);
for (let i = 0; i < 4000; i++) sim.tick();

const withViews = sim.agents.filter(a => a.gossipViews && a.gossipViews.size > 0);
check('gossip spreads to at least one agent', withViews.length >= 1);
check('gossip reaches multiple agents (rumor mill is not dead code)', withViews.length >= 3);

// Views are bounded and sane
for (const a of sim.agents) {
  check(`agent ${a.id} gossip cap <= 12`, !a.gossipViews || a.gossipViews.size <= 12);
  for (const [subjectId, v] of (a.gossipViews || [])) {
    check(`agent ${a.id} view on ${subjectId} in [-10,10]`, Number.isFinite(v) && Math.abs(v) <= 10);
    check(`agent ${a.id} never gossips about themselves`, subjectId !== a.id);
  }
}

// Hearsay must feed the unified affect stream (_feltAbout includes it)
{
  const a = withViews[0];
  const tick = sim.clock.tick;
  const [subj, val] = a.gossipViews.entries().next().value;
  // With no first-hand signal, _feltAbout should still reflect hearsay sign.
  const rel = sim.relationshipSystem.getRelationship(a.id, subj);
  const hasFirstHand = (a.memories || []).some(m => m.subjectId === subj) || rel;
  if (!hasFirstHand) {
    const aff = a._feltAbout(subj, tick);
    if (val !== 0) {
      check('hearsay-only opinion colors affect', Math.sign(aff) === Math.sign(val));
    }
  } else {
    check('affect read runs with mixed evidence', Number.isFinite(a._feltAbout(subj, tick)));
  }
}

// --- Save/load preserves gossip state and stays deterministic ---
const saved = JSON.parse(JSON.stringify(sim.serialize()));
const resumed = Simulation.deserialize(saved);
for (let i = 0; i < 500; i++) resumed.tick();
for (let i = 0; i < 500; i++) sim.tick();

const fp = s => s.agents.map(a => `${a.id}:${a.x.toFixed(6)},${a.y.toFixed(6)},${a.gossipViews ? [...a.gossipViews.entries()].map(([k, v]) => `${k}=${v.toFixed(4)}`).join(';') : ''}`).sort().join('|');
check('gossip state survives save/load and resume is deterministic', fp(resumed) === fp(sim));

console.log('GOSSIP OK');
