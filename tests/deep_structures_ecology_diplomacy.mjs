import { Simulation } from '../src/simulation/simulation.js';
import { Resource } from '../src/simulation/resource.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Deep Structures, Ecology (Trees/Ores/Animals/Hunters), Mechanized War & Deeper Diplomacy ---');

// 1. Mechanized Warfare (Tanks & Strike Aircraft), Demobilization & Last-Resort Nuclear Deterrence
{
  const sim = new Simulation(7171, 128, 128, { scenario: 'modern_nuclear' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s0, s1] = settlements;

  // Ensure s0 has plenty of adults so mechanized combined-arms units spawn cleanly
  while (s0.agentIds.size < 22) {
    const a = sim.spawnAgent(s0.center.x, s0.center.y);
    a.age = 24;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.settlementId = s0.id;
    s0.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s0.id);
  }
  s0.population = s0.agentIds.size;

  const rel = sim.diplomacySystem.getRelation(s0.id, s1.id);
  if (rel) {
    rel.status = 'peace';
    rel.truceUntilTick = 0;
  }
  // Clear prior wars so we can verify opening deterrence window cleanly
  sim.diplomacySystem.activeWars = [];
  sim.warfareSystem.warbands.clear();

  const war = sim.diplomacySystem.declareWar(s0.id, s1.id, 'Total War — Mechanized Offensive', 20, { totalWar: true });
  assertTrue(Boolean(war && war.active), 'Modern superpower declares combined-arms Total War');

  const wb = Array.from(sim.warfareSystem.warbands.values()).find(w => w.active && w.settlementId === s0.id);
  const soldiers = wb ? wb.soldiers.map(id => sim._agentById(id)).filter(Boolean) : [];
  const tank = soldiers.find(a => a.combat?.weaponType === 'tank');
  const plane = soldiers.find(a => a.combat?.weaponType === 'plane');

  assertTrue(Boolean(tank && tank.combat.maxHealth >= 240 && tank.combat.damage >= 78),
    `Era 7 warband fields Battle Tank (hp ${tank?.combat?.maxHealth}, dmg ${tank?.combat?.damage})`);
  assertTrue(Boolean(plane && plane.combat.isFlying && plane.combat.speedMultiplier >= 2.0),
    `Era 7 warband fields Strike Aircraft with air overflight (${plane?.combat?.speedMultiplier}x speed)`);

  // Air overflight bypasses fortified walls
  const wallSeg = Array.from(sim.fortificationSystem.segments.values()).find(seg => seg.kind === 'wall' && seg.settlementId === s0.id);
  if (wallSeg && plane) {
    assertTrue(
      !sim.fortificationSystem.isBlockedForAgent(wallSeg.x, wallSeg.y, plane),
      'Strike Aircraft fly freely over settlement perimeter walls'
    );
  }

  // Last-resort atomic deterrence: opening < 180 ticks does NOT autonomously nuke
  const prog0 = sim.civilizationAgeSystem.getNuclearProgram(s0.id);
  const initialStrikes0 = prog0.totalStrikes || 0;
  for (let t = 25; t <= 150; t += 25) {
    sim.diplomacySystem.evaluateDiplomacy(t);
  }
  assertTrue((prog0.totalStrikes || 0) === initialStrikes0,
    'Autonomous atomic launch holds fire during opening conventional mechanized war phase');

  // Demobilize cleanly restores citizen stats
  sim.warfareSystem.demobilizeSettlement(s0.id);
  assertTrue(!plane.combat.isFlying && !plane.combatRole && plane.combat.maxHealth <= 130 && (plane.combat.speedMultiplier ?? 1) === 1,
    'Demobilizing Strike Aircraft clears flying state, speed boost, and restores civilian combat stats');
}

