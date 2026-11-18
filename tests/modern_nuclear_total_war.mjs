import { Simulation } from '../src/simulation/simulation.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Modern & Nuclear Age, Devastating Total Wars & MAD Retaliation ---');

// 1. Modern & Nuclear Scenario Initialization, Fortified Bastions, Active Total War & Determinism
{
  const simA = new Simulation(777, 128, 128, { scenario: 'modern_nuclear' });
  const simB = new Simulation(777, 128, 128, { scenario: 'modern_nuclear' });

  const settlementsA = Array.from(simA.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  assertTrue(settlementsA.length >= 2, `modern_nuclear starts with ${settlementsA.length} developed cities`);

  const era0 = simA.civilizationAgeSystem.getSettlementAge(settlementsA[0].id);
  const era1 = simA.civilizationAgeSystem.getSettlementAge(settlementsA[1].id);
  assertTrue(era0?.ageId === 7 && era1?.ageId === 7, 'top two powers boot in Era 7 (Nuclear Age)');

  const prog0 = simA.civilizationAgeSystem.getNuclearProgram(settlementsA[0].id);
  const prog1 = simA.civilizationAgeSystem.getNuclearProgram(settlementsA[1].id);
  assertTrue(prog0?.unlocked && prog0.warheads >= 2 && prog1?.unlocked && prog1.warheads >= 2,
    'Nuclear Age powers start with unlocked nuclear programs & armed warheads');

  const fort0 = simA.fortificationSystem.getSettlementFortificationSummary(settlementsA[0].id);
  assertTrue(fort0.totalSegments >= 8 && fort0.towers >= 2,
    `modern cities start fortified (${fort0.totalSegments} walls/gates, ${fort0.towers} watchtowers)`);

  const totalWar = simA.diplomacySystem.activeWars.find(w => w.active && w.totalWar);
  assertTrue(Boolean(totalWar), 'modern_nuclear starts with an active devastating Total War');

  // Verify entityRegistry and agentSettlementMap registration on scenario-seeded entities
  const firstCityAgentId = Array.from(settlementsA[0].agentIds)[0];
  assertTrue(simA.settlementSystem.agentSettlementMap.get(firstCityAgentId) === settlementsA[0].id,
    'scenario-seeded citizens registered in agentSettlementMap');
  const seededBld = simA.buildings.find(b => b.settlementId === settlementsA[0].id && b.complete);
  assertTrue(Boolean(seededBld && simA.world.getEntityById(seededBld.id) === seededBld),
    'scenario-seeded buildings registered in world.entityRegistry');

  // Tick 30 frames on both identical seeds and verify determinism + save/load parity
  for (let i = 0; i < 30; i++) {
    simA.tick();
    simB.tick();
  }
  const simBReloaded = Simulation.deserialize(simB.serialize());
  for (let i = 0; i < 30; i++) {
    simA.tick();
    simBReloaded.tick();
  }

  const snap = (sim) => JSON.stringify({
    scenario: sim._scenario,
    tick: sim.clock.tick,
    agents: sim.agents.length,
    births: sim.birthsThisSession,
    deaths: sim.deathsThisSession,
    wars: sim.diplomacySystem.activeWars.map(w => [w.id, w.active, w.totalWar, w.casualties]),
    nukes: Array.from(sim.civilizationAgeSystem.nuclearPrograms.entries()).map(([id, p]) => [id, p.warheads, p.totalStrikes]),
    rad: Array.from(sim.world.radiationTiles),
    craters: Array.from(sim.world.craterTiles),
  });
  assertTrue(snap(simA) === snap(simBReloaded),
    'modern_nuclear scenario preserves 100% save/load determinism');
}

// 2. Era 7 Nuclear Age Advancement & Dual Heavy Rocket Artillery Scaling
{
  const sim = new Simulation(888, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;

  // Advance s1 to Era 6, populate to 24 adults, supply stockpiles & check automatic Era 7 advancement
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 6, true);
  while (s1.agentIds.size < 24) {
    const a = sim.spawnAgent(s1.center.x, s1.center.y);
    a.age = 24;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.settlementId = s1.id;
    s1.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s1.id);
  }
  s1.population = s1.agentIds.size;
  s1.stockpile.food = 180;
  s1.stockpile.wood = 160;
  s1.stockpile.ore = 140;
  s1.buildings = s1.buildings || [];
  for (let i = 0; i < 8; i++) {
    const tb = { id: 90000 + i, type: 'building', buildingType: 'house', settlementId: s1.id, complete: true, isRuined: false, x: s1.center.x, y: s1.center.y };
    sim.buildings.push(tb);
    s1.buildings.push(tb);
  }
  const prog1 = sim.civilizationAgeSystem.getNuclearProgram(s1.id);
  prog1.warheads = 2;

  sim.civilizationAgeSystem.update(20);
  const updatedEra = sim.civilizationAgeSystem.getSettlementAge(s1.id);
  assertTrue(updatedEra?.ageId === 7 && updatedEra.ageName === 'Nuclear Age',
    `Era 6 settlement with warheads & resources advances to Era 7 (${updatedEra?.ageName})`);
  assertTrue(prog1.maxWarheads === 5, 'Era 7 Nuclear Age expands warhead stockpile cap to 5');

  // Declare devastating Total War and inspect mobilized squad scale + Era 7 weaponry
  const rel = sim.diplomacySystem.getRelation(s1.id, s2.id);
  if (rel) rel.truceUntilTick = 0;
  const war = sim.diplomacySystem.declareWar(s1.id, s2.id, 'Hegemonic Conquest — Atomic Era', 30, { totalWar: true });
  assertTrue(Boolean(war && war.totalWar), 'declareWar marks high-stakes Nuclear Era war as totalWar');

  const wb = Array.from(sim.warfareSystem.warbands.values()).find(w => w.active && w.settlementId === s1.id);
  assertTrue(Boolean(wb && wb.soldiers.length >= 9 && wb.soldiers.length <= 12),
    `Nuclear Age Total War mobilizes expanded squad (${wb?.soldiers?.length} soldiers)`);

  const squadSoldiers = wb.soldiers.map(id => sim._agentById(id)).filter(Boolean);
  const artilleryUnits = squadSoldiers.filter(a => a.combat?.weaponType === 'artillery');
  const rifleUnits = squadSoldiers.filter(a => a.combat?.weaponType === 'rifle');
  assertTrue(artilleryUnits.length === 2, `Era 7 squad fields dual rocket artillery slots (${artilleryUnits.length})`);
  assertTrue(artilleryUnits[0].combat.damage >= 72 && artilleryUnits[0].combat.splashRadius >= 3.5,
    `Era 7 artillery delivers heavy stats (dmg ${artilleryUnits[0].combat.damage}, splash ${artilleryUnits[0].combat.splashRadius})`);
  assertTrue(rifleUnits.length >= 1 && rifleUnits[0].combat.damage >= 52,
    `Era 7 infantry wield upgraded rifles (dmg ${rifleUnits[0]?.combat?.damage})`);
}

