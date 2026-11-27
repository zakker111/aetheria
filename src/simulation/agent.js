// Agent with needs, perception, and decision-making (doc 02/03A: component-based agents)
import { RNG } from "../core/rng.js";
import {
  rememberNode as rememberNodeHelper,
  recallNode as recallNodeHelper,
  ensurePerceptionBlock,
  perceiveAgent,
  rememberMemory,
  addLifeEvent as addLifeEventHelper,
  feltAbout,
  hearGossip as hearGossipHelper,
  exchangeGossip,
} from "./agentModules/agentPerceptionAndMemory.js";
import {
  generateGoals as generateGoalsHelper,
  generateActions as generateActionsHelper,
  chooseAction as chooseActionHelper,
} from "./agentModules/agentDecision.js";
import {
  findSettlementBuilding as findSettlementBuildingHelper,
  pickMarketSpot as pickMarketSpotHelper,
  pickPatrolPost as pickPatrolPostHelper,
  pickHearthSpot as pickHearthSpotHelper,
  pickPlaySpot as pickPlaySpotHelper,
  workshopHasDemand as workshopHasDemandHelper,
  pickWorkshopSpot as pickWorkshopSpotHelper,
  pickTempleSpot as pickTempleSpotHelper,
  pickWellSpot as pickWellSpotHelper,
  resolveLiveTarget,
  executeAction as executeActionHelper,
  moveToward as moveTowardHelper,
} from "./agentModules/agentExecution.js";

const FIRST_NAMES = [
  "Aeron", "Bryn", "Caelen", "Darian", "Elowen", "Faelan", "Garrick", "Isolde", 
  "Kael", "Lyra", "Maren", "Niall", "Oren", "Rowan", "Seren", "Taran", "Valen", 
  "Wynne", "Zephyr", "Althea", "Corin", "Daphne", "Elidor", "Fiona", "Gareth",
  "Hadrian", "Iris", "Jorah", "Kendra", "Lorcan", "Mira", "Nesta", "Osric"
];

export const FAMILY_SURNAMES = [
  "Ashford", "Blackwood", "Crestfall", "Dunmore", "Eldridge", "Fairbrook",
  "Greymane", "Hawthorne", "Ironwood", "Kestrel", "Lockhart", "Moorland",
  "Northwind", "Oakheart", "Pendleton", "Ravenscroft", "Stonehelm", "Thornwood",
  "Underhill", "Valen", "Westbrook", "Windham", "Wintermere", "Alden",
  "Bramwell", "Cromwell", "Davenport", "Everett", "Fletcher", "Galloway",
  "Halstead", "Kensington"
];

// Zero-RNG deterministic surname helper derived from agent id + world seed.
export function assignDeterministicSurname(agent, seed = 0) {
  if (!agent) return FAMILY_SURNAMES[0];
  if (agent.surname) return agent.surname;
  const h = (((agent.id || 1) * 2654435761) ^ ((seed || 0) * 1597334677)) >>> 0;
  agent.surname = FAMILY_SURNAMES[h % FAMILY_SURNAMES.length];
  return agent.surname;
}

export function formatAgentFullName(agent) {
  if (!agent) return "Unknown";
  const base = agent.surname && !String(agent.name || "").includes(agent.surname)
    ? `${agent.name || "Citizen"} ${agent.surname}`
    : (agent.name || "Citizen");
  return agent.epithet ? `${base} ${agent.epithet}` : base;
}

// Deterministic tick accessor: never consumes RNG, safe for goal scheduling.
function tickOf(simulation) {
  return (simulation && simulation.clock && simulation.clock.tick) || 0;
}

export class Agent {
  // Memory tuning constants (shared by remember()/chooseAction()).
  static MEMORIES_MAX = 8;               // personal salient-event window
  static LIFE_HISTORY_MAX = 30;          // chronological biography timeline entries
  static MEMORY_RECENCY_TICKS = 400;     // ~2 sim years of "fresh" feeling
  static SPATIAL_MEMORY_MAX = 12;        // remembered resource nodes per agent
  static SOCIAL_ACTION_TYPES = new Set([
    "socialize", "visit_neighbor", "reproduce", "gather_at_hearth", "visit_market", "pray_at_temple", "play_in_town",
    "conjure_fallen", "wander_to_town"
  ]);
  static POSITIVE_MEMORY_TYPES = new Set([
    "MADE_FRIEND", "GOOD_MEAL", "RECEIVED_GIFT", "SAVED_LIFE"
  ]);
  static NEGATIVE_MEMORY_TYPES = new Set([
    "WITNESSED_DEATH", "BETRAYED", "ATTACKED_BY", "STOLEN_FROM"
  ]);
  // Gossip: how much a second-hand account (heard from a teller) counts
  // compared with first-hand experience. Hearsay colors judgment but is
  // discounted, and the teller's own standing scales its credibility.
  static GOSSIP_FACTOR = 0.5;

