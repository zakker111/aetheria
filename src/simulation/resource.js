// Resource entities (trees, water sources, food, ore, etc.)
export class Resource {
  constructor(x, y, resourceType, amount = 40, idGen = { next: () => ++Resource._fallbackId }, options = {}) {
    this.id = idGen.next();
    this.type = "resource";
    this.x = x;
    this.y = y;
    this.resourceType = resourceType; // "food", "water", "wood", "ore", "gem", "uranium"
    this.amount = amount;
    this.maxAmount = Math.max(amount, 40);
    this.depositTier = options.depositTier || (resourceType === "uranium" ? "uranium_mountain" : "standard");
    this.requiredEraId = options.requiredEraId ?? (
      this.depositTier === "uranium_mountain" || resourceType === "uranium" ? 6 :
      this.depositTier === "iron_mountain" ? 2 :
      1
    );
    this.destroyed = false;
    // True while the node is empty and in its recovery period. The spatial
    // index skips depleted nodes, so we must clear it when refill begins.
    this.depleted = false;
    // Depletion tracking: once a node runs dry it enters a recovery period
    // before it starts refilling again (or permanently exhausts for finite mines).
    // Pure counter math — no RNG draws — so save/load determinism is unaffected.
    this.recoveryTicks = 0;

    // Tree growth lifecycle (sapling -> young -> mature -> ancient)
    this.growthStage = options.growthStage || (resourceType === "wood"
      ? (amount <= 14 ? "sapling" : amount < 28 ? "young" : "mature")
      : "mature");
    this.growthProgress = options.growthProgress ?? (
      this.growthStage === "sapling" ? 12 :
      this.growthStage === "young" ? 45 :
      this.growthStage === "ancient" ? 100 : 80
    );

    // Finite geological reserve cycles for mineral seams (ores/gems/uranium deplete permanently)
    this.exhaustionsRemaining = options.exhaustionsRemaining ?? (
      this.depositTier === "iron_mountain" || this.depositTier === "uranium_mountain" || resourceType === "uranium" ? 0 :
      resourceType === "ore" ? 1 :
      resourceType === "gem" ? 0 :
      999
    );
    this.exhausted = Boolean(options.exhausted);

    // Regrowth rates tailored per resource type
    if (resourceType === "food") {
      this.regrowRate = 0.12; // Wild crops & berry bushes regrow quickly
      this.recoveryTime = 35;  // fallow patch rests briefly, then greens again
      this.depletedLabel = "Fallow Patch";
      this.label = "Wild Food";
    } else if (resourceType === "wood") {
      this.regrowRate = 0.08; // Trees grow steadily through saplings
      this.recoveryTime = 85;  // saplings sprout back from cleared stumps
      this.depletedLabel = "Stump";
      this.label = this.growthStage === "sapling" ? "Sapling Shoot"
        : this.growthStage === "young" ? "Young Sapling Tree"
        : this.growthStage === "ancient" ? "Ancient Grove"
        : "Timber Grove";
      this.normalLabel = "Timber Grove";
    } else if (resourceType === "uranium" || this.depositTier === "uranium_mountain") {
      this.regrowRate = 0;
      this.recoveryTime = 400;
      this.depletedLabel = "Spent Uranium Seam";
      this.label = "Uranium Mountain Vein";
    } else if (resourceType === "ore") {
      this.regrowRate = this.depositTier === "iron_mountain" ? 0 : 0.008; // Ore seams barely seep back once tapped; mining depletes them
      this.recoveryTime = 240; // secondary seam exposure takes long
      this.depletedLabel = this.depositTier === "iron_mountain" ? "Exhausted Iron Mountain" : "Exhausted Seam";
      this.label = this.depositTier === "iron_mountain" ? "Iron Mountain Lode" : "Mineral Ore Deposit";
    } else if (resourceType === "gem") {
      this.regrowRate = 0.004;
      this.recoveryTime = 360;
      this.depletedLabel = "Mined-Out Vein";
      this.label = "Crystal Vein";
    } else {
      this.regrowRate = 0.2;  // Water springs bubble continuously
      this.recoveryTime = 20;  // an exhausted spring wells back up fast
      this.depletedLabel = "Dried Spring";
      this.label = "Freshwater Spring";
    }
  }

