// Agent with needs, perception, and decision-making (doc 02/03A: component-based agents)
import { IDGenerator } from "../core/idGen.js";

export class Agent {
  constructor(x, y, idGen) {
    this.id = idGen.next();
    this.type = "agent";
    this.x = x;
    this.y = y;
    this.alive = true;
    
    // Components (doc 02: avoid giant NPC class, use components)
    this.needs = {
      food: 100,
      water: 100,
      rest: 100,
      social: 50,
      safety: 100
    };
    
    this.personality = {
      industrious: Math.random() * 0.5 + 0.5,
      social: Math.random(),
      brave: Math.random(),
      curious: Math.random()
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
      wheat: 0,
      flour: 0,
      tool_handle: 0,
      pickaxe: 0,
      bread: 0,
      capacity: 10
    };
    
    this.memory = [];
    this.relationships = new Map();
    this.currentAction = null;
    this.goals = [];
    
    // Lifecycle
    this.age = 0;
    this.maxAge = 80 + Math.floor(Math.random() * 40); // 80-120 days
    this.children = 0;
    
    // Movement
    this.speed = 1;
    this.path = null;
    
    // Job and workplace
    this.job = null;
    this.workplace = null;
  }

  // Update needs over time (doc 03A: update urgent needs)
  updateNeeds() {
    this.needs.food = Math.max(0, this.needs.food - 0.08);
    this.needs.water = Math.max(0, this.needs.water - 0.1);
    this.needs.rest = Math.max(0, this.needs.rest - 0.04);
    this.needs.social = Math.max(0, this.needs.social - 0.02);
    
    // Aging
    this.age += 0.001; // Age increases slowly
    
    // Death from starvation/dehydration or old age
    if (this.needs.food <= 0 || this.needs.water <= 0) {
      this.alive = false;
    }
    if (this.age >= this.maxAge) {
      this.alive = false;
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
    
    // Larger perception radius for better resource finding
    const radius = 25;
    
    // Use spatial index for efficient lookup instead of iterating all entities
    const nearby = world.getEntitiesNear(Math.floor(this.x), Math.floor(this.y), Math.ceil(radius));
    
    for (const entity of nearby) {
      if (entity.id === this.id) continue;
      
      const dx = entity.x - this.x;
      const dy = entity.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius) {
        if (entity.type === "agent") {
          perception.nearbyAgents.push(entity);
        } else if (entity.type === "resource") {
          perception.nearbyResources.push(entity);
        } else if (entity.type === "building") {
          perception.nearbyBuildings.push(entity);
        }
      }
    }
    
    return perception;
  }

  // Generate goals based on needs (doc 03A: select or refresh goals)
  generateGoals() {
    this.goals = [];
    
    // If agent has a job, prioritize work goals
    if (this.job === 'craftsman' && this.workplace) {
      this.goals.push({ type: "go_to_work", priority: 80 });
    }
    
    // Urgent needs generate high-priority goals
    if (this.needs.food < 40) {
      // Check if we have food in inventory
      if (this.inventory.bread > 0 || this.inventory.wheat > 0) {
        this.goals.push({ type: "eat_from_inventory", priority: 100 - this.needs.food });
      } else {
        this.goals.push({ type: "find_food", priority: 100 - this.needs.food });
      }
    }
    if (this.needs.water < 40) {
      this.goals.push({ type: "find_water", priority: 100 - this.needs.water });
    }
    if (this.needs.rest < 30) {
      this.goals.push({ type: "rest", priority: 80 - this.needs.rest });
    }
    
    // Social goal - important for reproduction
    if (this.needs.social < 50 && this.personality.social > 0.3) {
      this.goals.push({ type: "socialize", priority: 50 });
    }
    
    // Reproduction goal (adults with good needs can reproduce)
    if (this.age > 20 && this.age < this.maxAge - 20 && 
        this.needs.food > 70 && this.needs.water > 70 && 
        this.needs.social > 60 && this.children < 5) {
      this.goals.push({ type: "reproduce", priority: 40 });
    }
    
    // Default goal: wander/explore
    if (this.goals.length === 0) {
      this.goals.push({ type: "explore", priority: 10 });
    }
    
    // Sort by priority
    this.goals.sort((a, b) => b.priority - a.priority);
  }

