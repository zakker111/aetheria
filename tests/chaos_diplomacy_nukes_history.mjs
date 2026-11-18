import { Simulation } from '../src/simulation/simulation.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Chaos Warfare, Diplomacy Causal Feed, Nukes & Agent History ---');

// 1. Agent LifeHistory, Dossier & Fallen Memorial across save/load
{
  const sim = new Simulation(4242, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  assertTrue(settlements.length >= 3, 'warring scenario starts with at least 3 settlements');

  const s1 = settlements[0];

  // Ensure an agent goes through multiple lifecycle/relationship/combat milestones
  const hero = sim.agents.find(a => a.alive && a.settlementId === s1.id && a.age >= 18);
  const mate = sim.agents.find(a => a.alive && a.id !== hero.id && a.age >= 18);
  assertTrue(Boolean(hero && mate), 'found living adult agents for history tracking');
  assertTrue(Array.isArray(hero.lifeHistory) && hero.lifeHistory.length >= 1, 'agent initialized with origin/career lifeHistory milestones');

  sim.relationshipSystem.marry(hero.id, mate.id);
  assertTrue(hero.lifeHistory.some(ev => ev.kind === 'MARRIAGE'), 'marriage recorded MARRIAGE milestone on hero lifeHistory');

  const liveDossier = sim.getAgentDossier(hero.id);
  assertTrue(Boolean(liveDossier && liveDossier.spouse?.id === mate.id), 'getAgentDossier resolves living spouse bond');
  assertTrue(liveDossier.lifeHistory.length >= 2, 'getAgentDossier exposes chronological lifeHistory');

  // Inspect death & Fallen Memorial archival
  const deadId = hero.id;
  sim.removeAgent(deadId, 'combat');
  const fallenDossier = sim.getAgentDossier(deadId);
  assertTrue(Boolean(fallenDossier && fallenDossier.alive === false), 'getAgentDossier retains Fallen Memorial after agent death');
  assertTrue(fallenDossier.deathCause === 'combat', 'Fallen Memorial preserves death cause');
  assertTrue(fallenDossier.lifeHistory.some(ev => ev.kind === 'DEATH'), 'Fallen Memorial records DEATH milestone');

  // Save/load preserves deadDossiers & lifeHistory
  const saved = sim.serialize();
  const reloaded = Simulation.deserialize(saved);
  const reloadedFallen = reloaded.getAgentDossier(deadId);
  assertTrue(Boolean(reloadedFallen && reloadedFallen.alive === false && reloadedFallen.deathCause === 'combat'),
    'save/load preserves deadDossiers Fallen Memorial');
}

// 2. Multi-front Warfare, Era 2-4 Catapults, Rebellions & Total City Collapse
{
  const sim = new Simulation(5151, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2, s3] = settlements;

  // Ensure s1 has enough adults & Era 3 unlocked for siege catapults + two fronts
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 3, true);
  for (let i = 0; i < 14; i++) {
    const a = sim.spawnAgent(s1.center.x + (i % 3) - 1, s1.center.y + Math.floor(i / 3) - 1);
    a.age = 24;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.settlementId = s1.id;
    s1.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s1.id);
  }
  s1.population = s1.agentIds.size;

  const rel12 = sim.diplomacySystem.getRelation(s1.id, s2.id);
  const rel13 = sim.diplomacySystem.getRelation(s1.id, s3.id);
  if (rel12) rel12.truceUntilTick = 0;
  if (rel13) rel13.truceUntilTick = 0;

  const w1 = sim.diplomacySystem.declareWar(s1.id, s2.id, 'Militarist Aggression — Conquest', 10);
  const w2 = sim.diplomacySystem.declareWar(s1.id, s3.id, 'Resource Wars — Ore Greed', 10);
  assertTrue(Boolean(w1 && w2), 'settlement can declare multi-front wars on two neighbors');

  const s1Bands = Array.from(sim.warfareSystem.warbands.values()).filter(wb => wb.settlementId === s1.id && wb.active);
  assertTrue(s1Bands.length >= 2, `multi-front warfare mobilized ${s1Bands.length} concurrent warbands for one settlement`);

  const hasCatapult = Array.from(sim.agents).some(a => a.alive && a.settlementId === s1.id && a.combat?.weaponType === 'catapult');
  assertTrue(hasCatapult, 'Era 3 mobilized warband includes siege catapult slot');

  // Trigger Urban Rebellion inside weakened settlement s2
  const s2Citizens = sim.agents.filter(a => a.alive && a.settlementId === s2.id && a.age >= 18);
  assertTrue(s2Citizens.length >= 2, 's2 has living citizens to rebel');
  for (const c of s2Citizens) {
    c.militaryDuty = false;
    c.warbandId = null;
  }
  const rebelBand = sim.warfareSystem.spawnUrbanRebellion(s2.id, 'Siege starvation & war exhaustion', 150);
  assertTrue(Boolean(rebelBand && rebelBand.isRebellion), 'spawnUrbanRebellion raises armed insurgent warband inside city');

  // Test total collapse of s3
  let collapseEmitted = false;
  sim.eventBus.on('SETTLEMENT_COLLAPSED', (d) => {
    if (d.id === s3.id) collapseEmitted = true;
  });
  const collapsed = sim.settlementSystem.collapseSettlement(s3.id, 'Razed to total ash', s1.id, 180);
  assertTrue(collapsed && collapseEmitted, 'collapseSettlement emits SETTLEMENT_COLLAPSED event');
  assertTrue(!sim.settlementSystem.settlements.has(s3.id), 'collapsed settlement removed completely from settlement registry');
  assertTrue(sim.world.skullMonuments.some(m => m.kind === 'city_ruin'), 'collapsed city stamps city_ruin monument');
}

