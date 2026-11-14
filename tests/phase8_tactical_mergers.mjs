// Phase 8 Test Suite: Carrying-Capacity Population Equilibrium, Lethal Tactical Warfare,
// Era 5-6 Modernization (Industrial Gunpowder & Modern Fireteam), and City Mergers -> Civil War

import { Simulation } from '../src/simulation/simulation.js';
import { CIVILIZATION_AGES } from '../src/systems/civilizationAgeSystem.js';

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failures++;
  } else {
    console.log(`PASS: ${name}`);
  }
}

console.log('--- Testing Phase 8: Carrying Capacity, Tactical Modern Warfare & City Mergers ---');

// 1. Population cap, exact birth/death counting (no double counting), and late-age speed
{
  const sim = new Simulation(8181, 128, 128, { maxAgents: 70 });
  let emittedBirths = 0;
  let emittedDeaths = 0;
  sim.eventBus.on('AGENT_CREATED', (d) => { if (d.reason === 'birth') emittedBirths++; });
  sim.eventBus.on('AGENT_DIED', () => { emittedDeaths++; });

  let exceededCap = false;
  for (let i = 0; i < 600; i++) {
    sim.tick();
    if (sim.agents.length > 70) exceededCap = true;
  }

  check('organic agent growth respects simulation maxAgents cap (<= 70)', !exceededCap && sim.agents.length <= 70);
  check('birthsThisSession matches AGENT_CREATED(birth) count without double-counting', sim.birthsThisSession === emittedBirths);
  check('deathsThisSession matches AGENT_DIED count without double-counting', sim.deathsThisSession === emittedDeaths);

  // Run default cap simulation to check older-age stability & tick latency
  const longSim = new Simulation(8282, 128, 128);
  for (let i = 0; i < 1200; i++) longSim.tick();
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) longSim.tick();
  const avgMs = (performance.now() - t0) / 200;
  check('default carrying-capacity simulation keeps late-game population bounded (<= 360)', longSim.agents.length <= 360);
  check(`older-age simulation maintains fast tick time (${avgMs.toFixed(2)} ms <= 25 ms)`, avgMs <= 25);
}

