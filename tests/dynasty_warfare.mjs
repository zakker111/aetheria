// Dynasty, Warfare Sieges & Diplomacy Systems Test Suite
// Verifies:
// 1. Noble houses and founding monarchs for settlements
// 2. Hereditary succession on monarch death (heir coronation)
// 3. Royal marriages forging non-aggression pacts and peace
// 4. Multi-stage sieges (encirclement, breach, assault, capitulation)
// 5. Dynamic War Score calculation and formal peace conferences
// 6. Complete save/load determinism

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

console.log('--- Testing Dynasties, Warfare Sieges & Peace Conferences ---');

// 1. Test Dynasty Founding & Monarchs
{
  const sim = new Simulation(4242, 128, 128, { scenario: 'warring' });
  sim.updateDynasties();

  const settlements = [...sim.settlementSystem.settlements.values()];
  check('settlements exist', settlements.length >= 2);

  const dynasties = [...sim.dynastySystem.dynasties.values()];
  check('noble houses founded for settlements', dynasties.length >= 2);

  const d1 = dynasties[0];
  check('dynasty has house name', d1.name && d1.name.startsWith('House of'));
  check('dynasty has coat of arms and motto', d1.coatOfArms && d1.motto);
  check('dynasty has living monarch', d1.monarchId != null);

  const monarch = sim._agentById(d1.monarchId);
  check('monarch agent flagged as monarch', monarch && monarch.isMonarch);
  check('dynasty lineage contains monarch node', d1.lineage.some(n => n.id === d1.monarchId));
}

// 2. Test Succession on Monarch Death
{
  const sim = new Simulation(5555, 128, 128, { scenario: 'warring' });
  sim.updateDynasties();

  const d1 = [...sim.dynastySystem.dynasties.values()][0];
  const oldMonarchId = d1.monarchId;
  const oldMonarch = sim._agentById(oldMonarchId);

  // Designate or simulate an heir
  const settlement = sim.settlementSystem.settlements.get(d1.settlementId);
  const otherAgents = Array.from(settlement.agentIds).filter(id => id !== oldMonarchId);
  if (otherAgents.length > 0) {
    const heir = sim._agentById(otherAgents[0]);
    d1.heirId = heir.id;
    d1.heirName = heir.name;
    d1.members.push(heir.id);
    d1.lineage.push({
      id: heir.id,
      name: heir.name,
      gender: heir.gender || 'male',
      generation: 2,
      parents: [oldMonarchId],
      spouseId: null,
      birthTick: 0,
      deathTick: null,
      alive: true,
      causeOfDeath: null,
      reignStart: null,
      reignEnd: null,
      title: `Prince ${heir.name}`
    });

    let coronationFired = false;
    sim.eventBus.on('CORONATION', (data) => {
      if (data.dynastyId === d1.id) coronationFired = true;
    });

    // Kill monarch
    oldMonarch.alive = false;
    sim.dynastySystem.onAgentDied(oldMonarch, 'old age');

    check('coronation event fired upon monarch death', coronationFired);
    check('heir ascended to throne as new monarch', d1.monarchId === heir.id);
    check('old monarch recorded as deceased in lineage', d1.lineage.find(n => n.id === oldMonarchId)?.alive === false);
  }
}

// 3. Test Royal Marriage & Peace Concordat
{
  const sim = new Simulation(7777, 128, 128, { scenario: 'warring' });
  sim.updateDynasties();

  const dynasties = [...sim.dynastySystem.dynasties.values()];
  const dynA = dynasties[0];
  const dynB = dynasties[1];

  let marriageFired = false;
  sim.eventBus.on('ROYAL_MARRIAGE', () => { marriageFired = true; });

  const record = sim.dynastySystem.arrangeRoyalMarriage(dynA.id, dynB.id);
  check('royal marriage record created', record != null);
  check('ROYAL_MARRIAGE event fired', marriageFired);

  const treaty = sim.diplomacySystem.treaties.find(t => t.type.includes('Royal Marriage'));
  check('royal marriage non-aggression treaty signed in diplomacy system', treaty != null);

  const rel = sim.diplomacySystem.getRelation(dynA.settlementId, dynB.settlementId);
  check('settlement diplomatic relation set to peace or positive score', rel.status === 'peace' || rel.score >= 40);
}

