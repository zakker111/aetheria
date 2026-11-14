/**
 * Naval & Coastal/River System (Phase 6)
 * Handles deterministic coastal/river Docks, Fishing Boats, River Barges for trade,
 * and Amphibious Raid longboats for warbands crossing water or unbridged rivers.
 *
 * Strictly deterministic: zero Math.random(), zero sim._rng() calls so existing
 * world seed streams remain undisturbed.
 */

import { BUILDING_TYPES } from '../core/constants.js';
import { Building } from '../simulation/building.js';

const WATER_DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1]
];

export class NavalSystem {
  constructor(simulation) {
    this.sim = simulation;
    this.vessels = [];
    this.nextVesselId = 1;
    this.stats = {
      fishingTrips: 0,
      fishCaught: 0,
      bargeDeliveries: 0,
      bargeCargoMoved: 0,
      amphibiousRaids: 0,
      amphibiousLandings: 0
    };
  }

  /**
   * True if tile (tx, ty) is navigable water (ocean/sea/lake biome, deep waterLevel, or river channel).
   */
  isWaterTile(tx, ty) {
    const world = this.sim?.world;
    if (!world) return false;
    const x = Math.floor(tx);
    const y = Math.floor(ty);
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    const idx = y * world.width + x;
    const biome = world.biome ? world.biome[idx] : null;
    if (biome === 'water' || biome === 'ocean' || biome === 'deep_water') return true;
    if (world.waterLevel && world.waterLevel[idx] > 0.3) return true;
    if (world.riverFlow && world.riverFlow[idx] > 0.28) return true;
    return false;
  }

  /**
   * Deterministic spiral scan for nearest navigable water tile within maxR.
   */
  findNearestWaterTile(cx, cy, maxR = 8) {
    const world = this.sim?.world;
    if (!world) return null;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);