// 2. Attacks & wars produce real dead agents cleanly
{
  const sim = new Simulation(8383, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  for (let i = 0; i < sim.world.biome.length; i++) {
    sim.world.biome[i] = 'grassland';
    sim.world.waterLevel[i] = 0;
    sim.world.elevation[i] = 45;
  }

  const aAgents = Array.from({ length: 8 }, (_, k) => sim.spawnAgent(20 + (k % 3), 25 + Math.floor(k / 3)));
  const bAgents = Array.from({ length: 8 }, (_, k) => sim.spawnAgent(25 + (k % 3), 25 + Math.floor(k / 3)));
  const sA = sim.settlementSystem.foundSettlement(21, 26, aAgents, 'Ironcrest');
  const sB = sim.settlementSystem.foundSettlement(26, 26, bAgents, 'Ashwatch');
  sA.stockpile.weapon_sword = 8;
  sB.stockpile.weapon_sword = 8;

  let combatKills = 0;
  let combatDeaths = 0;
  sim.eventBus.on('COMBAT_KILL', () => { combatKills++; });
  sim.eventBus.on('AGENT_DIED', (d) => { if (d.cause === 'combat') combatDeaths++; });

  const war = sim.diplomacySystem.declareWar(sA.id, sB.id, 'Border Ambush', 10);
  const wbA = sim.warfareSystem.mobilizeWarband(sA.id, sB.id, 'assault');
  const wbB = sim.warfareSystem.mobilizeWarband(sB.id, sA.id, 'defense');

  check('both warring sides mobilized active warbands', Boolean(wbA && wbB));

  // Position warbands right across a meadow and tick through engagement
  for (const sid of wbA.soldiers) {
    const s = sim._agentById(sid);
    if (s) { s.x = 22.5; s.y = 26; }
  }
  for (const sid of wbB.soldiers) {
    const s = sim._agentById(sid);
    if (s) { s.x = 23.8; s.y = 26; }
  }
  wbA.state = 'engaging';
  wbB.state = 'engaging';

  for (let i = 0; i < 160; i++) sim.tick();

  const totalCasualties = (war.casualties[sA.id] || 0) + (war.casualties[sB.id] || 0);
  check('war clash produces genuine combat fatalities (COMBAT_KILL & dead agents)', combatKills >= 1 && combatDeaths >= 1);
  check('war casualty tracker increments when soldiers fall in battle', totalCasualties >= 1);
}

// 3. Era 5 & 6 military modernization, tactical kiting, and artillery AOE splash
{
  const sim = new Simulation(8484, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  for (let i = 0; i < sim.world.biome.length; i++) {
    sim.world.biome[i] = 'grassland';
    sim.world.waterLevel[i] = 0;
    sim.world.elevation[i] = 45;
  }

  const indAgents = Array.from({ length: 12 }, (_, k) => sim.spawnAgent(16 + (k % 3), 30 + Math.floor(k / 3)));
  const modAgents = Array.from({ length: 12 }, (_, k) => sim.spawnAgent(30 + (k % 3), 30 + Math.floor(k / 3)));
  const sInd = sim.settlementSystem.foundSettlement(17, 31, indAgents, 'Steamford');
  const sMod = sim.settlementSystem.foundSettlement(31, 31, modAgents, 'Vanguardia');

  sim.civilizationAgeSystem.getSettlementAge(sInd.id).ageId = CIVILIZATION_AGES.INDUSTRIAL.id;
  sim.civilizationAgeSystem.getSettlementAge(sMod.id).ageId = CIVILIZATION_AGES.MODERN.id;

  sim.diplomacySystem.declareWar(sInd.id, sMod.id, 'Modern Hegemony', 10);
  const wbInd = sim.warfareSystem.mobilizeWarband(sInd.id, sMod.id, 'assault');
  const wbMod = sim.warfareSystem.mobilizeWarband(sMod.id, sInd.id, 'defense');

  const indSoldiers = wbInd.soldiers.map(id => sim._agentById(id)).filter(Boolean);
  const modSoldiers = wbMod.soldiers.map(id => sim._agentById(id)).filter(Boolean);

  check('Industrial Era (Age 5) warband deploys musketeers and field cannon artillery',
    wbInd.eraId === 5 &&
    indSoldiers.some(s => s.combat?.weaponType === 'musket') &&
    indSoldiers.some(s => s.combat?.weaponType === 'cannon' && s.combatRole === 'artillery'));

  check('Modern Tactical Era (Age 6) warband deploys riflemen and AOE heavy artillery',
    wbMod.eraId === 6 &&
    modSoldiers.some(s => s.combat?.weaponType === 'rifle') &&
    modSoldiers.some(s => s.combat?.weaponType === 'artillery' && (s.combat?.splashRadius || 0) >= 3.0));

  // Verify tactical standoff/kiting & AOE artillery splash
  const musketeer = indSoldiers.find(s => s.combatRole === 'musketeer') || indSoldiers.find(s => s.combat?.weaponType === 'musket');
  const targetA = modSoldiers[0];
  const targetB = modSoldiers[1];
  const artilleryUnit = modSoldiers.find(s => s.combat?.weaponType === 'artillery');

  musketeer.x = 20; musketeer.y = 30;
  targetA.x = 21.5; targetA.y = 30; // Closer than safe standoff distance (~3.8)
  targetB.x = 22.0; targetB.y = 30;
  wbInd.state = 'engaging';
  const startMuskX = musketeer.x;
  sim.warfareSystem.handleEngaging(wbInd, sim._agentById(wbInd.commanderId));
  check('ranged musketeer kites back toward safe tactical standoff when enemy closes in', musketeer.x < startMuskX || musketeer.path?.length > 0);

  // Heavy artillery fires at targetA while targetB stands nearby -> splash hits targetB too
  artilleryUnit.x = 29; artilleryUnit.y = 30;
  artilleryUnit.combat.attackCooldown = 0;
  targetA.x = 22; targetA.y = 30;
  musketeer.x = 22.5; musketeer.y = 30.5;
  const secondaryInd = indSoldiers.find(s => s.id !== musketeer.id);
  secondaryInd.x = 23.0; secondaryInd.y = 30.5;
  const hpBeforeSplash = secondaryInd.health;
  sim.warfareSystem.executeMeleeAttack(artilleryUnit, musketeer, wbMod);
  check('modern artillery inflicts AOE splash damage & explosion FX on adjacent foes',
    secondaryInd.health < hpBeforeSplash &&
    sim.warfareSystem.combatEffects.some(e => e.type === 'explosion') &&
    sim.warfareSystem.combatEffects.some(e => e.type === 'artillery_shell'));
}

// 4. Close big cities merge into a Metropolis and can ignite Union Civil War
{
  const sim = new Simulation(8585, 96, 96, { skipInit: true, maxAgents: 250 });
  sim.world.simulation = sim;
  for (let i = 0; i < sim.world.biome.length; i++) {
    sim.world.biome[i] = 'grassland';
    sim.world.waterLevel[i] = 0;
    sim.world.elevation[i] = 45;
  }

  const cityAAgents = Array.from({ length: 22 }, (_, k) => sim.spawnAgent(30 + (k % 4), 30 + Math.floor(k / 4)));
  const cityBAgents = Array.from({ length: 20 }, (_, k) => sim.spawnAgent(44 + (k % 4), 30 + Math.floor(k / 4)));
  const c1 = sim.settlementSystem.foundSettlement(31.5, 32, cityAAgents, 'Sunspire');
  const c2 = sim.settlementSystem.foundSettlement(45.5, 32, cityBAgents, 'Goldgate');
  c1.stockpile.food = 100;
  c2.stockpile.food = 80;
  sim.diplomacySystem.initRelation(c1.id, c2.id);
  sim.diplomacySystem.getRelation(c1.id, c2.id).score = 75;
  sim.updateDynasties();

  let mergedEvent = null;
  let civilWarEvent = null;
  sim.eventBus.on('SETTLEMENTS_MERGED', (d) => { mergedEvent = d; });
  sim.eventBus.on('SUCCESSION_CRISIS_STARTED', (d) => { civilWarEvent = d; });

  // Find deterministic merge window (every 100 ticks)
  let merged = null;
  for (let stepTick = 100; stepTick <= 500; stepTick += 100) {
    sim.clock.tick = stepTick;
    merged = sim.settlementSystem.mergeCloseBigCities(stepTick);
    if (merged) break;
  }

  check('two close large peaceful cities unite automatically into a single Metropolis', Boolean(merged && merged.tier === 'Metropolis'));
  check('merged Metropolis consolidates population (>= 42) and both stockpiles (180 food)',
    merged && merged.population === 42 && merged.stockpile.food === 180 && sim.settlementSystem.settlements.size === 1);
  check('SETTLEMENTS_MERGED event recorded in chronicle',
    Boolean(mergedEvent) && sim.chronicleSystem.entries.some(e => e.text.includes('Grand Civic Union')));

  // Second tension shock triggers Union Power Struggle civil war with rebel & loyalist warbands
  const unionDyn = sim.dynastySystem.ensureSettlementDynasty(merged);
  check('union lowers legitimacy and elevates absorbed leader tension', unionDyn.legitimacy < 85 && unionDyn.pretenderId != null);
  if (!unionDyn.civilWar?.active) {
    unionDyn.crisisTension = 100;
    sim.dynastySystem.sparkSuccessionCrisis(unionDyn.id, 'Metropolis Union Power Struggle');
  }
  check('Metropolis union can escalate into rival-faction Civil War',
    Boolean(civilWarEvent) && Boolean(unionDyn.civilWar?.active) &&
    sim.warfareSystem.warbands.has(unionDyn.civilWar.rebelWarbandId) &&
    sim.warfareSystem.warbands.has(unionDyn.civilWar.loyalistWarbandId));

  // Save/load preserves Metropolis & maxAgents cleanly
  const saved = JSON.parse(JSON.stringify(sim.serialize()));
  const restored = Simulation.deserialize(saved);
  check('save/load preserves maxAgents, Metropolis tier, and dynasty state deterministically',
    restored.maxAgents === 250 &&
    restored.settlementSystem.settlements.get(merged.id)?.tier === 'Metropolis' &&
    restored.dynastySystem.dynasties.get(unionDyn.id)?.civilWar?.active === true);
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s)`);
  process.exit(1);
}
console.log('\nALL PHASE 8 CARRYING-CAPACITY, TACTICAL WARFARE & METROPOLIS MERGER TESTS PASSED!');
