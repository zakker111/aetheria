// Main simulation orchestrator (doc 03: high-level tick order)
import { WorldState } from "../core/worldState.js";
import { RNG } from "../core/rng.js";

import { SimulationClock } from "./clock.js";
import { EventBus } from "../core/eventBus.js";
import { IDGenerator } from "../core/idGen.js";
import { Agent } from "./agent.js";
import { Resource } from "./resource.js";
import { Building } from "./building.js";
import { GroundItem } from "./groundItem.js";
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
import { CivilizationAgeSystem } from "../systems/civilizationAgeSystem.js";
import { WeatherSystem } from "../systems/weatherSystem.js";
import { DynastySystem } from "../systems/dynastySystem.js";
import { NavalSystem } from "../systems/navalSystem.js";
import { EspionageSystem } from "../systems/espionageSystem.js";
import { FortificationSystem } from "../systems/fortificationSystem.js";

export class Simulation {
  // Deterministic RNG helper: always routes through the seeded world RNG.
  // The fallback is a lazily-created fixed-seed stream (never Math.random)
  // so standalone/test usage stays reproducible.
  _rng() {
    // Determinism: every randomness consumer in a Simulation must share ONE
    // stream object. Agents hold a live reference to world.rng from birth and
    // mutate that object's state with each draw; if any code path ever swaps
    // world.rng for a new object, agents keep drawing on the orphan while the
    // sim draws on the replacement and the run forks. `_agentRng` caches the
    // canonical stream so _rng() always returns the very object the agents
    // were wired to — even after a deserialization replaced world.rng.
    if (this.world.rng && this._agentRng !== this.world.rng) {
      if (!this._agentRng) {
        this._agentRng = this.world.rng; // first use: adopt as canonical
      } else {
        this.world.rng = this._agentRng; // re-point the world at the shared stream
      }
    }
    if (this._agentRng) return this._agentRng;
    if (!this._fallbackRng) this._fallbackRng = new RNG(0);
    return this._fallbackRng;
  }

  // Central entity intake: registers agents in the O(1) id registry so
  // getEntityById works for every spawn path (init, god powers, births).
  addAgent(agent) {
    this.agents.push(agent);
    this.world.entityRegistry.set(agent.id, agent);
    // Perf: keep the id -> array-slot map in sync so _agentById() resolves
    // citizens in O(1) instead of scanning the whole roster per lookup.
    this._agentIdMap.set(agent.id, this.agents.length - 1);
    // Back-reference so memory recency reads the sim clock and remember()
    // can file dyadic memories into the shared RelationshipSystem.
    agent.sim = this;
    return agent;
  }

  // Perf: O(1) agent lookup by id via the slot map maintained by addAgent /
  // compactAgents / removeAgent. Falls back to a one-time linear rebuild if
  // an external code path ever swapped this.agents wholesale (then self-heals
  // on the next compaction). Returns null when the id is unknown or the
  // mapped slot drifted — callers treat that like a failed find().
  _agentById(id) {
    const idx = this._agentIdMap.get(id);
    if (idx !== undefined) {
      const a = this.agents[idx];
      if (a && a.id === id) return a;
    }
    this._rebuildAgentIdMap();
    const idx2 = this._agentIdMap.get(id);
    if (idx2 === undefined) return null;
    const a2 = this.agents[idx2];
    return a2 && a2.id === id ? a2 : null;
  }

  _rebuildAgentIdMap() {
    this._agentIdMap.clear();
    for (let i = 0; i < this.agents.length; i++) {
      this._agentIdMap.set(this.agents[i].id, i);
    }
  }

  // Perf: replace `this.agents = this.agents.filter(...)` (allocates a new
  // array every tick) with in-place compaction that preserves element order,
  // then refresh the id -> slot map once. Behaviorally identical.
  compactAgents(predicate) {
    let w = 0;
    for (let r = 0; r < this.agents.length; r++) {
      const a = this.agents[r];
      if (predicate(a)) this.agents[w++] = a;
    }
    this.agents.length = w;
    this._rebuildAgentIdMap();
  }

