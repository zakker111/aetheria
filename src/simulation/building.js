// Building entities (houses, farms, etc.)
import { STORAGE_CAPACITY } from '../core/constants.js';

export class Building {
  constructor(x, y, buildingType, idGen, settlementId = null, factionId = null) {
    this.id = idGen.next();
    this.type = "building";
    this.x = x;
    this.y = y;
    this.buildingType = buildingType; // "house", "farm", "stockpile"
    this.constructionProgress = 0;
    this.complete = false;
    this.ownerId = null;
    this.storage = {};
    // Storage capacity: settlements are limited in how much food/wood/stone/
    // ore/water they can keep — warehouses expand this (see STORAGE_CAPACITY).
    this.capacity = 0;
    this.health = 100;
    // Apply storage capacity for the building type (drives warehouse demand)
    const cap = STORAGE_CAPACITY[buildingType];
    if (cap) this.capacity = cap;
    // Territorial ownership: buildings belong to a settlement/faction.
    // Only that community's builders work on them directly; friendly
    // settlements may assist (see agent.js build goal filtering).
    this.settlementId = settlementId;
    this.factionId = factionId;
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
      constructionProgress: this.constructionProgress,
      complete: this.complete,
      ownerId: this.ownerId,
      settlementId: this.settlementId,
      factionId: this.factionId,
      capacity: this.capacity,
      health: this.health,
      storage: { ...this.storage }
    };
  }

  static deserialize(data, idGen) {
    // determinism: don't consume ids from the shared generator during load
    const building = new Building(data.x, data.y, data.buildingType, { next: () => -1 },
      data.settlementId ?? null, data.factionId ?? null);
    building.id = data.id;
    building.constructionProgress = data.constructionProgress;
    building.complete = data.complete;
    building.ownerId = data.ownerId;
    if (data.capacity != null) building.capacity = data.capacity;
    if (data.health != null) building.health = data.health;
    building.storage = { ...data.storage };
    return building;
  }
}
