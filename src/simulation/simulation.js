// Main simulation orchestrator (doc 03: high-level tick order)
import { WorldState } from "../core/worldState.js";
import { SimulationClock } from "./clock.js";
import { EntityStore } from "./entityStore.js";
import { EventBus } from "../core/eventBus.js";
import { IDGenerator } from "../core/idGen.js";
import { Agent } from "./agent.js";
import { Resource } from "./resource.js";
import { Building } from "./building.js";

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
    
    this.initializeWorld();
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
    
    // Process events
    this.processEvents();
  }

  updateEnvironment() {
    // Environment updates (weather, seasons, etc.) would go here
    // For now, just let resources regrow
  }

  updateAgents() {
    const allEntities = [...this.agents, ...this.resources, ...this.buildings];
    
    for (const agent of this.agents) {
      if (!agent.alive) continue;
      
      // Update needs
      agent.updateNeeds();
      
      // Perceive world
      const perception = agent.perceive(this.world, allEntities);
      
      // Generate goals
      agent.generateGoals();
      
      // Generate and choose actions
      const actions = agent.generateActions(perception);
      const chosenAction = agent.chooseAction(actions);
      
      // Execute action
      agent.executeAction(chosenAction, this.world, this.eventBus);
    }
    
    // Remove dead agents
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
      buildings: this.buildings.map(b => b.serialize())
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
    
    return sim;
  }
}
