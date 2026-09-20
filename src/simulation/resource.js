// Resource entities (trees, water sources, food, ore, etc.)
export class Resource {
  constructor(x, y, resourceType, amount, idGen) {
    this.id = idGen.next();
    this.type = "resource";
    this.x = x;
    this.y = y;
    this.resourceType = resourceType; // "food", "water", "wood", "ore"
    this.amount = amount;
    this.maxAmount = amount;
    this.regrowRate = 0.01; // resources regrow slowly
  }

  update() {
    // Resources slowly regrow
    if (this.amount < this.maxAmount) {
      this.amount = Math.min(this.maxAmount, this.amount + this.regrowRate);
    }
  }

  consume(amount) {
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
      maxAmount: this.maxAmount
    };
  }

  static deserialize(data, idGen) {
    const resource = new Resource(data.x, data.y, data.resourceType, data.amount, idGen);
    resource.id = data.id;
    resource.maxAmount = data.maxAmount;
    return resource;
  }
}
