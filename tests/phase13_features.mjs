import { Simulation } from '../src/simulation/simulation.js';
import { Building } from '../src/simulation/building.js';
import { Resource } from '../src/simulation/resource.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Phase 13 Features: Analytics, Faith Tools, Era Mountain Deposits, Raids & Civic Autonomy ---');

// 1. Statistics Analytics Snapshot, Telemetry History & Save/Load Parity
{
  const sim = new Simulation(5301, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 3, true); // Bronze/Iron/Medieval Era 3

  for (let i = 0; i < 45; i++) sim.tick();

  assertTrue(Array.isArray(sim.metricsHistory) && sim.metricsHistory.length >= 3,
    `metricsHistory records periodic telemetry snapshots (count=${sim.metricsHistory.length})`);

  const snap = sim.getStatisticsSnapshot();
  assertTrue(snap && snap.demographics?.totalLiving === sim.agents.length && snap.demographics.totalLiving > 0,
    `getStatisticsSnapshot returns accurate totalLiving=${snap?.demographics?.totalLiving}`);
  assertTrue(Array.isArray(snap.religions) && snap.religions.length >= 1,
    `getStatisticsSnapshot includes religion breakdown (${snap.religions.length} entries)`);
  assertTrue(Array.isArray(snap.professions) && snap.professions.length >= 1,
    `getStatisticsSnapshot includes profession demographics (${snap.professions.length} entries)`);
  const s1Row = snap.settlements.find((s) => s.id === s1.id);
  assertTrue(Boolean(s1Row && s1Row.eraName && s1Row.eraName !== 'Tribal'),
    `Statistics settlement ledger reads actual Era name (${s1Row?.eraName}) instead of falling back to Tribal`);

  const saved = sim.serialize();
  const restored = Simulation.deserialize(saved);
  assertTrue(restored.metricsHistory.length === sim.metricsHistory.length,
    `Save/load preserves metricsHistory length (${restored.metricsHistory.length})`);
}

