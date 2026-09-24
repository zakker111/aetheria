// Settlement System - Emergent Society, Towns & Civilizations
// Fulfills Phase 2 & Phase 5 City Building & Society Pillars

export class SettlementSystem {
  constructor() {
    // All settlements: settlementId -> settlement data
    this.settlements = new Map();
    
    // Agent to settlement mapping: agentId -> settlementId
    this.agentSettlementMap = new Map();
    
    // Home locations: agentId -> home position
    this.homes = new Map();
    
    // Territory claims: settlementId -> Set of tile coordinates
    this.territories = new Map();
    
    // Settlement naming
    this.settlementNames = [
      'Oakwood', 'Riverside', 'Stonehold', 'Greenfield', 'Hillcrest',
      'Brookhaven', 'Timberland', 'Meadowbrook', 'Fairview', 'Clearwater',
      'Shadowfen', 'Brightdale', 'Ironforge', 'Windmere', 'Thornbury',
      'Sunreach', 'Highpeak', 'Goldshore', 'Eldergrove', 'Stormwatch'
    ];

    this.settlementBanners = [
      { color: "#38bdf8", symbol: "🌊" },
      { color: "#f59e0b", symbol: "☀️" },
      { color: "#22c55e", symbol: "🌲" },
      { color: "#a855f7", symbol: "🦅" },
      { color: "#ef4444", symbol: "🔥" },
      { color: "#ec4899", symbol: "🌸" }
    ];
    
    this.nextSettlementId = 1;
  }

  // Get settlement tier based on population
  getTierInfo(pop) {
    if (pop >= 25) return { tier: "City", icon: "🏰", radius: 25, bonus: "Metropolis" };
    if (pop >= 15) return { tier: "Town", icon: "🏛️", radius: 20, bonus: "Civic Order" };
    if (pop >= 8)  return { tier: "Village", icon: "🏡", radius: 16, bonus: "Craft Guilds" };
    if (pop >= 4)  return { tier: "Hamlet", icon: "🛖", radius: 12, bonus: "Cooperative" };
    return { tier: "Camp", icon: "🏕️", radius: 9, bonus: "Pioneers" };
  }

  // Explicitly found a settlement at a given coordinate with founding agents
  foundSettlement(x, y, foundingAgents = [], nameOverride = null) {
    const id = this.nextSettlementId++;
    const name = nameOverride || this.generateSetName();
    const banner = this.settlementBanners[(id - 1) % this.settlementBanners.length];
    
    const pop = Math.max(1, foundingAgents.length);
    const tierInfo = this.getTierInfo(pop);

    const settlement = {
      id,
      name,
      center: { x, y },
      tier: tierInfo.tier,
      tierIcon: tierInfo.icon,
      bannerColor: banner.color,
      bannerSymbol: banner.symbol,
      population: pop,
      agentIds: new Set(foundingAgents.map(a => a.id)),
      foundedAt: Date.now(),
      abandonedTicks: 0,
      growthTrend: 'stable',
      previousPopulation: pop,
      buildings: [],
      resources: {
        food: 30,
        wood: 25,
        ore: 15
      },
      stockpile: {
        food: 30,
        wood: 25,
        stone: 15,
        ore: 15
      },
      leadership: null,
      leadershipTitle: "Elder",
      culture: {
        ethos: "Founders",
        symbol: banner.symbol,
        bannerColor: banner.color,
        values: {
          industriousness: 0.7,
          belligerence: 0.3,
          spirituality: 0.5,
          cooperation: 0.8,
          traditionalism: 0.6
        },
        traditions: ["communal_hearth"],
        beliefs: []
      }
    };

    // Assign leadership from founding members
    if (foundingAgents.length > 0) {
      const sorted = [...foundingAgents].sort((a, b) => (b.age || 20) - (a.age || 20));
      settlement.leadership = sorted[0].name;
      settlement.leadershipTitle = pop >= 15 ? "Mayor" : pop >= 8 ? "Chieftain" : "Elder";
      for (const agent of foundingAgents) {
        this.agentSettlementMap.set(agent.id, id);
        agent.settlementId = id;
      }
    }

    this.settlements.set(id, settlement);
    this.claimTerritory(id, x, y, tierInfo.radius);
    settlement.territory = this.territories.get(id);
    return settlement;
  }
  
