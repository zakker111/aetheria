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
    // True while the node is empty and in its recovery period. The spatial
    // index skips depleted nodes, so we must clear it when refill begins.
    this.depleted = false;
    // Depletion tracking: once a node runs dry it enters a recovery period
    // before it starts refilling again. Pure counter math — no RNG draws —
    // so save/load determinism is unaffected.
    this.recoveryTicks = 0;

    // Regrowth rates tailored per resource type
    if (resourceType === "food") {
      this.regrowRate = 0.05; // Wild crops & berry bushes regrow quickly
      this.recoveryTime = 60;  // fallow patch rests briefly, then greens again
      this.depletedLabel = "Fallow Patch";
      this.label = "Wild Food";
    } else if (resourceType === "wood") {
      this.regrowRate = 0.03; // Trees regrow steadily
      this.recoveryTime = 180; // saplings take a while to grow back
      this.depletedLabel = "Stump";
      this.label = "Timber Grove";
    } else if (resourceType === "ore") {
      this.regrowRate = 0.02; // Ore veins slowly replenish
      this.recoveryTime = 300; // mineral seams recharge very slowly
      this.depletedLabel = "Spent Seam";
      this.label = "Mineral Ore Deposit";
    } else if (resourceType === "gem") {
      // Rare crystal vein: precious stones for grand masonry and jewelry.
      // Almost never regrows — gems stay scarce by design, so towns must
      // prospect distant mountains (or trade) to complete castles.
      this.regrowRate = 0.003;
      this.recoveryTime = 900; // crystals are effectively mined out for good
      this.depletedLabel = "Mined-Out Vein";
      this.label = "Crystal Vein";
    } else {
      this.regrowRate = 0.1; // Water springs bubble continuously
      this.recoveryTime = 30;  // an exhausted spring wells back up fast
      this.depletedLabel = "Dried Spring";
      this.label = "Freshwater Spring";
    }
  }

  update() {
    if (this.destroyed) return;

    if (this.amount <= 0) {
      // Node depleted: sit dormant until the recovery countdown elapses,
      // then nature begins refilling it from zero.
      if (this.recoveryTicks > 0) {
        this.recoveryTicks--;
        if (this.recoveryTicks === 0) {
          // Recovery over: start refilling immediately and re-enter the
          // spatial index on the next rebuild so agents can find it again.
          this.amount = Math.min(this.maxAmount, this.regrowRate);
          this.depleted = false;
        }
      }
      return;
    }

    // Refilling toward capacity.
    if (this.amount < this.maxAmount) {
      this.amount = Math.min(this.maxAmount, this.amount + this.regrowRate);
      // Once it has visibly recovered, restore the normal label.
      if (this.depletedLabel && this.label === this.depletedLabel &&
          this.amount >= this.maxAmount * 0.25) {
        this.label = this.normalLabel;
      }
    }
  }

  // Called whenever harvesting brings a node to empty: arm the recovery
  // countdown so depletion is real and visible (a felled grove reads as a
  // "Stump", an exhausted seam as "Spent Seam") before it regrows.
  markDepleted() {
    if (this.amount <= 0 && this.recoveryTicks === 0) {
      this.recoveryTicks = this.recoveryTime || 60;
      this.depleted = true;
      if (this.depletedLabel) {
        if (!this.normalLabel) this.normalLabel = this.label;
        this.label = this.depletedLabel;
      }
    }
  }

  consume(amount) {
    if (this.destroyed) return false;
    this.amount = Math.max(0, this.amount - amount);
    if (this.amount <= 0) this.markDepleted();
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
      label: this.label,
      recoveryTicks: this.recoveryTicks || 0,
      depleted: !!this.depleted
    };
  }

  static deserialize(data, idGen) {
    // determinism: don't consume ids from the shared generator during load
    const resource = new Resource(data.x, data.y, data.resourceType, data.amount, { next: () => -1 });
    resource.id = data.id;
    resource.maxAmount = data.maxAmount;
    resource.destroyed = data.destroyed || false;
    // Depletion state must round-trip or a resumed run silently revives
    // every spent node on the first tick after load (determinism hazard).
    resource.recoveryTicks = data.recoveryTicks || 0;
    resource.depleted = !!data.depleted;
    if (data.label) resource.label = data.label;
    return resource;
  }
}

