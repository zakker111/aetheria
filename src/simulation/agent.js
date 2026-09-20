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
      farm: 1.0
    };
    
    this.memory = [];
    this.relationships = new Map();
    this.currentAction = null;
    this.goals = [];
    
    // Movement
    this.speed = 1;
    this.path = null;
  }

  // Update needs over time (doc 03A: update urgent needs)
  updateNeeds() {
    this.needs.food = Math.max(0, this.needs.food - 0.1);
    this.needs.water = Math.max(0, this.needs.water - 0.12);
    this.needs.rest = Math.max(0, this.needs.rest - 0.05);
    this.needs.social = Math.max(0, this.needs.social - 0.02);
    
    // Death from starvation/dehydration
    if (this.needs.food <= 0 || this.needs.water <= 0) {
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
    
    const radius = 10;
    for (const entity of entities) {
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
    
    // Urgent needs generate high-priority goals
    if (this.needs.food < 30) {
      this.goals.push({ type: "find_food", priority: 100 - this.needs.food });
    }
    if (this.needs.water < 30) {
      this.goals.push({ type: "find_water", priority: 100 - this.needs.water });
    }
    if (this.needs.rest < 20) {
      this.goals.push({ type: "rest", priority: 80 - this.needs.rest });
    }
    
    // Lower priority goals
    if (this.needs.social < 40) {
      this.goals.push({ type: "socialize", priority: 50 });
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
            if (agent.alive) {
              actions.push({
                type: "socialize",
                target: agent,
                score: goal.priority * this.personality.social
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
  executeAction(action, world, eventBus) {
    if (!action) return;
    
    this.currentAction = action;
    
    switch (action.type) {
      case "gather_food":
        if (this.distanceTo(action.target) < 1.5) {
          // Gather food
          action.target.amount -= 1;
          this.needs.food = Math.min(100, this.needs.food + 30);
          eventBus.emit("RESOURCE_GATHERED", { 
            agentId: this.id, 
            resourceType: "food",
            x: action.target.x,
            y: action.target.y
          });
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
          eventBus.emit("RELATIONSHIP_CHANGED", {
            agentId1: this.id,
            agentId2: action.target.id,
            change: 1
          });
          this.currentAction = null;
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
  }

  moveToward(target, world) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0.1) {
      const newX = this.x + (dx / dist) * this.speed;
      const newY = this.y + (dy / dist) * this.speed;
      
      // Check if walkable
      if (world.isWalkable(Math.floor(newX), Math.floor(newY))) {
        world.removeFromSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
        this.x = newX;
        this.y = newY;
        world.addToSpatialIndex(Math.floor(this.x), Math.floor(this.y), this);
      }
    }
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      alive: this.alive,
      needs: { ...this.needs },
      personality: { ...this.personality },
      skills: { ...this.skills }
    };
  }

  static deserialize(data, idGen) {
    const agent = new Agent(data.x, data.y, idGen);
    agent.id = data.id;
    agent.alive = data.alive;
    agent.needs = { ...data.needs };
    agent.personality = { ...data.personality };
    agent.skills = { ...data.skills };
    return agent;
  }
}
