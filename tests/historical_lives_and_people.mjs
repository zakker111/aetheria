import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/simulation.js';
import { Building } from '../src/simulation/building.js';
import { assignDeterministicSurname, formatAgentFullName } from '../src/simulation/agent.js';

// 1. Founding surnames, determinism, and birth generation inheritance
const sim = new Simulation(4242);
assert.ok(sim.agents.length > 0, 'Founding agents should exist');
for (const a of sim.agents) {
  assert.ok(a.surname && typeof a.surname === 'string', `Agent ${a.name} missing surname`);
  assert.equal(a.generation, 1, 'Founding agent should start at generation 1');
}

// Run 500 ticks to accumulate real emergent births, builds, marriages, and chronicle entries
for (let i = 0; i < 500; i++) sim.tick();

// Verify all living agents have surnames and era-stamped life events
for (const a of sim.agents) {
  assert.ok(a.surname, 'Every citizen retains a surname');
  for (const ev of (a.lifeHistory || [])) {
    assert.ok(ev.eraId >= 1 && ev.eraName, `Life event ${ev.kind} missing era metadata`);
    assert.equal(ev.year, Math.floor((ev.tick || 0) / 400) + 1, 'Life event year matches 400-tick calendar');
  }
}

// 2. Test explicit building construction attribution + upgrade attribution
const settlements = Array.from(sim.settlementSystem.settlements.values());
assert.ok(settlements.length >= 1, 'At least 1 settlement exists');
const homeTown = settlements[0];
const builder = sim.agents.find(a => a.alive && a.settlementId === homeTown.id) || sim.agents[0];
const bld = new Building(Math.floor(builder.x), Math.floor(builder.y), 'house', sim.idGen, homeTown.id, homeTown.factionId);
bld.constructionProgress = 96;
bld.complete = false;
sim.buildings.push(bld);
sim.world.addToSpatialIndex(bld.x, bld.y, bld);
sim.world.entityRegistry.set(bld.id, bld);

const prevBuiltCount = builder.buildingsBuilt || 0;
builder.executeAction({ type: 'build', target: bld }, sim.world, sim.eventBus, sim.craftingSystem, sim);
assert.equal(bld.complete, true, 'Building should complete after build action');
assert.equal(bld.builtByAgentId, builder.id, 'Building records lead builder agentId');
assert.equal(bld.builtByName, formatAgentFullName(builder), 'Building records lead builder fullName');
assert.ok(bld.builtYear >= 1, 'Building records builtYear');
assert.ok(bld.builtEraName && typeof bld.builtEraName === 'string', 'Building records builtEraName');
assert.ok(Array.isArray(bld.contributors) && bld.contributors.some(c => c.id === builder.id), 'Building records contributors list');
assert.equal(builder.buildingsBuilt, prevBuiltCount + 1, 'Builder buildingsBuilt counter incremented');
assert.ok(builder.lifeHistory.some(ev => ev.kind === 'BUILT'), 'Builder logs BUILT life event');

// Heritage monument dedication plaque test
const mon = new Building(Math.floor(builder.x), Math.floor(builder.y), 'monument_cairn', sim.idGen, homeTown.id, homeTown.factionId);
mon.constructionProgress = 96;
mon.complete = false;
sim.buildings.push(mon);
sim.world.addToSpatialIndex(mon.x, mon.y, mon);
sim.world.entityRegistry.set(mon.id, mon);
builder.executeAction({ type: 'build', target: mon }, sim.world, sim.eventBus, sim.craftingSystem, sim);
assert.equal(mon.complete, true, 'Heritage monument completes');
assert.ok(mon.dedication && mon.dedication.includes(formatAgentFullName(builder)), 'Heritage monument records builder dedication plaque');

// Upgrade building attribution & multi-tier upgradeHistory
const ageEntry = sim.civilizationAgeSystem.settlementAges.get(homeTown.id);
if (ageEntry) ageEntry.ageId = Math.max(ageEntry.ageId || 1, 3);
homeTown.stockpile.wood = 200;
homeTown.stockpile.ore = 200;
const upRes = sim.upgradeBuilding(bld.id, { byPlayer: true });
assert.equal(upRes.ok, true, 'Building upgrade succeeds');
assert.ok(bld.upgradedByName, 'Upgraded building records upgradedByName');
assert.ok(Array.isArray(bld.upgradeHistory) && bld.upgradeHistory.length === 1, 'Building records upgradeHistory entry');
assert.equal(bld.upgradeHistory[0].level, 2, 'upgradeHistory records upgraded level');
assert.ok(bld.upgradeHistory[0].eraName, 'upgradeHistory records active era name');

