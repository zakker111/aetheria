// Relationship System - Phase 2: Emergent Society
// Tracks relationships, family trees, and social bonds between agents

import { IDGenerator } from "../core/idGen.js";

export class RelationshipSystem {
  constructor(sim = null) {
    this.sim = sim;
    // Map of agentId -> Map of otherAgentId -> Relationship data
    this.relationships = new Map();
    
    // Family tracking
    this.familyTrees = new Map(); // agentId -> { parents: [], children: [], spouse: null }
    
    // Reputation system (global standing)
    this.reputations = new Map(); // agentId -> reputation score
    
    // Marriage records
    this.marriages = new Map(); // coupleKey -> marriage data
  }
  
  // Initialize relationship tracking for a new agent
  initializeAgent(agentId) {
    if (!this.relationships.has(agentId)) {
      this.relationships.set(agentId, new Map());
    }
    if (!this.familyTrees.has(agentId)) {
      this.familyTrees.set(agentId, {
        parents: [],
        children: [],
        spouse: null,
        siblings: []
      });
    }
    if (!this.reputations.has(agentId)) {
      this.reputations.set(agentId, 50); // Neutral starting reputation
    }
  }
  
  // Get relationship between two agents
  getRelationship(agentId1, agentId2) {
    const relMap = this.relationships.get(agentId1);
    if (!relMap) return null;
    return relMap.get(agentId2) || null;
  }
  
  // Set or update relationship
  setRelationship(agentId1, agentId2, data) {
    if (!this.relationships.has(agentId1)) {
      this.relationships.set(agentId1, new Map());
    }
    const relMap = this.relationships.get(agentId1);
    
    const existing = relMap.get(agentId2) || {
      friendship: 0,
      rivalry: 0,
      romance: 0,
      trust: 50,
      interactions: 0,
      lastInteraction: 0,
      memories: []
    };
    
    relMap.set(agentId2, { ...existing, ...data });
  }
  
  // Modify relationship values
  modifyRelationship(agentId1, agentId2, changes) {
    const current = this.getRelationship(agentId1, agentId2) || {};
    const updated = { ...current };
    
    if (changes.friendship !== undefined) {
      updated.friendship = Math.max(-100, Math.min(100, (updated.friendship || 0) + changes.friendship));
    }
    if (changes.rivalry !== undefined) {
      updated.rivalry = Math.max(-100, Math.min(100, (updated.rivalry || 0) + changes.rivalry));
    }
    if (changes.romance !== undefined) {
      updated.romance = Math.max(-100, Math.min(100, (updated.romance || 0) + changes.romance));
    }
    if (changes.trust !== undefined) {
      updated.trust = Math.max(0, Math.min(100, (updated.trust || 50) + changes.trust));
    }
    
    updated.interactions = (updated.interactions || 0) + 1;
    updated.lastInteraction = this.sim?.clock?.tick ?? Date.now(); // deterministic sim ticks
    
    this.setRelationship(agentId1, agentId2, updated);
    
    // Reciprocal relationship (weaker effect) - only if not already familial
    if (!updated.familial && changes.friendship !== undefined) {
      const reciprocalChanges = {
        friendship: changes.friendship * 0.7,
        trust: changes.trust ? changes.trust * 0.6 : 0
      };
      const existingRecip = this.getRelationship(agentId2, agentId1);
      if (!existingRecip || !existingRecip.familial) {
        this.modifyRelationshipDirect(agentId2, agentId1, reciprocalChanges);
      }
    }
    
    return updated;
  }
  
  // Direct modification without reciprocal (to prevent infinite recursion)
  modifyRelationshipDirect(agentId1, agentId2, changes) {
    const current = this.getRelationship(agentId1, agentId2) || {};
    const updated = { ...current };

    if (changes.friendship !== undefined) {
      updated.friendship = Math.max(-100, Math.min(100, (updated.friendship || 0) + changes.friendship));
    }
    if (changes.rivalry !== undefined) {
      updated.rivalry = Math.max(-100, Math.min(100, (updated.rivalry || 0) + changes.rivalry));
    }
    if (changes.romance !== undefined) {
      updated.romance = Math.max(-100, Math.min(100, (updated.romance || 0) + changes.romance));
    }
    if (changes.trust !== undefined) {
      updated.trust = Math.max(0, Math.min(100, (updated.trust || 50) + changes.trust));
    }
    
    updated.interactions = (updated.interactions || 0) + 1;
    updated.lastInteraction = this.sim?.clock?.tick ?? Date.now(); // deterministic sim ticks
    
    this.setRelationship(agentId1, agentId2, updated);
    return updated;
  }
  