  constructor(x, y, idGen, initialAge = null, rng = null) {
    this.id = idGen.next();
    // Back-reference to the owning Simulation, wired in addAgent(). Used for
    // deterministic memory recency (sim clock) and dyadic memory filing.
    this.sim = null;
    // Deterministic guard: prefer the injected seeded RNG. The fallback is a
    // fixed-seed deterministic RNG (never Math.random) so that even agents
    // constructed without an injected stream stay reproducible; inside a
    // Simulation every construction site passes world.rng explicitly.
    this.rng = rng || new RNG(0);
    // Workshop reference for supply-chain crafting actions (haul/collect).
    // executeAction() overwrites this with the live system when called from
    // the Simulation, so standalone Agent usage keeps working.
    this.craftingSystem = null;
    const newborn = initialAge === 0;
    this.type = "agent";
    this.x = x;
    this.y = y;
    this.alive = true;
    
    // Identity & Life Stage
    this.name = FIRST_NAMES[Math.floor(this.rng.next() * FIRST_NAMES.length)];
    this.surname = null;      // family lineage name; assigned at birth or founding
    this.generation = 1;      // dynasty depth (children of surnamed parents = max+1)
    this.heirloom = null;     // inherited or forged personal heirloom ({ name, kind, originName, originYear })
    this.buildingsBuilt = 0;  // completed civic/monumental structures credited to this builder
    // Default initial agents are young adults (18-32), newborns are passed 0
    this.age = initialAge !== null ? initialAge : (18 + Math.floor(this.rng.next() * 14));
    this.maxAge = 58 + Math.floor(this.rng.next() * 24); // 58-81 years balanced lifespan
    this.lifeStage = this.age < 18 ? "child" : (this.age >= 58 ? "elder" : "adult");
    
    this.gender = this.rng.next() > 0.5 ? "male" : "female";
    this.children = 0;
    this.parents = [];
    this.partnerId = null;
    this.settlementId = null;
    this.homeId = null;
    this.health = 100;
    this.maxHealth = 100;
    this.starvationTicks = 0;
    this.deathDetail = null;
    this._lastCombatTick = null;
    
    // Components (doc 02: avoid giant NPC class, use components)
    this.needs = {
      // Newborns start with a nursing reserve instead of full adult needs —
      // previously babies spawned at 90+ and starved within ~150 ticks,
      // which is why agents "died really easily" during population booms.
      food: newborn ? 35 + this.rng.next() * 10 : 90 + this.rng.next() * 10,
      water: newborn ? 35 + this.rng.next() * 10 : 90 + this.rng.next() * 10,
      rest: newborn ? 80 + this.rng.next() * 20 : 90 + this.rng.next() * 10,
      social: 60 + this.rng.next() * 20,
      safety: 100,
      // Combat health mirror (warfareSystem writes needs.health; keep both in sync)
      health: 100
    };
    
    this.personality = {
      industrious: this.rng.next() * 0.5 + 0.5,
      social: this.rng.next() * 0.6 + 0.3,
      brave: this.rng.next(),
      curious: this.rng.next()
    };
    
    // All skills start at baseline 1.0 so job gating (requiredSkills) and
    // recipe unlocks behave consistently — previously crafting trades started
    // at 0, which meant calculateSkillLevel floored every craftsman's output
    // quality and progress speed to zero.
    this.skills = {
      gather: 1.0,
      build: 1.0,
      farm: 1.0,
      hunt: 1.0,
      combat: 1.0,
      craft: 1.0,
      carpentry: 1.0,
      smithing: 1.0,
      milling: 1.0,
      cooking: 1.0
    };

    // Spatial memory (Phase 2): bounded list of remembered resource nodes
    // ({ x, y, type, richness, tick }). Written on successful harvests,
    // consulted when foraging is otherwise blind. Deterministic: capped at
    // SPATIAL_MEMORY_MAX entries, oldest evicted first, no RNG involved.
    this.spatialMemory = [];
    
    // Inventory for crafted items and resources
    this.inventory = {
      wood_log: 0,
      wood_plank: 0,
      ore_iron: 0,
      iron_ingot: 0,
      wheat: 2, // Starts with a small ration
      flour: 0,
      tool_handle: 0,
      pickaxe: 0,
      bread: 1,
      meat: 0,
      capacity: 15
    };
    
    this.memories = [];        // personal life events (bounded to MEMORIES_MAX)
    this.lifeHistory = [];     // structured chronological biography milestones
    this.reputation = 0;         // -100..100 standing earned via remembered deeds
    // Second-hand opinions about others, spread by gossip: subjectId -> score
    // (-10..10). Kept separate from `memories` so hearsay never masquerades as
    // lived experience; _feltAbout() merges both streams when judging actions.
    this.gossipViews = new Map();
    // Parallel map of the tick each opinion was last refreshed, so rumors
    // fade with age unless re-heard (bounded by the same keys as gossipViews).
    this._gossipHeard = new Map();
    this.relationships = new Map();
    this.currentAction = null;
    this.goals = [];
    
    // Movement & pathing state
    this.speed = 1;
    this.path = null;
    this._pathGoalKey = null;
    this._harvestTicks = 0;
    this._oscillateCount = 0;
    this._lastTileKey = -1;
    this._prevTileKey = -1;
    this._blockedTargets = null;
    this.wanderTicks = 0;
    this.stuckTicks = 0;
    this.restCycles = 0; // how many times we've slept since waking — drives "out and about" behavior
    
    // Job and workplace
    this.job = null;
    this.jobTitle = null;
    // Career-change ("boredom") bookkeeping: tick the current job was taken.
    // Restless adults may quit and retrain after a long enough stint; the
    // simulation reads/writes this alongside the economy job record so the
    // decision survives save/load (serialized below).
    this._jobAssignedTick = 0;
    // Re-hire patience window: the tick the last job offer landed. The
    // unemployment sweep compares against it (60-tick cooldown + permanent
    // settle after 3 failed attempts) and consumes RNG differently per value,
    // so it MUST round-trip through save/load or a resumed run diverges.
    this._lastJobAssignedTick = null;
    this.workplace = null;
  }

