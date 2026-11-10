// Combat Lethality & Deeper Lore Verification Test
// Verifies:
// 1. Combat lethality: when health drops to 0, agent.alive is set to false and deathCause is 'combat'
// 2. Slayer tracking & epithets: killer.kills is incremented and killer receives heroic title/epithet
// 3. Chronicle lore integration: COMBAT_KILL event recorded in living chronicle with location & names
// 4. Battle naming: battles in warfareSystem are given historic geographical names
// 5. Deterministic save/load roundtrip for kills, epithets, and battle records

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

console.log('--- Testing Combat Lethality, Slayers, Epithets & Lore ---');

// 1. Combat Lethality & Slayer Epithets via CombatSystem
{
  const sim = new Simulation(4242, 128, 128, { scenario: 'peaceful' });
  const a1 = sim.agents[0];
  const a2 = sim.agents[1];

  check('test agents exist', a1 && a2);
  sim.combatSystem.initCombatEntity(a1);
  sim.combatSystem.initCombatEntity(a2);

  // Set health low so next hit is lethal
  a2.combat.health = 5;
  a2.health = 5;
  if (a2.needs) a2.needs.health = 5;

  let combatKillEventFired = false;
  sim.eventBus.on('COMBAT_KILL', (d) => {
    if (d.killerId === a1.id && d.victimId === a2.id) {
      combatKillEventFired = true;
    }
  });

  const died = sim.combatSystem.dealDamage(a1, a2, 20);
  check('dealDamage returned true indicating lethal blow', died === true);
  check('victim is dead and alive is false', a2.alive === false && a2.dead === true);
  check('victim deathCause is combat', a2.deathCause === 'combat');
  check('killer kills incremented to 1', a1.kills === 1);
  check('killer awarded slayer epithet', Boolean(a1.epithet));
  check('COMBAT_KILL event fired on eventBus', combatKillEventFired);

  // Check chronicle recorded the kill
  const recentEntries = sim.chronicleSystem.recent(10);
  const killEntry = recentEntries.find(e => e.killerId === a1.id || (e.text && e.text.includes(a1.name)));
  check('chronicle recorded the combat kill', Boolean(killEntry));
}

// 2. Warfare Battle Clash, Named Battles & Casualties
{
  const sim = new Simulation(9988, 128, 128, { scenario: 'peaceful' });
  const towns = [...sim.settlementSystem.settlements.values()];
  const t1 = towns[0];
  const t2 = towns[1];

  const war = sim.diplomacySystem.declareWar(t1.id, t2.id, "War of the Marches", 100);
  const wb = sim.warfareSystem.mobilizeWarband(t1.id, t2.id, 'assault');
  const soldier1 = sim._agentById(wb.soldiers[0]);
  const soldier2 = sim._agentById(t2.agentIds.values().next().value);

  // Simulate melee clash
  soldier2.health = 4;
  soldier2.needs.health = 4;
  if (soldier2.combat) soldier2.combat.health = 4;

  sim.warfareSystem.executeMeleeAttack(soldier1, soldier2, wb);

  check('warfare casualty marked dead with combat cause', soldier2.alive === false && soldier2.deathCause === 'combat');
  check('warfare attacker credited with kill and epithet', soldier1.kills >= 1 && Boolean(soldier1.epithet));
  check('war battle recorded with historic name', war.battles.length > 0 && typeof war.battles[0].name === 'string');
  check('war battle name has location descriptor', war.battles[0].name.includes('Battle') || war.battles[0].name.includes('Clash') || war.battles[0].name.includes('Slaughter') || war.battles[0].name.includes('Field'));
}

// 3. Save/Load Determinism of Kills & Epithets
{
  const sim = new Simulation(7711, 128, 128, { scenario: 'peaceful' });
  const a = sim.agents[0];
  a.kills = 3;
  a.epithet = 'the Slayer';
  a.battlesFought = 5;

  const serialized = sim.serialize();
  const resumed = Simulation.deserialize(serialized);
  const resumedAgent = resumed._agentById(a.id);

  check('kills preserved on resume', resumedAgent.kills === 3);
  check('epithet preserved on resume', resumedAgent.epithet === 'the Slayer');
  check('battlesFought preserved on resume', resumedAgent.battlesFought === 5);
}

if (failures > 0) {
  console.error(`\nCOMBAT LETHALITY & LORE TESTS FAILED (${failures} failures)`);
  process.exit(1);
} else {
  console.log('\nALL COMBAT LETHALITY & LORE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
