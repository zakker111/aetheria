// Building entities (houses, farms, etc.)
import { STORAGE_CAPACITY, BUILDING_METADATA, isMonumentBuildingType } from '../core/constants.js';

export class Building {
  constructor(x, y, buildingType, idGen, settlementId = null, factionId = null) {
    this.id = idGen.next();
    this.type = "building";
    this.x = x;
    this.y = y;
    this.buildingType = buildingType; // "house", "farm", "windmill", "library", etc.
    this.constructionProgress = 0;
    this.complete = false;
    this.ownerId = null;
    this.storage = {};
    // Storage capacity: settlements are limited in how much food/wood/stone/
    // ore/water they can keep — warehouses & upgrades expand this (see STORAGE_CAPACITY).
    this.capacity = 0;
    const BUILDING_HEALTH = {
      castle: 240,
      tower: 160,
      barracks: 150,
      granary: 130,
      warehouse: 150,
      windmill: 120,
      inn: 130,
      library: 145,
      apothecary: 135,
      bank: 175,
      factory: 190,
      research_lab: 160,
      radar_station: 185,
      nuclear_plant: 240,
      missile_silo: 260,
      monument_cairn: 550,
      monument_pyramid: 650,
      monument_colosseum: 720,
      monument_citadel: 800,
      monument_foundry: 850,
      monument_monolith: 900,
      monument_atomic_dome: 1000,
    };
    const baseHp = BUILDING_HEALTH[buildingType] || 100;
    this.baseMaxHealth = baseHp;
    this.health = baseHp;
    this.maxHealth = baseHp;
    this.isRuined = false;
    this.ruinedAtTick = null;
    this.originalType = buildingType;
    const meta = BUILDING_METADATA[buildingType];
    this.level = 1;
    this.maxLevel = meta?.maxLevel || 3;
    this.upgradedAtTick = null;
    this.builtInEra = meta?.minEra || 1;
    this.builtEraName = null;
    this.isHeritage = Boolean(meta?.isMonument || isMonumentBuildingType(buildingType));
    this.customName = null;
    this.builtByAgentId = null;
    this.builtByName = null;
    this.builtYear = null;
    this.contributors = [];
    this.upgradedByAgentId = null;
    this.upgradedByName = null;
    this.upgradeHistory = [];
    this.dedication = null;
    // Apply storage capacity for the building type (drives warehouse demand)
    const cap = STORAGE_CAPACITY[buildingType];
    if (cap) this.capacity = cap;
    // Territorial ownership: buildings belong to a settlement/faction.
    // Only that community's builders work on them directly; friendly
    // settlements may assist (see agent.js build goal filtering).
    this.settlementId = settlementId;
    this.factionId = factionId;
  }

  isMonument() {
    return Boolean(this.isHeritage || isMonumentBuildingType(this.buildingType));
  }

  /**
   * Apply damage while honoring monumental stone/heritage survivability.
   * Heritage monuments resist fires and conventional raids so ancient structures
   * can endure into the Modern & Nuclear Eras unless obliterated at ground zero.
   */
  applyDamage(rawDamage, { cause = 'combat', tick = 0, allowDestruction = true, minFloorRatio = 0 } = {}) {
    if (this.isRuined || !Number.isFinite(rawDamage) || rawDamage <= 0) return false;
    const monument = this.isMonument();
    let effective = rawDamage;
    let floorHp = 0;

    if (monument) {
      if (cause === 'fire') {
        effective = Math.max(0.5, rawDamage * 0.25);
        floorHp = Math.max(floorHp, Math.round((this.maxHealth || 500) * 0.22));
      } else if (cause === 'pillage' || cause === 'collateral') {
        effective = Math.max(1, Math.round(rawDamage * 0.35));
        floorHp = Math.max(floorHp, Math.round((this.maxHealth || 500) * 0.15));
      } else if (cause === 'nuclear_outer') {
        effective = Math.round(rawDamage * 0.72);
        floorHp = Math.max(floorHp, Math.round((this.maxHealth || 500) * 0.14));
      }
    }

    if (minFloorRatio > 0) {
      floorHp = Math.max(floorHp, Math.round((this.maxHealth || 100) * minFloorRatio));
    }
    if (!allowDestruction) {
      floorHp = Math.max(floorHp, 1);
    }

    this.health = Math.max(floorHp, (this.health ?? this.maxHealth ?? 100) - effective);
    if (this.health <= 0 && allowDestruction) {
      this.health = 0;
      this.isRuined = true;
      this.ruinedAtTick = tick;
      return true;
    }
    return false;
  }

  getLevelMultiplier() {
    return 1 + Math.max(0, (this.level || 1) - 1) * 0.45;
  }

