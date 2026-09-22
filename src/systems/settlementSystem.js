// Settlement System - Phase 2: Emergent Society
// Detects settlements, tracks growth, manages homes and territory

export class SettlementSystem {
  constructor() {
    // All settlements
    this.settlements = new Map(); // settlementId -> settlement data
    
    // Agent to settlement mapping
    this.agentSettlementMap = new Map(); // agentId -> settlementId
    
    // Home locations (agentId -> home position)
    this.homes = new Map();
    
    // Territory claims (settlementId -> Set of tile coordinates)
    this.territories = new Map();
    
    // Settlement naming
    this.settlementNames = [
      'Oakwood', 'Riverside', 'Stonehold', 'Greenfield', 'Hillcrest',
      'Brookhaven', 'Timberland', 'Meadowbrook', 'Fairview', 'Clearwater',
      'Shadowfen', 'Brightdale', 'Ironforge', 'Windmere', 'Thornbury'
    ];
    
    this.nextSettlementId = 1;
  }
  
  // Check if agents form a settlement (clustering detection)
  detectSettlements(agents, world) {
    const visited = new Set();
    const clusters = [];
    
    // Simple clustering: agents within distance threshold
    for (const agent of agents) {
      if (!agent.alive || visited.has(agent.id)) continue;
      
      const cluster = [agent];
      visited.add(agent.id);
      
      // Find nearby agents
      for (const other of agents) {
        if (!other.alive || visited.has(other.id)) continue;
        
        const dx = other.x - agent.x;
        const dy = other.y - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 15) { // Settlement radius threshold
          cluster.push(other);
          visited.add(other.id);
        }
      }
      
      if (cluster.length >= 3) { // Minimum population for settlement
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }
  
  // Create or update settlement from cluster
  updateSettlements(clusters, agents) {
    const newSettlements = new Map();
    
    for (const cluster of clusters) {
      // Calculate center
      let centerX = 0, centerY = 0;
      for (const agent of cluster) {
        centerX += agent.x;
        centerY += agent.y;
      }
      centerX /= cluster.length;
      centerY /= cluster.length;
      
      // Find existing nearby settlement
      let existingSettlement = null;
      for (const [id, settlement] of this.settlements) {
        const dx = settlement.center.x - centerX;
        const dy = settlement.center.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 20) { // Merge threshold
          existingSettlement = settlement;
          break;
        }
      }
      
      if (existingSettlement) {
        // Update existing settlement
        existingSettlement.center = { x: centerX, y: centerY };
        existingSettlement.population = cluster.length;
        existingSettlement.agentIds = new Set(cluster.map(a => a.id));
        
        // Update growth trend
        if (cluster.length > existingSettlement.previousPopulation) {
          existingSettlement.growthTrend = 'growing';
        } else if (cluster.length < existingSettlement.previousPopulation) {
          existingSettlement.growthTrend = 'declining';
        }
        existingSettlement.previousPopulation = cluster.length;
        
        newSettlements.set(existingSettlement.id, existingSettlement);
        
        // Map agents to settlement
        for (const agent of cluster) {
          this.agentSettlementMap.set(agent.id, existingSettlement.id);
        }
      } else {
        // Create new settlement
        const id = this.nextSettlementId++;
        const name = this.generateSetName();
        
        const settlement = {
          id,
          name,
          center: { x: centerX, y: centerY },
          population: cluster.length,
          agentIds: new Set(cluster.map(a => a.id)),
          foundedAt: Date.now(),
          growthTrend: 'stable',
          previousPopulation: cluster.length,
          buildings: [],
          resources: {
            food: 0,
            wood: 0,
            ore: 0
          },
          stockpile: { // Alias for compatibility with trade system
            food: 0,
            wood: 0,
            stone: 0,
            ore: 0
          },
          leadership: null,
          culture: {
            traditions: [],
            beliefs: []
          }
        };
        
        newSettlements.set(id, settlement);
        this.settlements.set(id, settlement);
        
        // Map agents to settlement
        for (const agent of cluster) {
          this.agentSettlementMap.set(agent.id, id);
        }
      }
    }
    
    // Remove abandoned settlements
    for (const [id, settlement] of this.settlements) {
      if (!newSettlements.has(id)) {
        // Settlement disbanded
        for (const agentId of settlement.agentIds) {
          this.agentSettlementMap.delete(agentId);
        }
        this.settlements.delete(id);
      } else {
        // Sync stockpile with resources for existing settlements
        const updated = newSettlements.get(id);
        if (updated && !updated.stockpile) {
          updated.stockpile = {
            food: updated.resources?.food || 0,
            wood: updated.resources?.wood || 0,
            stone: updated.resources?.stone || 0,
            ore: updated.resources?.ore || 0
          };
        }
      }
    }
    
    this.settlements = newSettlements;
  }
  
  // Generate unique settlement name
  generateSetName() {
    const baseName = this.settlementNames[Math.floor(Math.random() * this.settlementNames.length)];
    const suffixes = ['', ' Village', ' Town', ' Hold', ' Keep', ' Landing'];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${baseName}${suffix}`;
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
      this.claimTerritory(settlementId, x, y, 5);
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
    
    // Calculate total stored resources
    let totalFood = 0, totalWood = 0, totalOre = 0;
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
    
    // Base consumption per agent per tick
    const baseRates = {
      food: 0.01,   // Each agent consumes 0.01 food per tick
      wood: 0.005,  // Wood for heating/maintenance
      stone: 0.002, // Stone for construction
      ore: 0.003    // Ore for tools/weapons
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
