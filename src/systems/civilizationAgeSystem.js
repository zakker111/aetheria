import { Building } from '../simulation/building.js';

/**
 * Civilization Age & Monument Wonder System
 * Tracks historical epochs (Tribal -> Bronze -> Classical -> Imperial -> Industrial -> Modern),
 * technology milestones, tactical doctrines, cultural perks, and Monument Wonder construction.
 */

export const CIVILIZATION_AGES = {
  TRIBAL: {
    id: 1,
    name: 'Tribal Era',
    icon: '🏕️',
    color: '#b45309',
    doctrine: 'skirmish',
    description: 'Primitive hunters and foragers clustered around hearthfires.',
    monumentType: 'monument_cairn',
    monumentName: 'Stonehenge Hearth Circle',
    requirements: { pop: 0, food: 0, wood: 0, ore: 0 },
  },
  BRONZE: {
    id: 2,
    name: 'Bronze Age',
    icon: '🛡️',
    color: '#d97706',
    doctrine: 'shield_wall',
    description: 'Forges burn hot; organized barracks and granaries emerge.',
    monumentType: 'monument_pyramid',
    monumentName: 'Great Pyramidal Shrine',
    requirements: { pop: 6, food: 25, wood: 25, ore: 8, workshops: 1 },
  },
  CLASSICAL: {
    id: 3,
    name: 'Classical Era',
    icon: '🏛️',
    color: '#38bdf8',
    doctrine: 'combined_arms',
    description: 'Philosophers, paved roads, grand temples, and civic order.',
    monumentType: 'monument_colosseum',
    monumentName: 'Colosseum of Champions',
    requirements: { pop: 9, food: 45, wood: 45, ore: 20, buildings: 3 },
  },
  IMPERIAL: {
    id: 4,
    name: 'Imperial Age',
    icon: '👑',
    color: '#eab308',
    doctrine: 'imperial_legion',
    description: 'Dominant empire with imperial legions, grand monuments, and statecraft.',
    monumentType: 'monument_citadel',
    monumentName: 'Grand Imperial Citadel',
    requirements: { pop: 12, food: 70, wood: 70, ore: 35, buildings: 5 },
  },
  INDUSTRIAL: {
    id: 5,
    name: 'Industrial & Gunpowder Era',
    icon: '⚙️',
    color: '#f97316',
    doctrine: 'musket_line',
    description: 'Black powder volleys, field cannons, ironworks, and mechanized logistics.',
    monumentType: 'monument_foundry',
    monumentName: 'Grand Iron Foundry Bastion',
    requirements: { pop: 15, food: 95, wood: 95, ore: 50, buildings: 6 },
  },
  MODERN: {
    id: 6,
    name: 'Modern Tactical Era',
    icon: '🚀',
    color: '#06b6d4',
    doctrine: 'modern_fireteam',
    description: 'Armored tanks, tactical strike aircraft, precision infantry, and atomic deterrence.',
    monumentType: 'monument_monolith',
    monumentName: 'Tactical Sky-Spire Monolith',
    requirements: { pop: 19, food: 120, wood: 110, ore: 75, buildings: 7 },
  },
  NUCLEAR: {
    id: 7,
    name: 'Nuclear Age',
    icon: '☢️',
    color: '#84cc16',
    doctrine: 'nuclear_total_war',
    description: 'Heavy battle tanks, supersonic bombers, rocket artillery, and last-resort atomic arsenals.',
    monumentType: 'monument_atomic_dome',
    monumentName: 'Orbital & Atomic Complex',
    requirements: { pop: 24, food: 145, wood: 125, ore: 90, buildings: 8 },
  },
};

export const WONDER_CATALOG = {
  ancestral_cairn: {
    key: 'ancestral_cairn',
    name: 'Stonehenge Hearth Circle',
    icon: '🪨',
    eraId: 1,
    buildingType: 'monument_cairn',
    buffKey: 'food_yield',
    buffLabel: '+15% harvest & civic resilience',
  },
  great_lighthouse: {
    key: 'great_lighthouse',
    name: 'Great Maritime Lighthouse',
    icon: '🗼',
    eraId: 2,
    buildingType: 'monument_pyramid',
    buffKey: 'trade_yield',
    buffLabel: '+30% trade caravan & barge yield',
  },
  colosseum_champions: {
    key: 'colosseum_champions',
    name: 'Colosseum of Champions',
    icon: '🏟️',
    eraId: 3,
    buildingType: 'monument_colosseum',
    buffKey: 'combat_morale',
    buffLabel: '+15 warband morale & swift recovery',
  },
  grand_citadel: {
    key: 'grand_citadel',
    name: 'Grand Imperial Citadel',
    icon: '🏰',
    eraId: 4,
    buildingType: 'monument_citadel',
    buffKey: 'siege_defense',
    buffLabel: '+35% siege wall fortification',
  },
  grand_foundry: {
    key: 'grand_foundry',
    name: 'Grand Iron Foundry Bastion',
    icon: '⚒️',
    eraId: 5,
    buildingType: 'monument_foundry',
    buffKey: 'forge_output',
    buffLabel: '+35% armory output & metallurgy',
  },
  atomic_reactor: {
    key: 'atomic_reactor',
    name: 'Atomic Reactor Complex',
    icon: '⚛️',
    eraId: 6,
    buildingType: 'monument_monolith',
    buffKey: 'nuclear_enrichment',
    buffLabel: '+60% nuclear warhead enrichment rate',
  },
  orbital_deterrence: {
    key: 'orbital_deterrence',
    name: 'Orbital & Atomic Deterrence Array',
    icon: '🛰️',
    eraId: 7,
    buildingType: 'monument_atomic_dome',
    buffKey: 'atomic_deterrence',
    buffLabel: '+2 max warheads, +20% air interception & fallout shielding',
  },
};

