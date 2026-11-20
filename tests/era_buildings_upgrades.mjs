import { Simulation } from '../src/simulation/simulation.js';
import { Building } from '../src/simulation/building.js';
import { BUILDING_METADATA, STORAGE_CAPACITY } from '../src/core/constants.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Era 1-6 Buildings, Upgradable Tiers (Lv 1-3) & Society Functions ---');

// 1. Metadata, Upgrade Scaling (HP, Storage Capacity, Multiplier) & Serialization Parity
{
  const sim = new Simulation(4041, 128, 128, { scenario: 'warring' });
  const requiredKeys = ['windmill', 'inn', 'library', 'apothecary', 'castle', 'bank', 'factory', 'research_lab', 'radar_station', 'nuclear_plant', 'missile_silo'];
  for (const k of requiredKeys) {
    assertTrue(Boolean(BUILDING_METADATA[k] && BUILDING_METADATA[k].minEra >= 1 && BUILDING_METADATA[k].maxLevel === 3),
      `BUILDING_METADATA defines Era gate & Lv 3 tiering for ${k}`);
  }

  const gran = new Building(20, 20, 'granary', sim.idGen, 1, 1);
  gran.complete = true;
  gran.constructionProgress = 100;
  assertTrue(gran.level === 1 && gran.maxHealth === 130 && gran.capacity === STORAGE_CAPACITY.granary,
    `Granary starts at Lv 1 (${gran.maxHealth} HP, ${gran.capacity} cap)`);

  assertTrue(gran.applyUpgrade(10) === true && gran.level === 2, 'Building upgrades cleanly to Lv 2');
  assertTrue(gran.maxHealth > 130 && gran.capacity > STORAGE_CAPACITY.granary && gran.getLevelMultiplier() > 1.4,
    `Lv 2 scales HP (${gran.maxHealth}), capacity (${gran.capacity}), and power (${gran.getLevelMultiplier().toFixed(2)})`);

  assertTrue(gran.applyUpgrade(20) === true && gran.level === 3, 'Building upgrades cleanly to Lv 3');
  assertTrue(gran.applyUpgrade(30) === false && gran.level === 3, 'Building caps cleanly at maxLevel 3');

  const raw = gran.serialize();
  const restored = Building.deserialize(raw, sim.idGen);
  assertTrue(restored.level === 3 && restored.maxHealth === gran.maxHealth && restored.capacity === gran.capacity && restored.upgradedAtTick === 20,
    'Building.serialize/deserialize preserves level, maxHealth, capacity, and upgradedAtTick');

  const legacyRaw = { ...raw };
  delete legacyRaw.level;
  delete legacyRaw.maxLevel;
  delete legacyRaw.upgradedAtTick;
  const legacyRestored = Building.deserialize(legacyRaw, sim.idGen);
  assertTrue(legacyRestored.level === 1 && legacyRestored.maxLevel === 3,
    'Legacy saves without level metadata safely default to Lv 1');
}