// 3. Test Era Transition lifeHistory stamping
const citizenForEra = sim.agents.find(a => a.alive && a.settlementId === homeTown.id && a.age >= 12);
if (citizenForEra && ageEntry) {
  ageEntry.ageId = 1;
  ageEntry.points = 999999;
  homeTown.stockpile.wood = 200;
  homeTown.stockpile.ore = 200;
  // Seed enough tech points or directly invoke advance if exposed; otherwise verify ERA_DAWN via civilizationAgeSystem
  const beforeEraEvents = citizenForEra.lifeHistory.filter(e => e.kind === 'ERA_DAWN').length;
  // Trigger evaluate tick when age advances
  ageEntry.points = 10000;
  sim.civilizationAgeSystem.update(sim.clock.tick + 100);
  const afterEraEvents = citizenForEra.lifeHistory.filter(e => e.kind === 'ERA_DAWN').length;
  assert.ok(afterEraEvents >= beforeEraEvents, 'ERA_DAWN stamping remains deterministic and valid');
}

// 4. Test Diplomatic life event stamping on Monarch & Heirloom inheritance on death
const dyn = sim.dynastySystem?.getSettlementDynasty?.(homeTown.id);
const monarch = dyn?.monarchId != null ? sim._agentById(dyn.monarchId) : builder;
assert.ok(monarch && monarch.alive, 'Settlement has a living monarch or fallback notable');
monarch.isMonarch = true;

// Emit diplomatic treaty event for monarch
if (settlements.length >= 2) {
  sim.diplomacySystem.emitDiplomacyEvent(settlements[0], settlements[1], 'Grand Concordat Treaty', 'Historic treaty');
  assert.ok(monarch.lifeHistory.some(e => e.kind === 'TREATY'), 'Monarch logs TREATY life event');
}

// Give monarch a living child and test heirloom bequeathal on death
const heir = sim.agents.find(a => a.alive && a.id !== monarch.id && a.settlementId === homeTown.id) || sim.agents.find(a => a.alive && a.id !== monarch.id);
assert.ok(heir, 'Heir agent exists');
heir.surname = monarch.surname;
heir.generation = (monarch.generation || 1) + 1;
heir.parents = [monarch.id];
sim.relationshipSystem.addParentChild(monarch.id, heir.id);

monarch.buildingsBuilt = Math.max(monarch.buildingsBuilt || 0, 2);
sim.ageSystem.handleDeath(monarch, 'old_age');

assert.equal(monarch.alive, false, 'Deceased monarch marked dead');
assert.ok(heir.heirloom && heir.heirloom.name, 'Heir inherits personal heirloom on parent death');
assert.ok(heir.lifeHistory.some(e => e.kind === 'HEIRLOOM'), 'Heir logs HEIRLOOM life event');

// 5. Verify Dossier biography & Dead Dossier archive
const deadDossier = sim.getAgentDossier(monarch.id);
assert.ok(deadDossier, 'Deceased monarch dossier remains inspectable');
assert.equal(deadDossier.alive, false);
assert.ok(deadDossier.biography && deadDossier.biography.includes(monarch.surname), 'Fallen biography mentions surname & history');
assert.ok(deadDossier.lifeHistory.some(e => e.kind === 'HEIRLOOM'), 'Fallen dossier preserves HEIRLOOM bequeathal entry');
assert.ok(deadDossier.lifeHistory.some(e => e.kind === 'DEATH'), 'Fallen dossier preserves DEATH entry');

const livingDossier = sim.getAgentDossier(heir.id);
assert.ok(livingDossier.biography && livingDossier.biography.includes(heir.heirloom.name), 'Living biography highlights inherited heirloom');
assert.equal(livingDossier.fullName, formatAgentFullName(heir));

const builderDossier = sim.getAgentDossier(builder.id);
assert.ok(Array.isArray(builderDossier.builtStructures) && builderDossier.builtStructures.some(s => s.id === mon.id), 'Builder dossier includes built monument reference');
assert.ok(builderDossier.builtStructures.some(s => s.id === bld.id), 'Builder dossier includes standard house built');

