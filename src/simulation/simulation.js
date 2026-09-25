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
import { CombatSystem } from "../systems/combatSystem.js";
import { ConstructionSystem } from "../systems/constructionSystem.js";
import { ReligionSystem } from "../systems/religionSystem.js";
import { TradeSystem } from "../systems/tradeSystem.js";
import { AgeSystem } from "../systems/ageSystem.js";
import { FormationSystem } from "../systems/formationSystem.js";
import { InfrastructureSystem } from "../systems/infrastructureSystem.js";
import { CultureSystem } from "../systems/cultureSystem.js";
import { DiplomacySystem } from "../systems/diplomacySystem.js";
import { WarfareSystem } from "../systems/warfareSystem.js";
import { AnimalSystem } from "../systems/animalSystem.js";
import { ChronicleSystem } from "../systems/chronicleSystem.js";

export class Simulation {
  // Deterministic RNG helper: always routes through the seeded world RNG
  _rng() {
    return this.world.rng || { next: Math.random };
  }

  // Central entity intake: registers agents in the O(1) id registry so
  // getEntityById works for every spawn path (init, god powers, births).
  addAgent(agent) {
    this.agents.push(agent);
    this.world.entityRegistry.set(agent.id, agent);
    return agent;
  }

  constructor(seed = Date.now(), width = 128, height = 128, options = {}) {
    this.seed = seed;
    this.idGen = new IDGenerator();
    // Isolated per-simulation bus: no shared listeners/history across sims (determinism fix)
    this.eventBus = new EventBus({ isolated: true });
    this.clock = new SimulationClock();
    this.world = new WorldState(width, height, seed, { skipTerrain: !!options.skipInit });
    this.entityStore = new EntityStore();
    
    this.agents = [];
    this.resources = [];
    this.buildings = [];
    this.birthsThisSession = 0;
    this.deathsThisSession = 0;

    // Backward-compatibility and system cross-reference accessors
    this.entities = {
      agents: {
        get: (id) => this.agents.find(a => a.id === id) || null,
        getAll: () => this.agents
      },
      buildings: {
        get: (id) => this.buildings.find(b => b.id === id) || null,
        getAll: () => this.buildings
      },
      resources: {
        get: (id) => this.resources.find(r => r.id === id) || null,
        getAll: () => this.resources
      },
      push: (entity) => {
        if (entity?.type === 'building') {
          this.buildings.push(entity);
        } else if (entity?.type === 'resource') {
          this.resources.push(entity);
        } else if (entity?.type === 'agent') {
          this.addAgent(entity);
        }
      }
    };

    Object.defineProperty(this, 'worldState', {
      get: () => this.world,
      configurable: true
    });

    Object.defineProperty(this, 'settlements', {
      get: () => this.settlementSystem ? this.settlementSystem.settlements : new Map(),
      configurable: true
    });

    Object.defineProperty(this, 'factions', {
      get: () => this.factionSystem ? this.factionSystem.factions : new Map(),
      configurable: true
    });
    
    // Phase 1 Systems (Complete with Trade)
    this.relationshipSystem = new RelationshipSystem(this);
    this.settlementSystem = new SettlementSystem(this);
    this.economySystem = new EconomySystem(this);
    this.craftingSystem = new CraftingSystem(this);
    this.tradeSystem = new TradeSystem(this); // Automated caravans
    this.cultureSystem = new CultureSystem(this); // Emergent Culture & Traditions
    this.diplomacySystem = new DiplomacySystem(this); // Inter-realm diplomacy, alliances & treaties
    this.warfareSystem = new WarfareSystem(this); // Organized warfare, formations, sieges & plundering
    
    // Phase 2 Systems (Complete with Age/Lifecycle)
    this.ageSystem = new AgeSystem(this); // NEW: Child/elder behaviors
    
    // Phase 3 Systems (Complete with Formations)
    this.eventSystem = new EventSystem(this);
    this.factionSystem = new FactionSystem(this);
    this.formationSystem = new FormationSystem(this); // NEW: Military formations
    
    // Phase 4-6: New Systems (Construction, Combat, Religion, Infrastructure)
    this.combatSystem = new CombatSystem(this.world);
    this.constructionSystem = new ConstructionSystem(this.world);
    this.constructionSystem.simulation = this;
    this.religionSystem = new ReligionSystem(this.world);
    this.infrastructureSystem = new InfrastructureSystem(this); // NEW: Roads/bridges

    // Ecology & History: wildlife roam the wild biomes; the chronicle records
    // the world's living history (wars, plagues, founding, burnings...).
    this.animalSystem = new AnimalSystem(this);
    this.chronicleSystem = new ChronicleSystem(this);
    
    // Session statistics
    this.birthsThisSession = 0;
    this.deathsThisSession = 0;
    
    this._skipInit = !!options.skipInit;
    if (!this._skipInit) {
      this.initializeWorld();
    } else {
      // deserialize() path: still wire cross-references without consuming RNG draws
      this.world.simulation = this;
      this.world.eventBus = this.eventBus;
    }
    this.setupEventListeners();
    if (!this._skipInit) {
      this.initializeNewSystems();
    }
  }
  