export const WONDER_BY_ERA = {
  1: WONDER_CATALOG.ancestral_cairn,
  2: WONDER_CATALOG.great_lighthouse,
  3: WONDER_CATALOG.colosseum_champions,
  4: WONDER_CATALOG.grand_citadel,
  5: WONDER_CATALOG.grand_foundry,
  6: WONDER_CATALOG.atomic_reactor,
  7: WONDER_CATALOG.orbital_deterrence,
};

export class CivilizationAgeSystem {
  constructor(simulation) {
    this.sim = simulation;
    // Map of settlementId -> { ageId, ageName, monumentId, progress, perks: [] }
    this.settlementAges = new Map();
    // Map of settlementId -> { unlocked, progress, warheads, maxWarheads, totalStrikes, lastStrikeTick, doctrine }
    this.nuclearPrograms = new Map();
    // Map of settlementId -> active Cultural Wonder mega-project state
    this.wonders = new Map();
    // Map of settlementId -> Set/Array of completed wonder keys for stacked regional buffs
    this.completedWonders = new Map();
    // Map of settlementId -> Array of persistent heritage monument records across eras
    this.heritageMonuments = new Map();
    this.lastEvaluationTick = 0;
  }

  getNuclearProgram(settlementId) {
    let prog = this.nuclearPrograms.get(settlementId);
    if (!prog) {
      prog = {
        unlocked: false,
        progress: 0,
        warheads: 0,
        maxWarheads: 3,
        totalStrikes: 0,
        lastStrikeTick: -999,
        doctrine: 'deterrence',
      };
      this.nuclearPrograms.set(settlementId, prog);
    }
    return prog;
  }

  getSettlementAge(settlementId) {
    let data = this.settlementAges.get(settlementId);
    if (!data) {
      data = {
        ageId: 1,
        ageName: 'Tribal Era',
        icon: '🏕️',
        color: '#b45309',
        advancedAtTick: 0,
        monumentBuilt: false,
        monumentBuildingId: null,
      };
      this.settlementAges.set(settlementId, data);
    }
    return data;
  }

  setSettlementAge(settlementId, ageId, unlockNuclear = false) {
    const data = this.getSettlementAge(settlementId);
    const ageConfig = Object.values(CIVILIZATION_AGES).find(a => a.id === ageId) || CIVILIZATION_AGES.TRIBAL;
    data.ageId = ageConfig.id;
    data.ageName = ageConfig.name;
    data.icon = ageConfig.icon;
    data.color = ageConfig.color;
    data.advancedAtTick = this.sim?.clock?.tick ?? 0;
    if (data.ageId >= 6 && unlockNuclear) {
      const prog = this.getNuclearProgram(settlementId);
      prog.unlocked = true;
      if (data.ageId >= 7) {
        prog.maxWarheads = Math.max(prog.maxWarheads || 3, 5);
      }
    }
    return data;
  }

  getEraCombatDoctrine(settlementId) {
    const data = this.getSettlementAge(settlementId);
    const ageObj = Object.values(CIVILIZATION_AGES).find(a => a.id === data.ageId) || CIVILIZATION_AGES.TRIBAL;
    return {
      ageId: ageObj.id,
      ageName: ageObj.name,
      doctrine: ageObj.doctrine || 'skirmish',
    };
  }

  getDominantAge() {
    if (!this.sim || !this.sim.settlementSystem || this.settlementAges.size === 0) {
      return {
        id: CIVILIZATION_AGES.TRIBAL.id,
        name: CIVILIZATION_AGES.TRIBAL.name,
        icon: CIVILIZATION_AGES.TRIBAL.icon,
        color: CIVILIZATION_AGES.TRIBAL.color,
      };
    }

    let highestAgeId = 1;
    let dominantAgeObj = CIVILIZATION_AGES.TRIBAL;

    for (const data of this.settlementAges.values()) {
      if (data.ageId > highestAgeId) {
        highestAgeId = data.ageId;
        const found = Object.values(CIVILIZATION_AGES).find(a => a.id === data.ageId);
        if (found) dominantAgeObj = found;
      }
    }

    return {
      id: dominantAgeObj.id,
      name: dominantAgeObj.name,
      icon: dominantAgeObj.icon,
      color: dominantAgeObj.color,
    };
  }

