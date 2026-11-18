import { Simulation } from '../src/simulation/simulation.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Cultural Wonders, Espionage/Guilds & Era Archive ---');

// 1. Cultural Wonders, Multi-Stage Construction & Buffs
{
  const sim = new Simulation(7171, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;
  assertTrue(Boolean(s1 && s2), 'initialized warring settlements for wonder & espionage tests');

  let surveyed = false;
  let stageCompleted = false;
  let wonderCompleted = false;
  sim.eventBus.on('WONDER_SURVEYED', (d) => {
    if (d.settlementId === s1.id && d.wonderKey === 'great_lighthouse') surveyed = true;
  });
  sim.eventBus.on('WONDER_STAGE_COMPLETED', (d) => {
    if (d.settlementId === s1.id && d.wonderKey === 'great_lighthouse') stageCompleted = true;
  });
  sim.eventBus.on('WONDER_COMPLETED', (d) => {
    if (d.settlementId === s1.id && d.wonderKey === 'great_lighthouse') wonderCompleted = true;
  });

  const w = sim.civilizationAgeSystem.commissionWonder(s1.id, 'great_lighthouse', 10);
  assertTrue(Boolean(w && surveyed && w.stage === 1), 'commissionWonder surveys Stage 1 Great Maritime Lighthouse');

  // Enable Masons Guild and verify 1.25x construction speed multiplier
  const g1 = sim.espionageSystem.getSettlementGuilds(s1.id);
  g1.unlocked.masons = true;
  assertTrue(sim.espionageSystem.getConstructionMultiplier(s1.id) === 1.25, 'Masons Guild grants 1.25x construction speed multiplier');

  sim.civilizationAgeSystem.advanceWonderProgress(s1.id, 80, 20); // 80 * 1.25 = 100 -> advances to stage 2!
  assertTrue(stageCompleted && w.stage === 2, 'Masons-boosted advanceWonderProgress promotes Great Lighthouse to Stage 2');

  sim.civilizationAgeSystem.advanceWonderProgress(s1.id, 200, 30); // finishes Stage 2 & Stage 3
  assertTrue(wonderCompleted && w.complete && w.stage === 3, 'advanceWonderProgress completes Stage 3 wonder');

  const buffs = sim.civilizationAgeSystem.getWonderBuffs(s1.id);
  assertTrue(buffs.tradeMultiplier === 1.3, 'completed Great Lighthouse grants 1.3x trade yield multiplier');

  // Colosseum morale buff on mobilized warband
  sim.civilizationAgeSystem.commissionWonder(s2.id, 'colosseum_champions', 35);
  sim.civilizationAgeSystem.advanceWonderProgress(s2.id, 300, 36);
  assertTrue(sim.civilizationAgeSystem.getWonderBuffs(s2.id).moraleBonus === 15, 'completed Colosseum grants +15 morale bonus');

  for (let i = 0; i < 8; i++) {
    const a = sim.spawnAgent(s2.center.x + (i % 3) - 1, s2.center.y + Math.floor(i / 3) - 1);
    a.age = 24;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.settlementId = s2.id;
    s2.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s2.id);
  }
  s2.population = s2.agentIds.size;
  const wb = sim.warfareSystem.mobilizeWarband(s2.id, s1.id, 'assault');
  assertTrue(Boolean(wb && wb.morale >= 100), 'Colosseum morale bonus boosts mobilized warband morale');
}