  initializeNewSystems() {
    // Initialize combat stats for existing agents
    for (const agent of this.agents) {
      this.combatSystem.initCombatEntity(agent);
      this.religionSystem.initReligionEntity(agent);
    }
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
    
    // NOTE: birth relationship linking is handled synchronously in the
    // newborn-creation loop (see processAgents) — no setTimeout hack needed.

    
    // Track relationships from socializing
    this.eventBus.on("RELATIONSHIP_CHANGED", (data) => {
      this.relationshipSystem.modifyRelationship(data.agentId1, data.agentId2, {
        friendship: data.change
      });
    });
  }

  initializeWorld() {
    this.world.simulation = this;
    this.world.eventBus = this.eventBus;
    if (this.settlementSystem?.setWorld) this.settlementSystem.setWorld(this.world);

    // Populate wildlife BEFORE agents so the agent spawn stream is unchanged.
    this.animalSystem.initialPopulate();
    
    // Cluster starting agents into habitable walkable centers across the 128x128 map
    const margin = 14;
    const centers = [];
    
    for (let attempt = 0; attempt < 150 && centers.length < 3; attempt++) {
      const cx = margin + this._rng().next() * (this.world.width - margin * 2);
      const cy = margin + this._rng().next() * (this.world.height - margin * 2);
      const tx = Math.floor(cx);
      const ty = Math.floor(cy);
      if (this.world.isWalkable(tx, ty)) {
        const terrain = this.world.getTerrain(tx, ty);
        if (terrain && terrain.type !== "water" && terrain.type !== "snow") {
          const farEnough = centers.every(c => Math.hypot(c.x - cx, c.y - cy) > 24);
          if (farEnough) {
            centers.push({ x: cx, y: cy });
          }
        }
      }
    }
    
    if (centers.length === 0) {
      centers.push({ x: this.world.width / 2, y: this.world.height / 2 });
    }
    
    // Create exactly 20 initial agents in safe walkable tiles (young adults ready to build society)
    let spawned = 0;
    let attempts = 0;
    while (spawned < 20 && attempts < 600) {
      attempts++;
      const center = centers[spawned % centers.length];
      const x = center.x + (this._rng().next() - 0.5) * 14;
      const y = center.y + (this._rng().next() - 0.5) * 14;
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      if (tx >= 3 && tx < this.world.width - 3 && ty >= 3 && ty < this.world.height - 3 && this.world.isWalkable(tx, ty)) {
        const agent = new Agent(x, y, this.idGen, null, this.world.rng);
        this.addAgent(agent);
        this.world.addToSpatialIndex(tx, ty, agent);
        spawned++;
      }
    }
    
    // Found initial persistent societies at community centers
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const group = this.agents.filter(a => Math.hypot(a.x - center.x, a.y - center.y) < 18);
      if (group.length > 0) {
        const s = this.settlementSystem.foundSettlement(center.x, center.y, group);
        if (this.cultureSystem) {
          this.cultureSystem.initSettlementCulture(s);
        }
      }
    }

