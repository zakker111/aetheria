import { Simulation } from '../src/simulation/simulation.js';

function assertTrue(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('--- Testing City Walls, Watchtowers & Physical Siege Breaches ---');

// 1. Perimeter Ring, Era Tiers, Citadel Wonder Stacking & Watchtower Spawning
{
  const sim = new Simulation(5151, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1] = settlements;
  assertTrue(Boolean(s1), 'initialized settlement for fortification ring tests');

  let builtEvent = null;
  sim.eventBus.on('FORTIFICATIONS_BUILT', (d) => {
    if (d.settlementId === s1.id) builtEvent = d;
  });

  const res1 = sim.fortificationSystem.fortifySettlement(s1.id, { tick: 200 });
  const sum1 = sim.fortificationSystem.getSettlementFortificationSummary(s1.id);
  assertTrue(Boolean(res1 && res1.created > 10 && sum1.hasWalls && sum1.intactGates >= 1),
    'fortifySettlement constructs octagonal perimeter walls and gatehouses');
  assertTrue(sum1.tierKey === 'palisade' && sum1.towers >= 2,
    'Era 1 fortifies with Timber Palisade and spawns defensive watchtowers');
  assertTrue(Boolean(builtEvent && builtEvent.segmentsCount === res1.created),
    'FORTIFICATIONS_BUILT event emitted upon initial fortification');

  // Verify 4-connected geometry & Era 3 -> Era 5 upgrades + Grand Imperial Citadel Wonder stacking
  sim.civilizationAgeSystem.setSettlementAge(s1.id, 3, true);
  sim.fortificationSystem.fortifySettlement(s1.id, { tick: 220 });
  const sum3 = sim.fortificationSystem.getSettlementFortificationSummary(s1.id);
  assertTrue(sum3.tierKey === 'stone_wall', 'Era 3 upgrades perimeter walls to Stone Curtain Wall');

  sim.civilizationAgeSystem.setSettlementAge(s1.id, 5, true);
  sim.civilizationAgeSystem.commissionWonder(s1.id, 'grand_citadel', 230);
  sim.civilizationAgeSystem.advanceWonderProgress(s1.id, 400, 235);
  sim.fortificationSystem.fortifySettlement(s1.id, { tick: 240 });
  const sum5 = sim.fortificationSystem.getSettlementFortificationSummary(s1.id);
  const sampleSeg = Array.from(sim.fortificationSystem.segments.values()).find(seg => seg.settlementId === s1.id);
  assertTrue(sum5.tierKey === 'bastion' && sum5.defenseMultiplier === 1.35,
    'Era 5 upgrades to Reinforced Bastion Wall and Grand Citadel grants 1.35x defense multiplier');
  assertTrue(Boolean(sampleSeg && sampleSeg.maxHp === 540),
    `Grand Citadel stacks wall maxHp to 540 (got ${sampleSeg?.maxHp})`);
}

// 2. Physical Blocking, Gate Funneling & Hostile Siege Breaching
{
  const sim = new Simulation(6262, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;
  assertTrue(Boolean(s1 && s2), 'initialized opposing kingdoms for physical breach test');

  sim.fortificationSystem.fortifySettlement(s1.id, { tick: 180 });
  const s1Segs = Array.from(sim.fortificationSystem.segments.values()).filter(seg => seg.settlementId === s1.id);
  const solidWall = s1Segs.find(seg => seg.kind === 'wall');
  const gateSeg = s1Segs.find(seg => seg.kind === 'gate');
  assertTrue(Boolean(solidWall && gateSeg), 'fortified city has both solid wall tiles and gatehouse tiles');

  // Ensure a friendly citizen in s1
  const citizen = sim.spawnAgent(s1.center.x, s1.center.y);
  citizen.age = 24;
  citizen.lifeStage = 'adult';
  citizen.settlementId = s1.id;
  s1.agentIds.add(citizen.id);
  sim.settlementSystem.agentSettlementMap.set(citizen.id, s1.id);

  assertTrue(sim.fortificationSystem.isBlockedForAgent(solidWall.x, solidWall.y, citizen) === true,
    'solid perimeter wall blocks traversal');
  assertTrue(sim.fortificationSystem.isBlockedForAgent(gateSeg.x, gateSeg.y, citizen) === false,
    'gatehouse stays passable for friendly citizens');
  assertTrue(sim.world.isTilePassableForAgent(gateSeg.x, gateSeg.y, citizen) === true,
    'world.isTilePassableForAgent allows friendly citizen through gatehouse');

  // Ensure war + adult soldiers in s2
  sim.diplomacySystem.declareWar(s2.id, s1.id, 'Border Conquest', 190);
  for (let i = 0; i < 6; i++) {
    const a = sim.spawnAgent(s2.center.x + (i % 2), s2.center.y + Math.floor(i / 2));
    a.age = 24;
    a.lifeStage = 'adult';
    a.pioneer = false;
    a.militaryDuty = false;
    a.warbandId = null;
    a.settlementId = s2.id;
    s2.agentIds.add(a.id);
    sim.settlementSystem.agentSettlementMap.set(a.id, s2.id);
  }
  s2.population = s2.agentIds.size;

  const warband = sim.warfareSystem.mobilizeWarband(s2.id, s1.id, 'assault');
  assertTrue(Boolean(warband && warband.soldiers.length >= 2), 'mobilized besieging warband against walled city');

  const hostileSoldier = sim._agentById(warband.soldiers[0]);
  assertTrue(sim.fortificationSystem.isBlockedForAgent(gateSeg.x, gateSeg.y, hostileSoldier) === true,
    'gatehouse slams shut against hostile warband soldiers');

  // Position hostile warband right outside the chosen solid wall segment to test breach flow directly
  let breachEvent = null;
  sim.eventBus.on('WALL_BREACHED', (d) => {
    if (d.settlementId === s1.id) breachEvent = d;
  });

  for (const sid of warband.soldiers) {
    const s = sim._agentById(sid);
    if (s) {
      s.x = solidWall.x + 0.5;
      s.y = solidWall.y - 1.2;
    }
  }
  const cmd = sim._agentById(warband.commanderId);
  const targetSeg = sim.fortificationSystem.findBlockingWallForWarband(cmd.x, cmd.y, s1.id) || solidWall;
  warband.state = 'marching';

  let enteredBreaching = false;
  for (let step = 0; step < 12; step++) {
    sim.warfareSystem.updateWarband(warband);
    if (warband.state === 'breaching') enteredBreaching = true;
    if (targetSeg.state === 'breach') break;
  }

  assertTrue(enteredBreaching || targetSeg.state === 'breach', 'marching warband enters breaching state at intact enemy wall');
  assertTrue(targetSeg.state === 'breach' && targetSeg.hp === 0,
    'besiegers physically smash wall segment into an open rubble breach');
  assertTrue(Boolean(breachEvent), 'WALL_BREACHED event emitted upon wall collapse');
  assertTrue(sim.fortificationSystem.isBlockedForAgent(targetSeg.x, targetSeg.y, hostileSoldier) === false,
    'breached wall tile becomes passable for storming forces');
  assertTrue(warband.state === 'sieging', 'warband transitions to sieging once perimeter breach opens');
  assertTrue(sim.chronicleSystem.entries.some(e => e.kind === 'war' && e.text.includes('physical breach')),
    'ChronicleSystem records physical wall breach');
}

// 3. Active Watchtower Defense & Divine Fortification Tools
{
  const sim = new Simulation(7373, 128, 128, { scenario: 'warring' });
  const settlements = Array.from(sim.settlementSystem.settlements.values()).sort((a, b) => a.id - b.id);
  const [s1, s2] = settlements;

  // Place watchtower near s1
  let towerSpot = null;
  for (let dx = -3; dx <= 3 && !towerSpot; dx++) {
    for (let dy = -3; dy <= 3 && !towerSpot; dy++) {
      const tx = Math.floor(s1.center.x) + dx;
      const ty = Math.floor(s1.center.y) + dy;
      if (sim.world.isWalkable(tx, ty) && !sim.fortificationSystem._hasBuildingAt(tx, ty)) {
        towerSpot = { x: tx, y: ty };
      }
    }
  }
  const towerRes = sim.fortificationSystem.placeTowerAt(towerSpot.x, towerSpot.y);
  assertTrue(Boolean(towerRes.success && towerRes.tower), 'placeTowerAt builds an active defensive watchtower');

  // Declare war and drop an invader within tower range (<= 8.5)
  sim.diplomacySystem.declareWar(s1.id, s2.id, 'Defensive Test', 100);
  const invader = sim.spawnAgent(towerSpot.x + 2, towerSpot.y + 1);
  invader.age = 24;
  invader.lifeStage = 'adult';
  invader.settlementId = s2.id;
  invader.health = 100;
  invader.combat = { health: 100, defense: 0 };

  sim.warfareSystem.combatEffects.length = 0;
  sim.fortificationSystem._updateTowerDefense(140); // tick % 14 === 0
  assertTrue(invader.health < 100, `watchtower fires on hostile invader (health reduced to ${invader.health})`);
  assertTrue(sim.warfareSystem.combatEffects.some(fx => fx.type === 'arrow' || fx.type === 'musket_shot' || fx.type === 'tracer_fire'),
    'watchtower pushes directional projectile FX to combatEffects');

  // Divine wall build -> toggle wall/gate -> damage -> repair
  let wallSpot = null;
  for (let dx = -4; dx <= 4 && !wallSpot; dx++) {
    for (let dy = -4; dy <= 4 && !wallSpot; dy++) {
      const tx = Math.floor(s1.center.x) + dx;
      const ty = Math.floor(s1.center.y) + dy;
      if (sim.world.isWalkable(tx, ty) && (!sim.world.isBridge || !sim.world.isBridge(tx, ty)) && !sim.fortificationSystem.getSegmentAt(tx, ty)) {
        wallSpot = { x: tx, y: ty };
      }
    }
  }
  const built = sim.fortificationSystem.placeWallAt(wallSpot.x, wallSpot.y);
  assertTrue(built.success && built.action === 'built', 'placeWallAt places a manual wall segment');
  const firstKind = built.segment.kind;
  const toggled = sim.fortificationSystem.placeWallAt(wallSpot.x, wallSpot.y);
  assertTrue(toggled.success && toggled.action === 'toggled' && toggled.segment.kind !== firstKind,
    'placeWallAt toggles intact wall segment between wall and gatehouse');
  sim.fortificationSystem.damageSegment(toggled.segment, 999, 'Test Ram');
  assertTrue(toggled.segment.state === 'breach', 'damageSegment marks breached state when HP drops to 0');
  const repaired = sim.fortificationSystem.placeWallAt(wallSpot.x, wallSpot.y);
  assertTrue(repaired.success && repaired.action === 'repaired' && repaired.segment.state === 'intact',
    'placeWallAt restores a breached wall segment to intact');
}

// 4. Deterministic Save/Load Round-Trip Parity
{
  const simA = new Simulation(8484, 128, 128, { scenario: 'warring' });
  const s1 = Array.from(simA.settlementSystem.settlements.values())[0];
  simA.fortificationSystem.fortifySettlement(s1.id, { tick: 180 });
  const seg = Array.from(simA.fortificationSystem.segments.values()).find(x => x.settlementId === s1.id);
  if (seg) simA.fortificationSystem.damageSegment(seg, 999, 'Siege');

  const snapshot = simA.serialize();
  const restored = Simulation.deserialize(snapshot);
  assertTrue(
    JSON.stringify(restored.fortificationSystem.serialize()) === JSON.stringify(simA.fortificationSystem.serialize()),
    'save/load round-trip preserves exact FortificationSystem segments, breaches, and metadata'
  );

  const cloneA = Simulation.deserialize(snapshot);
  const cloneB = Simulation.deserialize(snapshot);
  for (let i = 0; i < 40; i++) {
    cloneA.tick();
    cloneB.tick();
  }
  assertTrue(
    JSON.stringify(cloneA.fortificationSystem.serialize()) === JSON.stringify(cloneB.fortificationSystem.serialize()),
    'FortificationSystem advances with bit-exact determinism after deserialize'
  );

  // Nuclear strike breaches nearby perimeter walls & cleanupSettlement removes orphaned walls
  const preNukeSummary = simA.fortificationSystem.getSettlementFortificationSummary(s1.id);
  const segTarget = Array.from(simA.fortificationSystem.segments.values()).find(x => x.settlementId === s1.id && x.state === 'intact');
  assertTrue(Boolean(segTarget && preNukeSummary.intactWalls + preNukeSummary.intactGates > 0), 'intact wall segment exists prior to atomic test');
  simA.detonateNuclearStrike({ x: segTarget.x, y: segTarget.y, targetSettlementId: s1.id, isGodPower: true });
  assertTrue(segTarget.state === 'breach' && segTarget.hp === 0, 'nuclear detonation physically breaches perimeter wall segments inside blast radius');

  simA.fortificationSystem.cleanupSettlement(s1.id);
  const postCleanup = simA.fortificationSystem.getSettlementFortificationSummary(s1.id);
  assertTrue(postCleanup.totalSegments === 0 && !simA.fortificationSystem.isBlockedForAgent(segTarget.x, segTarget.y, null),
    'cleanupSettlement removes all city fortification segments and clears passability grid');
}

console.log('ALL FORTIFICATIONS, WATCHTOWERS & SIEGE BREACH TESTS PASSED');