  getWonderState(settlementId) {
    return this.wonders.get(settlementId) || null;
  }

  getCompletedWonders(settlementId) {
    return this.completedWonders.get(settlementId) || [];
  }

  getWonderBuffs(settlementId) {
    const completed = this.getCompletedWonders(settlementId);
    const active = this.getWonderState(settlementId);
    const keys = new Set(completed);
    if (active && active.complete) keys.add(active.key);
    return {
      tradeMultiplier: keys.has('great_lighthouse') ? 1.3 : 1.0,
      moraleBonus: keys.has('colosseum_champions') ? 15 : 0,
      defenseMultiplier: keys.has('grand_citadel') ? 1.35 : 1.0,
      forgeMultiplier: keys.has('grand_foundry') ? 1.35 : 1.0,
      nuclearEnrichMultiplier: keys.has('atomic_reactor') ? 1.6 : 1.0,
      foodMultiplier: keys.has('ancestral_cairn') ? 1.15 : 1.0,
      maxWarheadsBonus: keys.has('orbital_deterrence') ? 2 : 0,
      airDefenseBonus: keys.has('orbital_deterrence') ? 0.2 : 0,
      completedKeys: Array.from(keys),
    };
  }

  registerHeritageMonument(settlementId, building, eraId = null, eraName = null, tick = null) {
    if (settlementId == null || !building) return null;
    const resolvedEraId = eraId ?? building.builtInEra ?? this.getSettlementAge(settlementId)?.ageId ?? 1;
    const ageObj = Object.values(CIVILIZATION_AGES).find(a => a.id === resolvedEraId) || CIVILIZATION_AGES.TRIBAL;
    let list = this.heritageMonuments.get(settlementId);
    if (!list) {
      list = [];
      this.heritageMonuments.set(settlementId, list);
    }
    const existing = list.find(m => m.buildingId === building.id);
    if (existing) {
      existing.name = building.customName || existing.name;
      return existing;
    }
    const entry = {
      buildingId: building.id,
      eraId: resolvedEraId,
      eraName: eraName || ageObj.name,
      icon: ageObj.icon,
      buildingType: building.buildingType,
      name: building.customName || ageObj.monumentName || 'Monument Landmark',
      builtTick: tick ?? (this.sim?.clock?.tick ?? 0),
    };
    list.push(entry);
    return entry;
  }

  getHeritageMonuments(settlementId) {
    const currentEra = this.getSettlementAge(settlementId)?.ageId || 1;
    const records = this.heritageMonuments.get(settlementId) || [];
    const seenIds = new Set();
    const result = [];
    const allBuildings = Array.isArray(this.sim?.buildings) ? this.sim.buildings : [];

    for (const rec of records) {
      if (!rec || seenIds.has(rec.buildingId)) continue;
      seenIds.add(rec.buildingId);
      const b = allBuildings.find(x => x && x.id === rec.buildingId);
      const bEra = b?.builtInEra ?? rec.eraId ?? 1;
      const ageObj = Object.values(CIVILIZATION_AGES).find(a => a.id === bEra);
      const intact = b ? !b.isRuined : false;
      result.push({
        buildingId: rec.buildingId,
        eraId: bEra,
        eraName: rec.eraName || ageObj?.name || `Era ${bEra}`,
        icon: rec.icon || ageObj?.icon || '🏛️',
        buildingType: b?.buildingType || rec.buildingType,
        name: b?.customName || rec.name,
        complete: b ? Boolean(b.complete) : false,
        intact,
        health: b ? Math.round(b.health ?? 0) : 0,
        maxHealth: b ? Math.round(b.maxHealth ?? 500) : 500,
        level: b?.level || 1,
        survivedEras: Math.max(0, currentEra - bEra),
        survivedToModern: currentEra >= 6 && bEra <= 4 && intact,
      });
    }

    // Also include any untracked monument buildings owned by this settlement
    for (const b of allBuildings) {
      if (!b || b.settlementId !== settlementId || seenIds.has(b.id)) continue;
      const isMon = (typeof b.isMonument === 'function' && b.isMonument()) || String(b.buildingType || '').startsWith('monument_');
      if (!isMon) continue;
      seenIds.add(b.id);
      const bEra = b.builtInEra ?? 1;
      const ageObj = Object.values(CIVILIZATION_AGES).find(a => a.id === bEra);
      const intact = !b.isRuined;
      result.push({
        buildingId: b.id,
        eraId: bEra,
        eraName: ageObj?.name || `Era ${bEra}`,
        icon: ageObj?.icon || '🏛️',
        buildingType: b.buildingType,
        name: b.customName || ageObj?.monumentName || b.buildingType,
        complete: Boolean(b.complete),
        intact,
        health: Math.round(b.health ?? 0),
        maxHealth: Math.round(b.maxHealth ?? 500),
        level: b.level || 1,
        survivedEras: Math.max(0, currentEra - bEra),
        survivedToModern: currentEra >= 6 && bEra <= 4 && intact,
      });
    }

    result.sort((a, b) => (a.eraId - b.eraId) || (a.buildingId - b.buildingId));
    return result;
  }