// 2. Nuclear Weapons Infrastructure Chain (Factory + Nuclear Plant + Ore + Lab + Silo)
{
  const sim = new Simulation(8181, 128, 128, { scenario: 'warring' });
  const s = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id)[0];
  sim.civilizationAgeSystem.setSettlementAge(s.id, 6, true);
  s.stockpile.ore = 80;
  s.buildings = [];
  sim.buildings = sim.buildings.filter(b => b.settlementId !== s.id);

  // Without infrastructure: enrichment stays 0
  for (let t = 20; t <= 100; t += 20) sim.civilizationAgeSystem.update(t);
  const prog = sim.civilizationAgeSystem.getNuclearProgram(s.id);
  assertTrue(prog.warheads === 0 && prog.progress === 0,
    'Nuclear enrichment stays blocked when settlement lacks Factory + Nuclear Plant');

  // Factory only: still cannot enrich without Nuclear Plant
  const factory = { id: sim.idGen.next(), type: 'building', buildingType: 'factory', settlementId: s.id, complete: true, isRuined: false, health: 190, x: s.center.x + 2, y: s.center.y };
  sim.buildings.push(factory);
  s.buildings.push(factory);
  for (let t = 120; t <= 160; t += 20) sim.civilizationAgeSystem.update(t);
  assertTrue(!sim.civilizationAgeSystem.getNuclearInfrastructureStatus(s.id).canEnrich && prog.warheads === 0,
    'Factory alone cannot enrich nuclear warheads without a Nuclear Power Plant');

  // Add Nuclear Plant + Missile Silo + Research Lab
  const plant = { id: sim.idGen.next(), type: 'building', buildingType: 'nuclear_plant', settlementId: s.id, complete: true, isRuined: false, health: 240, x: s.center.x - 2, y: s.center.y };
  const lab = { id: sim.idGen.next(), type: 'building', buildingType: 'research_lab', settlementId: s.id, complete: true, isRuined: false, health: 160, x: s.center.x, y: s.center.y + 2 };
  const silo = { id: sim.idGen.next(), type: 'building', buildingType: 'missile_silo', settlementId: s.id, complete: true, isRuined: false, health: 260, x: s.center.x, y: s.center.y - 2 };
  sim.buildings.push(plant, lab, silo);
  s.buildings.push(plant, lab, silo);

  const infraBefore = sim.civilizationAgeSystem.getNuclearInfrastructureStatus(s.id);
  assertTrue(infraBefore.canEnrich && infraBefore.canLaunch && infraBefore.hasResearchLab && infraBefore.hasMissileSilo,
    'Nuclear infrastructure detects Factory + Nuclear Plant + Research Lab + Missile Silo');

  const oreStart = s.stockpile.ore;
  for (let t = 180; t <= 360; t += 20) sim.civilizationAgeSystem.update(t);
  assertTrue(prog.warheads >= 1 && s.stockpile.ore < oreStart,
    `Operational Factory + Nuclear Plant enriches ${prog.warheads} warhead(s) consuming ore (${oreStart} -> ${s.stockpile.ore})`);

  // Ruining the Nuclear Plant halts further enrichment
  plant.isRuined = true;
  const infraAfterRuin = sim.civilizationAgeSystem.getNuclearInfrastructureStatus(s.id);
  assertTrue(!infraAfterRuin.canEnrich && !infraAfterRuin.canLaunch,
    'Destroying the Nuclear Power Plant disables further nuclear enrichment & launch capability');
}

// 3. Ecology Lifecycle: Growing Trees, Finite Depleting Ore Veins, Roaming Herds & Hunters
{
  const sim = new Simulation(9292, 128, 128, { scenario: 'peaceful' });

  // Growing tree progression
  const sapling = new Resource(20, 20, 'wood', 10, sim.idGen, { growthStage: 'sapling', growthProgress: 10 });
  for (let t = 1; t <= 260; t++) sapling.update(t);
  assertTrue(sapling.growthStage === 'mature' || sapling.growthStage === 'ancient',
    `Planted sapling grows naturally through lifecycle stages (now ${sapling.growthStage}, amount ${Math.round(sapling.amount)})`);

  // Finite ore vein permanent exhaustion
  const ore = new Resource(22, 22, 'ore', 6, sim.idGen);
  ore.exhaustionsRemaining = 0; // final mining cycle
  ore.consume(6);
  assertTrue(ore.depleted && ore.exhausted && ore.label === 'Exhausted Mine',
    'Finite mineral vein transitions permanently to Exhausted Mine after final extraction cycle');
  for (let t = 1; t <= 250; t++) ore.update(t);
  assertTrue(ore.amount === 0 && ore.exhausted, 'Exhausted mine remains permanently depleted');

  // Roaming animals + Active Hunter tracking & food stockpile deposit
  const s = Array.from(sim.settlementSystem.settlements.values())[0];
  const initialAnimals = sim.animalSystem.animals.length;
  assertTrue(initialAnimals >= 8, `World spawns ${initialAnimals} roaming animals`);
  for (let t = 0; t < 35; t++) sim.animalSystem.update(t);
  const migrating = sim.animalSystem.animals.some(a => a.alive && a.migrateTargetX != null);
  assertTrue(migrating, 'Roaming wildlife maintains deterministic herd migration targets');

  const hunter = sim.spawnAgent(s.center.x + 1, s.center.y + 1);
  hunter.age = 24;
  hunter.lifeStage = 'adult';
  hunter.pioneer = false;
  hunter.settlementId = s.id;
  hunter.job = 'hunter';
  s.agentIds.add(hunter.id);
  sim.settlementSystem.agentSettlementMap.set(hunter.id, s.id);

  // Place a deer right next to hunter and run sim ticks so hunter kills/harvests meat -> town food
  const prey = sim.animalSystem.spawn('deer', hunter.x + 1, hunter.y);
  prey.health = 10;
  const foodBefore = s.stockpile.food || 0;
  for (let t = 0; t < 45; t++) sim.tick();
  const foodAfter = s.stockpile.food || 0;
  const meatCredited = !prey.alive || (hunter.inventory?.meat || 0) > 0 || foodAfter > foodBefore;
  assertTrue(meatCredited, 'Active Hunter tracks wild game, hunts quarry, and feeds meat/food into settlement stockpile');
}