// 4. Test Multi-Stage Sieges & Capitulation
{
  const sim = new Simulation(8888, 128, 128, { scenario: 'peaceful' });
  sim.updateDynasties();

  const towns = [...sim.settlementSystem.settlements.values()];
  const tAttacker = towns[0];
  const tDefender = towns[1];

  tDefender.stockpile.food = 100;
  tDefender.stockpile.wood = 50;
  tDefender.stockpile.ore = 30;

  const wb = sim.warfareSystem.mobilizeWarband(tAttacker.id, tDefender.id, 'assault');
  const commander = sim._agentById(wb.commanderId);
  commander.x = tDefender.center.x;
  commander.y = tDefender.center.y;

  // Stage 1: Encirclement
  sim.warfareSystem.handleSieging(wb, commander);
  check('siege progression starts with encirclement', wb.siegeStage === 'encirclement');
  check('siege ticks tracked on warband', wb.siegeTicks >= 1);

  // Advance siege to breach
  wb.siegeTicks = 3;
  sim.warfareSystem.handleSieging(wb, commander);
  check('siege advances to breach stage with battering ram', wb.siegeStage === 'breach' && wb.hasRam);

  // Advance siege to assault and capitulation
  let capitulatedFired = false;
  sim.eventBus.on('TOWN_CAPITULATED', () => { capitulatedFired = true; });

  wb.siegeTicks = 7;
  sim.warfareSystem.handleSieging(wb, commander);
  check('siege advances to assault stage', wb.siegeStage === 'assault');
  check('TOWN_CAPITULATED event fired upon town surrender', capitulatedFired);
}

// 5. Test Dynamic War Score & Peace Conference
{
  const sim = new Simulation(9999, 128, 128, { scenario: 'warring' });
  sim.updateDynasties();

  const towns = [...sim.settlementSystem.settlements.values()];
  const t1 = towns[0];
  const t2 = towns[1];

  const war = sim.diplomacySystem.declareWar(t1.id, t2.id, 'Territorial Border Feud', 100);
  check('active war created', war != null);

  // Simulate casualties
  war.casualties[t2.id] = 5;
  war.casualties[t1.id] = 1;
  const score = sim.diplomacySystem.calculateWarScore(war);
  check('war score calculated favoring attacker (+32)', score > 0);

  let confFired = false;
  sim.eventBus.on('PEACE_CONFERENCE_CONCLUDED', () => { confFired = true; });

  const conference = sim.diplomacySystem.convenePeaceConference(t1.id, t2.id, null, 'Decisive Victory');
  check('peace conference concluded with treaty terms', conference && conference.terms);
  check('PEACE_CONFERENCE_CONCLUDED event emitted', confFired);
  check('victor determined based on war score', conference.victorId === t1.id);
}

// 6. Test Save/Load Determinism with Dynasties
{
  const sim = new Simulation(13579, 128, 128, { scenario: 'warring' });
  for (let i = 0; i < 500; i++) sim.tick();

  const saved = JSON.parse(JSON.stringify(sim.serialize()));
  const resumed = Simulation.deserialize(saved);

  for (let i = 0; i < 200; i++) {
    sim.tick();
    resumed.tick();
  }

  const d1 = sim.dynastySystem.dynasties.size;
  const d2 = resumed.dynastySystem.dynasties.size;
  check('dynasty count preserved on resume', d1 === d2 && d1 > 0);

  const fp = s => s.agents.map(a => `${a.id}:${a.x.toFixed(4)},${a.y.toFixed(4)},${a.isMonarch ? 'M' : ''}`).sort().join('|');
  check('simulation resume remains 100% deterministic with dynasties & sieges', fp(sim) === fp(resumed));
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nALL DYNASTY, SIEGE & PEACE TESTS PASSED!');
}
