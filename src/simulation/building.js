// Building entities (houses, farms, etc.)
export class Building {
  constructor(x, y, buildingType, idGen) {
    this.id = idGen.next();
    this.type = "building";
    this.x = x;
    this.y = y;
    this.buildingType = buildingType; // "house", "farm", "stockpile"
    this.constructionProgress = 0;
    this.complete = false;
    this.ownerId = null;
    this.storage = {};
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
      storage: { ...this.storage }
    };
  }

  static deserialize(data, idGen) {
    const building = new Building(data.x, data.y, data.buildingType, idGen);
    building.id = data.id;
    building.constructionProgress = data.constructionProgress;
    building.complete = data.complete;
    building.ownerId = data.ownerId;
    building.storage = { ...data.storage };
    return building;
  }
}