  // Record a memory between agents
  addMemory(agentId1, agentId2, memory) {
    const rel = this.getRelationship(agentId1, agentId2);
    if (rel) {
      if (!rel.memories) rel.memories = [];
      rel.memories.push({
        type: memory.type, // 'positive', 'negative', 'neutral', 'traumatic'
        description: memory.description,
        timestamp: this.sim?.clock?.tick ?? Date.now(),
        impact: memory.impact // -10 to +10
      });
      
      // Keep only last 20 memories
      if (rel.memories.length > 20) {
        rel.memories = rel.memories.slice(-20);
      }
      
      // Apply memory impact to friendship
      this.modifyRelationship(agentId1, agentId2, {
        friendship: memory.impact
      });
    }
  }
  
  // Parent-child relationship
  addParentChild(parentId, childId) {
    const parentFamily = this.familyTrees.get(parentId);
    const childFamily = this.familyTrees.get(childId);
    
    if (parentFamily && !parentFamily.children.includes(childId)) {
      parentFamily.children.push(childId);
    }
    
    if (childFamily && !childFamily.parents.includes(parentId)) {
      childFamily.parents.push(parentId);
    }
    
    // Strong initial bond
    this.setRelationship(parentId, childId, {
      friendship: 50,
      trust: 80,
      interactions: 0,
      memories: [],
      familial: true,
      relationType: 'parent'
    });
    
    this.setRelationship(childId, parentId, {
      friendship: 50,
      trust: 80,
      interactions: 0,
      memories: [],
      familial: true,
      relationType: 'child'
    });
  }
  
  // Marriage system
  marry(agentId1, agentId2) {
    const coupleKey = this.getCoupleKey(agentId1, agentId2);
    
    if (this.marriages.has(coupleKey)) {
      return false; // Already married
    }
    
    // Check if either is already married
    const family1 = this.familyTrees.get(agentId1);
    const family2 = this.familyTrees.get(agentId2);
    
    if ((family1 && family1.spouse) || (family2 && family2.spouse)) {
      return false; // Already married to someone else
    }
    
    // Create marriage record
    this.marriages.set(coupleKey, {
      partners: [agentId1, agentId2],
      marriedAt: this.sim?.clock?.tick ?? Date.now(),
      children: [],
      status: 'married'
    });
    
    // Update family trees
    if (family1) family1.spouse = agentId2;
    if (family2) family2.spouse = agentId1;
    
    // Set strong romantic relationship
    this.setRelationship(agentId1, agentId2, {
      friendship: 60,
      romance: 80,
      trust: 75,
      interactions: 0,
      memories: [],
      familial: true,
      relationType: 'spouse'
    });
    
    this.setRelationship(agentId2, agentId1, {
      friendship: 60,
      romance: 80,
      trust: 75,
      interactions: 0,
      memories: [],
      familial: true,
      relationType: 'spouse'
    });
    
    return true;
  }
  
  // Divorce
  divorce(agentId1, agentId2) {
    const coupleKey = this.getCoupleKey(agentId1, agentId2);
    const marriage = this.marriages.get(coupleKey);
    
    if (!marriage) return false;
    
    marriage.status = 'divorced';
    marriage.divorcedAt = Date.now();
    
    const family1 = this.familyTrees.get(agentId1);
    const family2 = this.familyTrees.get(agentId2);
    
    if (family1) family1.spouse = null;
    if (family2) family2.spouse = null;
    
    // Negative relationship impact
    this.modifyRelationship(agentId1, agentId2, {
      friendship: -30,
      romance: -80,
      trust: -40
    });
    
    return true;
  }
  
  // Add child to marriage
  addChildToMarriage(parentId1, parentId2, childId) {
    const coupleKey = this.getCoupleKey(parentId1, parentId2);
    const marriage = this.marriages.get(coupleKey);
    
    if (marriage && !marriage.children.includes(childId)) {
      marriage.children.push(childId);
    }
    
    // Add sibling relationships if there are existing children
    const family1 = this.familyTrees.get(parentId1);
    if (family1) {
      for (const existingChild of family1.children) {
        if (existingChild !== childId) {
          this.addSiblingRelationship(existingChild, childId);
        }
      }
    }
  }
  