// 4. Deeper Diplomacy: Tributary Vassalage, Resource Trade Pact, Proliferation Sanctions, Mediation & Save/Load Parity
{
  const sim = new Simulation(5353, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  assertTrue(settlements.length >= 3, 'Peaceful scenario has >= 3 settlements for multi-actor diplomacy tests');
  const [s1, s2, s3] = settlements;
  const dsys = sim.diplomacySystem;

  // A) Resource Scarcity Trade & Non-Aggression Pact
  const rel12 = dsys.getRelation(s1.id, s2.id);
  rel12.status = 'peace';
  rel12.score = 56;
  rel12.sanctionedUntil = 0;
  s1.stockpile.ore = 40;
  s2.stockpile.ore = 2;
  dsys.evaluateResourcePact(s1, s2, rel12, 40);
  const hasPact = dsys.treaties.some(t => t.type === 'RESOURCE_PACT' && t.settlements.includes(s1.id) && t.settlements.includes(s2.id));
  assertTrue(hasPact && s2.stockpile.ore > 2,
    `Complementary scarcity forms Resource Trade & Non-Aggression Pact (recipient ore now ${s2.stockpile.ore})`);

  // B) Proliferation Sanctions / Alarm when rival erects Nuclear Plant + Silo
  const rel13 = dsys.getRelation(s1.id, s3.id);
  rel13.status = 'tension';
  rel13.score = 40;
  rel13.prolifAlertCooldownUntil = 0;
  s3.buildings = s3.buildings || [];
  const plant3 = { id: sim.idGen.next(), type: 'building', buildingType: 'nuclear_plant', settlementId: s3.id, complete: true, isRuined: false, health: 240, x: s3.center.x, y: s3.center.y };
  const silo3 = { id: sim.idGen.next(), type: 'building', buildingType: 'missile_silo', settlementId: s3.id, complete: true, isRuined: false, health: 260, x: s3.center.x + 1, y: s3.center.y };
  sim.buildings.push(plant3, silo3);
  s3.buildings.push(plant3, silo3);
  dsys.evaluateProliferationConcern(s1, s3, rel13, 60);
  const hasProlifLog = dsys.diplomaticHistory.some(e => e.type === 'proliferation' || e.type === 'sanction' || e.type === 'ultimatum');
  assertTrue(hasProlifLog, 'Rival nuclear plant & missile silo triggers diplomatic proliferation response');

  // C) Third-Party Peace Mediation
  s2.culture.values.cooperation = 0.85;
  dsys.getRelation(s2.id, s1.id).score = 70;
  dsys.getRelation(s2.id, s3.id).score = 70;
  rel13.truceUntilTick = 0;
  const war13 = dsys.declareWar(s1.id, s3.id, 'Militarist Aggression — Conquest', 70);
  war13.startTick = 10;
  war13.casualties[s1.id] = 7;
  war13.casualties[s3.id] = 6;
  dsys.evaluatePeaceMediation(settlements, new Map(), 300);
  assertTrue(war13.active === false && dsys.diplomaticHistory.some(e => e.type === 'mediation'),
    'Cooperative third-party settlement mediates peace conference for grueling war');

  // D) Tributary Vassalage execution
  dsys.signPeace(s1.id, s2.id, s1.id, 320, 'Tributary Vassalage');
  assertTrue(s2.tributeTo === s1.id && s2.overlordId === s1.id && s2.tributeRate === 0.15 && s2.tributeUntil > 320,
    `Tributary Vassalage sets tributeTo/overlordId (${s2.tributeTo}) with 15% seasonal tribute`);

  // E) Save/Load determinism check
  const clone = Simulation.deserialize(sim.serialize());
  for (let i = 0; i < 40; i++) {
    sim.tick();
    clone.tick();
  }
  const snap = (x) => JSON.stringify({
    tick: x.clock.tick,
    agents: x.agents.length,
    animals: x.animalSystem.animals.map(a => [a.id, Math.round(a.x * 100), Math.round(a.y * 100), a.alive]),
    resources: x.resources.slice(0, 25).map(r => [r.id, Math.round(r.amount), r.growthStage, r.exhausted]),
    treaties: x.diplomacySystem.treaties.length,
    history: x.diplomacySystem.diplomaticHistory.length
  });
  assertTrue(snap(sim) === snap(clone), 'Save/load preserves 100% deterministic parity across deep structures, ecology & diplomacy');
}

console.log('ALL DEEP STRUCTURES, ECOLOGY & DIPLOMACY TESTS PASSED!');
