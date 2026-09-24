// Agent with needs, perception, and decision-making (doc 02/03A: component-based agents)
import { IDGenerator } from "../core/idGen.js";

const FIRST_NAMES = [
  "Aeron", "Bryn", "Caelen", "Darian", "Elowen", "Faelan", "Garrick", "Isolde", 
  "Kael", "Lyra", "Maren", "Niall", "Oren", "Rowan", "Seren", "Taran", "Valen", 
  "Wynne", "Zephyr", "Althea", "Corin", "Daphne", "Elidor", "Fiona", "Gareth",
  "Hadrian", "Iris", "Jorah", "Kendra", "Lorcan", "Mira", "Nesta", "Osric"
];

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
      safety: 100
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
  }

  // Perceive nearby entities (doc 03A: perceive nearby people, resources, structures)
  perceive(world, entities) {
    const perception = {
      nearbyAgents: [],
      nearbyResources: [],
      nearbyBuildings: [],
      dangers: [],
      opportunities: []
    };
    
    const radius = 22;
    // Perf guard: cap perception fan-out so dense settlements never freeze
    // the tick loop (unbounded neighbor scans were the main soak-test hazard).
    const MAX_NEARBY_AGENTS = 12;
    const MAX_NEARBY_RESOURCES = 8;
    const MAX_NEARBY_BUILDINGS = 6;
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
        }
      }
    }
    
    return perception;
  }

  // Generate goals based on needs, jobs, reproduction, building, and community
  generateGoals(simulation) {
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
    
    // 3. Construction & Civic Works: high priority for builders or settlements with pending buildings!
    const job = this.job;
    const isBuilder = job === 'builder';
    let hasPendingConstruction = false;
    
    if (simulation && simulation.buildings) {
      const homeSid = this.settlementId ||
        (simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(this.id) : null);
      for (const b of simulation.buildings) {
        if (!b.complete && (b.constructionProgress || 0) < 100) {
          const sid = b.settlementId ?? null;
          if (sid == null || sid === homeSid) { hasPendingConstruction = true; break; }
          // foreign site: only counts as civic work if friendly (not at war)
          if (homeSid != null && simulation.diplomacySystem) {
            try {
              const rel = simulation.diplomacySystem.getRelation(homeSid, sid);
              if (rel && rel.status !== 'war' && rel.score >= 40) { hasPendingConstruction = true; break; }
            } catch { /* ignore */ }
          }
        }
      }
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
    
    // 6. Social Interaction & Community Bonding
    if (this.needs.social < 80) {
      this.goals.push({ type: "socialize", priority: 50 });
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
      }
    }
    
    // 8. Proactive foraging if inventory has space
    const totalItems = Object.values(this.inventory).reduce((a, b) => typeof b === 'number' ? a + b : a, 0);
    if (totalItems < this.inventory.capacity) {
      this.goals.push({ type: "forage_nearby", priority: 35 });
    }
    
    // Default fallback goal: explore
    if (this.goals.length === 0) {
      this.goals.push({ type: "explore", priority: 10 });
    }
    
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
          
        case "return_to_settlement":
          if (goal.target) {
            actions.push({
              type: "return_home",
              target: goal.target,
              score: goal.priority
            });
          }
          break;

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
  moveToward(target, world) {
    if (!target) return;
    
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0.1) {
      let effectiveSpeed = this.speed;
      // Elder agents move slightly slower, urgent needs move faster
      if (this.lifeStage === "elder") {
        effectiveSpeed *= 0.75;
      }
      if (this.needs.food < 30 || this.needs.water < 30) {
        effectiveSpeed *= 1.35;
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
    if (typeof data.speed === "number") agent.speed = data.speed;
    return agent;
  }
}