// 3. Autonomous Nuclear Escalation, MAD Retaliation & Devastating Siege
{
  const sim = new Simulation(999, 128, 128, { scenario: 'modern_nuclear' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;

  // Give both sides extra citizens so s2 survives initial blast and fires MAD retaliation
  for (const targetS of [s1, s2]) {
    while (targetS.agentIds.size < 20) {
      const a = sim.spawnAgent(targetS.center.x + 8, targetS.center.y + 8);
      a.age = 25;
      a.lifeStage = 'adult';
      a.pioneer = false;
      a.settlementId = targetS.id;
      targetS.agentIds.add(a.id);
      sim.settlementSystem.agentSettlementMap.set(a.id, targetS.id);
    }
    targetS.population = targetS.agentIds.size;
  }

  const prog1 = sim.civilizationAgeSystem.getNuclearProgram(s1.id);
  const prog2 = sim.civilizationAgeSystem.getNuclearProgram(s2.id);
  prog1.warheads = 3;
  prog2.warheads = 3;
  prog2.lastRetaliationTick = -999;

  // Trigger s1 first strike on s2 and verify Mutual Assured Destruction (MAD) counter-strike hits s1
  const strikeRes = sim.detonateNuclearStrike({
    x: s2.center.x,
    y: s2.center.y,
    attackerSettlementId: s1.id,
    targetSettlementId: s2.id,
    reason: 'First strike in Nuclear Age Total War',
    isGodPower: false,
  });
  assertTrue(Boolean(strikeRes && strikeRes.casualties >= 1),
    `Nuclear strike inflicted immediate blast casualties (${strikeRes?.casualties})`);
  assertTrue(prog2.warheads === 2 && prog2.totalStrikes >= 1,
    'Surviving nuclear power spent 1 warhead on automatic MAD counter-strike');
  assertTrue(sim.diplomacySystem.diplomaticHistory.some(e => e.type === 'nuke' && e.outcome === 'retaliated'),
    'Diplomatic causal feed recorded MAD nuclear retaliation event');

  const war = sim.diplomacySystem.activeWars.find(w => w.active && w.totalWar);
  const warCas = (war?.casualties?.[s1.id] || 0) + (war?.casualties?.[s2.id] || 0);
  assertTrue(warCas > 0, `Active Total War ledger records atomic casualties (${warCas})`);

  // Verify high Total War casualty tolerance prevents premature peace after 6 casualties
  const rel12 = sim.diplomacySystem.getRelation(s1.id, s2.id);
  if (war && rel12) {
    war.casualties[s1.id] = 3;
    war.casualties[s2.id] = 3;
    war.weariness[s1.id] = 20;
    war.weariness[s2.id] = 20;
    sim.diplomacySystem.checkWarWeariness(s1, s2, rel12, 120);
    assertTrue(war.active === true, 'Total War does not end prematurely at low casualty counts');
  }
}

// 4. Era 6 (Modern Age) War Devastation: Total War, 4-Target Artillery Splash, Collateral Ruin & Siege Devastation
{
  const sim = new Simulation(1066, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [m1, m2] = settlements;

  sim.civilizationAgeSystem.setSettlementAge(m1.id, 6, true);
  sim.civilizationAgeSystem.setSettlementAge(m2.id, 6, true);

  for (const s of [m1, m2]) {
    while (s.agentIds.size < 20) {
      const a = sim.spawnAgent(s.center.x, s.center.y);
      a.age = 24;
      a.lifeStage = 'adult';
      a.pioneer = false;
      a.settlementId = s.id;
      s.agentIds.add(a.id);
      sim.settlementSystem.agentSettlementMap.set(a.id, s.id);
    }
    s.population = s.agentIds.size;
  }

  const rel = sim.diplomacySystem.getRelation(m1.id, m2.id);
  if (rel) rel.truceUntilTick = 0;

  const modWar = sim.diplomacySystem.declareWar(m1.id, m2.id, 'Resource Wars — Oil & Ore Belt', 40);
  assertTrue(Boolean(modWar && modWar.totalWar), 'Modern Age (Era 6) war escalates into devastating Total War');

  const modBand = Array.from(sim.warfareSystem.warbands.values()).find(w => w.active && w.settlementId === m1.id);
  assertTrue(Boolean(modBand && modBand.soldiers.length >= 9),
    `Modern Age mobilizes expanded warband (${modBand?.soldiers?.length} troops)`);

  const modUnits = modBand.soldiers.map(id => sim._agentById(id)).filter(Boolean);
  const modArtillery = modUnits.find(u => u.combat?.weaponType === 'artillery');
  const modRifle = modUnits.find(u => u.combat?.weaponType === 'rifle');
  assertTrue(Boolean(modArtillery && modArtillery.combat.damage >= 64 && modArtillery.combat.splashRadius >= 3.4),
    `Modern Age artillery delivers heavy devastation stats (dmg ${modArtillery?.combat?.damage}, splash ${modArtillery?.combat?.splashRadius})`);
  assertTrue(Boolean(modRifle && modRifle.combat.damage >= 48),
    `Modern Age riflemen deal upgraded combat damage (${modRifle?.combat?.damage})`);

  // Cluster 4 enemy defenders near an enemy building and fire 1 artillery barrage -> hits primary + collateral building
  const enemySoldiers = Array.from(m2.agentIds).map(id => sim._agentById(id)).filter(a => a && a.alive).slice(0, 5);
  const targetBld = sim.buildings.find(b => b && !b.isRuined && b.settlementId === m2.id) || {
    id: 99555, type: 'building', buildingType: 'house', settlementId: m2.id, complete: true, isRuined: false,
    x: Math.floor(m2.center.x) + 1, y: Math.floor(m2.center.y), health: 100, maxHealth: 100,
  };
  if (!sim.buildings.includes(targetBld)) sim.buildings.push(targetBld);
  targetBld.complete = true;
  targetBld.isRuined = false;
  targetBld.health = 100;

  for (let i = 0; i < enemySoldiers.length; i++) {
    enemySoldiers[i].x = targetBld.x + (i * 0.3);
    enemySoldiers[i].y = targetBld.y;
    enemySoldiers[i].health = 100;
    enemySoldiers[i].needs.health = 100;
  }
  modArtillery.x = targetBld.x - 6;
  modArtillery.y = targetBld.y;
  modArtillery.combat.attackCooldown = 0;
  sim.warfareSystem.executeMeleeAttack(modArtillery, enemySoldiers[0], modBand);

  const damagedAdjacents = enemySoldiers.slice(1).filter(e => !e.alive || e.health < 100).length;
  assertTrue(damagedAdjacents >= 3, `Modern artillery splash strikes ${damagedAdjacents} adjacent defenders in one barrage`);
  assertTrue(targetBld.health < 100, `Modern artillery barrage inflicts collateral building damage (hp ${targetBld.health}/100)`);
}

console.log('ALL MODERN & NUCLEAR AGE TOTAL WAR TESTS PASSED!');