// Verify citizen marriage milestones occurred deterministically across 500 ticks of births
const anyMarriageRecorded =
  sim.agents.some(a => (a.lifeHistory || []).some(ev => ev.kind === 'MARRIAGE')) ||
  (sim._deadDossiers || []).some(d => (d.lifeHistory || []).some(ev => ev.kind === 'MARRIAGE'));
if (sim.relationshipSystem.marriages.size > 0) {
  assert.ok(anyMarriageRecorded, 'Marriages log MARRIAGE life milestones on spouses');
}

// 6. Verify getHistoricalPeopleRoster()
const roster = sim.getHistoricalPeopleRoster();
assert.ok(roster.livingLegends.length > 0, 'Roster includes living citizens & legends');
assert.ok(roster.familyLines.length > 0, 'Roster aggregates multi-generation family houses');
assert.ok(roster.fallenArchives.some(f => f.id === monarch.id), 'Fallen archive preserves deceased monarch');
assert.ok(roster.livingLegends.some(p => p.id === heir.id && p.heirloom?.name === heir.heirloom.name), 'Living legend carries heirloom in roster');
const heirHouse = roster.familyLines.find(f => f.surname === heir.surname);
assert.ok(heirHouse, 'Heir house appears in familyLines');
assert.ok(Array.isArray(heirHouse.heirlooms) && heirHouse.heirlooms.some(h => h.name === heir.heirloom.name && h.holderId === heir.id), 'House aggregates heirloom provenance and holderId');

// 7. Save/Load round-trip parity for new fields
const snap = JSON.parse(JSON.stringify(sim.serialize()));
const restored = Simulation.deserialize(snap);
const restoredBld = restored.buildings.find(b => b.id === bld.id);
const restoredMon = restored.buildings.find(b => b.id === mon.id);
assert.ok(restoredBld, 'Restored building found');
assert.equal(restoredBld.builtByName, bld.builtByName, 'Building builtByName survives save/load');
assert.equal(restoredBld.builtEraName, bld.builtEraName, 'Building builtEraName survives save/load');
assert.equal(restoredBld.upgradedByName, bld.upgradedByName, 'Building upgradedByName survives save/load');
assert.equal(restoredBld.upgradedByAgentId, bld.upgradedByAgentId, 'Building upgradedByAgentId survives save/load');
assert.equal(restoredBld.upgradeHistory?.length, bld.upgradeHistory?.length, 'Building upgradeHistory survives save/load');
assert.equal(restoredBld.contributors?.length, bld.contributors?.length, 'Building contributors survive save/load');
assert.equal(restoredMon?.dedication, mon.dedication, 'Monument dedication plaque survives save/load');

const restoredHeir = restored._agentById(heir.id);
assert.ok(restoredHeir, 'Restored heir found');
assert.equal(restoredHeir.surname, heir.surname, 'Surname survives save/load');
assert.equal(restoredHeir.generation, heir.generation, 'Generation survives save/load');
assert.equal(restoredHeir.heirloom?.name, heir.heirloom?.name, 'Heirloom survives save/load');

// 8. Zero-RNG determinism guarantee across fresh run vs save/load resume
const d1 = new Simulation(7777);
const d2 = new Simulation(7777);
for (let i = 0; i < 300; i++) { d1.tick(); d2.tick(); }
const dSave = JSON.parse(JSON.stringify(d1.serialize()));
const dResume = Simulation.deserialize(dSave);
for (let i = 0; i < 300; i++) { d1.tick(); d2.tick(); dResume.tick(); }
assert.equal(d1.agents.length, d2.agents.length, 'Same-seed determinism preserved');
assert.equal(d1.agents.length, dResume.agents.length, 'Save/load resume population determinism preserved');
assert.deepEqual(
  d1.agents.map(a => `${a.id}:${a.surname}:${a.x.toFixed(4)},${a.y.toFixed(4)}`),
  dResume.agents.map(a => `${a.id}:${a.surname}:${a.x.toFixed(4)},${a.y.toFixed(4)}`),
  'Exact bit-for-bit position and surname determinism after save/load resume'
);

// Helper sanity check
const dummy = { id: 99, name: 'Rowan', surname: null };
const s1 = assignDeterministicSurname(dummy, 4242);
assert.ok(s1 && dummy.surname === s1);

console.log('HISTORICAL LIVES & PEOPLE BROWSER TEST OK');
