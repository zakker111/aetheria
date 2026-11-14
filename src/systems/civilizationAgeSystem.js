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
    monumentType: 'monument_pyramid',
    monumentName: 'Ancestral Stone Cairn',
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
    requirements: { pop: 7, food: 30, wood: 30, ore: 10, workshops: 1 },
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
    requirements: { pop: 11, food: 60, wood: 60, ore: 28, buildings: 4 },
  },
  IMPERIAL: {
    id: 4,
    name: 'Imperial Age',
    icon: '👑',
    color: '#eab308',
    doctrine: 'imperial_legion',
    description: 'Dominant empire with imperial legions, grand monuments, and statecraft.',
    monumentType: 'monument_monolith',
    monumentName: 'Astronomical Obelisk',
    requirements: { pop: 16, food: 100, wood: 100, ore: 50, buildings: 6 },
  },
  INDUSTRIAL: {
    id: 5,
    name: 'Industrial & Gunpowder Era',
    icon: '⚙️',
    color: '#f97316',
    doctrine: 'musket_line',
    description: 'Black powder volleys, field cannons, ironworks, and mechanized logistics.',
    monumentType: 'monument_monolith',
    monumentName: 'Grand Iron Foundry Bastion',
    requirements: { pop: 22, food: 140, wood: 140, ore: 75, buildings: 7 },
  },
  MODERN: {
    id: 6,
    name: 'Modern Tactical Era',
    icon: '🚀',
    color: '#06b6d4',
    doctrine: 'modern_fireteam',
    description: 'Precision infantry squads, long-range artillery support, and sprawling metropolises.',
    monumentType: 'monument_monolith',
    monumentName: 'Tactical Command Citadel',
    requirements: { pop: 28, food: 190, wood: 170, ore: 110, buildings: 9 },
  },
};

export class CivilizationAgeSystem {
  constructor(simulation) {
    this.sim = simulation;
    // Map of settlementId -> { ageId, ageName, monumentId, progress, perks: [] }
    this.settlementAges = new Map();
    this.lastEvaluationTick = 0;
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
        if (pop >= req.pop && totalFood >= req.food && totalWood >= req.wood && totalOre >= req.ore && buildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.IMPERIAL;
        }
      } else if (current.ageId === 4) {
        const req = CIVILIZATION_AGES.INDUSTRIAL.requirements;
        if (pop >= req.pop && totalFood >= req.food && totalWood >= req.wood && totalOre >= req.ore && buildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.INDUSTRIAL;
        }
      } else if (current.ageId === 5) {
        const req = CIVILIZATION_AGES.MODERN.requirements;
        if (pop >= req.pop && totalFood >= req.food && totalWood >= req.wood && totalOre >= req.ore && buildingsCount >= req.buildings) {
          nextAge = CIVILIZATION_AGES.MODERN;
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

        // Place Monument Wonder blueprint near center synchronously & deterministically
        this.placeMonumentBlueprint(settlement, nextAge);
      }
    }
  }

  placeMonumentBlueprint(settlement, ageConfig) {
    if (!settlement || !settlement.center) return;

    const monumentType = ageConfig.monumentType || 'monument_pyramid';
    const mName = ageConfig.monumentName || 'Monument Wonder';

    // Find clear tile near center
    const cx = Math.floor(settlement.center.x);
    const cy = Math.floor(settlement.center.y);
    const w = this.sim.world;

    let targetX = Math.max(2, Math.min(w.width - 3, cx + 2));
    let targetY = Math.max(2, Math.min(w.height - 3, cy + 2));

    for (let r = 2; r <= 6; r++) {
      let found = false;
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 2 && tx < w.width - 2 && ty >= 2 && ty < w.height - 2 &&
              w.isWalkable(tx, ty) && !w.getEntitiesAt(tx, ty).some(e => e.type === 'building')) {
            targetX = tx;
            targetY = ty;
            found = true;
          }
        }
      }
      if (found) break;
    }

    const b = new Building(targetX, targetY, monumentType, this.sim.idGen, settlement.id, settlement.factionId ?? null);
    b.constructionProgress = 0;
    b.complete = false;
    b.customName = mName;
    this.sim.buildings.push(b);
    this.sim.world.addToSpatialIndex(targetX, targetY, b);
    if (!settlement.buildings) settlement.buildings = [];
    settlement.buildings.push(b);

    const current = this.getSettlementAge(settlement.id);
    current.monumentBuildingId = b.id;

    this.sim.eventBus.emit('MONUMENT_SURVEYED', {
      settlementId: settlement.id,
      settlementName: settlement.name,
      monumentName: mName,
      monumentType,
      x: targetX,
      y: targetY,
    });
  }

  serialize() {
    return {
      lastEvaluationTick: this.lastEvaluationTick,
      entries: Array.from(this.settlementAges.entries())
    };
  }

  static deserialize(data, sim) {
    const sys = new CivilizationAgeSystem(sim);
    if (Array.isArray(data)) {
      sys.settlementAges = new Map(data);
    } else if (data && Array.isArray(data.entries)) {
      sys.lastEvaluationTick = data.lastEvaluationTick || 0;
      sys.settlementAges = new Map(data.entries);
    }
    return sys;
  }
}
