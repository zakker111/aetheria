// Main simulation orchestrator (doc 03: high-level tick order)
import { WorldState } from "../core/worldState.js";
import { SimulationClock } from "./clock.js";
import { EntityStore } from "./entityStore.js";
import { EventBus } from "../core/eventBus.js";
import { IDGenerator } from "../core/idGen.js";
import { Agent } from "./agent.js";
import { Resource } from "./resource.js";
import { Building } from "./building.js";
import { RelationshipSystem } from "../systems/relationshipSystem.js";
import { SettlementSystem } from "../systems/settlementSystem.js";
import { EconomySystem } from "../systems/economySystem.js";
import { EventSystem } from "../systems/eventSystem.js";
import { FactionSystem } from "../systems/factionSystem.js";
import { CraftingSystem } from "../systems/craftingSystem.js";

export class Simulation {
  constructor(seed = Date.now()) {
    this.idGen = new IDGenerator();
    this.eventBus = new EventBus();
    this.clock = new SimulationClock();
    this.world = new WorldState(64, 64, seed);
    this.entityStore = new EntityStore();
    
    this.agents = [];
    this.resources = [];
    this.buildings = [];
    
    // Phase 2 Systems
    this.relationshipSystem = new RelationshipSystem();
    this.settlementSystem = new SettlementSystem();
    this.economySystem = new EconomySystem();
    this.craftingSystem = new CraftingSystem(this);
    
    // Phase 3 Systems
    this.eventSystem = new EventSystem();
    this.factionSystem = new FactionSystem();
    
    // Session statistics
    this.birthsThisSession = 0;
    this.deathsThisSession = 0;
    
    this.initializeWorld();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Track births and deaths for statistics
    this.eventBus.on("AGENT_CREATED", (data) => {
      if (data.reason === "birth") {
        this.birthsThisSession++;
      }
    });
    
    this.eventBus.on("AGENT_DIED", (data) => {
      this.deathsThisSession++;
      console.log(`Agent ${data.agentId} died at age ${data.age.toFixed(1)} days`);
    });
    
    this.eventBus.on("AGENT_BORN", (data) => {
      console.log(`Baby born to agents ${data.parentId1} and ${data.parentId2} at (${data.x.toFixed(1)}, ${data.y.toFixed(1)})`);
      
      // Initialize relationship tracking for newborn
      this.relationshipSystem.initializeAgent(data.parentId1);
      this.relationshipSystem.initializeAgent(data.parentId2);
      
      // Create baby agent first (it exists in agents array by now)
      setTimeout(() => {
        const baby = this.agents.find(a => Math.abs(a.x - data.x) < 0.1 && Math.abs(a.y - data.y) < 0.1);
        if (baby) {
          this.relationshipSystem.initializeAgent(baby.id);
          this.relationshipSystem.addParentChild(data.parentId1, baby.id);
          this.relationshipSystem.addParentChild(data.parentId2, baby.id);
          this.relationshipSystem.addChildToMarriage(data.parentId1, data.parentId2, baby.id);
        }
      }, 10);
    });
    
    // Track relationships from socializing
    this.eventBus.on("RELATIONSHIP_CHANGED", (data) => {
      this.relationshipSystem.modifyRelationship(data.agentId1, data.agentId2, {
        friendship: data.change
      });
    });
  }

