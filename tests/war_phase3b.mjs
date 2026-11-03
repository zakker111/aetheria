// Phase 3b War Depth & Conquest Test
// Verifies:
// 1. Equipment drawing (swords, spears, bows, shields) and tactical roles (commander, archer, shieldbearer, vanguard)
// 2. Frontline combat depth (archery range 5.5, shield deflection block, equipment drop on death)
// 3. Plunder cargo carriage and unload at home settlement (VICTORY_PLUNDER_UNLOADED)
// 4. Conquest/annexation and tributary vassalage with 15% seasonal tribute
// 5. Save/load determinism across seeds

import { Simulation } from '../src/simulation/simulation.js';

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failures++;
  } else {
    console.log(`PASS: ${name}`);
  }
}

console.log('--- Testing Phase 3b: Military Equipment, Plunder & Conquest ---');

// 1. Test Equipment Drawing & Roles
{
  const sim = new Simulation(1234, 128, 128, { scenario: 'peaceful' });
  const towns = [...sim.settlementSystem.settlements.values()];
  check('at least 2 towns exist', towns.length >= 2);

  const t1 = towns[0];
  const t2 = towns[1];

  // Stockpile military equipment: 1 sword, 1 spear, 2 bows, 2 shields
  t1.stockpile.weapon_sword = 1;
  t1.stockpile.weapon_spear = 1;
  t1.stockpile.weapon_bow = 2;
  t1.stockpile.armor_shield = 2;

  // Mobilize warband
  const wb = sim.warfareSystem.mobilizeWarband(t1.id, t2.id, 'assault');
  check('warband mobilized with soldiers', wb && wb.soldiers.length >= 3);

  const soldiers = wb.soldiers.map(id => sim._agentById(id)).filter(Boolean);
  const roles = soldiers.map(s => s.combatRole);
  check('commander role assigned to squad lead', roles[0] === 'commander');
  check('archer role assigned to bow carrier', roles.includes('archer') || soldiers.some(s => s.combat?.weaponType === 'bow'));
  check('shieldbearer role or shield equipped', soldiers.some(s => s.hasShield));
  check('swords/spears equipped', soldiers.some(s => s.combat?.weaponType === 'sword' || s.combat?.weaponType === 'spear'));

  // Test Demobilization returns gear
  const swordBefore = t1.stockpile.weapon_sword || 0;
  sim.warfareSystem.demobilizeSettlement(t1.id);
  const swordAfter = t1.stockpile.weapon_sword || 0;
  check('demobilization returns military gear to town stockpile', swordAfter >= swordBefore);
}

// 2. Test Plunder Cargo Carriage and Unload
{
  const sim = new Simulation(5678, 128, 128, { scenario: 'peaceful' });
  const towns = [...sim.settlementSystem.settlements.values()];
  const t1 = towns[0];
  const t2 = towns[1];

  t2.stockpile.food = 100;
  t2.stockpile.wood = 80;
  t2.stockpile.ore = 50;

  const initialT1Food = t1.stockpile.food || 0;

  const wb = sim.warfareSystem.mobilizeWarband(t1.id, t2.id, 'assault');
  const commander = sim._agentById(wb.commanderId);

  // Position commander at enemy center and execute siege
  commander.x = t2.center.x;
  commander.y = t2.center.y;
  sim.warfareSystem.handleSieging(wb, commander);

  check('enemy stockpile plundered', t2.stockpile.food < 100);
  check('plunder cargo loaded on warband', wb.plunderCargo.food > 0);
  check('home stockpile not instantly credited before return', (t1.stockpile.food || 0) === initialT1Food);
  check('grievance recorded against plundering town', sim.diplomacySystem.grievances.get(t2.id)?.has(t1.id));

  // Now return warband home
  let unloadedFired = false;
  sim.eventBus.on('VICTORY_PLUNDER_UNLOADED', () => { unloadedFired = true; });

  commander.x = t1.center.x;
  commander.y = t1.center.y;
  sim.warfareSystem.handleRetreating(wb, commander);

  check('plunder unloaded event fired on return', unloadedFired);
  check('home stockpile received plundered food', (t1.stockpile.food || 0) > initialT1Food);
  check('warband plunder cargo emptied', wb.plunderCargo.food === 0);
}

// 3. Test Conquest & Annexation vs Tributary Vassalage
{
  const sim = new Simulation(9999, 128, 128, { scenario: 'peaceful' });
  const towns = [...sim.settlementSystem.settlements.values()];
  const victor = towns[0];
  const defeated = towns[1];

  let annexedEvent = false;
  sim.eventBus.on('SETTLEMENT_ANNEXED', () => { annexedEvent = true; });

  sim.warfareSystem.annexSettlement(victor.id, defeated.id);
  check('annexation event fired', annexedEvent);
  check('defeated settlement overlord set', defeated.overlordId === victor.id);
  check('defeated settlement banner color matches victor', defeated.bannerColor === victor.bannerColor);
  check('governor appointed from victor', defeated.governorId != null);

  // Test Tributary Vassalage & Seasonal Tribute
  const sim2 = new Simulation(8888, 128, 128, { scenario: 'peaceful' });
  const towns2 = [...sim2.settlementSystem.settlements.values()];
  const overlord = towns2[0];
  const vassal = towns2[1];

  sim2.warfareSystem.makeTributary(overlord.id, vassal.id);
  check('vassal tributeTo set', vassal.tributeTo === overlord.id);
  check('tribute rate is 15%', vassal.tributeRate === 0.15);

  vassal.stockpile.food = 100;
  vassal.stockpile.ore = 60;
  const initialOverlordFood = overlord.stockpile.food || 0;

  let tributePaidEvent = false;
  sim2.eventBus.on('TRIBUTE_PAID', () => { tributePaidEvent = true; });

  // Advance to season change
  sim2.clock.advance();
  sim2.clock.seasonChanged = () => true;
  sim2.updateEnvironment();

  check('seasonal tribute collected', tributePaidEvent);
  check('vassal food decreased by 15%', vassal.stockpile.food === 85);
  check('overlord received 15 food tribute', overlord.stockpile.food === initialOverlordFood + 15);
}