  // Skill XP helper (Phase 2): every task type grants XP to its skill on a
  // cadence (default every 5th completion) with diminishing returns toward
  // the level cap. Deterministic — no RNG draws.
  gainSkill(skill, amount = 0.05, cap = 5, cadence = 5, tickNow = 0) {
    if (!this.skills) return 0;
    const prev = this.skills[skill] || 0;
    if (prev >= cap) return 0;
    if ((this.id * 3 + tickNow) % cadence !== 0) return 0;
    // Diminishing returns: high levels learn slower.
    const gain = amount * (1 - prev / (cap + 1));
    this.skills[skill] = Math.min(cap, prev + gain);
    return this.skills[skill] - prev;
  }

  // Spatial memory helpers (Phase 2). Bounded and deterministic: rememberNode
  // keeps at most SPATIAL_MEMORY_MAX entries (newest wins), recallNode finds
  // the richest remembered node of a resource type within radius.
  rememberNode(x, y, type, richness = 1, tick = 0) {
    return rememberNodeHelper(this, x, y, type, richness, tick);
  }

  recallNode(type, x, y, radius = 20, maxAgeTicks = 4000, now = 0) {
    return recallNodeHelper(this, type, x, y, radius, maxAgeTicks, now);
  }

  // Update needs over time (doc 03A: update urgent needs)
  // dt: delta ticks for time-sliced LOD updates (defaults to 1 tick).
  updateNeeds(dt = 1) {
    // Life-stage-scaled drains (Phase 2): children burn needs slower, elders
    // experience gradual frailty so natural mortality keeps pace with births.
    const stage = this.lifeStage;
    const drainMul = stage === "child" ? 0.7 : (stage === "elder" ? 1.4 : 1.0);
    const restMul = stage === "child" ? 0.6 : (stage === "elder" ? 1.45 : 1.0);

    // Slower drains so agents have time to actually find food/water instead
    // of cascading into starvation deaths.
    this.needs.food = Math.max(0, this.needs.food - 0.10 * drainMul * dt);
    this.needs.water = Math.max(0, this.needs.water - 0.12 * drainMul * dt);
    this.needs.rest = Math.max(0, this.needs.rest - 0.05 * restMul * dt);
    this.needs.social = Math.max(0, this.needs.social - 0.04 * dt);
    
    // Aging: 100 ticks = 1 year of life
    this.age += 0.01 * dt;
    if (this.reproduceCooldown > 0) {
      this.reproduceCooldown = Math.max(0, this.reproduceCooldown - dt);
    }
    
    // Life stage transitions
    if (this.age < 18) {
      this.lifeStage = "child";
    } else if (this.age >= 58) {
      this.lifeStage = "elder";
    } else {
      this.lifeStage = "adult";
    }
    
    // Death from old age
    if (this.age >= this.maxAge) {
      this.alive = false;
      this.deathCause = "old_age";
      return;
    }
    
    // Starvation / Dehydration resistance
    if (this.needs.food <= 0 || this.needs.water <= 0) {
      this.starvationTicks = (this.starvationTicks || 0) + dt;
      this.health = Math.max(0, this.health - 2 * dt);
      if (this.starvationTicks > 40 || this.health <= 0) {
        this.alive = false;
        this.deathCause = this.needs.food <= 0 ? "starvation" : "dehydration";
      }
    } else {
      this.starvationTicks = 0;
      const inBattle = this.militaryDuty && this.warbandId != null &&
        this.sim?.warfareSystem?.warbands?.get(this.warbandId)?.state === 'engaging';
      const nowTick = tickOf(this.sim);
      const recentlyStruck = this._lastCombatTick != null && (nowTick - this._lastCombatTick) < 120;
      if (!inBattle && !recentlyStruck && this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 0.35 * dt);
      }
    }