  update(environmentalModifier = 1.0, world = null) {
    if (this.destroyed || this.exhausted) return;

    const mod = environmentalModifier || 1.0;
    const rate = this.regrowRate > 0 ? Math.max(0.004, this.regrowRate * mod) : 0;

    if (this.amount <= 0 || this.depleted) {
      // Permanently exhausted ore/gem/uranium mines do not recover
      if (this.resourceType === "ore" || this.resourceType === "gem" || this.resourceType === "uranium") {
        if (this.exhaustionsRemaining <= 0) {
          this.exhausted = true;
          this.recoveryTicks = 0;
          this.label = this.resourceType === "gem"
            ? "Mined-Out Vein"
            : this.resourceType === "uranium"
              ? "Spent Uranium Seam"
              : (this.depositTier === "iron_mountain" ? "Exhausted Iron Mountain" : "Exhausted Mine");
          return;
        }
      }
      // Node depleted: sit dormant until the recovery countdown elapses,
      // then nature begins refilling it from zero (saplings for felled trees).
      if (this.recoveryTicks > 0) {
        this.recoveryTicks--;
        if (this.recoveryTicks === 0) {
          if (this.resourceType === "wood") {
            this.growthStage = "sapling";
            this.growthProgress = 12;
            this.amount = 6;
            this.label = "Sapling Shoot";
          } else if (this.resourceType === "ore") {
            this.exhaustionsRemaining = Math.max(0, (this.exhaustionsRemaining ?? 1) - 1);
            this.maxAmount = Math.max(18, Math.round(this.maxAmount * 0.6));
            this.amount = Math.min(this.maxAmount, 12);
            this.label = this.normalLabel || "Remaining Ore Seam";
          } else {
            this.amount = Math.min(this.maxAmount, Math.max(1, rate * 6));
            if (this.normalLabel) this.label = this.normalLabel;
          }
          this.depleted = false;
          if (world && typeof world.addToSpatialIndex === 'function') {
            world.addToSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
          }
        }
      }
      return;
    }

    // Living trees grow visibly from sapling -> young -> mature -> ancient
    if (this.resourceType === "wood") {
      if (this.growthProgress < 100) {
        this.growthProgress = Math.min(100, this.growthProgress + 0.35 * mod);
        if (this.growthStage === "sapling" && this.growthProgress >= 35) {
          this.growthStage = "young";
          this.label = "Young Sapling Tree";
          this.amount = Math.min(this.maxAmount, this.amount + 6);
        } else if (this.growthStage === "young" && this.growthProgress >= 75) {
          this.growthStage = "mature";
          this.label = this.normalLabel || "Timber Grove";
          this.amount = Math.min(this.maxAmount, this.amount + 10);
        } else if (this.growthStage === "mature" && this.growthProgress >= 100 && this.amount >= this.maxAmount * 0.9) {
          this.growthStage = "ancient";
          this.maxAmount = Math.max(this.maxAmount, 65);
          this.amount = Math.min(this.maxAmount, this.amount + 8);
          this.label = "Ancient Grove";
        }
      }
      if (this.amount < this.maxAmount) {
        this.amount = Math.min(this.maxAmount, this.amount + rate * (this.growthStage === "sapling" ? 1.5 : 1.0));
      }
      return;
    }

    // Refilling toward capacity for renewable patches/springs (ores barely trickle back).
    if (this.amount < this.maxAmount) {
      this.amount = Math.min(this.maxAmount, this.amount + rate);
      if (this.depletedLabel && this.label === this.depletedLabel &&
          this.amount >= this.maxAmount * 0.2) {
        this.label = this.normalLabel || this.label;
      }
    }
  }