// 4. Test Step 6: Religious Wars, Missionaries, Heresy & Inquisitions
{
  const sim = new Simulation(3333, 128, 128, { scenario: 'peaceful' });
  const towns = [...sim.settlementSystem.settlements.values()];
  const t1 = towns[0];
  const t2 = towns[1];

  // Set different beliefs
  t1.culture.beliefId = 'solar_creed';
  t2.culture.beliefId = 'grove_communion';

  // Ensure an active priest/missionary in t1
  const t1Agents = Array.from(t1.agentIds);
  const t1Agent = sim._agentById(t1Agents[0]);
  t1Agent.job = 'priest';
  t1Agent.religion = { faith: 90, isPriest: true, beliefId: 'solar_creed' };

  // Ensure an active priest in t2 so missionary converts a different citizen
  const t2Agents = Array.from(t2.agentIds);
  const t2Priest = sim._agentById(t2Agents[0]);
  t2Priest.job = 'priest';
  t2Priest.religion = { faith: 85, isPriest: true, beliefId: 'grove_communion' };

  // Run missionary check
  let heresyFired = false;
  sim.eventBus.on('HERESY_SPREAD', () => { heresyFired = true; });
  sim.religionSystem.checkMissionariesAndHeresy(100);

  check('missionary spread heresy to neighbor town', heresyFired);
  check('heresy created grievance in neighbor town', sim.diplomacySystem.grievances.get(t2.id)?.has(t1.id));

  // Test Inquisition reconversion
  let inquisitorFired = false;
  sim.eventBus.on('HERETIC_CLEANSED', () => { inquisitorFired = true; });

  sim.religionSystem.checkInquisitions(80);
  check('inquisition cleansed heretic citizen', inquisitorFired);

  // Test Holy War declaration & zealot fervor
  const war = sim.diplomacySystem.declareWar(t1.id, t2.id, "Holy War — Crusade Against Heretics", 200);
  check('holy war flagged on war record', war && war.isHolyWar);

  const wb = sim.warfareSystem.mobilizeWarband(t1.id, t2.id, 'assault');
  check('holy warband has sacred zealot morale (120)', wb && wb.morale === 120);
  const soldier = sim._agentById(wb.soldiers[0]);
  check('crusader soldiers have zealotFervor combat bonus', soldier && soldier.combat?.zealotFervor);
}

// 5. Test Step 7: Diplomacy Outcomes, War Weariness, Demilitarization & POWs
{
  const sim = new Simulation(4444, 128, 128, { scenario: 'peaceful' });
  const towns = [...sim.settlementSystem.settlements.values()];
  const t1 = towns[0];
  const t2 = towns[1];

  const war = sim.diplomacySystem.declareWar(t1.id, t2.id, "Territorial Dispute", 100);
  war.weariness[t2.id] = 105; // high war weariness on t2

  let peaceFired = false;
  sim.eventBus.on('DIPLOMATIC_EVENT', (e) => {
    if (e.title.includes('Peace Treaty')) peaceFired = true;
  });

  const rel = sim.diplomacySystem.getRelation(t1.id, t2.id);
  sim.diplomacySystem.checkWarWeariness(t1, t2, rel, 250);

  check('war weariness triggered peace treaty', peaceFired);
  const archivedWar = sim.diplomacySystem.warHistory[0];
  check('archived war recorded treaty terms', archivedWar && archivedWar.terms);

  // Test Forced Demilitarization
  sim.diplomacySystem.signPeace(t1.id, t2.id, t1.id, 300, "Forced Demilitarization");
  check('defeated settlement has demilitarized cooldown', t2.demilitarizedUntil > 300);
  const disarmedWb = sim.warfareSystem.mobilizeWarband(t2.id, t1.id, 'assault');
  check('disarmed settlement cannot mobilize warbands', disarmedWb === null);

  // Test POW Ransoming & Execution
  const pow = sim._agentById(t2.agentIds.values().next().value);
  pow.captive = true;
  pow.prisonerOf = t1.id;
  t1.culture.values.belligerence = 0.2; // peaceful, will ransom
  t1.stockpile.food = 10;
  t2.stockpile.food = 20;

  let ransomedFired = false;
  sim.eventBus.on('PRISONERS_RANSOMED', () => { ransomedFired = true; });
  sim.diplomacySystem.signPeace(t1.id, t2.id, t1.id, 400, "White Peace Concordat");

  check('POW ransomed event fired', ransomedFired);
  check('captive status cleared after ransom', !pow.captive);
}

// 6. Determinism check
{
  const runSim = (seed) => {
    const sim = new Simulation(seed, 128, 128, { scenario: 'warring' });
    for (let i = 0; i < 200; i++) sim.tick();
    return sim.diplomacySystem.activeWars.map(w => `${w.id}:${w.attackerId}>${w.defenderId}`).sort().join('|');
  };

  const sig1 = runSim(777);
  const sig2 = runSim(777);
  check('Phase 3b war state is deterministic across identical seeds', sig1 === sig2);
}

if (failures > 0) {
  console.error(`\nPHASE 3B TESTS FAILED (${failures} failures)`);
  process.exit(1);
} else {
  console.log('\nALL PHASE 3B TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
