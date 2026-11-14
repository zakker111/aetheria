// Phase 7 Test Suite: Bigger Lakes, Wider Rivers, Bridges & Boat-or-Bridge Crossing Logic
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

function carveChannel(world, xMin, xMax, yMin = 0, yMax = world.height - 1) {
  const W = world.width;
  const H = world.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
        world.biome[idx] = 'water';
        world.waterLevel[idx] = 1.8;
        world.elevation[idx] = 13;
        world.riverFlow[idx] = 0.6;
        world.bridgeTiles[idx] = 0;
      } else {
        world.biome[idx] = 'grassland';
        world.waterLevel[idx] = 0.0;
        world.elevation[idx] = 45;
        world.riverFlow[idx] = 0.0;
        world.bridgeTiles[idx] = 0;
      }
    }
  }
}

console.log('--- Testing Phase 7: Bigger Lakes, Wider Rivers & Bridge Engineering ---');

// 1. Procedural terrain hydrology: bigger lakes & wider rivers while retaining habitable settlements
{
  const sim = new Simulation(9090, 128, 128);
  const w = sim.world;
  let waterTiles = 0;
  let flowingRiverWater = 0;
  let walkableTiles = 0;
  const total = w.width * w.height;

  for (let y = 0; y < w.height; y++) {
    for (let x = 0; x < w.width; x++) {
      const idx = y * w.width + x;
      if (w.biome[idx] === 'water') {
        waterTiles++;
        if (w.riverFlow[idx] >= 0.45) flowingRiverWater++;
      }
      if (w.isWalkable(x, y)) walkableTiles++;
    }
  }

  check('procedural world contains substantial lakes & rivers (>= 900 water tiles on 128x128)', waterTiles >= 900);
  check('procedural rivers resolve to navigable water biome (>= 120 tiles)', flowingRiverWater >= 120);
  check('habitable walkable landmass remains plentiful (>= 55%)', walkableTiles / total >= 0.55);
  check('all 3 initial settlements founded on dry walkable land', sim.settlementSystem.settlements.size === 3);

  // Verify rivers connect major lakes naturally into a unified continuous water network
  const lakes = w.lakes || [];
  const lakeSeen = new Uint8Array(w.width * w.height);
  const lakeComp = new Int32Array(w.width * w.height).fill(-1);
  let nextComp = 0;
  for (let sy = 0; sy < w.height; sy++) {
    for (let sx = 0; sx < w.width; sx++) {
      const sIdx = sy * w.width + sx;
      if (w.biome[sIdx] !== 'water' || lakeSeen[sIdx]) continue;
      const q = [sIdx];
      lakeSeen[sIdx] = 1;
      lakeComp[sIdx] = nextComp;
      for (let h = 0; h < q.length; h++) {
        const cur = q[h];
        const cx = cur % w.width, cy = (cur / w.width) | 0;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w.width || ny >= w.height) continue;
          const nIdx = ny * w.width + nx;
          if (!lakeSeen[nIdx] && w.biome[nIdx] === 'water') {
            lakeSeen[nIdx] = 1;
            lakeComp[nIdx] = nextComp;
            q.push(nIdx);
          }
        }
      }
      nextComp++;
    }
  }
  const connectedComps = new Set(lakes.map(l => lakeComp[l.y * w.width + l.x]));
  check('rivers naturally connect lakes into a continuous navigable watershed',
    lakes.length >= 2 && (w.riverConnections?.length || 0) >= 1 && connectedComps.size === 1);
}

