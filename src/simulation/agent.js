// Agent with needs, perception, and decision-making (doc 02/03A: component-based agents)
import { IDGenerator } from "../core/idGen.js";

const FIRST_NAMES = [
  "Aeron", "Bryn", "Caelen", "Darian", "Elowen", "Faelan", "Garrick", "Isolde", 
  "Kael", "Lyra", "Maren", "Niall", "Oren", "Rowan", "Seren", "Taran", "Valen", 
  "Wynne", "Zephyr", "Althea", "Corin", "Daphne", "Elidor", "Fiona", "Gareth",
  "Hadrian", "Iris", "Jorah", "Kendra", "Lorcan", "Mira", "Nesta", "Osric"
];

// Deterministic tick accessor: never consumes RNG, safe for goal scheduling.
function tickOf(simulation) {
  return (simulation && simulation.clock && simulation.clock.tick) || 0;
}

export class Agent {
  constructor(x, y, idGen, initialAge = null, rng = null) {
    this.id = idGen.next();
    // Determinism guard: prefer the injected seeded RNG. The Math.random
    // fallback only applies to standalone (non-sim) usage; inside a
    // Simulation every construction site passes world.rng explicitly.
    this.rng = rng || { next: Math.random };
    this.type = "agent";
    this.x = x;
    this.y = y;
    this.alive = true;
    
    // Identity & Life Stage
    this.name = FIRST_NAMES[Math.floor(this.rng.next() * FIRST_NAMES.length)];
    this.surname = null;      // family lineage name; assigned at birth or founding
    this.generation = 1;      // dynasty depth (children of surnamed parents = max+1)
    // Default initial agents are young adults (18-32), newborns are passed 0
    this.age = initialAge !== null ? initialAge : (18 + Math.floor(this.rng.next() * 14));
    this.maxAge = 75 + Math.floor(this.rng.next() * 25); // 75-100 years
    this.lifeStage = this.age < 18 ? "child" : (this.age >= 60 ? "elder" : "adult");
    
    this.gender = this.rng.next() > 0.5 ? "male" : "female";
    this.children = 0;
    this.parents = [];
    this.partnerId = null;
    this.settlementId = null;
    this.homeId = null;
    this.health = 100;
    this.maxHealth = 100;
    this.starvationTicks = 0;
    
    // Components (doc 02: avoid giant NPC class, use components)
    this.needs = {
      food: 90 + this.rng.next() * 10,
      water: 90 + this.rng.next() * 10,
      rest: 90 + this.rng.next() * 10,
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
    
    this.skills = {
      gather: 1.0,
      build: 1.0,
      farm: 1.0,
      carpentry: 0,
      smithing: 0,
      milling: 0,
      cooking: 0
    };
    
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
      capacity: 15
    };
    
    this.memory = [];
    this.relationships = new Map();
    this.currentAction = null;
    this.goals = [];
    
    // Movement & pathing state
    this.speed = 1;
    this.path = null;
    this.wanderTicks = 0;
    this.stuckTicks = 0;
    this.restCycles = 0; // how many times we've slept since waking — drives "out and about" behavior
    
    // Job and workplace
    this.job = null;
    this.jobTitle = null;
    this.workplace = null;
  }

  // Update needs over time (doc 03A: update urgent needs)
  updateNeeds() {
    this.needs.food = Math.max(0, this.needs.food - 0.16);
    this.needs.water = Math.max(0, this.needs.water - 0.20);
    this.needs.rest = Math.max(0, this.needs.rest - 0.06);
    this.needs.social = Math.max(0, this.needs.social - 0.04);
    
    // Aging: 100 ticks = 1 year of life
    this.age += 0.01;
    if (this.reproduceCooldown > 0) {
      this.reproduceCooldown--;
    }
    
    // Life stage transitions
    if (this.age < 18) {
      this.lifeStage = "child";
    } else if (this.age >= 60) {
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
      this.starvationTicks = (this.starvationTicks || 0) + 1;
      this.health = Math.max(0, this.health - 2);
      if (this.starvationTicks > 40 || this.health <= 0) {
        this.alive = false;
        this.deathCause = this.needs.food <= 0 ? "starvation" : "dehydration";
      }
    } else {
      this.starvationTicks = 0;
      if (this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 0.5);
      }
    }