  commissionWonder(settlementId, wonderKey = null, tick = null) {
    const s = this.sim?.settlementSystem?.settlements?.get(settlementId);
    if (!s || s.ruined) return null;
    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    const ageId = this.getSettlementAge(settlementId).ageId || 1;
    const def = (wonderKey && WONDER_CATALOG[wonderKey]) ? WONDER_CATALOG[wonderKey] : (WONDER_BY_ERA[ageId] || WONDER_CATALOG.great_lighthouse);
    const existing = this.wonders.get(settlementId);
    if (existing && existing.key === def.key && !existing.complete) {
      return existing;
    }
    const wonder = {
      key: def.key,
      name: def.name,
      icon: def.icon,
      eraId: def.eraId,
      buildingType: def.buildingType,
      buffKey: def.buffKey,
      buffLabel: def.buffLabel,
      stage: 1,
      maxStage: 3,
      progress: 0,
      complete: false,
      startedAtTick: now,
      completedAtTick: null,
      buildingId: this.getSettlementAge(settlementId).monumentBuildingId || null,
    };
    this.wonders.set(settlementId, wonder);
    this.sim?.eventBus?.emit('WONDER_SURVEYED', {
      settlementId,
      settlementName: s.name,
      wonderKey: wonder.key,
      wonderName: wonder.name,
      buffLabel: wonder.buffLabel,
      stage: 1,
      tick: now,
    });
    return wonder;
  }

  advanceWonderProgress(settlementId, delta = 12, tick = null) {
    const s = this.sim?.settlementSystem?.settlements?.get(settlementId);
    if (!s || s.ruined) return null;
    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    let wonder = this.wonders.get(settlementId);
    if (!wonder) {
      wonder = this.commissionWonder(settlementId, null, now);
    }
    if (!wonder || wonder.complete) return wonder;

    const masonsMult = this.sim?.espionageSystem?.getConstructionMultiplier?.(settlementId) || 1.0;
    wonder.progress += Math.max(1, Math.round(delta * masonsMult));

    while (wonder.progress >= 100 && !wonder.complete) {
      wonder.progress -= 100;
      if (wonder.stage < wonder.maxStage) {
        wonder.stage += 1;
        this.sim?.eventBus?.emit('WONDER_STAGE_COMPLETED', {
          settlementId,
          settlementName: s.name,
          wonderKey: wonder.key,
          wonderName: wonder.name,
          stage: wonder.stage,
          maxStage: wonder.maxStage,
          tick: now,
        });
      } else {
        wonder.progress = 100;
        wonder.complete = true;
        wonder.completedAtTick = now;
        const list = this.completedWonders.get(settlementId) || [];
        if (!list.includes(wonder.key)) {
          list.push(wonder.key);
          this.completedWonders.set(settlementId, list);
        }
        if (wonder.buildingId && Array.isArray(this.sim?.buildings)) {
          const b = this.sim.buildings.find(x => x && x.id === wonder.buildingId);
          if (b) {
            b.complete = true;
            b.constructionProgress = 100;
            b.customName = wonder.name;
          }
        }
        this.sim?.eventBus?.emit('WONDER_COMPLETED', {
          settlementId,
          settlementName: s.name,
          wonderKey: wonder.key,
          wonderName: wonder.name,
          buffLabel: wonder.buffLabel,
          tick: now,
        });
        if (this.sim?.diplomacySystem?.recordDiplomaticEvent) {
          this.sim.diplomacySystem.recordDiplomaticEvent({
            tick: now,
            type: 'wonder',
            outcome: 'completed',
            title: `${wonder.icon} Wonder Completed: ${wonder.name}`,
            what: `${s.name} finished Stage 3 of ${wonder.name}, unlocking ${wonder.buffLabel}.`,
            why: 'Multi-stage civic labor and guild engineering reached completion.',
            drivers: [`Buff Active: ${wonder.buffLabel}`, `Settlement Pop ${s.population || 0}`],
            actors: [settlementId],
            actorNames: [s.name],
            x: s.center?.x ?? null,
            y: s.center?.y ?? null,
          });
        }
      }
    }
    return wonder;
  }

