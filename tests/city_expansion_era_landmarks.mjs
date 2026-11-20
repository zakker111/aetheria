import { Simulation } from '../src/simulation/simulation.js';
import { BUILDING_METADATA, isMonumentBuildingType } from '../src/core/constants.js';
import { CIVILIZATION_AGES, WONDER_BY_ERA } from '../src/systems/civilizationAgeSystem.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Era 1-7 Grand Structures, Heritage Survival & Continuous City Expansion ---');

// 1. Every Era 1-7 has a distinct grand structure & metadata
{
  const ageConfigs = Object.values(CIVILIZATION_AGES).sort((a, b) => a.id - b.id);
  assertTrue(ageConfigs.length === 7, 'CIVILIZATION_AGES defines all 7 eras');
  const seenTypes = new Set();
  for (const age of ageConfigs) {
    assertTrue(Boolean(age.monumentType && isMonumentBuildingType(age.monumentType)), `Era ${age.id} has monument type ${age.monumentType}`);
    assertTrue(!seenTypes.has(age.monumentType), `Era ${age.id} monument type ${age.monumentType} is distinct from other eras`);
    seenTypes.add(age.monumentType);
    const meta = BUILDING_METADATA[age.monumentType];
    assertTrue(Boolean(meta && meta.isMonument && meta.heritageSurvivable), `BUILDING_METADATA[${age.monumentType}] marks monumental heritage survivability`);
    assertTrue(Boolean(WONDER_BY_ERA[age.id] && WONDER_BY_ERA[age.id].buildingType === age.monumentType), `WONDER_BY_ERA[${age.id}] matches Era ${age.id} grand structure`);
  }
}

// 2. Heritage monuments persist across Eras 1 -> 7, resist fire/raid/outer-nuke & survive save/load
{
  const sim = new Simulation(5151, 128, 128, { scenario: 'default' });
  const s = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id)[0];
  assertTrue(Boolean(s), 'initial settlement exists for heritage persistence test');

  // Seed enough population and advance sequentially through all 7 eras
  for (let i = 0; i < 24; i++) {
    const a = sim.spawnAgent(s.center.x + (i % 5) - 2, s.center.y + Math.floor(i / 5) - 2);
    a.age = 24;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.settlementId = s.id;
    s.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s.id);
  }
  s.population = s.agentIds.size;

  const agesSorted = Object.values(CIVILIZATION_AGES).sort((a, b) => a.id - b.id);
  for (const ageCfg of agesSorted) {
    sim.civilizationAgeSystem.setSettlementAge(s.id, ageCfg.id, ageCfg.id >= 6);
    const mon = sim.civilizationAgeSystem.placeMonumentBlueprint(s, ageCfg);
    assertTrue(Boolean(mon && mon.buildingType === ageCfg.monumentType && mon.builtInEra === ageCfg.id),
      `Placed distinct Era ${ageCfg.id} landmark (${ageCfg.monumentType})`);
    mon.complete = true;
    mon.constructionProgress = 100;
  }

  const heritageList = sim.civilizationAgeSystem.getHeritageMonuments(s.id);
  assertTrue(heritageList.length === 7, `All 7 Era monuments preserved in heritageMonuments (found ${heritageList.length})`);
  assertTrue(heritageList.filter(m => m.survivedToModern && m.intact).length >= 4,
    'Ancient Era 1-4 landmarks carry survivedToModern flag inside Era 7 Metropolis');

  // Stress-test fire, pillage & outer nuclear shockwave resilience on Era 1 & Era 2 monuments
  const era1Mon = sim.buildings.find(b => b.settlementId === s.id && b.buildingType === 'monument_cairn');
  const era2Mon = sim.buildings.find(b => b.settlementId === s.id && b.buildingType === 'monument_pyramid');
  for (let t = 0; t < 20; t++) {
    era1Mon.applyDamage(20, { cause: 'fire', tick: 100 + t });
  }
  era2Mon.applyDamage(450, { cause: 'pillage', tick: 120 });
  assertTrue(!era1Mon.isRuined && era1Mon.health > 0, 'Era 1 Stonehenge survives sustained city fire');
  assertTrue(!era2Mon.isRuined && era2Mon.health > 0, 'Era 2 Pyramid survives heavy siege pillage');

  // Outer nuclear strike shockwave (outside innermost ground zero) leaves ancient landmark scarred yet standing
  sim.detonateNuclearStrike({
    x: era2Mon.x + 6,
    y: era2Mon.y,
    targetSettlementId: s.id,
    reason: 'Heritage Survivability Test',
  });
  assertTrue(!era2Mon.isRuined && era2Mon.health >= 40, 'Era 2 Pyramid survives outer nuclear blast wave into the Modern Era');

  // Save/load preserves heritageMonuments & building builtInEra
  const snap = sim.serialize();
  const restored = Simulation.deserialize(snap);
  const restoredHeritage = restored.civilizationAgeSystem.getHeritageMonuments(s.id);
  assertTrue(restoredHeritage.length === 7, 'Save/load preserves all 7 heritage monuments');
  const restoredEra2 = restored.buildings.find(b => b.id === era2Mon.id);
  assertTrue(Boolean(restoredEra2 && restoredEra2.builtInEra === 2 && restoredEra2.isHeritage),
    'Save/load preserves monument builtInEra and heritage flags');
}