// 2. Guild Factions & Covert Espionage Operations (Granary, Bridge, Warhead, Blueprints, Revolt, Counter-Intel)
{
  const sim = new Simulation(8282, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;

  // Ensure adults exist in s2 for revolt incitement
  for (let i = 0; i < 6; i++) {
    const a = sim.spawnAgent(s2.center.x + (i % 2), s2.center.y + Math.floor(i / 2));
    a.age = 25;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.militaryDuty = false;
    a.warbandId = null;
    a.settlementId = s2.id;
    s2.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s2.id);
  }
  s2.population = s2.agentIds.size;

  // Granary sabotage
  s2.stockpile.food = 100;
  const opGranary = sim.espionageSystem.launchOperation(s1.id, s2.id, 'sabotage_granary', 50, { forceSuccess: true, forceDetected: true });
  assertTrue(Boolean(opGranary && opGranary.success && s2.stockpile.food < 100), 'sabotage_granary destroys enemy food reserves');
  assertTrue(Boolean(opGranary.what && opGranary.why && opGranary.drivers.length > 0), 'espionage op records causal what/why/drivers');

  // Bridge sabotage
  const bx = Math.max(2, Math.min(sim.world.width - 3, Math.floor(s2.center.x) + 1));
  const by = Math.max(2, Math.min(sim.world.height - 3, Math.floor(s2.center.y) + 1));
  sim.world.setBridge(bx, by, true);
  sim.infrastructureSystem.bridges.push({
    id: 991,
    tiles: [{ x: bx, y: by }, { x: bx + 1, y: by }],
    settlementId: s2.id,
    factionId: s2.factionId,
    health: 100,
  });
  sim.world.setBridge(bx + 1, by, true);
  const opBridge = sim.espionageSystem.launchOperation(s1.id, s2.id, 'sabotage_bridge', 60, { forceSuccess: true });
  assertTrue(Boolean(opBridge && opBridge.success), 'sabotage_bridge executes successfully');
  assertTrue(sim.infrastructureSystem.bridges[0].health === 0 && !sim.world.isBridge(bx, by),
    'sabotage_bridge collapses enemy bridge health and clears bridge tiles');

  // Warhead sabotage
  sim.civilizationAgeSystem.setSettlementAge(s2.id, 6, true);
  const prog2 = sim.civilizationAgeSystem.getNuclearProgram(s2.id);
  prog2.warheads = 2;
  prog2.progress = 80;
  const opNuke = sim.espionageSystem.launchOperation(s1.id, s2.id, 'sabotage_warhead', 70, { forceSuccess: true });
  assertTrue(Boolean(opNuke && opNuke.success && prog2.warheads === 1), 'sabotage_warhead neutralizes an armed enemy warhead');

  // Incite revolt
  const opRevolt = sim.espionageSystem.launchOperation(s1.id, s2.id, 'incite_revolt', 80, { forceSuccess: true });
  const hasRebelBand = Array.from(sim.warfareSystem.warbands.values()).some(wb => wb.isRebellion && wb.settlementId === s2.id);
  assertTrue(Boolean(opRevolt && opRevolt.success && hasRebelBand), 'incite_revolt triggers an armed urban uprising inside target city');

  // Counter-espionage sweep
  const opCounter = sim.espionageSystem.launchOperation(s1.id, s1.id, 'counter_espionage', 90);
  const g1 = sim.espionageSystem.getSettlementGuilds(s1.id);
  assertTrue(Boolean(opCounter && opCounter.success && g1.counterIntelUntil > 90), 'counter_espionage fortifies domestic security perimeter');
}

// 3. Era-by-Era Chronicle Filter + Full Save/Load Round-Trip Parity
{
  const simA = new Simulation(9393, 128, 128, { scenario: 'warring' });
  const simB = new Simulation(9393, 128, 128, { scenario: 'warring' });

  for (let t = 0; t < 180; t++) {
    simA.tick();
    simB.tick();
  }

  assertTrue(
    JSON.stringify(simA.espionageSystem.serialize()) === JSON.stringify(simB.espionageSystem.serialize()),
    'EspionageSystem maintains bit-exact determinism across identical seeds'
  );

  const s1 = Array.from(simA.settlementSystem.settlements.values())[0];
  simA.civilizationAgeSystem.commissionWonder(s1.id, 'atomic_reactor', simA.clock.tick);
  simA.civilizationAgeSystem.advanceWonderProgress(s1.id, 150, simA.clock.tick);

  simA.chronicleSystem.add('era', 'Early Tribal Harvest Festival', { eraId: 1, eraName: 'Tribal Era' });
  simA.chronicleSystem.add('war', 'Atomic Deterrence Pact', { eraId: 6, eraName: 'Modern Era' });

  const era1Entries = simA.chronicleSystem.getByEra(1);
  const era6Entries = simA.chronicleSystem.getByEra(6);
  assertTrue(era1Entries.some(e => e.text.includes('Early Tribal Harvest')), 'chronicleSystem.getByEra(1) returns Era 1 entries');
  assertTrue(era6Entries.some(e => e.text.includes('Atomic Deterrence Pact')) && !era6Entries.some(e => e.text.includes('Early Tribal Harvest')),
    'chronicleSystem.getByEra(6) filters cleanly to Modern Era entries');

  // Save & Deserialize
  const snapshot = simA.serialize();
  const restored = Simulation.deserialize(snapshot);
  const restoredWonder = restored.civilizationAgeSystem.getWonderState(s1.id);
  assertTrue(Boolean(restoredWonder && restoredWonder.key === 'atomic_reactor' && restoredWonder.stage >= 2),
    'save/load round-trip preserves active Cultural Wonder progress & stage');
  assertTrue(restored.chronicleSystem.getByEra(6).some(e => e.text.includes('Atomic Deterrence Pact')),
    'save/load round-trip preserves Era-tagged Chronicle entries');
  assertTrue(
    JSON.stringify(restored.espionageSystem.serialize()) === JSON.stringify(simA.espionageSystem.serialize()),
    'save/load round-trip preserves EspionageSystem guilds & operations log'
  );
}

console.log('ALL WONDERS, ESPIONAGE & ARCHIVE TESTS PASSED');
