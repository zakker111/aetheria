// Event System - Phase 3: Advanced Simulation
// Random events: natural disasters, plagues, festivals, bountiful harvests, migrations

import { IDGenerator } from "../core/idGen.js";

export class EventSystem {
  constructor(sim = null) {
    this.sim = sim;
    this.eventDefinitions = {
      // Natural Disasters
      'fire': {
        name: 'Wildfire',
        type: 'disaster',
        severity: 'high',
        description: 'A wildfire sweeps through the area!',
        duration: 20,
        effects: {
          damage: 50,
          resourceLoss: { food: 0.5, wood: 0.7 },
          terrainChange: 'burnt'
        },
        probability: 0.02
      },
      'flood': {
        name: 'Flash Flood',
        type: 'disaster',
        severity: 'medium',
        description: 'Heavy rains cause flooding!',
        duration: 15,
        effects: {
          damage: 30,
          resourceLoss: { food: 0.3 },
          terrainChange: 'flooded'
        },
        probability: 0.02
      },
      'drought': {
        name: 'Drought',
        type: 'disaster',
        severity: 'high',
        description: 'A prolonged drought strikes the land!',
        duration: 50,
        effects: {
          waterDecayMultiplier: 2.0,
          foodProductionMultiplier: 0.3,
          resourceLoss: { food: 0.2 }
        },
        probability: 0.015
      },
      'earthquake': {
        name: 'Earthquake',
        type: 'disaster',
        severity: 'high',
        description: 'The ground shakes violently!',
        duration: 5,
        effects: {
          damage: 70,
          buildingDamage: 0.4,
          terrainChange: 'cracked'
        },
        probability: 0.01
      },
      
      // Diseases
      'plague': {
        name: 'Plague Outbreak',
        type: 'disease',
        severity: 'high',
        description: 'A deadly plague spreads through the population!',
        duration: 40,
        effects: {
          infectionRate: 0.15,
          mortalityRate: 0.25,
          productivityMultiplier: 0.5
        },
        probability: 0.01
      },
      'mild_illness': {
        name: 'Seasonal Illness',
        type: 'disease',
        severity: 'low',
        description: 'A mild illness circulates among the people.',
        duration: 15,
        effects: {
          infectionRate: 0.25,
          mortalityRate: 0.02,
          productivityMultiplier: 0.8
        },
        probability: 0.04
      },
      
      // Positive Events
      'bountiful_harvest': {
        name: 'Bountiful Harvest',
        type: 'blessing',
        severity: 'positive',
        description: 'The crops flourish beyond expectation!',
        duration: 30,
        effects: {
          foodProductionMultiplier: 2.5,
          moraleBoost: 20
        },
        probability: 0.03
      },
      'festival': {
        name: 'Cultural Festival',
        type: 'celebration',
        severity: 'positive',
        description: 'The people celebrate with a grand festival!',
        duration: 10,
        effects: {
          socialGainMultiplier: 2.0,
          moraleBoost: 30,
          relationshipBonus: 15
        },
        probability: 0.03
      },
      'migration_wave': {
        name: 'Migrant Wave',
        type: 'opportunity',
        severity: 'positive',
        description: 'New settlers arrive seeking a better life!',
        duration: 1,
        effects: {
          populationIncrease: 5,
          skillDiversity: true
        },
        probability: 0.02
      },
      'resource_discovery': {
        name: 'Resource Discovery',
        type: 'opportunity',
        severity: 'positive',
        description: 'A rich resource vein is discovered!',
        duration: 1,
        effects: {
          spawnResources: ['ore', 'wood'],
          amount: 50
        },
        probability: 0.025
      },
      
      // Neutral/Mixed Events
      'meteor_shower': {
        name: 'Meteor Shower',
        type: 'wonder',
        severity: 'neutral',
        description: 'A spectacular meteor shower lights up the sky!',
        duration: 3,
        effects: {
          moraleBoost: 10,
          rareResourceSpawn: true
        },
        probability: 0.01
      },
      'strange_lights': {
        name: 'Mysterious Lights',
        type: 'mystery',
        severity: 'neutral',
        description: 'Strange lights appear in the night sky...',
        duration: 5,
        effects: {
          curiosity: true,
          beliefShift: 0.1
        },
        probability: 0.015
      }
    };
    
    this.activeEvents = [];
    this.eventHistory = [];
    this.injuredAgents = new Map(); // agentId -> { injury: number, healingRate: number }
    this.infectedAgents = new Map(); // agentId -> { disease: string, stage: number }
    this.moraleModifiers = new Map(); // settlementId -> morale bonus
    
    this.nextEventCheck = 50; // Check for new events every 50 ticks
  }
  