// 3. Diplomatic Causal Feed ("What Occurred & Why"), Sanctions, Ultimatums, Nuclear Strikes & Fallout
{
  const sim = new Simulation(6262, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;

  // Sanctions & Ultimatums
  const rel = sim.diplomacySystem.getRelation(s1.id, s2.id);
  rel.status = 'tension';
  rel.score = 26;
  rel.truceUntilTick = 0;

  const sancOk = sim.diplomacySystem.imposeSanctions(s1.id, s2.id, 'Embargo over iron border tariffs', 20);
  assertTrue(sancOk, 'imposeSanctions succeeds between tense neighbors');

  const ultRes = sim.diplomacySystem.issueUltimatum(s1.id, s2.id, 'tribute', 'Demanded reparations for border raids', 25);
  assertTrue(Boolean(ultRes && (ultRes.outcome === 'accepted' || ultRes.outcome === 'rejected')), 'issueUltimatum resolves deterministically');

  const dipHistory = sim.diplomacySystem.diplomaticHistory;
  assertTrue(dipHistory.length >= 2, `diplomaticHistory recorded ${dipHistory.length} causal entries`);
  assertTrue(dipHistory.every(e => e.title && e.what && e.why && Array.isArray(e.drivers)),
    'every diplomaticHistory entry provides title, what, why, and drivers');

  // Advance s1 to Modern Era (Era 6) & verify Nuclear Program requires Factory + Nuclear Plant infra
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 6, true);
  if (s1.stockpile) s1.stockpile.ore = 200;
  for (let t = 20; t <= 80; t += 20) {
    sim.civilizationAgeSystem.update(t);
  }
  const prog = sim.civilizationAgeSystem.getNuclearProgram(s1.id);
  assertTrue(Boolean(prog && prog.unlocked), 'Era 6 unlocks settlement Nuclear Program');
  assertTrue(prog.warheads === 0 && prog.progress === 0, 'Atomic enrichment stays halted until Factory + Nuclear Plant are built');

  s1.buildings = s1.buildings || [];
  const fBld = { id: sim.idGen.next(), type: 'building', buildingType: 'factory', settlementId: s1.id, complete: true, isRuined: false, health: 190, x: s1.center.x + 2, y: s1.center.y };
  const nBld = { id: sim.idGen.next(), type: 'building', buildingType: 'nuclear_plant', settlementId: s1.id, complete: true, isRuined: false, health: 240, x: s1.center.x - 2, y: s1.center.y };
  sim.buildings.push(fBld, nBld);
  s1.buildings.push(fBld, nBld);
  for (let t = 100; t <= 260; t += 20) {
    sim.civilizationAgeSystem.update(t);
  }
  assertTrue(prog.warheads >= 1 || prog.progress > 0, 'Modern Era enriches warhead progress once Factory + Nuclear Plant are operational');

  // Spawn an extra citizen in radiation zone to verify radiation damage & decay
  const victim = sim.spawnAgent(s2.center.x + 2, s2.center.y + 2);
  victim.health = 100;
  if (victim.needs) victim.needs.health = 100;

  const nukeRes = sim.detonateNuclearStrike({
    x: s2.center.x,
    y: s2.center.y,
    attackerSettlementId: s1.id,
    targetSettlementId: s2.id,
    reason: 'Strategic nuclear deterrence strike',
    isGodPower: false
  });
  assertTrue(Boolean(nukeRes), 'detonateNuclearStrike executes atomic blast');
  assertTrue(sim.world.getCrater(Math.floor(s2.center.x), Math.floor(s2.center.y)) > 0, 'nuclear blast stamps craterTiles at ground zero');
  assertTrue(sim.world.getRadiation(Math.floor(s2.center.x), Math.floor(s2.center.y)) > 0, 'nuclear blast leaves radiationTiles fallout');
  assertTrue(sim.world.skullMonuments.some(m => m.kind === 'nuke'), 'nuclear strike stamps nuke ground-zero monument');
  assertTrue(sim.diplomacySystem.diplomaticHistory.some(e => e.type === 'nuke'), 'diplomaticHistory logs nuclear strike what & why');

  const initialRad = sim.world.getRadiation(Math.floor(s2.center.x), Math.floor(s2.center.y));
  for (let i = 0; i < 40; i++) {
    sim.tick();
  }
  const decayedRad = sim.world.getRadiation(Math.floor(s2.center.x), Math.floor(s2.center.y));
  assertTrue(decayedRad < initialRad, `fallout radiation decays over ticks (${initialRad} -> ${decayedRad})`);
}