  // Sibling relationships
  addSiblingRelationship(agentId1, agentId2) {
    const family1 = this.familyTrees.get(agentId1);
    const family2 = this.familyTrees.get(agentId2);
    
    if (family1 && !family1.siblings.includes(agentId2)) {
      family1.siblings.push(agentId2);
    }
    if (family2 && !family2.siblings.includes(agentId1)) {
      family2.siblings.push(agentId1);
    }
    
    // Moderate initial bond
    const currentRel = this.getRelationship(agentId1, agentId2);
    if (!currentRel || !currentRel.familial) {
      this.setRelationship(agentId1, agentId2, {
        friendship: 40,
        trust: 70,
        interactions: 0,
        memories: [],
        familial: true,
        relationType: 'sibling'
      });
    }
  }
  
  // Get all relatives of an agent
  getRelatives(agentId) {
    const family = this.familyTrees.get(agentId);
    if (!family) return { parents: [], children: [], siblings: [], spouse: null };
    
    return {
      parents: family.parents,
      children: family.children,
      siblings: family.siblings,
      spouse: family.spouse
    };
  }
  
  // Calculate compatibility between agents for romance/friendship
  calculateCompatibility(agent1, agent2) {
    let compatibility = 50; // Base
    
    // Personality similarities
    const personalityTraits = ['industrious', 'social', 'brave', 'curious'];
    for (const trait of personalityTraits) {
      const diff = Math.abs(agent1.personality[trait] - agent2.personality[trait]);
      compatibility += (1 - diff) * 10; // Similar traits = +compatibility
    }
    
    // Existing relationship bonus
    const rel = this.getRelationship(agent1.id, agent2.id);
    if (rel) {
      compatibility += rel.friendship * 0.3;
      compatibility += rel.romance * 0.4;
      compatibility -= rel.rivalry * 0.5;
    }
    
    // Family penalty (incest taboo - reduced attraction for close family)
    const relatives = this.getRelatives(agent1.id);
    if (relatives.parents.includes(agent2.id) || 
        relatives.children.includes(agent2.id) ||
        relatives.siblings.includes(agent2.id)) {
      compatibility -= 100; // Strong penalty
    }
    
    return Math.max(0, Math.min(100, compatibility));
  }
  
  // Get couple key (sorted IDs for consistency)
  getCoupleKey(agentId1, agentId2) {
    return [agentId1, agentId2].sort().join('-');
  }
  
  // Decay relationships over time (neglect)
  decayRelationships(deltaTime) {
    const nowTick = this.sim?.clock?.tick ?? null;
    for (const [agentId1, relMap] of this.relationships) {
      for (const [agentId2, rel] of relMap) {
        // Neglect threshold expressed in sim ticks (100 ticks ~ 1 sim year);
        // falls back to wall-clock only when no simulation context exists.
        const stale = nowTick !== null
          ? (rel.lastInteraction ?? 0) < nowTick - 100
          : (Date.now() - (rel.lastInteraction || 0) > 86400000); // legacy 24h
        if (rel.interactions > 0 && stale) {
          // Small decay if no recent interaction
          rel.friendship = Math.max(-100, rel.friendship - 0.1);
          rel.trust = Math.max(0, rel.trust - 0.05);
        }
      }
    }
  }
  
  // Get relationship summary for UI
  getRelationshipSummary(agentId1, agentId2) {
    const rel = this.getRelationship(agentId1, agentId2);
    if (!rel) return "Strangers";
    
    if (rel.relationType) {
      return rel.relationType.charAt(0).toUpperCase() + rel.relationType.slice(1);
    }
    
    let summary = "Acquaintance";
    if (rel.friendship > 70) summary = "Friend";
    if (rel.friendship > 90) summary = "Close Friend";
    if (rel.romance > 60) summary = "Romantic Interest";
    if (rel.romance > 80) summary = "Lover";
    if (rel.rivalry > 50) summary = "Rival";
    if (rel.rivalry > 80) summary = "Enemy";
    
    return summary;
  }
  
  serialize() {
    return {
      relationships: Array.from(this.relationships.entries()).map(([id, map]) => [id, Array.from(map.entries())]),
      familyTrees: Array.from(this.familyTrees.entries()),
      reputations: Array.from(this.reputations.entries()),
      marriages: Array.from(this.marriages.entries())
    };
  }
  
  static deserialize(data) {
    const system = new RelationshipSystem();
    
    system.relationships = new Map(
      data.relationships.map(([id, entries]) => [id, new Map(entries)])
    );
    
    system.familyTrees = new Map(data.familyTrees);
    system.reputations = new Map(data.reputations);
    system.marriages = new Map(data.marriages);
    
    return system;
  }
}
