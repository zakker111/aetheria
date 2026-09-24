// Resource entities (trees, water sources, food, ore, etc.)
export class Resource {
  constructor(x, y, resourceType, amount = 40, idGen = { next: () => ++Resource._fallbackId }) {
    this.id = idGen.next();
    this.type = "resource";
    this.x = x;
    this.y = y;
    this.resourceType = resourceType; // "food", "water", "wood", "ore"
    this.amount = amount;
    this.maxAmount = Math.max(amount, 40);
    this.destroyed = false;

    // Regrowth rates tailored per resource type
    if (resourceType === "food") {
      this.regrowRate = 0.05; // Wild crops & berry bushes regrow quickly
      this.label = "Wild Food";
    } else if (resourceType === "wood") {
      this.regrowRate = 0.03; // Trees regrow steadily
      this.label = "Timber Grove";
    } else if (resourceType === "ore") {
      this.regrowRate = 0.02; // Ore veins slowly replenish
      this.label = "Mineral Ore Deposit";
    } else {
      this.regrowRate = 0.1; // Water springs bubble continuously
      this.label = "Freshwater Spring";
    }
  }

  update() {
    if (this.destroyed) return;
    
    // Resources naturally regrow and replenish
    if (this.amount < this.maxAmount) {
      this.amount = Math.min(this.maxAmount, this.amount + this.regrowRate);
    }
  }

  consume(amount) {
    if (this.destroyed) return false;
    this.amount = Math.max(0, this.amount - amount);
    return this.amount > 0;
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      resourceType: this.resourceType,
      amount: this.amount,
      maxAmount: this.maxAmount,
      destroyed: this.destroyed,
      label: this.label
    };
  }

  static deserialize(data, idGen) {
    // determinism: don't consume ids from the shared generator during load
    const resource = new Resource(data.x, data.y, data.resourceType, data.amount, { next: () => -1 });
    resource.id = data.id;
    resource.maxAmount = data.maxAmount;
    resource.destroyed = data.destroyed || false;
    if (data.label) resource.label = data.label;
    return resource;
  }
}

