import { Simulation } from '../src/simulation/simulation.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Citizen Spawning Fixes & Active Diplomacy ---');

// 1. Citizen Spawning: complete initialization, no duplicate pioneer founding, no birth inflation
{
  const sim = new Simulation(2026, 128, 128, { scenario: 'peaceful' });
  const initialSettlements = sim.settlementSystem.settlements.size;
  const initialBirths = sim.birthsThisSession;

  // Find a walkable wilderness spot >= 30 tiles away from all existing towns
  let wildX = null;
  let wildY = null;
  for (let y = 18; y < 110 && wildX === null; y += 4) {
    for (let x = 18; x < 110 && wildX === null; x += 4) {
      if (!sim.world.isWalkable(x, y)) continue;
      const far = Array.from(sim.settlementSystem.settlements.values()).every(
        s => !s.center || Math.hypot(s.center.x - x, s.center.y - y) >= 30
      );
      if (far) {
        wildX = x + 0.5;
        wildY = y + 0.5;
      }
    }
  }
  assertTrue(wildX !== null && wildY !== null, `Found wilderness frontier site at (${wildX}, ${wildY})`);

  const spawned = [];
  for (let i = 0; i < 6; i++) {
    const a = sim.spawnAgent(wildX + (i % 3) * 0.6, wildY + Math.floor(i / 3) * 0.6);
    spawned.push(a);
  }

  assertTrue(sim.birthsThisSession === initialBirths,
    'Divine/manual spawnAgent does not inflate natural birthsThisSession counter');
  assertTrue(
    spawned.every(a => a.combat && a.religion && a.spawnX != null && a.lifeHistory.some(e => e.kind === 'ORIGIN') && sim.relationshipSystem.relationships.has(a.id)),
    'Spawned citizens initialize combat, religion, relationships, spawnX/Y, and ORIGIN lifeHistory'
  );

  // Verify combat lethality works cleanly on spawned citizens
  const lethal = sim.combatSystem.dealDamage(spawned[0], spawned[1], 150);
  assertTrue(lethal === true && spawned[1].alive === false,
    'Spawned citizen takes lethal combat damage cleanly (combat component present)');

  // Run 25 ticks so updateSettlements/updatePioneers colonize cleanly
  for (let t = 0; t < 25; t++) sim.tick();

  const afterSettlements = sim.settlementSystem.settlements.size;
  assertTrue(afterSettlements === initialSettlements + 1,
    `Spawning 5+ living pioneers together founds exactly 1 settlement (was ${initialSettlements}, now ${afterSettlements})`);

  const newest = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => b.id - a.id)[0];
  assertTrue(Boolean(newest && newest.agentIds.size >= 4),
    `Founded frontier settlement ${newest?.name} holds cohesive pioneer population (${newest?.agentIds?.size})`);

  const settledPioneersLeft = spawned.filter(a => a.alive && a.pioneer).length;
  assertTrue(settledPioneersLeft === 0, 'Founded pioneers clear their pioneer flag after settling');

  // Verify diplomacy relations initialized with existing settlements
  const existingOther = Array.from(sim.settlementSystem.settlements.values()).find(s => s.id !== newest.id);
  const relWithExisting = existingOther ? sim.diplomacySystem.getRelation(newest.id, existingOther.id) : null;
  assertTrue(Boolean(relWithExisting && typeof relWithExisting.score === 'number'),
    'Newly founded pioneer settlement has active diplomatic relations with neighbor realms');
}

// 2. Wall-safe spawning & cap expansion via Simulation.spawnCitizenAt
{
  const sim = new Simulation(3030, 128, 128, { scenario: 'modern_nuclear', maxAgents: 60 });
  const s0 = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id)[0];
  const wallSeg = Array.from(sim.fortificationSystem.segments.values()).find(seg => seg.settlementId === s0.id && seg.kind === 'wall');

  if (wallSeg) {
    const beforeCount = sim.agents.length;
    const spawnedOnWall = sim.spawnCitizenAt(wallSeg.x + 0.5, wallSeg.y + 0.5);
    assertTrue(Boolean(spawnedOnWall && sim.agents.length === beforeCount + 1),
      'Spawning on a fortified wall segment safely nudges citizen to adjacent clear tile');
    assertTrue(!sim.fortificationSystem.isBlockedForAgent(Math.floor(spawnedOnWall.x), Math.floor(spawnedOnWall.y), { settlementId: null }),
      'Nudged spawned citizen is not trapped inside a wall');
  }

  // Test cap expansion when player spawns past maxAgents
  sim.maxAgents = sim.agents.length;
  const extra = sim.spawnCitizenAt(s0.center.x, s0.center.y);
  assertTrue(Boolean(extra && sim.agents.length <= sim.maxAgents && sim.maxAgents > 60),
    `spawnCitizenAt expands maxAgents cap (${sim.maxAgents}) when spawning extra citizens`);
}

// 3. Modern & Nuclear Geopolitical Web + Defensive Alliance Intervention
{
  const sim = new Simulation(777, 128, 128, { scenario: 'modern_nuclear' });
  const dsys = sim.diplomacySystem;

  assertTrue(dsys.activeWars.some(w => w.active && w.totalWar),
    'Modern & Nuclear scenario boots with an active Total War');
  assertTrue(dsys.treaties.length >= 1 && Array.from(dsys.relations.values()).some(r => r.status === 'alliance'),
    `Modern & Nuclear scenario boots with active Alliance Pact (${dsys.treaties.length} treaties)`);
  assertTrue(Array.from(dsys.relations.values()).some(r => (r.sanctionedUntil || 0) > 0),
    'Modern & Nuclear scenario boots with active trade sanctions');
  assertTrue(dsys.diplomaticHistory.length >= 3,
    `Diplomacy causal history immediately records War, Alliance, and Sanctions (${dsys.diplomaticHistory.length} events)`);

  // Verify callAlliesToWar registers an official tracked activeWars record when an allied defender is attacked
  const sim2 = new Simulation(5151, 128, 128, { scenario: 'peaceful' });
  const towns = Array.from(sim2.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  if (towns.length >= 3) {
    const [a, b, c] = towns;
    sim2.diplomacySystem.formAlliance(b.id, c.id, 10);
    sim2.diplomacySystem.declareWar(a.id, b.id, 'Border Expansion', 15);
    const allyWar = sim2.diplomacySystem.activeWars.find(
      w => w.active && ((w.attackerId === c.id && w.defenderId === a.id) || (w.attackerId === a.id && w.defenderId === c.id))
    );
    assertTrue(Boolean(allyWar),
      'callAlliesToWar creates an official tracked activeWars entry for intervening ally');
  }
}

console.log('ALL CITIZEN SPAWNING & DIPLOMACY TESTS PASSED!');
