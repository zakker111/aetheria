import { SimulationClock } from "../clock.js";
import { Agent } from "../agent.js";
import { Resource } from "../resource.js";
import { Building } from "../building.js";
import { GroundItem } from "../groundItem.js";
import { RelationshipSystem } from "../../systems/relationshipSystem.js";
import { SettlementSystem } from "../../systems/settlementSystem.js";
import { EconomySystem } from "../../systems/economySystem.js";
import { EventSystem } from "../../systems/eventSystem.js";
import { FactionSystem } from "../../systems/factionSystem.js";
import { CraftingSystem } from "../../systems/craftingSystem.js";
import { TradeSystem } from "../../systems/tradeSystem.js";
import { AgeSystem } from "../../systems/ageSystem.js";
import { FormationSystem } from "../../systems/formationSystem.js";
import { InfrastructureSystem } from "../../systems/infrastructureSystem.js";
import { AnimalSystem } from "../../systems/animalSystem.js";
import { ChronicleSystem } from "../../systems/chronicleSystem.js";
import { CivilizationAgeSystem } from "../../systems/civilizationAgeSystem.js";
import { WeatherSystem } from "../../systems/weatherSystem.js";
import { DynastySystem } from "../../systems/dynastySystem.js";
import { NavalSystem } from "../../systems/navalSystem.js";
import { EspionageSystem } from "../../systems/espionageSystem.js";
import { FortificationSystem } from "../../systems/fortificationSystem.js";

export function serializeSimulation(sim) {
  return {
    seed: sim.seed ?? sim.world.seed,
    scenario: sim._scenario || "warring",
    worldSeed: sim.world.seed,
    maxAgents: sim.maxAgents ?? 360,
    birthsThisSession: sim.birthsThisSession || 0,
    deathsThisSession: sim.deathsThisSession || 0,
    fireActive: sim._fireActive === true,
    burningTileCount: sim.burningTileCount || 0,
    rngState: sim.world.rng.getState(),
    world: sim.world.serialize(),
    clock: sim.clock.serialize(),
    idGen: sim.idGen.getState(),
    agents: sim.agents.map((a) => a.serialize()),
    resources: sim.resources.map((r) => r.serialize()),
    groundItems: sim.groundItems.map((g) => g.serialize()),
    buildings: sim.buildings.map((b) => typeof b.serialize === "function" ? b.serialize() : null).filter(Boolean),
    relationships: sim.relationshipSystem.serialize(),
    settlements: sim.settlementSystem.serialize(),
    economy: sim.economySystem.serialize(),
    crafting: sim.craftingSystem.serialize(),
    trade: sim.tradeSystem.serialize(),
    diplomacy: sim.diplomacySystem ? sim.diplomacySystem.serialize() : null,
    age: sim.ageSystem.serialize(),
    events: sim.eventSystem.serialize(),
    factions: sim.factionSystem.serialize(),
    formations: sim.formationSystem.serialize(),
    combat: { combatants: Array.from(sim.combatSystem.combatants) },
    construction: {
      pendingBuildings: sim.constructionSystem.pendingBuildings.map((b) => ({ ...b })),
      queue: Array.from(sim.constructionSystem.constructionQueue.entries())
    },
    religion: {
      priests: Array.from(sim.religionSystem.priests),
      activeRituals: Array.from(sim.religionSystem.activeRituals.entries()),
      customCreeds: sim.religionSystem.customCreeds
        ? Array.from(sim.religionSystem.customCreeds.entries()).map(([k, v]) => [k, { ...v }])
        : []
    },
    infrastructure: sim.infrastructureSystem.serialize(),
    animals: sim.animalSystem.serialize(),
    chronicle: sim.chronicleSystem.serialize(),
    civilizationAges: sim.civilizationAgeSystem ? sim.civilizationAgeSystem.serialize() : null,
    weather: sim.weatherSystem ? sim.weatherSystem.serialize() : null,
    dynasties: sim.dynastySystem ? sim.dynastySystem.serialize() : null,
    naval: sim.navalSystem ? sim.navalSystem.serialize() : null,
    espionage: sim.espionageSystem ? sim.espionageSystem.serialize() : null,
    fortifications: sim.fortificationSystem ? sim.fortificationSystem.serialize() : null,
    fallenHeroes: Array.isArray(sim.fallenHeroes) ? sim.fallenHeroes.map((h) => ({ ...h })) : [],
    fallenSettlements: Array.isArray(sim.fallenSettlements) ? sim.fallenSettlements.map((fs) => ({
      ...fs,
      center: fs.center ? { ...fs.center } : { x: 0, y: 0 },
      notables: Array.isArray(fs.notables) ? [...fs.notables] : [],
      stats: fs.stats ? { ...fs.stats } : {}
    })) : [],
    spectralSpirits: Array.isArray(sim.spectralSpirits) ? sim.spectralSpirits.map((sp) => ({ ...sp })) : [],
    deadDossiers: Array.isArray(sim._deadDossiers) ? sim._deadDossiers.map((d) => ({
      ...d,
      traits: d.traits ? { ...d.traits } : {},
      skills: d.skills ? { ...d.skills } : {},
      lifeHistory: Array.isArray(d.lifeHistory) ? d.lifeHistory.map((e) => ({ ...e })) : []
    })) : [],
    mortalityStats: {
      totalDeaths: sim.mortalityStats.totalDeaths,
      totalAgeAtDeath: sim.mortalityStats.totalAgeAtDeath,
      averageAgeAtDeath: sim.mortalityStats.averageAgeAtDeath,
      minAgeAtDeath: sim.mortalityStats.minAgeAtDeath,
      maxAgeAtDeath: sim.mortalityStats.maxAgeAtDeath,
      causes: { ...sim.mortalityStats.causes }
    },
    warfare: {
      warbands: Array.from(sim.warfareSystem.warbands.entries()),
      nextWarbandId: sim.warfareSystem.nextWarbandId,
      lastExternalRaidTick: sim.warfareSystem.lastExternalRaidTick ?? 0,
      combatEffects: sim.warfareSystem.combatEffects.map((e) => ({ ...e }))
    },
    career: {
      jobChangeCount: Array.from(sim._jobChangeCount.entries())
    },
    metricsHistory: Array.isArray(sim.metricsHistory) ? sim.metricsHistory.map((m) => ({ ...m })) : []
  };
}