// 3. Modern & Nuclear preset showcases ancient heritage structures surviving into Era 6-7
{
  const modernSim = new Simulation(6262, 128, 128, { scenario: 'modern_nuclear' });
  const settlements = Array.from(modernSim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const summary0 = modernSim.civilizationAgeSystem.getSettlementAgeSummary(settlements[0].id);
  const summary1 = modernSim.civilizationAgeSystem.getSettlementAgeSummary(settlements[1].id);
  assertTrue(summary0.heritageMonuments.some(m => m.eraId <= 3 && m.intact && m.survivedToModern),
    'Modern superpower 1 preserves surviving ancient monument alongside Atomic Complex');
  assertTrue(summary1.heritageMonuments.some(m => m.eraId <= 3 && m.intact && m.survivedToModern),
    'Modern superpower 2 preserves surviving Classical Colosseum alongside Atomic Complex');
}

// 4. Continuous city expansion over time (breaks old 32-cap & old r=11 box)
{
  const simA = new Simulation(4040, 128, 128, { scenario: 'default' });
  const simB = new Simulation(4040, 128, 128, { scenario: 'default' });
  const s = Array.from(simA.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id)[0];

  // Seed thriving settlement resources & citizens to test multi-ring urban sprawl
  for (let i = 0; i < 24; i++) {
    const a = simA.spawnAgent(s.center.x + (i % 5) - 2, s.center.y + Math.floor(i / 5) - 2);
    a.age = 22;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.job = i % 3 === 0 ? 'builder' : (i % 3 === 1 ? 'lumberjack' : 'farmer');
    a.settlementId = s.id;
    s.agentIds.add(a.id);
    simA.settlementSystem.agentSettlementMap.set(a.id, s.id);
  }
  s.population = s.agentIds.size;
  s.stockpile.food = 260;
  s.stockpile.wood = 280;
  s.stockpile.plank = 120;
  s.stockpile.ore = 140;
  simA.civilizationAgeSystem.setSettlementAge(s.id, 5, false);

  const initialBuildings = (s.buildings || []).filter(b => b && !b.isRuined).length;
  for (let t = 0; t < 620; t++) {
    if (t % 20 === 0) {
      s.stockpile.wood = Math.max(s.stockpile.wood || 0, 140);
      s.stockpile.food = Math.max(s.stockpile.food || 0, 180);
      s.stockpile.ore = Math.max(s.stockpile.ore || 0, 90);
    }
    simA.tick();
  }

  const grownBuildings = simA.buildings.filter(b => b && b.settlementId === s.id && !b.isRuined);
  const maxDist = grownBuildings.reduce((mx, b) => Math.max(mx, Math.hypot(b.x - s.center.x, b.y - s.center.y)), 0);
  const houseCount = grownBuildings.filter(b => b.buildingType === 'house').length;
  const farmCount = grownBuildings.filter(b => b.buildingType === 'farm').length;

  assertTrue(grownBuildings.length >= 34 && grownBuildings.length > initialBuildings + 20,
    `City continuously expanded past old 32-building cap (${initialBuildings} -> ${grownBuildings.length} structures)`);
  assertTrue(maxDist > 12,
    `City districts physically expanded outward beyond old r=11 ring (max radial sprawl ${maxDist.toFixed(1)}t)`);
  assertTrue(houseCount >= 8 && farmCount >= 2,
    `City built expanding residential & agrarian districts (${houseCount} houses, ${farmCount} farms)`);

  // Determinism parity on identical unseeded expansion
  for (let t = 0; t < 180; t++) simB.tick();
  const simB2 = new Simulation(4040, 128, 128, { scenario: 'default' });
  for (let t = 0; t < 180; t++) simB2.tick();
  assertTrue(
    JSON.stringify(simB.civilizationAgeSystem.serialize()) === JSON.stringify(simB2.civilizationAgeSystem.serialize()) &&
    simB.buildings.length === simB2.buildings.length,
    'Bit-exact determinism preserved across city expansion & monument systems'
  );
}

console.log('ALL CITY EXPANSION & ERA LANDMARK TESTS PASSED');