  // Called whenever harvesting brings a node to empty: arm the recovery
  // countdown so depletion is real and visible (a felled grove reads as a
  // "Stump", an exhausted seam as "Exhausted Mine") before it regrows or closes permanently.
  markDepleted(world = null) {
    this.amount = 0;
    this.depleted = true;
    if ((this.resourceType === "ore" || this.resourceType === "gem" || this.resourceType === "uranium") && (this.exhaustionsRemaining ?? 0) <= 0) {
      this.exhausted = true;
      this.recoveryTicks = 0;
      this.label = this.resourceType === "gem"
        ? "Mined-Out Vein"
        : this.resourceType === "uranium"
          ? "Spent Uranium Seam"
          : (this.depositTier === "iron_mountain" ? "Exhausted Iron Mountain" : "Exhausted Mine");
      if (world && typeof world.removeFromSpatialIndex === 'function') {
        world.removeFromSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
      }
      return;
    }
    if (this.recoveryTicks === 0) {
      this.recoveryTicks = this.recoveryTime || 60;
      if (this.depletedLabel) {
        if (!this.normalLabel) this.normalLabel = this.label;
        this.label = this.depletedLabel;
      }
      if (world && typeof world.removeFromSpatialIndex === 'function') {
        world.removeFromSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
      }
    }
  }

  consume(amount, world = null) {
    if (this.destroyed || this.exhausted) return false;
    this.amount = Math.max(0, this.amount - amount);
    if (this.amount <= 0) {
      this.markDepleted(world);
      return false;
    }
    return true;
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      resourceType: this.resourceType,
      amount: this.amount,
      maxAmount: this.maxAmount,
      depositTier: this.depositTier || "standard",
      requiredEraId: this.requiredEraId ?? 1,
      destroyed: this.destroyed,
      label: this.label,
      normalLabel: this.normalLabel || null,
      recoveryTicks: this.recoveryTicks || 0,
      depleted: !!this.depleted,
      growthStage: this.growthStage || "mature",
      growthProgress: this.growthProgress ?? 80,
      exhaustionsRemaining: this.exhaustionsRemaining ?? 0,
      exhausted: !!this.exhausted
    };
  }

  static deserialize(data, idGen) {
    // determinism: don't consume ids from the shared generator during load
    const resource = new Resource(data.x, data.y, data.resourceType, data.amount, { next: () => -1 }, {
      growthStage: data.growthStage,
      growthProgress: data.growthProgress,
      exhaustionsRemaining: data.exhaustionsRemaining,
      exhausted: data.exhausted,
      depositTier: data.depositTier,
      requiredEraId: data.requiredEraId
    });
    resource.id = data.id;
    resource.maxAmount = data.maxAmount;
    resource.depositTier = data.depositTier || (resource.resourceType === "uranium" ? "uranium_mountain" : "standard");
    resource.requiredEraId = data.requiredEraId ?? (
      resource.depositTier === "uranium_mountain" || resource.resourceType === "uranium" ? 6 :
      resource.depositTier === "iron_mountain" ? 2 :
      1
    );
    resource.destroyed = data.destroyed || false;
    // Depletion & lifecycle state must round-trip or a resumed run silently
    // revives spent nodes / changes growth thresholds on load.
    resource.recoveryTicks = data.recoveryTicks || 0;
    resource.depleted = !!data.depleted;
    resource.exhausted = !!data.exhausted;
    if (data.exhaustionsRemaining !== undefined) resource.exhaustionsRemaining = data.exhaustionsRemaining;
    if (data.growthStage) resource.growthStage = data.growthStage;
    if (data.growthProgress !== undefined) resource.growthProgress = data.growthProgress;
    if (data.normalLabel) resource.normalLabel = data.normalLabel;
    if (data.label) resource.label = data.label;
    return resource;
  }
}

