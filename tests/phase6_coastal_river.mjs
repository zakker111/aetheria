// Phase 6 Test Suite: Coastal & River Gameplay (Docks, Fishing Boats, River Barges, Amphibious Raids)
import { Simulation } from '../src/simulation/simulation.js';
import { BUILDING_TYPES } from '../src/core/constants.js';
import { Building } from '../src/simulation/building.js';

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failures++;
  } else {
    console.log(`PASS: ${name}`);
  }
}

function carveChannelAndShores(world) {
  const W = world.width;
  const H = world.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (x >= 30 && x <= 35) {
        world.biome[idx] = 'water';
        world.waterLevel[idx] = 0.8;
        world.elevation[idx] = 15;
        world.riverFlow[idx] = 0.5;
        world.bridgeTiles[idx] = 0;
      } else {
        world.biome[idx] = 'grassland';
        world.waterLevel[idx] = 0.0;
        world.elevation[idx] = 45;
        world.riverFlow[idx] = 0.0;
      }
    }
  }
}

console.log('--- Testing Phase 6: Coastal & River Gameplay ---');

// 1. Dock placement, snapping, completion & Fishing Boat harvest loop
{
  const sim = new Simulation(8181, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  carveChannelAndShores(sim.world);

  const westAgent1 = sim.spawnAgent(27, 25);
  const westAgent2 = sim.spawnAgent(28, 25);
  const westAgent3 = sim.spawnAgent(28, 26);
  const westAgent4 = sim.spawnAgent(27, 26);
  const sWest = sim.settlementSystem.foundSettlement(27.5, 25.5, [westAgent1, westAgent2, westAgent3, westAgent4], 'Westport');
  sWest.stockpile.food = 10;

  // Test water-click snapping when placing a dock via god power helper
  const snapRes = sim.navalSystem.placeDockBlueprint(31, 25);
  check('placeDockBlueprint snaps water click to walkable shoreline', snapRes.success && snapRes.dock.x === 29 && snapRes.dock.buildingType === BUILDING_TYPES.DOCK);

  snapRes.dock.constructionProgress = 100;
  snapRes.dock.complete = true;

  let catchLanded = false;
  sim.eventBus.on('FISHING_CATCH_LANDED', (d) => {
    if (d.settlementId === sWest.id && d.amount > 0) catchLanded = true;
  });

  // Step ticks until fishing boat spawns, harvests, and lands catch
  for (let t = 0; t < 180; t++) {
    sim.clock.advance();
    sim.navalSystem.update(sim.clock.tick);
  }

  const fishingVessel = sim.navalSystem.vessels.find(v => v.kind === 'fishing' && v.homeDockId === snapRes.dock.id);
  check('completed dock spawns fishing boat vessel', !!fishingVessel);
  check('fishing boat lands catch into settlement food stockpile', catchLanded && sim.navalSystem.stats.fishCaught >= 5 && sWest.stockpile.food >= 15);
}

// 2. River Barge trade route & cargo delivery across unbridged water channel
{
  const sim = new Simulation(8282, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  carveChannelAndShores(sim.world);

  const wAgents = [sim.spawnAgent(27, 25), sim.spawnAgent(28, 25), sim.spawnAgent(28, 26), sim.spawnAgent(27, 26)];
  const eAgents = [sim.spawnAgent(38, 25), sim.spawnAgent(37, 25), sim.spawnAgent(37, 26), sim.spawnAgent(38, 26)];
  const sWest = sim.settlementSystem.foundSettlement(27.5, 25.5, wAgents, 'WestHaven');
  const sEast = sim.settlementSystem.foundSettlement(37.5, 25.5, eAgents, 'EastReach');

  sim.diplomacySystem.initRelation(sWest.id, sEast.id);
  const rel = sim.diplomacySystem.getRelation(sWest.id, sEast.id);
  rel.score = 70;
  rel.status = 'peace';

  sWest.stockpile.plank = 25;
  sWest.stockpile.food = 50;
  sEast.stockpile.plank = 0;
  sEast.stockpile.food = 5;

  const dockW = new Building(29, 25, BUILDING_TYPES.DOCK, sim.idGen, sWest.id, sWest.factionId);
  dockW.complete = true; dockW.constructionProgress = 100;
  const dockE = new Building(36, 25, BUILDING_TYPES.DOCK, sim.idGen, sEast.id, sEast.factionId);
  dockE.complete = true; dockE.constructionProgress = 100;
  sim.buildings.push(dockW, dockE);

  sim.tradeSystem.analyzeMarket();
  const route = sim.tradeSystem.tradeRoutes.find(r => (r.from === sWest.id && r.to === sEast.id) || (r.from === sEast.id && r.to === sWest.id));
  check('river/coastal trade route classified as barge transportMode', !!route && route.transportMode === 'barge');

  let bargeDelivered = false;
  sim.eventBus.on('BARGE_TRADE_COMPLETED', (d) => {
    if (d.amount > 0) bargeDelivered = true;
  });

  for (let t = 0; t < 160; t++) {
    sim.clock.advance();
    sim.navalSystem.update(sim.clock.tick);
  }

  const barge = sim.navalSystem.vessels.find(v => v.kind === 'barge');
  check('river barge spawned for water trade route', !!barge);
  check('river barge crosses water channel and delivers surplus cargo', bargeDelivered && sim.navalSystem.stats.bargeDeliveries >= 1 && (sEast.stockpile.plank > 0 || sEast.stockpile.food > 5));
}

// 3. Amphibious Raid embarkation, water crossing, beach landing & Save/Load Determinism
{
  const sim = new Simulation(8383, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  carveChannelAndShores(sim.world);

  const wAgents = [];
  const eAgents = [];
  for (let i = 0; i < 6; i++) {
    wAgents.push(sim.spawnAgent(28, 22 + (i % 3)));
    eAgents.push(sim.spawnAgent(38, 22 + (i % 3)));
  }
  const sWest = sim.settlementSystem.foundSettlement(28, 23, wAgents, 'SeaRaiders');
  const sEast = sim.settlementSystem.foundSettlement(38, 23, eAgents, 'CoastWatch');

  sim.diplomacySystem.initRelation(sWest.id, sEast.id);
  const warband = sim.warfareSystem.mobilizeWarband(sWest.id, sEast.id, 'assault');
  check('warband mobilized for cross-channel assault', !!warband && warband.soldiers.length > 0);

  let launched = false;
  let landed = false;
  let checkedMidVoyageResume = false;
  let midVoyageDeterministic = false;

  sim.eventBus.on('AMPHIBIOUS_RAID_LAUNCHED', () => { launched = true; });
  sim.eventBus.on('AMPHIBIOUS_LANDING', () => { landed = true; });

  for (let t = 0; t < 120; t++) {
    sim.clock.advance();
    sim.warfareSystem.update();
    sim.navalSystem.update(sim.clock.tick);

    // Mid-voyage save/load determinism verification
    if (!checkedMidVoyageResume && warband.embarked) {
      checkedMidVoyageResume = true;
      const saved = JSON.parse(JSON.stringify(sim.serialize()));
      const resumed = Simulation.deserialize(saved);
      const wbResumed = resumed.warfareSystem.warbands.get(warband.id);

      check('embarked warband and raid vessel preserved across serialize/deserialize', !!(wbResumed?.embarked && resumed.navalSystem.vessels.some(v => v.kind === 'raid')));

      for (let k = 0; k < 25; k++) {
        sim.clock.advance();
        sim.warfareSystem.update();
        sim.navalSystem.update(sim.clock.tick);

        resumed.clock.advance();
        resumed.warfareSystem.update();
        resumed.navalSystem.update(resumed.clock.tick);
      }

      const fp = (s) => ({
        vessels: s.navalSystem.vessels.map(v => `${v.id}:${v.kind}:${v.state}:${v.x.toFixed(4)},${v.y.toFixed(4)}`),
        soldiers: warband.soldiers.map(id => {
          const a = s._agentById(id);
          return a ? `${a.id}:${a.embarked ? 1 : 0}:${a.x.toFixed(4)},${a.y.toFixed(4)}` : '';
        })
      });
      midVoyageDeterministic = JSON.stringify(fp(sim)) === JSON.stringify(fp(resumed));
      break;
    }
  }

  // Continue advancing primary simulation if not yet landed
  for (let t = 0; t < 60 && !landed; t++) {
    sim.clock.advance();
    sim.warfareSystem.update();
    sim.navalSystem.update(sim.clock.tick);
  }

  const commander = sim._agentById(warband.commanderId);
  check('amphibious raid longboat launched when warband hit water', launched && warband.isAmphibious === true);
  check('mid-voyage amphibious state save/load remains 100% deterministic', checkedMidVoyageResume && midVoyageDeterministic);
  check('amphibious warband disembarked onto enemy shore across water channel', landed && !warband.embarked && commander.x >= 36);
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s)`);
  process.exit(1);
}
console.log('\nALL PHASE 6 COASTAL & RIVER TESTS PASSED!');