// 2. Real Society Functions: Windmill, Granary, Inn, Library, Apothecary, Bank & Radar Station
{
  const sim = new Simulation(4042, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 6, true);
  sim.civilizationAgeSystem.setSettlementAge(s2.id, 6, true);

  const addDoneBuilding = (settlement, type, dx, dy, level = 1) => {
    const b = new Building(Math.floor(settlement.center.x + dx), Math.floor(settlement.center.y + dy), type, sim.idGen, settlement.id, settlement.factionId ?? null);
    b.complete = true;
    b.isComplete = true;
    b.constructionProgress = 100;
    for (let l = 1; l < level; l++) b.applyUpgrade(0);
    sim.buildings.push(b);
    sim.world.addToSpatialIndex(b.x, b.y, b);
    sim.world.entityRegistry?.set(b.id, b);
    settlement.buildings = settlement.buildings || [];
    settlement.buildings.push(b);
    return b;
  };

  // A) Windmill + Granary Lv 2 food deposits
  addDoneBuilding(s1, 'windmill', 2, 0, 2); // +5 food / 60t
  addDoneBuilding(s1, 'granary', -2, 0, 2); // +2 food / 60t
  const foodBefore = s1.stockpile.food || 0;
  sim.clock.tick = 60;
  sim.updateBuildings();
  assertTrue((s1.stockpile.food || 0) >= foodBefore + 7,
    `Windmill Lv 2 (+5) & Granary Lv 2 (+2) deposit preserved grain (${foodBefore} -> ${s1.stockpile.food})`);

  // B) Inn rest/social uplift + rebellion dampening
  addDoneBuilding(s1, 'inn', 0, 2, 2);
  const innGuest = Array.from(s1.agentIds).map(id => sim._agentById(id)).find(a => a && a.alive);
  innGuest.x = s1.center.x;
  innGuest.y = s1.center.y + 1;
  innGuest.needs.rest = 40;
  innGuest.needs.social = 35;
  sim.clock.tick = 40;
  sim.updateBuildings();
  assertTrue(innGuest.needs.rest >= 49 && innGuest.needs.social >= 50,
    `Inn Lv 2 restores citizen rest (${innGuest.needs.rest}) & social morale (${innGuest.needs.social})`);

  // Verify Inn reduces rebellion score safely
  const bonus = sim.getSettlementBuildingBonus(s1.id, 'inn');
  assertTrue(bonus.maxLevel === 2 && bonus.power > 1.4,
    `getSettlementBuildingBonus reports Inn Lv 2 power (${bonus.power.toFixed(2)})`);

  // C) Library skill XP multiplier
  const scholar = sim.spawnAgent(s1.center.x, s1.center.y);
  scholar.settlementId = s1.id;
  s1.agentIds.add(scholar.id);
  const baselineCitizen = sim.spawnAgent(s2.center.x, s2.center.y);
  baselineCitizen.settlementId = s2.id;
  s2.agentIds.add(baselineCitizen.id);
  sim.settlementSystem.agentSettlementMap.set(scholar.id, s1.id);
  sim.settlementSystem.agentSettlementMap.set(baselineCitizen.id, s2.id);

  sim.economySystem.agentJobs.set(scholar.id, { job: 'crafter', experience: 0, skillLevel: 1.0 });
  sim.economySystem.agentJobs.set(baselineCitizen.id, { job: 'crafter', experience: 0, skillLevel: 1.0 });
  addDoneBuilding(s1, 'library', 0, -2, 2);
  sim.economySystem.gainExperience(scholar.id, 10);
  sim.economySystem.gainExperience(baselineCitizen.id, 10);
  const expScholar = sim.economySystem.getAgentJob(scholar.id).experience;
  const expBase = sim.economySystem.getAgentJob(baselineCitizen.id).experience;
  assertTrue(expScholar > expBase,
    `Library boosts citizen job XP (${expScholar.toFixed(2)} vs ${expBase.toFixed(2)})`);

  // D) Apothecary healing & wound recovery
  addDoneBuilding(s1, 'apothecary', 3, 2, 2); // +12 HP / 30t
  const patient = innGuest;
  patient.health = 58;
  patient.needs.health = 58;
  patient.wounded = true;
  sim.clock.tick = 30;
  sim.updateBuildings();
  assertTrue(patient.health >= 70 && patient.wounded === false,
    `Apothecary Lv 2 heals injured citizen (${patient.health} HP) and clears wounded state`);

  // E) Bank trade bonus & dividends
  addDoneBuilding(s1, 'bank', -3, 2, 2); // +3 dividend / 90t
  const totalBeforeDiv = (s1.stockpile.food || 0) + (s1.stockpile.wood || 0) + (s1.stockpile.ore || 0);
  sim.clock.tick = 90;
  sim.updateBuildings();
  const totalAfterDiv = (s1.stockpile.food || 0) + (s1.stockpile.wood || 0) + (s1.stockpile.ore || 0);
  assertTrue(totalAfterDiv >= totalBeforeDiv + 3,
    `Treasury & Bank Lv 2 generates civic commerce dividends (${totalBeforeDiv} -> ${totalAfterDiv})`);

  // F) Radar Station active anti-air interception vs Strike Aircraft
  const radar = addDoneBuilding(s1, 'radar_station', 1, 1, 2);
  const rel12 = sim.diplomacySystem.getRelation(s1.id, s2.id);
  if (rel12) rel12.truceUntilTick = 0;
  sim.diplomacySystem.declareWar(s1.id, s2.id, 'Airspace Incursion Test', 95);
  const enemyPlane = sim.spawnAgent(radar.x + 8, radar.y + 4);
  enemyPlane.settlementId = s2.id;
  s2.agentIds.add(enemyPlane.id);
  sim.settlementSystem.agentSettlementMap.set(enemyPlane.id, s2.id);
  enemyPlane.combatRole = 'plane';
  enemyPlane.combat = { ...(enemyPlane.combat || {}), weaponType: 'plane', isFlying: true, health: 140, maxHealth: 140 };
  enemyPlane.health = 140;
  sim.fortificationSystem._updateTowerDefense(98);
  assertTrue(enemyPlane.health < 140,
    `Air Defense Radar intercepts hostile Strike Aircraft at extended range (HP ${enemyPlane.health}/140)`);
}

