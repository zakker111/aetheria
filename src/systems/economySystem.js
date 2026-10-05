// Economy System - Phase 2: Emergent Society
// Jobs, specialization, resource chains, and trading

export class EconomySystem {
  constructor(sim = null) {
    this.sim = sim;
    // Job definitions
    this.jobDefinitions = {
      unemployed: {
        name: 'Unemployed',
        description: 'Looking for work',
        requiredSkills: {},
        productivity: 0.5,
        wage: 0
      },
      gatherer: {
        name: 'Gatherer',
        description: 'Collects wild resources',
        requiredSkills: { gather: 1.0 },
        productivity: 1.0,
        wage: 1
      },
      farmer: {
        name: 'Farmer',
        description: 'Grows crops',
        requiredSkills: { farm: 1.5 },
        productivity: 1.5,
        wage: 2
      },
      miner: {
        name: 'Miner',
        description: 'Extracts ore from mountains',
        requiredSkills: { gather: 2.0 },
        productivity: 1.2,
        wage: 3
      },
      builder: {
        name: 'Builder',
        description: 'Constructs buildings',
        requiredSkills: { build: 2.0 },
        productivity: 1.0,
        wage: 3
      },
      lumberjack: {
        name: 'Lumberjack',
        description: 'Chops wood from forests',
        requiredSkills: { gather: 1.5 },
        productivity: 1.3,
        wage: 2
      },
      trader: {
        name: 'Trader',
        description: 'Exchanges goods between settlements',
        requiredSkills: { social: 2.0 },
        productivity: 1.0,
        wage: 4
      },
      craftsman: {
        name: 'Craftsman',
        description: 'Makes tools and items',
        // Requirements tuned so skilled builders/gatherers can qualify after
        // gaining XP on the job (previously unreachable: every agent starts at
        // skill 1.0 but the old thresholds were 2.5/1.5).
        requiredSkills: { build: 1.0, gather: 1.0 },
        productivity: 1.2,
        wage: 4
      }
    };
    
    // Agent job assignments
    this.agentJobs = new Map(); // agentId -> { job, skillLevel, experience }
    
    // Resource market prices (supply/demand)
    this.marketPrices = {
      food: 1.0,
      water: 0.5,
      wood: 2.0,
      ore: 5.0,
      tool: 10.0
    };
    
    // Settlement trade networks
    this.tradeRoutes = [];
    
    // Global resource pools per settlement
    this.settlementResources = new Map(); // settlementId -> { food, wood, ore, ... }
  }
  
  // Assign job to agent based on skills and availability
  assignJob(agent, availableJobs) {
    const bestJob = this.findBestJob(agent, availableJobs);
    
    this.agentJobs.set(agent.id, {
      job: bestJob,
      skillLevel: this.calculateSkillLevel(agent, bestJob),
      experience: 0,
      assignedAt: this.sim?.clock?.tick ?? Date.now()
    });
    
    agent.job = bestJob;
    agent.jobTitle = this.jobDefinitions[bestJob]?.name || bestJob;
    return bestJob;
  }
  
  // Find best job for agent
  findBestJob(agent, availableJobs) {
    let bestJob = 'unemployed';
    let bestScore = 0;
    
    for (const jobId of availableJobs) {
      const jobDef = this.jobDefinitions[jobId];
      if (!jobDef) continue;
      
      let score = 0;
      
      // Check if agent meets requirements
      let qualified = true;
      for (const [skill, required] of Object.entries(jobDef.requiredSkills)) {
        const agentSkill = agent.skills[skill] || 0;
        if (agentSkill < required) {
          qualified = false;
          break;
        }
        score += agentSkill / required; // Bonus for exceeding requirements
      }
      
      if (qualified) {
        // Demand weighting (deterministic, zero RNG): finished goods are the
        // scarcest commodities in the economy — every settlement stockpile
        // runs a bread/plank deficit until workshops ship product — so
        // craftsmen earn a standing bonus and traders a smaller one. This
        // guarantees workshops keep getting staffed even while food is
        // plentiful. Skill floors stay low (baseline skills start at 1.0):
        // without a craftsman pipeline the whole Phase-1 supply chain
        // (workshops -> distribution -> trade) starves.
        if (jobId === 'craftsman') score += 2.0;
        else if (jobId === 'trader') score += 1.5;
        if (score > bestScore) {
          bestScore = score;
          bestJob = jobId;
        }
      }
    }
    
    return bestJob;
  }

  // Career-change pool for bored workers: honest village trades only. A
  // specialist who wants out of their current job picks among these; the
  // sim-side demand filter may further narrow the list (e.g. don't quit
  // crafting when the workshop benches are already short-staffed).
  static CAREER_ALTERNATIVES = ['gatherer', 'farmer', 'lumberjack', 'miner', 'builder'];