  initializeWorld() {
    // Create initial agents
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * this.world.width;
      const y = Math.random() * this.world.height;
      if (this.world.isWalkable(Math.floor(x), Math.floor(y))) {
        const agent = new Agent(x, y, this.idGen);
        this.agents.push(agent);
        this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), agent);
      }
    }
    
    // Create resources
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * this.world.width;
      const y = Math.random() * this.world.height;
      if (this.world.isWalkable(Math.floor(x), Math.floor(y))) {
        const types = ["food", "wood", "ore"];
        const resourceType = types[Math.floor(Math.random() * types.length)];
        const resource = new Resource(x, y, resourceType, 10, this.idGen);
        this.resources.push(resource);
        this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), resource);
      }
    }
    
    // Create water sources
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * this.world.width;
      const y = Math.random() * this.world.height;
      const resource = new Resource(x, y, "water", 100, this.idGen);
      this.resources.push(resource);
      this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), resource);
    }
  }

  // Main simulation tick (doc 03: high-level tick order)
  tick() {
    this.clock.advance();
    
    // Update environment
    this.updateEnvironment();
    
    // Update agents
    this.updateAgents();
    
    // Update resources
    this.updateResources();
    
    // Update buildings
    this.updateBuildings();
    
    // Phase 2: Update emergent systems
    this.updateRelationships();
    this.updateSettlements();
    this.updateEconomy();
    this.updateCrafting();
    
    // Phase 3: Update advanced systems
    this.updateEvents();
    this.updateFactions();
    
    // Process events
    this.processEvents();
  }

  updateEnvironment() {
    // Environment updates (weather, seasons, etc.) would go here
    // For now, just let resources regrow
  }
  
  updateRelationships() {
    // Decay relationships over time
    this.relationshipSystem.decayRelationships(1);
  }
  
  updateSettlements() {
    // Detect and update settlements every 10 ticks
    if (this.clock.tick % 10 === 0) {
      const clusters = this.settlementSystem.detectSettlements(this.agents, this.world);
      this.settlementSystem.updateSettlements(clusters, this.agents);
      
      // Try to assign homes to settled agents
      for (const cluster of clusters) {
        for (const agent of cluster) {
          const settlement = this.settlementSystem.getAgentSettlement(agent.id);
          if (settlement && !this.settlementSystem.getAgentHome(agent.id)) {
            // Agent claims a home near their position
            this.settlementSystem.claimHome(agent.id, agent.x, agent.y, settlement.id);
          }
        }
      }
    }
  }
  
  updateEconomy() {
    // Assign jobs to unemployed agents in settlements
    if (this.clock.tick % 20 === 0) {
      for (const settlement of this.settlementSystem.settlements.values()) {
        const availableJobs = ['gatherer', 'farmer', 'lumberjack', 'miner', 'builder', 'craftsman'];
        
        for (const agentId of settlement.agentIds) {
          const agent = this.agents.find(a => a.id === agentId);
          if (agent && agent.alive) {
            const currentJob = this.economySystem.getAgentJob(agentId);
            if (!currentJob || currentJob.job === 'unemployed') {
              this.economySystem.assignJob(agent, availableJobs);
            }
          }
        }
      }
    }
    
    // Update market prices periodically
    if (this.clock.tick % 50 === 0) {
      const settlementResources = new Map();
      for (const [id, settlement] of this.settlementSystem.settlements) {
        const stats = this.settlementSystem.getSettlementStats(id);
        if (stats) {
          settlementResources.set(id, {
            food: stats.totalFood,
            wood: stats.totalWood,
            ore: stats.totalOre
          });
        }
      }
      this.economySystem.updateMarketPrices(settlementResources);
    }
  }
  
  updateCrafting() {
    // Update all workshops and crafting progress
    this.craftingSystem.update();
    
    // Auto-assign craftsmen to workshops every 30 ticks
    if (this.clock.tick % 30 === 0) {
      this.craftingSystem.workshops.forEach((workshop, workshopId) => {
        // Find unemployed agents with crafting skills in this settlement
        const settlement = this.settlementSystem.getAgentSettlement(workshop.assignedWorkers[0]);
        if (settlement) {
          for (const agentId of settlement.agentIds) {
            const agent = this.agents.find(a => a.id === agentId);
            if (agent && agent.alive && !agent.workplace) {
              const jobInfo = this.economySystem.getAgentJob(agentId);
              if (jobInfo && jobInfo.job === 'craftsman') {
                this.craftingSystem.assignWorker(workshopId, agentId);
              }
            }
          }
        }
      });
    }
  }
  
  updateEvents() {
    // Check for new random events
    if (this.clock.tick % 50 === 0) {
      const newEvent = this.eventSystem.checkForNewEvents(
        this.clock.tick,
        this.agents,
        Array.from(this.settlementSystem.settlements.values()),
        this.world
      );
      
      if (newEvent) {
        this.eventSystem.applyEventEffects(newEvent, this);
        console.log(`EVENT: ${newEvent.name} - ${newEvent.description}`);
        this.eventBus.emit("EVENT_OCCURRED", newEvent);
      }
    }
    
    // Update ongoing event effects
    this.eventSystem.updateActiveEvents(this.clock.tick, this);
  }
  
  updateFactions() {
    // Check for new faction formation every 100 ticks
    if (this.clock.tick % 100 === 0 && this.agents.length > 10) {
      const newFactions = this.factionSystem.checkForNewFactions(
        this.agents,
        this.relationshipSystem
      );
      
      for (const faction of newFactions) {
        console.log(`FACTION FOUNDED: ${faction.name} by agent ${faction.founderId}`);
      }
    }
    
    // Recruit members every 30 ticks
    if (this.clock.tick % 30 === 0) {
      this.factionSystem.recruitMembers(
        this.agents,
        this.settlementSystem.settlements,
        this.relationshipSystem
      );
    }
    
    // Update diplomacy every 50 ticks
    if (this.clock.tick % 50 === 0) {
      this.factionSystem.updateDiplomacy();
    }
    
    // Process conflicts every 20 ticks
    if (this.clock.tick % 20 === 0) {
      this.factionSystem.processConflicts(this.agents, this.settlementSystem);
    }
    
    // Evolve beliefs every 100 ticks
    if (this.clock.tick % 100 === 0) {
      this.factionSystem.evolveBeliefs(this.agents);
    }
  }

  updateAgents() {
    const births = [];
    
    for (const agent of this.agents) {
      if (!agent.alive) continue;
      
      // Update needs (includes aging and death check)
      agent.updateNeeds();
      
      // Perceive world using spatial index (much more efficient than passing all entities)
      const perception = agent.perceive(this.world, []);
      
      // Generate goals
      agent.generateGoals();
      
      // Generate and choose actions
      const actions = agent.generateActions(perception);
      const chosenAction = agent.chooseAction(actions);
      
      // Execute action with crafting system reference
      const result = agent.executeAction(chosenAction, this.world, this.eventBus, this.craftingSystem);
      
      // Handle birth result
      if (result && result.type === "birth") {
        births.push({ x: result.x, y: result.y, parentId1: result.parentId1, parentId2: result.parentId2 });
      }
    }
    
    // Create newborn agents
    for (const birth of births) {
      if (this.world.isWalkable(Math.floor(birth.x), Math.floor(birth.y))) {
        const baby = new Agent(birth.x, birth.y, this.idGen);
        // Inherit some traits from parents
        const parent1 = this.agents.find(a => a.id === birth.parentId1);
        const parent2 = this.agents.find(a => a.id === birth.parentId2);
        if (parent1 && parent2) {
          baby.personality.industrious = (parent1.personality.industrious + parent2.personality.industrious) / 2;
          baby.personality.social = (parent1.personality.social + parent2.personality.social) / 2;
          baby.personality.brave = (parent1.personality.brave + parent2.personality.brave) / 2;
          baby.skills.gather = (parent1.skills.gather + parent2.skills.gather) / 2;
        }
        this.agents.push(baby);
        this.world.addToSpatialIndex(Math.floor(birth.x), Math.floor(birth.y), baby);
        this.eventBus.emit("AGENT_CREATED", { agentId: baby.id, x: baby.x, y: baby.y, reason: "birth" });
      }
    }
    
    // Remove dead agents and emit death events
    const deadAgents = this.agents.filter(a => !a.alive);
    for (const dead of deadAgents) {
      this.eventBus.emit("AGENT_DIED", { agentId: dead.id, x: dead.x, y: dead.y, age: dead.age });
      this.world.removeFromSpatialIndex(Math.floor(dead.x), Math.floor(dead.y), dead);
    }
    this.agents = this.agents.filter(a => a.alive);
  }

  updateResources() {
    for (const resource of this.resources) {
      resource.update();
    }
    
    // Remove depleted resources
    this.resources = this.resources.filter(r => r.amount > 0);
  }

  updateBuildings() {
    for (const building of this.buildings) {
      building.update();
    }
  }

  processEvents() {
    // Event processing (settlement founding, etc.) would go here
  }

  // God powers (doc 01: god as influence, not RTS cursor)
  createResource(x, y, resourceType, amount = 10) {
    const resource = new Resource(x, y, resourceType, amount, this.idGen);
    this.resources.push(resource);
    this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), resource);
    this.eventBus.emit("GOD_POWER_USED", { power: "create_resource", x, y });
    return resource;
  }

  removeResource(x, y) {
    const entities = this.world.getEntitiesAt(Math.floor(x), Math.floor(y));
    const resource = entities.find(e => e.type === "resource");
    if (resource) {
      this.resources = this.resources.filter(r => r.id !== resource.id);
      this.world.removeFromSpatialIndex(Math.floor(x), Math.floor(y), resource);
      this.eventBus.emit("GOD_POWER_USED", { power: "remove_resource", x, y });
    }
  }

  spawnAgent(x, y) {
    const agent = new Agent(x, y, this.idGen);
    this.agents.push(agent);
    this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), agent);
    this.eventBus.emit("GOD_POWER_USED", { power: "spawn_agent", x, y });
    return agent;
  }

  // Serialization (doc 02: persistence service)
  serialize() {
    return {
      seed: this.world.seed,
      clock: this.clock.serialize(),
      idGen: this.idGen.getState(),
      agents: this.agents.map(a => a.serialize()),
      resources: this.resources.map(r => r.serialize()),
      buildings: this.buildings.map(b => b.serialize()),
      // Phase 2 systems
      relationships: this.relationshipSystem.serialize(),
      settlements: this.settlementSystem.serialize(),
      economy: this.economySystem.serialize(),
      crafting: this.craftingSystem.serialize(),
      // Phase 3 systems
      events: this.eventSystem.serialize(),
      factions: this.factionSystem.serialize()
    };
  }

  static deserialize(data) {
    const sim = new Simulation(data.seed);
    sim.clock = SimulationClock.deserialize(data.clock);
    sim.idGen.setState(data.idGen);
    
    // Clear default entities
    sim.agents = [];
    sim.resources = [];
    sim.buildings = [];
    
    // Restore entities
    for (const agentData of data.agents) {
      const agent = Agent.deserialize(agentData, sim.idGen);
      sim.agents.push(agent);
      sim.world.addToSpatialIndex(Math.floor(agent.x), Math.floor(agent.y), agent);
    }
    
    for (const resourceData of data.resources) {
      const resource = Resource.deserialize(resourceData, sim.idGen);
      sim.resources.push(resource);
      sim.world.addToSpatialIndex(Math.floor(resource.x), Math.floor(resource.y), resource);
    }
    
    for (const buildingData of data.buildings) {
      const building = Building.deserialize(buildingData, sim.idGen);
      sim.buildings.push(building);
      sim.world.addToSpatialIndex(Math.floor(building.x), Math.floor(building.y), building);
    }
    
    // Restore Phase 2 systems
    if (data.relationships) {
      sim.relationshipSystem = RelationshipSystem.deserialize(data.relationships);
    }
    if (data.settlements) {
      sim.settlementSystem = SettlementSystem.deserialize(data.settlements);
    }
    if (data.economy) {
      sim.economySystem = EconomySystem.deserialize(data.economy);
    }
    if (data.crafting) {
      sim.craftingSystem = CraftingSystem.deserialize(data.crafting, sim);
    }
    
    // Restore Phase 3 systems
    if (data.events) {
      sim.eventSystem = EventSystem.deserialize(data.events);
    }
    if (data.factions) {
      sim.factionSystem = FactionSystem.deserialize(data.factions);
    }
    
    return sim;
  }
}