  // Generate possible actions for current goals (doc 03A: generate legal actions)
  generateActions(perception) {
    const actions = [];
    
    for (const goal of this.goals) {
      switch (goal.type) {
        case "go_to_work":
          // Go to workplace
          if (this.workplace) {
            actions.push({
              type: "go_to_workplace",
              workplaceId: this.workplace,
              score: goal.priority
            });
          }
          break;
          
        case "eat_from_inventory":
          actions.push({
            type: "eat_from_inventory",
            score: goal.priority
          });
          break;
          
        case "find_food":
          // Find nearby food resources
          for (const resource of perception.nearbyResources) {
            if (resource.resourceType === "food" && resource.amount > 0) {
              actions.push({
                type: "gather_food",
                target: resource,
                score: goal.priority + (10 - this.distanceTo(resource))
              });
            }
          }
          break;
          
        case "find_water":
          for (const resource of perception.nearbyResources) {
            if (resource.resourceType === "water") {
              actions.push({
                type: "drink_water",
                target: resource,
                score: goal.priority + (10 - this.distanceTo(resource))
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
          
        case "socialize":
          for (const agent of perception.nearbyAgents) {
            if (agent.alive && agent !== this) {
              actions.push({
                type: "socialize",
                target: agent,
                score: goal.priority * this.personality.social
              });
            }
          }
          break;
          
        case "reproduce":
          // Find a suitable mate
          for (const agent of perception.nearbyAgents) {
            if (agent.alive && agent !== this && 
                agent.age > 20 && agent.age < agent.maxAge - 20 &&
                agent.needs.food > 60 && agent.needs.water > 60) {
              actions.push({
                type: "reproduce",
                target: agent,
                score: goal.priority * (this.personality.social + 0.5)
              });
            }
          }
          break;
          
        case "explore":
          actions.push({
            type: "wander",
            score: goal.priority * this.personality.curious
          });
          break;
      }
    }
    
    return actions;
  }

  // Choose best action (doc 03A: score actions using needs, personality, skills, distance)
  chooseAction(actions) {
    if (actions.length === 0) return null;
    
    // Sort by score and pick best
    actions.sort((a, b) => b.score - a.score);
    return actions[0];
  }

  distanceTo(entity) {
    const dx = entity.x - this.x;
    const dy = entity.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Execute action for one tick (doc 03A: execute only the amount of work possible this step)
  executeAction(action, world, eventBus, craftingSystem) {
    if (!action) return null;
    
    this.currentAction = action;
    
    switch (action.type) {
      case "go_to_workplace":
        // Find workshop and move to it
        const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
        if (workshop) {
          const workshopEntity = { x: workshop.x + 1, y: workshop.y + 1 }; // Center of workshop
          if (this.distanceTo(workshopEntity) < 2) {
            // Arrived at workplace - start working
            this.currentAction = null;
          } else {
            this.moveToward(workshopEntity, world);
          }
        }
        break;
        
      case "eat_from_inventory":
        // Eat food from inventory
        if (this.inventory.bread > 0) {
          this.inventory.bread--;
          this.needs.food = Math.min(100, this.needs.food + 40);
          this.currentAction = null;
        } else if (this.inventory.wheat > 0) {
          this.inventory.wheat--;
          this.needs.food = Math.min(100, this.needs.food + 15);
          this.currentAction = null;
        }
        break;
        
      case "gather_food":
        if (this.distanceTo(action.target) < 1.5) {
          // Gather food - add to inventory if space available
          const totalItems = Object.values(this.inventory).reduce((a, b) => typeof b === 'number' ? a + b : a, 0);
          if (totalItems < this.inventory.capacity) {
            action.target.amount -= 1;
            this.inventory.wheat = (this.inventory.wheat || 0) + 1;
            this.needs.food = Math.min(100, this.needs.food + 30);
            eventBus.emit("RESOURCE_GATHERED", { 
              agentId: this.id, 
              resourceType: "wheat",
              x: action.target.x,
              y: action.target.y
            });
          }
          this.currentAction = null;
        } else {
          // Move toward target
          this.moveToward(action.target, world);
        }
        break;
        
      case "drink_water":
        if (this.distanceTo(action.target) < 1.5) {
          this.needs.water = Math.min(100, this.needs.water + 40);
          eventBus.emit("RESOURCE_CONSUMED", { 
            agentId: this.id, 
            resourceType: "water"
          });
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
        
      case "rest":
        this.needs.rest = Math.min(100, this.needs.rest + 5);
        if (this.needs.rest > 80) {
          this.currentAction = null;
        }
        break;
        
      case "socialize":
        if (this.distanceTo(action.target) < 2) {
          this.needs.social = Math.min(100, this.needs.social + 10);
          action.target.needs.social = Math.min(100, action.target.needs.social + 10);
          
          // Build relationship
          const relKey = `${action.target.id}`;
          const currentRel = this.relationships.get(relKey) || 0;
          this.relationships.set(relKey, Math.min(100, currentRel + 5));
          
          eventBus.emit("RELATIONSHIP_CHANGED", {
            agentId1: this.id,
            agentId2: action.target.id,
            change: 5
          });
          this.currentAction = null;
        } else {
          this.moveToward(action.target, world);
        }
        break;
        
      case "reproduce":
        if (this.distanceTo(action.target) < 2) {
          // Successfully reproduce!
          this.needs.social = Math.min(100, this.needs.social + 20);
          this.needs.food = Math.max(0, this.needs.food - 15);
          this.needs.water = Math.max(0, this.needs.water - 15);
          this.children++;
          
          action.target.children++;
          action.target.needs.social = Math.min(100, action.target.needs.social + 20);
          
          // Create baby agent nearby
          const babyX = this.x + (Math.random() - 0.5) * 3;
          const babyY = this.y + (Math.random() - 0.5) * 3;
          
          eventBus.emit("AGENT_BORN", {
            parentId1: this.id,
            parentId2: action.target.id,
            x: babyX,
            y: babyY
          });
          
          this.currentAction = null;
          return { type: "birth", x: babyX, y: babyY };
        } else {
          this.moveToward(action.target, world);
        }
        break;
        
      case "wander":
        // Random movement
        if (!this.path || this.path.length === 0) {
          const dx = Math.floor(Math.random() * 10) - 5;
          const dy = Math.floor(Math.random() * 10) - 5;
          this.path = [{ x: this.x + dx, y: this.y + dy }];
        }
        if (this.path.length > 0) {
          this.moveToward(this.path[0], world);
          if (this.distanceTo(this.path[0]) < 1) {
            this.path = null;
            this.currentAction = null;
          }
        }
        break;
    }
    
    return null;
  }

  moveToward(target, world) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0.1) {
      // Increase speed based on urgency of needs
      let effectiveSpeed = this.speed;
      if (this.needs.food < 30 || this.needs.water < 30) {
        effectiveSpeed = this.speed * 1.5; // Move faster when desperate
      }
      
      const newX = this.x + (dx / dist) * effectiveSpeed;
      const newY = this.y + (dy / dist) * effectiveSpeed;
      
      // Check if walkable
      const newTileX = Math.floor(newX);
      const newTileY = Math.floor(newY);
      
      if (world.isWalkable(newTileX, newTileY)) {
        // Only update spatial index if we actually moved to a different tile
        const oldTileX = Math.floor(this.x);
        const oldTileY = Math.floor(this.y);
        
        if (oldTileX !== newTileX || oldTileY !== newTileY) {
          world.removeFromSpatialIndex(oldTileX, oldTileY, this);
          world.addToSpatialIndex(newTileX, newTileY, this);
        }
        
        this.x = newX;
        this.y = newY;
      } else {
        // Try to find alternative path - move perpendicular
        const altX = this.x + (-dy / dist) * effectiveSpeed * 0.5;
        const altY = this.y + (dx / dist) * effectiveSpeed * 0.5;
        const altTileX = Math.floor(altX);
        const altTileY = Math.floor(altY);
        
        if (world.isWalkable(altTileX, altTileY)) {
          world.removeFromSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
          this.x = altX;
          this.y = altY;
          world.addToSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
        }
      }
    }
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      alive: this.alive,
      age: this.age,
      maxAge: this.maxAge,
      children: this.children,
      needs: { ...this.needs },
      personality: { ...this.personality },
      skills: { ...this.skills },
      inventory: { ...this.inventory },
      job: this.job,
      workplace: this.workplace
    };
  }

  static deserialize(data, idGen) {
    const agent = new Agent(data.x, data.y, idGen);
    agent.id = data.id;
    agent.alive = data.alive;
    agent.age = data.age || 0;
    agent.maxAge = data.maxAge || (80 + Math.floor(Math.random() * 40));
    agent.children = data.children || 0;
    agent.needs = { ...data.needs };
    agent.personality = { ...data.personality };
    agent.skills = { ...data.skills };
    agent.inventory = { ...data.inventory } || {
      wood_log: 0,
      wood_plank: 0,
      ore_iron: 0,
      iron_ingot: 0,
      wheat: 0,
      flour: 0,
      tool_handle: 0,
      pickaxe: 0,
      bread: 0,
      capacity: 10
    };
    agent.job = data.job || null;
    agent.workplace = data.workplace || null;
    return agent;
  }
}