// 2. Multi-tile river bridge construction, walkability, road approaches & boat-vs-bridge gating
{
  const sim = new Simulation(9191, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  carveChannel(sim.world, 30, 33); // 4-tile wide unbridged river

  const wAgents = [sim.spawnAgent(27, 25), sim.spawnAgent(28, 25), sim.spawnAgent(28, 26), sim.spawnAgent(27, 26)];
  const eAgents = [sim.spawnAgent(36, 25), sim.spawnAgent(37, 25), sim.spawnAgent(37, 26), sim.spawnAgent(36, 26)];
  const sWest = sim.settlementSystem.foundSettlement(27.5, 25.5, wAgents, 'WestFord');
  const sEast = sim.settlementSystem.foundSettlement(36.5, 25.5, eAgents, 'EastFord');

  check('unbridged river tiles block walking initially', !sim.world.isWalkable(31, 25));
  check('unbridged river routes classify for water barges', sim.navalSystem.routeUsesWater(sWest, sEast));

  const placed = sim.infrastructureSystem.placeBridgeAt(31, 25, 10);
  check('placeBridgeAt spans full 4-tile river crossing', placed.success && placed.span === 4);
  check('every bridge tile becomes walkable and marked in bridgeTiles',
    [30, 31, 32, 33].every(bx => sim.world.isBridge(bx, 25) && sim.world.isWalkable(bx, 25)));
  check('shoreline bank approaches marked as connecting roads',
    sim.world.isRoad(29, 25) && sim.world.isRoad(34, 25));
  check('bridged crossing switches direct overland route away from mandatory boat transport',
    !sim.navalSystem.routeUsesWater(sWest, sEast));

  // Warband crossing along the bridged row does not needlessly embark onto boats
  sim.diplomacySystem.initRelation(sWest.id, sEast.id);
  const wb = sim.warfareSystem.mobilizeWarband(sWest.id, sEast.id, 'assault');
  const cmd = sim._agentById(wb.commanderId);
  cmd.x = 29.5;
  cmd.y = 25.5;
  const embarkedOnBridge = sim.navalSystem.tryEmbarkWarband(wb, cmd, sEast.center);
  check('warband crossing a bridged row marches across on foot instead of launching boats', !embarkedOnBridge && !wb.embarked);
}

// 3. Autonomous trade-route bridge building + wide lake requiring boats + Save/Load determinism
{
  const sim = new Simulation(9292, 64, 64, { skipInit: true });
  sim.world.simulation = sim;
  carveChannel(sim.world, 30, 32); // 3-tile river

  const wAgents = [sim.spawnAgent(27, 20), sim.spawnAgent(28, 20), sim.spawnAgent(28, 21), sim.spawnAgent(27, 21)];
  const eAgents = [sim.spawnAgent(35, 20), sim.spawnAgent(36, 20), sim.spawnAgent(36, 21), sim.spawnAgent(35, 21)];
  const sWest = sim.settlementSystem.foundSettlement(27.5, 20.5, wAgents, 'Rivergate');
  const sEast = sim.settlementSystem.foundSettlement(35.5, 20.5, eAgents, 'Stonebank');
  sWest.stockpile.wood = 20;

  sim.eventBus.emit('trade:route_established', { from: sWest.name, to: sEast.name, distance: 8 });
  check('trade route event resolves settlement names & autonomously builds river bridge',
    sim.infrastructureSystem.bridges.length === 1 && sim.world.isBridge(31, 20));

  // Wide lake test (16 tiles wide): cannot be bridged, so boats/barges must handle it
  const lakeSim = new Simulation(9393, 64, 64, { skipInit: true });
  lakeSim.world.simulation = lakeSim;
  carveChannel(lakeSim.world, 22, 37); // 16 tiles wide lake
  const rejectWide = lakeSim.infrastructureSystem.placeBridgeAt(29, 25, 10);
  check('wide lake (>10 tiles) cannot be bridged and requires maritime vessels',
    !rejectWide.success && rejectWide.reason === 'water_too_wide');

  // Save/load preserves bridgeTiles & infrastructure state identically
  const saved = JSON.parse(JSON.stringify(sim.serialize()));
  const loaded = Simulation.deserialize(saved);
  check('save/load preserves bridge count and tile passability over river',
    loaded.infrastructureSystem.bridges.length === 1 &&
    [30, 31, 32].every(bx => loaded.world.isBridge(bx, 20) && loaded.world.isWalkable(bx, 20)));
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s)`);
  process.exit(1);
}
console.log('\nALL PHASE 7 LAKES, RIVERS & BRIDGES TESTS PASSED!');
