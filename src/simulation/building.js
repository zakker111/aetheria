// Building entities (houses, farms, etc.)
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
    building.storage = { ...data.storage };
    return building;
  }
}