    // Keep combat-health mirror in sync with canonical health field so both
    // warfareSystem (needs.health) and legacy code paths (agent.health) agree.
    this.needs.health = this.health;
    if (this.combat) this.combat.health = this.health;
  }

  // Perceive nearby entities (doc 03A: perceive nearby people, resources, structures)
  perceive(world, entities) {
    const perception = {
      nearbyAgents: [],
      nearbyResources: [],
      nearbyBuildings: [],
      nearbyAnimals: [],
      dangers: [],
      opportunities: []
    };
    
    const radius = 22;
    // Perf guard: cap perception fan-out so dense settlements never freeze
    // the tick loop (unbounded neighbor scans were the main soak-test hazard).
    const MAX_NEARBY_AGENTS = 12;
    const MAX_NEARBY_RESOURCES = 8;
    const MAX_NEARBY_BUILDINGS = 6;
    const MAX_NEARBY_ANIMALS = 6;
    const nearby = world.getEntitiesNear(Math.floor(this.x), Math.floor(this.y), Math.ceil(radius));

    for (const entity of nearby) {
      if (entity.id === this.id) continue;

      const dx = entity.x - this.x;
      const dy = entity.y - this.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radius * radius) {
        if (entity.type === "agent") {
          if (perception.nearbyAgents.length < MAX_NEARBY_AGENTS) perception.nearbyAgents.push(entity);
        } else if (entity.type === "resource") {
          if (perception.nearbyResources.length < MAX_NEARBY_RESOURCES) perception.nearbyResources.push(entity);
        } else if (entity.type === "building") {
          if (perception.nearbyBuildings.length < MAX_NEARBY_BUILDINGS) perception.nearbyBuildings.push(entity);
        } else if (entity.type === "animal" && entity.alive !== false) {
          if (perception.nearbyAnimals.length < MAX_NEARBY_ANIMALS) perception.nearbyAnimals.push(entity);
        }
      }
    }
    
    return perception;
  }

  // Generate goals based on needs, jobs, reproduction, building, and community
  generateGoals(simulation, perception = null) {
    this.goals = [];
    
    // 1. Critical Hunger & Thirst
    if (this.needs.food < 45) {
      if (this.inventory.bread > 0 || this.inventory.wheat > 0) {
        this.goals.push({ type: "eat_from_inventory", priority: 120 - this.needs.food });
      } else {
        this.goals.push({ type: "find_food", priority: 110 - this.needs.food });
      }
    } else if (this.needs.food < 75) {
      if (this.inventory.bread > 0 || this.inventory.wheat > 0) {
        this.goals.push({ type: "eat_from_inventory", priority: 65 });
      } else {
        this.goals.push({ type: "find_food", priority: 55 });
      }
    }
    
    if (this.needs.water < 45) {
      this.goals.push({ type: "find_water", priority: 115 - this.needs.water });
    } else if (this.needs.water < 75) {
      this.goals.push({ type: "find_water", priority: 55 });
    }
    
    // 2. Rest
    if (this.needs.rest < 35) {
      this.goals.push({ type: "rest", priority: 95 - this.needs.rest });
    } else if (this.needs.rest < 55) {
      this.goals.push({ type: "rest", priority: 45 });
    }

    // 2.5 Military Duty & Warfare: Soldiers remain dedicated to their squadron/formation
    if (this.militaryDuty && this.needs.food > 22 && this.needs.water > 22) {
      this.goals.push({ type: "military_duty", priority: 88 });
      this.goals.sort((a, b) => b.priority - a.priority);
      return;
    }

    // 2.6 Desperation & Panic Fleeing: civilians run for their lives when war
    // reaches their doorstep or flames lick at their heels. Wounded, starving
    // agents flee even more readily. Deterministic (no RNG draws).
    //
    // Perf: O(agents^2 * wars) enemy scan throttled to every 4th tick per
    // agent with a cached result. The decision is pure (no RNG), so reuse is
    // save/load-safe; the flee threshold (~9 tiles) moves slowly relative to
    // 4 ticks of travel, and fire threats are re-checked every tick below.
    const desperate = this.needs.health < 35 ||
      (this.needs.food < 12 && this.needs.water < 12);
    let threatX = null, threatY = null, threatDist = Infinity, threatKind = null;
    if (simulation && simulation.world && simulation.diplomacySystem) {
      const mySid = this.settlementId ||
        (simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(this.id) : null);
      const tickNow = simulation.clock ? simulation.clock.tick : this._goalTick;
      if (this._warThreatTick === undefined || tickNow - this._warThreatTick >= 4) {
        this._warThreatTick = tickNow;
        this._warThreat = null;
        const hostiles = mySid != null ? simulation.diplomacySystem.getEnemies(mySid) : [];
        if (hostiles.length > 0 && !this.militaryDuty) {
          const hostileSet = new Set(hostiles);
          let best = null, bestD = Infinity;
          for (const other of simulation.agents) {
            if (!other.alive || other.militaryDuty) continue;
            const osid = other.settlementId ||
              (simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(other.id) : null);
            if (osid == null || !hostileSet.has(osid)) continue;
            const dx = other.x - this.x, dy = other.y - this.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD) { bestD = d2; best = other; }
          }
          if (best) this._warThreat = { x: best.x, y: best.y, dist: Math.sqrt(bestD) };
        }
      }
      if (this._warThreat) {
        threatX = this._warThreat.x; threatY = this._warThreat.y;
        threatDist = this._warThreat.dist; threatKind = "war";
      }
      // Fire nearby? Scan a few tiles around us for burning ground.
      const w = simulation.world;
      if (w.fireTiles) {
        const px = Math.floor(this.x), py = Math.floor(this.y);
        for (let dy = -3; dy <= 3 && threatKind !== "war"; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const fx = px + dx, fy = py + dy;
            if (fx < 0 || fy < 0 || fx >= w.width || fy >= w.height) continue;
            if (w.fireTiles[fy * w.width + fx] > 0) {
              const d = Math.hypot(dx, dy);
              if (d < threatDist) { threatDist = d; threatX = fx; threatY = fy; threatKind = "fire"; }
            }
          }
        }
      }
    }
    const underThreat = threatKind !== null && threatDist < (threatKind === "fire" ? 4.5 : 9);
    if ((underThreat && (desperate || this.personality.brave < 0.6 || this.lifeStage !== "adult")) ||
        (desperate && threatKind !== null)) {
      this.fleeFrom = { x: threatX, y: threatY };
      this.goals.push({ type: "flee", priority: 130, target: { x: threatX, y: threatY }, kind: threatKind });
    } else {
      this.fleeFrom = null;
    }
    if (underThreat || desperate) {
      // Safety need plummets while danger looms — visible in the UI
      this.needs.safety = Math.min(this.needs.safety, desperate ? 10 : 35);
    } else if (this.needs.safety < 100) {
      this.needs.safety = Math.min(100, this.needs.safety + 0.3);
    }
    
    // 3. Construction & Civic Works: high priority for builders or settlements with pending buildings!
    const job = this.job;
    const isBuilder = job === 'builder';
    let hasPendingConstruction = false;
    
    if (simulation && simulation.buildings) {
      // Perf: cache the pending-construction scan per tick (pure decision, no
      // RNG — safe to reuse across save/load). Building sites change slowly.
      const tickNow = simulation.clock ? simulation.clock.tick : -1;
      if (this._pendingBuildTick !== tickNow) {
        this._pendingBuildTick = tickNow;
        this._hasPendingBuild = false;
        const homeSid = this.settlementId ||
          (simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(this.id) : null);
        for (const b of simulation.buildings) {
          if (!b.complete && (b.constructionProgress || 0) < 100) {
            const sid = b.settlementId ?? null;
            if (sid == null || sid === homeSid) { this._hasPendingBuild = true; break; }
            // foreign site: only counts as civic work if friendly (not at war)
            if (homeSid != null && simulation.diplomacySystem) {
              try {
                const rel = simulation.diplomacySystem.getRelation(homeSid, sid);
                if (rel && rel.status !== 'war' && rel.score >= 40) { this._hasPendingBuild = true; break; }
              } catch { /* ignore */ }
            }
          }
        }
      }
      hasPendingConstruction = this._hasPendingBuild;
    }
    
    if (isBuilder || (hasPendingConstruction && (job === 'unemployed' || !job))) {
      this.goals.push({ type: "build", priority: isBuilder ? 85 : 68 });
    }
    
    // 4. Active Job-Specific Goals
    if (job === 'lumberjack') {
      this.goals.push({ type: "chop_wood", priority: 75 });
    } else if (job === 'miner') {
      this.goals.push({ type: "mine_ore", priority: 75 });
    } else if (job === 'farmer') {
      this.goals.push({ type: "farm", priority: 75 });
    } else if (job === 'gatherer') {
      this.goals.push({ type: "gather_resources", priority: 70 });
    } else if (job === 'craftsman' && this.workplace) {
      this.goals.push({ type: "go_to_work", priority: 80 });
    } else if (job === 'soldier' || job === 'guard') {
      this.goals.push({ type: "patrol", priority: 65 });
    } else if (job === 'priest') {
      this.goals.push({ type: "pray", priority: 70 });
    }
    
    // 5. Reproduction & Family Life (Adults in prime age with decent needs)
    if (this.lifeStage === "adult" &&
        this.age >= 18 && this.age <= this.maxAge - 15 && 
        (!this.reproduceCooldown || this.reproduceCooldown <= 0) &&
        this.needs.food > 45 && this.needs.water > 45 && 
        this.children < 5) {
      this.goals.push({ type: "reproduce", priority: 58 });
    }
    
    // 6. Social Interaction & Community Bonding — and neighbor visits:
    // agents actively walk around town to see friends instead of idling.
    // Deterministic trigger (no RNG draw): keeps the shared world RNG stream
    // aligned across save/load resume for the determinism test.
    const socialDrive = (this.personality.social || 0.5);
    if (this.needs.social < 85) {
      this.goals.push({ type: "socialize", priority: 50 });
    } else if (this.lifeStage !== "child" && ((this.id * 7 + tickOf(simulation)) % Math.max(4, Math.round(14 - socialDrive * 10))) === 0) {
      this.goals.push({ type: "visit_neighbor", priority: 26 });
    }
    
    // 7. Settlement Stay & Home Tether
    if (simulation && simulation.settlementSystem) {
      const settlement = simulation.settlementSystem.getAgentSettlement(this.id);
      if (settlement && settlement.center) {
        const distToCenter = Math.hypot(this.x - settlement.center.x, this.y - settlement.center.y);
        if (distToCenter > 18) {
          this.goals.push({ type: "return_to_settlement", priority: 42, target: settlement.center });
        }

        // Communal Stockpile sharing
        const surplus = (this.inventory.wood_log || 0) + (this.inventory.ore_iron || 0) + (this.inventory.wheat || 0);
        if (surplus >= 4) {
          this.goals.push({ type: "deposit_to_stockpile", priority: 72, target: settlement.center });
        }
        if (this.needs.food < 40 && (!this.inventory.wheat && !this.inventory.bread)) {
          if (settlement.stockpile && settlement.stockpile.food > 0) {
            this.goals.push({ type: "eat_from_stockpile", priority: 95, target: settlement.center });
          }
        }

        // Sleep at home: go rest where you live (drives foot traffic on roads)
        if (this.needs.rest < 65) {
          const home = simulation.settlementSystem.getAgentHome(this.id);
          if (home) {
            this.goals.push({ type: "rest_at_home", priority: this.needs.rest < 35 ? 60 : 32, target: home });
          }
        }
      }
    }
    
    // 7.5 Town life: errands that pull agents out into the streets.
    // After a good night's sleep at home, people head to the market square,
    // guards walk the walls, priests tend the temple — visible foot traffic.
    const restedAtHome = this.restCycles > 0 && this.needs.rest > 70;
    if (simulation && simulation.settlementSystem && restedAtHome) {
      const settlement = simulation.settlementSystem.getAgentSettlement(this.id);
      if (settlement && settlement.center) {
        const isGuard = job === 'soldier' || job === 'guard';
        const isPriest = job === 'priest';
        const t = tickOf(simulation);
        const cadence = Math.max(6, Math.round(16 - (this.personality.social || 0.5) * 8));
        if (isGuard && ((this.id * 5 + t) % 10) === 0) {
          this.goals.push({ type: "patrol_settlement", priority: 44, target: settlement });
        } else if (isPriest && ((this.id * 5 + t) % 12) === 0) {
          this.goals.push({ type: "pray_at_temple", priority: 46, target: settlement });
        } else if (((this.id * 11 + t) % cadence) === 0) {
          this.goals.push({ type: "visit_market", priority: 30, target: settlement });
        }
      }
    }

    // 8. Proactive foraging if inventory has space
    const totalItems = Object.values(this.inventory).reduce((a, b) => typeof b === 'number' ? a + b : a, 0);
    if (totalItems < this.inventory.capacity) {
      this.goals.push({ type: "forage_nearby", priority: 35 });
    }
    
    // 7b. Hunting: hungry agents (and job hunters) stalk nearby wildlife.
    // Prey animals are visible via perception; wolves stay off the menu.
    if (perception && perception.nearbyAnimals && perception.nearbyAnimals.length > 0 &&
        (this.needs.food < 65 || this.job === 'hunter')) {
      const prey = perception.nearbyAnimals.find(a => a.species !== 'wolf');
      if (prey) {
        this.goals.push({ type: "hunt", priority: this.job === 'hunter' ? 92 : 82, target: prey });
      }
    }

    // Default fallback goal: always keep exploring/moving — nobody stands still
    this.goals.push({ type: "explore", priority: this.goals.length === 0 ? 10 : 8 });
    
    // Sort by priority descending
    this.goals.sort((a, b) => b.priority - a.priority);
  }

  // Generate legal actions for current goals
  generateActions(perception, world, simulation) {
    const actions = [];
    
    for (const goal of this.goals) {
      switch (goal.type) {
        case "build": {
          // Territorial building rules:
          //  - Home settlement's projects: full priority (own builders).
          //  - Friendly settlements' projects (peace/alliance): allowed at reduced priority.
          //  - At-war or hostile settlements: never build for them.
          const homeId = this.settlementId ||
            (simulation && simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(this.id) : null);
          const isFriendlySite = (siteSid) => {
            if (siteSid == null) return true;             // unowned site: anyone may build
            if (homeId == null) return false;             // homeless agents only build unowned sites
            if (siteSid === homeId) return true;          // own community always
            if (simulation && simulation.diplomacySystem) {
              try {
                const rel = simulation.diplomacySystem.getRelation(homeId, siteSid);
                if (!rel) return false;
                if (rel.status === 'war') return false;   // never aid an enemy
                return rel.score >= 40;                   // friendly enough => cooperative labor
              } catch { return false; }
            }
            return true;                                  // no diplomacy layer: treat all as friendly
          };
          // Check all incomplete buildings in simulation or local perception
          let candidate = null;
          let bestDist = Infinity;
          
          if (simulation && simulation.buildings) {
            for (const b of simulation.buildings) {
              if (!b.complete && (b.constructionProgress || 0) < 100 && isFriendlySite(b.settlementId ?? null)) {
                const dist = this.distanceTo(b);
                if (dist < bestDist) {
                  bestDist = dist;
                  candidate = b;
                }
              }
            }
          }
          if (simulation && simulation.constructionSystem && simulation.constructionSystem.pendingBuildings) {
            for (const b of simulation.constructionSystem.pendingBuildings) {
              if (!b.isComplete && (b.constructionProgress || 0) < 100 && isFriendlySite(b.settlementId ?? null)) {
                const dist = this.distanceTo(b);
                if (dist < bestDist) {
                  bestDist = dist;
                  candidate = b;
                }
              }
            }
          }
          
          if (candidate) {
            // Foreign friendly sites get a cooperation penalty so home projects come first
            const foreignPenalty = (candidate.settlementId != null && candidate.settlementId !== homeId) ? 15 : 0;
            actions.push({
              type: "build",
              target: candidate,
              score: goal.priority + (20 - Math.min(18, bestDist)) - foreignPenalty,
            });
          }
          break;
        }
        
        case "reproduce":
          for (const agent of perception.nearbyAgents) {
            if (agent.alive && agent !== this &&
                agent.lifeStage === "adult" &&
                agent.age >= 18 && agent.age <= agent.maxAge - 15 &&
                agent.gender !== this.gender &&
                agent.needs.food > 40 && agent.needs.water > 40) {
              // Incest taboo: never pursue parents / children / siblings
              const fam = simulation && simulation.relationshipSystem
                ? simulation.relationshipSystem.getRelatives(this.id) : null;
              if (fam && (fam.spouse === agent.id ||
                          fam.parents.includes(agent.id) ||
                          fam.children.includes(agent.id) ||
                          fam.siblings.includes(agent.id))) continue;
              // Prefer partners we already know (bonding matters), plus compatibility
              let bonus = 0;
              if (simulation && simulation.relationshipSystem) {
                const rel = simulation.relationshipSystem.getRelationship(this.id, agent.id);
                if (rel) bonus += Math.min(8, (rel.friendship || 0) * 0.08);
              }
              if (this.partnerId === agent.id) bonus += 6; // established couples stay together
              actions.push({
                type: "reproduce",
                target: agent,
                score: goal.priority + (10 - Math.min(9, this.distanceTo(agent))) + bonus
              });
            }
          }
          break;

        case "socialize":
          for (const agent of perception.nearbyAgents) {
            if (agent.alive && agent !== this) {
              actions.push({
                type: "socialize",
                target: agent,
                score: goal.priority + (12 - Math.min(10, this.distanceTo(agent)))
              });
            }
          }
          break;
          
        case "go_to_work":
          if (this.workplace) {
            actions.push({
              type: "go_to_workplace",
              workplaceId: this.workplace,
              score: goal.priority
            });
          }
          break;
          
        case "chop_wood":
          for (const res of perception.nearbyResources) {
            if (res.resourceType === "wood" && res.amount > 0) {
              actions.push({
                type: "chop_wood",
                target: res,
                score: goal.priority + (15 - Math.min(14, this.distanceTo(res)))
              });
            }
          }
          break;
          
        case "mine_ore":
          for (const res of perception.nearbyResources) {
            if (res.resourceType === "ore" && res.amount > 0) {
              actions.push({
                type: "mine_ore",
                target: res,
                score: goal.priority + (15 - Math.min(14, this.distanceTo(res)))
              });
            }
          }
          break;
          
        case "farm":
        case "find_food":
          for (const res of perception.nearbyResources) {
            if (res.resourceType === "food" && res.amount > 0) {
              actions.push({
                type: "gather_food",
                target: res,
                score: goal.priority + (15 - Math.min(14, this.distanceTo(res)))
              });
            }
          }
          break;
          
        case "gather_resources":
        case "forage_nearby":
          for (const res of perception.nearbyResources) {
            if (res.amount > 0) {
              let actType = "gather_food";
              if (res.resourceType === "wood") actType = "chop_wood";
              else if (res.resourceType === "ore") actType = "mine_ore";
              else if (res.resourceType === "water") actType = "drink_water";
              actions.push({
                type: actType,
                target: res,
                score: goal.priority + (10 - Math.min(9, this.distanceTo(res)))
              });
            }
          }
          break;
          
        case "eat_from_inventory":
          actions.push({
            type: "eat_from_inventory",
            score: goal.priority
          });
          break;
          
        case "find_water":
          for (const res of perception.nearbyResources) {
            if (res.resourceType === "water") {
              actions.push({
                type: "drink_water",
                target: res,
                score: goal.priority + (15 - Math.min(14, this.distanceTo(res)))
              });
            }
          }
          break;
          
        case "rest":
          actions.push({
            type: "rest",
            score: goal.priority
          });
          break;

        case "rest_at_home":
          if (goal.target) {
            actions.push({
              type: "go_home_and_rest",
              target: goal.target,
              score: goal.priority
            });
          }
          break;

        case "visit_neighbor": {
          // Walk over to a nearby friend/relative's position and chat on arrival
          let best = null;
          let bestScore = -Infinity;
          for (const agent of perception.nearbyAgents) {
            if (!agent.alive || agent === this) continue;
            const d = this.distanceTo(agent);
            if (d < 4) continue; // already together — socialize covers it
            let affinity = 0;
            if (simulation && simulation.relationshipSystem) {
              try {
                const rel = simulation.relationshipSystem.getRelationship(this.id, agent.id);
                if (rel) affinity = (rel.friendship || 0) * 0.1;
              } catch { /* ignore */ }
            }
            const score = affinity - Math.min(20, d) * 0.3;
            if (score > bestScore) { bestScore = score; best = agent; }
          }
          if (best) {
            actions.push({
              type: "visit_neighbor",
              target: best,
              score: goal.priority + Math.max(0, 8 + bestScore)
            });
          }
          break;
        }
          
        case "return_to_settlement":
          if (goal.target) {
            actions.push({
              type: "return_home",
              target: goal.target,
              score: goal.priority
            });
          }
          break;

        case "visit_market": {
          const dest = this.pickMarketSpot(simulation, goal.target);
          if (dest) {
            actions.push({
              type: "visit_market",
              target: dest,
              score: goal.priority + (10 - Math.min(9, Math.hypot(dest.x - this.x, dest.y - this.y)))
            });
          }
          break;
        }

        case "patrol_settlement": {
          const post = this.pickPatrolPost(simulation, goal.target);
          if (post) {
            actions.push({ type: "patrol_settlement", target: post, score: goal.priority });
          }
          break;
        }

        case "pray_at_temple": {
          const temple = this.findSettlementBuilding(simulation, goal.target, ["temple"]);
          if (temple) {
            actions.push({ type: "pray_at_temple", target: temple, score: goal.priority });
          }
          break;
        }

        case "deposit_to_stockpile":
          if (goal.target) {
            actions.push({
              type: "deposit_to_stockpile",
              target: goal.target,
              score: goal.priority
            });
          }
          break;

        case "eat_from_stockpile":
          if (goal.target) {
            actions.push({
              type: "eat_from_stockpile",
              target: goal.target,
              score: goal.priority
            });
          }
          break;

        case "military_duty":
          actions.push({
            type: "military_duty",
            score: goal.priority
          });
          break;

        case "hunt":
          if (goal.target && goal.target.alive !== false) {
            actions.push({
              type: "hunt",
              target: goal.target,
              score: goal.priority + (12 - Math.min(12, this.distanceTo(goal.target)))
            });
          }
          break;

        case "flee":
          actions.push({
            type: "flee",
            target: goal.target,
            kind: goal.kind,
            score: goal.priority
          });
          break;
          
        case "explore":
          actions.push({
            type: "wander",
            score: goal.priority * this.personality.curious
          });
          break;
      }
    }
    
    // Always guarantee at least one legal action
    if (actions.length === 0) {
      actions.push({ type: "wander", score: 1 });
    }
    
    return actions;
  }

  // Choose best action
  chooseAction(actions) {
    if (!actions || actions.length === 0) return null;
    actions.sort((a, b) => b.score - a.score);
    return actions[0];
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
    if (!simulation || !settlement) return null;
    const list = settlement.buildings && settlement.buildings.length > 0
      ? settlement.buildings
      : simulation.buildings;
    let best = null, bestD = Infinity;
    for (const b of list) {
      if (!b || b.settlementId !== settlement.id) continue;
      if (!(b.complete || b.isComplete)) continue;
      if (!types.includes(b.buildingType)) continue;
      const d = this.distanceTo(b);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // A spot in the town center / market square to bustle around.
  pickMarketSpot(simulation, settlement) {
    if (!settlement || !settlement.center) return null;
    const t = tickOf(simulation);
    const angle = ((this.id + Math.floor(t / 24)) % 8) * (Math.PI / 4);
    const radius = 2 + ((this.id * 3) % 4);
    const x = settlement.center.x + Math.cos(angle) * radius;
    const y = settlement.center.y + Math.sin(angle) * radius;
    if (simulation.world && !simulation.world.isWalkable(Math.floor(x), Math.floor(y))) {
      return { x: settlement.center.x, y: settlement.center.y };
    }
    return { x, y };
  }

  // Guards circle the perimeter of their town's civic buildings.
  pickPatrolPost(simulation, settlement) {
    if (!settlement) return null;
    const civic = this.findSettlementBuilding(simulation, settlement, ["castle", "tower", "temple"]);
    const anchor = civic || settlement.center;
    if (!anchor) return null;
    const t = tickOf(simulation);
    const angle = ((this.id + Math.floor(t / 16)) % 8) * (Math.PI / 4);
    const radius = civic ? 5 : 9;
    const x = anchor.x + Math.cos(angle) * radius;
    const y = anchor.y + Math.sin(angle) * radius;
    if (simulation.world && !simulation.world.isWalkable(Math.floor(x), Math.floor(y))) {
      return { x: anchor.x, y: anchor.y };
    }
    return { x, y };
  }

  // Execute action for one tick
  executeAction(action, world, eventBus, craftingSystem, simulation) {
    if (!action) return null;
    
    this.currentAction = action;
    
    switch (action.type) {
      case "build": {
        if (!action.target) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 2.5) {
          action.target.constructionProgress = (action.target.constructionProgress || 0) + 4;
          this.skills.build = (this.skills.build || 1.0) + 0.05;
          
          if (action.target.constructionProgress >= 100) {
            action.target.isComplete = true;
            action.target.complete = true;
            if (eventBus) {
              eventBus.emit("CONSTRUCTION_COMPLETED", { 
                buildingId: action.target.id,
                buildingType: action.target.buildingType || action.target.type,
                x: action.target.x,
                y: action.target.y
              });
            }
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "reproduce": {
        if (!action.target || !action.target.alive) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 2.2) {
          this.needs.social = Math.min(100, this.needs.social + 20);
          this.needs.food = Math.max(0, this.needs.food - 18);
          this.needs.water = Math.max(0, this.needs.water - 18);
          this.children++;
          this.reproduceCooldown = 150; // Sustained cooldown
          
          action.target.children++;
          action.target.reproduceCooldown = 150;
          action.target.needs.social = Math.min(100, action.target.needs.social + 20);
          
          const babyX = Math.max(2, Math.min(world.width - 2, this.x + (this.rng.next() - 0.5) * 2));
          const babyY = Math.max(2, Math.min(world.height - 2, this.y + (this.rng.next() - 0.5) * 2));
          
          if (eventBus) {
            eventBus.emit("AGENT_BORN", {
              parentId1: this.id,
              parentId2: action.target.id,
              x: babyX,
              y: babyY
            });
          }
          
          this.currentAction = null;
          return { type: "birth", x: babyX, y: babyY, parentId1: this.id, parentId2: action.target.id };
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "socialize": {
        if (!action.target || !action.target.alive) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 2.5) {
          this.needs.social = Math.min(100, this.needs.social + 18);
          action.target.needs.social = Math.min(100, action.target.needs.social + 18);
          
          const relKey = `${action.target.id}`;
          const currentRel = this.relationships.get(relKey) || 0;
          this.relationships.set(relKey, Math.min(100, currentRel + 6));
          
          if (simulation && simulation.relationshipSystem) {
            simulation.relationshipSystem.modifyRelationship(this.id, action.target.id, {
              friendship: 6,
              trust: 3
            });
          }
          
          if (eventBus) {
            eventBus.emit("RELATIONSHIP_CHANGED", {
              agentId1: this.id,
              agentId2: action.target.id,
              change: 6
            });
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "go_to_workplace": {
        const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
        if (workshop) {
          const workshopEntity = { x: workshop.x + 1, y: workshop.y + 1 };
          if (this.distanceTo(workshopEntity) < 2) {
            this.currentAction = null;
          } else {
            this.moveToward(workshopEntity, world);
          }
        }
        break;
      }
        
      case "eat_from_inventory":
        if (this.inventory.bread > 0) {
          this.inventory.bread--;
          this.needs.food = Math.min(100, this.needs.food + 45);
          this.currentAction = null;
        } else if (this.inventory.wheat > 0) {
          this.inventory.wheat--;
          this.needs.food = Math.min(100, this.needs.food + 25);
          this.currentAction = null;
        }
        break;
        
      case "gather_food":
        if (!action.target || action.target.amount <= 0) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 1.8) {
          action.target.amount = Math.max(0, action.target.amount - 0.5);
          this.inventory.wheat = (this.inventory.wheat || 0) + 1;
          this.needs.food = Math.min(100, this.needs.food + 30);
          this.skills.farm = (this.skills.farm || 1.0) + 0.05;
          if (eventBus) {
            eventBus.emit("RESOURCE_GATHERED", { 
              agentId: this.id, 
              resourceType: "wheat",
              x: action.target.x,
              y: action.target.y
            });
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;

      case "chop_wood":
        if (!action.target || action.target.amount <= 0) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 1.8) {
          action.target.amount = Math.max(0, action.target.amount - 0.5);
          this.inventory.wood_log = (this.inventory.wood_log || 0) + 1;
          this.skills.gather = (this.skills.gather || 1.0) + 0.05;
          if (eventBus) {
            eventBus.emit("RESOURCE_GATHERED", { 
              agentId: this.id, 
              resourceType: "wood",
              x: action.target.x,
              y: action.target.y
            });
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;

      case "mine_ore":
        if (!action.target || action.target.amount <= 0) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 1.8) {
          action.target.amount = Math.max(0, action.target.amount - 0.5);
          this.inventory.ore_iron = (this.inventory.ore_iron || 0) + 1;
          this.skills.gather = (this.skills.gather || 1.0) + 0.05;
          if (eventBus) {
            eventBus.emit("RESOURCE_GATHERED", { 
              agentId: this.id, 
              resourceType: "ore",
              x: action.target.x,
              y: action.target.y
            });
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
        
      case "drink_water":
        if (!action.target) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 1.8) {
          this.needs.water = Math.min(100, this.needs.water + 45);
          if (eventBus) {
            eventBus.emit("RESOURCE_CONSUMED", { 
              agentId: this.id, 
              resourceType: "water"
            });
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
        
      case "rest":
        this.needs.rest = Math.min(100, this.needs.rest + 10);
        if (this.needs.rest > 90) {
          this.currentAction = null;
        }
        break;

      case "go_home_and_rest": {
        if (!action.target) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 2.5) {
          // Cozy at home: rest recovers faster than napping in the open
          this.needs.rest = Math.min(100, this.needs.rest + 14);
          if (this.needs.rest > 85) {
            // Slept a full night at home — count it and head back out tomorrow
            this.restCycles++;
            this.currentAction = null;
          }
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "visit_market": {
        if (!action.target) { this.currentAction = null; break; }
        if (this.distanceTo(action.target) < 1.6) {
          // Bustling in the square: bump into neighbors, catch up on gossip
          this.needs.social = Math.min(100, this.needs.social + 8);
          for (const other of world.getEntitiesNear(Math.floor(this.x), Math.floor(this.y), 3)) {
            if (other.type === "agent" && other.id !== this.id && other.alive) {
              other.needs.social = Math.min(100, other.needs.social + 3);
              if (simulation && simulation.relationshipSystem) {
                simulation.relationshipSystem.modifyRelationship(this.id, other.id, { friendship: 1 });
              }
            }
          }
          if (eventBus) {
            eventBus.emit("MARKET_VISIT", { agentId: this.id, x: this.x, y: this.y });
          }
          this.currentAction = null; // errand done
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "patrol_settlement": {
        if (!action.target) { this.currentAction = null; break; }
        if (this.distanceTo(action.target) < 1.8) {
          this.needs.rest = Math.max(0, this.needs.rest - 0.5); // standing watch is tiring
          this.currentAction = null; // reached post — next tick picks a new one, creating a circuit
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "pray_at_temple": {
        if (!action.target) { this.currentAction = null; break; }
        if (this.distanceTo(action.target) < 2.2) {
          this.needs.social = Math.min(100, this.needs.social + 6);
          this.skills.cooking = this.skills.cooking; // no-op keeps shape stable
          if (eventBus) {
            eventBus.emit("PRAYER", { agentId: this.id, buildingId: action.target.id, x: this.x, y: this.y });
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
      }

      case "visit_neighbor": {
        if (!action.target || !action.target.alive) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 2.5) {
          // Arrived: say hello and catch up
          this.needs.social = Math.min(100, this.needs.social + 12);
          action.target.needs.social = Math.min(100, action.target.needs.social + 6);
          if (simulation && simulation.relationshipSystem) {
            simulation.relationshipSystem.modifyRelationship(this.id, action.target.id, {
              friendship: 3
            });
          }
          this.currentAction = null;
        } else {
          // Follow them around the map — keeps both parties moving
          this.moveToward(action.target, world);
        }
        break;
      }

      case "return_home":
        if (!action.target) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 2.5) {
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;

      case "deposit_to_stockpile":
        if (!action.target) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 3.0) {
          if (simulation && simulation.settlementSystem) {
            const sid = this.settlementId || simulation.settlementSystem.agentSettlementMap.get(this.id);
            if (sid) {
              if (this.inventory.wood_log > 0) {
                simulation.settlementSystem.depositToStockpile(sid, "wood", this.inventory.wood_log);
                this.inventory.wood_log = 0;
              }
              if (this.inventory.ore_iron > 0) {
                simulation.settlementSystem.depositToStockpile(sid, "ore", this.inventory.ore_iron);
                this.inventory.ore_iron = 0;
              }
              if (this.inventory.wheat > 1) {
                const donate = this.inventory.wheat - 1;
                simulation.settlementSystem.depositToStockpile(sid, "food", donate);
                this.inventory.wheat = 1;
              }
            }
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;

      case "eat_from_stockpile":
        if (!action.target) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(action.target) < 3.0) {
          if (simulation && simulation.settlementSystem) {
            const sid = this.settlementId || simulation.settlementSystem.agentSettlementMap.get(this.id);
            if (sid) {
              const taken = simulation.settlementSystem.withdrawFromStockpile(sid, "food", 1);
              if (taken > 0) {
                this.needs.food = Math.min(100, this.needs.food + 45);
              }
            }
          }
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;

      case "military_duty":
        // Position, maneuvers and combat clashing are processed each tick by WarfareSystem
        this.currentAction = null;
        break;

      case "hunt": {
        const prey = action.target;
        if (!prey || prey.alive === false) {
          this.currentAction = null;
          break;
        }
        if (this.distanceTo(prey) < 1.6) {
          // The kill: food fills fast, hide is loot, skill grows.
          const gain = prey.species === 'boar' ? 38 : 30;
          prey.alive = false;
          this.needs.food = Math.min(100, this.needs.food + gain);
          this.inventory.meat = (this.inventory.meat || 0) + 2;
          this.inventory.hide = (this.inventory.hide || 0) + 1;
          this.skills.hunt = (this.skills.hunt || 1.0) + 0.06;
          simulation?.animalSystem?.removeAnimal?.(prey);
          if (eventBus) {
            eventBus.emit("ANIMAL_KILLED", {
              species: prey.species, x: prey.x, y: prey.y, by: this.id
            });
            eventBus.emit("RESOURCE_GATHERED", {
              agentId: this.id, resourceType: "meat", x: prey.x, y: prey.y
            });
          }
          this.currentAction = null;
        } else {
          // The chase: sprint after the quarry.
          this.moveToward(prey, world, 1.5);
          this.currentAction = action;
        }
        break;
      }

      case "flee": {
        // Sprint directly away from the threat (soldiers/war or burning ground).
        const threat = action.target || this.fleeFrom;
        if (!threat) { this.currentAction = null; break; }
        let awayX = this.x - threat.x;
        let awayY = this.y - threat.y;
        const mag = Math.hypot(awayX, awayY) || 1;
        awayX /= mag; awayY /= mag;
        // Slight deterministic veer so crowds don't stack on one lane
        const veerAngle = ((this.id % 7) - 3) * 0.18;
        const cosV = Math.cos(veerAngle), sinV = Math.sin(veerAngle);
        const dirX = awayX * cosV - awayY * sinV;
        const dirY = awayX * sinV + awayY * cosV;
        const runDist = 6;
        const margin = 4;
        let destX = Math.max(margin, Math.min((world.width || 128) - margin, this.x + dirX * runDist));
        let destY = Math.max(margin, Math.min((world.height || 128) - margin, this.y + dirY * runDist));
        if (!world.isWalkable(Math.floor(destX), Math.floor(destY))) {
          // Try perpendicular escape vectors
          const alt = [{ x: this.x + dirY * runDist, y: this.y - dirX * runDist },
                       { x: this.x - dirY * runDist, y: this.y + dirX * runDist },
                       { x: this.x + dirX * 3, y: this.y + dirY * 3 }];
          for (const cand of alt) {
            const cx = Math.max(margin, Math.min((world.width || 128) - margin, cand.x));
            const cy = Math.max(margin, Math.min((world.height || 128) - margin, cand.y));
            if (world.isWalkable(Math.floor(cx), Math.floor(cy))) { destX = cx; destY = cy; break; }
          }
        }
        this.moveToward({ x: destX, y: destY }, world, 1.8); // panic sprint ×1.8 speed
        this.needs.rest = Math.max(0, this.needs.rest - 0.15); // running is exhausting
        break;
      }
        
      case "wander": {
        this.wanderTicks = (this.wanderTicks || 0) + 1;
        
        // Refresh destination if no path, reached target, or spent too long wandering
        if (!this.path || this.path.length === 0 || this.wanderTicks > 12) {
          this.wanderTicks = 0;
          
          const margin = 8;
          let centerX = world.width / 2;
          let centerY = world.height / 2;

          // If agent belongs to a settlement, wander around their home community!
          if (simulation && simulation.settlementSystem) {
            const sid = this.settlementId || simulation.settlementSystem.agentSettlementMap.get(this.id);
            if (sid) {
              const s = simulation.settlementSystem.settlements.get(sid);
              if (s && s.center) {
                centerX = s.center.x;
                centerY = s.center.y;
              }
            }
          }
          
          let targetX = this.x;
          let targetY = this.y;
          
          // Border Avoidance Force: if within 12 tiles of edges, steer inward
          const nearLeft = this.x < 12;
          const nearRight = this.x > world.width - 12;
          const nearTop = this.y < 12;
          const nearBottom = this.y > world.height - 12;
          
          if (nearLeft || nearRight || nearTop || nearBottom) {
            const dirX = Math.sign(centerX - this.x);
            const dirY = Math.sign(centerY - this.y);
            targetX = this.x + dirX * (5 + this.rng.next() * 6);
            targetY = this.y + dirY * (5 + this.rng.next() * 6);
          } else {
            // Tethered community wander: don't drift too far from settlement
            const distFromTown = Math.hypot(this.x - centerX, this.y - centerY);
            if (distFromTown > 16) {
              const dirX = Math.sign(centerX - this.x);
              const dirY = Math.sign(centerY - this.y);
              targetX = this.x + dirX * (3 + this.rng.next() * 4);
              targetY = this.y + dirY * (3 + this.rng.next() * 4);
            } else {
              // Normal wander: gentle local wandering
              const angle = this.rng.next() * Math.PI * 2;
              const dist = 2 + this.rng.next() * 4;
              targetX = this.x + Math.cos(angle) * dist;
              targetY = this.y + Math.sin(angle) * dist;
            }
          }
          
          // Strictly clamp within safe world margin
          targetX = Math.max(margin, Math.min(world.width - margin, targetX));
          targetY = Math.max(margin, Math.min(world.height - margin, targetY));
          
          // Ensure target tile is walkable
          if (!world.isWalkable(Math.floor(targetX), Math.floor(targetY))) {
            targetX = this.x + Math.sign(centerX - this.x) * 2;
            targetY = this.y + Math.sign(centerY - this.y) * 2;
          }
          
          this.path = [{ x: targetX, y: targetY }];
        }
        
        if (this.path && this.path.length > 0) {
          const dest = this.path[0];
          this.moveToward(dest, world);
          if (this.path && this.path.length > 0 && this.distanceTo(dest) < 1.2) {
            this.path = null;
            this.currentAction = null;
            this.wanderTicks = 0;
          }
        }
        break;
      }
    }
    
    return null;
  }

  // Smooth movement with border clamping and multi-direction obstacle avoidance
  // speedBoost: optional multiplier (e.g. panic fleeing sprints at ×1.8)
  moveToward(target, world, speedBoost = 1) {
    if (!target) return;
    
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0.1) {
      let effectiveSpeed = this.speed * speedBoost;
      // Elder agents move slightly slower, urgent needs move faster
      if (this.lifeStage === "elder") {
        effectiveSpeed *= 0.75;
      }
      if (this.needs.food < 30 || this.needs.water < 30) {
        effectiveSpeed *= 1.35;
      }
      // Roads: agents standing on a road tile stride 60% faster
      if (world.isRoad && world.isRoad(Math.floor(this.x), Math.floor(this.y))) {
        effectiveSpeed *= 1.6;
      }
      
      const step = Math.min(dist, effectiveSpeed);
      let newX = this.x + (dx / dist) * step;
      let newY = this.y + (dy / dist) * step;
      
      // Strict clamping inside valid playable land
      newX = Math.max(1, Math.min(world.width - 1.1, newX));
      newY = Math.max(1, Math.min(world.height - 1.1, newY));
      
      const newTileX = Math.floor(newX);
      const newTileY = Math.floor(newY);
      
      if (world.isWalkable(newTileX, newTileY)) {
        const oldTileX = Math.floor(this.x);
        const oldTileY = Math.floor(this.y);

        // Emergent paths: repeated foot traffic tramples desire-paths into roads
        // (deterministic — no RNG involved).
        if (world.footTraffic) {
          const wIdx = newTileY * world.width + newTileX;
          const heat = (world.footTraffic[wIdx] || 0) + 1;
          world.footTraffic[wIdx] = heat;
          if (heat >= 24 && !world.isRoad(newTileX, newTileY)) {
            world.setRoad(newTileX, newTileY, true);
          }
        }
        
        if (oldTileX !== newTileX || oldTileY !== newTileY) {
          world.removeFromSpatialIndex(oldTileX, oldTileY, this);
          world.addToSpatialIndex(newTileX, newTileY, this);
        }
        
        this.x = newX;
        this.y = newY;
        this.stuckTicks = 0;
      } else {
        // Multi-directional obstacle avoidance
        const candidates = [
          // Perpendicular clockwise
          { x: this.x + (-dy / dist) * step * 0.7, y: this.y + (dx / dist) * step * 0.7 },
          // Perpendicular counter-clockwise
          { x: this.x + (dy / dist) * step * 0.7, y: this.y + (-dx / dist) * step * 0.7 },
          // Inward toward map center
          { x: this.x + Math.sign(world.width / 2 - this.x) * step * 0.6, y: this.y + Math.sign(world.height / 2 - this.y) * step * 0.6 }
        ];
        
        let moved = false;
        for (const cand of candidates) {
          const clampedX = Math.max(1, Math.min(world.width - 1.1, cand.x));
          const clampedY = Math.max(1, Math.min(world.height - 1.1, cand.y));
          const tileX = Math.floor(clampedX);
          const tileY = Math.floor(clampedY);
          
          if (world.isWalkable(tileX, tileY)) {
            const oldTileX = Math.floor(this.x);
            const oldTileY = Math.floor(this.y);
            if (oldTileX !== tileX || oldTileY !== tileY) {
              world.removeFromSpatialIndex(oldTileX, oldTileY, this);
              world.addToSpatialIndex(tileX, tileY, this);
            }
            this.x = clampedX;
            this.y = clampedY;
            moved = true;
            this.stuckTicks = 0;
            break;
          }
        }
        
        if (!moved) {
          this.stuckTicks = (this.stuckTicks || 0) + 1;
          if (this.stuckTicks >= 2) {
            // Cancel stuck path immediately
            this.path = null;
            this.currentAction = null;
            this.stuckTicks = 0;
          }
        }
      }
    } else {
      this.path = null;
    }
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      alive: this.alive,
      age: this.age,
      maxAge: this.maxAge,
      lifeStage: this.lifeStage,
      children: this.children,
      parents: this.parents,
      health: this.health,
      needs: { ...this.needs },
      personality: { ...this.personality },
      skills: { ...this.skills },
      inventory: { ...this.inventory },
      job: this.job,
      jobTitle: this.jobTitle,
      workplace: this.workplace,
      settlementId: this.settlementId,
      // Resume determinism: in-flight decision/movement state must survive save/load,
      // otherwise the first tick after resume re-decides from scratch and diverges.
      currentAction: this.currentAction ?? null,
      goals: Array.isArray(this.goals) ? this.goals.slice() : [],
      path: Array.isArray(this.path) ? this.path.map(p => ({ x: p.x, y: p.y })) : null,
      wanderTicks: this.wanderTicks || 0,
      stuckTicks: this.stuckTicks || 0,
      restCycles: this.restCycles || 0,
      speed: this.speed
    };
  }

  static deserialize(data, idGen, rng = null) {
    // Determinism fix: pass a seeded RNG so restore-time random fields never touch Math.random.
    // Also use a throwaway id generator: the constructor would advance the shared
    // idGen stream during load, desynchronizing future ids vs an uninterrupted run.
    const tempIdGen = { next: () => -1 };
    const agent = new Agent(data.x, data.y, tempIdGen, data.age ?? null, rng || { next: () => 0.5 });
    agent.id = data.id;
    agent.name = data.name || "Villager";
    agent.alive = data.alive !== undefined ? data.alive : true;
    agent.age = data.age || 20;
    agent.maxAge = data.maxAge || 85;
    agent.lifeStage = data.lifeStage || (agent.age < 18 ? "child" : (agent.age >= 60 ? "elder" : "adult"));
    agent.children = data.children || 0;
    agent.parents = data.parents || [];
    agent.health = data.health || 100;
    agent.needs = { ...data.needs };
    agent.personality = { ...data.personality };
    agent.skills = { ...data.skills };
    agent.inventory = { ...data.inventory } || {
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
    agent.workplace = data.workplace || null;
    agent.settlementId = data.settlementId || null;
    // Resume determinism: restore in-flight decision/movement state.
    agent.currentAction = data.currentAction ?? null;
    agent.goals = Array.isArray(data.goals) ? data.goals.slice() : [];
    agent.path = Array.isArray(data.path) ? data.path.map(p => ({ x: p.x, y: p.y })) : null;
    agent.wanderTicks = data.wanderTicks || 0;
    agent.stuckTicks = data.stuckTicks || 0;
    agent.restCycles = data.restCycles || 0;
    if (typeof data.speed === "number") agent.speed = data.speed;
    return agent;
  }
}