    // Keep combat-health mirror in sync with canonical health field so both
    // warfareSystem (needs.health) and legacy code paths (agent.health) agree.
    this.needs.health = this.health;
    if (this.combat) this.combat.health = this.health;
  }

  // Simplified macro simulation tick for distant/hinterland agents (LOD Tier 2).
  // Advances needs, handles emergency feeding, macro movement toward home/workplace,
  // and stockpile production contributions without expensive micro-perceptions or steering trees.
  executeMacroTick(simulation, dt = 12, moved = null, births = null) {
    this.updateNeeds(dt);
    if (!this.alive) return;

    // 1. Emergency self-sustenance: consume personal inventory or community stockpile
    if (this.needs.food < 45) {
      if ((this.inventory.bread || 0) > 0) {
        this.inventory.bread--;
        this.needs.food = Math.min(100, this.needs.food + 45);
      } else if ((this.inventory.wheat || 0) > 0) {
        this.inventory.wheat--;
        this.needs.food = Math.min(100, this.needs.food + 25);
      } else if (this.settlementId && simulation?.settlementSystem) {
        const set = simulation.settlementSystem.settlements.get(this.settlementId);
        if (set && set.stockpile) {
          if ((set.stockpile.food || 0) > 0) {
            set.stockpile.food = Math.max(0, set.stockpile.food - 1);
            this.needs.food = Math.min(100, this.needs.food + 50);
          } else if ((set.stockpile.bread || 0) > 0) {
            set.stockpile.bread = Math.max(0, set.stockpile.bread - 1);
            this.needs.food = Math.min(100, this.needs.food + 50);
          }
        }
      }
    }

    if (this.needs.water < 45 && this.settlementId && simulation?.settlementSystem) {
      const set = simulation.settlementSystem.settlements.get(this.settlementId);
      if (set) {
        if (set.stockpile && (set.stockpile.water || 0) > 0) {
          set.stockpile.water = Math.max(0, set.stockpile.water - 1);
          this.needs.water = Math.min(100, this.needs.water + 55);
        } else if (set.center) {
          this.needs.water = Math.min(100, this.needs.water + 45);
        }
      }
    }

    // 2. Macro production contribution backed by actual map resource consumption
    if (this.settlementId && simulation?.settlementSystem && simulation.world) {
      const set = simulation.settlementSystem.settlements.get(this.settlementId);
      if (set && set.stockpile) {
        const wantedType =
          (this.job === 'farmer' || this.job === 'gatherer') ? 'food' :
          this.job === 'lumberjack' ? 'wood' :
          this.job === 'miner' ? 'ore' : null;
        if (wantedType) {
          const cx = Math.floor(this.x);
          const cy = Math.floor(this.y);
          const near = typeof simulation.world._getScan === 'function'
            ? simulation.world._getScan(cx, cy, 12)
            : simulation.world.getEntitiesNear(cx, cy, 12);
          let consumedNode = false;
          for (let i = 0; i < near.length; i++) {
            const ent = near[i];
            if (ent && ent.type === 'resource' && !ent.destroyed && !ent.depleted && !ent.exhausted &&
                ent.resourceType === wantedType && ent.amount > 0 && (ent.requiredEraId || 1) <= 1) {
              if (typeof ent.consume === 'function') {
                ent.consume(1.5, simulation.world);
              } else {
                ent.amount = Math.max(0, ent.amount - 1.5);
                if (ent.amount <= 0 && ent.markDepleted) ent.markDepleted(simulation.world);
              }
              consumedNode = true;
              break;
            }
          }
          if (consumedNode) {
            set.stockpile[wantedType] = (set.stockpile[wantedType] || 0) + 1;
          } else if (this.job === 'farmer' && Array.isArray(set.buildings) &&
                     set.buildings.some(b => b && !b.isRuined && b.complete && b.buildingType === 'farm')) {
            set.stockpile.food = (set.stockpile.food || 0) + 1;
          }
        }
      }
    }

    // 3. Simplified macro waypoint stepping toward anchor point (workplace/home/settlement)
    let destX = this.x;
    let destY = this.y;
    if (this.workplace && simulation?.craftingSystem?.workshops?.has(this.workplace)) {
      const ws = simulation.craftingSystem.workshops.get(this.workplace);
      destX = ws.x; destY = ws.y;
    } else if (this.settlementId && simulation?.settlementSystem) {
      const set = simulation.settlementSystem.settlements.get(this.settlementId);
      if (set && set.center) {
        destX = set.center.x; destY = set.center.y;
      }
    }

    const dx = destX - this.x;
    const dy = destY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2.0 && simulation.world) {
      const step = Math.min(dist - 1.0, this.speed * dt * 0.7);
      const nx = Math.max(1, Math.min(simulation.world.width - 2, this.x + (dx / dist) * step));
      const ny = Math.max(1, Math.min(simulation.world.height - 2, this.y + (dy / dist) * step));
      if (simulation.world.isWalkable(Math.floor(nx), Math.floor(ny))) {
        this.x = nx;
        this.y = ny;
        if (moved) moved.push(this);
      }
    }

    // 4. Macro reproduction in background hinterland settlements (respects global cap & child limit)
    const totalPop = simulation ? simulation.agents.length : 0;
    const popCap = simulation?.maxAgents ?? 360;
    if (totalPop < popCap && this.lifeStage === 'adult' && this.age <= this.maxAge - 14 &&
        this.children < 3 && this.needs.food > 75 && this.needs.water > 75 &&
        this.reproduceCooldown <= 0 && this.partnerId && births && simulation) {
      if ((this.id * 31 + simulation.clock.tick) % 450 === 0) {
        const partner = simulation._agentById(this.partnerId);
        if (partner && partner.alive && partner.reproduceCooldown <= 0 && partner.children < 3) {
          this.reproduceCooldown = 480;
          partner.reproduceCooldown = 480;
          births.push({ x: this.x, y: this.y, parentId1: this.id, parentId2: partner.id });
        }
      }
    }
  }

  // Ensure the reusable perception object exists (empty; items untouched if
  // Simulation already filled them this tick).
  _ensurePerception() {
    return ensurePerceptionBlock(this);
  }

  perceive(world, entities, radius = 12) {
    return perceiveAgent(this, world, entities, radius);
  }

  // Mark this tick's perception as not-yet-computed (see perceive()).
  invalidatePerception() {
    this._perceptionValid = false;
    this._perceptionItemsFilled = false;
  }

  // Return a valid perception for this tick, running the spatial scan only
  // if something actually needed it after being marked stale. Falls back to
  // wiring from the simulation when no world has been seen yet.
  ensurePerception(simulation) {
    const world = this._perceptionWorld || (simulation && simulation.world) ||
      (this.sim && this.sim.world);
    const tickNow = world && world.clock ? world.clock.tick : 0;
    if (!this._perceptionValid || !world || this._perceptionTick !== tickNow) {
      this.perceive(world, [], 12);
    }
    return this._perception;
  }

  // Generate goals based on needs, jobs, reproduction, building, and community
  generateGoals(simulation, perception = null) {
    return generateGoalsHelper(this, simulation, perception);
  }

  generateActions(perception, world, simulation) {
    return generateActionsHelper(this, perception, world, simulation);
  }

  chooseAction(actions, options = {}) {
    return chooseActionHelper(this, Agent, actions, options);
  }

  remember(type, tick, extra = {}) {
    return rememberMemory(this, Agent, type, tick, extra);
  }

  addLifeEvent(kind, text, tick = 0, icon = "📜", milestone = false) {
    return addLifeEventHelper(this, Agent, kind, text, tick, icon, milestone);
  }

  // Current sim tick for memory recency checks (falls back to stored tick).
  _memoryNow() {
    return (this.sim && this.sim.clock && this.sim.clock.tick) ||
      (this._lastTick || 0);
  }

  // If an action targets another agent, return that agent's id; else null.
  _actionSubject(action) {
    const t = action && action.target;
    if (t && typeof t === "object" && t.type === "agent") return t.id;
    return null;
  }

  // Affect score (-10..+10) we feel about a subject, unifying BOTH memory
  // streams: (a) personal memories about them, and (b) the dyadic record in
  // RelationshipSystem (friendship/rivalry balance + recent negative/traumatic
  // memories). Deterministic pure-data read; no RNG.
  _feltAbout(subjectId, now) {
    return feltAbout(this, Agent, subjectId, now);
  }

  hearGossip(teller, subjectId, now) {
    return hearGossipHelper(this, Agent, teller, subjectId, now);
  }

  _exchangeGossip(other, now) {
    return exchangeGossip(this, other, now);
  }

  distanceTo(entity) {
    if (!entity) return Infinity;
    const dx = entity.x - this.x;
    const dy = entity.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ---- Town-life helpers (deterministic, no RNG draws) ----

  // Find a completed building of one of the given types owned by a settlement.
  findSettlementBuilding(simulation, settlement, types) {
    return findSettlementBuildingHelper(this, simulation, settlement, types);
  }

  pickMarketSpot(simulation, settlement) {
    return pickMarketSpotHelper(this, simulation, settlement);
  }

  pickPatrolPost(simulation, settlement) {
    return pickPatrolPostHelper(this, simulation, settlement);
  }

  pickHearthSpot(simulation, settlement) {
    return pickHearthSpotHelper(this, simulation, settlement);
  }

  pickPlaySpot(simulation, settlement) {
    return pickPlaySpotHelper(this, simulation, settlement);
  }

  _workshopHasDemand(ws, craftingSystem) {
    return workshopHasDemandHelper(ws, craftingSystem);
  }

  pickWorkshopSpot(simulation, settlement) {
    return pickWorkshopSpotHelper(this, simulation, settlement);
  }

  pickTempleSpot(simulation, settlement) {
    return pickTempleSpotHelper(this, simulation, settlement);
  }

  pickWellSpot(simulation, settlement) {
    return pickWellSpotHelper(settlement);
  }

  // Flatten an action into a serializable snapshot before it is stored on
  // `this.currentAction`. Generated actions carry live object references
  // (target: Building / Agent / Resource entities). Those entities own back-
  // references (`building.sim`, `agent.sim` -> Simulation), so persisting
  // them verbatim makes the save data circular — JSON.stringify then throws
  // "Converting circular structure to JSON" and every in-game save silently
  // fails. Only x/y/type/id are ever read back from a restored
  // currentAction, so storing plain coordinates + ids preserves resume
  // determinism while keeping the save tree acyclic.
  static snapshotAction(action) {
    if (!action || typeof action !== "object") return action ?? null;
    const snap = {};
    for (const key of Object.keys(action)) {
      const v = action[key];
      if (v === null || typeof v !== "object") {
        snap[key] = v;
      } else if (Array.isArray(v)) {
        snap[key] = v.map(item =>
          item && typeof item === "object" && !Array.isArray(item) && typeof item.x === "number"
            ? { x: item.x, y: item.y } : item);
      } else if (typeof v.x === "number" && typeof v.y === "number") {
        // Entity or coordinate object: keep position + identity only.
        snap[key] = { x: v.x, y: v.y };
        if (v.id != null) snap[key].id = v.id;
        if (v.type) snap[key].type = v.type;
        if (v.resourceType) snap[key].resourceType = v.resourceType;
        if (v.buildingType) snap[key].buildingType = v.buildingType;
        if (v.species) snap[key].species = v.species;
      } else {
        snap[key] = JSON.parse(JSON.stringify(v));
      }
    }
    return snap;
  }

  // Resume determinism: in-flight social/hunt/scavenge actions are stored as
  // flat snapshots (see snapshotAction). When such an action is executed, its
  // target may be either a live entity (fresh decision this tick) or a plain
  // {x,y,id} snapshot restored from a save. Resolve snapshots to the live
  // entity by id so mutation semantics match an uninterrupted run; if the id
  // is gone from the registry, fall back to the snapshot itself and let the
  // case's alive/validity checks handle it exactly as before.
  _resolveLiveTarget(targetOrAction, world) {
    return resolveLiveTarget(targetOrAction, world);
  }

  executeAction(action, world, eventBus, craftingSystem, simulation) {
    return executeActionHelper(this, Agent, action, world, eventBus, craftingSystem, simulation);
  }

  moveToward(target, world, speedBoost = 1) {
    return moveTowardHelper(this, target, world, speedBoost);
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      surname: this.surname ?? null,
      generation: this.generation ?? 1,
      gender: this.gender, // RNG-derived at construction — must persist or every
                           // female loads back as "male" (mate selection diverges)
      x: this.x,
      y: this.y,
      alive: this.alive,
      age: this.age,
      maxAge: this.maxAge,
      lifeStage: this.lifeStage,
      children: this.children,
      parents: this.parents,
      // Social bonds must round-trip: partnerId gates mate-seeking (and its
      // RNG consumption) and homeId steers settlement/build choices — losing
      // them desyncs resumed runs and breaks save/load determinism.
      partnerId: this.partnerId ?? null,
      homeId: this.homeId ?? null,
      health: this.health,
      maxHealth: this.maxHealth ?? 100,
      // Behavior-gating counters must survive save/load: reproduceCooldown
      // gates mate-seeking (and consumes RNG when it fires), starvationTicks
      // drives the death countdown — resetting either desyncs a resumed run.
      reproduceCooldown: this.reproduceCooldown || 0,
      starvationTicks: this.starvationTicks || 0,
      deathCause: this.deathCause ?? null,
      deathDetail: this.deathDetail ?? null,
      kills: this.kills || 0,
      epithet: this.epithet ?? null,
      legendaryWeapon: this.legendaryWeapon ?? null,
      heirloom: this.heirloom ? { ...this.heirloom } : null,
      buildingsBuilt: this.buildingsBuilt || 0,
      isRebel: this.isRebel === true,
      battlesFought: this.battlesFought || 0,
      needs: { ...this.needs },
      personality: { ...this.personality },
      skills: { ...this.skills },
      // Spatial memory must round-trip: agents that remember productive
      // groves/veins would otherwise "amnesize" on load and re-explore,
      // changing foraging trajectories after save/load resume.
      spatialMemory: Array.isArray(this.spatialMemory)
        ? this.spatialMemory.map(m => ({ x: m.x, y: m.y, type: m.type, richness: m.richness, tick: m.tick }))
        : [],
      inventory: { ...this.inventory },
      job: this.job,
      jobTitle: this.jobTitle,
      jobAssignedTick: this._jobAssignedTick ?? 0,
      // NOTE: Infinity must survive the round-trip (JSON turns it into null);
      // encode the "settled permanently" sentinel as a string instead.
      lastJobAssignedTick: this._lastJobAssignedTick === Infinity ? 'inf' : (this._lastJobAssignedTick ?? null),
      workplace: this.workplace,
      settlementId: this.settlementId,
      // Resume determinism: in-flight decision/movement state must survive save/load,
      // otherwise the first tick after resume re-decides from scratch and diverges.
      currentAction: this.currentAction ?? null,
      goals: Array.isArray(this.goals) ? this.goals.map(g => ({
        type: g.type,
        priority: g.priority,
        kind: g.kind,
        target: g.target && typeof g.target === 'object' && typeof g.target.x === 'number'
          ? { x: g.target.x, y: g.target.y, id: g.target.id }
          : (g.target?.id ? { id: g.target.id } : null)
      })) : [],
      path: Array.isArray(this.path) ? this.path.map(p => ({ x: p.x, y: p.y })) : null,
      _pathGoalKey: this._pathGoalKey ?? null,
      _harvestTicks: this._harvestTicks || 0,
      _oscillateCount: this._oscillateCount || 0,
      _lastTileKey: this._lastTileKey ?? -1,
      _prevTileKey: this._prevTileKey ?? -1,
      _blockedTargets: Array.isArray(this._blockedTargets) ? this._blockedTargets.map(b => ({ key: b.key, untilTick: b.untilTick })) : null,
      wanderTicks: this.wanderTicks || 0,
      stuckTicks: this.stuckTicks || 0,
      restCycles: this.restCycles || 0,
      speed: this.speed,
      // Full window, not slice(-8): the runtime cap is MEMORIES_MAX (= 8), so
      // serialize must persist EXACTLY that many. An earlier slice(-8) looked
      // equivalent but a resumed run could hold >8 entries if a save landed
      // between push and splice — truncating on load then dropped the OLDEST
      // survivor while uninterrupted runs drop it first, changing _feltAbout()
      // accumulation order (float sums) and desyncing gossip determinism.
      memories: Array.isArray(this.memories)
        ? this.memories.slice(Math.max(0, this.memories.length - Agent.MEMORIES_MAX))
        : [],
      lifeHistory: Array.isArray(this.lifeHistory)
        ? this.lifeHistory.slice(0, Agent.LIFE_HISTORY_MAX).map(e => ({ ...e }))
        : [],
      reputation: this.reputation || 0,
      gossipViews: this.gossipViews ? Array.from(this.gossipViews.entries()) : [],
      _gossipHeard: this._gossipHeard ? Array.from(this._gossipHeard.entries()) : [],
      // Determinism: agents draw from the ONE shared world stream. Persisting
      // each agent's private stream position lets serialize() be called at any
      // moment (e.g. autosave during a tick) without forking the resumed run:
      // deserialize restores that exact position instead of guessing.
      rngState: this.rng && typeof this.rng.getState === 'function' ? this.rng.getState() : null,
      // Pioneer flag drives behavior branches (local wander vs world-center
      // pull, camp-steered gathering). Deserialized agents never run the
      // constructor, so it must round-trip or a resumed run diverges on the
      // very first tick.
      pioneer: this.pioneer === true,
      spawnX: this.spawnX ?? null,
      spawnY: this.spawnY ?? null,
      // Transient threat/flee caches: recomputed within ~4 ticks by the
      // evaluator, but persisting them keeps save/load byte-for-byte
      // deterministic even when saving mid-evaluation cycle.
      _warThreatTick: this._warThreatTick ?? null,
      _warThreat: this._warThreat ?? null,
      _pendingBuildTick: this._pendingBuildTick ?? null,
      _hasPendingBuild: this._hasPendingBuild ?? null,
      fleeFrom: this.fleeFrom ?? null,
      fleeTarget: this.fleeTarget ?? null,
      // Event-driven productivity modifier (e.g. festival/illness): restored
      // below so an in-flight event effect survives save/load.
      productivityMultiplier: this.productivityMultiplier ?? 1,
      // Military duty flags (WarfareSystem): consulted every goal-tick and by
      // war-threat scans; losing them desyncs soldier behavior after resume.
      militaryDuty: this.militaryDuty === true,
      warbandId: this.warbandId ?? null,
      embarked: this.embarked === true,
      vesselId: this.vesselId ?? null,
      combatRole: this.combatRole ?? null,
      hasWeapon: this.hasWeapon ?? false,
      hasShield: this.hasShield ?? false,
      formationOffset: Array.isArray(this.formationOffset) ? this.formationOffset.slice() : null,
      // Phase 3b Step 3 (combat depth): wound state + convalescence counter
      // and campaign veteran count drive battlefield behavior — they must
      // round-trip through save/load or resumed battles desync.
      wounded: this.wounded === true,
      woundRecovery: this.woundRecovery ?? 0,
      veteranCampaigns: this.veteranCampaigns ?? 0,
      // Combat component: mirrors canonical health each update, but cooldown/
      // target/attack-speed state must survive the round trip.
      combat: this.combat ? { ...this.combat } : null,
      _lastCombatTick: this._lastCombatTick ?? null,
      // Religion component: faith decays incrementally per tick — without
      // persisting it, priests lose their status and faith on load.
      religion: this.religion ? { ...this.religion } : null,
      // Phase 3b Step 7: prisoner of war status
      captive: this.captive === true,
      prisonerOf: this.prisonerOf ?? null,
      isExternalRaider: this.isExternalRaider === true,
      raiderClan: this.raiderClan ?? null
    };
  }

  static deserialize(data, idGen, rng = null, world = null, sim = null) {
    // Determinism fix: constructing through `new Agent(...)` here — even with a
    // stubbed RNG — consumed ~13 draws per agent from the restored world.rng
    // stream before it was re-set, desynchronizing save/load resume vs an
    // uninterrupted run. Randomly-derived fields (name, gender, needs,
    // personality, maxAge) are all persisted in the save, so we build the
    // instance without running the randomized constructor at all and fill
    // every field directly from data.
    const agent = Object.create(Agent.prototype);
    // sim back-reference must be set here too: RelationshipSystem.deserialize
    // runs after agents are restored and files memories directly onto them,
    // so addAgent()'s late assignment would miss those writes (resume bug).
    agent.sim = sim || null;
    agent.rng = rng || new RNG(0); // live seeded stream for future behavior
    // Determinism: restore the exact stream position captured at save time
    // (see serialize()). All agents share one object, so every restore is a
    // no-op except the last one, which leaves the shared stream precisely
    // where the saved world left it — even if serialize() ran mid-tick.
    // Legacy saves without the field keep the current position (unchanged).
    if (data.rngState && typeof agent.rng.setState === 'function') {
      agent.rng.setState(data.rngState);
    }
    agent.relationships = new Map(); // transient runtime map (rebuilt by RelationshipSystem)
    agent.id = data.id;
    agent.type = "agent";
    agent.x = data.x;
    agent.y = data.y;
    agent.name = data.name || "Villager";
    agent.surname = data.surname ?? null;
    agent.generation = data.generation ?? 1;
    agent.alive = data.alive !== undefined ? data.alive : true;
    agent.age = data.age ?? 20;
    agent.maxAge = data.maxAge || 72;
    agent.lifeStage = data.lifeStage || (agent.age < 18 ? "child" : (agent.age >= 58 ? "elder" : "adult"));
    agent.gender = data.gender || "male";
    agent.children = data.children || 0;
    agent.parents = data.parents || [];
    agent.partnerId = data.partnerId ?? null;
    agent.settlementId = data.settlementId || null;
    agent.homeId = data.homeId ?? null;
    agent.health = data.health || 100;
    agent.maxHealth = data.maxHealth || 100;
    agent.starvationTicks = data.starvationTicks || 0;
    agent._lastCombatTick = data._lastCombatTick ?? null;
    agent.reproduceCooldown = data.reproduceCooldown || 0;
    agent.deathCause = data.deathCause ?? null;
    agent.deathDetail = data.deathDetail ?? null;
    agent.kills = data.kills || 0;
    agent.epithet = data.epithet ?? null;
    agent.legendaryWeapon = data.legendaryWeapon ?? null;
    agent.heirloom = data.heirloom ? { ...data.heirloom } : null;
    agent.buildingsBuilt = data.buildingsBuilt || 0;
    agent.isRebel = data.isRebel === true;
    agent.battlesFought = data.battlesFought || 0;
    agent.needs = { ...data.needs };
    agent.personality = { ...data.personality };
    agent.skills = { ...data.skills };
    agent.spatialMemory = Array.isArray(data.spatialMemory)
      ? data.spatialMemory.map(m => ({ x: m.x, y: m.y, type: m.type, richness: m.richness ?? 1, tick: m.tick ?? 0 }))
      : [];
    agent.inventory = data.inventory ? { ...data.inventory } : {
      wood_log: 0,
      wood_plank: 0,
      ore_iron: 0,
      iron_ingot: 0,
      wheat: 2,
      flour: 0,
      tool_handle: 0,
      pickaxe: 0,
      bread: 1,
      capacity: 15
    };
    agent.job = data.job || null;
    agent.jobTitle = data.jobTitle || null;
    agent._jobAssignedTick = typeof data.jobAssignedTick === 'number' ? data.jobAssignedTick : 0;
    // Re-hire patience window must round-trip: the unemployment sweep's
    // 60-tick cooldown and Infinity "settled" sentinel drive RNG-consuming
    // decisions, so losing it desyncs save/load resume from a plain run.
    // 'inf' is the string encoding of Infinity (JSON cannot carry it).
    agent._lastJobAssignedTick = data.lastJobAssignedTick === 'inf' ? Infinity
      : (typeof data.lastJobAssignedTick === 'number' ? data.lastJobAssignedTick : null);
    agent.workplace = data.workplace || null;
    agent.settlementId = data.settlementId || null;
    // Resume determinism: restore in-flight decision/movement state.
    // Resume determinism: goals/currentAction are serialized as plain
    // {x,y,id} snapshots (live entity refs would make the save circular).
    // Re-link them to the restored world entities by id so that a resumed
    // run continues its in-flight action instead of bailing out on a
    // snapshot-only target and re-deciding from scratch (which diverged
    // from an uninterrupted run within ~10 ticks). Ids absent from the
    // registry keep their coordinate snapshots — identical to the old
    // behavior, and safe for systems that only read x/y.
    const relinkTarget = (t, goalType) => {
      if (!t || typeof t !== 'object') return t ?? null;
      if (goalType === 'fetch_town_water' && sim && sim.settlementSystem) {
        const s = sim.settlementSystem.settlements.get(t.id);
        if (s) return s;
      }
      if (goalType !== 'fetch_town_water' && t.id != null && world && typeof world.getEntityById === 'function') {
        const ent = world.getEntityById(t.id);
        if (ent) return ent;
      }
      return t;
    };
    // Keep currentAction as the flat snapshot exactly as an uninterrupted run
    // stores it (executeAction re-snapshots every tick). Live-target consumers
    // (socialize/reproduce/hunt/scavenge/visit_neighbor) resolve the snapshot
    // by id at execution time via _resolveLiveTarget — relinking here instead
    // would serialize back as deep objects and desync resume determinism.
    agent.currentAction = data.currentAction ?? null;
    agent.goals = Array.isArray(data.goals) ? data.goals.map(g => {
      if (g && g.target) return { ...g, target: relinkTarget(g.target, g.type) };
      return g;
    }) : [];
    agent.path = Array.isArray(data.path) ? data.path.map(p => ({ x: p.x, y: p.y })) : null;
    agent._pathGoalKey = data._pathGoalKey ?? null;
    agent._harvestTicks = data._harvestTicks || 0;
    agent._oscillateCount = data._oscillateCount || 0;
    agent._lastTileKey = data._lastTileKey ?? -1;
    agent._prevTileKey = data._prevTileKey ?? -1;
    agent._blockedTargets = Array.isArray(data._blockedTargets) ? data._blockedTargets.map(b => ({ key: b.key, untilTick: b.untilTick })) : null;
    agent.wanderTicks = data.wanderTicks || 0;
    agent.stuckTicks = data.stuckTicks || 0;
    agent.restCycles = data.restCycles || 0;
    if (typeof data.speed === "number") agent.speed = data.speed;
    // Mirror the serialize-side window exactly (see Agent.MEMORIES_MAX note in
    // serialize): slice(-8) here would silently drop restored memories that a
    // fresh run still holds, reordering _feltAbout() float accumulation.
    agent.memories = Array.isArray(data.memories)
      ? data.memories.slice(Math.max(0, data.memories.length - Agent.MEMORIES_MAX))
      : [];
    agent.lifeHistory = Array.isArray(data.lifeHistory)
      ? data.lifeHistory.slice(0, Agent.LIFE_HISTORY_MAX).map(e => ({ ...e }))
      : [];
    agent.reputation = data.reputation || 0;
    agent.gossipViews = new Map(Array.isArray(data.gossipViews) ? data.gossipViews : []);
    agent._gossipHeard = new Map(Array.isArray(data._gossipHeard) ? data._gossipHeard : []);
    // Pioneer flag drives behavior branches (world-center pull vs local wander).
    // The randomized constructor never runs here, so it must be restored or a
    // resumed run diverges on the very first tick.
    agent.pioneer = data.pioneer === true;
    agent.spawnX = data.spawnX ?? null;
    agent.spawnY = data.spawnY ?? null;
    // Transient threat/flee caches: restored for byte-exact save/load even when
    // saving mid-evaluation cycle (recomputed within ~4 ticks otherwise).
    agent._warThreatTick = data._warThreatTick ?? null;
    agent._warThreat = data._warThreat ?? null;
    agent._pendingBuildTick = data._pendingBuildTick ?? null;
    agent._hasPendingBuild = data._hasPendingBuild ?? null;
    agent.fleeFrom = data.fleeFrom ?? null;
    agent.fleeTarget = data.fleeTarget ?? null;
    // In-flight event productivity effect (festival/illness) must survive load.
    agent.productivityMultiplier = data.productivityMultiplier ?? 1;
    // Military duty flags (WarfareSystem): consulted every goal-tick and by
    // war-threat scans; losing them desyncs soldier behavior after resume.
    agent.militaryDuty = data.militaryDuty === true;
    agent.warbandId = data.warbandId ?? null;
    agent.embarked = data.embarked === true;
    agent.vesselId = data.vesselId ?? null;
    agent.combatRole = data.combatRole ?? null;
    agent.hasWeapon = data.hasWeapon ?? false;
    agent.hasShield = data.hasShield ?? false;
    agent.formationOffset = Array.isArray(data.formationOffset) ? data.formationOffset.slice() : null;
    // Phase 3b Step 3: wound/veteran state round-trip (see serialize()).
    agent.wounded = data.wounded === true;
    agent.woundRecovery = data.woundRecovery ?? 0;
    agent.veteranCampaigns = data.veteranCampaigns ?? 0;
    // Combat component: cooldown/target/attack-speed state must round-trip.
    agent.combat = data.combat ? { ...data.combat } : null;
    // Religion component: faith decays incrementally per tick — without this,
    // priests lose status/faith on load and demote/promote at wrong times.
    agent.religion = data.religion ? { ...data.religion } : null;
    agent.captive = data.captive === true;
    agent.prisonerOf = data.prisonerOf ?? null;
    agent.isExternalRaider = data.isExternalRaider === true;
    agent.raiderClan = data.raiderClan ?? null;
    return agent;
  }
}