  // Check if unassigned agents form new clusters
  detectSettlements(agents, world) {
    const visited = new Set();
    const clusters = [];
    
    // Group agents that are close to each other
    for (const agent of agents) {
      if (!agent.alive || visited.has(agent.id)) continue;
      
      const cluster = [agent];
      visited.add(agent.id);
      
      for (const other of agents) {
        if (!other.alive || visited.has(other.id)) continue;
        
        const dx = other.x - agent.x;
        const dy = other.y - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 18) {
          cluster.push(other);
          visited.add(other.id);
        }
      }
      
      if (cluster.length >= 3) {
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }
  
  // Update settlements without destroying established societies prematurely
  updateSettlements(clusters, agents) {
    // 1. Process clusters: associate with existing settlement or found new one
    for (const cluster of clusters) {
      let centerX = 0, centerY = 0;
      for (const a of cluster) {
        centerX += a.x;
        centerY += a.y;
      }
      centerX /= cluster.length;
      centerY /= cluster.length;
      
      // Look for existing settlement nearby
      let matchedSettlement = null;
      let minDistance = 24; // Generous settlement radius
      for (const [id, s] of this.settlements) {
        const d = Math.hypot(s.center.x - centerX, s.center.y - centerY);
        if (d < minDistance) {
          minDistance = d;
          matchedSettlement = s;
        }
      }
      
      if (matchedSettlement) {
        // Update center slightly via inertia toward population center
        matchedSettlement.center.x = matchedSettlement.center.x * 0.9 + centerX * 0.1;
        matchedSettlement.center.y = matchedSettlement.center.y * 0.9 + centerY * 0.1;
        for (const a of cluster) {
          this.agentSettlementMap.set(a.id, matchedSettlement.id);
          a.settlementId = matchedSettlement.id;
          matchedSettlement.agentIds.add(a.id);
        }
      } else {
        // New settlement cluster found far from existing towns
        this.foundSettlement(centerX, centerY, cluster);
      }
    }
    
    // 2. Reconcile living populations for all persistent settlements
    const aliveAgentsMap = new Map();
    for (const a of agents) {
      if (a.alive) aliveAgentsMap.set(a.id, a);
    }

    for (const [id, settlement] of this.settlements) {
      // Filter out dead members
      const activeIds = new Set();
      for (const agentId of settlement.agentIds) {
        if (aliveAgentsMap.has(agentId)) {
          activeIds.add(agentId);
        } else {
          this.agentSettlementMap.delete(agentId);
        }
      }

      // Also adopt any unassigned agents walking inside this settlement's territory
      for (const a of agents) {
        if (a.alive && !this.agentSettlementMap.has(a.id)) {
          const dist = Math.hypot(a.x - settlement.center.x, a.y - settlement.center.y);
          if (dist <= 16) {
            this.agentSettlementMap.set(a.id, id);
            a.settlementId = id;
            activeIds.add(a.id);
          }
        }
      }

      settlement.agentIds = activeIds;
      const currentPop = activeIds.size;
      
      if (currentPop > settlement.previousPopulation) {
        settlement.growthTrend = 'growing';
      } else if (currentPop < settlement.previousPopulation) {
        settlement.growthTrend = 'declining';
      } else {
        settlement.growthTrend = 'stable';
      }
      settlement.previousPopulation = currentPop;
      settlement.population = currentPop;

      // Update tier & title
      const tierInfo = this.getTierInfo(currentPop);
      settlement.tier = tierInfo.tier;
      settlement.tierIcon = tierInfo.icon;
      settlement.leadershipTitle = currentPop >= 15 ? "Mayor" : currentPop >= 8 ? "Chieftain" : "Elder";

      // Claim dynamic territory
      this.claimTerritory(id, settlement.center.x, settlement.center.y, tierInfo.radius);

      // Verify or elect leadership
      const citizens = Array.from(activeIds).map(aid => aliveAgentsMap.get(aid)).filter(Boolean);
      if (citizens.length > 0) {
        const currentLeaderAlive = citizens.some(c => c.name === settlement.leadership);
        if (!currentLeaderAlive) {
          // Elect wisest / oldest citizen
          citizens.sort((a, b) => (b.age || 20) - (a.age || 20));
          settlement.leadership = citizens[0].name;
        }
        settlement.abandonedTicks = 0;
      } else {
        settlement.abandonedTicks = (settlement.abandonedTicks || 0) + 1;
      }

      // Sync stockpile with resources
      if (!settlement.stockpile) {
        settlement.stockpile = { food: 0, wood: 0, stone: 0, ore: 0 };
      }
      settlement.resources = {
        food: settlement.stockpile.food || 0,
        wood: settlement.stockpile.wood || 0,
        ore: settlement.stockpile.ore || 0
      };
    }

    // 3. Only disband settlements if completely abandoned (0 population) for over 180 ticks and no buildings
    for (const [id, settlement] of Array.from(this.settlements.entries())) {
      const hasBuildings = settlement.buildings && settlement.buildings.length > 0;
      if (settlement.population === 0 && !hasBuildings && settlement.abandonedTicks > 180) {
        this.settlements.delete(id);
        this.territories.delete(id);
      }
    }
  }
  
  // Generate unique settlement name
  generateSetName() {
    const baseName = this.settlementNames[Math.floor(Math.random() * this.settlementNames.length)];
    const suffixes = ['', ' Village', ' Town', ' Hold', ' Keep', ' Landing', ' Valley', ' Haven'];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${baseName}${suffix}`;
  }

  // Stockpile operations: communal sharing for societies
  depositToStockpile(settlementId, resourceType, amount) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return false;
    if (!settlement.stockpile) {
      settlement.stockpile = { food: 0, wood: 0, stone: 0, ore: 0 };
    }
    settlement.stockpile[resourceType] = (settlement.stockpile[resourceType] || 0) + amount;
    settlement.resources[resourceType] = settlement.stockpile[resourceType];
    return true;
  }

  withdrawFromStockpile(settlementId, resourceType, amount) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement || !settlement.stockpile) return 0;
    const available = settlement.stockpile[resourceType] || 0;
    const taken = Math.min(available, amount);
    settlement.stockpile[resourceType] -= taken;
    settlement.resources[resourceType] = settlement.stockpile[resourceType];
    return taken;
  }
  
  // Agent claims/builds a home
  claimHome(agentId, x, y, settlementId) {
    this.homes.set(agentId, {
      x,
      y,
      settledAt: Date.now(),
      level: 1,
      storage: {
        food: 0,
        wood: 0,
        ore: 0
      }
    });
    
    // Add to settlement buildings
    if (settlementId && this.settlements.has(settlementId)) {
      const settlement = this.settlements.get(settlementId);
      settlement.buildings.push({
        type: 'house',
        x,
        y,
        ownerId: agentId
      });
      
      // Claim surrounding tiles as territory
      this.claimTerritory(settlementId, x, y, 6);
    }
  }
  
  // Claim territory around a point
  claimTerritory(settlementId, centerX, centerY, radius) {
    if (!this.territories.has(settlementId)) {
      this.territories.set(settlementId, new Set());
    }
    
    const territory = this.territories.get(settlementId);
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const tileKey = `${Math.floor(centerX + dx)},${Math.floor(centerY + dy)}`;
          territory.add(tileKey);
        }
      }
    }
  }
  
  // Check if tile is in settlement territory
  isInTerritory(x, y, settlementId) {
    const territory = this.territories.get(settlementId);
    if (!territory) return false;
    
    const tileKey = `${Math.floor(x)},${Math.floor(y)}`;
    return territory.has(tileKey);
  }
  
  // Get settlement for an agent
  getAgentSettlement(agentId) {
    const settlementId = this.agentSettlementMap.get(agentId);
    if (!settlementId) return null;
    return this.settlements.get(settlementId);
  }
  
  // Get home for an agent
  getAgentHome(agentId) {
    return this.homes.get(agentId);
  }
  
  // Agent stores resources at home
  storeResourcesAtHome(agentId, resourceType, amount) {
    const home = this.homes.get(agentId);
    if (!home) return false;
    
    if (!home.storage[resourceType]) {
      home.storage[resourceType] = 0;
    }
    home.storage[resourceType] += amount;
    return true;
  }
  
  // Upgrade home level
  upgradeHome(agentId) {
    const home = this.homes.get(agentId);
    if (!home) return false;
    
    home.level++;
    home.storageCapacity = (home.level * 100);
    return true;
  }
  
  // Get settlement statistics
  getSettlementStats(settlementId) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return null;
    
    // Calculate total stored resources (stockpile + homes)
    let totalFood = settlement.stockpile?.food || 0;
    let totalWood = settlement.stockpile?.wood || 0;
    let totalOre = settlement.stockpile?.ore || 0;
    
    for (const agentId of settlement.agentIds) {
      const home = this.homes.get(agentId);
      if (home) {
        totalFood += home.storage.food || 0;
        totalWood += home.storage.wood || 0;
        totalOre += home.storage.ore || 0;
      }
    }
    
    return {
      ...settlement,
      totalFood,
      totalWood,
      totalOre,
      buildingCount: settlement.buildings.length,
      homeCount: settlement.buildings.filter(b => b.type === 'house').length
    };
  }
  
  // Estimate resource consumption rate based on population
  getConsumptionRate(settlementId, resourceType) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return 0;
    
    const pop = settlement.population || 1;
    
    const baseRates = {
      food: 0.01,
      wood: 0.005,
      stone: 0.002,
      ore: 0.003
    };
    
    return pop * (baseRates[resourceType] || 0);
  }
  
  // Serialize for save/load
  serialize() {
    return {
      settlements: Array.from(this.settlements.entries()).map(([id, s]) => [
        id,
        {
          ...s,
          agentIds: Array.from(s.agentIds),
          previousPopulation: s.previousPopulation || s.population
        }
      ]),
      agentSettlementMap: Array.from(this.agentSettlementMap.entries()),
      homes: Array.from(this.homes.entries()),
      territories: Array.from(this.territories.entries()).map(([id, tiles]) => [id, Array.from(tiles)]),
      nextSettlementId: this.nextSettlementId
    };
  }
  
  static deserialize(data) {
    const system = new SettlementSystem();
    
    system.settlements = new Map(
      data.settlements.map(([id, s]) => [
        id,
        {
          ...s,
          agentIds: new Set(s.agentIds)
        }
      ])
    );
    
    system.agentSettlementMap = new Map(data.agentSettlementMap);
    system.homes = new Map(data.homes);
    system.territories = new Map(
      data.territories.map(([id, tiles]) => [id, new Set(tiles)])
    );
    
    system.nextSettlementId = data.nextSettlementId;
    
    return system;
  }
}