    // Assign active initial jobs so agents immediately start working and moving
    const startingJobs = ['lumberjack', 'miner', 'farmer', 'builder', 'gatherer', 'soldier'];
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const assigned = startingJobs[i % startingJobs.length];
      agent.job = assigned;
      agent.jobTitle = assigned.charAt(0).toUpperCase() + assigned.slice(1);
      if (this.economySystem) {
        this.economySystem.agentJobs.set(agent.id, { job: assigned, salary: 12, satisfaction: 85 });
      }
    }

    // Seed initial building projects in each community so builders immediately construct.
    // Each project is stamped with its owning settlement/faction (territorial building).
    const ownerForCenter = (cx, cy) => {
      let best = null;
      let bestD = Infinity;
      for (const s of this.settlementSystem.settlements.values()) {
        const d = Math.hypot(s.center.x - cx, s.center.y - cy);
        if (d < bestD) { bestD = d; best = s; }
      }
      return best ? { id: best.id, factionId: best.factionId ?? null } : null;
    };
    for (const center of centers) {
      const owner = ownerForCenter(center.x, center.y);
      const sid = owner ? owner.id : null;
      const fid = owner ? owner.factionId : null;
      const hx = Math.floor(center.x + 2);
      const hy = Math.floor(center.y + 2);
      if (this.world.isWalkable(hx, hy)) {
        const house = new Building(hx, hy, "house", this.idGen, sid, fid);
        house.constructionProgress = 15;
        house.complete = false;
        this.buildings.push(house);
        this.world.addToSpatialIndex(hx, hy, house);
      }
      const fx = Math.floor(center.x - 3);
      const fy = Math.floor(center.y + 2);
      if (this.world.isWalkable(fx, fy)) {
        const farm = new Building(fx, fy, "farm", this.idGen, sid, fid);
        farm.constructionProgress = 10;
        farm.complete = false;
        this.buildings.push(farm);
        this.world.addToSpatialIndex(fx, fy, farm);
      }
    }

    // Initialize diplomatic network between all founded realms
    if (this.diplomacySystem && this.settlementSystem) {
      const allSettlements = Array.from(this.settlementSystem.settlements.values());
      for (let a = 0; a < allSettlements.length; a++) {
        for (let b = a + 1; b < allSettlements.length; b++) {
          this.diplomacySystem.initRelation(allSettlements[a].id, allSettlements[b].id);
        }
      }
    }
    
    // Create resources: cluster abundant wood, water, ore, and food near communities
    for (const center of centers) {
      // 8 wood, 7 ore, 6 food right around each community
      for (const type of ["wood", "ore", "food"]) {
        const count = type === "wood" ? 8 : (type === "ore" ? 7 : 6);
        for (let k = 0; k < count; k++) {
          const rx = center.x + (this._rng().next() - 0.5) * 18;
          const ry = center.y + (this._rng().next() - 0.5) * 18;
          const tx = Math.floor(rx);
          const ty = Math.floor(ry);
          if (tx >= 2 && tx < this.world.width - 2 && ty >= 2 && ty < this.world.height - 2 && this.world.isWalkable(tx, ty)) {
            const amount = type === "ore" ? 70 : (type === "wood" ? 60 : 50);
            const res = new Resource(rx, ry, type, amount, this.idGen);
            this.resources.push(res);
            this.world.addToSpatialIndex(tx, ty, res);
          }
        }
      }
      // 5 freshwater springs near each community
      for (let k = 0; k < 5; k++) {
        const rx = center.x + (this._rng().next() - 0.5) * 14;
        const ry = center.y + (this._rng().next() - 0.5) * 14;
        const tx = Math.floor(rx);
        const ty = Math.floor(ry);
        if (tx >= 2 && tx < this.world.width - 2 && ty >= 2 && ty < this.world.height - 2 && this.world.isWalkable(tx, ty)) {
          const res = new Resource(rx, ry, "water", 100, this.idGen);
          this.resources.push(res);
          this.world.addToSpatialIndex(tx, ty, res);
        }
      }
    }
    
    // Distribute abundant biome-specific resources across the 128x128 map
    // 1. Wood (Forests & Jungles) - 220 trees
    let woodSpawned = 0;
    attempts = 0;
    while (woodSpawned < 220 && attempts < 2500) {
      attempts++;
      const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
      const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
      const terrain = this.world.getTerrain(x, y);
      if (terrain && (terrain.biome === "forest" || terrain.biome === "jungle" || terrain.type === "grass") && this.world.isWalkable(x, y)) {
        const entities = this.world.getEntitiesAt(x, y);
        if (!entities.some(e => e.type === "resource")) {
          const res = new Resource(x, y, "wood", 60, this.idGen);
          this.resources.push(res);
          this.world.addToSpatialIndex(x, y, res);
          woodSpawned++;
        }
      }
    }

    // 2. Food (Grasslands, Savannas, Plains & Riverbanks) - 180 crops
    let foodSpawned = 0;
    attempts = 0;
    while (foodSpawned < 180 && attempts < 2000) {
      attempts++;
      const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
      const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
      const terrain = this.world.getTerrain(x, y);
      if (terrain && (terrain.biome === "grassland" || terrain.biome === "savanna" || terrain.biome === "beach") && this.world.isWalkable(x, y)) {
        const entities = this.world.getEntitiesAt(x, y);
        if (!entities.some(e => e.type === "resource")) {
          const res = new Resource(x, y, "food", 50, this.idGen);
          this.resources.push(res);
          this.world.addToSpatialIndex(x, y, res);
          foodSpawned++;
        }
      }
    }

    // 3. Ore (Mountains, Highlands & Caverns) - 160 mineral veins
    let oreSpawned = 0;
    attempts = 0;
    while (oreSpawned < 160 && attempts < 2000) {
      attempts++;
      const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
      const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
      const terrain = this.world.getTerrain(x, y);
      if (terrain && (terrain.biome === "mountain" || terrain.biome === "highland" || terrain.biome === "tundra" || terrain.type === "mountain") && this.world.isWalkable(x, y)) {
        const entities = this.world.getEntitiesAt(x, y);
        if (!entities.some(e => e.type === "resource")) {
          const res = new Resource(x, y, "ore", 70, this.idGen);
          this.resources.push(res);
          this.world.addToSpatialIndex(x, y, res);
          oreSpawned++;
        }
      }
    }

    // 4. Freshwater sources across world - 60 water springs
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
      const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
      if (this.world.isWalkable(x, y)) {
        const entities = this.world.getEntitiesAt(x, y);
        if (!entities.some(e => e.type === "resource")) {
          const resource = new Resource(x, y, "water", 100, this.idGen);
          this.resources.push(resource);
          this.world.addToSpatialIndex(x, y, resource);
        }
      }
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
    this.updateCulture(); // Societies & Culture
    this.updateEconomy();
    this.updateCrafting();
    this.updateTrade(); // NEW: Trade caravans
    this.updateAging(); // NEW: Age/lifecycle
    
    // Phase 3: Update advanced systems
    this.updateEvents();
    this.updateFactions();
    this.updateDiplomacy(); // NEW: Inter-settlement diplomacy, treaties, alliances & war declarations
    this.updateWarfare(); // NEW: Warbands, tactical formations, sieges & battlefield clashes
    this.updateFormations(); // Military formations
    
    // Phase 4-6: Update new systems
    this.updateCombat();
    this.updateConstruction();
    this.updateReligion();
    this.updateInfrastructure(); // NEW: Roads/bridges

    // Ecology: wildlife roam/breed/hunt after agents move so prey flee logic
    // sees fresh positions. (Chronicle is event-driven — no per-tick update.)
    this.animalSystem.update(this.clock.tick);

    // Periodically rebuild spatial index to correct drift from moving agents
    // and prune stale entries for dead/removed entities (prevents perception
    // slowdowns and ghost entities in dense areas).
    if (this.clock.tick % 100 === 0) {
      this.world.rebuildSpatialIndex(this.agents, this.resources, this.buildings,
        this.animalSystem?.animals || []);
    }

    // Process events
    this.processEvents();
  }
  
  updateTrade() {
    // Update trade caravans and routes
    this.tradeSystem.update();
  }
  
  updateCulture() {
    // Update cultural traditions and diffusion
    if (this.cultureSystem) {
      this.cultureSystem.update(this.clock.tick);
    }
  }
  
  updateAging() {
    // Update agent aging and lifecycle events
    this.ageSystem.update();
  }
  
  updateFormations() {
    // Update military formations and territories
    this.formationSystem.update();
  }

  updateDiplomacy() {
    if (this.diplomacySystem) {
      this.diplomacySystem.update(this.clock.tick);
    }
  }

  updateWarfare() {
    if (this.warfareSystem) {
      this.warfareSystem.update();
    }
  }
  
  updateInfrastructure() {
    // Update roads, irrigation, bridges
    this.infrastructureSystem.update();
  }
  
  updateCombat() {
    // Update combat AI and battles
    this.combatSystem.update();
  }
  
  updateConstruction() {
    // Update building construction progress
    this.constructionSystem.update();
  }
  
  updateReligion() {
    // Update faith, priests, and rituals
    this.religionSystem.update();
  }

  updateEnvironment() {
    // Environment updates (weather, seasons, etc.) would go here
    // For now, just let resources regrow

    // Perf: fire layer only matters while something burns. Skip the full-map
    // scan entirely when there are no active fires (common case). Fires can
    // only be created via world.startFire(), which sets _fireActive.
    if (!this.world.fireTiles) return;
    if (!this._fireActive && this.burningTileCount === 0) return;
    this.burningTileCount = this.world.updateFires(this.clock.tick);
    if (this.burningTileCount > 0) this._fireActive = true;
    else this._fireActive = false;
    // Fires destroy buildings on burning tiles and scatter resources
    if (this.burningTileCount > 0 && this.buildings) {
      for (const b of this.buildings) {
        if (b.health > 0 && this.world.isBurning(Math.floor(b.x), Math.floor(b.y))) {
          b.health -= 2;
          if (b.health <= 0) {
            this.eventBus.emit('building_destroyed', { building: b, cause: 'fire' });
          }
        }
      }
    }
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

      // Autonomous civic planning & expansion for societies
      for (const settlement of this.settlementSystem.settlements.values()) {
        const pop = settlement.population || settlement.agentIds?.size || 0;
        
        // Elect elder / leader if none
        if (!settlement.leadership && settlement.agentIds && settlement.agentIds.size > 0) {
          const citizens = this.agents.filter(a => settlement.agentIds.has(a.id) && a.alive);
          if (citizens.length > 0) {
            citizens.sort((a, b) => b.age - a.age);
            settlement.leadership = citizens[0].name;
          }
        }
        
        // Check building needs
        const currentBuildings = this.buildings.filter(b => {
          const dist = Math.hypot(b.x - settlement.center.x, b.y - settlement.center.y);
          return dist < 22;
        });
        
        const houses = currentBuildings.filter(b => b.buildingType === "house" && b.complete);
        const workshops = currentBuildings.filter(b => b.buildingType === "workshop" && b.complete);
        const farms = currentBuildings.filter(b => b.buildingType === "farm" && b.complete);
        const temples = currentBuildings.filter(b => b.buildingType === "temple" && b.complete);
        const pending = currentBuildings.filter(b => !b.complete);
        
        // Only plan up to 2 active building projects simultaneously
        if (pending.length < 2) {
          let neededType = null;
          if (houses.length < Math.max(1, Math.ceil(pop / 3))) {
            neededType = "house";
          } else if (workshops.length === 0 && pop >= 3) {
            neededType = "workshop";
          } else if (farms.length === 0 && pop >= 4) {
            neededType = "farm";
          } else if (temples.length === 0 && pop >= 6) {
            neededType = "temple";
          } else if (houses.length < Math.ceil(pop / 2)) {
            neededType = "house";
          }

          // Civic milestone projects: towns raise a watchtower, cities a castle.
          // Deterministic RNG usage preserved (same draw pattern as before).
          const towers = currentBuildings.filter(b => (b.buildingType === "tower" || b.buildingType === "castle") && b.complete);
          if (!neededType && pop >= 8 && towers.length === 0) {
            neededType = pop >= 15 ? "castle" : "tower";
          }
          
          if (neededType) {
            // Find a suitable clear walkable tile near settlement center
            for (let a = 0; a < 25; a++) {
              const ang = this._rng().next() * Math.PI * 2;
              const r = 3 + this._rng().next() * 8;
              const bx = Math.floor(settlement.center.x + Math.cos(ang) * r);
              const by = Math.floor(settlement.center.y + Math.sin(ang) * r);
              if (bx >= 4 && bx < this.world.width - 4 && by >= 4 && by < this.world.height - 4 && this.world.isWalkable(bx, by)) {
                const occupied = this.buildings.some(b => Math.abs(b.x - bx) < 2 && Math.abs(b.y - by) < 2);
                if (!occupied) {
                  const building = new Building(bx, by, neededType, this.idGen);
                  building.constructionProgress = 0;
                  building.complete = false;
                  this.buildings.push(building);
                  this.world.addToSpatialIndex(bx, by, building);
                  if (!settlement.buildings) settlement.buildings = [];
                  settlement.buildings.push(building);
                  this.eventBus.emit("BLUEPRINT_PLACED", { 
                    type: neededType, 
                    settlementName: settlement.name, 
                    x: bx, 
                    y: by 
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }
  }
  
  updateEconomy() {
    // Assign jobs to unemployed agents in settlements and idle agents
    if (this.clock.tick % 10 === 0) {
      const availableJobs = ['gatherer', 'farmer', 'lumberjack', 'miner', 'builder', 'craftsman'];
      for (const settlement of this.settlementSystem.settlements.values()) {
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
      // Also ensure any unemployed agent receives a role
      for (const agent of this.agents) {
        if (agent.alive && (!agent.job || agent.job === 'unemployed')) {
          this.economySystem.assignJob(agent, availableJobs);
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
        // Find unemployed agents with crafting skills in or near this settlement
        let settlement = null;
        if (workshop.assignedWorkers.length > 0) {
          settlement = this.settlementSystem.getAgentSettlement(workshop.assignedWorkers[0]);
        }
        if (!settlement) {
          for (const s of this.settlementSystem.settlements.values()) {
            if (Math.hypot(s.center.x - workshop.x, s.center.y - workshop.y) < 25) {
              settlement = s;
              break;
            }
          }
        }
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
      agent.generateGoals(this, perception);
      
      // Generate and choose actions
      const actions = agent.generateActions(perception, this.world, this);
      const chosenAction = agent.chooseAction(actions);
      
      // Execute action with crafting system and simulation references
      const result = agent.executeAction(chosenAction, this.world, this.eventBus, this.craftingSystem, this);
      
      // Handle birth result
      if (result && result.type === "birth") {
        births.push({ x: result.x, y: result.y, parentId1: result.parentId1, parentId2: result.parentId2 });
      }
    }
    
    // Create newborn agents
    for (const birth of births) {
      if (this.world.isWalkable(Math.floor(birth.x), Math.floor(birth.y))) {
        const baby = new Agent(birth.x, birth.y, this.idGen, 0, this.world.rng); // Newborn baby with age 0 (seeded RNG)
        baby.lifeStage = 'child';
        baby.parents = [birth.parentId1, birth.parentId2];
        
        // Inherit some traits from parents
        const parent1 = this.agents.find(a => a.id === birth.parentId1);
        const parent2 = this.agents.find(a => a.id === birth.parentId2);
        if (parent1 && parent2) {
          baby.personality.industrious = (parent1.personality.industrious + parent2.personality.industrious) / 2;
          baby.personality.social = (parent1.personality.social + parent2.personality.social) / 2;
          baby.personality.brave = (parent1.personality.brave + parent2.personality.brave) / 2;
          baby.skills.gather = (parent1.skills.gather + parent2.skills.gather) / 2;
          baby.settlementId = parent1.settlementId || parent2.settlementId;
        }
        this.addAgent(baby);
        this.world.addToSpatialIndex(Math.floor(birth.x), Math.floor(birth.y), baby);
        this.birthsThisSession = (this.birthsThisSession || 0) + 1;
        this.eventBus.emit("AGENT_CREATED", { agentId: baby.id, name: baby.name, x: baby.x, y: baby.y, reason: "birth" });
        // Synchronously link parent-child relationships (replaces old setTimeout hack)
        this.relationshipSystem.initializeAgent(baby.id);
        if (parent1) this.relationshipSystem.addParentChild(parent1.id, baby.id);
        if (parent2) this.relationshipSystem.addParentChild(parent2.id, baby.id);
        if (parent1 && parent2) this.relationshipSystem.addChildToMarriage(parent1.id, parent2.id, baby.id);
      }
    }
    
    // Remove dead agents, transfer inheritance to settlement, and emit death events
    const deadAgents = this.agents.filter(a => !a.alive);
    for (const dead of deadAgents) {
      this.deathsThisSession = (this.deathsThisSession || 0) + 1;
      this.eventBus.emit("AGENT_DIED", { 
        agentId: dead.id, 
        name: dead.name, 
        x: dead.x, 
        y: dead.y, 
        age: Math.floor(dead.age),
        cause: dead.deathCause || "natural"
      });
      this.world.removeFromSpatialIndex(Math.floor(dead.x), Math.floor(dead.y), dead);
      
      // Stockpile inheritance to community
      if (dead.settlementId && this.settlementSystem) {
        const set = this.settlementSystem.settlements.get(dead.settlementId);
        if (set && set.stockpile) {
          set.stockpile.wood = (set.stockpile.wood || 0) + (dead.inventory.wood_log || 0);
          set.stockpile.ore = (set.stockpile.ore || 0) + (dead.inventory.ore_iron || 0);
          set.stockpile.food = (set.stockpile.food || 0) + (dead.inventory.wheat || 0) + (dead.inventory.bread || 0);
        }
      }
    }
    this.agents = this.agents.filter(a => a.alive);
  }

  updateResources() {
    for (const resource of this.resources) {
      resource.update();
    }
    
    // Natural ecological replenishment: keep the world vibrant with food, wood, and ores
    if (this.clock.tick % 40 === 0) {
      this.maintainWorldResources();
    }
  }

  maintainWorldResources() {
    let foodCount = 0;
    let woodCount = 0;
    let oreCount = 0;

    for (const r of this.resources) {
      if (r.destroyed) continue;
      if (r.resourceType === "food") foodCount++;
      else if (r.resourceType === "wood") woodCount++;
      else if (r.resourceType === "ore") oreCount++;
    }

    // Regrow wood in forests/jungles
    if (woodCount < 120) {
      const needed = Math.min(8, 120 - woodCount);
      for (let k = 0; k < needed; k++) {
        const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
        const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
        const terrain = this.world.getTerrain(x, y);
        if (terrain && (terrain.biome === "forest" || terrain.biome === "jungle") && this.world.isWalkable(x, y)) {
          const entities = this.world.getEntitiesAt(x, y);
          if (!entities.some(e => e.type === "resource")) {
            const res = new Resource(x, y, "wood", 50, this.idGen);
            this.resources.push(res);
            this.world.addToSpatialIndex(x, y, res);
          }
        }
      }
    }

    // Regrow food in grasslands/savannas/plains
    if (foodCount < 120) {
      const needed = Math.min(8, 120 - foodCount);
      for (let k = 0; k < needed; k++) {
        const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
        const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
        const terrain = this.world.getTerrain(x, y);
        if (terrain && (terrain.biome === "grassland" || terrain.biome === "savanna" || terrain.biome === "beach") && this.world.isWalkable(x, y)) {
          const entities = this.world.getEntitiesAt(x, y);
          if (!entities.some(e => e.type === "resource")) {
            const res = new Resource(x, y, "food", 45, this.idGen);
            this.resources.push(res);
            this.world.addToSpatialIndex(x, y, res);
          }
        }
      }
    }

    // Uncover ore deposits in mountains/highlands
    if (oreCount < 80) {
      const needed = Math.min(6, 80 - oreCount);
      for (let k = 0; k < needed; k++) {
        const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
        const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
        const terrain = this.world.getTerrain(x, y);
        if (terrain && (terrain.biome === "mountain" || terrain.biome === "highland" || terrain.biome === "tundra") && this.world.isWalkable(x, y)) {
          const entities = this.world.getEntitiesAt(x, y);
          if (!entities.some(e => e.type === "resource")) {
            const res = new Resource(x, y, "ore", 60, this.idGen);
            this.resources.push(res);
            this.world.addToSpatialIndex(x, y, res);
          }
        }
      }
    }
  }

  updateBuildings() {
    for (const building of this.buildings) {
      building.update();
      // Completed farms cultivate food nearby
      if (building.complete && building.buildingType === "farm" && this.clock.tick % 50 === 0) {
        const fx = Math.floor(building.x + (this._rng().next() - 0.5) * 4);
        const fy = Math.floor(building.y + (this._rng().next() - 0.5) * 4);
        if (fx >= 2 && fx < this.world.width - 2 && fy >= 2 && fy < this.world.height - 2 && this.world.isWalkable(fx, fy)) {
          const entities = this.world.getEntitiesAt(fx, fy);
          const hasFood = entities.some(e => e.type === "resource" && e.resourceType === "food");
          if (!hasFood) {
            const crop = new Resource(fx, fy, "food", 30, this.idGen);
            this.resources.push(crop);
            this.world.addToSpatialIndex(fx, fy, crop);
          }
        }
      }
    }
  }

  removeAgent(agentId) {
    const idx = this.agents.findIndex(a => a.id === agentId);
    if (idx !== -1) {
      const agent = this.agents[idx];
      agent.alive = false;
      this.deathsThisSession = (this.deathsThisSession || 0) + 1;
      this.world.removeFromSpatialIndex(Math.floor(agent.x), Math.floor(agent.y), agent);
      this.agents.splice(idx, 1);
      this.eventBus.emit("AGENT_DIED", { 
        agentId: agent.id, 
        name: agent.name, 
        x: agent.x, 
        y: agent.y, 
        age: Math.floor(agent.age),
        cause: "removed"
      });
      return true;
    }
    return false;
  }

  processEvents() {
    // Event processing (settlement founding, etc.) would go here
  }

  // God powers (doc 01: god as influence, not RTS cursor)
  createResource(x, y, resourceType, amount = 10) {
    const resource = new Resource(x, y, resourceType, amount, this.idGen);
    this.resources.push(resource);
    this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), resource);
    this.eventBus.emit("GOD_POWER_USED", { power: "create_resource", x, y, resourceType });
    return resource;
  }

  // Spawns a rich multi-node cluster of resources around a target position
  spawnResourceCluster(cx, cy, resourceType, count = 4, radius = 3.2) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const rx = i === 0 ? cx : cx + (this._rng().next() - 0.5) * radius * 2;
      const ry = i === 0 ? cy : cy + (this._rng().next() - 0.5) * radius * 2;
      const tx = Math.floor(rx);
      const ty = Math.floor(ry);
      if (tx >= 1 && tx < this.world.width - 1 && ty >= 1 && ty < this.world.height - 1 && this.world.isWalkable(tx, ty)) {
        const amount = resourceType === "water" ? 100 : (resourceType === "ore" ? 65 : 50);
        const res = new Resource(rx, ry, resourceType, amount, this.idGen);
        this.resources.push(res);
        this.world.addToSpatialIndex(tx, ty, res);
        spawned.push(res);
      }
    }
    this.eventBus.emit("GOD_POWER_USED", { power: "spawn_resource_cluster", x: cx, y: cy, resourceType, count: spawned.length });
    return spawned;
  }

  // Spawns a full nature bounty (wood, water, and ore together) around coordinates
  spawnAbundantBounty(cx, cy) {
    const w = this.spawnResourceCluster(cx - 2, cy - 1, "wood", 3, 2.5);
    const o = this.spawnResourceCluster(cx + 2, cy + 1, "ore", 3, 2.5);
    const s = this.spawnResourceCluster(cx, cy - 2, "water", 2, 2.0);
    const f = this.spawnResourceCluster(cx, cy + 2, "food", 3, 2.0);
    return [...w, ...o, ...s, ...f];
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
    const agent = new Agent(x, y, this.idGen, null, this.world.rng);
    this.addAgent(agent);
    this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), agent);
    this.eventBus.emit("GOD_POWER_USED", { power: "spawn_agent", x, y });
    return agent;
  }

  // Serialization (doc 02: persistence service)
  serialize() {
    return {
      seed: this.seed ?? this.world.seed,
      worldSeed: this.world.seed,
      rngState: this.world.rng.getState(), // determinism: restore RNG stream on load
      world: this.world.serialize(), // terrain arrays (skipTerrain load path)
      clock: this.clock.serialize(),
      idGen: this.idGen.getState(),
      agents: this.agents.map(a => a.serialize()),
      resources: this.resources.map(r => r.serialize()),
      buildings: this.buildings.map(b => b.serialize()),
      // Phase 1 systems (Complete)
      relationships: this.relationshipSystem.serialize(),
      settlements: this.settlementSystem.serialize(),
      economy: this.economySystem.serialize(),
      crafting: this.craftingSystem.serialize(),
      trade: this.tradeSystem.serialize(), // NEW: Trade routes/caravans
      // Phase 2 systems (Complete)
      age: this.ageSystem.serialize(), // NEW: Aging/lifecycle
      // Phase 3 systems (Complete)
      events: this.eventSystem.serialize(),
      factions: this.factionSystem.serialize(),
      formations: this.formationSystem.serialize(), // NEW: Military formations
      // Phase 4-6 systems (Complete)
      combat: { combatants: Array.from(this.combatSystem.combatants) },
      construction: { 
        pendingBuildings: this.constructionSystem.pendingBuildings.map(b => ({...b})),
        queue: Array.from(this.constructionSystem.constructionQueue.entries())
      },
      religion: {
        priests: Array.from(this.religionSystem.priests),
        activeRituals: Array.from(this.religionSystem.activeRituals.entries())
      },
      infrastructure: this.infrastructureSystem.serialize(), // NEW: Roads/bridges
      // Ecology & history must survive save/load or resumed worlds lose all
      // wildlife and the chronicle book.
      animals: this.animalSystem.serialize(),
      chronicle: this.chronicleSystem.serialize()
    };
  }

  static deserialize(data) {
    // skipInit: constructing a full sim would run world/entity initialization,
    // consuming RNG draws and creating default entities that then get cleared —
    // both a determinism hazard and wasted work. We restore everything from data.
    const sim = new Simulation(data.seed, 128, 128, { skipInit: true });
    if (data.rngState) {
      sim.world.rng.setState(data.rngState);
    }
    sim.clock = SimulationClock.deserialize(data.clock);
    sim.idGen.setState(data.idGen);
    
    // Clear default entities
    sim.agents = [];
    sim.resources = [];
    sim.buildings = [];

    // Restore the procedural world terrain exactly as saved (constructor with
    // skipInit did not generate it, and generation would advance the RNG).
    if (data.world) {
      sim.world.elevation = new Float32Array(data.world.elevation);
      sim.world.moisture = new Float32Array(data.world.moisture);
      sim.world.temperature = new Float32Array(data.world.temperature);
      sim.world.waterLevel = new Float32Array(data.world.waterLevel || []);
      sim.world.biome = data.world.biome || sim.world.biome;
      sim.world.riverFlow = new Float32Array(data.world.riverFlow || []);
      sim.world.isRiverSource = new Uint8Array(data.world.isRiverSource || []);
      // Road network + foot-traffic heat map are persistent ground state: without
      // restoring them, a resumed world forgets every trampled desire-path and
      // diverges from an uninterrupted run.
      sim.world.roadTiles = new Uint8Array(data.world.roadTiles || new Uint8Array(sim.world.width * sim.world.height));
      sim.world.footTraffic = new Uint16Array(data.world.footTraffic || new Uint16Array(sim.world.width * sim.world.height));
    }
    
    // Restore entities
    for (const agentData of data.agents) {
      const agent = Agent.deserialize(agentData, sim.idGen, sim.world.rng);
      sim.addAgent(agent);
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
    
    // Restore Phase 1 systems (Complete)
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
    if (data.trade) {
      sim.tradeSystem = TradeSystem.deserialize(data.trade, sim);
    }
    
    // Restore Phase 2 systems (Complete)
    if (data.age) {
      sim.ageSystem = AgeSystem.deserialize(data.age, sim);
    }
    
    // Restore Phase 3 systems (Complete)
    if (data.events) {
      sim.eventSystem = EventSystem.deserialize(data.events);
    }
    if (data.factions) {
      sim.factionSystem = FactionSystem.deserialize(data.factions);
    }
    if (data.formations) {
      sim.formationSystem = FormationSystem.deserialize(data.formations, sim);
    }
    
    // Restore Phase 4-6 systems (Complete)
    if (data.combat) {
      sim.combatSystem.combatants = new Set(data.combat.combatants);
    }
    if (data.construction) {
      sim.constructionSystem.pendingBuildings = data.construction.pendingBuildings;
      sim.constructionSystem.constructionQueue = new Map(data.construction.queue);
    }
    if (data.religion) {
      sim.religionSystem.priests = new Set(data.religion.priests);
      sim.religionSystem.activeRituals = new Map(data.religion.activeRituals);
    }
    if (data.infrastructure) {
      sim.infrastructureSystem = InfrastructureSystem.deserialize(data.infrastructure, sim);
    }

    // Restore ecology & chronicle (skipInit never populated wildlife, so the
    // saved animal list becomes the authoritative herd).
    if (data.animals) {
      sim.animalSystem = AnimalSystem.deserialize(data.animals, sim);
    }
    if (data.chronicle) {
      sim.chronicleSystem = ChronicleSystem.deserialize(data.chronicle, sim);
    }

    return sim;
  }
}