  // Check if a new event should trigger
  checkForNewEvents(tick, agents, settlements, world) {
    if (tick % this.nextEventCheck !== 0) return null;
    
    const roll = world.rng.next();
    const threshold = 0.15; // 15% chance of any event
    
    if (roll > threshold) return null;
    
    // Build weighted event pool based on current state
    const availableEvents = this.getAvailableEvents(agents, settlements, world);
    
    if (availableEvents.length === 0) return null;
    
    // Select random event
    const selected = availableEvents[Math.floor(world.rng.next() * availableEvents.length)];
    
    return this.createEvent(selected, tick);
  }
  
  // Get events that make sense given current state
  getAvailableEvents(agents, settlements, world) {
    const available = [];
    
    // Ensure settlements is an array
    const settlementArray = Array.isArray(settlements) ? settlements : Array.from(settlements || []);
    
    // Context-aware event filtering
    const hasWaterNearby = settlementArray.some(s => {
      if (!s || !s.center) return false;
      const entities = world.getEntitiesAt(Math.floor(s.center.x), Math.floor(s.center.y));
      return entities.some(e => e.type === 'resource' && e.resourceType === 'water');
    });
    
    const highPopulation = agents.filter(a => a.alive).length > 30;
    const lowFood = settlementArray.some(s => {
      if (!s) return false;
      const stats = { food: 0 }; // Would need actual stats
      return stats.food < 20;
    });
    
    for (const [eventId, eventDef] of Object.entries(this.eventDefinitions)) {
      let eligible = true;
      
      // Contextual requirements
      if (eventId === 'flood' && !hasWaterNearby) {
        eligible = false;
      }
      if (eventId === 'plague' && !highPopulation) {
        eligible = false;
      }
      if (eventId === 'drought' && lowFood) {
        eligible = false; // Don't kick agent while down
      }
      
      // Avoid duplicate active events
      if (this.activeEvents.some(e => e.type === eventDef.type)) {
        eligible = false;
      }
      
      if (eligible) {
        available.push({ id: eventId, ...eventDef });
      }
    }
    
    return available;
  }
  
  // Create event instance
  createEvent(eventDef, currentTick = 0) {
    const event = {
      id: `event_${Date.now()}`,
      eventId: eventDef.id,
      name: eventDef.name,
      type: eventDef.type,
      severity: eventDef.severity,
      description: eventDef.description,
      startedAt: Date.now(),
      startedAtTick: currentTick,
      duration: eventDef.duration,
      endsAtTick: currentTick + eventDef.duration,
      effects: { ...eventDef.effects },
      affectedAgents: new Set(),
      affectedSettlements: new Set(),
      completed: false
    };
    
    this.activeEvents.push(event);
    this.eventHistory.push({
      ...event,
      affectedAgents: Array.from(event.affectedAgents),
      affectedSettlements: Array.from(event.affectedSettlements)
    });
    
    // Keep history manageable
    if (this.eventHistory.length > 50) {
      this.eventHistory = this.eventHistory.slice(-50);
    }
    
    return event;
  }
  
  getNextTickFromDuration(durationTicks) {
    // This method is deprecated - use currentTick + duration instead
    return durationTicks;
  }
  
  // Apply event effects to the simulation
  applyEventEffects(event, simulation) {
    const { agents, world } = simulation;
    // Get settlements from settlementSystem if available, otherwise use empty array
    const settlements = simulation.settlementSystem ? 
      Array.from(simulation.settlementSystem.settlements.values()) : [];
    
    switch (event.eventId) {
      case 'fire':
        this.applyFireEffect(event, agents, settlements, world, simulation);
        break;
      case 'flood':
        this.applyFloodEffect(event, agents, settlements, world);
        break;
      case 'drought':
        this.applyDroughtEffect(event, agents, settlements);
        break;
      case 'plague':
      case 'mild_illness':
        this.applyDiseaseEffect(event, agents, world);
        break;
      case 'bountiful_harvest':
        this.applyHarvestEffect(event, settlements);
        break;
      case 'festival':
        this.applyFestivalEffect(event, agents, settlements);
        break;
      case 'migration_wave':
        this.applyMigrationEffect(event, simulation);
        break;
      case 'resource_discovery':
        this.applyResourceDiscoveryEffect(event, world, simulation);
        break;
    }
    
    event.completed = true;
  }
  