  getSettlementAgeSummary(settlementId) {
    const data = this.getSettlementAge(settlementId);
    const ageConfig = Object.values(CIVILIZATION_AGES).find(a => a.id === data.ageId) || CIVILIZATION_AGES.TRIBAL;

    let monumentName = ageConfig.monumentName;
    let monumentProgress = 0;
    let hasMonument = false;

    if (data.monumentBuildingId && this.sim.buildings) {
      const b = this.sim.buildings.find(b => b.id === data.monumentBuildingId);
      if (b) {
        monumentName = b.customName || monumentName;
        monumentProgress = Math.round(b.constructionProgress || 0);
        hasMonument = !!b.complete;
      }
    }

    const nuclearProgram = this.getNuclearProgram(settlementId);
    const nuclearInfra = this.getNuclearInfrastructureStatus(settlementId);
    const wonder = this.getWonderState(settlementId);
    const wonderBuffs = this.getWonderBuffs(settlementId);
    const heritageMonuments = this.getHeritageMonuments(settlementId);

    return {
      id: ageConfig.id,
      name: ageConfig.name,
      icon: ageConfig.icon,
      color: ageConfig.color,
      doctrine: ageConfig.doctrine,
      description: ageConfig.description,
      monumentName,
      monumentProgress,
      hasMonument,
      heritageMonuments,
      nuclearProgram: { ...nuclearProgram, infra: nuclearInfra },
      nuclearInfra,
      wonder: wonder ? { ...wonder } : null,
      wonderBuffs,
    };
  }

  getNuclearInfrastructureStatus(settlementId) {
    const settlement = this.sim?.settlementSystem?.settlements?.get(settlementId);
    const seen = new Set();
    let factoryCount = 0;
    let labCount = 0;
    let plantCount = 0;
    let siloCount = 0;

    const inspectList = (list) => {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (!b || seen.has(b.id)) continue;
        seen.add(b.id);
        if (b.settlementId != null && b.settlementId !== settlementId) continue;
        if (b.isRuined || (b.health !== undefined && b.health <= 0)) continue;
        if (!b.complete && (b.constructionProgress || 0) < 100) continue;
        const t = b.buildingType || b.type;
        if (t === 'factory') factoryCount++;
        else if (t === 'research_lab') labCount++;
        else if (t === 'nuclear_plant') plantCount++;
        else if (t === 'missile_silo') siloCount++;
      }
    };

    inspectList(settlement?.buildings);
    if (Array.isArray(this.sim?.buildings)) {
      for (let i = 0; i < this.sim.buildings.length; i++) {
        const b = this.sim.buildings[i];
        if (b && b.settlementId === settlementId && !seen.has(b.id)) {
          seen.add(b.id);
          if (b.isRuined || (b.health !== undefined && b.health <= 0)) continue;
          if (!b.complete && (b.constructionProgress || 0) < 100) continue;
          const t = b.buildingType || b.type;
          if (t === 'factory') factoryCount++;
          else if (t === 'research_lab') labCount++;
          else if (t === 'nuclear_plant') plantCount++;
          else if (t === 'missile_silo') siloCount++;
        }
      }
    }

    const hasReactorWonder = this.getWonderBuffs(settlementId).completedKeys.includes('atomic_reactor');
    const hasFactory = factoryCount > 0;
    const hasResearchLab = labCount > 0;
    const hasNuclearPlant = plantCount > 0 || hasReactorWonder;
    const hasMissileSilo = siloCount > 0;
    const canEnrich = hasFactory && hasNuclearPlant;
    const canLaunch = hasNuclearPlant && (hasMissileSilo || hasFactory);

