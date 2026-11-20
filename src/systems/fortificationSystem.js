// Fortification System — Perimeter City Walls, Gatehouses, Active Watchtowers & Physical Siege Breaches
// Deterministic integer geometry & modular logic (zero Math.random() calls).

import { Building } from '../simulation/building.js';

export const WALL_TIERS = {
  palisade: {
    key: 'palisade',
    name: 'Timber Palisade',
    minEra: 1,
    maxHp: 140,
  },
  stone_wall: {
    key: 'stone_wall',
    name: 'Stone Curtain Wall',
    minEra: 3,
    maxHp: 260,
  },
  bastion: {
    key: 'bastion',
    name: 'Reinforced Bastion Wall',
    minEra: 5,
    maxHp: 400,
  },
};

export class FortificationSystem {
  constructor(sim = null) {
    this.sim = sim;
    // tileIdx (y * width + x) -> segment
    this.segments = new Map();
    // settlementId -> array of segments belonging to that settlement (O(city) queries)
    this.segmentsBySettlement = new Map();
    // settlementId -> { radius, tierKey, lastRepairTick }
    this.settlementMeta = new Map();
    // Flat passability bitmap: 0 = open/breach, 1 = solid wall, 2 = gate
    this._wallGrid = null;
    this._wallGridW = 0;
    this._wallGridH = 0;
    this.nextSegmentId = 1;
    this.lastUpdateTick = 0;
  }

  _ensureWallGrid() {
    const w = this.sim?.world?.width || 128;
    const h = this.sim?.world?.height || 128;
    if (!this._wallGrid || this._wallGridW !== w || this._wallGridH !== h) {
      this._wallGridW = w;
      this._wallGridH = h;
      this._wallGrid = new Uint8Array(w * h);
      for (const seg of this.segments.values()) {
        if (seg.tileIdx >= 0 && seg.tileIdx < this._wallGrid.length) {
          this._wallGrid[seg.tileIdx] = (seg.state === 'breach' || seg.hp <= 0) ? 0 : (seg.kind === 'gate' ? 2 : 1);
        }
      }
    }
    return this._wallGrid;
  }

  _syncSegGridAndIndex(seg, isNew = false) {
    const grid = this._ensureWallGrid();
    if (seg.tileIdx >= 0 && seg.tileIdx < grid.length) {
      grid[seg.tileIdx] = (seg.state === 'breach' || seg.hp <= 0) ? 0 : (seg.kind === 'gate' ? 2 : 1);
    }
    if (isNew) {
      let arr = this.segmentsBySettlement.get(seg.settlementId);
      if (!arr) {
        arr = [];
        this.segmentsBySettlement.set(seg.settlementId, arr);
      }
      arr.push(seg);
    }
  }

  _tileIdx(x, y) {
    const w = this.sim?.world?.width || 128;
    return Math.floor(y) * w + Math.floor(x);
  }

  getSegmentAt(x, y) {
    const world = this.sim?.world;
    if (!world) return null;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return null;
    return this.segments.get(ty * world.width + tx) || null;
  }

  getWallTierForSettlement(settlementId) {
    const ageId = this.sim?.civilizationAgeSystem?.getSettlementAge?.(settlementId)?.ageId || 1;
    const wonderMult = this.sim?.civilizationAgeSystem?.getWonderBuffs?.(settlementId)?.defenseMultiplier || 1.0;
    const base = ageId >= 5 ? WALL_TIERS.bastion : ageId >= 3 ? WALL_TIERS.stone_wall : WALL_TIERS.palisade;
    return {
      ...base,
      maxHp: Math.round(base.maxHp * wonderMult),
      defenseMultiplier: wonderMult,
    };
  }

  _computeOctagonRing(cx, cy, radius) {
    const r = Math.max(5, Math.floor(radius));
    const c = Math.max(2, Math.floor(r * 0.35));
    const coords = [];
    const seen = new Set();
    const push = (x, y) => {
      const k = `${x},${y}`;
      if (!seen.has(k)) {
        seen.add(k);
        coords.push({ x, y });
      }
    };

    // North & South flat faces
    for (let x = cx - (r - c); x <= cx + (r - c); x++) {
      push(x, cy - r);
      push(x, cy + r);
    }
    // West & East flat faces
    for (let y = cy - (r - c); y <= cy + (r - c); y++) {
      push(cx - r, y);
      push(cx + r, y);
    }
    // 4-connected chamfered corners (no diagonal pinholes)
    for (let i = 0; i < c; i++) {
      // NE
      push(cx + (r - c) + i + 1, cy - r + i);
      push(cx + (r - c) + i + 1, cy - r + i + 1);
      // SE
      push(cx + r - i, cy + (r - c) + i + 1);
      push(cx + r - i - 1, cy + (r - c) + i + 1);
      // SW
      push(cx - (r - c) - i - 1, cy + r - i);
      push(cx - (r - c) - i - 1, cy + r - i - 1);
      // NW
      push(cx - r + i, cy - (r - c) - i - 1);
      push(cx - r + i + 1, cy - (r - c) - i - 1);
    }

    return { coords, radius: r, chamfer: c };
  }