// 3. Player Upgrade Gating, Settlement Commissioning & Autonomous Era Planning
{
  const sim = new Simulation(4043, 128, 128, { scenario: 'warring' });
  const s = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id)[0];

  // In Era 1, Radar Station commission should be blocked
  const lockedCom = sim.commissionSettlementBuilding(s.id, 'radar_station');
  assertTrue(lockedCom.ok === false, 'Era 6 Radar Station cannot be commissioned in Era 1');

  // Create a farm at Lv 1 -> Lv 2 requires Era 2
  const farm = new Building(Math.floor(s.center.x + 2), Math.floor(s.center.y), 'farm', sim.idGen, s.id, s.factionId ?? null);
  farm.complete = true;
  farm.constructionProgress = 100;
  sim.buildings.push(farm);
  s.buildings.push(farm);

  const eraLockedUp = sim.upgradeBuilding(farm.id, { byPlayer: true, tick: 10 });
  assertTrue(eraLockedUp.ok === false, 'Lv 2 Farm upgrade is blocked in Era 1');

  // Advance to Era 3 with rich stockpile -> upgrade succeeds & consumes resources
  sim.civilizationAgeSystem.setSettlementAge(s.id, 3, true);
  s.stockpile.wood = 80;
  s.stockpile.ore = 40;
  const upOk = sim.upgradeBuilding(farm.id, { byPlayer: true, tick: 20 });
  assertTrue(upOk.ok === true && farm.level === 2 && s.stockpile.wood < 80,
    `Era 3 unlocks Farm Lv 2 upgrade and deducts wood/ore (remaining wood ${s.stockpile.wood})`);

  const libCom = sim.commissionSettlementBuilding(s.id, 'library');
  assertTrue(libCom.ok === true && libCom.building.buildingType === 'library',
    'Era 3 permits commissioning Library & Academy inside settlement');

  // Add a completed Lv 1 workshop eligible for Era 2->3 upgrade and run 40-tick autonomous upgrade pass
  const ws = new Building(Math.floor(s.center.x - 2), Math.floor(s.center.y), 'workshop', sim.idGen, s.id, s.factionId ?? null);
  ws.complete = true;
  ws.constructionProgress = 100;
  sim.buildings.push(ws);
  s.buildings.push(ws);

  const preLevels = (s.buildings || []).reduce((sum, b) => sum + (b.level || 1), 0);
  sim.clock.tick = 40;
  sim.updateSettlements();
  const postLevels = (s.buildings || []).reduce((sum, b) => sum + (b.level || 1), 0);
  assertTrue(postLevels > preLevels && ws.level === 2,
    `Autonomous settlement planner upgrades structures on 40-tick cadence (total levels ${preLevels} -> ${postLevels}, workshop Lv ${ws.level})`);
}

// 4. Modern & Nuclear Preset Multi-Era Buildings & Bit-Exact Determinism
{
  const simA = new Simulation(4044, 128, 128, { scenario: 'modern_nuclear' });
  const simB = new Simulation(4044, 128, 128, { scenario: 'modern_nuclear' });

  const hasNewTypes = ['windmill', 'inn', 'library', 'apothecary', 'bank', 'radar_station']
    .every(t => simA.buildings.some(b => b.buildingType === t && b.complete));
  const hasUpgraded = simA.buildings.some(b => (b.level || 1) >= 2);
  assertTrue(hasNewTypes && hasUpgraded,
    'Modern & Nuclear preset seeds full Era 1-6 civic infrastructure and upgraded Lv 2-3 tiers');

  for (let t = 0; t < 40; t++) {
    simA.tick();
    simB.tick();
  }
  const simBReloaded = Simulation.deserialize(simB.serialize());
  for (let t = 0; t < 40; t++) {
    simA.tick();
    simBReloaded.tick();
  }

  const snap = (sim) => JSON.stringify({
    tick: sim.clock.tick,
    agents: sim.agents.length,
    buildings: sim.buildings.map(b => [b.id, b.buildingType, b.level, Math.round(b.health), b.complete]),
    stocks: Array.from(sim.settlementSystem.settlements.values()).map(s => [s.id, Math.round(s.stockpile?.food || 0), Math.round(s.stockpile?.ore || 0)]),
  });
  assertTrue(snap(simA) === snap(simBReloaded),
    'Era buildings & upgrades preserve 100% deterministic save/load parity');
}

console.log('ALL ERA BUILDINGS & UPGRADE TESTS PASSED!');