export function deserializeSimulation(SimulationClass, data) {
  const w = data.world?.width || 160;
  const h = data.world?.height || 160;
  const sim = new SimulationClass(data.seed, w, h, { skipInit: true, maxAgents: data.maxAgents ?? 360 });
  sim.birthsThisSession = data.birthsThisSession || 0;
  sim.deathsThisSession = data.deathsThisSession || 0;
  if (data.scenario) sim._scenario = data.scenario;
  sim._agentRng = sim.world.rng;
  if (data.rngState) {
    sim._agentRng.setState(data.rngState);
  }
  sim.clock = SimulationClock.deserialize(data.clock);
  sim.idGen.setState(data.idGen);

  sim.agents = [];
  sim.resources = [];
  sim.buildings = [];

  if (data.world) {
    sim.world.elevation = new Float32Array(data.world.elevation);
    sim.world.moisture = new Float32Array(data.world.moisture);
    sim.world.temperature = new Float32Array(data.world.temperature);
    sim.world.waterLevel = new Float32Array(data.world.waterLevel || []);
    sim.world.biome = data.world.biome || sim.world.biome;
    sim.world.riverFlow = new Float32Array(data.world.riverFlow || []);
    sim.world.isRiverSource = new Uint8Array(data.world.isRiverSource || []);
    sim.world.roadTiles = new Uint8Array(data.world.roadTiles || new Uint8Array(sim.world.width * sim.world.height));
    sim.world.footTraffic = new Uint16Array(data.world.footTraffic || new Uint16Array(sim.world.width * sim.world.height));
    sim.world.fireTiles = new Uint16Array(data.world.fireTiles || new Uint16Array(sim.world.width * sim.world.height));
    sim.world.scorchedTiles = new Uint8Array(data.world.scorchedTiles || new Uint8Array(sim.world.width * sim.world.height));
    sim.world.craterTiles = new Uint8Array(data.world.craterTiles || new Uint8Array(sim.world.width * sim.world.height));
    sim.world.radiationTiles = new Uint8Array(data.world.radiationTiles || new Uint8Array(sim.world.width * sim.world.height));
    sim.world.skullMonuments = Array.isArray(data.world.skullMonuments) ? data.world.skullMonuments.map((m) => ({ ...m })) : [];
    sim.world.nextMonumentId = data.world.nextMonumentId || (sim.world.skullMonuments.length + 1);
    sim.world._radiationActive = sim.world.radiationTiles.some((v) => v > 0);
    sim.world._scorchedActive = sim.world.scorchedTiles.some((v) => v > 0);
    sim.world.bridgeTiles = new Uint8Array(data.world.bridgeTiles || new Uint8Array(sim.world.width * sim.world.height));
    sim._fireActive = data.fireActive !== undefined ? data.fireActive : (sim.world.countFires() > 0);
    sim.burningTileCount = data.burningTileCount !== undefined ? data.burningTileCount : sim.world.countFires();
  }

  for (const resourceData of data.resources) {
    const resource = Resource.deserialize(resourceData, sim.idGen);
    sim.resources.push(resource);
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

  sim.groundItems = [];
  for (const itemData of data.groundItems || []) {
    sim.groundItems.push(GroundItem.deserialize(itemData, sim.idGen));
  }

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
  if (data.diplomacy && sim.diplomacySystem) {
    sim.diplomacySystem.deserialize(data.diplomacy);
  }
  if (data.age) {
    sim.ageSystem = AgeSystem.deserialize(data.age, sim);
  }
  if (data.events) {
    sim.eventSystem = EventSystem.deserialize(data.events);
  }
  if (data.factions) {
    sim.factionSystem = FactionSystem.deserialize(data.factions);
  }
  if (data.formations) {
    sim.formationSystem = FormationSystem.deserialize(data.formations, sim);
  }
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
    sim.religionSystem.customCreeds = Array.isArray(data.religion.customCreeds)
      ? new Map(data.religion.customCreeds.map(([k, v]) => [k, { ...v }]))
      : new Map();
  }
  if (data.infrastructure) {
    sim.infrastructureSystem = InfrastructureSystem.deserialize(data.infrastructure, sim);
  }
  if (data.animals) {
    sim.animalSystem = AnimalSystem.deserialize(data.animals, sim);
  }
  if (data.chronicle) {
    sim.chronicleSystem = ChronicleSystem.deserialize(data.chronicle, sim);
  }

  if (sim.settlementSystem && sim.buildings) {
    const byId = new Map();
    for (const b of sim.buildings) if (b && b.id != null) byId.set(b.id, b);
    for (const s of sim.settlementSystem.settlements.values()) {
      if (!Array.isArray(s.buildings)) continue;
      s.buildings = s.buildings.map((e) => (e && e.id != null && byId.has(e.id)) ? byId.get(e.id) : e);
    }
  }

  if (data.warfare && sim.warfareSystem) {
    sim.warfareSystem.warbands = new Map(data.warfare.warbands || []);
    sim.warfareSystem.nextWarbandId = data.warfare.nextWarbandId ?? 1;
    sim.warfareSystem.lastExternalRaidTick = data.warfare.lastExternalRaidTick ?? 0;
    sim.warfareSystem.combatEffects = Array.isArray(data.warfare.combatEffects)
      ? data.warfare.combatEffects.map((e) => ({ ...e }))
      : [];
  }

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
    sim.fallenHeroes = data.fallenHeroes.map((h) => ({ ...h }));
  }
  if (Array.isArray(data.fallenSettlements)) {
    sim.fallenSettlements = data.fallenSettlements.map((fs) => ({
      ...fs,
      center: fs.center ? { ...fs.center } : { x: 0, y: 0 },
      notables: Array.isArray(fs.notables) ? [...fs.notables] : [],
      stats: fs.stats ? { ...fs.stats } : {}
    }));
  }
  if (Array.isArray(data.spectralSpirits)) {
    sim.spectralSpirits = data.spectralSpirits.map((sp) => ({ ...sp }));
  }
  if (Array.isArray(data.deadDossiers)) {
    sim._deadDossiers = data.deadDossiers.map((d) => ({
      ...d,
      traits: d.traits ? { ...d.traits } : {},
      skills: d.skills ? { ...d.skills } : {},
      lifeHistory: Array.isArray(d.lifeHistory) ? d.lifeHistory.map((e) => ({ ...e })) : []
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

  if (Array.isArray(data.metricsHistory)) {
    sim.metricsHistory = data.metricsHistory.map((m) => ({ ...m }));
  }

  return sim;
}