  // Deterministic reassignment for an agent who *chose* to switch careers:
  // pick the highest-scoring qualified job among `candidates` (never their
  // current role), update both the economy record and the agent's own job
  // fields, and clear any stale workplace pointer. Zero RNG draws here -
  // callers roll their dice through the seeded world stream before calling.
  switchCareer(agent, candidates) {
    const pool = candidates.filter(j => j !== agent.job && this.jobDefinitions[j]);
    if (pool.length === 0) return null;
    const bestJob = this.findBestJob(agent, pool);
    if (!bestJob || bestJob === 'unemployed' || bestJob === agent.job) return null;

    this.agentJobs.set(agent.id, {
      job: bestJob,
      skillLevel: this.calculateSkillLevel(agent, bestJob),
      experience: 0,
      assignedAt: this.sim?.clock?.tick ?? 0
    });
    agent.job = bestJob;
    agent.jobTitle = this.jobDefinitions[bestJob]?.name || bestJob;
    agent.workplace = null; // roster entry released; reconcileCraftsmen prunes it
    return bestJob;
  }

  // Calculate skill level for job
  calculateSkillLevel(agent, job) {
    const jobDef = this.jobDefinitions[job];
    if (!jobDef) return 1.0;
    
    let totalRatio = 0;
    let count = 0;
    
    for (const [skill, required] of Object.entries(jobDef.requiredSkills)) {
      const agentSkill = agent.skills[skill] || 0;
      totalRatio += agentSkill / required;
      count++;
    }
    
    return count > 0 ? totalRatio / count : 1.0;
  }
  
  // Update agent's job experience
  gainExperience(agentId, amount) {
    const jobData = this.agentJobs.get(agentId);
    if (!jobData || jobData.job === 'unemployed') return;
    
    jobData.experience += amount;
    
    // Level up every 100 experience
    const levelsGained = Math.floor(jobData.experience / 100);
    if (levelsGained > 0) {
      jobData.skillLevel += levelsGained * 0.1; // 10% bonus per level
      jobData.experience = jobData.experience % 100;
    }
  }
  
  // Get agent's current job
  getAgentJob(agentId) {
    return this.agentJobs.get(agentId);
  }
  
  // Calculate production output
  calculateProduction(agent, resourceType) {
    const jobData = this.agentJobs.get(agent.id);
    if (!jobData || jobData.job === 'unemployed') return 0;
    
    const jobDef = this.jobDefinitions[jobData.job];
    
    // Check if job produces this resource
    const productionMap = {
      gatherer: ['food', 'wood'],
      farmer: ['food'],
      miner: ['ore'],
      lumberjack: ['wood'],
      crafter: ['tool']
    };
    
    if (!productionMap[jobData.job]?.includes(resourceType)) {
      return 0;
    }
    
    // Base production * skill level * personality modifier
    const baseProduction = jobDef.productivity;
    const skillBonus = jobData.skillLevel;
    const industriousBonus = agent.personality.industrious;
    
    return baseProduction * skillBonus * industriousBonus;
  }
  
  // Execute trade between agents
  executeTrade(agent1, agent2, resourceType, amount, price) {
    // Simplified trade - just transfer resources conceptually
    const totalPrice = amount * price;
    
    // Record trade event
    return {
      success: true,
      from: agent1.id,
      to: agent2.id,
      resource: resourceType,
      amount,
      price: totalPrice,
      timestamp: this.sim?.clock?.tick ?? Date.now()
    };
  }
  
  // Update market prices based on supply/demand
  updateMarketPrices(settlementResources) {
    for (const resource of Object.keys(this.marketPrices)) {
      let totalSupply = 0;
      
      for (const resources of settlementResources.values()) {
        totalSupply += resources[resource] || 0;
      }
      
      // Simple supply/demand curve
      const basePrice = this.marketPrices[resource];
      const equilibrium = 1000; // Ideal supply
      
      if (totalSupply < equilibrium * 0.5) {
        // Low supply = higher prices
        this.marketPrices[resource] = basePrice * 2.0;
      } else if (totalSupply > equilibrium * 2) {
        // High supply = lower prices
        this.marketPrices[resource] = basePrice * 0.5;
      } else {
        // Normalize toward base price
        this.marketPrices[resource] = basePrice;
      }
    }
  }
  
  // Create trade route between settlements
  createTradeRoute(settlement1, settlement2, resources) {
    this.tradeRoutes.push({
      from: settlement1,
      to: settlement2,
      resources,
      establishedAt: this.sim?.clock?.tick ?? Date.now(),
      active: true
    });
  }
  
  // Get job statistics for a settlement
  getSettlementJobStats(settlementAgentIds) {
    const stats = {};
    
    for (const jobId of Object.keys(this.jobDefinitions)) {
      stats[jobId] = 0;
    }
    
    for (const agentId of settlementAgentIds) {
      const jobData = this.agentJobs.get(agentId);
      if (jobData) {
        stats[jobData.job] = (stats[jobData.job] || 0) + 1;
      }
    }
    
    return stats;
  }
  
  // Serialize for save/load
  serialize() {
    return {
      agentJobs: Array.from(this.agentJobs.entries()),
      marketPrices: { ...this.marketPrices },
      tradeRoutes: [...this.tradeRoutes],
      settlementResources: Array.from(this.settlementResources.entries())
    };
  }
  
  static deserialize(data) {
    const system = new EconomySystem();
    
    system.agentJobs = new Map(data.agentJobs);
    system.marketPrices = data.marketPrices || { ...system.marketPrices };
    system.tradeRoutes = data.tradeRoutes || [];
    system.settlementResources = new Map(data.settlementResources);
    
    return system;
  }
}
