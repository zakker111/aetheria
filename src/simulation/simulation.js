// Main simulation orchestrator (doc 03: high-level tick order)
import { WorldState } from "../core/worldState.js";
import { RNG } from "../core/rng.js";
import { SimulationClock } from "./clock.js";
import { EventBus } from "../core/eventBus.js";
import { IDGenerator } from "../core/idGen.js";
import { Agent, assignDeterministicSurname, formatAgentFullName } from "./agent.js";
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
import { ReligionSystem, BELIEF_CREEDS } from "../systems/religionSystem.js";
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
import {
  recordDeadDossier,
  buildAgentBiography,
  getBuiltStructuresForAgent,
  buildAgentDossier,
  getAgentDossier,
  getHistoricalPeopleRoster,
} from "./modules/historicalBiography.js";
import {
  applyWarringScenario,
  applyModernNuclearScenario,
} from "./modules/scenarios.js";
import {
  updateEnvironment as runUpdateEnvironment,
  updateSettlements as runUpdateSettlements,
  jobSettlementId,
  updateEconomy as runUpdateEconomy,
  soldierEnlistOffer,
  updateCareerChanges,
  updatePioneers as runUpdatePioneers,
  getSettlementBuildingBonus as computeSettlementBuildingBonus,
  getUpgradeRequirements as computeUpgradeRequirements,
  deductUpgradeCost,
  upgradeBuilding as runUpgradeBuilding,
  commissionSettlementBuilding as runCommissionSettlementBuilding,
} from "./modules/settlementEconomy.js";
import {
  updateEvents as runUpdateEvents,
  updateFactions as runUpdateFactions,
  updateResources as runUpdateResources,
  maintainWorldResources as runMaintainWorldResources,
  updateBuildings as runUpdateBuildings,
  detonateNuclearStrike as runDetonateNuclearStrike,
} from "./modules/nuclearAndEvents.js";
import {
  serializeSimulation,
  deserializeSimulation,
} from "./modules/simulationSerialization.js";

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
    if (agent && !agent.surname) {
      assignDeterministicSurname(agent, this.seed ?? 0);
    }
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

  constructor(seed = Date.now(), width = 160, height = 160, options = {}) {
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
    this.fallenSettlements = [];
    this.spectralSpirits = [];
    this._deadDossiers = [];
    this.mortalityStats = {
      totalDeaths: 0,
      totalAgeAtDeath: 0,
      averageAgeAtDeath: 0,
      minAgeAtDeath: 0,
      maxAgeAtDeath: 0,
      causes: {}
    };
    this.metricsHistory = [];

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
        const sid = data.settlementId ?? this.settlementSystem?.agentSettlementMap?.get(data.agentId) ?? this._agentById(data.agentId)?.settlementId ?? null;
        if (sid != null) {
          const s = this.settlementSystem?.settlements?.get(sid);
          if (s) {
            if (!s.stats) s.stats = { births: 0, deaths: 0, buildingsBuilt: 0, warsFought: 0, battlesWon: 0, peakPopulation: s.population || 0 };
            s.stats.births = (s.stats.births || 0) + 1;
          }
        }
      }
    });
    
    this.eventBus.on("AGENT_DIED", (data) => {
      this.deathsThisSession++;
      const deadSid = data.settlementId ?? this.settlementSystem?.agentSettlementMap?.get(data.agentId) ?? this._agentById(data.agentId)?.settlementId ?? null;
      if (deadSid != null) {
        const s = this.settlementSystem?.settlements?.get(deadSid);
        if (s) {
          if (!s.stats) s.stats = { births: 0, deaths: 0, buildingsBuilt: 0, warsFought: 0, battlesWon: 0, peakPopulation: s.population || 0 };
          s.stats.deaths = (s.stats.deaths || 0) + 1;
        }
      }
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
          const deathAge = Math.floor(fallenAgent.age || data.age || 0);
          const cause = data.cause || 'natural';
          this.fallenHeroes.push({
            id: fallenAgent.id,
            name: fallenAgent.name,
            surname: fallenAgent.surname || null,
            fullName: formatAgentFullName(fallenAgent),
            epithet: fallenAgent.epithet || (fallenAgent.isMonarch ? 'Sovereign' : null),
            legendaryWeapon: fallenAgent.legendaryWeapon || null,
            heirloom: fallenAgent.heirloom ? { ...fallenAgent.heirloom } : null,
            buildingsBuilt: fallenAgent.buildingsBuilt || 0,
            generation: fallenAgent.generation ?? 1,
            kills: fallenAgent.kills || 0,
            battlesFought: fallenAgent.battlesFought || 0,
            settlementName: sName,
            isMonarch: !!fallenAgent.isMonarch,
            age: deathAge,
            deathTick: this.clock?.tick ?? 0,
            cause,
            deathDetail: fallenAgent.deathDetail || null,
            biography: this.buildAgentBiography(fallenAgent, { alive: false, deathCause: cause, deathDetail: fallenAgent.deathDetail || null, age: deathAge, settlementName: sName }),
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

    // Record major treaties, alliances, and war declarations in reigning monarchs' life histories
    this.eventBus.on("DIPLOMATIC_EVENT", (data) => {
      if (!data || !this.dynastySystem) return;
      const tick = this.clock?.tick ?? 0;
      const title = data.title || "Diplomatic Accord";
      const sids = [data.settlementA_id, data.settlementB_id].filter((id) => id != null);
      for (const sid of sids) {
        const dyn = this.dynastySystem.getSettlementDynasty?.(sid);
        let monarch = dyn?.monarchId != null ? this._agentById(dyn.monarchId) : null;
        if (!monarch || !monarch.alive) {
          monarch = this.agents.find(a => a && a.alive && a.settlementId === sid && a.isMonarch) || null;
        }
        if (monarch && monarch.alive && typeof monarch.addLifeEvent === "function") {
          const otherName = sid === data.settlementA_id ? (data.settlementB || "a rival realm") : (data.settlementA || "a rival realm");
          const isWar = /war/i.test(title);
          const isPeace = /peace|treaty/i.test(title);
          const isAlliance = /alliance/i.test(title);
          const icon = isWar ? "⚔️" : isPeace ? "🕊️" : isAlliance ? "🤝" : "📜";
          const verb = isWar
            ? `Entered war with ${otherName}`
            : isPeace
              ? `Signed ${title} with ${otherName}`
              : isAlliance
                ? `Forged alliance with ${otherName}`
                : `${title} with ${otherName}`;
          monarch.addLifeEvent("TREATY", verb, tick, icon, true);
        }
      }
    });
  }

  initializeWorld() {
    this.world.simulation = this;
    this.world.eventBus = this.eventBus;
    if (this.settlementSystem?.setWorld) this.settlementSystem.setWorld(this.world);

    // Populate wildlife BEFORE agents so the agent spawn stream is unchanged.
    this.animalSystem.initialPopulate();
    
    // Cluster starting agents into habitable walkable centers across the map
    const margin = 14;
    const minCenterDist = this.world.width >= 160 ? 30 : 24;
    const centers = [];
    
    for (let attempt = 0; attempt < 250 && centers.length < 3; attempt++) {
      const cx = margin + this._rng().next() * (this.world.width - margin * 2);
      const cy = margin + this._rng().next() * (this.world.height - margin * 2);
      const tx = Math.floor(cx);
      const ty = Math.floor(cy);
      if (this.world.isWalkable(tx, ty)) {
        const terrain = this.world.getTerrain(tx, ty);
        if (terrain && terrain.type !== "water" && terrain.type !== "snow") {
          const farEnough = centers.every(c => Math.hypot(c.x - cx, c.y - cy) > minCenterDist);
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

    // Initialize state creeds and procedural beliefs BEFORE founding diplomatic relations
    if (this.religionSystem) {
      this.religionSystem.initWorldBeliefs();
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
    
    // Distribute abundant biome-specific resources scaled to map area
    const areaScale = (this.world.width * this.world.height) / (128 * 128);
    // 1. Wood (Forests & Jungles)
    const woodTarget = Math.max(80, Math.round(220 * areaScale));
    let woodSpawned = 0;
    attempts = 0;
    while (woodSpawned < woodTarget && attempts < Math.round(2500 * Math.max(1, areaScale))) {
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

    // 2. Food (Grasslands, Savannas, Plains & Riverbanks)
    const foodTarget = Math.max(60, Math.round(180 * areaScale));
    let foodSpawned = 0;
    attempts = 0;
    while (foodSpawned < foodTarget && attempts < Math.round(2000 * Math.max(1, areaScale))) {
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

    // 3. Ore (Mountains, Highlands & Caverns)
    const oreTarget = Math.max(50, Math.round(160 * areaScale));
    let oreSpawned = 0;
    attempts = 0;
    while (oreSpawned < oreTarget && attempts < Math.round(2000 * Math.max(1, areaScale))) {
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

    // 4. Freshwater sources across world
    const waterTarget = Math.max(25, Math.round(60 * areaScale));
    for (let i = 0; i < waterTarget; i++) {
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

    // 5. Era-locked Massive Mountain Deposits (Iron Mountain unlocked at Era 2+, Uranium Mountain at Era 6+)
    const spawnMountainTier = (kind, targetCount) => {
      let placed = 0;
      let tries = 0;
      while (placed < targetCount && tries < 1400) {
        tries++;
        const x = Math.floor(this._rng().next() * (this.world.width - 6)) + 3;
        const y = Math.floor(this._rng().next() * (this.world.height - 6)) + 3;
        const terrain = this.world.getTerrain(x, y);
        const isHighland = terrain && (
          terrain.biome === "mountain" ||
          terrain.biome === "highland" ||
          terrain.biome === "tundra" ||
          terrain.type === "mountain"
        );
        if (isHighland && this.world.isWalkable(x, y)) {
          const entities = this.world.getEntitiesAt(x, y);
          if (!entities.some(e => e.type === "resource" || e.type === "building")) {
            this.createMountainDeposit(x, y, kind, { emitEvent: false });
            placed++;
          }
        }
      }
    };
    spawnMountainTier("iron_mountain", Math.max(5, Math.round(5 * areaScale)));
    spawnMountainTier("uranium_mountain", Math.max(3, Math.round(3 * areaScale)));

    this.recordMetricsSnapshot();
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

    // Sync spatial index for agents moved by post-decision systems (warfare,
    // formations, aging, naval) so wildlife scans and save/load stay parity-exact.
    this.world.updateMovedAgents(this.agents);

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

    if (this.clock.tick === 1 || this.clock.tick % 20 === 0) {
      this.recordMetricsSnapshot();
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
    return runUpdateEnvironment(this);
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
    return runUpdateSettlements(this);
  }

  _jobSettlementId(agent) {
    return jobSettlementId(agent);
  }

  updateEconomy() {
    return runUpdateEconomy(this);
  }

  _soldierEnlistOffer(agent, homeSid) {
    return soldierEnlistOffer(this, agent, homeSid);
  }

  _updateCareerChanges() {
    return updateCareerChanges(this);
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
    return runUpdateEvents(this);
  }

  updateFactions() {
    return runUpdateFactions(this);
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
      const realList = this._incompleteRealBuildingsBuffer || (this._incompleteRealBuildingsBuffer = []);
      realList.length = 0;
      for (const b of this.buildings) {
        if (!b.complete && (b.constructionProgress || 0) < 100) {
          list.push(b);
          realList.push(b);
        }
      }
      if (this.constructionSystem && this.constructionSystem.pendingBuildings) {
        for (const b of this.constructionSystem.pendingBuildings) {
          if (!b.isComplete && (b.constructionProgress || 0) < 100) list.push(b);
        }
      }
      this.incompleteBuildings = list;
      this._incompleteRealBuildings = realList;
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

    // Pre-filter active non-empty ground items once per tick so Pass 2 skips
    // repeating destroyed/total() checks across hundreds of T0/T1 agents.
    const activeGroundItems = this._activeGroundItemsBuffer || (this._activeGroundItemsBuffer = []);
    activeGroundItems.length = 0;
    if (this.groundItems.length > 0) {
      for (let i = 0; i < this.groundItems.length; i++) {
        const it = this.groundItems[i];
        if (!it.destroyed && it.total() > 0) activeGroundItems.push(it);
      }
    }

    // Pass 2: prepare perception state for all active detailed agents
    const hasGroundItems = activeGroundItems.length > 0;
    for (let i = 0; i < activeAgentsThisTick.length; i++) {
      const agent = activeAgentsThisTick[i];
      if (!agent.alive) continue;

      const perception = agent._ensurePerception();
      agent.invalidatePerception();

      // Ground loot direct scan
      if (hasGroundItems) {
        const ax = agent.x, ay = agent.y;
        const nearbyItems = perception.nearbyItems;
        for (let j = 0; j < activeGroundItems.length; j++) {
          const it = activeGroundItems[j];
          const dx = it.x - ax, dy = it.y - ay;
          if (dx * dx + dy * dy <= 484 && nearbyItems.length < 4) {
            nearbyItems.push(it);
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
        
        // Inherit some traits, surname & family generation from parents
        const parent1 = this._agentById(birth.parentId1);
        const parent2 = this._agentById(birth.parentId2);
        if (parent1 && parent2) {
          baby.personality.industrious = (parent1.personality.industrious + parent2.personality.industrious) / 2;
          baby.personality.social = (parent1.personality.social + parent2.personality.social) / 2;
          baby.personality.brave = (parent1.personality.brave + parent2.personality.brave) / 2;
          baby.skills.gather = (parent1.skills.gather + parent2.skills.gather) / 2;
          baby.settlementId = parent1.settlementId || parent2.settlementId;
        }
        if (parent1 || parent2) {
          baby.surname = parent1?.surname || parent2?.surname || assignDeterministicSurname(baby, this.seed ?? 0);
          baby.generation = Math.max(parent1?.generation || 1, parent2?.generation || 1) + 1;
        } else {
          assignDeterministicSurname(baby, this.seed ?? 0);
        }
        this.addAgent(baby);
        this.world.addToSpatialIndex(Math.floor(birth.x), Math.floor(birth.y), baby);
        this.eventBus.emit("AGENT_CREATED", { agentId: baby.id, name: baby.name, x: baby.x, y: baby.y, settlementId: baby.settlementId ?? null, reason: "birth" });
        // Synchronously link parent-child & family union records (zero RNG)
        this.relationshipSystem.initializeAgent(baby.id);
        if (parent1) this.relationshipSystem.addParentChild(parent1.id, baby.id);
        if (parent2) this.relationshipSystem.addParentChild(parent2.id, baby.id);
        if (parent1 && parent2 && parent1 !== parent2) {
          const relSys = this.relationshipSystem;
          const coupleKey = relSys.getCoupleKey(parent1.id, parent2.id);
          if (!relSys.marriages.has(coupleKey)) {
            relSys.marriages.set(coupleKey, {
              partners: [parent1.id, parent2.id],
              marriedAt: currentTick,
              children: [],
              status: 'married',
            });
            const f1 = relSys.familyTrees.get(parent1.id);
            const f2 = relSys.familyTrees.get(parent2.id);
            if (f1 && f1.spouse == null) f1.spouse = parent2.id;
            if (f2 && f2.spouse == null) f2.spouse = parent1.id;
            if (typeof parent1.addLifeEvent === 'function') {
              parent1.addLifeEvent('MARRIAGE', `United in family bond with ${formatAgentFullName(parent2)}`, currentTick, '💍', true);
            }
            if (typeof parent2.addLifeEvent === 'function') {
              parent2.addLifeEvent('MARRIAGE', `United in family bond with ${formatAgentFullName(parent1)}`, currentTick, '💍', true);
            }
          }
          relSys.addChildToMarriage(parent1.id, parent2.id, baby.id);
        }
        if (this.dynastySystem) {
          this.dynastySystem.onAgentBorn(baby, parent1, parent2);
        }
        if (typeof baby.addLifeEvent === 'function') {
          const pText = parent1 ? ` to ${formatAgentFullName(parent1)}${parent2 && parent2 !== parent1 ? ` & ${formatAgentFullName(parent2)}` : ''}` : '';
          baby.addLifeEvent('BIRTH', `Born into House ${baby.surname}${pText}`, currentTick, '👶', true);
        }
        if (parent1 && typeof parent1.addLifeEvent === 'function') {
          parent1.addLifeEvent('CHILD', `Welcomed newborn ${formatAgentFullName(baby)}`, currentTick, '👶', true);
        }
        if (parent2 && parent2 !== parent1 && typeof parent2.addLifeEvent === 'function') {
          parent2.addLifeEvent('CHILD', `Welcomed newborn ${formatAgentFullName(baby)}`, currentTick, '👶', true);
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
        if (dead._departedRaider) {
          this.economySystem?.agentJobs?.delete(dead.id);
          this.world.removeFromSpatialIndex(Math.floor(dead.x), Math.floor(dead.y), dead);
          this.world.entityRegistry?.delete(dead.id);
          if (dead._sx !== undefined) {
            this.world.removeFromSpatialIndex(dead._sx, dead._sy, dead);
          }
          continue;
        }
        const deathCause = dead.deathCause || "natural";
        if (!dead._heirloomBequeathed && this.ageSystem?._bequeathHeirloomOnDeath) {
          this.ageSystem._bequeathHeirloomOnDeath(dead);
        }
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
          settlementId: dead.settlementId ?? null,
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
  // Deterministic: no RNG draws; odd units round down (floor halves unless forceWarSpoils).
  dropInventoryOnGround(entity, options = {}) {
    if (!entity || !entity.inventory) return null;
    const forceWarSpoils = Boolean(options && options.forceWarSpoils);
    const contents = {};
    let hasLoot = false;
    for (const key of Object.keys(entity.inventory)) {
      if (key === "capacity") continue;
      const val = entity.inventory[key] || 0;
      if (val <= 0) continue;
      const isGear = key.startsWith("weapon_") || key.startsWith("armor_") || key.startsWith("tool_");
      const dropCount = (isGear || forceWarSpoils) ? Math.max(1, Math.floor(val / 2)) : Math.floor(val / 2);
      if (dropCount > 0) {
        contents[key] = dropCount;
        hasLoot = true;
      }
    }
    if (!hasLoot && forceWarSpoils && entity.militaryDuty) {
      contents.bread = 1;
      if (entity.hasWeapon || entity.hasShield) contents.ore_iron = 1;
      hasLoot = true;
    }
    if (!hasLoot) return null;
    const item = new GroundItem(entity.x, entity.y, contents, 600, this.idGen.next());
    this.groundItems.push(item);
    this.eventBus.emit("GROUND_ITEM_DROPPED", {
      itemId: item.id,
      x: item.x,
      y: item.y,
      fromId: entity.id,
      total: item.total()
    });
    return item;
  }

  updateResources() {
    return runUpdateResources(this);
  }

  maintainWorldResources() {
    return runMaintainWorldResources(this);
  }

  updateBuildings() {
    return runUpdateBuildings(this);
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
      if (!agent._heirloomBequeathed && this.ageSystem?._bequeathHeirloomOnDeath) {
        this.ageSystem._bequeathHeirloomOnDeath(agent);
      }
      if (typeof agent.addLifeEvent === 'function' && (!agent.lifeHistory || !agent.lifeHistory.some(e => e.kind === 'DEATH'))) {
        agent.addLifeEvent('DEATH', `Died of ${finalCause} at age ${Math.floor(agent.age || 0)}`, this.clock?.tick ?? 0, '🕯️', true);
      }
      this._recordDeadDossier(agent, finalCause);
      if (Array.isArray(this.buildings) && this.buildings.length > 0) {
        let cemetery = null;
        let bestD = Infinity;
        for (const b of this.buildings) {
          if (!b || b.isRuined || !(b.complete || b.isComplete) || b.buildingType !== "cemetery") continue;
          const sameTown = agent.settlementId != null && b.settlementId === agent.settlementId;
          const d = Math.hypot(b.x - agent.x, b.y - agent.y);
          if (!sameTown && d > 28) continue;
          const rankD = sameTown ? d : d + 50;
          if (rankD < bestD) { bestD = rankD; cemetery = b; }
        }
        if (cemetery) {
          if (!Array.isArray(cemetery.interredAgentIds)) cemetery.interredAgentIds = [];
          if (!cemetery.interredAgentIds.includes(agent.id)) {
            cemetery.interredAgentIds.push(agent.id);
            if (cemetery.interredAgentIds.length > 64) cemetery.interredAgentIds.shift();
          }
        }
      }
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
        settlementId: agent.settlementId ?? null,
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

  createMountainDeposit(x, y, kind = "iron_mountain", { emitEvent = true } = {}) {
    const isUranium = kind === "uranium_mountain" || kind === "uranium";
    const res = new Resource(
      x,
      y,
      isUranium ? "uranium" : "ore",
      isUranium ? 280 : 420,
      this.idGen,
      {
        depositTier: isUranium ? "uranium_mountain" : "iron_mountain",
        requiredEraId: isUranium ? 6 : 2,
        exhaustionsRemaining: 0
      }
    );
    this.resources.push(res);
    this.world.addToSpatialIndex(Math.floor(x), Math.floor(y), res);
    if (emitEvent) {
      this.eventBus.emit("GOD_POWER_USED", { power: isUranium ? "create_uranium_mountain" : "create_iron_mountain", x, y });
    }
    return res;
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
      this.world.entityRegistry?.delete(resource.id);
      this.eventBus.emit("GOD_POWER_USED", { power: "remove_resource", x, y });
      return true;
    }
    return false;
  }

  spawnAgent(x, y) {
    const w = this.world?.width || 160;
    const h = this.world?.height || 160;
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
    const w = this.world?.width || 160;
    const h = this.world?.height || 160;
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

  updatePioneers() {
    return runUpdatePioneers(this);
  }

  getSettlementBuildingBonus(settlementId, buildingType) {
    return computeSettlementBuildingBonus(this, settlementId, buildingType);
  }

  getUpgradeRequirements(building) {
    return computeUpgradeRequirements(this, building);
  }

  _deductUpgradeCost(stockpile, primaryKey, fallbackKey, amount) {
    return deductUpgradeCost(stockpile, primaryKey, fallbackKey, amount);
  }

  upgradeBuilding(buildingId, options = {}) {
    return runUpgradeBuilding(this, buildingId, options);
  }

  commissionSettlementBuilding(settlementId, buildingType, options = {}) {
    return runCommissionSettlementBuilding(this, settlementId, buildingType, options);
  }

  detonateNuclearStrike(options = {}) {
    return runDetonateNuclearStrike(this, options);
  }

  renameSettlement(settlementId, newName) {
    const clean = String(newName ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) return { ok: false, reason: "Name cannot be empty" };
    const s = this.settlementSystem?.settlements?.get(Number(settlementId));
    if (!s) return { ok: false, reason: "Settlement not found" };
    const oldName = s.name;
    if (oldName === clean) return { ok: true, name: clean, settlement: s };
    s.name = clean;

    if (this.dynastySystem?.dynasties) {
      for (const dyn of this.dynastySystem.dynasties.values()) {
        if (dyn && dyn.settlementId === s.id) {
          dyn.settlementName = clean;
        }
      }
    }
    if (this.diplomacySystem) {
      for (const w of [...(this.diplomacySystem.activeWars || []), ...(this.diplomacySystem.warHistory || [])]) {
        if (!w) continue;
        if (w.attackerId === s.id) w.attackerName = clean;
        if (w.defenderId === s.id) w.defenderName = clean;
      }
      if (Array.isArray(this.diplomacySystem.diplomaticHistory)) {
        for (const ev of this.diplomacySystem.diplomaticHistory) {
          if (!ev || !Array.isArray(ev.actors) || !Array.isArray(ev.actorNames)) continue;
          ev.actors.forEach((aid, idx) => {
            if (aid === s.id) ev.actorNames[idx] = clean;
          });
        }
      }
    }
    if (this.warfareSystem?.warbands) {
      for (const wb of this.warfareSystem.warbands.values()) {
        if (!wb) continue;
        if (wb.settlementId === s.id) wb.settlementName = clean;
        if (wb.targetSettlementId === s.id) wb.targetSettlementName = clean;
      }
    }
    for (const fs of (this.fallenSettlements || [])) {
      if (!fs) continue;
      if (fs.id === s.id) fs.name = clean;
      if (fs.absorbedByName === oldName) fs.absorbedByName = clean;
      if (fs.conqueredByName === oldName) fs.conqueredByName = clean;
    }
    for (const fh of (this.fallenHeroes || [])) {
      if (fh && fh.settlementName === oldName) fh.settlementName = clean;
    }
    for (const d of (this._deadDossiers || [])) {
      if (d && (d.settlementId === s.id || d.settlementName === oldName)) {
        d.settlementName = clean;
        d.biography = this.buildAgentBiography(d, { settlementName: clean });
      }
    }
    return { ok: true, name: clean, oldName, settlement: s };
  }

  renameAgent(agentId, newName) {
    const clean = String(newName ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) return { ok: false, reason: "Name cannot be empty" };
    const id = Number(agentId);
    const live = this._agentById(id);
    const dossier = (this._deadDossiers || []).find((d) => d && d.id === id) || null;
    const hero = (this.fallenHeroes || []).find((h) => h && h.id === id) || null;
    if (!live && !dossier && !hero) {
      return { ok: false, reason: "Citizen not found" };
    }

    const applyNameSplit = (target, prevFull) => {
      const oldFirst = target.name;
      const oldSurname = target.surname || null;
      let nextFirst = clean;
      let nextSurname = oldSurname;
      if (oldSurname && clean.toLowerCase().endsWith(` ${oldSurname.toLowerCase()}`)) {
        nextFirst = clean.slice(0, clean.length - oldSurname.length).trim() || clean;
      } else if (clean.includes(" ")) {
        const parts = clean.split(" ");
        nextFirst = parts[0];
        nextSurname = parts.slice(1).join(" ");
      }
      target.name = nextFirst;
      if (nextSurname !== null) target.surname = nextSurname;
      return { oldFirst, prevFull };
    };

    let updatedFirst = clean;
    let updatedFull = clean;
    let oldFirst = null;
    let oldFull = null;

    if (live) {
      oldFull = formatAgentFullName(live);
      oldFirst = live.name;
      applyNameSplit(live, oldFull);
      updatedFirst = live.name;
      updatedFull = formatAgentFullName(live);
      if (live.settlementId != null) {
        const home = this.settlementSystem?.settlements?.get(live.settlementId);
        if (home && home.leadership === oldFirst) {
          home.leadership = updatedFirst;
        }
      }
    }

    if (dossier) {
      oldFull = oldFull || dossier.fullName || dossier.name;
      oldFirst = oldFirst || dossier.name;
      applyNameSplit(dossier, oldFull);
      dossier.fullName = formatAgentFullName(dossier);
      updatedFirst = dossier.name;
      updatedFull = dossier.fullName;
      dossier.biography = this.buildAgentBiography(dossier, { fullName: updatedFull });
    }

    if (hero) {
      oldFull = oldFull || hero.fullName || hero.name;
      oldFirst = oldFirst || hero.name;
      applyNameSplit(hero, oldFull);
      hero.fullName = formatAgentFullName(hero);
      updatedFirst = hero.name;
      updatedFull = hero.fullName;
      hero.biography = this.buildAgentBiography(hero, { alive: false, fullName: updatedFull, deathCause: hero.cause });
    }

    if (this.dynastySystem?.dynasties) {
      for (const dyn of this.dynastySystem.dynasties.values()) {
        if (!dyn) continue;
        if (dyn.monarchId === id) dyn.monarchName = updatedFirst;
        if (dyn.heirId === id) dyn.heirName = updatedFirst;
        if (dyn.consortId === id) dyn.consortName = updatedFirst;
        if (dyn.pretenderId === id) dyn.pretenderName = updatedFirst;
        if (dyn.civilWar && dyn.civilWar.claimantId === id) dyn.civilWar.claimantName = updatedFirst;
        if (Array.isArray(dyn.lineage)) {
          for (const node of dyn.lineage) {
            if (node && node.id === id) node.name = updatedFirst;
          }
        }
      }
    }

    if (Array.isArray(this.buildings)) {
      for (const b of this.buildings) {
        if (!b) continue;
        if (b.builtByAgentId === id) b.builtByName = updatedFull;
        if (b.upgradedByAgentId === id) b.upgradedByName = updatedFull;
        if (Array.isArray(b.contributors)) {
          for (const c of b.contributors) {
            if (c && c.id === id) c.name = updatedFull;
          }
        }
        if (Array.isArray(b.upgradeHistory)) {
          for (const u of b.upgradeHistory) {
            if (u && u.byAgentId === id) u.byName = updatedFull;
          }
        }
      }
    }

    if (Array.isArray(this.spectralSpirits)) {
      for (const sp of this.spectralSpirits) {
        if (sp && sp.agentId === id) sp.name = updatedFull;
      }
    }

    return { ok: true, id, name: updatedFirst, fullName: updatedFull };
  }

  _recordDeadDossier(agent, cause = "natural") {
    return recordDeadDossier(this, agent, cause);
  }

  buildAgentBiography(agentOrDossier, overrides = {}) {
    return buildAgentBiography(this, agentOrDossier, overrides);
  }

  _getBuiltStructuresForAgent(agentId) {
    return getBuiltStructuresForAgent(this, agentId);
  }

  buildAgentDossier(agent, overrides = {}) {
    return buildAgentDossier(this, agent, overrides);
  }

  getAgentDossier(agentOrId) {
    return getAgentDossier(this, agentOrId);
  }

  getHistoricalPeopleRoster() {
    return getHistoricalPeopleRoster(this);
  }

  applyWarringScenario() {
    return applyWarringScenario(this);
  }

  applyModernNuclearScenario() {
    return applyModernNuclearScenario(this);
  }

  recordMetricsSnapshot() {
    const tick = this.clock?.tick ?? 0;
    if (!Array.isArray(this.metricsHistory)) this.metricsHistory = [];
    const prev = this.metricsHistory[this.metricsHistory.length - 1];
    if (prev && prev.tick === tick) return prev;

    let activeSettlements = 0;
    let food = 0;
    let wood = 0;
    let ore = 0;
    if (this.settlementSystem?.settlements) {
      for (const s of this.settlementSystem.settlements.values()) {
        if (!s || s.ruined) continue;
        activeSettlements++;
        const st = s.stockpile || {};
        food += Math.round((st.food || 0) + (st.bread || 0));
        wood += Math.round((st.wood || 0) + (st.plank || 0));
        ore += Math.round((st.ore || 0) + (st.iron_ingot || 0));
      }
    }

    let completedBuildings = 0;
    let blueprints = 0;
    if (Array.isArray(this.buildings)) {
      for (const b of this.buildings) {
        if (!b || b.isRuined) continue;
        if (b.complete) completedBuildings++;
        else blueprints++;
      }
    }

    let soldiers = 0;
    let faithSum = 0;
    let living = 0;
    if (Array.isArray(this.agents)) {
      for (const a of this.agents) {
        if (!a || !a.alive) continue;
        living++;
        if (a.job === "soldier" || a.militaryDuty) soldiers++;
        faithSum += (a.religion?.faith ?? 50);
      }
    }

    const snap = {
      tick,
      year: this.clock?.getYear ? this.clock.getYear() : Math.floor(tick / 400) + 1,
      population: living,
      births: this.birthsThisSession || 0,
      deaths: this.deathsThisSession || 0,
      settlements: activeSettlements,
      food,
      wood,
      ore,
      buildings: completedBuildings,
      blueprints,
      soldiers,
      activeWars: this.diplomacySystem?.activeWars ? this.diplomacySystem.activeWars.length : 0,
      warbands: this.warfareSystem?.warbands ? this.warfareSystem.warbands.size : 0,
      avgFaith: living > 0 ? Math.round((faithSum / living) * 10) / 10 : 0,
    };

    this.metricsHistory.push(snap);
    if (this.metricsHistory.length > 120) {
      this.metricsHistory.shift();
    }
    return snap;
  }

  getStatisticsSnapshot(settlementFilterId = null) {
    const filterSid = settlementFilterId != null ? Number(settlementFilterId) : null;
    const livingAgents = [];
    for (const a of (this.agents || [])) {
      if (!a || !a.alive) continue;
      if (filterSid != null && (a.settlementId ?? null) !== filterSid) continue;
      livingAgents.push(a);
    }

    let ageSum = 0;
    let faithSum = 0;
    let children = 0;
    let youngAdults = 0;
    let matureAdults = 0;
    let elders = 0;

    const jobCounts = new Map();
    const creedCounts = new Map();
    const creedFaithSums = new Map();

    for (const a of livingAgents) {
      const age = a.age || 0;
      ageSum += age;
      const faith = a.religion?.faith ?? 50;
      faithSum += faith;

      if (age < 18 || a.lifeStage === "child") children++;
      else if (age < 40) youngAdults++;
      else if (age < 58 && a.lifeStage !== "elder") matureAdults++;
      else elders++;

      const jobKey = a.lifeStage === "child" ? "child" : (a.job || "unemployed");
      jobCounts.set(jobKey, (jobCounts.get(jobKey) || 0) + 1);

      const creedKey = a.religion?.beliefId || "unaffiliated";
      creedCounts.set(creedKey, (creedCounts.get(creedKey) || 0) + 1);
      creedFaithSums.set(creedKey, (creedFaithSums.get(creedKey) || 0) + faith);
    }

    const totalLiving = livingAgents.length;
    const avgLivingAge = totalLiving > 0 ? ageSum / totalLiving : 0;
    const avgFaith = totalLiving > 0 ? faithSum / totalLiving : 0;

    const JOB_PALETTE = {
      farmer: { label: "Farmers", color: "#22c55e" },
      lumberjack: { label: "Lumberjacks", color: "#84cc16" },
      miner: { label: "Miners", color: "#f59e0b" },
      builder: { label: "Builders", color: "#fb923c" },
      craftsman: { label: "Craftsmen", color: "#38bdf8" },
      hunter: { label: "Hunters", color: "#a855f7" },
      gatherer: { label: "Gatherers", color: "#14b8a6" },
      soldier: { label: "Soldiers", color: "#ef4444" },
      priest: { label: "Priests", color: "#eab308" },
      child: { label: "Youth & Apprentices", color: "#60a5fa" },
      unemployed: { label: "Idle / Settling", color: "#64748b" },
    };

    const professions = Array.from(jobCounts.entries())
      .map(([key, count]) => ({
        key,
        label: JOB_PALETTE[key]?.label || key.replace(/_/g, " "),
        count,
        color: JOB_PALETTE[key]?.color || "#94a3b8",
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

    const religions = Array.from(creedCounts.entries())
      .map(([id, count]) => {
        const meta = this.religionSystem?.getCreed?.(id) || BELIEF_CREEDS[id];
        return {
          id,
          name: meta?.name || (id === "unaffiliated" ? "Unaffiliated" : id.replace(/_/g, " ")),
          icon: meta?.icon || "✨",
          tenet: meta?.tenet || "Folk Customs",
          count,
          avgFaith: count > 0 ? (creedFaithSums.get(id) || 0) / count : 0,
          color: meta?.color || "#64748b",
        };
      })
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

    const CAUSE_PALETTE = {
      combat: { label: "Combat & War", color: "#ef4444" },
      war: { label: "Battlefield Slain", color: "#dc2626" },
      starvation: { label: "Starvation", color: "#f59e0b" },
      dehydration: { label: "Dehydration", color: "#06b6d4" },
      old_age: { label: "Old Age", color: "#10b981" },
      natural: { label: "Natural Causes", color: "#34d399" },
      disease: { label: "Disease & Fever", color: "#84cc16" },
      plague: { label: "Plague Outbreak", color: "#65a30d" },
      illness: { label: "Sickness", color: "#a3e635" },
      accident: { label: "Work & Civic Accidents", color: "#fb923c" },
      misadventure: { label: "Misadventure", color: "#ec4899" },
      flood: { label: "Flooding", color: "#0ea5e9" },
      radiation: { label: "Radiation Fallout", color: "#bef264" },
      atomic: { label: "Atomic Blast", color: "#e11d48" },
      nuclear_blast: { label: "Nuclear Blast", color: "#e11d48" },
      nuke: { label: "Nuclear Strike", color: "#be123c" },
      fire: { label: "Fire & Blaze", color: "#f97316" },
      mauled: { label: "Wild Predators", color: "#a855f7" },
      "divine wrath": { label: "Divine Wrath", color: "#facc15" },
    };

    const rawCauses = this.mortalityStats?.causes || {};
    const causesOfDeath = Object.entries(rawCauses)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({
        key,
        label: CAUSE_PALETTE[key]?.label || key.replace(/_/g, " "),
        count,
        color: CAUSE_PALETTE[key]?.color || "#94a3b8",
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

    const ageBrackets = [
      { key: "children", label: "Children (0–17y)", count: children, color: "#60a5fa" },
      { key: "young", label: "Young Adults (18–39y)", count: youngAdults, color: "#34d399" },
      { key: "mature", label: "Mature (40–57y)", count: matureAdults, color: "#fbbf24" },
      { key: "elders", label: "Elders (58+y)", count: elders, color: "#c084fc" },
    ].filter((b) => b.count > 0);

    const settlements = [];
    if (this.settlementSystem?.settlements) {
      const soldierMap = new Map();
      for (const a of (this.agents || [])) {
        if (a && a.alive && a.settlementId != null && (a.job === "soldier" || a.militaryDuty)) {
          soldierMap.set(a.settlementId, (soldierMap.get(a.settlementId) || 0) + 1);
        }
      }
      const bldgMap = new Map();
      for (const b of (this.buildings || [])) {
        if (b && !b.isRuined && b.complete && b.settlementId != null) {
          bldgMap.set(b.settlementId, (bldgMap.get(b.settlementId) || 0) + 1);
        }
      }
      const activeWars = this.diplomacySystem?.activeWars || [];
      for (const s of this.settlementSystem.settlements.values()) {
        if (!s || s.ruined) continue;
        const pop = s.population || s.agentIds?.size || 0;
        const ageInfo = this.civilizationAgeSystem?.getSettlementAge?.(s.id);
        const fortInfo = this.fortificationSystem?.getSettlementFortificationSummary?.(s.id);
        const creedId = this.religionSystem?.getDominantFaith?.(s) || s.culture?.beliefId || "solar_creed";
        const creedMeta = this.religionSystem?.getCreed?.(creedId) || BELIEF_CREEDS[creedId];
        const warCount = activeWars.filter((w) => w.attackerId === s.id || w.defenderId === s.id).length;
        const st = s.stockpile || {};
        settlements.push({
          id: s.id,
          name: s.name,
          tier: s.tier || "Village",
          tierIcon: s.tierIcon || "🏡",
          eraName: ageInfo?.ageName || ageInfo?.name || "Tribal",
          eraIcon: ageInfo?.icon || "🪨",
          population: pop,
          food: Math.round((st.food || 0) + (st.bread || 0)),
          wood: Math.round((st.wood || 0) + (st.plank || 0)),
          ore: Math.round((st.ore || 0) + (st.iron_ingot || 0)),
          buildingsCount: bldgMap.get(s.id) || 0,
          soldiersCount: soldierMap.get(s.id) || 0,
          defenseMultiplier: fortInfo?.defenseMultiplier || 1,
          creedId,
          creedName: creedMeta?.name || "Folk",
          creedIcon: creedMeta?.icon || "✨",
          activeWars: warCount,
          x: s.center?.x ?? 0,
          y: s.center?.y ?? 0,
        });
      }
      settlements.sort((a, b) => b.population - a.population || a.id - b.id);
    }

    return {
      demographics: {
        totalLiving,
        children,
        youngAdults,
        matureAdults,
        elders,
        averageLivingAge: Math.round(avgLivingAge * 10) / 10,
        avgFaith: Math.round(avgFaith * 10) / 10,
        births: this.birthsThisSession || 0,
        deaths: this.deathsThisSession || 0,
        totalDeaths: this.mortalityStats?.totalDeaths || 0,
        averageDeathAge: Math.round((this.mortalityStats?.averageAgeAtDeath || 0) * 10) / 10,
        minDeathAge: Math.round(this.mortalityStats?.minAgeAtDeath || 0),
        maxDeathAge: Math.round(this.mortalityStats?.maxAgeAtDeath || 0),
      },
      causesOfDeath,
      ageBrackets,
      religions,
      professions,
      settlements,
      history: Array.isArray(this.metricsHistory) ? this.metricsHistory : [],
    };
  }

  serialize() {
    return serializeSimulation(this);
  }

  static deserialize(data) {
    return deserializeSimulation(Simulation, data);
  }
}