// 4. Determinism & Save/Load Parity under Craters, Radiation, Monuments & Dead Dossiers
{
  const simA = new Simulation(9090, 128, 128, { scenario: 'warring' });
  const simB = new Simulation(9090, 128, 128, { scenario: 'warring' });

  for (let i = 0; i < 80; i++) {
    simA.tick();
    simB.tick();
  }

  // Trigger identical nuclear strike on both
  const sA = Array.from(simA.settlementSystem.settlements.values())[0];
  const sB = Array.from(simB.settlementSystem.settlements.values())[0];
  simA.detonateNuclearStrike({ x: sA.center.x, y: sA.center.y, isGodPower: true, reason: 'Parity check' });
  simB.detonateNuclearStrike({ x: sB.center.x, y: sB.center.y, isGodPower: true, reason: 'Parity check' });

  // Save/load simB mid-fallout, then advance both 60 more ticks
  const simBLoaded = Simulation.deserialize(simB.serialize());
  for (let i = 0; i < 60; i++) {
    simA.tick();
    simBLoaded.tick();
  }

  const snapA = JSON.stringify({
    tick: simA.clock.tick,
    agents: simA.agents.length,
    births: simA.birthsThisSession,
    deaths: simA.deathsThisSession,
    rad: Array.from(simA.world.radiationTiles),
    craters: Array.from(simA.world.craterTiles),
    monuments: simA.world.skullMonuments.length,
    diploEvents: simA.diplomacySystem.diplomaticHistory.length
  });
  const snapB = JSON.stringify({
    tick: simBLoaded.clock.tick,
    agents: simBLoaded.agents.length,
    births: simBLoaded.birthsThisSession,
    deaths: simBLoaded.deathsThisSession,
    rad: Array.from(simBLoaded.world.radiationTiles),
    craters: Array.from(simBLoaded.world.craterTiles),
    monuments: simBLoaded.world.skullMonuments.length,
    diploEvents: simBLoaded.diplomacySystem.diplomaticHistory.length
  });

  assertTrue(snapA === snapB, 'save/load round-trip maintains 100% deterministic parity with fallout, craters, monuments & diplomacy');
}

console.log('ALL CHAOS WARFARE, DIPLOMACY, NUCLEAR & AGENT HISTORY TESTS PASSED!');
