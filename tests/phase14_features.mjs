import { Simulation } from '../src/simulation/simulation.js';
import { Building } from '../src/simulation/building.js';
import { Resource } from '../src/simulation/resource.js';
import { BUILD_COSTS, BUILDING_METADATA, BUILDING_TYPES } from '../src/core/constants.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing Phase 14 Features & Stabilization Batches ---');

// 1. Obsolete Wall & Road Cleanup (Salvage without breaking valid perimeter or bridge approaches)
{
  const sim = new Simulation(6401, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const cx = Math.floor(s1.center.x);
  const cy = Math.floor(s1.center.y);
  s1.stockpile.wood = 0;
  s1.stockpile.ore = 0;

  // Inner-core obsolete palisade (< 3.5 tiles) + stale breach (>= 180 ticks) + valid outer wall
  const fort = sim.fortificationSystem;
  const W = sim.world.width;
  const addSeg = (tx, ty, tierKey) => {
    const idx = ty * W + tx;
    const seg = {
      id: fort.nextSegmentId++,
      x: tx,
      y: ty,
      tileIdx: idx,
      settlementId: s1.id,
      factionId: s1.factionId ?? null,
      kind: 'wall',
      state: 'intact',
      tierKey,
      hp: 100,
      maxHp: 100,
      builtAtTick: 0,
      breachedAtTick: null,
    };
    fort.segments.set(idx, seg);
    fort._syncSegGridAndIndex(seg, true);
    return seg;
  };

  fort.settlementMeta.set(s1.id, { radius: 10, tierKey: 'stone_wall' });
  addSeg(cx + 1, cy, 'palisade'); // inside core -> clean (refunds wood)
  const staleBreachSeg = addSeg(cx + 10, cy, 'stone_wall');
  staleBreachSeg.state = 'breach';
  staleBreachSeg.hp = 0;
  staleBreachSeg.breachedAtTick = 10; // stale breach >= 180 ticks -> clean (refunds ore)
  const validOuter = addSeg(cx, cy + 10, 'stone_wall');

  sim.clock.tick = 200;
  const removedWalls = fort.cleanObsoleteWalls(200);
  assertTrue(
    removedWalls >= 2 &&
      !fort.getSegmentAt(cx + 1, cy) &&
      !fort.getSegmentAt(cx + 10, cy) &&
      Boolean(validOuter && fort.getSegmentAt(cx, cy + 10)),
    `cleanObsoleteWalls salvages core/stale breach (${removedWalls} removed) while keeping valid outer wall`
  );
  assertTrue(
    (s1.stockpile.wood || 0) >= 1 && (s1.stockpile.ore || 0) >= 1,
    `Salvaged walls refund wood (${s1.stockpile.wood}) and ore (${s1.stockpile.ore}) to town stockpile`
  );

  // Road cleanup: isolated core stub pruned; road adjacent to bridge kept
  const stubX = cx + 2;
  const stubY = cy + 2;
  sim.world.setRoad(stubX, stubY, 1);
  sim.world.footTraffic[stubY * sim.world.width + stubX] = 0;

  const bridgeX = Math.max(4, cx - 12);
  const bridgeY = cy;
  const approachX = bridgeX - 1;
  sim.world.setBridge(bridgeX, bridgeY, true);
  sim.world.setRoad(approachX, bridgeY, 1);

  sim.infrastructureSystem.cleanObsoleteInfrastructure();
  assertTrue(
    !sim.world.isRoad(stubX, stubY) && sim.world.isRoad(approachX, bridgeY),
    'cleanObsoleteInfrastructure removes isolated core dirt stubs while preserving bridge approaches'
  );
}

// 2. Fallen Settlements History Archive & Inline Renaming (Settlement + Agent)
{
  const sim = new Simulation(6402, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const s2 = settlements[1];
  const oldS2Name = s2.name;

  // Give s2 some stats then rename & archive
  s2.stats = {
    births: 4,
    deaths: 3,
    buildingsBuilt: 5,
    warsFought: 1,
    battlesWon: 1,
    peakPopulation: 14,
  };

  const agent1 = sim._agentById(Array.from(s1.agentIds)[0]);
  const renamedSet = sim.renameSettlement(s1.id, 'Solstice Citadel');
  const renamedAg = sim.renameAgent(agent1.id, 'Lyra Starborne');
  assertTrue(
    renamedSet?.ok && s1.name === 'Solstice Citadel' && renamedAg?.ok && agent1.name === 'Lyra' && agent1.surname === 'Starborne',
    `renameSettlement & renameAgent update names (${s1.name}, ${agent1.name} ${agent1.surname})`
  );

  // Archive s2 as a fallen realm
  sim.settlementSystem._archiveFallenSettlement(s2, 'collapsed', 'Conquered in war', s1.name, 320);
  assertTrue(
    Array.isArray(sim.fallenSettlements) &&
      sim.fallenSettlements.some((fs) => fs.id === s2.id && fs.name === oldS2Name && fs.stats.peakPopulation >= 14),
    `fallenSettlements archives fallen realm (${oldS2Name}) with full stats`
  );

  const restored = Simulation.deserialize(sim.serialize());
  const rS1 = restored.settlementSystem.settlements.get(s1.id);
  const rAg = restored._agentById(agent1.id);
  assertTrue(
    rS1?.name === 'Solstice Citadel' &&
      rAg?.name === 'Lyra' &&
      rAg?.surname === 'Starborne' &&
      restored.fallenSettlements.some((fs) => fs.id === s2.id && fs.conqueredByName === 'Solstice Citadel'),
    'Serialize/deserialize preserves renamed settlements, agents, and fallenSettlements archive'
  );
}

// 3. Diverse Mortality Causes (Disease, Accident, Misadventure) + UI/Dossier Propagation
{
  const sim = new Simulation(6403, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const citizens = Array.from(s1.agentIds).map((id) => sim._agentById(id)).filter((a) => a && a.alive);
  assertTrue(citizens.length >= 3, 'Settlement has >= 3 citizens for mortality cause checks');

  const a1 = citizens[0];
  const a2 = citizens[1];
  const a3 = citizens[2];
  sim.ageSystem.handleDeath(a1, 'disease', 'succumbed to winter chill');
  sim.ageSystem.handleDeath(a2, 'accident', 'struck by a falling oak in the timberlands');
  sim.ageSystem.handleDeath(a3, 'misadventure', 'tried to tame a badger wearing tin armor');

  const d1 = sim.getAgentDossier(a1.id);
  const d2 = sim.getAgentDossier(a2.id);
  const d3 = sim.getAgentDossier(a3.id);
  assertTrue(
    d1?.deathCause === 'disease' && d1?.deathDetail?.includes('winter chill') &&
      d2?.deathCause === 'accident' && d2?.deathDetail?.includes('falling oak') &&
      d3?.deathCause === 'misadventure' && d3?.deathDetail?.includes('badger'),
    'Agent dossiers preserve distinct mortality causes (disease, accident, misadventure) and funny/detailed narratives'
  );

  const stats = sim.getStatisticsSnapshot();
  assertTrue(
    stats.causesOfDeath.some((c) => c.key === 'disease') &&
      stats.causesOfDeath.some((c) => c.key === 'accident') &&
      stats.causesOfDeath.some((c) => c.key === 'misadventure'),
    `Statistics snapshot breaks down disease, accident, and misadventure causes (${stats.causesOfDeath.map((c) => c.key).join(', ')})`
  );
}

// 4. Procedural Creeds, Doctrinal Compatibility Diplomacy & Save/Load Determinism
{
  const simA = new Simulation(6404, 128, 128, { scenario: 'peaceful' });
  const simB = new Simulation(6404, 128, 128, { scenario: 'peaceful' });
  const setA = Array.from(simA.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const setB = Array.from(simB.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);

  assertTrue(
    setA.length >= 2 &&
      setA[0].culture?.beliefId === setB[0].culture?.beliefId &&
      simA._rng().state === simB._rng().state,
    `Procedural creed initialization is deterministic and does not perturb RNG (${setA[0].culture?.beliefId})`
  );

  const creedHarm = simA.religionSystem.generateProceduralCreed(9001, 1);
  const creedSameTenet = simA.religionSystem.registerCustomCreed({
    id: 'proc_harmony_pair',
    name: 'Harmony Order',
    tenetType: creedHarm.tenetType,
  });
  const compatSame = simA.religionSystem.getCreedCompatibility(creedHarm.id, creedSameTenet.id);
  assertTrue(
    compatSame >= 0.5 && compatSame <= 1,
    `Matching creed tenets yield high doctrinal compatibility (${compatSame})`
  );

  const zealotA = simA.religionSystem.registerCustomCreed({ id: 'proc_zeal_a', name: 'Order A', tenetType: 'zealous' });
  const zealotB = simA.religionSystem.registerCustomCreed({ id: 'proc_zeal_b', name: 'Order B', tenetType: 'mystic' });
  const compatClash = simA.religionSystem.getCreedCompatibility(zealotA.id, zealotB.id);
  assertTrue(
    compatClash < 0,
    `Opposing zealous/mystic tenets produce negative compatibility (${compatClash})`
  );

  const restored = Simulation.deserialize(simA.serialize());
  assertTrue(
    Boolean(restored.religionSystem.getCreed(creedHarm.id) && restored.religionSystem.getCreed('proc_zeal_a')),
    'Serialize/deserialize preserves custom procedural creeds in religionSystem'
  );
}

// 5. Religious Buildings (Shrine, Church, Cemetery), Cemetery Burial & Conjure Fallen Spirit
{
  assertTrue(
    BUILDING_TYPES.SHRINE === 'shrine' &&
      BUILDING_TYPES.CHURCH === 'church' &&
      BUILDING_TYPES.CEMETERY === 'cemetery' &&
      Boolean(BUILD_COSTS.shrine && BUILD_COSTS.church && BUILD_COSTS.cemetery) &&
      Boolean(BUILDING_METADATA.shrine && BUILDING_METADATA.church && BUILDING_METADATA.cemetery),
    'Constants define shrine, church, and cemetery types, costs, and metadata'
  );

  const sim = new Simulation(6405, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const citizens = Array.from(s1.agentIds).map((id) => sim._agentById(id)).filter((a) => a && a.alive);

  const cem = new Building(Math.floor(s1.center.x + 2), Math.floor(s1.center.y), 'cemetery', sim.idGen, s1.id, s1.factionId ?? null);
  cem.complete = true;
  cem.isComplete = true;
  cem.constructionProgress = 100;
  sim.buildings.push(cem);

  const deceased = citizens[0];
  sim.removeAgent(deceased.id, 'old age');
  assertTrue(
    Array.isArray(cem.interredAgentIds) && cem.interredAgentIds.includes(deceased.id),
    `Completed cemetery automatically inters deceased citizen #${deceased.id}`
  );

  const deceasedDossier = sim.getAgentDossier(cem.interredAgentIds[0]);
  assertTrue(
    Boolean(deceasedDossier && deceasedDossier.id === deceased.id && (deceasedDossier.fullName || deceasedDossier.name)),
    'Cemetery interredAgentIds resolve via getAgentDossier for fallen memorial UI'
  );

  const priest = citizens[1];
  priest.job = 'priest';
  priest.religion = { faith: 95, maxFaith: 100, beliefId: 'solar_creed', lastRitualTime: 0, isPriest: true, sermonTimer: 0 };
  sim.religionSystem.priests.add(priest.id);
  priest.x = cem.x;
  priest.y = cem.y;

  sim.clock.tick = 150;
  priest.executeAction({ type: 'conjure_fallen', target: cem }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  assertTrue(
    Array.isArray(sim.spectralSpirits) && sim.spectralSpirits.length >= 1 && sim.spectralSpirits[0].settlementId === s1.id,
    `Priest conjure_fallen summons spectral ancestor spirit (${sim.spectralSpirits[0]?.name})`
  );

  const witness = citizens[2];
  witness.x = sim.spectralSpirits[0].x;
  witness.y = sim.spectralSpirits[0].y;
  witness.needs.social = 40;
  sim.religionSystem.updateSpectralSpirits(160);
  assertTrue(
    witness.needs.social > 40,
    `Spectral spirit aurally uplifts nearby citizens social (${witness.needs.social.toFixed(1)})`
  );

  const restored = Simulation.deserialize(sim.serialize());
  const rCem = restored.buildings.find((b) => b.id === cem.id);
  assertTrue(
    Array.isArray(rCem?.interredAgentIds) && rCem.interredAgentIds.includes(deceased.id) &&
      Array.isArray(restored.spectralSpirits) && restored.spectralSpirits.length === sim.spectralSpirits.length,
    'Serialize/deserialize preserves cemetery interredAgentIds and active spectralSpirits'
  );
}

// 6. Paved Stone Roads (1.85x Speed), Peaceful wander_to_town & Elder/Disgruntled Splinters
{
  const sim = new Simulation(6406, 128, 128, { scenario: 'peaceful' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const s1 = settlements[0];
  const s2 = settlements[1];

  // Upgrade heavily trafficked dirt road to paved stone road in Era 2
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 2, true);
  const rx = Math.max(2, Math.min(sim.world.width - 3, Math.floor(s1.center.x + 1)));
  const ry = Math.max(2, Math.min(sim.world.height - 3, Math.floor(s1.center.y)));
  sim.world.setRoad(rx, ry, 1);
  sim.world.footTraffic[ry * sim.world.width + rx] = 12;

  sim.clock.tick = 100;
  sim.infrastructureSystem.upgradePavedRoads();
  assertTrue(
    sim.world.isPavedRoad(rx, ry) && sim.world.isRoad(rx, ry),
    `Era 2 heavy-traffic dirt road upgrades to paved stone road (tier=${sim.world.roadTiles[ry * sim.world.width + rx]})`
  );

  // Verify 1.85x speed on paved road vs 1.45x on dirt road
  const runner = sim._agentById(Array.from(s1.agentIds)[0]);
  runner.lifeStage = 'adult';
  runner.needs.food = 80;
  runner.needs.water = 80;
  runner.speed = 1.0;
  runner.x = rx + 0.1;
  runner.y = ry + 0.1;
  const xBeforePaved = runner.x;
  runner.moveToward({ x: rx + 10, y: ry + 0.1 }, sim.world);
  const pavedDelta = runner.x - xBeforePaved;

  const dirtX = rx + 2;
  sim.world.setRoad(dirtX, ry, 1);
  runner.x = dirtX + 0.1;
  runner.y = ry + 0.1;
  const xBeforeDirt = runner.x;
  runner.moveToward({ x: dirtX + 10, y: ry + 0.1 }, sim.world);
  const dirtDelta = runner.x - xBeforeDirt;
  assertTrue(
    pavedDelta > dirtDelta + 0.25,
    `Paved road moves faster (${pavedDelta.toFixed(2)}) than dirt road (${dirtDelta.toFixed(2)})`
  );

  // Peaceful wander_to_town
  const relBefore = sim.diplomacySystem.getRelation(s1.id, s2.id);
  if (relBefore.status === 'war') relBefore.status = 'peace';
  const visitsBefore = relBefore.tradeVisits || 0;
  runner.x = s2.center.x;
  runner.y = s2.center.y;
  runner.needs.social = 35;
  runner.executeAction(
    { type: 'wander_to_town', target: { x: s2.center.x, y: s2.center.y, settlementId: s2.id } },
    sim.world,
    sim.eventBus,
    sim.craftingSystem,
    sim
  );
  assertTrue(
    runner.needs.social >= 50 && (relBefore.tradeVisits || 0) === visitsBefore + 1,
    `wander_to_town boosts citizen social (${runner.needs.social}) and inter-town tradeVisits (${relBefore.tradeVisits})`
  );

  // Elder/disgruntled splinter settlement at pop === 12
  // Ensure s1 has >= 12 eligible adult/elder citizens with an elder sage (age 64)
  while (s1.agentIds.size < 12) {
    const extra = sim.spawnAgent(s1.center.x, s1.center.y);
    extra.age = 25;
    extra.lifeStage = 'adult';
    extra.pioneer = false;
    extra.settlementId = s1.id;
    s1.agentIds.add(extra.id);
    sim.settlementSystem.agentSettlementMap.set(extra.id, s1.id);
  }
  s1.population = s1.agentIds.size;
  const elderCand = Array.from(s1.agentIds)
    .map((id) => sim._agentById(id))
    .find((a) => a && a.alive && !a.isMonarch && !a.militaryDuty && !a.captive && !a.isRebel);
  if (elderCand) {
    elderCand.age = 64;
    elderCand.lifeStage = 'elder';
  }
  const countBeforeSplinter = sim.settlementSystem.settlements.size;
  let splinterEvent = null;
  sim.eventBus.on('SETTLEMENT_FOUNDED', (e) => {
    if (e?.splinterFrom) splinterEvent = e;
  });
  sim.clock.tick = 199;
  sim.tick();
  assertTrue(
    sim.settlementSystem.settlements.size > countBeforeSplinter && splinterEvent?.splinterReason === 'elder',
    `Elder splinter colony founded at pop 12 (${splinterEvent?.name}, reason=${splinterEvent?.splinterReason})`
  );
}

// 7. Expanded 160x160 World & Verified Resource Consumption
{
  const sim = new Simulation(6407, undefined, undefined, { scenario: 'peaceful' });
  assertTrue(
    sim.world.width === 160 && sim.world.height === 160,
    `Default world dimensions expanded to 160x160 (${sim.world.width}x${sim.world.height})`
  );
  const reloadedWorld = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  assertTrue(
    reloadedWorld.world.width === 160 && reloadedWorld.world.height === 160,
    `Save/load preserves 160x160 world dimensions`
  );

  const s1 = Array.from(sim.settlementSystem.settlements.values())[0];
  s1.stockpile.wood = 20;
  s1.stockpile.ore = 20;
  const builder = sim._agentById(Array.from(s1.agentIds)[0]);
  const bx = Math.floor(s1.center.x + 2);
  const by = Math.floor(s1.center.y);
  const church = new Building(bx, by, 'church', sim.idGen, s1.id, s1.factionId ?? null);
  church.constructionProgress = 0;
  church.complete = false;
  sim.buildings.push(church);
  builder.x = bx;
  builder.y = by;
  const woodBefore = s1.stockpile.wood;
  const oreBefore = s1.stockpile.ore;
  for (let i = 0; i < 6; i++) {
    builder.executeAction({ type: 'build', target: church }, sim.world, sim.eventBus, sim.craftingSystem, sim);
  }
  assertTrue(
    s1.stockpile.wood < woodBefore && s1.stockpile.ore < oreBefore,
    `Building stone/iron church consumes both wood (${woodBefore}->${s1.stockpile.wood}) and ore (${oreBefore}->${s1.stockpile.ore})`
  );

  // Crafting plank_to_tool_handle consumes 'plank' (not 'wood_plank')
  const ws = sim.craftingSystem.createWorkshop(bx + 1, by + 1, 'general', 'Test CraftBench');
  ws.storage.set('plank', 4);
  const handleRecipe = sim.craftingSystem.getRecipe('plank_to_tool_handle');
  assertTrue(
    handleRecipe?.input?.type === 'plank' && sim.craftingSystem.canCraft(ws, handleRecipe),
    'plank_to_tool_handle recipe accepts and consumes plank input'
  );
  sim.craftingSystem.consumeInputs(ws, handleRecipe);
  assertTrue(
    (ws.storage.get('plank') || 0) === 3,
    `Crafting consumeInputs deducts plank (4 -> ${ws.storage.get('plank')})`
  );

  // Macro worker consumes nearby real map resource node instead of generating infinite stockpile goods
  const treeX = Math.floor(builder.x);
  const treeY = Math.floor(builder.y);
  const tree = new Resource(treeX, treeY, 'wood', 10, sim.idGen);
  sim.resources.push(tree);
  sim.world.addToSpatialIndex(treeX, treeY, tree);
  builder.job = 'lumberjack';
  const sumNearbyWood = () => sim.world.getEntitiesNear(treeX, treeY, 12)
    .filter((e) => e && e.type === 'resource' && e.resourceType === 'wood' && !e.destroyed)
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalWoodBefore = sumNearbyWood();
  const woodStockBefore = s1.stockpile.wood;
  builder.executeMacroTick(sim, 12);
  const totalWoodAfter = sumNearbyWood();
  assertTrue(
    totalWoodAfter < totalWoodBefore && s1.stockpile.wood === woodStockBefore + 1,
    `Macro lumberjack consumes map tree node (${totalWoodBefore} -> ${totalWoodAfter}) when producing stockpile wood`
  );

  // Periodic town civic upkeep consumes wood and food surplus
  while (s1.agentIds.size < 12) {
    const c = sim.spawnAgent(s1.center.x, s1.center.y);
    c.settlementId = s1.id;
    s1.agentIds.add(c.id);
    sim.settlementSystem.agentSettlementMap.set(c.id, s1.id);
  }
  s1.population = s1.agentIds.size;
  s1.stockpile.wood = 25;
  s1.stockpile.food = 25;
  sim.clock.tick = 199;
  sim.tick();
  assertTrue(
    s1.stockpile.wood < 25 && s1.stockpile.food <= 24,
    `Settlement civic upkeep consumes wood (25 -> ${s1.stockpile.wood}) and food (25 -> ${s1.stockpile.food})`
  );
}

console.log('--- Phase 14 Tests Passed! ---');