  _hasBuildingAt(tx, ty) {
    const buildings = this.sim?.buildings;
    if (!Array.isArray(buildings)) return false;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (!b || b.isRuined) continue;
      if (Math.floor(b.x) === tx && Math.floor(b.y) === ty) return true;
    }
    return false;
  }

  fortifySettlement(settlementId, options = {}) {
    const s = this.sim?.settlementSystem?.settlements?.get(settlementId);
    const world = this.sim?.world;
    if (!s || s.ruined || !s.center || !world) return null;

    const tick = options.tick ?? (this.sim?.clock?.tick ?? 0);
    const pop = s.population || s.agentIds?.size || 0;
    const radius = options.radius ?? (pop >= 35 ? 12 : pop >= 16 ? 10 : 8);
    const tier = this.getWallTierForSettlement(settlementId);
    const cx = Math.floor(s.center.x);
    const cy = Math.floor(s.center.y);

    const existingMeta = this.settlementMeta.get(settlementId);
    const { coords, chamfer } = this._computeOctagonRing(cx, cy, existingMeta?.radius ?? radius);
    const effectiveRadius = existingMeta?.radius ?? radius;

    let created = 0;
    let upgraded = 0;
    let repaired = 0;

    for (const { x, y } of coords) {
      if (x < 2 || y < 2 || x >= world.width - 2 || y >= world.height - 2) continue;
      if (!world.isWalkable(x, y)) continue;
      if (world.isBridge && world.isBridge(x, y)) continue;
      if (this._hasBuildingAt(x, y)) continue;

      const idx = y * world.width + x;
      const isCardinalGate = x === cx || y === cy || (world.isRoad && world.isRoad(x, y));
      const kind = isCardinalGate ? 'gate' : 'wall';
      const existing = this.segments.get(idx);

      if (existing) {
        if (existing.settlementId === settlementId) {
          if (existing.tierKey !== tier.key || existing.maxHp !== tier.maxHp) {
            const ratio = existing.maxHp > 0 ? existing.hp / existing.maxHp : 1;
            existing.tierKey = tier.key;
            existing.maxHp = tier.maxHp;
            if (existing.state !== 'breach') {
              existing.hp = Math.min(tier.maxHp, Math.max(1, Math.round(tier.maxHp * ratio)));
            }
            upgraded++;
          }
          if (options.repairExisting && (existing.state === 'breach' || existing.hp < existing.maxHp)) {
            existing.state = 'intact';
            existing.hp = tier.maxHp;
            existing.breachedAtTick = null;
            this._syncSegGridAndIndex(existing, false);
            repaired++;
          }
        }
        continue;
      }

      const seg = {
        id: this.nextSegmentId++,
        x,
        y,
        tileIdx: idx,
        settlementId,
        factionId: s.factionId ?? null,
        kind,
        state: 'intact',
        tierKey: tier.key,
        hp: tier.maxHp,
        maxHp: tier.maxHp,
        builtAtTick: tick,
        breachedAtTick: null,
      };
      this.segments.set(idx, seg);
      this._syncSegGridAndIndex(seg, true);
      created++;
    }

    // Place up to 2–4 perimeter watchtowers on inner corner bastions if clear
    const targetTowers = pop >= 18 ? 4 : 2;
    let existingTowers = 0;
    if (Array.isArray(this.sim.buildings)) {
      for (const b of this.sim.buildings) {
        if (b && b.settlementId === settlementId && !b.isRuined && (b.buildingType === 'tower' || b.buildingType === 'castle')) {
          existingTowers++;
        }
      }
    }
    if (existingTowers < targetTowers) {
      const innerOffset = Math.max(3, effectiveRadius - chamfer);
      const towerSpots = [
        { x: cx - innerOffset, y: cy - innerOffset },
        { x: cx + innerOffset, y: cy + innerOffset },
        { x: cx + innerOffset, y: cy - innerOffset },
        { x: cx - innerOffset, y: cy + innerOffset },
      ];
      for (const spot of towerSpots) {
        if (existingTowers >= targetTowers) break;
        if (spot.x < 3 || spot.y < 3 || spot.x >= world.width - 3 || spot.y >= world.height - 3) continue;
        if (!world.isWalkable(spot.x, spot.y)) continue;
        if (this.getSegmentAt(spot.x, spot.y) || this._hasBuildingAt(spot.x, spot.y)) continue;
        this._spawnWatchtower(spot.x, spot.y, s, true);
        existingTowers++;
      }
    }

    this.settlementMeta.set(settlementId, {
      radius: effectiveRadius,
      tierKey: tier.key,
      lastTowerFireTick: existingMeta?.lastTowerFireTick ?? tick,
      lastRepairTick: existingMeta?.lastRepairTick ?? tick,
    });

    if (created > 0 && !existingMeta) {
      this.sim.eventBus?.emit('FORTIFICATIONS_BUILT', {
        settlementId,
        settlementName: s.name,
        tierName: tier.name,
        segmentsCount: created,
        towersCount: existingTowers,
        x: cx,
        y: cy,
        tick,
      });
    }

    return {
      created,
      upgraded,
      repaired,
      summary: this.getSettlementFortificationSummary(settlementId),
    };
  }

  _spawnWatchtower(x, y, settlement, complete = true) {
    if (!this.sim || !this.sim.world) return null;
    const b = new Building(
      x,
      y,
      'tower',
      this.sim.idGen,
      settlement?.id ?? null,
      settlement?.factionId ?? null
    );
    b.complete = complete;
    b.isComplete = complete;
    b.constructionProgress = complete ? 100 : 0;
    b.maxHealth = 220;
    b.health = 220;
    this.sim.buildings.push(b);
    this.sim.world.addToSpatialIndex(x, y, b);
    this.sim.world.entityRegistry?.set(b.id, b);
    if (settlement) {
      if (!settlement.buildings) settlement.buildings = [];
      settlement.buildings.push(b);
    }
    this.sim._occStamp = -1;
    return b;
  }

  placeWallAt(x, y) {
    const world = this.sim?.world;
    if (!world) return { success: false, reason: 'No world available' };
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 2 || ty < 2 || tx >= world.width - 2 || ty >= world.height - 2) {
      return { success: false, reason: 'Out of map bounds' };
    }
    if (!world.isWalkable(tx, ty)) {
      return { success: false, reason: 'Walls must be placed on dry walkable terrain!' };
    }
    if (world.isBridge && world.isBridge(tx, ty)) {
      return { success: false, reason: 'Cannot block a river bridge tile with a wall!' };
    }

    const idx = ty * world.width + tx;
    const existing = this.segments.get(idx);
    if (existing) {
      if (existing.state === 'breach' || existing.hp < existing.maxHp) {
        existing.state = 'intact';
        existing.hp = existing.maxHp;
        existing.breachedAtTick = null;
        this._syncSegGridAndIndex(existing, false);
        return { success: true, action: 'repaired', segment: existing };
      }
      // Toggle between solid wall and fortified gatehouse
      existing.kind = existing.kind === 'wall' ? 'gate' : 'wall';
      this._syncSegGridAndIndex(existing, false);
      return { success: true, action: 'toggled', segment: existing };
    }

    // Associate with nearest active settlement within 30 tiles
    let nearestS = null;
    let bestD = 30;
    if (this.sim?.settlementSystem?.settlements) {
      for (const s of this.sim.settlementSystem.settlements.values()) {
        if (!s || s.ruined || !s.center) continue;
        const d = Math.hypot(s.center.x - tx, s.center.y - ty);
        if (d < bestD) {
          bestD = d;
          nearestS = s;
        }
      }
    }

    const sid = nearestS ? nearestS.id : 0;
    const tier = sid ? this.getWallTierForSettlement(sid) : WALL_TIERS.stone_wall;
    const kind = world.isRoad && world.isRoad(tx, ty) ? 'gate' : 'wall';
    const seg = {
      id: this.nextSegmentId++,
      x: tx,
      y: ty,
      tileIdx: idx,
      settlementId: sid,
      factionId: nearestS?.factionId ?? null,
      kind,
      state: 'intact',
      tierKey: tier.key,
      hp: tier.maxHp,
      maxHp: tier.maxHp,
      builtAtTick: this.sim?.clock?.tick ?? 0,
      breachedAtTick: null,
    };
    this.segments.set(idx, seg);
    this._syncSegGridAndIndex(seg, true);
    return { success: true, action: 'built', segment: seg, settlement: nearestS };
  }

  placeTowerAt(x, y) {
    const world = this.sim?.world;
    if (!world) return { success: false, reason: 'No world available' };
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 2 || ty < 2 || tx >= world.width - 2 || ty >= world.height - 2) {
      return { success: false, reason: 'Out of map bounds' };
    }
    if (!world.isWalkable(tx, ty)) {
      return { success: false, reason: 'Watchtowers must be built on dry walkable terrain!' };
    }
    if (this._hasBuildingAt(tx, ty)) {
      return { success: false, reason: 'That tile already holds a building!' };
    }

    let nearestS = null;
    let bestD = 30;
    if (this.sim?.settlementSystem?.settlements) {
      for (const s of this.sim.settlementSystem.settlements.values()) {
        if (!s || s.ruined || !s.center) continue;
        const d = Math.hypot(s.center.x - tx, s.center.y - ty);
        if (d < bestD) {
          bestD = d;
          nearestS = s;
        }
      }
    }

    const tower = this._spawnWatchtower(tx, ty, nearestS, true);
    return { success: true, tower, settlement: nearestS };
  }

  isHostileAgentToSettlement(agent, settlementId) {
    if (!agent || !agent.alive || !settlementId) return false;
    if (agent.warbandId != null) {
      const wb = this.sim?.warfareSystem?.warbands?.get(agent.warbandId);
      if (wb && wb.active) {
        if (wb.targetSettlementId === settlementId && !wb.isCivilWar && !wb.isRebellion) {
          return true;
        }
        if (wb.settlementId && wb.settlementId !== settlementId) {
          const rel = this.sim?.diplomacySystem?.getRelation?.(wb.settlementId, settlementId);
          if (rel && rel.status === 'war') return true;
        }
      }
    }
    if (agent.settlementId != null && agent.settlementId !== settlementId) {
      const rel = this.sim?.diplomacySystem?.getRelation?.(agent.settlementId, settlementId);
      if (rel && rel.status === 'war') return true;
    }
    return false;
  }

  isBlockedForAgent(tx, ty, agent) {
    if (agent && (agent.combatRole === 'plane' || agent.combat?.isFlying)) return false;
    if (this.segments.size === 0) return false;
    const world = this.sim?.world;
    if (!world) return false;
    const ix = Math.floor(tx);
    const iy = Math.floor(ty);
    if (ix < 0 || iy < 0 || ix >= world.width || iy >= world.height) return false;

    const grid = this._ensureWallGrid();
    const idx = iy * world.width + ix;
    const code = grid[idx];
    if (code === 0) return false;
    if (code === 1) return true;

    const seg = this.segments.get(idx);
    if (!seg || seg.state === 'breach' || seg.hp <= 0) return false;
    return this.isHostileAgentToSettlement(agent, seg.settlementId);
  }

  getNearestGateOrBreach(x, y, settlementId) {
    const list = this.segmentsBySettlement.get(settlementId);
    if (!list || list.length === 0) return null;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < list.length; i++) {
      const seg = list[i];
      if (seg.kind !== 'gate' && seg.state !== 'breach') continue;
      const d = Math.hypot(seg.x + 0.5 - x, seg.y + 0.5 - y);
      if (d < bestDist) {
        bestDist = d;
        best = seg;
      }
    }
    return best;
  }

  findBlockingWallForWarband(fromX, fromY, targetSettlementId) {
    const target = this.sim?.settlementSystem?.settlements?.get(targetSettlementId);
    if (!target || !target.center) return null;
    const list = this.segmentsBySettlement.get(targetSettlementId);
    if (!list || list.length === 0) return null;

    // If an open breach already sits on the attacker's approach, let them exploit it
    let nearestBreachDist = Infinity;
    let nearestIntact = null;
    let bestIntactDist = Infinity;

    for (let i = 0; i < list.length; i++) {
      const seg = list[i];
      const dFromAttacker = Math.hypot(seg.x + 0.5 - fromX, seg.y + 0.5 - fromY);
      if (seg.state === 'breach' || seg.hp <= 0) {
        if (dFromAttacker < nearestBreachDist) {
          nearestBreachDist = dFromAttacker;
        }
      } else {
        if (dFromAttacker < bestIntactDist) {
          bestIntactDist = dFromAttacker;
          nearestIntact = seg;
        }
      }
    }

    if (nearestBreachDist <= 5.5 || (nearestBreachDist <= 14.0 && nearestBreachDist <= bestIntactDist + 2.5)) {
      return null;
    }
    return nearestIntact;
  }

  damageSegment(seg, amount, attackerName = 'Besiegers', warband = null, options = {}) {
    if (!seg || seg.state === 'breach' || seg.hp <= 0) return { breached: false };
    const tick = this.sim?.clock?.tick ?? 0;
    seg.hp = Math.max(0, Math.round(seg.hp - Math.max(1, amount)));

    const effects = this.sim?.warfareSystem?.combatEffects;
    if (Array.isArray(effects)) {
      effects.push({
        x: seg.x + 0.5,
        y: seg.y + 0.5,
        type: 'wall_hit',
        duration: 14,
      });
    }

    if (seg.hp <= 0) {
      seg.hp = 0;
      seg.state = 'breach';
      seg.breachedAtTick = tick;
      this._syncSegGridAndIndex(seg, false);

      const world = this.sim?.world;
      if (world?.scorchTile) world.scorchTile(seg.x, seg.y, 190);
      if (world?.addCrater) world.addCrater(seg.x, seg.y, 0, 140);

      if (Array.isArray(effects)) {
        effects.push({
          x: seg.x + 0.5,
          y: seg.y + 0.5,
          type: 'wall_breach',
          duration: 24,
        });
        effects.push({
          x: seg.x + 0.5,
          y: seg.y + 0.5,
          type: 'explosion',
          duration: 18,
        });
      }

      const s = this.sim?.settlementSystem?.settlements?.get(seg.settlementId);
      const sName = s?.name || 'the city';
      const wasGate = seg.kind === 'gate';

      if (!options?.silent) {
        this.sim?.eventBus?.emit('WALL_BREACHED', {
          settlementId: seg.settlementId,
          settlementName: sName,
          attackerName,
          attackerSettlementId: warband?.settlementId ?? null,
          wasGate,
          x: seg.x,
          y: seg.y,
          tick,
        });
      }

      return { breached: true, segment: seg };
    }

    return { breached: false, segment: seg };
  }

  getSettlementFortificationSummary(settlementId) {
    const tier = this.getWallTierForSettlement(settlementId);
    const list = this.segmentsBySettlement.get(settlementId);
    let totalSegments = 0;
    let intactWalls = 0;
    let gates = 0;
    let intactGates = 0;
    let breaches = 0;

    if (list) {
      for (let i = 0; i < list.length; i++) {
        const seg = list[i];
        totalSegments++;
        if (seg.state === 'breach' || seg.hp <= 0) {
          breaches++;
        } else if (seg.kind === 'gate') {
          gates++;
          intactGates++;
        } else {
          intactWalls++;
        }
      }
    }

    let towers = 0;
    if (Array.isArray(this.sim?.buildings)) {
      for (let i = 0; i < this.sim.buildings.length; i++) {
        const b = this.sim.buildings[i];
        if (b && b.settlementId === settlementId && b.complete && !b.isRuined && (b.buildingType === 'tower' || b.buildingType === 'castle')) {
          towers++;
        }
      }
    }

    return {
      hasWalls: totalSegments > 0,
      tierKey: tier.key,
      tierName: tier.name,
      totalSegments,
      intactWalls,
      gates,
      intactGates,
      breaches,
      towers,
      defenseMultiplier: tier.defenseMultiplier,
    };
  }

  _updateTowerDefense(tick) {
    if (!this.sim || !Array.isArray(this.sim.buildings) || !this.sim.diplomacySystem) return;
    if (tick % 14 !== 0) return;

    const warfare = this.sim.warfareSystem;
    const combatEffects = warfare?.combatEffects;
    const enemySetCache = new Map();

    for (let i = 0; i < this.sim.buildings.length; i++) {
      const b = this.sim.buildings[i];
      if (!b || !b.complete || b.isRuined || (b.health !== undefined && b.health <= 0)) continue;
      if (b.buildingType !== 'tower' && b.buildingType !== 'castle' && b.buildingType !== 'radar_station') continue;
      if (b.settlementId == null) continue;

      let enemySet = enemySetCache.get(b.settlementId);
      if (enemySet === undefined) {
        const enemies = this.sim.diplomacySystem.getEnemies(b.settlementId);
        enemySet = enemies && enemies.length > 0 ? new Set(enemies) : null;
        enemySetCache.set(b.settlementId, enemySet);
      }
      if (!enemySet) continue;

      const lvl = b.level || 1;
      const radarBonus = this.sim.getSettlementBuildingBonus?.(b.settlementId, 'radar_station')?.maxLevel || 0;
      const radarRangeBoost = b.buildingType === 'radar_station' ? 0 : (radarBonus > 0 ? (1 + radarBonus) : 0);
      const baseRange = b.buildingType === 'radar_station'
        ? (16.0 + (lvl - 1) * 3.0)
        : (b.buildingType === 'castle' ? 11.0 : 8.5) + (lvl - 1) * 1.5 + radarRangeBoost;
      const rangeSq = baseRange * baseRange;
      const nearby = this.sim.world?.getNearbyAgents
        ? this.sim.world.getNearbyAgents(b.x, b.y, Math.ceil(baseRange))
        : this.sim.agents;

      let target = null;
      let targetIsAir = false;
      let bestDistSq = Infinity;
      for (let j = 0; j < nearby.length; j++) {
        const a = nearby[j];
        if (!a || !a.alive || a.embarked) continue;
        const aSid = a.settlementId;
        const wb = a.warbandId != null ? warfare?.warbands?.get(a.warbandId) : null;
        const isHostile = enemySet.has(aSid) || (wb && wb.targetSettlementId === b.settlementId && !wb.isCivilWar && !wb.isRebellion);
        if (!isHostile) continue;
        const isAir = Boolean(a.combatRole === 'plane' || a.combat?.isFlying);
        if (b.buildingType === 'radar_station' && !isAir && targetIsAir) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= rangeSq) {
          if (b.buildingType === 'radar_station' && isAir && !targetIsAir) {
            targetIsAir = true;
            bestDistSq = dSq;
            target = a;
          } else if (dSq < bestDistSq || (dSq === bestDistSq && target && a.id < target.id)) {
            bestDistSq = dSq;
            target = a;
          }
        }
      }

      if (!target) continue;

      const eraId = this.sim.civilizationAgeSystem?.getSettlementAge?.(b.settlementId)?.ageId || 1;
      const wonderMult = this.sim.civilizationAgeSystem?.getWonderBuffs?.(b.settlementId)?.defenseMultiplier || 1.0;
      const levelMult = 1 + (lvl - 1) * 0.35;
      let dmg = 0;
      if (b.buildingType === 'radar_station') {
        const targetAir = Boolean(target.combatRole === 'plane' || target.combat?.isFlying);
        dmg = Math.round((targetAir ? 42 : 16) * (1 + (lvl - 1) * 0.42));
      } else {
        const baseDmg = eraId >= 6 ? 30 : eraId >= 5 ? 24 : eraId >= 3 ? 18 : 13;
        dmg = Math.round(baseDmg * wonderMult * levelMult * (b.buildingType === 'castle' ? 1.2 : 1.0));
      }

      if (!target.combat) target.combat = { health: target.health ?? 100, defense: 0.05 };
      const curHp = target.combat.health ?? target.health ?? 100;
      const nextHp = Math.max(0, curHp - dmg);
      target.combat.health = nextHp;
      target.health = nextHp;
      target._lastCombatTick = tick;
      if (nextHp <= 35 && nextHp > 0) target.wounded = true;

      if (Array.isArray(combatEffects)) {
        combatEffects.push({
          x: target.x,
          y: target.y,
          fromX: b.x + 0.5,
          fromY: b.y + 0.5,
          toX: target.x,
          toY: target.y,
          type: b.buildingType === 'radar_station' ? 'tracer_fire' : (eraId >= 6 ? 'tracer_fire' : eraId >= 5 ? 'musket_shot' : 'arrow'),
          duration: 12,
        });
      }

      if (nextHp <= 0) {
        if (warfare && typeof warfare._recordCombatKill === 'function') {
          let homeGuard = null;
          const town = this.sim.settlementSystem?.settlements?.get(b.settlementId);
          if (town?.agentIds) {
            for (const aid of town.agentIds) {
              const g = this.sim._agentById(aid);
              if (g && g.alive && g.job === 'soldier' && (!homeGuard || g.id < homeGuard.id)) {
                homeGuard = g;
              }
            }
          }
          if (homeGuard) {
            warfare._recordCombatKill(homeGuard, target, null);
          } else {
            this.sim.removeAgent(target.id, 'combat');
          }
        } else {
          this.sim.removeAgent(target.id, 'combat');
        }
      }
    }
  }

  _repairWalls(tick) {
    if (tick % 120 !== 0 || this.segments.size === 0) return;
    const settlements = this.sim?.settlementSystem?.settlements;
    if (!settlements) return;

    const underAttackIds = new Set();
    const warbands = this.sim?.warfareSystem?.warbands;
    if (warbands) {
      for (const wb of warbands.values()) {
        if (wb.active && (wb.state === 'breaching' || wb.state === 'sieging') && wb.targetSettlementId != null) {
          underAttackIds.add(wb.targetSettlementId);
        }
      }
    }

    for (const [sId, s] of settlements) {
      if (!s || s.ruined || underAttackIds.has(sId)) continue;
      const list = this.segmentsBySettlement.get(sId);
      if (!list || list.length === 0) continue;

      const tier = this.getWallTierForSettlement(sId);
      let repairedOne = false;
      for (let i = 0; i < list.length; i++) {
        const seg = list[i];
        if (seg.state === 'breach' || seg.hp < tier.maxHp) {
          seg.tierKey = tier.key;
          seg.maxHp = tier.maxHp;
          seg.state = 'intact';
          seg.hp = Math.min(tier.maxHp, seg.hp + Math.ceil(tier.maxHp * 0.5));
          seg.breachedAtTick = null;
          this._syncSegGridAndIndex(seg, false);
          repairedOne = true;
          break;
        }
      }
      if (repairedOne && s.stockpile && (s.stockpile.wood || 0) > 1) {
        s.stockpile.wood = Math.max(0, s.stockpile.wood - 1);
      }
    }
  }

  update(tick) {
    if (!this.sim || !this.sim.settlementSystem) return;

    this._updateTowerDefense(tick);
    this._repairWalls(tick);

    // Autonomous perimeter wall planning every 140 ticks once towns mature
    if (tick < 160 || tick - this.lastUpdateTick < 140) return;
    this.lastUpdateTick = tick;

    const settlements = Array.from(this.sim.settlementSystem.settlements.values())
      .filter(s => s && !s.ruined)
      .sort((a, b) => a.id - b.id);

    for (const s of settlements) {
      const pop = s.population || s.agentIds?.size || 0;
      const buffs = this.sim.civilizationAgeSystem?.getWonderBuffs?.(s.id);
      const hasCitadel = Boolean(buffs && buffs.defenseMultiplier > 1);
      if (pop >= 9 || hasCitadel || this.settlementMeta.has(s.id)) {
        this.fortifySettlement(s.id, { tick });
      }
    }
  }

  cleanupSettlement(settlementId) {
    const list = this.segmentsBySettlement.get(settlementId);
    const grid = this._wallGrid;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const seg = list[i];
        this.segments.delete(seg.tileIdx);
        if (grid && seg.tileIdx >= 0 && seg.tileIdx < grid.length) {
          grid[seg.tileIdx] = 0;
        }
      }
      this.segmentsBySettlement.delete(settlementId);
    }
    this.settlementMeta.delete(settlementId);
  }

  serialize() {
    return {
      nextSegmentId: this.nextSegmentId,
      lastUpdateTick: this.lastUpdateTick,
      segments: Array.from(this.segments.values()).map(seg => ({ ...seg })),
      settlementMeta: Array.from(this.settlementMeta.entries()).map(([id, meta]) => [id, { ...meta }]),
    };
  }

  static deserialize(data, sim) {
    const sys = new FortificationSystem(sim);
    if (!data) return sys;
    sys.nextSegmentId = data.nextSegmentId || 1;
    sys.lastUpdateTick = data.lastUpdateTick || 0;
    if (Array.isArray(data.segments)) {
      for (const seg of data.segments) {
        const copy = { ...seg };
        sys.segments.set(copy.tileIdx, copy);
        sys._syncSegGridAndIndex(copy, true);
      }
    }
    if (Array.isArray(data.settlementMeta)) {
      for (const [id, meta] of data.settlementMeta) {
        sys.settlementMeta.set(id, { ...meta });
      }
    }
    return sys;
  }
}
