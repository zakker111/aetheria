// Phase 6 Test Suite: Succession Crises, Civil Wars, Legendary Relics & Fallen Heroes
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

console.log('--- Testing Phase 6: Succession Crises, Civil Wars & Hall of Heroes ---');

// 1. Succession laws, pretender detection, civil war mobilization & usurpation
{
  const sim = new Simulation(6060, 128, 128, { scenario: 'warring' });
  sim.updateDynasties();

  const dynasties = [...sim.dynastySystem.dynasties.values()];
  const dyn = dynasties[0];
  check('dynasty exists for settlement', !!dyn);

  const lawChanged = sim.dynastySystem.setSuccessionLaw(dyn.id, 'elective');
  check('succession law can switch to elective', lawChanged && dyn.successionLaw === 'elective');

  sim.dynastySystem.updatePretender(dyn);
  check('rival claimant / pretender detected for realm', dyn.pretenderId != null && dyn.pretenderName != null);

  let crisisEvent = false;
  sim.eventBus.on('SUCCESSION_CRISIS_STARTED', (d) => {
    if (d.dynastyId === dyn.id) crisisEvent = true;
  });

  const cw = sim.dynastySystem.sparkSuccessionCrisis(dyn.id, 'Disputed Claim');
  check('succession crisis starts civil war', !!(cw && cw.active));
  check('SUCCESSION_CRISIS_STARTED emitted', crisisEvent);

  const rebelBand = sim.warfareSystem.warbands.get(cw.rebelWarbandId);
  const loyalBand = sim.warfareSystem.warbands.get(cw.loyalistWarbandId);
  check('civil war mobilizes both rebel and loyalist warbands', !!(rebelBand && loyalBand && rebelBand.isCivilWar && loyalBand.isCivilWar));

  const claimant = sim._agentById(cw.claimantId);
  const enemies = sim.warfareSystem.getAllNearbyEnemies(claimant, dyn.settlementId, 200);
  check('rebel claimant treats loyalist guards as hostile', enemies.some(e => loyalBand.soldiers.includes(e.id)));

  let usurpEvent = false;
  sim.eventBus.on('CROWN_USURPED', (d) => {
    if (d.dynastyId === dyn.id && d.usurperId === cw.claimantId) usurpEvent = true;
  });

  const outcome = sim.dynastySystem.resolveCivilWar(dyn, 'usurpation');
  check('usurpation outcome crowns claimant', outcome === 'usurpation' && dyn.monarchId === cw.claimantId);
  check('CROWN_USURPED event fired and civil war cleared', usurpEvent && dyn.civilWar === null);
  check('claimant isRebel flag cleared after resolution', claimant.isRebel === false);
}

// 2. Legendary Relic Weapon & Fallen Heroes Archival + Save/Load Determinism
{
  const sim = new Simulation(7070, 128, 128, { scenario: 'warring' });
  sim.updateDynasties();

  const hero = sim.agents.find(a => a.alive && !a.isMonarch);
  const targetA = sim.agents.find(a => a.alive && a.id !== hero.id);
  const targetB = sim.agents.find(a => a.alive && a.id !== hero.id && a.id !== targetA.id);
  const targetC = sim.agents.find(a => a.alive && a.id !== hero.id && a.id !== targetA.id && a.id !== targetB.id);

  for (const t of [targetA, targetB, targetC]) {
    if (!t.combat) sim.combatSystem.initCombatEntity(t);
    t.combat.health = 1;
    t.health = 1;
    sim.combatSystem.dealDamage(hero, t, 50);
  }

  check('champion reaches 3 kills and epithet', hero.kills === 3 && !!hero.epithet);
  check('champion awarded named legendary weapon relic at 3 kills', typeof hero.legendaryWeapon === 'string' && hero.legendaryWeapon.length > 0);

  // Trigger hero death & confirm fallenHeroes archive
  sim.eventBus.emit('AGENT_DIED', {
    agentId: hero.id,
    name: hero.name,
    x: hero.x,
    y: hero.y,
    age: Math.floor(hero.age),
    cause: 'battle'
  });

  check('fallen champion archived in simulation.fallenHeroes', sim.fallenHeroes.some(h => h.id === hero.id && h.legendaryWeapon === hero.legendaryWeapon));

  const saved = JSON.parse(JSON.stringify(sim.serialize()));
  const resumed = Simulation.deserialize(saved);
  check('fallenHeroes preserved across save/load', resumed.fallenHeroes.some(h => h.id === hero.id && h.kills === 3 && h.legendaryWeapon === hero.legendaryWeapon));

  for (let i = 0; i < 60; i++) {
    sim.tick();
    resumed.tick();
  }
  const fp = s => s.agents.map(a => `${a.id}:${a.x.toFixed(4)},${a.y.toFixed(4)},${a.isRebel ? 'R' : ''}`).sort().join('|');
  check('Phase 6 save/load resume remains deterministic', fp(sim) === fp(resumed));
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s)`);
  process.exit(1);
}
console.log('\nALL PHASE 6 SUCCESSION & HERO TESTS PASSED!');