  applyUpgrade(tick = 0) {
    const maxLvl = this.maxLevel || 3;
    if ((this.level || 1) >= maxLvl || this.isRuined) return false;
    this.level = (this.level || 1) + 1;
    this.upgradedAtTick = tick;
    const baseHp = this.baseMaxHealth || this.maxHealth || 100;
    const scaledHp = Math.round(baseHp * (1 + (this.level - 1) * 0.45));
    this.maxHealth = scaledHp;
    this.health = scaledHp;
    const baseCap = STORAGE_CAPACITY[this.buildingType] || 0;
    if (baseCap > 0) {
      this.capacity = Math.round(baseCap * (1 + (this.level - 1) * 0.6));
    }
    return true;
  }

  update() {
    // Buildings don't need much updating unless under construction
    if (!this.complete && this.constructionProgress < 100) {
      // Construction would be handled by agents
    }
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      buildingType: this.buildingType,
      originalType: this.originalType || this.buildingType,
      constructionProgress: this.constructionProgress,
      complete: this.complete,
      isComplete: this.isComplete ?? (this.complete || (this.constructionProgress >= 100)),
      isRuined: Boolean(this.isRuined || (this.health !== undefined && this.health <= 0)),
      ruinedAtTick: this.ruinedAtTick,
      ownerId: this.ownerId,
      settlementId: this.settlementId,
      factionId: this.factionId,
      capacity: this.capacity,
      health: this.health,
      maxHealth: this.maxHealth || 100,
      baseMaxHealth: this.baseMaxHealth || this.maxHealth || 100,
      level: this.level || 1,
      maxLevel: this.maxLevel || 3,
      upgradedAtTick: this.upgradedAtTick ?? null,
      builtInEra: this.builtInEra ?? 1,
      builtEraName: this.builtEraName ?? null,
      isHeritage: Boolean(this.isHeritage),
      customName: this.customName ?? null,
      builtByAgentId: this.builtByAgentId ?? null,
      builtByName: this.builtByName ?? null,
      builtYear: this.builtYear ?? null,
      contributors: Array.isArray(this.contributors) ? this.contributors.map(c => ({ ...c })) : [],
      upgradedByAgentId: this.upgradedByAgentId ?? null,
      upgradedByName: this.upgradedByName ?? null,
      upgradeHistory: Array.isArray(this.upgradeHistory) ? this.upgradeHistory.map(u => ({ ...u })) : [],
      dedication: this.dedication ?? null,
      storage: { ...this.storage }
    };
  }

  static deserialize(data, idGen) {
    // determinism: don't consume ids from the shared generator during load
    const building = new Building(data.x, data.y, data.buildingType, { next: () => -1 },
      data.settlementId ?? null, data.factionId ?? null);
    building.id = data.id;
    building.originalType = data.originalType || data.buildingType;
    building.constructionProgress = data.constructionProgress;
    building.complete = data.complete;
    building.isComplete = data.isComplete ?? (data.complete || (data.constructionProgress >= 100));
    building.isRuined = Boolean(data.isRuined || (data.health !== undefined && data.health <= 0));
    building.ruinedAtTick = data.ruinedAtTick ?? null;
    building.ownerId = data.ownerId;
    if (data.capacity != null) building.capacity = data.capacity;
    if (data.health != null) building.health = data.health;
    if (data.maxHealth != null) building.maxHealth = data.maxHealth;
    if (data.baseMaxHealth != null) building.baseMaxHealth = data.baseMaxHealth;
    building.level = data.level ?? 1;
    building.maxLevel = data.maxLevel ?? (BUILDING_METADATA[data.buildingType]?.maxLevel || 3);
    building.upgradedAtTick = data.upgradedAtTick ?? null;
    if (data.builtInEra != null) building.builtInEra = data.builtInEra;
    if (data.builtEraName != null) building.builtEraName = data.builtEraName;
    if (data.isHeritage != null) building.isHeritage = Boolean(data.isHeritage);
    if (data.customName != null) building.customName = data.customName;
    if (data.builtByAgentId != null) building.builtByAgentId = data.builtByAgentId;
    if (data.builtByName != null) building.builtByName = data.builtByName;
    if (data.builtYear != null) building.builtYear = data.builtYear;
    if (Array.isArray(data.contributors)) building.contributors = data.contributors.map(c => ({ ...c }));
    if (data.upgradedByAgentId != null) building.upgradedByAgentId = data.upgradedByAgentId;
    if (data.upgradedByName != null) building.upgradedByName = data.upgradedByName;
    if (Array.isArray(data.upgradeHistory)) building.upgradeHistory = data.upgradeHistory.map(u => ({ ...u }));
    if (data.dedication != null) building.dedication = data.dedication;
    building.storage = { ...data.storage };
    return building;
  }
}