// 2. Faith System: inspireArea & ReligionSystem performRitual tick handling
{
  const sim = new Simulation(5302, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const citizens = Array.from(s1.agentIds).map((id) => sim._agentById(id)).filter((a) => a && a.alive);
  assertTrue(citizens.length >= 2, 'Settlement has living citizens for faith tests');

  const target = citizens[0];
  target.religion = { faith: 20, maxFaith: 100, beliefId: 'grove_communion', lastRitualTime: 0, isPriest: false, sermonTimer: 0 };

  sim.clock.tick = 120;
  const inspireRes = sim.religionSystem.inspireArea(target.x, target.y, 10, 'solar_creed');
  assertTrue(inspireRes.inspired >= 1 && inspireRes.converted >= 1 && target.religion.beliefId === 'solar_creed' && target.religion.faith >= 45,
    `inspireArea converts & inspires citizens (inspired=${inspireRes.inspired}, converted=${inspireRes.converted}, faith=${target.religion.faith})`);

  const priest = citizens[1];
  priest.religion = { faith: 85, maxFaith: 100, beliefId: 'solar_creed', lastRitualTime: 0, isPriest: true, sermonTimer: 0 };
  const temple = new Building(Math.floor(priest.x), Math.floor(priest.y), 'temple', sim.idGen, s1.id, s1.factionId ?? null);
  temple.complete = true;
  temple.isComplete = true;
  temple.constructionProgress = 100;
  sim.buildings.push(temple);
  sim.religionSystem.performRitual(priest, temple);
  const activeRit = sim.religionSystem.activeRituals.get(temple.id);
  assertTrue(Boolean(activeRit && activeRit.startTime === 120 && activeRit.priestId === priest.id),
    `performRitual registers active ritual with sim clock tick (${activeRit?.startTime})`);
}

// 3. Era-Locked Iron Mountain (Era 2+) & Uranium Mountain (Era 6+) + Enrichment & Serialization
{
  const sim = new Simulation(5303, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 1, true);

  const ironMount = sim.createMountainDeposit(Math.floor(s1.center.x + 2), Math.floor(s1.center.y), 'iron_mountain');
  const uranMount = sim.createMountainDeposit(Math.floor(s1.center.x - 2), Math.floor(s1.center.y), 'uranium_mountain');

  assertTrue(ironMount.depositTier === 'iron_mountain' && ironMount.requiredEraId === 2 && ironMount.amount === 420,
    `createMountainDeposit spawns finite Era 2 Iron Lode (${ironMount.amount} ore)`);
  assertTrue(uranMount.depositTier === 'uranium_mountain' && uranMount.requiredEraId === 6 && uranMount.resourceType === 'uranium',
    `createMountainDeposit spawns finite Era 6 Uranium Vein (${uranMount.amount} uranium)`);

  const minerId = Array.from(s1.agentIds)[0];
  const miner = sim._agentById(minerId);
  miner.x = ironMount.x;
  miner.y = ironMount.y;
  miner.inventory.ore_iron = 0;
  miner.inventory.uranium = 0;

  // Era 1 must fail to mine Iron Mountain & Uranium Mountain (even across 2 harvest ticks)
  miner.executeAction({ type: 'mine_ore', target: ironMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  miner.executeAction({ type: 'mine_ore', target: ironMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  assertTrue((miner.inventory.ore_iron || 0) === 0 && ironMount.amount === 420,
    'Era 1 miner is blocked from mining Era 2 Iron Mountain deposit');

  // Era 2 unlocks Iron Mountain (+2 ore_iron) while Uranium still locked
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 2, true);
  miner.executeAction({ type: 'mine_ore', target: ironMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  miner.executeAction({ type: 'mine_ore', target: ironMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  assertTrue((miner.inventory.ore_iron || 0) >= 2 && ironMount.amount < 420,
    `Era 2 miner successfully extracts Iron Mountain deposit (inv ore=${miner.inventory.ore_iron}, rem=${ironMount.amount})`);

  miner.x = uranMount.x;
  miner.y = uranMount.y;
  miner.executeAction({ type: 'mine_ore', target: uranMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  miner.executeAction({ type: 'mine_ore', target: uranMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  assertTrue((miner.inventory.uranium || 0) === 0 && uranMount.amount === 280,
    'Era 2 miner is blocked from mining Era 6 Uranium Mountain deposit');

  // Era 6 unlocks Uranium extraction & accelerates nuclear enrichment
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 6, true);
  miner.executeAction({ type: 'mine_ore', target: uranMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  miner.executeAction({ type: 'mine_ore', target: uranMount }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  assertTrue((miner.inventory.uranium || 0) >= 1 && uranMount.amount < 280,
    `Era 6 miner successfully extracts Uranium Mountain deposit (inv uranium=${miner.inventory.uranium})`);

  // Deposit uranium to stockpile and confirm nuclear enrichment consumes uranium
  miner.x = s1.center.x;
  miner.y = s1.center.y;
  miner.executeAction({ type: 'deposit_to_stockpile', target: s1.center }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  assertTrue((s1.stockpile.uranium || 0) >= 1,
    `Miner deposits mined uranium into settlement stockpile (${s1.stockpile.uranium})`);

  for (const bType of ['factory', 'nuclear_plant']) {
    const b = new Building(Math.floor(s1.center.x + 1), Math.floor(s1.center.y + 1), bType, sim.idGen, s1.id, s1.factionId ?? null);
    b.complete = true;
    b.isComplete = true;
    b.constructionProgress = 100;
    sim.buildings.push(b);
    s1.buildings = s1.buildings || [];
    s1.buildings.push(b);
  }
  s1.stockpile.uranium = 5;
  s1.stockpile.ore = 0; // Verify mined uranium drives enrichment even without raw ore!
  const prog = sim.civilizationAgeSystem.getNuclearProgram(s1.id);
  prog.progress = 0;
  sim.civilizationAgeSystem.update(sim.civilizationAgeSystem.lastEvaluationTick + 20);
  assertTrue(prog.progress >= 15 && s1.stockpile.uranium === 4,
    `Nuclear warhead enrichment consumes mined uranium (${prog.progress}% progress, uranium=${s1.stockpile.uranium})`);

  const resCopy = Resource.deserialize(uranMount.serialize(), sim.idGen);
  assertTrue(resCopy.depositTier === 'uranium_mountain' && resCopy.requiredEraId === 6 && resCopy.resourceType === 'uranium',
    'Resource serialize/deserialize round-trips uranium mountain deposit metadata');
}

// 4. Periodic Map-Edge External Raids + Clean Retreat / Defense + Persistence
{
  const sim = new Simulation(5304, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  s1.stockpile.food = 40;
  s1.stockpile.wood = 30;
  s1.stockpile.ore = 20;

  const raidBand = sim.warfareSystem.spawnExternalRaid(s1.id, 300);
  assertTrue(Boolean(raidBand && raidBand.isExternalRaid && raidBand.soldiers.length >= 3),
    `spawnExternalRaid deploys ${raidBand?.soldiers?.length} border raiders (${raidBand?.raiderClan}) targeting ${s1.name}`);
  assertTrue(Boolean(raidBand.raidOrigin && (raidBand.raidOrigin.x <= 4 || raidBand.raidOrigin.x >= 123 || raidBand.raidOrigin.y <= 4 || raidBand.raidOrigin.y >= 123)),
    `External raid spawns near world map edge (${raidBand.raidOrigin.x.toFixed(1)}, ${raidBand.raidOrigin.y.toFixed(1)})`);

  // Save/load mid-raid preserves external raid fields
  const midSaved = sim.serialize();
  const midRestored = Simulation.deserialize(midSaved);
  const restoredBand = midRestored.warfareSystem.warbands.get(raidBand.id);
  const restoredRaider = midRestored._agentById(raidBand.soldiers[0]);
  assertTrue(Boolean(restoredBand?.isExternalRaid && restoredRaider?.isExternalRaider && restoredRaider?.raiderClan === raidBand.raiderClan),
    'Save/load preserves active external raid warband and raider flags');

  // Verify raiders actively detect defenders and defenders detect raiders
  const firstRaider = sim._agentById(raidBand.soldiers[0]);
  const townCitizen = Array.from(s1.agentIds).map((id) => sim._agentById(id)).find((a) => a && a.alive);
  firstRaider.x = townCitizen.x + 1.2;
  firstRaider.y = townCitizen.y;
  const seenByRaider = sim.warfareSystem.getAllNearbyEnemies(firstRaider, raidBand.settlementId, 6);
  const seenByTown = sim.warfareSystem.getAllNearbyEnemies(townCitizen, s1.id, 6);
  assertTrue(seenByRaider.some((e) => e.id === townCitizen.id) && seenByTown.some((e) => e.id === firstRaider.id),
    'External raiders and town defenders detect one another in combat scans without diplomatic war state');

  // Verify retreating raiders reaching raidOrigin depart cleanly without inflating mortalityStats
  const deathsBefore = sim.mortalityStats.totalDeaths;
  raidBand.state = 'retreating';
  for (const sid of raidBand.soldiers) {
    const r = sim._agentById(sid);
    if (r) { r.x = raidBand.raidOrigin.x; r.y = raidBand.raidOrigin.y; }
  }
  sim.tick();
  assertTrue(!raidBand.active && sim.mortalityStats.totalDeaths === deathsBefore,
    'Retreating border raiders cross map edge cleanly without inflating citizen mortalityStats');
}

// 5. Autonomous Ruin Demolition, Obsolete Road Cleanup & Plausible Peace Treaties
{
  const sim = new Simulation(5305, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const s2 = settlements[1];

  // A) Autonomous Ruin Clearing & Salvage
  const ruin = new Building(Math.floor(s1.center.x + 2), Math.floor(s1.center.y - 1), 'house', sim.idGen, s1.id, s1.factionId ?? null);
  ruin.complete = true;
  ruin.health = 0;
  ruin.isRuined = true;
  ruin.ruinedAtTick = 1;
  sim.buildings.push(ruin);
  sim.world.addToSpatialIndex(ruin.x, ruin.y, ruin);

  const woodBefore = s1.stockpile.wood || 0;
  const oreBefore = s1.stockpile.ore || 0;
  sim.clock.tick = 120;
  sim.updateSettlements();
  assertTrue(!sim.buildings.includes(ruin) && s1.stockpile.wood >= woodBefore + 3 && s1.stockpile.ore >= oreBefore + 2,
    `Active settlement autonomously clears nearby ruin and salvages +3 wood / +2 ore`);

  // B) Obsolete Road Cleanup (flooded / cratered tiles)
  const rx = 20, ry = 20;
  const rIdx = ry * sim.world.width + rx;
  sim.world.roadTiles[rIdx] = 1;
  sim.world.craterTiles[rIdx] = 75;
  sim.infrastructureSystem.cleanObsoleteInfrastructure();
  assertTrue(sim.world.roadTiles[rIdx] === 0,
    'cleanObsoleteInfrastructure clears obsolete road tiles buried in heavy craters');

  // C) Plausible Peace: Deadlocked stalemate signs White Peace, NOT unearned Conquest & Annexation
  let war = sim.diplomacySystem.activeWars.find((w) => w.active);
  if (!war) {
    war = sim.diplomacySystem.declareWar(s1.id, s2.id, 'Border Dispute (Conquest)');
  }
  war.casualties[war.attackerId] = 4;
  war.casualties[war.defenderId] = 4;
  war.weariness = { [war.attackerId]: 55, [war.defenderId]: 55 };
  war.casusBelli = 'Conquest';
  war.goal = 'conquest';
  war.isConquest = true;
  const attSet = sim.settlementSystem.settlements.get(war.attackerId);
  const defSet = sim.settlementSystem.settlements.get(war.defenderId);
  const report = sim.diplomacySystem.convenePeaceConference(war.attackerId, war.defenderId, null, 'War Weariness');
  const latestLog = sim.diplomacySystem.diplomaticHistory[0];
  assertTrue(
    Boolean(report && report.terms === 'White Peace Concordat' && attSet.status !== 'annexed' && defSet.status !== 'annexed' && latestLog && !String(latestLog.title || '').includes('Annexation')),
    `Deadlocked stalemate war signs plausible peace (${report?.terms} / ${latestLog?.title}) without unearned annexation`
  );
}

console.log('ALL PHASE 13 FEATURE TESTS PASSED!');
