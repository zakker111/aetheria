// Culture System - Emergent Society Traditions, Values & Cultural Diffusion
// Fulfills Phase 6 Requirements and Plan Audit specs

export class CultureSystem {
  constructor(simulation) {
    this.simulation = simulation;
    
    // Archetypes for cultural founding
    this.culturalEthos = [
      {
        name: "Builders of the Earth",
        primaryValue: "industriousness",
        values: { industriousness: 0.85, belligerence: 0.2, spirituality: 0.5, cooperation: 0.75, traditionalism: 0.6 },
        color: "#f59e0b",
        symbol: "⚒️",
        favoredTradition: "craft_guilds"
      },
      {
        name: "Keepers of the Grove",
        primaryValue: "spirituality",
        values: { industriousness: 0.45, belligerence: 0.15, spirituality: 0.9, cooperation: 0.8, traditionalism: 0.85 },
        color: "#10b981",
        symbol: "🌿",
        favoredTradition: "sacred_rites"
      },
      {
        name: "Iron Vanguard",
        primaryValue: "belligerence",
        values: { industriousness: 0.7, belligerence: 0.85, spirituality: 0.35, cooperation: 0.65, traditionalism: 0.5 },
        color: "#ef4444",
        symbol: "⚔️",
        favoredTradition: "militia_drills"
      },
      {
        name: "Harvesters of the Plain",
        primaryValue: "cooperation",
        values: { industriousness: 0.6, belligerence: 0.2, spirituality: 0.6, cooperation: 0.9, traditionalism: 0.7 },
        color: "#38bdf8",
        symbol: "🌾",
        favoredTradition: "communal_hearth"
      },
      {
        name: "Scholars of the Horizon",
        primaryValue: "traditionalism",
        values: { industriousness: 0.75, belligerence: 0.25, spirituality: 0.7, cooperation: 0.7, traditionalism: 0.4 },
        color: "#a855f7",
        symbol: "📜",
        favoredTradition: "granary_tithe"
      }
    ];

    this.traditionCatalog = {
      communal_hearth: {
        id: "communal_hearth",
        name: "Communal Hearth",
        description: "Shared meals and fireside songs restore energy and social bonds 30% faster.",
        icon: "🔥"
      },
      granary_tithe: {
        id: "granary_tithe",
        name: "Granary Tithe",
        description: "Citizens deposit 25% of gathered bounties directly to the town stockpile.",
        icon: "🌾"
      },
      craft_guilds: {
        id: "craft_guilds",
        name: "Craft Guilds",
        description: "Master artisans accelerate workshop production and tool crafting.",
        icon: "🔨"
      },
      sacred_rites: {
        id: "sacred_rites",
        name: "Sacred Rites",
        description: "Daily rituals in the town center bless citizens with high morale and faith.",
        icon: "✨"
      },
      militia_drills: {
        id: "militia_drills",
        name: "Militia Drills",
        description: "Citizens train with spears and bows to protect their borders.",
        icon: "🛡️"
      }
    };
  }

  // Initialize or assign culture to a new settlement
  initSettlementCulture(settlement) {
    if (!settlement) return null;
    
    if (settlement.culture && settlement.culture.ethos) {
      return settlement.culture;
    }

    const ethosIndex = (settlement.id - 1) % this.culturalEthos.length;
    const ethos = this.culturalEthos[ethosIndex] || this.culturalEthos[0];

    const values = {
      industriousness: Math.min(1.0, Math.max(0.1, ethos.values.industriousness + ((this.simulation?._rng?.().next?.() ?? Math.random()) - 0.5) * 0.2)),
      belligerence: Math.min(1.0, Math.max(0.1, ethos.values.belligerence + ((this.simulation?._rng?.().next?.() ?? Math.random()) - 0.5) * 0.2)),
      spirituality: Math.min(1.0, Math.max(0.1, ethos.values.spirituality + ((this.simulation?._rng?.().next?.() ?? Math.random()) - 0.5) * 0.2)),
      cooperation: Math.min(1.0, Math.max(0.1, ethos.values.cooperation + ((this.simulation?._rng?.().next?.() ?? Math.random()) - 0.5) * 0.2)),
      traditionalism: Math.min(1.0, Math.max(0.1, ethos.values.traditionalism + ((this.simulation?._rng?.().next?.() ?? Math.random()) - 0.5) * 0.2))
    };

    const traditions = [ethos.favoredTradition];

    settlement.culture = {
      ethos: ethos.name,
      symbol: ethos.symbol,
      bannerColor: ethos.color,
      values,
      traditions,
      festivalsHeld: 0,
      culturalRenown: 10
    };

    return settlement.culture;
  }

  // Periodic culture update
  update(tick) {
    if (!this.simulation || !this.simulation.settlementSystem) return;

    if (tick % 60 === 0) {
      const settlements = Array.from(this.simulation.settlementSystem.settlements.values());

      for (const settlement of settlements) {
        if (!settlement.culture || !settlement.culture.values) {
          this.initSettlementCulture(settlement);
        }

        const culture = settlement.culture;
        if (!culture || !culture.values) continue;

        // Culture unlocks traditions as population grows
        const pop = settlement.population || (settlement.agentIds ? settlement.agentIds.size : 0);
        
        if (pop >= 6 && !culture.traditions.includes("granary_tithe")) {
          culture.traditions.push("granary_tithe");
          this.emitCultureEvent(settlement, "Adopted Tradition: Granary Tithe");
        }
        if (pop >= 10 && !culture.traditions.includes("communal_hearth")) {
          culture.traditions.push("communal_hearth");
          this.emitCultureEvent(settlement, "Adopted Tradition: Communal Hearth");
        }
        if (pop >= 15 && !culture.traditions.includes("craft_guilds")) {
          culture.traditions.push("craft_guilds");
          this.emitCultureEvent(settlement, "Adopted Tradition: Craft Guilds");
        }
        if (pop >= 20 && !culture.traditions.includes("militia_drills")) {
          culture.traditions.push("militia_drills");
          this.emitCultureEvent(settlement, "Adopted Tradition: Militia Drills");
        }

        // Cultural diffusion: exchange values with close settlements
        for (const other of settlements) {
          if (other.id === settlement.id || !other.culture || !other.culture.values) continue;
          const dist = Math.hypot(other.center.x - settlement.center.x, other.center.y - settlement.center.y);
          if (dist < 40) {
            // Slight convergence between neighbors
            for (const key of Object.keys(culture.values)) {
              const otherVal = other.culture.values[key] ?? 0.5;
              const currentVal = culture.values[key] ?? 0.5;
              const diff = otherVal - currentVal;
              culture.values[key] = currentVal + diff * 0.005;
            }
          }
        }
      }
    }
  }

  emitCultureEvent(settlement, title) {
    if (this.simulation && this.simulation.eventBus) {
      this.simulation.eventBus.emit("CULTURE_EVOLVED", {
        settlementId: settlement.id,
        settlementName: settlement.name,
        title
      });
    }
  }

  serialize() {
    return {};
  }

  static deserialize(data, sim) {
    return new CultureSystem(sim);
  }
}