    let best = null;
    let bestD2 = Infinity;

    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = ix + dx;
          const y = iy + dy;
          if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
          if (!this.isWaterTile(x, y)) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = { tx: x, ty: y, x: x + 0.5, y: y + 0.5 };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * Find a walkable shoreline tile near (cx, cy) that directly borders water,
   * avoiding existing buildings within clearance radius 2.
   */
  findShorelineSite(cx, cy, minR = 2, maxR = 16) {
    const world = this.sim?.world;
    if (!world) return null;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const buildings = this.sim.buildings || [];

    for (let r = minR; r <= maxR; r++) {
      let best = null;
      let bestD2 = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = ix + dx;
          const y = iy + dy;
          if (x < 3 || y < 3 || x >= world.width - 3 || y >= world.height - 3) continue;
          if (!world.isWalkable(x, y) || this.isWaterTile(x, y)) continue;

          // Must border at least one orthogonal water tile (preferred) or diagonal water tile
          let waterNeighbor = null;
          for (let d = 0; d < 4; d++) {
            const nx = x + WATER_DIRS[d][0];
            const ny = y + WATER_DIRS[d][1];
            if (this.isWaterTile(nx, ny)) {
              waterNeighbor = { wx: nx + 0.5, wy: ny + 0.5 };
              break;
            }
          }
          if (!waterNeighbor) continue;

          // Clear of existing buildings
          let blocked = false;
          for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            if (Math.abs(b.x - x) <= 2 && Math.abs(b.y - y) <= 2) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;

          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = { x, y, waterX: waterNeighbor.wx, waterY: waterNeighbor.wy };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * True if a trade route between s1 and s2 can operate via river/coastal barge.
   */
  routeUsesWater(s1, s2) {
    if (!s1?.center || !s2?.center) return false;
    const buildings = this.sim.buildings || [];
    const s1HasDock = buildings.some(b => b.settlementId === s1.id && b.buildingType === BUILDING_TYPES.DOCK && !b.isRuined);
    const s2HasDock = buildings.some(b => b.settlementId === s2.id && b.buildingType === BUILDING_TYPES.DOCK && !b.isRuined);

    const w1 = this.findNearestWaterTile(s1.center.x, s1.center.y, 14);
    const w2 = this.findNearestWaterTile(s2.center.x, s2.center.y, 14);
    if (!w1 || !w2) return false;
    if (s1HasDock && s2HasDock) return true;

    // Check if the direct line crosses unbridged water tiles
    const steps = Math.max(4, Math.ceil(Math.hypot(s2.center.x - s1.center.x, s2.center.y - s1.center.y)));
    let waterHits = 0;
    for (let i = 1; i < steps; i++) {
      const px = Math.floor(s1.center.x + ((s2.center.x - s1.center.x) * i) / steps);
      const py = Math.floor(s1.center.y + ((s2.center.y - s1.center.y) * i) / steps);
      if (this.isWaterTile(px, py) && !this.sim.world?.isBridge?.(px, py)) {
        waterHits++;
        if (waterHits >= 1) return true;
      }
    }
    return Boolean(s1HasDock || s2HasDock);
  }

  /**
   * Bounded deterministic BFS over water tiles from (sx, sy) toward (tx, ty).
   * Returns next waypoint { x, y } on water, or null if disconnected.
   */
  findNextWaterStep(sx, sy, tx, ty, maxExpand = 220) {
    const world = this.sim?.world;
    if (!world) return null;
    const W = world.width;
    const H = world.height;
    const startX = Math.max(0, Math.min(W - 1, Math.floor(sx)));
    const startY = Math.max(0, Math.min(H - 1, Math.floor(sy)));
    const goalX = Math.max(0, Math.min(W - 1, Math.floor(tx)));
    const goalY = Math.max(0, Math.min(H - 1, Math.floor(ty)));

    if (startX === goalX && startY === goalY) return { x: goalX + 0.5, y: goalY + 0.5 };

    const visited = new Set();
    const parent = new Map();
    const queue = [];

    const startKey = startY * W + startX;
    visited.add(startKey);
    queue.push([startX, startY]);

    let bestNode = null;
    let bestDistSq = Math.pow(goalX - startX, 2) + Math.pow(goalY - startY, 2);
    let expanded = 0;

    for (let head = 0; head < queue.length && expanded < maxExpand; head++) {
      const [cx, cy] = queue[head];
      expanded++;

      if (cx === goalX && cy === goalY) {
        bestNode = cx * 1 + cy * W;
        break;
      }

      for (let d = 0; d < WATER_DIRS.length; d++) {
        const nx = cx + WATER_DIRS[d][0];
        const ny = cy + WATER_DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nKey = ny * W + nx;
        if (visited.has(nKey)) continue;
        if (!this.isWaterTile(nx, ny)) continue;

        visited.add(nKey);
        parent.set(nKey, cy * W + cx);
        queue.push([nx, ny]);

        const d2 = (goalX - nx) * (goalX - nx) + (goalY - ny) * (goalY - ny);
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestNode = nKey;
        }
        if (nx === goalX && ny === goalY) {
          bestNode = nKey;
          head = queue.length; // terminate outer loop
          break;
        }
      }
    }

    if (bestNode === null || bestNode === startKey) return null;

    // Walk backward from bestNode to the first step after startKey
    let cur = bestNode;
    let prev = parent.get(cur);
    let guard = 0;
    while (prev !== undefined && prev !== startKey && guard++ < maxExpand) {
      cur = prev;
      prev = parent.get(cur);
    }
    const rx = cur % W;
    const ry = Math.floor(cur / W);
    return { x: rx + 0.5, y: ry + 0.5 };
  }

  /**
   * Place a Dock blueprint via God Power (snaps water clicks to nearest walkable shore tile).
   */
  placeDockBlueprint(x, y) {
    const world = this.sim?.world;
    if (!world) return { success: false, reason: 'No world' };
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 2 || ty < 2 || tx >= world.width - 2 || ty >= world.height - 2) {
      return { success: false, reason: 'Out of bounds' };
    }

    let site = null;
    if (world.isWalkable(tx, ty) && !this.isWaterTile(tx, ty)) {
      // Clicked on land: check if it borders water directly or find nearby shore
      for (let d = 0; d < WATER_DIRS.length; d++) {
        const wx = tx + WATER_DIRS[d][0];
        const wy = ty + WATER_DIRS[d][1];
        if (this.isWaterTile(wx, wy)) {
          site = { x: tx, y: ty, waterX: wx + 0.5, waterY: wy + 0.5 };
          break;
        }
      }
    }
    if (!site) {
      site = this.findShorelineSite(tx, ty, 0, 5);
    }
    if (!site) {
      return { success: false, reason: 'Docks must be placed on shoreline tiles bordering river or ocean water!' };
    }

    let nearestS = null;
    let minSDist = 28.0;
    if (this.sim.settlementSystem) {
      for (const s of this.sim.settlementSystem.settlements.values()) {
        if (!s.center) continue;
        const d = Math.hypot(s.center.x - site.x, s.center.y - site.y);
        if (d < minSDist) {
          minSDist = d;
          nearestS = s;
        }
      }
    }

    const sid = nearestS ? nearestS.id : null;
    const fid = nearestS ? nearestS.factionId : null;
    const dock = new Building(site.x, site.y, BUILDING_TYPES.DOCK, this.sim.idGen, sid, fid);
    dock.constructionProgress = 0;
    dock.complete = false;
    dock.facingWaterX = site.waterX;
    dock.facingWaterY = site.waterY;
    this.sim.buildings.push(dock);
    world.addToSpatialIndex(site.x, site.y, dock);
    this.sim._occStamp = -1;
    if (nearestS) {
      if (!nearestS.buildings) nearestS.buildings = [];
      nearestS.buildings.push(dock);
    }

    this.sim.eventBus?.emit('BLUEPRINT_PLACED', {
      type: BUILDING_TYPES.DOCK,
      settlementName: nearestS?.name || null,
      x: site.x,
      y: site.y
    });

    return { success: true, dock, settlement: nearestS };
  }