  applyFireEffect(event, agents, settlements, world, simulation) {
    // Find agents near fire zone
    const fireZone = {
      x: world.rng.next() * world.width,
      y: world.rng.next() * world.height,
      radius: 15
    };
    
    for (const agent of agents) {
      if (!agent.alive) continue;
      
      const dx = agent.x - fireZone.x;
      const dy = agent.y - fireZone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < fireZone.radius) {
        event.affectedAgents.add(agent.id);
        
        // Chance of injury/death
        const damageRoll = world.rng.next();
        if (damageRoll < 0.1) {
          agent.alive = false; // 10% fatality
        } else if (damageRoll < 0.4) {
          this.injuredAgents.set(agent.id, {
            injury: 50,
            healingRate: 2
          });
        }
        
        // Force flee behavior (keep object shape so consumers reading .type don't crash)
        agent.currentAction = { type: 'flee' };
        agent.fleeTarget = {
          x: fireZone.x + (dx / dist) * 20,
          y: fireZone.y + (dy / dist) * 20
        };
      }
    }
    
    // Destroy resources in area
    const resources = simulation ? simulation.resources : [];
    for (const resource of resources) {
      const dx = resource.x - fireZone.x;
      const dy = resource.y - fireZone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < fireZone.radius && resource.resourceType === 'wood') {
        resource.amount = 0;
      }
    }
  }
  
  applyFloodEffect(event, agents, settlements, world) {
    // Similar to fire but water-based
    const floodZone = {
      x: world.rng.next() * world.width,
      y: world.rng.next() * world.height,
      radius: 12
    };
    
    for (const agent of agents) {
      if (!agent.alive) continue;
      
      const dx = agent.x - floodZone.x;
      const dy = agent.y - floodZone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < floodZone.radius) {
        event.affectedAgents.add(agent.id);
        
        if (world.rng.next() < 0.05) {
          agent.alive = false;
        } else if (world.rng.next() < 0.3) {
          this.injuredAgents.set(agent.id, {
            injury: 30,
            healingRate: 3
          });
        }
      }
    }
    
    // Reduce food stores
    for (const settlement of settlements) {
      if (this.isSettlementInZone(settlement, floodZone)) {
        event.affectedSettlements.add(settlement.id);
        // Food loss handled by effect multipliers
      }
    }
  }
  
  applyDroughtEffect(event, agents, settlements) {
    // Affects all settlements globally
    for (const settlement of settlements) {
      event.affectedSettlements.add(settlement.id);
    }
    
    // Increase water need decay for all agents
    for (const agent of agents) {
      if (agent.alive) {
        event.affectedAgents.add(agent.id);
      }
    }
  }
  
  applyDiseaseEffect(event, agents, world) {
    const infectionRate = event.effects.infectionRate;
    
    for (const agent of agents) {
      if (!agent.alive || this.infectedAgents.has(agent.id)) continue;
      
      if (world.rng.next() < infectionRate) {
        event.affectedAgents.add(agent.id);
        this.infectedAgents.set(agent.id, {
          disease: event.eventId,
          stage: 0,
          duration: event.duration
        });
      }
    }
  }
  
  applyHarvestEffect(event, settlements) {
    for (const settlement of settlements) {
      event.affectedSettlements.add(settlement.id);
      // Production multiplier applied in economy system
    }
  }
  
  applyFestivalEffect(event, agents, settlements) {
    for (const settlement of settlements) {
      event.affectedSettlements.add(settlement.id);
      
      // Boost relationships in settlement
      const settlementAgents = agents.filter(a => 
        a.alive && Math.abs(a.x - settlement.center.x) < 20 && Math.abs(a.y - settlement.center.y) < 20
      );
      
      for (const agent of settlementAgents) {
        event.affectedAgents.add(agent.id);
      }
    }
  }
  
  applyMigrationEffect(event, simulation) {
    // Spawn new agents at edge of map
    const { agents, world, idGen } = simulation;
    
    const migrantCount = event.effects.populationIncrease;
    
    for (let i = 0; i < migrantCount; i++) {
      const angle = world.rng.next() * Math.PI * 2;
      const distance = Math.min(world.width, world.height) * 0.4;
      const x = world.width / 2 + Math.cos(angle) * distance;
      const y = world.height / 2 + Math.sin(angle) * distance;
      
      if (world.isWalkable(Math.floor(x), Math.floor(y))) {
        const migrant = simulation.spawnAgent(x, y);
        // Give migrants varied skills
        migrant.skills.gather = 1 + world.rng.next() * 2;
        migrant.skills.build = 1 + world.rng.next() * 2;
        migrant.skills.social = 1 + world.rng.next() * 2;
        event.affectedAgents.add(migrant.id);
      }
    }
  }
  
  applyResourceDiscoveryEffect(event, world, simulation) {
    const resources = event.effects.spawnResources;
    const amount = event.effects.amount;
    
    for (const resourceType of resources) {
      const x = world.rng.next() * world.width;
      const y = world.rng.next() * world.height;
      
      if (world.isWalkable(Math.floor(x), Math.floor(y))) {
        simulation.createResource(x, y, resourceType, amount);
      }
    }
  }
  
  isSettlementInZone(settlement, zone) {
    const dx = settlement.center.x - zone.x;
    const dy = settlement.center.y - zone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < zone.radius + 10;
  }
  
  // Update ongoing event effects each tick
  updateActiveEvents(tick, simulation) {
    const { agents } = simulation;
    
    // Process injuries
    for (const [agentId, injuryData] of this.injuredAgents) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent || !agent.alive) {
        this.injuredAgents.delete(agentId);
        continue;
      }
      
      // Heal over time
      injuryData.injury -= injuryData.healingRate;
      
      // Injury affects productivity
      if (injuryData.injury > 0) {
        agent.productivityMultiplier = Math.max(0.2, 1 - (injuryData.injury / 100));
      } else {
        this.injuredAgents.delete(agentId);
        agent.productivityMultiplier = 1.0;
      }
    }
    
    // Process diseases
    for (const [agentId, diseaseData] of this.infectedAgents) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent || !agent.alive) {
        this.infectedAgents.delete(agentId);
        continue;
      }
      
      diseaseData.stage++;
      
      // Mortality check
      const event = this.activeEvents.find(e => e.eventId === diseaseData.disease);
      if (event && world.rng.next() < event.effects.mortalityRate / event.duration) {
        agent.alive = false;
        this.infectedAgents.delete(agentId);
        continue;
      }
      
      // Productivity penalty
      agent.productivityMultiplier = Math.max(0.3, event?.effects.productivityMultiplier || 0.5);
      
      // Recovery
      if (diseaseData.stage >= diseaseData.duration) {
        this.infectedAgents.delete(agentId);
        agent.productivityMultiplier = 1.0;
      }
    }
    
    // Remove completed events
    this.activeEvents = this.activeEvents.filter(event => {
      if (tick >= event.endsAtTick) {
        this.resolveEvent(event, simulation);
        return false;
      }
      return true;
    });
  }
  
  resolveEvent(event, simulation) {
    // Clean up temporary effects
    if (simulation && simulation.agents) {
      for (const agentId of event.affectedAgents) {
        const agent = simulation.agents.find(a => a.id === agentId);
        if (agent) {
          agent.productivityMultiplier = 1.0;
          agent.currentAction = null;
          agent.fleeTarget = null;
        }
      }
    }
    
    // Clear morale modifiers
    for (const settlementId of event.affectedSettlements) {
      this.moraleModifiers.delete(settlementId);
    }
  }
  
  // Get event status for UI
  getEventStatus() {
    return {
      active: this.activeEvents.map(e => ({
        name: e.name,
        type: e.type,
        severity: e.severity,
        description: e.description,
        progress: 1 - ((e.endsAtTick - Date.now()) / (e.duration * 1000))
      })),
      recent: this.eventHistory.slice(-10).map(e => ({
        name: e.name,
        type: e.type,
        occurredAt: e.startedAt
      }))
    };
  }
  
  serialize() {
    return {
      activeEvents: this.activeEvents.map(e => ({
        ...e,
        affectedAgents: Array.from(e.affectedAgents),
        affectedSettlements: Array.from(e.affectedSettlements)
      })),
      eventHistory: this.eventHistory,
      injuredAgents: Array.from(this.injuredAgents.entries()),
      infectedAgents: Array.from(this.infectedAgents.entries()),
      moraleModifiers: Array.from(this.moraleModifiers.entries())
    };
  }
  
  static deserialize(data) {
    const system = new EventSystem();
    
    system.activeEvents = data.activeEvents.map(e => ({
      ...e,
      affectedAgents: new Set(e.affectedAgents),
      affectedSettlements: new Set(e.affectedSettlements)
    }));
    
    system.eventHistory = data.eventHistory || [];
    system.injuredAgents = new Map(data.injuredAgents || []);
    system.infectedAgents = new Map(data.infectedAgents || []);
    system.moraleModifiers = new Map(data.moraleModifiers || []);
    
    return system;
  }
}