  constructor(seed = Date.now(), width = 128, height = 128, options = {}) {
    this.seed = seed;
    // Step H: Warring scenario is active by default and always on.
    this._scenario = (options.scenario !== undefined && options.scenario !== null) ? options.scenario : 'warring';
    this.idGen = new IDGenerator();
    // Isolated per-simulation bus: no shared listeners/history across sims (determinism fix)
    this.eventBus = new EventBus({ isolated: true });
    this.clock = new SimulationClock();
    this.world = new WorldState(width, height, seed, { skipTerrain: !!options.skipInit });
    
    this.agents = [];
    this.maxAgents = options.maxAgents ?? 360;
    // Perf: id -> array-slot index for this.agents (kept in sync by addAgent,
    // compactAgents and removeAgent). Backs the O(1) _agentById() lookups that
    // replace the hot-path `agents.find(a => a.id === ...)` linear scans.
    this._agentIdMap = new Map();
    this.resources = [];
    this.buildings = [];
    // Perf: cached shortlist of unfinished construction sites, rebuilt once
    // per tick at the start of updateAgents(). Agents scan this instead of
    // the full buildings + pendingBuildings lists (O(agents x buildings) ->
    // O(buildings) per tick). Pure data - no RNG involved, determinism-safe.
    this.incompleteBuildings = [];
    this._incompleteBuildingsTick = -1;
    // Ground loot piles (Phase 1 deep economy): dropped by the dead, scavenged
    // by the living. Kept out of the spatial index; scanned directly per tick.
    this.groundItems = [];
    // Career-change ("boredom") state: the 60-tick re-hire window below is a
    // determinism guard so released workers never churn every economy pass;
    // the demand snapshot is recomputed once per pass and read by the
    // boredom sweep (e.g. craftsmen only quit when benches are already full).
    this._jobDemand = { needsBuilders: new Set(), needsFood: new Set(), craftsmanSurplus: new Set() };
    // Anti-churn guard: counts forced re-hires per agent. After a few failed
    // job hunts an agent settles into their role permanently (see below).
    this._jobChangeCount = new Map();
    this.birthsThisSession = 0;
    this.deathsThisSession = 0;
    this.fallenHeroes = [];
    this._deadDossiers = [];
    this.mortalityStats = {
      totalDeaths: 0,
      totalAgeAtDeath: 0,
      averageAgeAtDeath: 0,
      minAgeAtDeath: 0,
      maxAgeAtDeath: 0,
      causes: {}
    };

    // High-agent performance scaling & Spatial LOD (1,000-2,500 agents)
    this.viewportBounds = null;
    this.lodEnabled = true;
    this.selectedEntityId = null;
    this.lodStats = {
      tier0: 0,
      tier1: 0,
      tier2: 0,
      total: 0,
      tickedThisFrame: 0,
      lastTickMs: 0,
      avgTickMs: 0
    };

    // Backward-compatibility and system cross-reference accessors
    this.entities = {
      agents: {
        get: (id) => this._agentById(id),
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
          // Legacy plain-object workshop stubs are not Building instances;
          // the crafting system tracks them in its own workshops map, so we
          // must NOT push them into this.buildings (updateBuildings would
          // crash on building.update()). Only real Building entities belong.
          if (typeof entity.update === 'function' && typeof entity.serialize === 'function') {
            this.buildings.push(entity);
          }
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
    this.religionSystem = new ReligionSystem(this.world, this);
    this.infrastructureSystem = new InfrastructureSystem(this); // NEW: Roads/bridges

    // Ecology & History: wildlife roam the wild biomes; the chronicle records
    // the world's living history (wars, plagues, founding, burnings...).
    this.animalSystem = new AnimalSystem(this);
    this.chronicleSystem = new ChronicleSystem(this);
    this.civilizationAgeSystem = new CivilizationAgeSystem(this);
    this.weatherSystem = new WeatherSystem(this);
    this.dynastySystem = new DynastySystem(this);
    this.navalSystem = new NavalSystem(this);
    this.espionageSystem = new EspionageSystem(this);
    this.fortificationSystem = new FortificationSystem(this);
    
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
      if (typeof data.age === 'number' && Number.isFinite(data.age)) {
        this.mortalityStats.totalDeaths++;
        this.mortalityStats.totalAgeAtDeath += data.age;
        this.mortalityStats.averageAgeAtDeath = this.mortalityStats.totalAgeAtDeath / this.mortalityStats.totalDeaths;
        if (this.mortalityStats.minAgeAtDeath === 0 || data.age < this.mortalityStats.minAgeAtDeath) {
          this.mortalityStats.minAgeAtDeath = data.age;
        }
        if (data.age > this.mortalityStats.maxAgeAtDeath) {
          this.mortalityStats.maxAgeAtDeath = data.age;
        }
        const cause = data.cause || 'natural';
        this.mortalityStats.causes[cause] = (this.mortalityStats.causes[cause] || 0) + 1;
      }
      const fallenAgent = this._agentById(data.agentId);
      if (fallenAgent && ((fallenAgent.kills || 0) >= 1 || fallenAgent.isMonarch || fallenAgent.legendaryWeapon)) {
        const sName = fallenAgent.settlementId
          ? (this.settlementSystem?.settlements?.get(fallenAgent.settlementId)?.name || 'Wilds')
          : 'Wilds';
        if (!this.fallenHeroes.some(h => h.id === fallenAgent.id)) {
          this.fallenHeroes.push({
            id: fallenAgent.id,
            name: fallenAgent.name,
            epithet: fallenAgent.epithet || (fallenAgent.isMonarch ? 'Sovereign' : null),
            legendaryWeapon: fallenAgent.legendaryWeapon || null,
            kills: fallenAgent.kills || 0,
            battlesFought: fallenAgent.battlesFought || 0,
            settlementName: sName,
            isMonarch: !!fallenAgent.isMonarch,
            age: Math.floor(fallenAgent.age || data.age || 0),
            deathTick: this.clock?.tick ?? 0,
            cause: data.cause || 'natural',
            x: fallenAgent.x,
            y: fallenAgent.y
          });
          this.fallenHeroes.sort((a, b) => (b.kills - a.kills) || ((b.isMonarch ? 1 : 0) - (a.isMonarch ? 1 : 0)) || (a.id - b.id));
          if (this.fallenHeroes.length > 24) this.fallenHeroes.length = 24;
        }
      }
      if (this.dynastySystem) {
        this.dynastySystem.onAgentDied({ id: data.agentId, name: data.name }, data.cause || "natural");
      }
      // Memory: nearby survivors witness the death and remember it (trauma).
      if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
        const tick = this.clock?.tick ?? 0;
        // Determinism: ID-canonical shared scan — witness memory insertion order
        // must not depend on spatial-index insertion order (fresh vs resumed).
        const witnessNear = typeof this.world._getScan === "function"
          ? this.world._getScan(Math.floor(data.x), Math.floor(data.y), 6)
          : this.world.getEntitiesNear(Math.floor(data.x), Math.floor(data.y), 6);
        for (const other of witnessNear) {
          if (other.type === "agent" && other.alive && other.id !== data.agentId && typeof other.remember === "function") {
            other.remember("WITNESSED_DEATH", tick, { subjectId: data.agentId, cause: data.cause || "unknown", rep: -1 });
          }
        }
      }
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
    
    for (let attempt = 0; attempt < 250 && centers.length < 3; attempt++) {
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

    // Step H: "warring kingdoms" starter scenario — turn the founding towns
    // into hereditary rivals. Pure bookkeeping (no RNG draws), so default
    // worlds are byte-identical to before; only opted-in scenarios diverge.
    if (this._scenario === 'warring') {
      this.applyWarringScenario();
    }

    // Assign active initial jobs so agents immediately start working and moving
    const startingJobs = ['lumberjack', 'miner', 'farmer', 'builder', 'gatherer', 'soldier'];
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const assigned = startingJobs[i % startingJobs.length];
      agent.job = assigned;
      agent.jobTitle = assigned.charAt(0).toUpperCase() + assigned.slice(1);
      if (this.economySystem) {
        this.economySystem.agentJobs.set(agent.id, { job: assigned, salary: 12, satisfaction: 85, assignedAt: 0 });
      }
      const sName = agent.settlementId
        ? (this.settlementSystem?.settlements?.get(agent.settlementId)?.name || 'Aetheria')
        : 'the Wilds';
      if (typeof agent.addLifeEvent === 'function') {
        agent.addLifeEvent('ORIGIN', `Founding settler of ${sName}`, 0, '🏕️', true);
        agent.addLifeEvent('CAREER', `Began working as ${agent.jobTitle}`, 0, '🛠️', false);
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

    // Initialize state creeds and beliefs for founded settlements
    if (this.religionSystem) {
      this.religionSystem.initWorldBeliefs();
    }

    if (this._scenario === 'modern_nuclear') {
      this.applyModernNuclearScenario();
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

  setViewportBounds(bounds) {
    this.viewportBounds = bounds;
  }

  isNearAnySettlement(x, y, radius = 18) {
    if (!this.settlementSystem?.settlements) return false;
    const rSq = radius * radius;
    for (const set of this.settlementSystem.settlements.values()) {
      if (!set.center) continue;
      const dx = set.center.x - x;
      const dy = set.center.y - y;
      if (dx * dx + dy * dy <= rSq) return true;
    }
    return false;
  }

  getMortalitySummary() {
    let livingSum = 0;
    let children = 0, adults = 0, elders = 0;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      livingSum += a.age;
      if (a.lifeStage === 'child') children++;
      else if (a.lifeStage === 'elder') elders++;
      else adults++;
    }
    const avgLivingAge = this.agents.length > 0 ? (livingSum / this.agents.length) : 0;
    return {
      totalDeaths: this.mortalityStats.totalDeaths,
      averageAgeAtDeath: this.mortalityStats.averageAgeAtDeath,
      minAgeAtDeath: this.mortalityStats.minAgeAtDeath,
      maxAgeAtDeath: this.mortalityStats.maxAgeAtDeath,
      causes: { ...this.mortalityStats.causes },
      livingPopulation: this.agents.length,
      averageLivingAge: avgLivingAge,
      demographics: { children, adults, elders }
    };
  }

  getAgentLodTier(agent) {
    // When population is small and no viewport is configured (e.g. headless test runs with <150 agents),
    // default to Tier 0 to preserve 100% test determinism.
    if (this.agents.length <= 150 && !this.viewportBounds) {
      return 0;
    }
    if (this.selectedEntityId != null && agent.id === this.selectedEntityId) {
      return 0;
    }
    // Check viewport bounds from camera
    if (this.viewportBounds) {
      const vb = this.viewportBounds;
      const pad0 = 4;
      if (agent.x >= vb.minX - pad0 && agent.x <= vb.maxX + pad0 && agent.y >= vb.minY - pad0 && agent.y <= vb.maxY + pad0) {
        return 0; // Focus tier (on-camera)
      }
      const pad1 = 12;
      if (agent.x >= vb.minX - pad1 && agent.x <= vb.maxX + pad1 && agent.y >= vb.minY - pad1 && agent.y <= vb.maxY + pad1) {
        return 1; // Transition periphery buffer around viewport
      }
      // Off-camera agents in active combat or fleeing run in Tier 1 rather than forcing full Tier 0 on-camera focus
      if (agent.fleeFrom || (agent.militaryDuty && agent.warbandId != null)) {
        return 1;
      }
      return 2; // All off-camera and distant settlements run simplified macro simulation
    }
    // Headless with high population (> 150 agents):
    const firstSettlement = this.settlementSystem?.settlements?.values()?.next()?.value;
    const focalCenter = firstSettlement?.center || { x: this.world.width / 2, y: this.world.height / 2 };
    const dx = agent.x - focalCenter.x, dy = agent.y - focalCenter.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 400) return 0;   // radius 20
    if (distSq <= 1600) return 1;  // radius 40
    return 2;                      // outer world / hinterland macro tier
  }

  // Main simulation tick (doc 03: high-level tick order)
  tick() {
    const tStart = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : 0;
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
    this.updateDynasties();
    this.updatePioneers(); // god-spawned wanderers found new villages
    this.updateCulture(); // Societies & Culture
    this.updateEconomy();
    this.updateCrafting();
    this.updateTrade(); // NEW: Trade caravans
    this.updateAging(); // NEW: Age/lifecycle
    
    // Phase 3: Update advanced systems
    this.updateEvents();
    this.updateFactions();
    this.updateDiplomacy(); // NEW: Inter-settlement diplomacy, treaties, alliances & war declarations
    this.updateEspionage(); // Covert spy operations & guild factions
    this.updateWarfare(); // NEW: Warbands, tactical formations, sieges & battlefield clashes
    this.updateFormations(); // Military formations
    
    // Phase 4-6: Update new systems
    this.updateCombat();
    this.updateConstruction();
    this.updateReligion();
    this.updateInfrastructure(); // NEW: Roads/bridges
    this.updateFortifications(); // Perimeter walls, gates, watchtowers & breaches
    this.updateNaval(); // Coastal docks, fishing boats, river barges, amphibious raids

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

    if (tStart > 0) {
      const elapsed = performance.now() - tStart;
      this.lodStats.lastTickMs = elapsed;
      this.lodStats.avgTickMs = this.lodStats.avgTickMs > 0 ? (this.lodStats.avgTickMs * 0.9 + elapsed * 0.1) : elapsed;
    }
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
    // Update historical epochs & monuments
    if (this.civilizationAgeSystem) {
      this.civilizationAgeSystem.update(this.clock.tick);
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

  updateEspionage() {
    if (this.espionageSystem) {
      this.espionageSystem.update(this.clock.tick);
    }
  }

  updateWarfare() {
    if (this.warfareSystem) {
      this.warfareSystem.update();
    }
  }

  updateDynasties() {
    if (this.dynastySystem) {
      this.dynastySystem.update(this.clock.tick);
    }
  }
  
  updateInfrastructure() {
    // Update roads, irrigation, bridges
    this.infrastructureSystem.update();
  }

  updateFortifications() {
    if (this.fortificationSystem) {
      this.fortificationSystem.update(this.clock.tick);
    }
  }

  updateNaval() {
    if (this.navalSystem) {
      this.navalSystem.update(this.clock.tick);
    }
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
    // Season transitions: log to chronicle + emit event (pure clock math —
    // deterministic and save-safe).
    if (this.clock.seasonChanged()) {
      const season = this.clock.getSeason();
      this.eventBus.emit('SEASON_CHANGED', { season, year: this.clock.getYear(), tick: this.clock.tick });

      // Phase 3b Step 5: seasonal tribute collection for tributary/vassal settlements
      if (this.settlementSystem?.settlements) {
        for (const vassal of this.settlementSystem.settlements.values()) {
          if (vassal.tributeTo && vassal.tributeUntil && this.clock.tick >= vassal.tributeUntil) {
            vassal.tributeTo = null;
            vassal.overlordId = null;
            vassal.tributeUntil = 0;
            continue;
          }
          if (vassal.tributeTo) {
            const overlord = this.settlementSystem.settlements.get(vassal.tributeTo);
            if (overlord && overlord.stockpile && vassal.stockpile) {
              const rate = vassal.tributeRate || 0.15;
              const tributeFood = Math.floor((vassal.stockpile.food || 0) * rate);
              const tributeOre = Math.floor((vassal.stockpile.ore || 0) * rate);
              if (tributeFood > 0 || tributeOre > 0) {
                vassal.stockpile.food = Math.max(0, (vassal.stockpile.food || 0) - tributeFood);
                vassal.stockpile.ore = Math.max(0, (vassal.stockpile.ore || 0) - tributeOre);
                overlord.stockpile.food = (overlord.stockpile.food || 0) + tributeFood;
                overlord.stockpile.ore = (overlord.stockpile.ore || 0) + tributeOre;
                this.eventBus.emit('TRIBUTE_PAID', {
                  vassalId: vassal.id,
                  vassalName: vassal.name,
                  overlordId: overlord.id,
                  overlordName: overlord.name,
                  food: tributeFood,
                  ore: tributeOre,
                  season
                });
              }
            }
          }
        }
      }
    }

    // Dynamic Weather System (Rain, Storms, Lightning, Droughts)
    if (this.weatherSystem) {
      this.weatherSystem.update(this.clock.tick);
    }

    // Persistent Nuclear Fallout & Radiation Sickness (must run independently of active fires)
    if (this.world._radiationActive && this.world.radiationTiles) {
      this.world.updateRadiation(this.clock.tick);
      if ((this.clock.tick & 7) === 0) {
        const tick = this.clock.tick;
        for (const a of this.agents) {
          if (!a.alive) continue;
          const rad = this.world.getRadiation(a.x, a.y);
          if (rad > 15) {
            const dmg = Math.max(1, Math.round(rad / 45));
            a.health = Math.max(0, (a.health ?? 100) - dmg);
            if (a.needs) a.needs.health = a.health;
            if (a.combat) a.combat.health = a.health;
            if (a.health <= 0) {
              a.alive = false;
              a.deathCause = 'radiation';
              if (typeof a.addLifeEvent === 'function') {
                a.addLifeEvent('DEATH', 'Succumbed to lethal atomic radiation', tick, '☢️', true);
              }
            } else {
              const lastRad = a._lastRadEventTick ?? -999;
              if (tick - lastRad >= 60) {
                a._lastRadEventTick = tick;
                if (typeof a.remember === 'function') {
                  a.remember('SURVIVED_NUKE', tick, { x: a.x, y: a.y, rep: -1 });
                }
                if (typeof a.addLifeEvent === 'function') {
                  a.addLifeEvent('RADIATION', 'Endured toxic nuclear fallout', tick, '☢️', false);
                }
              }
            }
          }
        }
        if (this.resources) {
          for (const res of this.resources) {
            if (res.destroyed || res.depleted) continue;
            if (res.resourceType === 'food' || res.resourceType === 'wood') {
              const rad = this.world.getRadiation(res.x, res.y);
              if (rad > 90) {
                res.amount = Math.max(0, (res.amount || 10) - 3);
                if (res.amount <= 0) {
                  res.destroyed = true;
                  this.world.scorchTile(Math.floor(res.x), Math.floor(res.y), 140);
                }
              }
            }
          }
        }
      }
    }

    // Perf: fire layer only matters while something burns. Skip the full-map
    // scan entirely when there are no active fires (common case). Fires can
    // only be created via world.startFire(), which sets _fireActive.
    if (!this.world.fireTiles) return;
    if (!this._fireActive && this.burningTileCount === 0) return;
    this.burningTileCount = this.world.updateFires(this.clock.tick);
    if (this.burningTileCount > 0) this._fireActive = true;
    else this._fireActive = false;
    // Fires destroy buildings on burning tiles, scorch the earth, and consume resources
    if (this.burningTileCount > 0) {
      if (this.buildings) {
        for (const b of this.buildings) {
          if (!b.isRuined && b.health > 0 && this.world.isBurning(Math.floor(b.x), Math.floor(b.y))) {
            b.health -= 2;
            if (b.health <= 0) {
              b.health = 0;
              b.isRuined = true;
              b.ruinedAtTick = this.clock.tick;
              this.world.scorchTile(Math.floor(b.x), Math.floor(b.y), 255);
              this.eventBus.emit('building_destroyed', { building: b, cause: 'fire' });
              // Memory: agents whose home burns remember the loss (ghost-quarter bias later).
              for (const a of this.agents) {
                if (a.alive && a.homeId === b.id && typeof a.remember === "function") {
                  a.remember("SACKED_HOME", this.clock.tick, { x: b.x, y: b.y, rep: -1 });
                }
              }
            }
          }
        }
      }

      // Fires incinerate combustible resources (forests, crops, lumber piles)
      if (this.resources) {
        for (const res of this.resources) {
          if (res.destroyed) continue;
          if (res.resourceType === 'wood' || res.resourceType === 'food') {
            const rx = Math.floor(res.x);
            const ry = Math.floor(res.y);
            if (this.world.isBurning(rx, ry)) {
              res.amount = (res.amount || 10) - 2;
              if (res.amount <= 0) {
                res.destroyed = true;
                this.world.scorchTile(rx, ry, 220);
                this.eventBus.emit('resource_depleted', { resource: res, cause: 'fire' });
              }
            }
          }
        }
      }

      // Burning settlement centers/warehouses consume stockpiled supplies
      if (this.settlementSystem?.settlements) {
        for (const s of this.settlementSystem.settlements.values()) {
          if (!s.center || !s.stockpile) continue;
          const cx = Math.floor(s.center.x);
          const cy = Math.floor(s.center.y);
          if (this.world.isBurning(cx, cy)) {
            if (s.stockpile.food > 0) s.stockpile.food = Math.max(0, s.stockpile.food - 0.5);
            if (s.stockpile.wood > 0) s.stockpile.wood = Math.max(0, s.stockpile.wood - 0.5);
            this.world.scorchTile(cx, cy, 180);
          }
        }
      }
    }
    // Memory: agents standing next to fire remember surviving it (once per burn spell).
    if (this.burningTileCount > 0) {
      for (const a of this.agents) {
        if (!a.alive || typeof a.remember !== "function") continue;
        const lastFire = a.memories?.length ? a.memories[a.memories.length - 1] : null;
        if (lastFire && lastFire.type === "SURVIVED_FIRE" && this.clock.tick - lastFire.tick < 60) continue;
        if (this.world.isBurning(Math.floor(a.x), Math.floor(a.y)) ||
            this.world.isBurning(Math.floor(a.x) + 1, Math.floor(a.y)) ||
            this.world.isBurning(Math.floor(a.x) - 1, Math.floor(a.y)) ||
            this.world.isBurning(Math.floor(a.x), Math.floor(a.y) + 1) ||
            this.world.isBurning(Math.floor(a.x), Math.floor(a.y) - 1)) {
          a.remember("SURVIVED_FIRE", this.clock.tick, { x: a.x, y: a.y });
          if (typeof a.addLifeEvent === 'function') {
            a.addLifeEvent('SURVIVED_FIRE', 'Braved a raging settlement blaze', this.clock.tick, '🔥', false);
          }
        }
      }
    }
  }
  
  updateRelationships() {
    // Purge relationship/map entries for agents that no longer exist. Dead
    // agents are spliced out of this.agents (by ageSystem deaths or god-power
    // removal), but their relationship rows and settlement assignments linger.
    // On save/load the surviving agents compact into different array slots, so
    // stale entries make a resumed world process memory in different order and
    // diverge from an uninterrupted run. Pruning keeps both runs identical.
    if (this.clock.tick % 10 === 0) {
      // Perf: one pass builds the alive-id set (previously `map` allocated an
      // intermediate array of every id before feeding the Set).
      const alive = new Set();
      for (const a of this.agents) alive.add(a.id);
      this.relationshipSystem.pruneAgents(alive);
      this.settlementSystem.pruneAgents(alive);
    }

    // Decay relationships over time (deterministic 5-tick stride for performance)
    if (this.clock.tick % 5 === 0) {
      this.relationshipSystem.decayRelationships(5);
    }
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

      // Close large peaceful cities periodically unite into a Metropolis
      if (this.clock.tick % 100 === 0) {
        this.settlementSystem.mergeCloseBigCities?.(this.clock.tick);
      }

      // Prune ancient ruined buildings to keep late-game structure counts bounded
      if (this.clock.tick % 200 === 0 && this.buildings.length > 0) {
        const pruneIds = new Set();
        let bw = 0;
        for (let i = 0; i < this.buildings.length; i++) {
          const b = this.buildings[i];
          if (b && b.isRuined && b.ruinedAtTick != null && (this.clock.tick - b.ruinedAtTick) > 1200) {
            pruneIds.add(b.id);
            this.world.removeFromSpatialIndex(Math.floor(b.x), Math.floor(b.y), b);
            this.world.entityRegistry?.delete(b.id);
          } else {
            this.buildings[bw++] = b;
          }
        }
        if (pruneIds.size > 0) {
          this.buildings.length = bw;
          this._occStamp = -1;
          for (const st of this.settlementSystem.settlements.values()) {
            if (Array.isArray(st.buildings) && st.buildings.length > 0) {
              st.buildings = st.buildings.filter(b => b && !pruneIds.has(b.id));
            }
          }
        }
      }

      // Perf: index buildings by owner once per pass so the civic-planning
      // loop below reads pre-bucketed lists instead of filtering the whole
      // buildings array (plus several extra `.filter()` passes and a
      // `.some()` scan) for every settlement. Same data, same order — pure
      // bookkeeping, no RNG, determinism-safe.
      const bBySettlement = new Map();
      for (const b of this.buildings) {
        if (b.settlementId == null) continue;
        let bucket = bBySettlement.get(b.settlementId);
        if (!bucket) { bucket = []; bBySettlement.set(b.settlementId, bucket); }
        bucket.push(b);
      }
      // Occupancy grid for blueprint placement: building tiles stamped as
      // "reserved" in a radius-2 neighborhood. Rebuilt only when a building
      // is added/removed since the last planning pass (rare), turning the
      // old O(attempts x buildings) `.some()` scan into an O(1) lookup with
      // identical results (building coordinates are always integers).
      if (this._occStamp !== this.buildings.length) {
        this._occStamp = this.buildings.length;
        this._occGrid = new Uint8Array(this.world.width * this.world.height);
        const W = this.world.width, H = this.world.height;
        for (const b of this.buildings) {
          const bx = Math.floor(b.x), by = Math.floor(b.y);
          for (let dy = -2; dy <= 2; dy++) {
            const gy = by + dy;
            if (gy < 0 || gy >= H) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const gx = bx + dx;
              if (gx < 0 || gx >= W) continue;
              this._occGrid[gy * W + gx] = 1;
            }
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
        
        // Check building needs. Perf: count the settlement's own buildings in
        // a single pass over its pre-bucketed list instead of allocating six
        // filtered arrays. The owner stamp matches the distance<22 heuristic
        // in practice (every planner/god-built structure carries its owning
        // settlement or sits outside another town's radius), and only the
        // counts feed the deterministic decisions below — never entity order.
        let houses = 0, workshops = 0, farms = 0, temples = 0, towers = 0;
        let granaries = 0, markets = 0, barracksCount = 0, warehouses = 0;
        let factories = 0, researchLabs = 0, nuclearPlants = 0, missileSilos = 0;
        let pending = 0, nonRuined = 0;
        const owned = bBySettlement.get(settlement.id);
        if (owned) {
          for (const b of owned) {
            if (!b.isRuined) nonRuined++;
            if (!b.complete) { pending++; continue; }
            switch (b.buildingType) {
              case "house": houses++; break;
              case "workshop": workshops++; break;
              case "farm": farms++; break;
              case "temple": temples++; break;
              case "tower": case "castle": towers++; break;
              case "granary": granaries++; break;
              case "market": markets++; break;
              case "barracks": barracksCount++; break;
              case "warehouse": warehouses++; break;
              case "factory": factories++; break;
              case "research_lab": researchLabs++; break;
              case "nuclear_plant": nuclearPlants++; break;
              case "missile_silo": missileSilos++; break;
            }
          }
        }
        
        // Only plan up to 2 active projects simultaneously, within per-city cap
        const ageId = this.civilizationAgeSystem?.getSettlementAge?.(settlement.id)?.ageId || 1;
        const maxBuildings = Math.min(28, Math.max(8, Math.ceil(pop * 0.7) + 5));
        if (pending < 2 && nonRuined < maxBuildings) {
          let neededType = null;
          if (houses < Math.max(1, Math.ceil(pop / 3))) {
            neededType = "house";
          } else if (workshops === 0 && pop >= 3) {
            neededType = "workshop";
          } else if (farms === 0 && pop >= 4) {
            neededType = "farm";
          } else if (temples === 0 && pop >= 6) {
            neededType = "temple";
          } else if (granaries === 0 && pop >= 6) {
            neededType = "granary";
          } else if (markets === 0 && pop >= 7) {
            neededType = "market";
          } else if (barracksCount === 0 && pop >= 9) {
            neededType = "barracks";
          } else if (warehouses === 0 && pop >= 11) {
            neededType = "warehouse";
          } else if (houses < Math.ceil(pop / 2)) {
            neededType = "house";
          }

          // Civic milestone projects: towns raise a watchtower, cities a castle.
          if (!neededType && pop >= 8 && towers === 0) {
            neededType = pop >= 15 ? "castle" : "tower";
          }

          // Industrial, Modern & Nuclear Age infrastructure chain:
          // Factory -> Research Lab -> Nuclear Power Plant -> Missile Silo
          if (!neededType && ageId >= 5 && pop >= 10 && factories === 0) {
            neededType = "factory";
          } else if (!neededType && ageId >= 5 && pop >= 12 && researchLabs === 0) {
            neededType = "research_lab";
          } else if (!neededType && ageId >= 6 && pop >= 12 && factories >= 1 && nuclearPlants === 0) {
            neededType = "nuclear_plant";
          } else if (!neededType && ageId >= 6 && pop >= 13 && nuclearPlants >= 1 && missileSilos === 0) {
            neededType = "missile_silo";
          }
          
          if (neededType) {
            // Find a suitable clear walkable tile near settlement center
            for (let a = 0; a < 25; a++) {
              const ang = this._rng().next() * Math.PI * 2;
              const r = 3 + this._rng().next() * 8;
              const bx = Math.floor(settlement.center.x + Math.cos(ang) * r);
              const by = Math.floor(settlement.center.y + Math.sin(ang) * r);
              if (bx >= 4 && bx < this.world.width - 4 && by >= 4 && by < this.world.height - 4 && this.world.isWalkable(bx, by)) {
                const occupied = this._occGrid[by * this.world.width + bx] === 1;
                if (!occupied) {
                  const building = new Building(bx, by, neededType, this.idGen, settlement.id, settlement.factionId ?? null);
                  building.constructionProgress = 0;
                  building.complete = false;
                  this.buildings.push(building);
                  this.world.addToSpatialIndex(bx, by, building);
                  // Keep the occupancy grid current so later settlements in
                  // this same pass see the new site (matches the old live
                  // `buildings.some()` scan exactly).
                  const W = this.world.width, H = this.world.height;
                  for (let dy = -2; dy <= 2; dy++) {
                    const gy = by + dy;
                    if (gy < 0 || gy >= H) continue;
                    for (let dx = -2; dx <= 2; dx++) {
                      const gx = bx + dx;
                      if (gx < 0 || gx >= W) continue;
                      this._occGrid[gy * W + gx] = 1;
                    }
                  }
                  if (!owned) {
                    bBySettlement.set(settlement.id, [building]);
                  } else {
                    owned.push(building);
                  }
                  pending++;
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
  
  // Which settlement a job site belongs to: construction target, workshop, or
  // farm workplace. Returns null if the agent works unaffiliated ground.
  _jobSettlementId(agent) {
    const site = agent.constructionTarget || agent.workplace;
    if (site && site.settlementId != null) return site.settlementId;
    return null;
  }

  updateEconomy() {
    // Assign jobs to unemployed agents in settlements and idle agents
    if (this.clock.tick % 10 === 0) {
      const availableJobs = ['gatherer', 'farmer', 'hunter', 'lumberjack', 'miner', 'builder', 'craftsman', 'soldier'];

      // Soldier profession cap (Phase 3b Step 2): keep at most ~1 in 8
      // *adults* under arms per settlement so barracks upkeep never starves
      // the granary. Deterministic: pure counts, zero RNG. Keyed by the
      // settlement roster (same id space as the job loop below). Counting
      // adults (not total roster size) keeps the cap meaningful while
      // populations boom with children.
      const adultCountBySettlement = new Map();
      const soldierCountBySettlement = new Map();
      for (const [sid, st] of this.settlementSystem.settlements) {
        let adults = 0, soldiers = 0;
        for (const aId of st.agentIds) {
          const a = this._agentById(aId);
          if (a && a.alive && a.lifeStage === 'adult') {
            adults++;
            // Count enlisted professionals *and* mustered conscripts so the
            // enlistment quota tracks everyone actually under arms.
            if (a.job === 'soldier' || a.militaryDuty) soldiers++;
          }
        }
        adultCountBySettlement.set(sid, adults);
        soldierCountBySettlement.set(sid, soldiers);
      }

      // Perf: one pass over buildings gives (a) the global pending-construction
      // flag and (b) per-settlement completed-workshop counts, replacing an
      // O(settlements x buildings) reduce plus a separate `.some()` scan.
      let hasPendingWork = false;
      const wsCountBySettlement = new Map();
      for (const b of this.buildings) {
        if (!b.complete && (b.constructionProgress || 0) < 100) hasPendingWork = true;
        if (b.settlementId != null && b.buildingType === 'workshop' && b.complete) {
          wsCountBySettlement.set(b.settlementId, (wsCountBySettlement.get(b.settlementId) || 0) + 1);
        }
      }

      // Role rebalancing: detect settlements that lack critical roles (builders,
      // food producers) so agents can voluntarily switch jobs when needed.
      const needsBuilders = new Set();
      const needsFood = new Set();
      const needsHunters = new Set();
      const craftsmanSurplus = new Set();
      for (const [sid, settlement] of this.settlementSystem.settlements) {
        let builders = 0, foodWorkers = 0, craftsmen = 0, hunters = 0;
        for (const agentId of settlement.agentIds) {
          const a = this._agentById(agentId);
          if (!a || !a.alive) continue;
          if (a.job === 'builder') builders++;
          else if (a.job === 'craftsman') craftsmen++;
          else if (a.job === 'hunter') { hunters++; foodWorkers++; }
          else if (a.job !== 'unemployed') foodWorkers++;
        }
        const pop = settlement.agentIds.size;
        if (pop >= 2 && builders === 0) needsBuilders.add(sid);
        if (pop >= 3 && foodWorkers <= 1) needsFood.add(sid);
        if (pop >= 5 && hunters === 0) needsHunters.add(sid);
        const wsCount = wsCountBySettlement.get(sid) || 0;
        const wsCap = Math.max(1, wsCount) * 4;
        const target = Math.min(wsCap, Math.max(2, Math.floor(pop / 3)));
        if (craftsmen > target) craftsmanSurplus.add(sid);
      }
      // Publish the demand snapshot for the voluntary career-change pass.
      this._jobDemand = { needsBuilders, needsFood, needsHunters, craftsmanSurplus };

      for (const settlement of this.settlementSystem.settlements.values()) {
        const homeSid = settlement.id;
        for (const agentId of settlement.agentIds) {
          const agent = this._agentById(agentId);
          if (agent && agent.alive) {
            const currentJob = this.economySystem.getAgentJob(agentId);
            if (!currentJob || currentJob.job === 'unemployed') {
              // Determinism guard: without this window, agents released from
              // workshops (removeWorker sets job='unemployed') were instantly
              // re-hired as craftsmen on the next 10-tick pass - the churn
              // loop that made whole towns permanently craftsmen. Give them
              // 60 ticks to seek other work first.
              if (this.clock.tick - (agent._lastJobAssignedTick ?? -9999) < 60) continue;
              // Churn guard: an agent bounced between "unemployed" and hired
              // several times keeps failing to hold a post (workshop roster
              // pressure, missing skills). Let them settle permanently rather
              // than ping-pong the whole town through the same cycle.
              // Soldier cap: brave young adults may enlist when the town
              // under-arms quota has room; otherwise pick from civilian jobs.
              const canEnlist = agent.lifeStage === 'adult' &&
                agent.age >= 18 && agent.age <= 40 && (agent.personality?.brave ?? 0.5) > 0.6;
              const maxSoldiers = Math.floor((adultCountBySettlement.get(homeSid) || 0) / 8);
              const curSoldiers = soldierCountBySettlement.get(homeSid) || 0;
              const enlistOffered = canEnlist && curSoldiers < maxSoldiers;
              // Churn guard: an agent bounced between "unemployed" and hired
              // several times keeps failing to hold a post (workshop roster
              // pressure, missing skills). Let them settle permanently rather
              // than ping-pong the whole town through the same cycle. The
              // lockout is *conditional*: a brave youth with barracks quota
              // room still gets the recruit offer — otherwise the first three
              // failed civilian hires would permanently close the soldier
              // profession to every candidate (Phase 3b Step 2 audit).
              const attempts = (this._jobChangeCount.get(agent.id) || 0) + 1;
              this._jobChangeCount.set(agent.id, attempts);
              if (attempts > 3 && !enlistOffered) { agent._lastJobAssignedTick = Infinity; continue; }
              let jobPool = availableJobs;
              if (!enlistOffered) {
                jobPool = availableJobs.filter(j => j !== 'soldier');
              } else {
                soldierCountBySettlement.set(homeSid, curSoldiers + 1);
              }
              // When enlistment is on the table, the barracks bonus must beat
              // the craftsman standing bonus in the scoring contest — so we
              // hand the recruit the single-job soldier pool instead of hoping
              // it wins a multi-way comparison. The caller already vetted age/
              // bravery/quota, which is exactly what the standing bonuses were
              // compensating for economy-wide.
              if (enlistOffered) jobPool = ['soldier'];
              this.economySystem.assignJob(agent, jobPool);
              // Only count an attempt when the agent actually landed a post.
              // A failed pool (no qualified job) must not burn one of the 3
              // churn attempts — otherwise a soldier-capped pool could lock
              // brave youths out of every profession at once.
              if (agent.job && agent.job !== 'unemployed') {
                this._jobChangeCount.set(agent.id, Math.max(0, attempts - 1));
                agent._lastJobAssignedTick = this.clock.tick;
              } else {
                // Failed offer: undo the quota reservation and let them retry
                // after the normal 60-tick patience window without burning
                // another attempt next pass.
                if (enlistOffered) soldierCountBySettlement.set(homeSid, curSoldiers);
                this._jobChangeCount.set(agent.id, Math.max(0, attempts - 1));
                agent._lastJobAssignedTick = this.clock.tick - 60;
              }
              agent._jobAssignedTick = this.clock.tick;
            } else if (agent.lifeStage === 'adult' && this.clock.tick % 40 === 0 &&
                       agent.personality.curious > 0.4) {
              // Career change: switch role if the community is short-staffed
              // where we live AND where we currently work (same site), so a
              // builder heading to another town's construction never poaches.
              const jobSid = this._jobSettlementId(agent);
              const sameSite = jobSid == null || jobSid === homeSid;
              if (sameSite) {
                if (needsBuilders.has(homeSid) && hasPendingWork && agent.job !== 'builder' &&
                    agent.skills.build >= 1.2) {
                  this.economySystem.assignJob(agent, ['builder']);
                  agent._jobAssignedTick = this.clock.tick;
                  agent._lastJobAssignedTick = this.clock.tick;
                  this._jobChangeCount.set(agent.id, (this._jobChangeCount.get(agent.id) || 0) + 1);
                } else if (needsHunters.has(homeSid) && agent.job !== 'hunter' && agent.job !== 'craftsman' &&
                           agent.job !== 'builder' && agent.job !== 'soldier' &&
                           (this.animalSystem?.animals?.length || 0) >= 6) {
                  needsHunters.delete(homeSid);
                  this.economySystem.assignJob(agent, ['hunter']);
                  agent._jobAssignedTick = this.clock.tick;
                  agent._lastJobAssignedTick = this.clock.tick;
                  this._jobChangeCount.set(agent.id, (this._jobChangeCount.get(agent.id) || 0) + 1);
                } else if (needsFood.has(homeSid) && agent.job !== 'farmer' && agent.job !== 'gatherer' &&
                           agent.job !== 'lumberjack' && agent.job !== 'hunter' &&
                           // Protect the workshop roster: poaching craftsmen
                           // into food production starved the entire
                           // crafting -> distribution -> trade pipeline while
                           // granaries overflowed.
                           agent.job !== 'craftsman') {
                  this.economySystem.assignJob(agent, ['farmer', 'hunter', 'gatherer', 'lumberjack']);
                  agent._jobAssignedTick = this.clock.tick;
                  agent._lastJobAssignedTick = this.clock.tick;
                  this._jobChangeCount.set(agent.id, (this._jobChangeCount.get(agent.id) || 0) + 1);
                }
              }
            }
          }
        }
      }
      // Also ensure any unemployed agent receives a role (same 60-tick
      // patience window - no instant re-hiring churn).
      for (const agent of this.agents) {
        if (agent.alive && (!agent.job || agent.job === 'unemployed')) {
          if (this.clock.tick - (agent._lastJobAssignedTick ?? -9999) < 60) continue;
          const attempts = (this._jobChangeCount.get(agent.id) || 0) + 1;
          this._jobChangeCount.set(agent.id, attempts);
          if (attempts > 3) { agent._lastJobAssignedTick = Infinity; continue; }
          this.economySystem.assignJob(agent, availableJobs);
          agent._lastJobAssignedTick = this.clock.tick;
          agent._jobAssignedTick = this.clock.tick;
        }
      }
    }

    // Voluntary career changes: bored specialists switch trades on their own.
    this._updateCareerChanges();
    
    // Update market prices periodically
    if (this.clock.tick % 50 === 0) {
      const settlementResources = new Map();
      for (const id of this.settlementSystem.settlements.keys()) {
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
  
  // Shared enlistment gate (Phase 3b Step 2): a brave young adult may take
  // the king's shilling only while their settlement's under-arms quota
  // (~1 in 8 adults, counting mustered conscripts too) has room. Pure
  // counts + personality, zero RNG — safe for determinism and save/load.
  _soldierEnlistOffer(agent, homeSid) {
    if (!agent || !agent.alive || agent.lifeStage !== 'adult') return false;
    if (!(agent.age >= 18 && agent.age <= 40)) return false;
    if ((agent.personality?.brave ?? 0.5) <= 0.6) return false;
    const st = this.settlementSystem.settlements.get(homeSid);
    if (!st) return false;
    let adults = 0, underArms = 0;
    for (const id of st.agentIds) {
      const a = this._agentById(id);
      if (a && a.alive && a.lifeStage === 'adult') {
        adults++;
        if (a.job === 'soldier' || a.militaryDuty) underArms++;
      }
    }
    return underArms < Math.floor(adults / 8);
  }

  // Voluntary career changes ("I feel bored / I want something else").
  // Every few days of village time, settled adults who have been stuck in the
  // same trade for a long while may quit and retrain. Motivation is a mix of
  // personality (curious & restless types switch more often; diligent ones
  // stay put), how stale the current job feels, and community demand:
  //   - craftsmen only leave when their town's workshop benches are already
  //     over-staffed (protects the crafting -> distribution -> trade pipeline),
  //   - builders/farmers only leave when their role isn't critically short,
  //   - hungry towns actively recruit ex-craftsmen toward food trades first.
  // All randomness flows through the seeded world RNG in deterministic agent
  // order, so save/load resume stays bit-identical to an uninterrupted run.
  _updateCareerChanges() {
    if (this.clock.tick % 20 !== 0) return;
    const demand = this._jobDemand;
    const rng = this._rng();

    for (const agent of this.agents) {
      if (!agent.alive || agent.lifeStage !== 'adult') continue;
      const rec = this.economySystem.getAgentJob(agent.id);
      if (!rec || !rec.job || rec.job === 'unemployed') continue;
      // Tenure clock: agent-side field (serialized with the agent, so it
      // survives save/load) with the economy record as a fallback for legacy
      // records created before this feature existed.
      const assignedAt = Math.max(
        typeof agent._jobAssignedTick === 'number' ? agent._jobAssignedTick : -1,
        typeof rec.assignedAt === 'number' ? rec.assignedAt : -1);
      if (assignedAt < 0 || this.clock.tick - assignedAt < 600) continue; // still fresh on the job

      // Soldiers under arms never job-hunt mid-muster; veterans who kept
      // their profession are content on the barracks roster (Phase 3b Step 2).
      // Check the agent's own job too: mustering sets soldier.job='soldier'
      // without touching the economy record, so a conscripted farmer must be
      // skipped by this guard or they'd quit mid-campaign.
      if (rec.job === 'soldier' || agent.job === 'soldier') continue;

      const p26 = agent.personality;
      // Restlessness: curious + low diligence + a dash of social wanderlust.
      const restlessness = (p26.curious ?? 0.5) * 0.5
        + (1 - (p26.industrious ?? 0.7)) * 0.35
        + (p26.social ?? 0.5) * 0.15;
      // Staleness grows with tenure (caps at ~2000 ticks on the same bench).
      const staleness = Math.min(1, (this.clock.tick - assignedAt) / 2000);
      const chance = restlessness * (0.04 + 0.10 * staleness);
      if (rng.next() >= chance) continue;

      // Where do we work relative to where we live? (No cross-town poaching.)
      const homeSid = this.settlementSystem.getAgentSettlement(agent.id)?.id ?? null;
      const jobSid = this._jobSettlementId(agent);
      if (jobSid != null && homeSid != null && jobSid !== homeSid) continue;

      // Role-specific permission to quit, given what the town needs.
      let pool = EconomySystem.CAREER_ALTERNATIVES.filter(j => j !== rec.job);
      if (rec.job === 'craftsman') {
        if (!demand.craftsmanSurplus.has(homeSid)) continue; // benches need us
        if (demand.needsFood.has(homeSid)) pool = ['farmer', 'gatherer', 'lumberjack'];
        // Wartime recruiting drive (Phase 3b Step 2): a bored young brave
        // craftsman may answer the drumbeat instead of retraining civilian —
        // but only while their settlement's under-arms quota has room.
        const enlistOffer = this._soldierEnlistOffer(agent, homeSid);
        if (enlistOffer) pool = ['soldier'];
      } else if (rec.job === 'builder') {
        if (demand.needsBuilders.has(homeSid)) continue; // the town needs walls
      } else if (rec.job === 'farmer' || rec.job === 'gatherer' || rec.job === 'lumberjack') {
        if (demand.needsFood.has(homeSid)) continue; // the granaries need us
      } else if (rec.job === 'soldier') {
        // Soldiers only leave the colours when the town's under-arms quota
        // has already been cut (settlement shrank) — otherwise barracks
        // drills are a lifelong trade here (Phase 3b Step 2).
        const adultsHere = this.settlementSystem.getAgentSettlement(agent.id)
          ? [...this.settlementSystem.getAgentSettlement(agent.id).agentIds]
              .filter(id => { const x = this._agentById(id); return x && x.alive && x.lifeStage === 'adult'; }).length
          : 0;
        const quotaHere = Math.floor(adultsHere / 8);
        let underArmsHere = 0;
        const stt = this.settlementSystem.getAgentSettlement(agent.id);
        if (stt) for (const id of stt.agentIds) {
          const x = this._agentById(id);
          if (x && x.alive && x.lifeStage === 'adult' && (x.job === 'soldier' || x.militaryDuty)) underArmsHere++;
        }
        if (underArmsHere <= quotaHere) continue; // quota still full — stay enlisted
      }
      if (pool.length === 0) continue;

      const newJob = this.economySystem.switchCareer(agent, pool);
      if (!newJob) continue;
      agent._lastJobAssignedTick = this.clock.tick;
      agent._jobAssignedTick = this.clock.tick;
      this._jobChangeCount.delete(agent.id); // a chosen trade is held, not hunted

      // A workshop hand hanging up their tools leaves the roster immediately
      // (reconcileCraftsmen prunes the stale entry next tick otherwise).
      if (agent.workplace && this.craftingSystem?.workshops?.has(agent.workplace)) {
        this.craftingSystem.removeWorker(agent.workplace, agent.id);
      }

      if (typeof agent.addLifeEvent === 'function') {
        agent.addLifeEvent('CAREER', `Retrained from ${rec.job} to ${newJob}`, this.clock.tick, '🛠️', false);
      }

      this.eventBus.emit("CAREER_CHANGED", {
        agentId: agent.id,
        name: agent.name,
        from: rec.job,
        to: newJob,
        reason: staleness > 0.6 ? "bored" : "wanderlust",
        settlementId: homeSid,
        tick: this.clock.tick
      });
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
            const agent = this._agentById(agentId);
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
        this.eventBus.emit("EVENT_OCCURRED", newEvent);
      }
    }
    
    // Update ongoing event effects
    this.eventSystem.updateActiveEvents(this.clock.tick, this);
  }
  
  updateFactions() {
    // Check for new faction formation every 100 ticks
    if (this.clock.tick % 100 === 0 && this.agents.length > 10) {
      // New faction formation is observable via the event bus (factionSystem emits).
      this.factionSystem.checkForNewFactions(this.agents, this.relationshipSystem);
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
    const births = this._birthsBuffer || (this._birthsBuffer = []);
    births.length = 0;
    // Agents whose position changed this tick; index repositioned
    // in one batched flush after the decision loop (see below).
    const moved = this._movedBuffer || (this._movedBuffer = []);
    moved.length = 0;

    // Rebuild the incomplete-construction shortlist once per tick.
    if (this._incompleteBuildingsTick !== this.clock.tick) {
      this._incompleteBuildingsTick = this.clock.tick;
      const list = this._incompleteBuildingsBuffer || (this._incompleteBuildingsBuffer = []);
      list.length = 0;
      for (const b of this.buildings) {
        if (!b.complete && (b.constructionProgress || 0) < 100) list.push(b);
      }
      if (this.constructionSystem && this.constructionSystem.pendingBuildings) {
        for (const b of this.constructionSystem.pendingBuildings) {
          if (!b.isComplete && (b.constructionProgress || 0) < 100) list.push(b);
        }
      }
      this.incompleteBuildings = list;
    }
    
    const currentTick = this.clock.tick;
    let t0Count = 0, t1Count = 0, t2Count = 0;
    const activeAgentsThisTick = this._activeAgentsBuffer || (this._activeAgentsBuffer = []);
    activeAgentsThisTick.length = 0;

    // Pass 1: LOD classification and time-slice scheduling
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      if (!agent.alive) continue;

      const tier = this.getAgentLodTier(agent);
      agent._lodTier = tier;

      if (tier === 0) {
        t0Count++;
        agent.updateNeeds(1);
        activeAgentsThisTick.push(agent);
      } else if (tier === 1) {
        t1Count++;
        // Interleaved 1 in 3 ticks deterministically (modulo agent.id)
        if ((agent.id + currentTick) % 3 === 0) {
          agent.updateNeeds(3);
          activeAgentsThisTick.push(agent);
        }
      } else {
        t2Count++;
        // Interleaved 1 in 12 ticks deterministically with simplified macro simulation
        if ((agent.id + currentTick) % 12 === 0) {
          agent.executeMacroTick(this, 12, moved, births);
        }
      }
    }

    this.lodStats.tier0 = t0Count;
    this.lodStats.tier1 = t1Count;
    this.lodStats.tier2 = t2Count;
    this.lodStats.total = this.agents.length;
    this.lodStats.tickedThisFrame = activeAgentsThisTick.length;

    // Pass 2: prepare perception state for all active detailed agents
    for (let i = 0; i < activeAgentsThisTick.length; i++) {
      const agent = activeAgentsThisTick[i];
      if (!agent.alive) continue;

      const perception = agent._ensurePerception();
      agent.invalidatePerception();

      // Ground loot direct scan
      if (this.groundItems.length > 0) {
        for (const it of this.groundItems) {
          if (it.destroyed || it.total() <= 0) continue;
          const dx = it.x - agent.x, dy = it.y - agent.y;
          if (dx * dx + dy * dy <= 484 && perception.nearbyItems.length < 4) {
            perception.nearbyItems.push(it);
          }
        }
      }
    }

    // Pass 3: decide and act for active detailed agents
    for (let i = 0; i < activeAgentsThisTick.length; i++) {
      const agent = activeAgentsThisTick[i];
      if (!agent.alive) continue;
      const perception = agent._perception;

      // Generate goals
      agent.generateGoals(this, perception);
      
      // Generate and choose actions. Gossip influence: target's second-hand opinion
      const actions = agent.generateActions(perception, this.world, this);
      let targetGossip = null;
      for (const a of actions) {
        if (!Agent.SOCIAL_ACTION_TYPES.has(a.type)) continue;
        const t = a.target;
        if (t && typeof t === "object" && t.type === "agent" && t.gossipViews?.has(agent.id)) {
          if (!targetGossip) {
            targetGossip = this._targetGossipMap || (this._targetGossipMap = new Map());
            targetGossip.clear();
          }
          targetGossip.set(t.id, t.gossipViews.get(agent.id));
        }
      }
      const chosenAction = agent.chooseAction(actions, { targetGossip });
      
      // Execute action with crafting system and simulation references
      const px = agent.x, py = agent.y;
      const result = agent.executeAction(chosenAction, this.world, this.eventBus, this.craftingSystem, this);
      if (agent.x !== px || agent.y !== py) moved.push(agent);
      
      // Handle birth result
      if (result && result.type === "birth") {
        births.push({ x: result.x, y: result.y, parentId1: result.parentId1, parentId2: result.parentId2 });
      }
    }
    
    // Batched spatial-index repositioning for everything that moved this
    // tick (one Map remove/add pair per tile-crossing agent, replacing the
    // inline pair inside moveToward). Between rebuilds the index is
    // approximate by design; rebuildSpatialIndex() stays the authority.
    this.world.updateMovedAgents(moved);

    // Belt-and-suspenders: the scan cache is already invalidated by every
    // spatial-index mutation, but clearing it at the tick boundary also
    // bounds memory and guarantees no entry can ever be read after a later
    // mutation path that bypasses addToSpatialIndex/removeFromSpatialIndex.
    this.world.invalidateScanCache();

    // Create newborn agents within world carrying-capacity cap
    const cap = this.maxAgents ?? 360;
    for (const birth of births) {
      if (this.agents.length >= cap) break;
      if (this.world.isWalkable(Math.floor(birth.x), Math.floor(birth.y))) {
        const baby = new Agent(birth.x, birth.y, this.idGen, 0, this.world.rng); // Newborn baby with age 0 (seeded RNG)
        baby.lifeStage = 'child';
        baby.parents = [birth.parentId1, birth.parentId2];
        
        // Inherit some traits from parents
        const parent1 = this._agentById(birth.parentId1);
        const parent2 = this._agentById(birth.parentId2);
        if (parent1 && parent2) {
          baby.personality.industrious = (parent1.personality.industrious + parent2.personality.industrious) / 2;
          baby.personality.social = (parent1.personality.social + parent2.personality.social) / 2;
          baby.personality.brave = (parent1.personality.brave + parent2.personality.brave) / 2;
          baby.skills.gather = (parent1.skills.gather + parent2.skills.gather) / 2;
          baby.settlementId = parent1.settlementId || parent2.settlementId;
        }
        this.addAgent(baby);
        this.world.addToSpatialIndex(Math.floor(birth.x), Math.floor(birth.y), baby);
        this.eventBus.emit("AGENT_CREATED", { agentId: baby.id, name: baby.name, x: baby.x, y: baby.y, reason: "birth" });
        // Synchronously link parent-child relationships (replaces old setTimeout hack)
        this.relationshipSystem.initializeAgent(baby.id);
        if (parent1) this.relationshipSystem.addParentChild(parent1.id, baby.id);
        if (parent2) this.relationshipSystem.addParentChild(parent2.id, baby.id);
        if (parent1 && parent2) this.relationshipSystem.addChildToMarriage(parent1.id, parent2.id, baby.id);
        if (this.dynastySystem) {
          this.dynastySystem.onAgentBorn(baby, parent1, parent2);
        }
        if (typeof baby.addLifeEvent === 'function') {
          const pText = parent1 ? ` to ${parent1.name}${parent2 && parent2 !== parent1 ? ` & ${parent2.name}` : ''}` : '';
          baby.addLifeEvent('BIRTH', `Born${pText}`, currentTick, '👶', true);
        }
        if (parent1 && typeof parent1.addLifeEvent === 'function') {
          parent1.addLifeEvent('CHILD', `Welcomed newborn ${baby.name}`, currentTick, '👶', true);
        }
        if (parent2 && parent2 !== parent1 && typeof parent2.addLifeEvent === 'function') {
          parent2.addLifeEvent('CHILD', `Welcomed newborn ${baby.name}`, currentTick, '👶', true);
        }
      }
    }
    
    // Remove dead agents, transfer inheritance to settlement, and emit death
    // events. Perf: single pass collects the dead (previously a `filter` scan
    // allocated a new array every tick *and* re-scanned the roster); the
    // survivors then compact in place (no new array), keeping element order
    // identical to the old filter() result so processing order — and thus the
    // shared RNG stream — is unchanged.
    let anyDead = false;
    for (let i = 0; i < this.agents.length; i++) {
      if (!this.agents[i].alive) { anyDead = true; break; }
    }
    if (anyDead) {
      const deadAgents = [];
      for (const agent of this.agents) {
        if (!agent.alive) deadAgents.push(agent);
      }
      for (const dead of deadAgents) {
        const deathCause = dead.deathCause || "natural";
        if (typeof dead.addLifeEvent === 'function' && (!dead.lifeHistory || !dead.lifeHistory.some(e => e.kind === 'DEATH'))) {
          dead.addLifeEvent('DEATH', `Died of ${deathCause} at age ${Math.floor(dead.age || 0)}`, currentTick, '🕯️', true);
        }
        this._recordDeadDossier(dead, deathCause);
        // Bookkeeping: drop the economy job record so agentJobs never
        // accumulates ghost rows of the dead. Without this, stale ids get
        // re-issued to newborns and inherit a stranger's profession.
        this.economySystem?.agentJobs?.delete(dead.id);
        this.eventBus.emit("AGENT_DIED", {
          agentId: dead.id,
          name: dead.name,
          x: dead.x,
          y: dead.y,
          age: Math.floor(dead.age),
          cause: deathCause
        });
        this.world.removeFromSpatialIndex(Math.floor(dead.x), Math.floor(dead.y), dead);
        this.world.entityRegistry?.delete(dead.id);
        // If the agent was registered at a drifted cell (updateMovedAgents
        // tracks that in _sx/_sy), prune that entry too. removeFromSpatialIndex
        // clears the tracking stamps itself.
        if (dead._sx !== undefined) {
          this.world.removeFromSpatialIndex(dead._sx, dead._sy, dead);
        }

        // Stockpile inheritance to community: half of each good goes to the
        // settlement; the other half drops as scavengable loot on the ground
        // (Phase 1 — Deep Economy).
        if (dead.settlementId && this.settlementSystem) {
          const set = this.settlementSystem.settlements.get(dead.settlementId);
          if (set && set.stockpile) {
            const inv = dead.inventory;
            set.stockpile.wood = (set.stockpile.wood || 0) + Math.floor((inv.wood_log || 0) / 2);
            set.stockpile.ore = (set.stockpile.ore || 0) + Math.floor((inv.ore_iron || 0) / 2);
            set.stockpile.food = (set.stockpile.food || 0) + Math.floor(((inv.wheat || 0) + (inv.bread || 0)) / 2);
          }
        }
        this.dropInventoryOnGround(dead);
      }
      this.compactAgents(a => a.alive);
    }
  }

  // Drop the remainder of a dead entity's inventory as a ground loot pile.
  // Deterministic: no RNG draws; odd units round down (floor halves).
  dropInventoryOnGround(entity) {
    if (!entity || !entity.inventory) return;
    const contents = {};
    let hasLoot = false;
    for (const key of Object.keys(entity.inventory)) {
      if (key === "capacity") continue;
      const val = entity.inventory[key] || 0;
      if (val <= 0) continue;
      const isGear = key.startsWith("weapon_") || key.startsWith("armor_") || key.startsWith("tool_");
      const dropCount = isGear ? Math.max(1, Math.floor(val / 2)) : Math.floor(val / 2);
      if (dropCount > 0) {
        contents[key] = dropCount;
        hasLoot = true;
      }
    }
    if (!hasLoot) return;
    const item = new GroundItem(entity.x, entity.y, contents, 600, this.idGen.next());
    this.groundItems.push(item);
    this.eventBus.emit("GROUND_ITEM_DROPPED", {
      itemId: item.id,
      x: item.x,
      y: item.y,
      fromId: entity.id,
      total: item.total()
    });
  }

  updateResources() {
    const season = this.clock.getSeason();
    const seasonFertility = WorldState.seasonFertility(season);
    const weatherType = this.weatherSystem?.currentWeather?.type;
    const isRaining = weatherType === "rain" || weatherType === "storm";
    // Rain and fertile seasons boost vegetation regrowth
    const envBoost = (isRaining ? 1.6 : 1.0) * seasonFertility;

    for (const resource of this.resources) {
      resource.update(envBoost, this.world);
    }

    // Ground loot decay + cleanup (Phase 1 — Deep Economy)
    if (this.groundItems.length > 0) {
      let writeIdx = 0;
      for (let i = 0; i < this.groundItems.length; i++) {
        const it = this.groundItems[i];
        it.update();
        if (!it.destroyed && it.total() > 0) {
          this.groundItems[writeIdx++] = it;
        }
      }
      this.groundItems.length = writeIdx;
    }
    
    // Natural ecological replenishment: keep the world vibrant with food, wood, and ores
    if (this.clock.tick % 30 === 0) {
      this.maintainWorldResources();
    }
  }

  maintainWorldResources() {
    if (this.clock.tick % 300 === 0 && this.resources.length > 0) {
      let rw = 0;
      for (let i = 0; i < this.resources.length; i++) {
        const r = this.resources[i];
        if (!r.destroyed) {
          this.resources[rw++] = r;
        } else {
          this.world.entityRegistry?.delete(r.id);
        }
      }
      this.resources.length = rw;
    }

    let foodCount = 0;
    let woodCount = 0;
    let oreCount = 0;

    // Count only active, harvestable resources (excluding depleted stumps and empty seams)
    for (const r of this.resources) {
      if (r.destroyed || r.depleted || r.amount <= 0) continue;
      if (r.resourceType === "food") foodCount++;
      else if (r.resourceType === "wood") woodCount++;
      else if (r.resourceType === "ore") oreCount++;
    }

    // Regrow wood in forests/jungles/grasslands — vegetation follows the seasons & rainfall
    const season = this.clock.getSeason();
    const fertility = WorldState.seasonFertility(season);
    const weatherType = this.weatherSystem?.currentWeather?.type;
    const isRaining = weatherType === "rain" || weatherType === "storm";

    const targetWood = 150;
    if (woodCount < targetWood) {
      const needed = Math.max(1, Math.min(10, Math.round((targetWood - woodCount) * (isRaining ? 1.4 : 1.0) * fertility)));
      for (let k = 0; k < needed; k++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
          const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
          const terrain = this.world.getTerrain(x, y);
          if (terrain && (terrain.biome === "forest" || terrain.biome === "jungle" || terrain.biome === "grassland") && this.world.isWalkable(x, y)) {
            const entities = this.world.getEntitiesAt(x, y);
            if (!entities.some(e => e.type === "resource" || e.type === "building")) {
              // New trees sprout naturally as saplings and grow through young -> mature -> ancient
              const res = new Resource(x, y, "wood", 10, this.idGen, { growthStage: "sapling", growthProgress: 12 });
              this.resources.push(res);
              this.world.addToSpatialIndex(x, y, res);
              woodCount++;
              break;
            }
          }
        }
      }
    }

    // Regrow food in grasslands/savannas/plains/forests
    const targetFood = 140;
    if (foodCount < targetFood) {
      const needed = Math.max(1, Math.min(10, Math.round((targetFood - foodCount) * (isRaining ? 1.4 : 1.0) * fertility)));
      for (let k = 0; k < needed; k++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
          const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
          const terrain = this.world.getTerrain(x, y);
          if (terrain && (terrain.biome === "grassland" || terrain.biome === "savanna" || terrain.biome === "beach" || terrain.biome === "forest") && this.world.isWalkable(x, y)) {
            const entities = this.world.getEntitiesAt(x, y);
            if (!entities.some(e => e.type === "resource" || e.type === "building")) {
              const res = new Resource(x, y, "food", Math.floor(30 + this._rng().next() * 25), this.idGen);
              this.resources.push(res);
              this.world.addToSpatialIndex(x, y, res);
              foodCount++;
              break;
            }
          }
        }
      }
    }

    // Mineral ore veins are finite and slow to uncover — heavy mining permanently
    // depletes nearby seams, forcing caravans and territorial competition.
    const targetOre = 48;
    if (oreCount < targetOre && (this.clock.tick % 90 === 0)) {
      const needed = Math.min(2, targetOre - oreCount);
      for (let k = 0; k < needed; k++) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = Math.floor(this._rng().next() * (this.world.width - 4)) + 2;
          const y = Math.floor(this._rng().next() * (this.world.height - 4)) + 2;
          const terrain = this.world.getTerrain(x, y);
          if (terrain && (terrain.biome === "mountain" || terrain.biome === "highland" || terrain.biome === "tundra") && this.world.isWalkable(x, y)) {
            const entities = this.world.getEntitiesAt(x, y);
            if (!entities.some(e => e.type === "resource" || e.type === "building")) {
              const res = new Resource(x, y, "ore", Math.floor(35 + this._rng().next() * 25), this.idGen, { exhaustionsRemaining: 1 });
              this.resources.push(res);
              this.world.addToSpatialIndex(x, y, res);
              oreCount++;
              break;
            }
          }
        }
      }
    }
  }

  updateBuildings() {
    const season = this.clock.getSeason();
    const fertility = WorldState.seasonFertility(season);
    for (const building of this.buildings) {
      if (typeof building.update === 'function') building.update();
      // Completed farms cultivate food nearby — yield follows the seasons:
      // strong in spring/summer, poor in autumn, near-frozen in winter.
      const farmInterval = season === 'winter' ? 200 : 50;
      if (building.complete && building.buildingType === "farm" && this.clock.tick % farmInterval === 0) {
        let nearFood = 0;
        for (let r = 0; r < this.resources.length; r++) {
          const res = this.resources[r];
          if (!res.destroyed && !res.depleted && res.resourceType === "food" &&
              Math.abs(res.x - building.x) <= 4 && Math.abs(res.y - building.y) <= 4) {
            nearFood++;
            if (nearFood >= 3) break;
          }
        }
        if (nearFood < 3 && this.resources.length < 700) {
          const fx = Math.floor(building.x + (this._rng().next() - 0.5) * 4);
          const fy = Math.floor(building.y + (this._rng().next() - 0.5) * 4);
          if (fx >= 2 && fx < this.world.width - 2 && fy >= 2 && fy < this.world.height - 2 && this.world.isWalkable(fx, fy)) {
            const entities = this.world.getEntitiesAt(fx, fy);
            const hasFood = entities.some(e => e.type === "resource" && e.resourceType === "food");
            if (!hasFood) {
              const amount = Math.round(30 * fertility);
              if (amount > 0) {
                const crop = new Resource(fx, fy, "food", amount, this.idGen);
                this.resources.push(crop);
                this.world.addToSpatialIndex(fx, fy, crop);
              }
            }
          }
        }
      }
    }
  }

  removeAgent(agentId, cause = null) {
    // Perf: O(1) slot lookup via the id map instead of a linear findIndex scan.
    let idx = this._agentIdMap.get(agentId);
    if (idx === undefined || !this.agents[idx] || this.agents[idx].id !== agentId) {
      // Drifted/missing entry: heal the map once, then retry.
      this._rebuildAgentIdMap();
      idx = this._agentIdMap.get(agentId);
    }
    if (idx !== undefined && this.agents[idx] && this.agents[idx].id === agentId) {
      const agent = this.agents[idx];
      agent.alive = false;
      const finalCause = cause || agent.deathCause || "removed";
      if (cause && !agent.deathCause) agent.deathCause = cause;
      if (typeof agent.addLifeEvent === 'function' && (!agent.lifeHistory || !agent.lifeHistory.some(e => e.kind === 'DEATH'))) {
        agent.addLifeEvent('DEATH', `Died of ${finalCause} at age ${Math.floor(agent.age || 0)}`, this.clock?.tick ?? 0, '🕯️', true);
      }
      this._recordDeadDossier(agent, finalCause);
      this.world.removeFromSpatialIndex(Math.floor(agent.x), Math.floor(agent.y), agent);
      this.world.entityRegistry?.delete(agentId);
      this.agents.splice(idx, 1);
      // Perf: splice shifts every later slot down by one — fix the id -> slot
      // map incrementally instead of leaving stale entries behind.
      this._agentIdMap.delete(agentId);
      // Bookkeeping: drop the economy job record so agentJobs never accumulates
      // ghosts of the dead (Phase 3b Step 2 audit found leaked 'soldier' rows).
      this.economySystem?.agentJobs?.delete(agentId);
      for (let i = idx; i < this.agents.length; i++) {
        this._agentIdMap.set(this.agents[i].id, i);
      }
      this.eventBus.emit("AGENT_DIED", { 
        agentId: agent.id, 
        name: agent.name, 
        x: agent.x, 
        y: agent.y, 
        age: Math.floor(agent.age),
        cause: agent.deathCause || cause || "removed"
      });
      return true;
    }
    return false;
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
    const w = this.world?.width || 128;
    const h = this.world?.height || 128;
    const sx = Math.max(1, Math.min(w - 1.1, x));
    const sy = Math.max(1, Math.min(h - 1.1, y));
    const agent = new Agent(sx, sy, this.idGen, null, this.world.rng);
    // God-touched wanderer: while unaffiliated they roam locally and gather
    // supplies instead of trekking to the world center (fixes top-of-map bias).
    agent.pioneer = true;
    agent.spawnX = sx;
    agent.spawnY = sy;
    this.addAgent(agent);
    this.combatSystem?.initCombatEntity?.(agent);
    this.religionSystem?.initReligionEntity?.(agent);
    this.relationshipSystem?.initializeAgent?.(agent.id);
    if (typeof agent.addLifeEvent === 'function') {
      agent.addLifeEvent('ORIGIN', 'Arrived in the world as a pioneer', this.clock?.tick ?? 0, '✨', true);
    }
    this.world.addToSpatialIndex(Math.floor(sx), Math.floor(sy), agent);
    this.eventBus.emit("AGENT_CREATED", { agentId: agent.id, name: agent.name, x: sx, y: sy, reason: "divine" });
    this.eventBus.emit("GOD_POWER_USED", { power: "spawn_agent", x: sx, y: sy });
    return agent;
  }

  /**
   * Player-facing safe citizen spawn: nudges off impassable fortification walls
   * onto a clear neighboring tile and cleanly raises maxAgents when needed.
   */
  spawnCitizenAt(x, y) {
    const w = this.world?.width || 128;
    const h = this.world?.height || 128;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const isClearTile = (cx, cy) => {
      if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= h - 1) return false;
      if (!this.world.isWalkable(cx, cy)) return false;
      if (this.fortificationSystem?.isBlockedForAgent?.(cx, cy, { settlementId: null })) return false;
      return true;
    };

    let spawnX = x;
    let spawnY = y;
    let foundClear = isClearTile(tx, ty);
    if (!foundClear) {
      for (let r = 1; r <= 2 && !foundClear; r++) {
        for (let dy = -r; dy <= r && !foundClear; dy++) {
          for (let dx = -r; dx <= r && !foundClear; dx++) {
            if (isClearTile(tx + dx, ty + dy)) {
              spawnX = tx + dx + 0.5;
              spawnY = ty + dy + 0.5;
              foundClear = true;
            }
          }
        }
      }
    }
    if (!foundClear) return null;

    if (this.agents.length >= (this.maxAgents ?? 360)) {
      this.maxAgents = Math.min(1200, this.agents.length + 25);
    }
    return this.spawnAgent(spawnX, spawnY);
  }

  // Pioneer colonization: god-spawned (or otherwise unaffiliated) agents that
  // settle down together found a brand-new village right where they were born.
  updatePioneers() {
    if (!this.settlementSystem || this.clock.tick % 20 !== 0) return;
    const ssys = this.settlementSystem;
    const pioneers = this.agents.filter(a =>
      a.alive && a.pioneer && !a.settlementId && !ssys.agentSettlementMap.get(a.id));
    if (pioneers.length > 0) {
      for (const seed of pioneers) {
        if (!seed.alive || !seed.pioneer || seed.settlementId || ssys.agentSettlementMap.get(seed.id)) continue;

        // Recruit only still-unassigned nearby pioneers into one clean band
        const band = [seed];
        for (const other of pioneers) {
          if (other === seed || !other.alive || !other.pioneer || other.settlementId || ssys.agentSettlementMap.get(other.id)) continue;
          if (Math.hypot(other.x - seed.x, other.y - seed.y) < 14) band.push(other);
        }
        const nearTown = [...ssys.settlements.values()].some(s =>
          !s.ruined && s.center && Math.hypot(s.center.x - seed.x, s.center.y - seed.y) < 24);
        if (nearTown) continue; // joins an existing town via normal clustering

        if (band.length >= 3) {
          // Ready to colonize: found a village at the band's camp
          let cx = 0, cy = 0;
          for (const b of band) { cx += b.x; cy += b.y; }
          cx /= band.length; cy /= band.length;
          const settlement = ssys.foundSettlement(cx, cy, band);
          for (const b of band) {
            b.pioneer = false;
            if (typeof b.addLifeEvent === 'function') {
              b.addLifeEvent('FOUNDING', `Co-founded frontier settlement ${settlement?.name || 'New Camp'}`, this.clock.tick, '🏕️', true);
            }
          }
          if (settlement) {
            if (this.religionSystem) {
              this.religionSystem.initWorldBeliefs();
            }
            if (this.diplomacySystem) {
              for (const other of ssys.settlements.values()) {
                if (other.id !== settlement.id && !other.ruined) {
                  this.diplomacySystem.initRelation(settlement.id, other.id);
                }
              }
            }
          }
          this.eventBus.emit("SETTLEMENT_FOUNDED", {
            id: settlement?.id ?? null, name: settlement?.name ?? "New Camp",
            x: cx, y: cy, population: band.length, pioneer: true
          });
        } else {
          // Small band: stay active near the spawn site — gather & make camp
          const angle = this._rng().next() * Math.PI * 2;
          const dist = 3 + this._rng().next() * 5;
          const tx = Math.max(8, Math.min(this.world.width - 8, seed.x + Math.cos(angle) * dist));
          const ty = Math.max(8, Math.min(this.world.height - 8, seed.y + Math.sin(angle) * dist));
          seed.goals = [{ type: "gather_supplies", priority: 60, target: { x: tx, y: ty } }];
        }
      }
    }

    // Autonomous organic frontier splintering after world init (keeps tick 0 at 3 cities)
    if (this.clock.tick >= 120 && this.clock.tick % 100 === 0 && ssys.settlements.size < 6) {
      const sortedCities = [...ssys.settlements.values()]
        .filter(s => s && !s.ruined && (s.population || s.agentIds?.size || 0) >= 16)
        .sort((a, b) => a.id - b.id);
      for (const origin of sortedCities) {
        const candidates = [];
        for (const aid of origin.agentIds || []) {
          const a = this._agentById(aid);
          if (a && a.alive && a.lifeStage === 'adult' && !a.isMonarch && !a.militaryDuty && !a.captive && !a.isRebel) {
            candidates.push(a);
          }
        }
        candidates.sort((a, b) => a.id - b.id);
        if (candidates.length < 3) continue;

        let fx = null, fy = null;
        for (let attempt = 0; attempt < 24; attempt++) {
          const ang = this._rng().next() * Math.PI * 2;
          const dist = 27 + this._rng().next() * 14;
          const cx = Math.floor(origin.center.x + Math.cos(ang) * dist);
          const cy = Math.floor(origin.center.y + Math.sin(ang) * dist);
          if (cx < 10 || cy < 10 || cx >= this.world.width - 10 || cy >= this.world.height - 10) continue;
          if (!this.world.isWalkable(cx, cy)) continue;
          const terr = this.world.getTerrain(cx, cy);
          if (!terr || terr.type === 'water' || terr.type === 'snow') continue;
          const farFromAll = [...ssys.settlements.values()].every(s =>
            !s.center || Math.hypot(s.center.x - cx, s.center.y - cy) >= 25
          );
          if (farFromAll) { fx = cx; fy = cy; break; }
        }
        if (fx === null) continue;

        const colonists = candidates.slice(0, 3);
        for (const col of colonists) {
          origin.agentIds.delete(col.id);
          ssys.agentSettlementMap.delete(col.id);
          if (col._sx !== undefined) this.world.removeFromSpatialIndex(col._sx, col._sy, col);
          col.x = fx + (this._rng().next() - 0.5) * 2;
          col.y = fy + (this._rng().next() - 0.5) * 2;
          col.homeId = null;
          col.workplace = null;
          col.constructionTarget = null;
          col.path = null;
          col.goals = [];
          this.world.addToSpatialIndex(Math.floor(col.x), Math.floor(col.y), col);
        }
        origin.population = origin.agentIds.size;

        const colony = ssys.foundSettlement(fx, fy, colonists);
        if (colony) {
          for (const col of colonists) {
            if (typeof col.addLifeEvent === 'function') {
              col.addLifeEvent('FOUNDING', `Settled splinter kingdom ${colony.name} from ${origin.name}`, this.clock.tick, '🏕️', true);
            }
          }
          if (this.diplomacySystem) {
            for (const other of ssys.settlements.values()) {
              if (other.id !== colony.id && !other.ruined) {
                this.diplomacySystem.initRelation(colony.id, other.id);
              }
            }
            this.diplomacySystem.seedFeud(colony.id, origin.id, 65);
          }
          if (this.chronicleSystem?.add) {
            this.chronicleSystem.add('founding', `🚩 Frontier colonists from ${origin.name} broke away to establish ${colony.name}!`, {
              icon: '🚩',
              x: fx,
              y: fy
            });
          }
          this.eventBus.emit("SETTLEMENT_FOUNDED", {
            id: colony.id, name: colony.name, x: fx, y: fy, population: colonists.length, splinterFrom: origin.name
          });
        }
        break; // At most 1 new frontier colony per 100-tick pass
      }
    }
  }

  /**
   * Detonate a tactical or strategic nuclear weapon at (x, y).
   * Pure deterministic execution (no Math.random). Stamps craters, fallout, fires,
   * ruins structures, kills/irradiates agents, records skull monuments, and triggers diplomacy outrage.
   */
  detonateNuclearStrike({ x, y, attackerSettlementId = null, targetSettlementId = null, reason = "Strategic Nuclear Strike", isGodPower = false, isRetaliation = false } = {}) {
    const tick = this.clock?.tick ?? 0;
    const W = this.world.width || 128;
    const H = this.world.height || 128;
    const cx = Math.max(1, Math.min(W - 2, Math.floor(x ?? W / 2)));
    const cy = Math.max(1, Math.min(H - 2, Math.floor(y ?? H / 2)));

    const attacker = attackerSettlementId != null ? this.settlementSystem?.settlements?.get(attackerSettlementId) : null;
    const target = targetSettlementId != null ? this.settlementSystem?.settlements?.get(targetSettlementId) : null;
    const attackerEraId = attackerSettlementId != null
      ? (this.civilizationAgeSystem?.getSettlementAge?.(attackerSettlementId)?.ageId || 6)
      : 7;
    const isNuclearAgeYield = attackerEraId >= 7 || isGodPower;

    const craterRadius = isNuclearAgeYield ? 6 : 5;
    const falloutRadius = isNuclearAgeYield ? 11 : 9;
    const fireBound = isNuclearAgeYield ? 5 : 4;
    const buildingRadius = isNuclearAgeYield ? 10.5 : 8.5;
    const coreRuinRadius = isNuclearAgeYield ? 5.5 : 4.5;
    const wallBreachRadius = isNuclearAgeYield ? 7.2 : 5.5;
    const vaporizeRadius = isNuclearAgeYield ? 6.0 : 4.5;
    const shockRadius = isNuclearAgeYield ? 13.5 : 10.5;

    this.world.addCrater(cx, cy, craterRadius, 255);
    this.world.addFallout(cx, cy, falloutRadius, 255);

    for (let dy = -fireBound; dy <= fireBound; dy++) {
      for (let dx = -fireBound; dx <= fireBound; dx++) {
        const d = Math.hypot(dx, dy);
        if (d >= 2 && d <= (fireBound + 0.4) && ((dx * dx + dy * dy + tick) % 3 === 0)) {
          const fx = cx + dx;
          const fy = cy + dy;
          if (fx >= 0 && fx < W && fy >= 0 && fy < H && this.world.isWalkable(fx, fy)) {
            this.world.startFire(fx, fy, 50);
          }
        }
      }
    }

    let buildingsRuined = 0;
    if (Array.isArray(this.buildings)) {
      for (const b of this.buildings) {
        if (!b || b.isRuined) continue;
        const d = Math.hypot(b.x - cx, b.y - cy);
        if (d <= buildingRadius) {
          const dmg = d <= coreRuinRadius ? (b.maxHealth || 200) : Math.round((b.maxHealth || 200) * 0.7);
          b.health = Math.max(0, (b.health ?? 100) - dmg);
          if (b.health <= 0 || d <= coreRuinRadius) {
            b.health = 0;
            b.isRuined = true;
            b.ruinedAtTick = tick;
            buildingsRuined++;
            this.eventBus.emit("building_destroyed", { building: b, cause: "nuclear_strike" });
          }
        }
      }
    }

    if (this.fortificationSystem?.segments?.size > 0) {
      const attackerLabel = attacker?.name || "Nuclear Blast";
      for (const seg of this.fortificationSystem.segments.values()) {
        if (!seg || seg.state === "breach" || seg.hp <= 0) continue;
        const d = Math.hypot(seg.x + 0.5 - cx, seg.y + 0.5 - cy);
        if (d <= wallBreachRadius) {
          this.fortificationSystem.damageSegment(seg, seg.maxHp + 100, attackerLabel, null, { silent: true });
        } else if (d <= buildingRadius) {
          const dmg = Math.round((seg.maxHp || 200) * 0.65);
          this.fortificationSystem.damageSegment(seg, dmg, attackerLabel, null, { silent: true });
        }
      }
    }

    let casualties = 0;
    for (const a of this.agents) {
      if (!a || !a.alive) continue;
      const d = Math.hypot(a.x - cx, a.y - cy);
      if (d <= vaporizeRadius) {
        a.health = 0;
        if (a.needs) a.needs.health = 0;
        if (a.combat) a.combat.health = 0;
        a.alive = false;
        a.deathCause = "nuclear_blast";
        if (typeof a.addLifeEvent === "function") {
          a.addLifeEvent("DEATH", "Vaporized in a nuclear detonation", tick, "☢️", true);
        }
        this._recordDeadDossier(a, "nuclear_blast");
        casualties++;
      } else if (d <= shockRadius) {
        const dmg = Math.round((isNuclearAgeYield ? 80 : 65) - (d - vaporizeRadius) * 5);
        a.health = Math.max(0, (a.health ?? 100) - dmg);
        if (a.needs) a.needs.health = a.health;
        if (a.combat) a.combat.health = a.health;
        if (a.health <= 0) {
          a.alive = false;
          a.deathCause = "nuclear_blast";
          if (typeof a.addLifeEvent === "function") {
            a.addLifeEvent("DEATH", "Perished in the nuclear shockwave", tick, "☢️", true);
          }
          this._recordDeadDossier(a, "nuclear_blast");
          casualties++;
        } else {
          if (typeof a.remember === "function") {
            a.remember("SURVIVED_NUKE", tick, { x: a.x, y: a.y, rep: -1 });
          }
          if (typeof a.addLifeEvent === "function") {
            a.addLifeEvent("NUKE", "Survived a blinding nuclear flash", tick, "☢️", true);
          }
        }
      }
    }

    // Track atomic casualties inside active war ledger so War Room / War Score reflect nuclear devastation
    if (this.diplomacySystem && attacker && target && casualties > 0) {
      const war = this.diplomacySystem.activeWars?.find(w =>
        w.active &&
        ((w.attackerId === attacker.id && w.defenderId === target.id) ||
         (w.defenderId === attacker.id && w.attackerId === target.id))
      );
      if (war) {
        war.casualties = war.casualties || {};
        war.casualties[target.id] = (war.casualties[target.id] || 0) + casualties;
        war.weariness = war.weariness || {};
        war.weariness[target.id] = (war.weariness[target.id] || 0) + Math.min(35, casualties * 3);
      }
    }

    const blastTitle = target ? `Atomic Ground Zero: ${target.name}` : "Atomic Ground Zero";
    this.world.addSkullMonument(blastTitle, cx, cy, Math.max(1, casualties), "nuke", tick);

    if (this.warfareSystem && Array.isArray(this.warfareSystem.combatEffects)) {
      this.warfareSystem.combatEffects.push({
        type: "nuke",
        x: cx,
        y: cy,
        radius: isNuclearAgeYield ? 12 : 10,
        tick,
        duration: 55
      });
    }

    if (target) {
      let aliveTargetPop = 0;
      for (const a of this.agents) {
        if (a && a.alive && a.settlementId === target.id) aliveTargetPop++;
      }
      if (aliveTargetPop === 0 && typeof this.settlementSystem?.collapseSettlement === "function") {
        this.settlementSystem.collapseSettlement(
          target.id,
          isGodPower ? "Obliterated by Divine Atomic Fire" : `Nuclear annihilation by ${attacker?.name || "a rival power"}`,
          attacker?.id ?? null,
          tick
        );
      } else if (buildingsRuined >= 3 && aliveTargetPop <= 2) {
        target.ruined = true;
        target.ruinsTicks = Math.max(target.ruinsTicks || 0, 20);
        target.collapseReason = `Devastated by atomic strike (${reason})`;
      }
    }

    if (this.diplomacySystem) {
      if (attacker && this.settlementSystem?.settlements) {
        for (const other of this.settlementSystem.settlements.values()) {
          if (!other || other.id === attacker.id || other.ruined) continue;
          const rel = this.diplomacySystem.getRelation(other.id, attacker.id);
          if (rel) {
            rel.score = Math.max(-100, (rel.score || 0) - 25);
          }
          this.diplomacySystem.addGrievance(other.id, attacker.id, "Atomic Atrocity", 20);
        }
      }
      const actorIds = [];
      const actorNames = [];
      if (attacker) { actorIds.push(attacker.id); actorNames.push(attacker.name); }
      if (target) { actorIds.push(target.id); actorNames.push(target.name); }
      this.diplomacySystem.recordDiplomaticEvent({
        tick,
        type: "nuke",
        outcome: isRetaliation ? "retaliated" : "detonated",
        title: isRetaliation
          ? `☢️ MAD Nuclear Retaliation on ${target?.name || `(${cx}, ${cy})`}`
          : target ? `Atomic Strike on ${target.name}` : `Nuclear Detonation (${cx}, ${cy})`,
        what: attacker
          ? `${attacker.name} detonated a nuclear warhead over ${target?.name || `(${cx}, ${cy})`}, killing ${casualties} and ruining ${buildingsRuined} buildings.`
          : `A nuclear detonation struck ${target?.name || `(${cx}, ${cy})`}, killing ${casualties} and ruining ${buildingsRuined} buildings.`,
        why: reason,
        drivers: [
          `${casualties} blast casualties · ${buildingsRuined} structures ruined`,
          `Persistent toxic fallout across radius ${falloutRadius}`,
          attacker ? `Global atomic outrage (-25 standing, +20 grievance)` : `Divine atomic reckoning`
        ],
        actors: actorIds,
        actorNames,
        x: cx,
        y: cy
      });
    }

    this.eventBus.emit("NUCLEAR_STRIKE", {
      x: cx,
      y: cy,
      attackerId: attacker?.id ?? null,
      attackerName: attacker?.name || (isGodPower ? "Divine Wrath" : "Atomic Power"),
      targetId: target?.id ?? null,
      targetName: target?.name || "Frontier",
      reason,
      casualties,
      buildingsRuined,
      isGodPower,
      isRetaliation,
      tick
    });

    // Mutual Assured Destruction (MAD): if a nuclear-armed target survives an enemy strike, launch atomic retaliation
    if (!isGodPower && !isRetaliation && target && attacker && !target.ruined && !attacker.ruined && attacker.id !== target.id && attacker.center) {
      const targetProg = this.civilizationAgeSystem?.getNuclearProgram?.(target.id);
      if (targetProg && targetProg.unlocked && targetProg.warheads > 0 && (targetProg.lastRetaliationTick ?? -999) <= tick - 30) {
        targetProg.warheads = Math.max(0, targetProg.warheads - 1);
        targetProg.totalStrikes = (targetProg.totalStrikes || 0) + 1;
        targetProg.lastStrikeTick = tick;
        targetProg.lastRetaliationTick = tick;
        this.detonateNuclearStrike({
          x: attacker.center.x,
          y: attacker.center.y,
          attackerSettlementId: target.id,
          targetSettlementId: attacker.id,
          reason: `Mutual Assured Destruction (MAD) automatic nuclear counter-strike after ${attacker.name} hit ${target.name}`,
          isGodPower: false,
          isRetaliation: true,
        });
      }
    }

    return { x: cx, y: cy, casualties, buildingsRuined };
  }

  _recordDeadDossier(agent, cause = "natural") {
    if (!agent || agent.id == null) return null;
    if (!Array.isArray(this._deadDossiers)) this._deadDossiers = [];
    const dossier = this.buildAgentDossier(agent, { alive: false, deathCause: cause || agent.deathCause || "natural" });
    const existingIdx = this._deadDossiers.findIndex(d => d.id === agent.id);
    if (existingIdx !== -1) {
      this._deadDossiers[existingIdx] = dossier;
    } else {
      this._deadDossiers.push(dossier);
      if (this._deadDossiers.length > 120) {
        this._deadDossiers.shift();
      }
    }
    return dossier;
  }

  buildAgentDossier(agent, overrides = {}) {
    if (!agent) return null;
    const settlementName = agent.settlementId
      ? (this.settlementSystem?.settlements?.get(agent.settlementId)?.name || `Settlement ${agent.settlementId}`)
      : "Wilds";

    const resolveRef = (id) => {
      if (id == null) return null;
      const live = this._agentById(id);
      if (live) return { id: live.id, name: live.name, alive: !!live.alive };
      const archived = Array.isArray(this._deadDossiers) ? this._deadDossiers.find(d => d.id === id) : null;
      if (archived) return { id: archived.id, name: archived.name, alive: false };
      const hero = Array.isArray(this.fallenHeroes) ? this.fallenHeroes.find(h => h.id === id) : null;
      if (hero) return { id: hero.id, name: hero.name, alive: false };
      return { id, name: `#${id}`, alive: false };
    };

    const fam = this.relationshipSystem?.getRelatives?.(agent.id);
    const parentIds = (fam?.parents?.length ? fam.parents : agent.parents) || [];
    const parents = parentIds.map(resolveRef).filter(Boolean);
    const spouseId = fam?.spouse ?? agent.partnerId ?? null;
    const spouse = spouseId != null ? resolveRef(spouseId) : null;
    const children = (fam?.children || []).map(resolveRef).filter(Boolean);
    const siblings = (fam?.siblings || []).map(resolveRef).filter(Boolean);

    const friends = [];
    const rivals = [];
    const relMap = this.relationshipSystem?.relationships?.get(agent.id);
    if (relMap) {
      const entries = Array.from(relMap.entries()).sort((a, b) => a[0] - b[0]);
      for (const [otherId, rel] of entries) {
        const ref = resolveRef(otherId);
        if (!ref) continue;
        const net = Math.round((rel.friendship || 0) - (rel.rivalry || 0));
        if ((rel.rivalry || 0) >= 25 || net <= -20) {
          rivals.push({ ...ref, score: Math.round(rel.rivalry || Math.abs(net)), label: rel.relationType || "Rival" });
        } else if ((rel.friendship || 0) >= 25 || (rel.romance || 0) >= 40) {
          friends.push({
            ...ref,
            score: Math.round(Math.max(rel.friendship || 0, rel.romance || 0)),
            label: rel.relationType || ((rel.romance || 0) >= 60 ? "Romantic" : "Friend")
          });
        }
      }
      friends.sort((a, b) => b.score - a.score || a.id - b.id);
      rivals.sort((a, b) => b.score - a.score || a.id - b.id);
    }

    return {
      id: agent.id,
      name: agent.name,
      surname: agent.surname ?? null,
      epithet: agent.epithet ?? null,
      age: Math.floor(agent.age || 0),
      maxAge: Math.floor(agent.maxAge || 72),
      lifeStage: agent.lifeStage || "adult",
      gender: agent.gender || "neutral",
      alive: overrides.alive !== undefined ? overrides.alive : agent.alive !== false,
      deathCause: overrides.deathCause ?? agent.deathCause ?? null,
      deathTick: overrides.alive === false ? (this.clock?.tick ?? 0) : null,
      job: agent.job || "unemployed",
      jobTitle: agent.jobTitle || agent.job || "Unemployed",
      settlementId: agent.settlementId ?? null,
      settlementName,
      generation: agent.generation ?? 1,
      traits: agent.personality ? { ...agent.personality } : {},
      skills: agent.skills ? { ...agent.skills } : {},
      kills: agent.kills || 0,
      battlesFought: agent.battlesFought || 0,
      veteranCampaigns: agent.veteranCampaigns || 0,
      legendaryWeapon: agent.legendaryWeapon || null,
      isMonarch: agent.isMonarch === true,
      isRebel: agent.isRebel === true,
      captive: agent.captive === true,
      combatRole: agent.combatRole || null,
      faith: Math.round(agent.religion?.faith || 0),
      beliefId: agent.religion?.beliefId || null,
      reputation: Math.round(agent.reputation || 0),
      parents,
      spouse,
      children,
      siblings,
      friends: friends.slice(0, 6),
      rivals: rivals.slice(0, 6),
      lifeHistory: Array.isArray(agent.lifeHistory) ? agent.lifeHistory.map(e => ({ ...e })) : []
    };
  }

  getAgentDossier(agentOrId) {
    if (!agentOrId && agentOrId !== 0) return null;
    const id = typeof agentOrId === "object" ? agentOrId.id : agentOrId;
    const live = this._agentById(id);
    if (live && live.alive) {
      return this.buildAgentDossier(live);
    }
    if (Array.isArray(this._deadDossiers)) {
      const archived = this._deadDossiers.find(d => d.id === id);
      if (archived) return archived;
    }
    if (Array.isArray(this.fallenHeroes)) {
      const hero = this.fallenHeroes.find(h => h.id === id);
      if (hero) {
        return {
          id: hero.id,
          name: hero.name,
          surname: null,
          epithet: hero.epithet || null,
          age: hero.age || 0,
          maxAge: hero.age || 72,
          lifeStage: "fallen",
          gender: "neutral",
          alive: false,
          deathCause: hero.cause || "combat",
          deathTick: hero.deathTick || 0,
          job: "soldier",
          jobTitle: "Fallen Hero",
          settlementId: null,
          settlementName: hero.settlementName || "Wilds",
          generation: 1,
          traits: {},
          skills: {},
          kills: hero.kills || 0,
          battlesFought: hero.battlesFought || 0,
          veteranCampaigns: 0,
          legendaryWeapon: hero.legendaryWeapon || null,
          isMonarch: !!hero.isMonarch,
          isRebel: false,
          captive: false,
          combatRole: null,
          faith: 0,
          beliefId: null,
          reputation: 0,
          parents: [],
          spouse: null,
          children: [],
          siblings: [],
          friends: [],
          rivals: [],
          lifeHistory: [
            { tick: hero.deathTick || 0, year: Math.floor((hero.deathTick || 0) / 100) + 1, kind: "DEATH", icon: "🕯️", text: `Fell (${hero.cause || "combat"}) with ${hero.kills || 0} kills.`, milestone: true }
          ]
        };
      }
    }
    if (typeof agentOrId === "object") {
      return this.buildAgentDossier(agentOrId, { alive: false });
    }
    return null;
  }

  // Step H: "Warring Kingdoms" starter scenario. Takes the towns founded at
  // world init and makes them hereditary rivals: warlike cultures (raised
  // belligerence, lowered cooperation) plus pre-seeded grievance feuds that
  // resolve through the normal casus-belli pipeline within ~150 ticks —
  // instantly watchable conflict without touching default-world behavior.
  // Deterministic: no RNG draws; settlement ids are assigned in loop order.
  applyWarringScenario() {
    const settlements = [...this.settlementSystem.settlements.values()]
      .sort((a, b) => a.id - b.id);
    for (const s of settlements) {
      const v = s.culture?.values;
      if (v) {
        v.belligerence = Math.min(0.9, (v.belligerence ?? 0.3) + 0.45);
        v.cooperation = Math.max(0.2, (v.cooperation ?? 0.8) - 0.4);
        s.culture.ethos = 'Warring Kingdom';
      }
    }
    // Chain rivalries: town 1 vs 2, 2 vs 3, ... plus 1 vs last when possible.
    for (let i = 0; i + 1 < settlements.length; i++) {
      this.diplomacySystem.seedFeud(settlements[i].id, settlements[i + 1].id, 100);
    }
    if (settlements.length >= 3) {
      this.diplomacySystem.seedFeud(
        settlements[0].id, settlements[settlements.length - 1].id, 150);
    }
  }

  /**
   * "Modern & Nuclear Age" starter scenario for immediate late-era play & development.
   * Expands founding cities into fortified Era 6-7 powers with modern workshops, farms,
   * stockpiles, bastion walls, atomic warheads, and an active devastating Total War.
   */
  applyModernNuclearScenario() {
    const settlements = [...this.settlementSystem.settlements.values()]
      .filter(s => s && !s.ruined && s.center)
      .sort((a, b) => a.id - b.id);
    if (settlements.length === 0) return;

    const jobs = ['soldier', 'soldier', 'farmer', 'miner', 'lumberjack', 'craftsman', 'builder'];

    for (let idx = 0; idx < settlements.length; idx++) {
      const s = settlements[idx];
      const cx = Math.floor(s.center.x);
      const cy = Math.floor(s.center.y);

      // Expand population to ~18 adults per city
      const targetPop = 18;
      let attempts = 0;
      while ((s.agentIds?.size || 0) < targetPop && attempts < 140) {
        attempts++;
        const ax = cx + (this._rng().next() - 0.5) * 12;
        const ay = cy + (this._rng().next() - 0.5) * 12;
        const tx = Math.floor(ax);
        const ty = Math.floor(ay);
        if (tx < 3 || ty < 3 || tx >= this.world.width - 3 || ty >= this.world.height - 3) continue;
        if (!this.world.isWalkable(tx, ty)) continue;
        const agent = new Agent(ax, ay, this.idGen, null, this.world.rng);
        agent.settlementId = s.id;
        agent.factionId = s.factionId ?? null;
        agent.age = 20 + ((agent.id * 7) % 18);
        agent.lifeStage = 'adult';
        const job = jobs[(s.agentIds.size + idx) % jobs.length];
        agent.job = job;
        agent.jobTitle = job.charAt(0).toUpperCase() + job.slice(1);
        this.addAgent(agent);
        this.world.addToSpatialIndex(tx, ty, agent);
        s.agentIds.add(agent.id);
        this.settlementSystem?.agentSettlementMap?.set(agent.id, s.id);
        this.economySystem?.agentJobs?.set(agent.id, { job, salary: 16, satisfaction: 88, assignedAt: 0 });
        agent.addLifeEvent?.('ORIGIN', `Modern citizen of ${s.name}`, 0, '🏙️', true);
      }
      s.population = s.agentIds?.size || 0;

      // Seed modern civic, industrial & nuclear complexes
      // Era 7 superpowers begin with Factory, Research Lab, Nuclear Power Plant, and Missile Silo;
      // Era 6 powers begin with Factory & civic core and construct Atomic infrastructure.
      const offsets = [
        { dx: -2, dy: -2, type: 'workshop' },
        { dx: 3, dy: -2, type: 'farm' },
        { dx: -3, dy: 0, type: 'house' },
        { dx: 3, dy: 1, type: 'house' },
        { dx: 0, dy: -3, type: 'granary' },
        { dx: 0, dy: 3, type: 'barracks' },
        { dx: -2, dy: 2, type: 'factory' },
        { dx: 2, dy: 3, type: 'market' },
        ...(idx < 2 ? [
          { dx: 3, dy: -4, type: 'research_lab' },
          { dx: -4, dy: -2, type: 'nuclear_plant' },
          { dx: 4, dy: 3, type: 'missile_silo' },
        ] : []),
      ];
      for (const off of offsets) {
        const bx = cx + off.dx;
        const by = cy + off.dy;
        if (bx < 3 || by < 3 || bx >= this.world.width - 3 || by >= this.world.height - 3) continue;
        if (!this.world.isWalkable(bx, by)) continue;
        if (this.buildings.some(b => b && !b.isRuined && Math.floor(b.x) === bx && Math.floor(b.y) === by)) continue;
        const b = new Building(bx, by, off.type, this.idGen, s.id, s.factionId ?? null);
        b.complete = true;
        b.isComplete = true;
        b.constructionProgress = 100;
        this.buildings.push(b);
        this.world.addToSpatialIndex(bx, by, b);
        this.world.entityRegistry?.set(b.id, b);
        if (!s.buildings) s.buildings = [];
        s.buildings.push(b);
      }

      // Rich industrial & military stockpiles
      s.stockpile = {
        ...(s.stockpile || {}),
        food: 165,
        wood: 145,
        ore: 120,
        weapon_sword: 4,
        weapon_bow: 6,
        armor_shield: 4,
      };

      // Militarized modern culture
      if (s.culture?.values) {
        s.culture.values.belligerence = idx < 2 ? 0.84 : 0.72;
        s.culture.values.cooperation = 0.25;
        s.culture.ethos = idx < 2 ? 'Nuclear Superpower' : 'Modern Republic';
      }

      // Advance first two powers into Era 7 (Nuclear Age) & others into Era 6 (Modern Tactical)
      const targetEra = idx < 2 ? 7 : 6;
      this.civilizationAgeSystem?.setSettlementAge?.(s.id, targetEra, true);
      const prog = this.civilizationAgeSystem?.getNuclearProgram?.(s.id);
      if (prog) {
        prog.unlocked = true;
        prog.warheads = idx < 2 ? 2 : 1;
        prog.progress = 55;
        prog.doctrine = 'deterrence';
      }

      // Fortify perimeter with Reinforced Bastion Walls & Corner Watchtowers
      this.fortificationSystem?.fortifySettlement?.(s.id, { tick: 0 });
    }

    // Seed geopolitical web: Conventional Combined-Arms Total War (Tanks, Planes, Artillery), Alliance Pact, and Sanctions
    if (settlements.length >= 2 && this.diplomacySystem) {
      if (settlements.length >= 3) {
        // Forge an active Defensive Alliance & impose trade sanctions so diplomacy immediately has alliances, embargoes, and wars
        this.diplomacySystem.formAlliance(settlements[1].id, settlements[2].id, 0);
        this.diplomacySystem.imposeSanctions(
          settlements[0].id,
          settlements[2].id,
          'Strategic containment & atomic non-proliferation embargo',
          0
        );
        this.diplomacySystem.seedFeud(settlements[0].id, settlements[2].id, 80);
      }
      this.diplomacySystem.seedFeud(settlements[0].id, settlements[1].id, 0);
      this.diplomacySystem.declareWar(
        settlements[0].id,
        settlements[1].id,
        'Mechanized Total War — Armored & Air Offensive',
        0,
        {
          totalWar: true,
          why: `${settlements[0].name} and ${settlements[1].name} mobilized tanks, strike aircraft, and rocket artillery while keeping atomic weapons in last-resort reserve.`,
          drivers: ['Armored & Air Divisions', 'Conventional Total War', 'Atomic Last-Resort Deterrence'],
          skipAllyCall: true,
        }
      );
    }
  }

  // Serialization (doc 02: persistence service)
  serialize() {
    return {
      seed: this.seed ?? this.world.seed,
      scenario: this._scenario || 'warring',
      worldSeed: this.world.seed,
      maxAgents: this.maxAgents ?? 360,
      birthsThisSession: this.birthsThisSession || 0,
      deathsThisSession: this.deathsThisSession || 0,
      fireActive: this._fireActive === true,
      burningTileCount: this.burningTileCount || 0,
      rngState: this.world.rng.getState(), // determinism: restore RNG stream on load
      world: this.world.serialize(), // terrain arrays (skipTerrain load path)
      clock: this.clock.serialize(),
      idGen: this.idGen.getState(),
      agents: this.agents.map(a => a.serialize()),
      resources: this.resources.map(r => r.serialize()),
      groundItems: this.groundItems.map(g => g.serialize()), // Phase 1 loot piles
      buildings: this.buildings.map(b => typeof b.serialize === 'function' ? b.serialize() : null).filter(Boolean),
      // Phase 1 systems (Complete)
      relationships: this.relationshipSystem.serialize(),
      settlements: this.settlementSystem.serialize(),
      economy: this.economySystem.serialize(),
      crafting: this.craftingSystem.serialize(),
      trade: this.tradeSystem.serialize(), // NEW: Trade routes/caravans
      diplomacy: this.diplomacySystem ? this.diplomacySystem.serialize() : null, // inter-realm relations/wars/treaties
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
      chronicle: this.chronicleSystem.serialize(),
      civilizationAges: this.civilizationAgeSystem ? this.civilizationAgeSystem.serialize() : null,
      weather: this.weatherSystem ? this.weatherSystem.serialize() : null,
      dynasties: this.dynastySystem ? this.dynastySystem.serialize() : null,
      naval: this.navalSystem ? this.navalSystem.serialize() : null,
      espionage: this.espionageSystem ? this.espionageSystem.serialize() : null,
      fortifications: this.fortificationSystem ? this.fortificationSystem.serialize() : null,
      fallenHeroes: Array.isArray(this.fallenHeroes) ? this.fallenHeroes.map(h => ({ ...h })) : [],
      deadDossiers: Array.isArray(this._deadDossiers) ? this._deadDossiers.map(d => ({
        ...d,
        traits: d.traits ? { ...d.traits } : {},
        skills: d.skills ? { ...d.skills } : {},
        lifeHistory: Array.isArray(d.lifeHistory) ? d.lifeHistory.map(e => ({ ...e })) : []
      })) : [],
      mortalityStats: {
        totalDeaths: this.mortalityStats.totalDeaths,
        totalAgeAtDeath: this.mortalityStats.totalAgeAtDeath,
        averageAgeAtDeath: this.mortalityStats.averageAgeAtDeath,
        minAgeAtDeath: this.mortalityStats.minAgeAtDeath,
        maxAgeAtDeath: this.mortalityStats.maxAgeAtDeath,
        causes: { ...this.mortalityStats.causes }
      },
      // Warfare: active warbands (march targets, morale, plunder cargo) drive
      // soldier behavior every tick — losing them desyncs a resumed run badly.
      warfare: {
        warbands: Array.from(this.warfareSystem.warbands.entries()),
        nextWarbandId: this.warfareSystem.nextWarbandId,
        combatEffects: this.warfareSystem.combatEffects.map(e => ({ ...e }))
      },
      // Career-change churn counter (3 failed hires => agent settles
      // permanently). The unemployment sweep branches on it before consuming
      // RNG, so a resumed run must see identical counts or it diverges.
      career: {
        jobChangeCount: Array.from(this._jobChangeCount.entries())
      }
    };
  }

  static deserialize(data) {
    // skipInit: constructing a full sim would run world/entity initialization,
    // consuming RNG draws and creating default entities that then get cleared —
    // both a determinism hazard and wasted work. We restore everything from data.
    const sim = new Simulation(data.seed, 128, 128, { skipInit: true, maxAgents: data.maxAgents ?? 360 });
    sim.birthsThisSession = data.birthsThisSession || 0;
    sim.deathsThisSession = data.deathsThisSession || 0;
    // Step H: remember which scenario this save came from (informational;
    // all scenario state — feuds, cultures — is restored from the data).
    if (data.scenario) sim._scenario = data.scenario;
    // Determinism fix: WorldState.deserialize() replaces `world.rng` with a
    // fresh object restored from the terrain save's stream position. Agents
    // hold live references to the ORIGINAL world.rng (their behavior draws
    // mutate that shared object), so after deserialization every agent was
    // drawing from an orphaned stream while sim._rng()/systems read the new
    // one — resumed runs diverged from uninterrupted ones on the very first
    // tick. Adopt the agents' shared stream as canonical BEFORE restoring
    // state, then write the authoritative saved position onto that single
    // object (sim._rng() re-points world.rng at it on first call).
    sim._agentRng = sim.world.rng;
    if (data.rngState) {
      sim._agentRng.setState(data.rngState);
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
      // Burning tiles are ground state too: without restoring them a resumed world
      // silently extinguishes every active fire and diverges from an uninterrupted run.
      sim.world.fireTiles = new Uint16Array(data.world.fireTiles || new Uint16Array(sim.world.width * sim.world.height));
      sim.world.scorchedTiles = new Uint8Array(data.world.scorchedTiles || new Uint8Array(sim.world.width * sim.world.height));
      sim.world.craterTiles = new Uint8Array(data.world.craterTiles || new Uint8Array(sim.world.width * sim.world.height));
      sim.world.radiationTiles = new Uint8Array(data.world.radiationTiles || new Uint8Array(sim.world.width * sim.world.height));
      sim.world.skullMonuments = Array.isArray(data.world.skullMonuments) ? data.world.skullMonuments.map(m => ({ ...m })) : [];
      sim.world.nextMonumentId = data.world.nextMonumentId || (sim.world.skullMonuments.length + 1);
      sim.world._radiationActive = sim.world.radiationTiles.some(v => v > 0);
      // Bridge decks are ground state too: without restoring them a resumed
      // world loses every crossing, agents reroute (consuming RNG differently)
      // and the run diverges from an uninterrupted one.
      sim.world.bridgeTiles = new Uint8Array(data.world.bridgeTiles || new Uint8Array(sim.world.width * sim.world.height));
      sim._fireActive = data.fireActive !== undefined ? data.fireActive : (sim.world.countFires() > 0);
      sim.burningTileCount = data.burningTileCount !== undefined ? data.burningTileCount : sim.world.countFires();
    }
    
    // Restore entities. Ordering matters for resume determinism: resources
    // and buildings are created (and registered in world.entityRegistry)
    // BEFORE agents, because Agent.deserialize re-links goal/action target
    // ids against the registry — an agent restored first could never resolve
    // a building/resource target and would re-decide from scratch on resume.
    for (const resourceData of data.resources) {
      const resource = Resource.deserialize(resourceData, sim.idGen);
      sim.resources.push(resource);
      // Match rebuildSpatialIndex(): depleted nodes stay OUT of the spatial
      // index until they refill. Registering them here made a resumed world
      // perceive "amount 0" trees/veins that an uninterrupted run cannot see,
      // changing action scores on the very first resumed tick (determinism).
      if (resource.depleted !== true && resource.amount > 0) {
        sim.world.addToSpatialIndex(Math.floor(resource.x), Math.floor(resource.y), resource);
      }
      sim.world.entityRegistry.set(resource.id, resource);
    }

    for (const buildingData of data.buildings) {
      const building = Building.deserialize(buildingData, sim.idGen);
      sim.buildings.push(building);
      sim.world.addToSpatialIndex(Math.floor(building.x), Math.floor(building.y), building);
      sim.world.entityRegistry.set(building.id, building);
    }

    for (const agentData of data.agents) {
      const agent = Agent.deserialize(agentData, sim.idGen, sim.world.rng, sim.world, sim);
      sim.addAgent(agent);
      sim.world.addToSpatialIndex(Math.floor(agent.x), Math.floor(agent.y), agent);
    }

    // Ground loot piles: plain world objects — no spatial index entry needed.
    // Backward compatible: old saves without the field simply start empty.
    sim.groundItems = [];
    for (const itemData of data.groundItems || []) {
      sim.groundItems.push(GroundItem.deserialize(itemData, sim.idGen));
    }
    
    // Restore Phase 1 systems (Complete)
    if (data.relationships) {
      sim.relationshipSystem = RelationshipSystem.deserialize(data.relationships, sim);
    }
    if (data.settlements) {
      sim.settlementSystem = SettlementSystem.deserialize(data.settlements, sim);
    }
    if (data.economy) {
      sim.economySystem = EconomySystem.deserialize(data.economy, sim);
    }
    if (data.crafting) {
      sim.craftingSystem = CraftingSystem.deserialize(data.crafting, sim);
    }
    if (data.trade) {
      sim.tradeSystem = TradeSystem.deserialize(data.trade, sim);
    }
    // Diplomacy state (relations, treaties, active wars, next ids, last-tick
    // cadence marker) drives war declarations every 40/50 ticks; without it a
    // resumed world re-initializes relations and diverges from an uninterrupted run.
    if (data.diplomacy && sim.diplomacySystem) {
      sim.diplomacySystem.deserialize(data.diplomacy);
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

    // settlement.buildings is a SECOND copy of building state: simulation.js
    // pushes live Building objects into it when placing blueprints, but
    // SettlementSystem.serialize() spreads them into plain snapshots. On load
    // they come back as detached plain objects, so construction progress
    // applied to the live Building never reaches the settlement copy — and any
    // code reading settlement.buildings (ruin decay, home lookup) sees stale
    // data on a resumed world that an uninterrupted run never has (this was
    // the last gossip save/load divergence). Re-point every entry whose id
    // matches a restored live Building so both views share one object again.
    if (sim.settlementSystem && sim.buildings) {
      const byId = new Map();
      for (const b of sim.buildings) if (b && b.id != null) byId.set(b.id, b);
      for (const s of sim.settlementSystem.settlements.values()) {
        if (!Array.isArray(s.buildings)) continue;
        s.buildings = s.buildings.map(e => (e && e.id != null && byId.has(e.id)) ? byId.get(e.id) : e);
      }
    }

    // Restore warbands. Warband fields are all plain JSON-safe values (numbers,
    // strings, arrays, nested plain objects), so entries round-trip through the
    // save intact; soldier pointers resolve by agent id at use time.
    if (data.warfare && sim.warfareSystem) {
      sim.warfareSystem.warbands = new Map(data.warfare.warbands || []);
      sim.warfareSystem.nextWarbandId = data.warfare.nextWarbandId ?? 1;
      sim.warfareSystem.combatEffects = Array.isArray(data.warfare.combatEffects)
        ? data.warfare.combatEffects.map(e => ({ ...e }))
        : [];
    }

    // Restore the career-change churn counter (see serialize()). Legacy saves
    // without this field simply start fresh — agents keep their jobs.
    if (data.career && Array.isArray(data.career.jobChangeCount)) {
      sim._jobChangeCount = new Map(data.career.jobChangeCount);
    }

    if (data.civilizationAges) {
      sim.civilizationAgeSystem = CivilizationAgeSystem.deserialize(data.civilizationAges, sim);
    }
    if (data.weather) {
      sim.weatherSystem = WeatherSystem.deserialize(data.weather, sim);
    }
    if (data.dynasties && sim.dynastySystem) {
      sim.dynastySystem = DynastySystem.deserialize(data.dynasties, sim);
    }
    if (data.naval && sim.navalSystem) {
      sim.navalSystem = NavalSystem.deserialize(data.naval, sim);
    }
    if (data.espionage && sim.espionageSystem) {
      sim.espionageSystem = EspionageSystem.deserialize(data.espionage, sim);
    }
    if (data.fortifications && sim.fortificationSystem) {
      sim.fortificationSystem = FortificationSystem.deserialize(data.fortifications, sim);
    }
    if (Array.isArray(data.fallenHeroes)) {
      sim.fallenHeroes = data.fallenHeroes.map(h => ({ ...h }));
    }
    if (Array.isArray(data.deadDossiers)) {
      sim._deadDossiers = data.deadDossiers.map(d => ({
        ...d,
        traits: d.traits ? { ...d.traits } : {},
        skills: d.skills ? { ...d.skills } : {},
        lifeHistory: Array.isArray(d.lifeHistory) ? d.lifeHistory.map(e => ({ ...e })) : []
      }));
    }

    if (data.mortalityStats) {
      sim.mortalityStats = {
        totalDeaths: data.mortalityStats.totalDeaths || 0,
        totalAgeAtDeath: data.mortalityStats.totalAgeAtDeath || 0,
        averageAgeAtDeath: data.mortalityStats.averageAgeAtDeath || 0,
        minAgeAtDeath: data.mortalityStats.minAgeAtDeath || 0,
        maxAgeAtDeath: data.mortalityStats.maxAgeAtDeath || 0,
        causes: { ...(data.mortalityStats.causes || {}) }
      };
    }

    return sim;
  }
}