  /**
   * Pick a deterministic coastal/river fishing patch offset from dock water anchor.
   */
  findFishingSpot(wx, wy, salt = 0) {
    const dirIdx = Math.abs(Math.floor(salt)) % 8;
    for (let k = 0; k < 8; k++) {
      const dir = WATER_DIRS[(dirIdx + k) % 8];
      for (let dist = 6; dist >= 2; dist--) {
        const cx = Math.floor(wx + dir[0] * dist);
        const cy = Math.floor(wy + dir[1] * dist);
        if (this.isWaterTile(cx, cy)) {
          return { x: cx + 0.5, y: cy + 0.5 };
        }
      }
    }
    return { x: wx, y: wy };
  }

  /**
   * Main per-tick naval update: plans docks for coastal/river towns, spawns
   * fishing boats & river trade barges, and advances all active vessels.
   */
  update(tick = 0) {
    if (!this.sim || !this.sim.world) return;

    if (tick % 30 === 0) {
      this.planSettlementDocks();
      this.ensureFishingVessels();
      this.ensureBargeVessels();
    }

    for (let i = this.vessels.length - 1; i >= 0; i--) {
      const v = this.vessels[i];
      v.ageTicks = (v.ageTicks || 0) + 1;

      if (v.kind === 'fishing') {
        this.updateFishingVessel(v);
      } else if (v.kind === 'barge') {
        const keep = this.updateBargeVessel(v);
        if (!keep) this.vessels.splice(i, 1);
      } else if (v.kind === 'raid') {
        const keep = this.updateRaidVessel(v);
        if (!keep) this.vessels.splice(i, 1);
      }
    }
  }