    return {
      hasFactory,
      hasResearchLab,
      hasNuclearPlant,
      hasMissileSilo,
      factoryCount,
      labCount,
      plantCount,
      siloCount,
      canEnrich,
      canLaunch,
    };
  }

  update(tick) {
    if (!this.sim || !this.sim.settlementSystem) return;

    // Evaluate age milestones every 20 ticks
    if (tick - this.lastEvaluationTick < 20) return;
    this.lastEvaluationTick = tick;

    const settlements = this.sim.settlementSystem.settlements;
    if (!settlements) return;

    for (const [sId, settlement] of settlements) {
      if (!settlement || settlement.ruined) continue;
      const current = this.getSettlementAge(sId);
      const pop = settlement.population || settlement.agentIds?.size || 0;
      const stock = settlement.stockpile || { food: 0, wood: 0, ore: 0 };
      const totalFood = (stock.food || 0) + (stock.bread || 0);
      const totalWood = (stock.wood || 0) + (stock.plank || 0);
      const totalOre = (stock.ore || 0);
      const buildingsCount = settlement.buildings ? settlement.buildings.filter(b => b.complete && !b.isRuined).length : 0;
      const workshopCount = settlement.buildings ? settlement.buildings.filter(b => b.complete && !b.isRuined && b.buildingType === 'workshop').length : 0;

      const libBonus = this.sim.getSettlementBuildingBonus?.(sId, 'library') || { count: 0, maxLevel: 0, power: 0 };
      const labBonus = this.sim.getSettlementBuildingBonus?.(sId, 'research_lab') || { count: 0, maxLevel: 0, power: 0 };
      const plantBonus = this.sim.getSettlementBuildingBonus?.(sId, 'nuclear_plant') || { count: 0, maxLevel: 0, power: 0 };
      const siloBonus = this.sim.getSettlementBuildingBonus?.(sId, 'missile_silo') || { count: 0, maxLevel: 0, power: 0 };
      const researchCostMult = Math.max(0.68, 1 - Math.min(0.24, libBonus.power * 0.1) - Math.min(0.12, labBonus.power * 0.06));
      const effectiveBuildingsCount = buildingsCount + (libBonus.maxLevel >= 2 ? 1 : 0);

      // Check progression to next age
      let nextAge = null;
      if (current.ageId === 1) {
        const req = CIVILIZATION_AGES.BRONZE.requirements;
        if (pop >= req.pop && totalFood >= req.food && totalWood >= req.wood && totalOre >= req.ore && workshopCount >= req.workshops) {
          nextAge = CIVILIZATION_AGES.BRONZE;
        }
      } else if (current.ageId === 2) {
        const req = CIVILIZATION_AGES.CLASSICAL.requirements;
        if (pop >= req.pop && totalFood >= req.food && totalWood >= req.wood && totalOre >= req.ore && buildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.CLASSICAL;
        }
      } else if (current.ageId === 3) {
        const req = CIVILIZATION_AGES.IMPERIAL.requirements;
        if (pop >= req.pop && totalFood >= Math.round(req.food * researchCostMult) && totalWood >= Math.round(req.wood * researchCostMult) && totalOre >= Math.round(req.ore * researchCostMult) && effectiveBuildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.IMPERIAL;
        }
      } else if (current.ageId === 4) {
        const req = CIVILIZATION_AGES.INDUSTRIAL.requirements;
        if (pop >= req.pop && totalFood >= Math.round(req.food * researchCostMult) && totalWood >= Math.round(req.wood * researchCostMult) && totalOre >= Math.round(req.ore * researchCostMult) && effectiveBuildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.INDUSTRIAL;
        }
      } else if (current.ageId === 5) {
        const req = CIVILIZATION_AGES.MODERN.requirements;
        if (pop >= req.pop && totalFood >= Math.round(req.food * researchCostMult) && totalWood >= Math.round(req.wood * researchCostMult) && totalOre >= Math.round(req.ore * researchCostMult) && effectiveBuildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.MODERN;
        }
      } else if (current.ageId === 6) {
        const req = CIVILIZATION_AGES.NUCLEAR.requirements;
        const prog = this.getNuclearProgram(sId);
        const hasReactor = this.getWonderBuffs(sId).completedKeys.includes('atomic_reactor');
        if ((pop >= req.pop && totalFood >= Math.round(req.food * researchCostMult) && totalWood >= Math.round(req.wood * researchCostMult) && totalOre >= Math.round(req.ore * researchCostMult) && effectiveBuildingsCount >= req.buildings) ||
            (hasReactor && pop >= 18 && effectiveBuildingsCount >= 7) ||
            (prog.warheads >= 2 && pop >= 20 && effectiveBuildingsCount >= 7)) {
          nextAge = CIVILIZATION_AGES.NUCLEAR;
        }
      }

      if (nextAge) {
        current.ageId = nextAge.id;
        current.ageName = nextAge.name;
        current.icon = nextAge.icon;
        current.color = nextAge.color;
        current.advancedAtTick = tick;

        // Emit advancement event
        this.sim.eventBus.emit('CIVILIZATION_AGE_ADVANCED', {
          settlementId: sId,
          settlementName: settlement.name,
          age: nextAge.name,
          ageId: nextAge.id,
          icon: nextAge.icon,
          tick,
        });

        // Record Era transition milestone on living citizens of the settlement (deterministic id order)
        if (settlement.agentIds && typeof this.sim._agentById === 'function') {
          const citizenIds = Array.from(settlement.agentIds).sort((a, b) => a - b);
          for (const cid of citizenIds) {
            const cit = this.sim._agentById(cid);
            if (cit && cit.alive && (cit.age >= 12 || cit.isMonarch) && typeof cit.addLifeEvent === 'function') {
              cit.addLifeEvent(
                'ERA_DAWN',
                `Witnessed ${settlement.name} enter the ${nextAge.name}`,
                tick,
                nextAge.icon || '🌟',
                true
              );
            }
          }
        }

        // Place new Era's grand monument alongside surviving earlier-era heritage structures
        this.placeMonumentBlueprint(settlement, nextAge);
        const eraWonder = WONDER_BY_ERA[nextAge.id];
        if (eraWonder) {
          this.commissionWonder(sId, eraWonder.key, tick);
        }
      }

      // Ensure even Era 1 Tribal towns raise their foundational Ancestral Hearth Circle once established
      if (current.ageId === 1 && pop >= 5) {
        const hasTribalMonument = (settlement.buildings || []).some(
          b => b && !b.isRuined && b.buildingType === CIVILIZATION_AGES.TRIBAL.monumentType
        );
        if (!hasTribalMonument) {
          this.placeMonumentBlueprint(settlement, CIVILIZATION_AGES.TRIBAL);
        }
      }

      // Heritage preservation & restoration: active cities maintain and gently repair weathered landmarks
      if (tick % 40 === 0 && pop >= 4 && Array.isArray(settlement.buildings)) {
        for (const mb of settlement.buildings) {
          if (!mb) continue;
          const isMon = (typeof mb.isMonument === 'function' && mb.isMonument()) || String(mb.buildingType || '').startsWith('monument_');
          if (!isMon) continue;
          if (!mb.isRuined && mb.complete && mb.health < (mb.maxHealth || 500)) {
            mb.health = Math.min(mb.maxHealth || 500, (mb.health || 0) + 4);
          } else if (mb.isRuined && mb.ruinedAtTick != null && (tick - mb.ruinedAtTick) >= 240 && pop >= 8) {
            mb.isRuined = false;
            mb.ruinedAtTick = null;
            mb.health = Math.round((mb.maxHealth || 500) * 0.5);
            mb.complete = true;
            mb.constructionProgress = 100;
          }
        }
      }

      // Advance active Cultural Wonder construction deterministically
      const activeWonder = this.wonders.get(sId);
      if (activeWonder && !activeWonder.complete && pop >= 4) {
        const academicBonus = Math.min(6, libBonus.maxLevel * 2) + Math.min(5, labBonus.maxLevel * 2);
        const laborStep = Math.min(24, 4 + Math.floor(pop * 0.4) + (workshopCount * 3) + (totalWood >= 15 ? 2 : 0) + academicBonus);
        this.advanceWonderProgress(sId, laborStep, tick);
      } else if (!activeWonder && pop >= 5) {
        const eraWonder = WONDER_BY_ERA[current.ageId] || WONDER_CATALOG.great_lighthouse;
        this.commissionWonder(sId, eraWonder.key, tick);
      }

      // Modern & Nuclear Era Enrichment & Warhead Stockpile
      // Warheads require real heavy industrial & atomic infrastructure:
      // a completed Factory + Nuclear Power Plant (+ Research Lab / Missile Silo bonuses) & Ore.
      if (current.ageId >= 6) {
        const prog = this.getNuclearProgram(sId);
        const buffs = this.getWonderBuffs(sId);
        const infra = this.getNuclearInfrastructureStatus(sId);
        const bell = settlement.culture?.values?.belligerence ?? 0.5;
        prog.doctrine = bell >= 0.88 ? 'first_strike' : 'deterrence';
        const siloBonusCap = (siloBonus.maxLevel > 0 ? (1 + siloBonus.maxLevel) : 0) + (buffs.maxWarheadsBonus || 0);
        if (current.ageId >= 7) {
          prog.maxWarheads = Math.max(prog.maxWarheads || 3, 5 + siloBonusCap);
        } else if (infra.hasMissileSilo) {
          prog.maxWarheads = Math.max(prog.maxWarheads || 3, 2 + siloBonusCap);
        }
        if (!prog.unlocked) {
          prog.unlocked = true;
          this.sim.eventBus.emit('NUCLEAR_PROGRAM_UNLOCKED', {
            settlementId: sId,
            settlementName: settlement.name,
            doctrine: prog.doctrine,
            tick,
          });
        }
        if (prog.warheads < prog.maxWarheads && infra.canEnrich && (totalOre >= 10 || (settlement.stockpile?.uranium || 0) > 0)) {
          const labStep = labBonus.maxLevel > 0 ? (3 + labBonus.maxLevel * 3) : 0;
          const plantStep = plantBonus.maxLevel > 1 ? ((plantBonus.maxLevel - 1) * 4) : 0;
          const siloStep = siloBonus.maxLevel > 0 ? (1 + siloBonus.maxLevel * 2) : 0;
          const hasUranium = (settlement.stockpile?.uranium || 0) > 0;
          const uraniumStep = hasUranium ? 7 : 0;
          const baseStep = 8 +
            labStep +
            plantStep +
            siloStep +
            uraniumStep +
            (totalOre >= 30 ? 4 : 0) +
            (current.ageId >= 7 ? 4 : 0);
          const step = Math.round(baseStep * (buffs.nuclearEnrichMultiplier || 1.0));
          prog.progress += step;
          if (hasUranium && settlement.stockpile) {
            settlement.stockpile.uranium = Math.max(0, (settlement.stockpile.uranium || 0) - 1);
          }
          if (prog.progress >= 100) {
            prog.progress -= 100;
            if (settlement.stockpile) {
              settlement.stockpile.ore = Math.max(0, (settlement.stockpile.ore || 0) - 10);
            }
            prog.warheads += 1;
            this.sim.eventBus.emit('NUCLEAR_WARHEAD_BUILT', {
              settlementId: sId,
              settlementName: settlement.name,
              warheads: prog.warheads,
              doctrine: prog.doctrine,
              tick,
            });
          }
        }
      }
    }
  }

  placeMonumentBlueprint(settlement, ageConfig) {
    if (!settlement || !settlement.center) return null;

    const monumentType = ageConfig.monumentType || 'monument_pyramid';
    const mName = ageConfig.monumentName || 'Monument Wonder';
    const eraId = ageConfig.id || this.getSettlementAge(settlement.id)?.ageId || 1;

    // Avoid duplicating an already-built monument of this same Era & type
    const existing = (this.sim?.buildings || []).find(
      b => b && !b.isRuined && b.settlementId === settlement.id && b.buildingType === monumentType && (b.builtInEra ?? eraId) === eraId
    );
    if (existing) {
      this.registerHeritageMonument(settlement.id, existing, eraId, ageConfig.name);
      const current = this.getSettlementAge(settlement.id);
      current.monumentBuildingId = existing.id;
      return existing;
    }

    // Find clear tile near center, expanding outward as older monuments and districts fill the core
    const cx = Math.floor(settlement.center.x);
    const cy = Math.floor(settlement.center.y);
    const w = this.sim.world;

    let targetX = Math.max(3, Math.min(w.width - 4, cx + 2));
    let targetY = Math.max(3, Math.min(w.height - 4, cy + 2));
    let found = false;

    for (let r = 2; r <= 14 && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 3 && tx < w.width - 3 && ty >= 3 && ty < w.height - 3 &&
              w.isWalkable(tx, ty) &&
              !w.getEntitiesAt(tx, ty).some(e => e.type === 'building') &&
              !this.sim?.fortificationSystem?.getSegmentAt?.(tx, ty)) {
            targetX = tx;
            targetY = ty;
            found = true;
          }
        }
      }
    }

    const b = new Building(targetX, targetY, monumentType, this.sim.idGen, settlement.id, settlement.factionId ?? null);
    b.constructionProgress = 0;
    b.complete = false;
    b.builtInEra = eraId;
    b.isHeritage = true;
    b.customName = mName;
    this.sim.buildings.push(b);
    this.sim.world.addToSpatialIndex(targetX, targetY, b);
    this.sim.world.entityRegistry?.set?.(b.id, b);
    if (!settlement.buildings) settlement.buildings = [];
    settlement.buildings.push(b);

    const current = this.getSettlementAge(settlement.id);
    current.monumentBuildingId = b.id;
    this.registerHeritageMonument(settlement.id, b, eraId, ageConfig.name);

    this.sim.eventBus.emit('MONUMENT_SURVEYED', {
      settlementId: settlement.id,
      settlementName: settlement.name,
      monumentName: mName,
      monumentType,
      eraId,
      x: targetX,
      y: targetY,
    });
    return b;
  }

  serialize() {
    return {
      lastEvaluationTick: this.lastEvaluationTick,
      entries: Array.from(this.settlementAges.entries()),
      nuclearPrograms: Array.from(this.nuclearPrograms.entries()).map(([id, p]) => [id, { ...p }]),
      wonders: Array.from(this.wonders.entries()).map(([id, w]) => [id, { ...w }]),
      completedWonders: Array.from(this.completedWonders.entries()).map(([id, arr]) => [id, [...arr]]),
      heritageMonuments: Array.from(this.heritageMonuments.entries()).map(([id, arr]) => [id, arr.map(m => ({ ...m }))]),
    };
  }

  static deserialize(data, sim) {
    const sys = new CivilizationAgeSystem(sim);
    if (Array.isArray(data)) {
      sys.settlementAges = new Map(data);
    } else if (data && Array.isArray(data.entries)) {
      sys.lastEvaluationTick = data.lastEvaluationTick || 0;
      sys.settlementAges = new Map(data.entries);
      if (Array.isArray(data.nuclearPrograms)) {
        sys.nuclearPrograms = new Map(data.nuclearPrograms.map(([id, p]) => [id, { ...p }]));
      }
      if (Array.isArray(data.wonders)) {
        sys.wonders = new Map(data.wonders.map(([id, w]) => [id, { ...w }]));
      }
      if (Array.isArray(data.completedWonders)) {
        sys.completedWonders = new Map(data.completedWonders.map(([id, arr]) => [id, [...arr]]));
      }
      if (Array.isArray(data.heritageMonuments)) {
        sys.heritageMonuments = new Map(data.heritageMonuments.map(([id, arr]) => [id, arr.map(m => ({ ...m }))]));
      }
    }
    return sys;
  }
}