  planSettlementDocks() {
    const settlements = this.sim.settlementSystem?.settlements;
    if (!settlements) return;
    const buildings = this.sim.buildings || [];

    for (const s of settlements.values()) {
      if (s.ruined || !s.center) continue;
      const pop = s.population || s.agentIds?.size || 0;
      if (pop < 4) continue;

      let hasDock = false;
      let pending = 0;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (b.settlementId !== s.id || b.isRuined) continue;
        if (!b.complete) pending++;
        if (b.buildingType === BUILDING_TYPES.DOCK) {
          hasDock = true;
          break;
        }
      }
      if (hasDock || pending >= 2) continue;

      const site = this.findShorelineSite(s.center.x, s.center.y, 2, 16);
      if (!site) continue;

      const dock = new Building(site.x, site.y, BUILDING_TYPES.DOCK, this.sim.idGen, s.id, s.factionId ?? null);
      dock.constructionProgress = 0;
      dock.complete = false;
      dock.facingWaterX = site.waterX;
      dock.facingWaterY = site.waterY;
      this.sim.buildings.push(dock);
      this.sim.world.addToSpatialIndex(site.x, site.y, dock);
      this.sim._occStamp = -1;
      if (!s.buildings) s.buildings = [];
      s.buildings.push(dock);

      this.sim.eventBus?.emit('BLUEPRINT_PLACED', {
        type: BUILDING_TYPES.DOCK,
        settlementName: s.name,
        x: site.x,
        y: site.y
      });
    }
  }

  ensureFishingVessels() {
    const buildings = this.sim.buildings || [];
    for (let i = 0; i < buildings.length; i++) {
      const dock = buildings[i];
      if (!dock.complete || dock.isRuined || dock.buildingType !== BUILDING_TYPES.DOCK) continue;

      const exists = this.vessels.some(v => v.kind === 'fishing' && v.homeDockId === dock.id);
      if (exists) continue;

      const waterAnchor = this.findNearestWaterTile(dock.x, dock.y, 4);
      if (!waterAnchor) continue;

      const settlement = dock.settlementId != null ? this.sim.settlementSystem?.settlements.get(dock.settlementId) : null;
      const spot = this.findFishingSpot(waterAnchor.x, waterAnchor.y, dock.id || this.nextVesselId);

      const id = this.nextVesselId++;
      this.vessels.push({
        id,
        kind: 'fishing',
        name: `${settlement?.name || 'Harbor'} Fisher #${id}`,
        settlementId: dock.settlementId ?? null,
        factionId: dock.factionId ?? null,
        homeDockId: dock.id,
        homeWaterX: waterAnchor.x,
        homeWaterY: waterAnchor.y,
        x: waterAnchor.x,
        y: waterAnchor.y,
        targetX: spot.x,
        targetY: spot.y,
        state: 'outbound',
        cargo: { resource: 'food', amount: 0, capacity: 5 },
        harvestTicks: 0,
        routeId: null,
        targetSettlementId: null,
        warbandId: null,
        bannerColor: settlement?.bannerColor || '#38bdf8',
        facing: 1,
        ageTicks: 0
      });
    }
  }

  ensureBargeVessels() {
    const routes = this.sim.tradeSystem?.tradeRoutes || [];
    const settlements = this.sim.settlementSystem?.settlements;
    if (!settlements) return;

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (!route.active) continue;
      if (route.transportMode !== 'barge') {
        const s1 = settlements.get(route.from);
        const s2 = settlements.get(route.to);
        if (s1 && s2 && this.routeUsesWater(s1, s2)) {
          route.transportMode = 'barge';
        } else {
          continue;
        }
      }

      const activeBarge = this.vessels.some(v => v.kind === 'barge' && v.routeId === route.id);
      if (activeBarge) continue;

      const fromS = settlements.get(route.from);
      const toS = settlements.get(route.to);
      if (!fromS || !toS || fromS.ruined || toS.ruined) continue;

      // Prefer a dock if present, else nearest water tile to settlement center
      const buildings = this.sim.buildings || [];
      const fromDock = buildings.find(b => b.complete && !b.isRuined && b.buildingType === BUILDING_TYPES.DOCK && b.settlementId === fromS.id);
      const toDock = buildings.find(b => b.complete && !b.isRuined && b.buildingType === BUILDING_TYPES.DOCK && b.settlementId === toS.id);

      const startW = this.findNearestWaterTile(fromDock?.x ?? fromS.center.x, fromDock?.y ?? fromS.center.y, 14);
      const endW = this.findNearestWaterTile(toDock?.x ?? toS.center.x, toDock?.y ?? toS.center.y, 14);
      if (!startW || !endW) continue;

      // Pick tradable commodity (safe against going negative)
      const cargoLoad = this._loadBargeCargo(fromS, toS);
      const id = this.nextVesselId++;
      this.vessels.push({
        id,
        kind: 'barge',
        name: `${fromS.name} River Barge`,
        settlementId: fromS.id,
        targetSettlementId: toS.id,
        factionId: fromS.factionId ?? null,
        homeDockId: fromDock?.id ?? null,
        homeWaterX: startW.x,
        homeWaterY: startW.y,
        x: startW.x,
        y: startW.y,
        targetX: endW.x,
        targetY: endW.y,
        state: 'sailing_outbound',
        cargo: cargoLoad,
        harvestTicks: 0,
        routeId: route.id,
        warbandId: null,
        bannerColor: fromS.bannerColor || '#f59e0b',
        facing: 1,
        ageTicks: 0
      });
    }
  }

  _loadBargeCargo(fromS, toS) {
    const tradeSys = this.sim.tradeSystem;
    const candidates = ['plank', 'bread', 'food', 'wood', 'ore'];
    for (let i = 0; i < candidates.length; i++) {
      const res = candidates[i];
      const avail = tradeSys
        ? tradeSys.tradeableAmount(fromS, res)
        : Math.max(0, (fromS.stockpile?.[res] || 0) - 10);
      if (avail >= 4) {
        const amount = Math.min(30, Math.floor(avail));
        fromS.stockpile[res] = Math.max(0, (fromS.stockpile[res] || 0) - amount);
        return { resource: res, amount, capacity: 30 };
      }
    }
    return { resource: 'food', amount: 0, capacity: 30 };
  }

  moveVesselToward(v, destX, destY, speed = 0.3) {
    const dx = destX - v.x;
    const dy = destY - v.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.05) return true;

    const screenDx = dx - dy;
    if (Math.abs(screenDx) > 0.01) {
      v.facing = screenDx < 0 ? -1 : 1;
    }

    const step = Math.min(speed, dist);
    const nx = v.x + (dx / dist) * step;
    const ny = v.y + (dy / dist) * step;

    if (this.isWaterTile(Math.floor(nx), Math.floor(ny))) {
      v.x = nx;
      v.y = ny;
      v._stuckCount = 0;
      return Math.hypot(destX - v.x, destY - v.y) <= 0.6;
    }

    // Blocked by riverbank/coast: steer smoothly via bounded water BFS
    const waypoint = this.findNextWaterStep(v.x, v.y, destX, destY);
    if (waypoint) {
      const wdx = waypoint.x - v.x;
      const wdy = waypoint.y - v.y;
      const wd = Math.hypot(wdx, wdy);
      if (wd > 0.01) {
        const wStep = Math.min(speed, wd);
        v.x += (wdx / wd) * wStep;
        v.y += (wdy / wd) * wStep;
        v._stuckCount = 0;
        return Math.hypot(destX - v.x, destY - v.y) <= 0.8;
      }
    }

    v._stuckCount = (v._stuckCount || 0) + 1;
    return false;
  }

  updateFishingVessel(v) {
    if (v.state === 'outbound') {
      const arrived = this.moveVesselToward(v, v.targetX, v.targetY, 0.28);
      if (arrived || (v._stuckCount || 0) > 12) {
        v._stuckCount = 0;
        v.state = 'fishing';
        v.harvestTicks = 12;
      }
    } else if (v.state === 'fishing') {
      v.harvestTicks = Math.max(0, (v.harvestTicks || 0) - 1);
      if (v.harvestTicks === 0) {
        v.cargo = { resource: 'food', amount: 5, capacity: 5 };
        v.state = 'returning';
      }
    } else if (v.state === 'returning') {
      const arrived = this.moveVesselToward(v, v.homeWaterX, v.homeWaterY, 0.28);
      if (arrived || Math.hypot(v.x - v.homeWaterX, v.y - v.homeWaterY) <= 1.2 || (v._stuckCount || 0) > 18) {
        v._stuckCount = 0;
        if (v.cargo?.amount > 0 && v.settlementId != null) {
          this.sim.settlementSystem?.depositToStockpile(v.settlementId, 'food', v.cargo.amount);
          this.stats.fishingTrips++;
          this.stats.fishCaught += v.cargo.amount;
          this.sim.eventBus?.emit('FISHING_CATCH_LANDED', {
            vesselId: v.id,
            settlementId: v.settlementId,
            amount: v.cargo.amount
          });
        }
        v.cargo = { resource: 'food', amount: 0, capacity: 5 };
        const nextSpot = this.findFishingSpot(v.homeWaterX, v.homeWaterY, (v.id || 1) + Math.floor((v.ageTicks || 0) / 10));
        v.targetX = nextSpot.x;
        v.targetY = nextSpot.y;
        v.state = 'outbound';
      }
    }
  }

  updateBargeVessel(v) {
    const settlements = this.sim.settlementSystem?.settlements;
    const fromS = settlements?.get(v.settlementId);
    const toS = settlements?.get(v.targetSettlementId);
    if (!fromS || !toS || fromS.ruined || toS.ruined) return false;

    if (v.state === 'sailing_outbound') {
      const arrived = this.moveVesselToward(v, v.targetX, v.targetY, 0.34);
      if (arrived || Math.hypot(v.x - v.targetX, v.y - v.targetY) <= 1.2) {
        if (v.cargo?.amount > 0) {
          this.sim.settlementSystem?.depositToStockpile(toS.id, v.cargo.resource, v.cargo.amount);
          this.stats.bargeDeliveries++;
          this.stats.bargeCargoMoved += v.cargo.amount;
          this.sim.eventBus?.emit('BARGE_TRADE_COMPLETED', {
            from: fromS.name,
            to: toS.name,
            resource: v.cargo.resource,
            amount: v.cargo.amount
          });
          v.cargo.amount = 0;
        }
        // Load return cargo if target has surplus
        v.cargo = this._loadBargeCargo(toS, fromS);
        v.state = 'sailing_return';
      }
    } else if (v.state === 'sailing_return') {
      const arrived = this.moveVesselToward(v, v.homeWaterX, v.homeWaterY, 0.34);
      if (arrived || Math.hypot(v.x - v.homeWaterX, v.y - v.homeWaterY) <= 1.2) {
        if (v.cargo?.amount > 0) {
          this.sim.settlementSystem?.depositToStockpile(fromS.id, v.cargo.resource, v.cargo.amount);
          this.stats.bargeDeliveries++;
          this.stats.bargeCargoMoved += v.cargo.amount;
          this.sim.eventBus?.emit('BARGE_TRADE_COMPLETED', {
            from: toS.name,
            to: fromS.name,
            resource: v.cargo.resource,
            amount: v.cargo.amount
          });
          v.cargo.amount = 0;
        }
        // Reload outbound cargo and repeat if route stays active
        const route = (this.sim.tradeSystem?.tradeRoutes || []).find(r => r.id === v.routeId);
        if (!route || !route.active) return false;
        v.cargo = this._loadBargeCargo(fromS, toS);
        v.state = 'sailing_outbound';
      }
    }
    return true;
  }

  /**
   * Checks if a warband advancing from commander toward destPos hits water/river
   * and embarks the squad on an amphibious raid longboat.
   */
  tryEmbarkWarband(warband, commander, destPos) {
    if (!warband || !commander || !destPos || warband.embarked) return false;
    const dx = destPos.x - commander.x;
    const dy = destPos.y - commander.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) return false;

    // Look ahead 1-4 tiles along heading OR see if commander is stuck at shore
    let needsWaterCrossing = false;
    for (let step = 1; step <= Math.min(4, Math.ceil(dist)); step++) {
      const sx = Math.floor(commander.x + (dx / dist) * step);
      const sy = Math.floor(commander.y + (dy / dist) * step);
      if (this.isWaterTile(sx, sy) && !this.sim.world.isBridge(sx, sy)) {
        needsWaterCrossing = true;
        break;
      }
    }
    if (!needsWaterCrossing && (commander.stuckTicks || 0) < 2) return false;

    const launchWater = this.findNearestWaterTile(commander.x, commander.y, 4);
    if (!launchWater) return false;

    const targetWater = this.findNearestWaterTile(destPos.x, destPos.y, 10) || launchWater;
    const id = this.nextVesselId++;
    const vessel = {
      id,
      kind: 'raid',
      name: `${warband.settlementName || 'Raiders'} Longboat #${id}`,
      settlementId: warband.settlementId,
      targetSettlementId: warband.targetSettlementId ?? null,
      factionId: null,
      homeDockId: null,
      homeWaterX: launchWater.x,
      homeWaterY: launchWater.y,
      x: launchWater.x,
      y: launchWater.y,
      targetX: targetWater.x,
      targetY: targetWater.y,
      state: 'embarked',
      cargo: { resource: 'troops', amount: warband.soldiers.length, capacity: 12 },
      harvestTicks: 0,
      routeId: null,
      warbandId: warband.id,
      bannerColor: warband.bannerColor || '#ef4444',
      facing: 1,
      ageTicks: 0
    };
    this.vessels.push(vessel);

    warband.embarked = true;
    warband.isAmphibious = true;
    warband.vesselId = vessel.id;

    for (let i = 0; i < warband.soldiers.length; i++) {
      const s = this.sim._agentById(warband.soldiers[i]);
      if (!s || !s.alive) continue;
      const oldTx = Math.floor(s.x), oldTy = Math.floor(s.y);
      const newTx = Math.floor(vessel.x), newTy = Math.floor(vessel.y);
      if (oldTx !== newTx || oldTy !== newTy) {
        this.sim.world.removeFromSpatialIndex(oldTx, oldTy, s);
        this.sim.world.addToSpatialIndex(newTx, newTy, s);
      }
      s.x = vessel.x;
      s.y = vessel.y;
      s.embarked = true;
      s.vesselId = vessel.id;
      s.stuckTicks = 0;
      s.path = null;
    }

    this.stats.amphibiousRaids++;
    const targetS = warband.targetSettlementId ? this.sim.settlementSystem?.settlements.get(warband.targetSettlementId) : null;
    this.sim.eventBus?.emit('AMPHIBIOUS_RAID_LAUNCHED', {
      warbandId: warband.id,
      vesselId: vessel.id,
      settlementName: warband.settlementName,
      targetSettlementName: targetS?.name || 'enemy shore',
      size: warband.soldiers.length,
      x: vessel.x,
      y: vessel.y
    });

    return true;
  }

  updateRaidVessel(v) {
    const warband = this.sim.warfareSystem?.warbands.get(v.warbandId);
    if (!warband || !warband.active || !warband.embarked) return false;

    const settlements = this.sim.settlementSystem?.settlements;
    const destSettlement = warband.state === 'retreating'
      ? settlements?.get(warband.settlementId)
      : settlements?.get(warband.targetSettlementId);
    const destCenter = destSettlement?.center || { x: v.targetX, y: v.targetY };

    const targetWater = this.findNearestWaterTile(destCenter.x, destCenter.y, 10);
    if (targetWater) {
      v.targetX = targetWater.x;
      v.targetY = targetWater.y;
    }

    const arrivedWater = this.moveVesselToward(v, v.targetX, v.targetY, 0.44);

    // Sync embarked soldiers onto vessel deck
    for (let i = 0; i < warband.soldiers.length; i++) {
      const s = this.sim._agentById(warband.soldiers[i]);
      if (!s || !s.alive) continue;
      const oldTx = Math.floor(s.x), oldTy = Math.floor(s.y);
      const newTx = Math.floor(v.x), newTy = Math.floor(v.y);
      if (oldTx !== newTx || oldTy !== newTy) {
        this.sim.world.removeFromSpatialIndex(oldTx, oldTy, s);
        this.sim.world.addToSpatialIndex(newTx, newTy, s);
      }
      s.x = v.x;
      s.y = v.y;
      s.embarked = true;
      s.vesselId = v.id;
    }

    const distToWaterTarget = Math.hypot(v.x - v.targetX, v.y - v.targetY);
    const distToDest = Math.hypot(v.x - destCenter.x, v.y - destCenter.y);

    // Ready to beach & disembark onto walkable ground near destination
    if (arrivedWater || distToWaterTarget <= 1.8 || distToDest <= 6.0 || (v._stuckCount || 0) >= 6) {
      const landing = this._findLandingTile(v.x, v.y, destCenter);
      if (landing) {
        this._disembarkWarband(warband, landing.x, landing.y);
        return false; // remove temporary raid longboat after beaching
      }
    }
    return true;
  }

  _findLandingTile(vx, vy, destCenter) {
    const world = this.sim.world;
    let best = null;
    let bestScore = Infinity;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = Math.floor(vx) + dx;
        const ty = Math.floor(vy) + dy;
        if (tx < 1 || ty < 1 || tx >= world.width - 1 || ty >= world.height - 1) continue;
        if (!world.isWalkable(tx, ty) || this.isWaterTile(tx, ty)) continue;
        const score = Math.hypot(tx + 0.5 - destCenter.x, ty + 0.5 - destCenter.y);
        if (score < bestScore) {
          bestScore = score;
          best = { x: tx + 0.5, y: ty + 0.5 };
        }
      }
    }
    return best;
  }

  _disembarkWarband(warband, lx, ly) {
    warband.embarked = false;
    warband.vesselId = null;

    for (let i = 0; i < warband.soldiers.length; i++) {
      const s = this.sim._agentById(warband.soldiers[i]);
      if (!s || !s.alive) continue;
      const ox = lx + ((i % 3) - 1) * 0.2;
      const oy = ly + (Math.floor(i / 3) - 1) * 0.2;
      const tx = this.sim.world.isWalkable(Math.floor(ox), Math.floor(oy)) ? ox : lx;
      const ty = this.sim.world.isWalkable(Math.floor(ox), Math.floor(oy)) ? oy : ly;

      const oldTx = Math.floor(s.x), oldTy = Math.floor(s.y);
      const newTx = Math.floor(tx), newTy = Math.floor(ty);
      if (oldTx !== newTx || oldTy !== newTy) {
        this.sim.world.removeFromSpatialIndex(oldTx, oldTy, s);
        this.sim.world.addToSpatialIndex(newTx, newTy, s);
      }
      s.x = tx;
      s.y = ty;
      s.embarked = false;
      s.vesselId = null;
      s.stuckTicks = 0;
      s.path = null;
    }

    this.stats.amphibiousLandings++;
    this.sim.eventBus?.emit('AMPHIBIOUS_LANDING', {
      warbandId: warband.id,
      settlementName: warband.settlementName,
      x: lx,
      y: ly
    });
  }

  serialize() {
    return {
      nextVesselId: this.nextVesselId,
      stats: { ...this.stats },
      vessels: this.vessels.map(v => ({
        ...v,
        cargo: v.cargo ? { ...v.cargo } : { resource: 'food', amount: 0, capacity: 5 }
      }))
    };
  }

  static deserialize(data, sim) {
    const sys = new NavalSystem(sim);
    if (data) {
      sys.nextVesselId = data.nextVesselId || 1;
      if (data.stats) sys.stats = { ...sys.stats, ...data.stats };
      if (Array.isArray(data.vessels)) {
        sys.vessels = data.vessels.map(v => ({
          ...v,
          cargo: v.cargo ? { ...v.cargo } : { resource: 'food', amount: 0, capacity: 5 }
        }));
      }
    }
    return sys;
  }
}
