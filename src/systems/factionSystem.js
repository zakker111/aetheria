// Faction System - Phase 3: Advanced Simulation
// Political groups with shared beliefs, diplomacy, and conflict

export class FactionSystem {
  constructor() {
    this.factions = new Map(); // factionId -> Faction
    this.agentFactionMap = new Map(); // agentId -> factionId
    this.nextFactionId = 1;
    
    // Belief definitions
    this.beliefTypes = [
      'tradition',    // Respect for old ways
      'prosperity',   // Focus on wealth/growth
      'piety',        // Religious devotion
      'conquest',     // Militaristic expansion
      'isolation',    // Avoid outsiders
      'community',    // Collective welfare
      'innovation'    // Embrace change/new ideas
    ];
    
    // Faction name generators
    this.factionPrefixes = [
      'Order of', 'Brotherhood of', 'Society of', 'Circle of',
      'Guardians of', 'Children of', 'Followers of', 'Disciples of'
    ];
    
    this.factionThemes = [
      'the Eternal', 'the Prosperous', 'the Divine', 'the Mighty',
      'the Secluded', 'the United', 'the Progressive', 'the Ancient',
      'the Golden', 'the Iron', 'the Sacred', 'the Free'
    ];
  }
  
  // Create a new faction
  createFaction(founderAgent, world) {
    const id = this.nextFactionId++;
    
    // Generate name based on founder's beliefs/location
    const prefix = this.factionPrefixes[Math.floor(Math.random() * this.factionPrefixes.length)];
    const theme = this.factionThemes[Math.floor(Math.random() * this.factionThemes.length)];
    const name = `${prefix} ${theme}`;
    
    // Initial beliefs based on founder's personality
    const beliefs = {
      tradition: 0.3 + (1 - founderAgent.personality.curious) * 0.4,
      prosperity: 0.3 + founderAgent.personality.industrious * 0.4,
      piety: 0.2 + Math.random() * 0.6,
      conquest: 0.1 + founderAgent.personality.brave * 0.5,
      isolation: 0.3 + (1 - founderAgent.personality.social) * 0.4,
      community: 0.4 + founderAgent.personality.social * 0.4,
      innovation: 0.3 + founderAgent.personality.curious * 0.4
    };
    
    const faction = {
      id,
      name,
      founderId: founderAgent.id,
      leaderId: founderAgent.id,
      beliefs,
      members: new Set([founderAgent.id]),
      advisors: [],
      allies: new Set(),
      enemies: new Set(),
      diplomaticStatus: new Map(), // factionId -> 'peace' | 'war' | 'alliance' | 'trade'
      influence: 1.0,
      foundedAt: Date.now(),
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      territory: [],
      resources: { food: 0, wood: 0, ore: 0 },
      wars: [],
      treaties: []
    };
    
    this.factions.set(id, faction);
    this.agentFactionMap.set(founderAgent.id, id);
    
    return faction;
  }
  
  // Check if new factions should form
  checkForNewFactions(agents, relationshipSystem) {
    const potentialFounders = [];
    
    for (const agent of agents) {
      if (!agent.alive || this.agentFactionMap.has(agent.id)) continue;
      
      // Charismatic agents with high reputation can found factions
      const reputation = relationshipSystem.reputations.get(agent.id) || 50;
      const charisma = agent.personality.social * 0.7 + agent.personality.industrious * 0.3;
      
      if (reputation > 70 && charisma > 0.6) {
        potentialFounders.push({ agent, score: reputation * charisma });
      }
    }
    
    // Sort by score and potentially create factions
    potentialFounders.sort((a, b) => b.score - a.score);
    
    const newFactions = [];
    for (const { agent } of potentialFounders.slice(0, 2)) {
      if (Math.random() < 0.3 && this.factions.size < 5) { // Max 5 factions
        const faction = this.createFaction(agent, null);
        newFactions.push(faction);
      }
    }
    
    return newFactions;
  }
  
  // Recruit new members to factions
  recruitMembers(agents, settlements, relationshipSystem) {
    for (const faction of this.factions.values()) {
      // Find potential recruits near faction members
      const factionAgents = agents.filter(a => 
        a.alive && faction.members.has(a.id)
      );
      
      if (factionAgents.length === 0) continue;
      
      for (const member of factionAgents) {
        // Find nearby agents
        const nearbyAgents = agents.filter(a => {
          if (!a.alive || this.agentFactionMap.has(a.id)) return false;
          const dx = a.x - member.x;
          const dy = a.y - member.y;
          return Math.sqrt(dx * dx + dy * dy) < 15;
        });
        
        for (const candidate of nearbyAgents) {
          // Check belief compatibility
          const compatibility = this.calculateBeliefCompatibility(candidate, faction);
          
          if (compatibility > 0.6 && Math.random() < faction.influence * 0.1) {
            this.joinFaction(candidate.id, faction.id);
          }
        }
      }
    }
  }
  
  // Calculate belief compatibility between agent and faction
  calculateBeliefCompatibility(agent, faction) {
    let compatibility = 0.5;
    
    // Personality influences belief alignment
    const personalityBeliefs = {
      tradition: 1 - agent.personality.curious,
      prosperity: agent.personality.industrious,
      piety: 0.5, // Would need spirituality trait
      conquest: agent.personality.brave,
      isolation: 1 - agent.personality.social,
      community: agent.personality.social,
      innovation: agent.personality.curious
    };
    
    for (const belief of this.beliefTypes) {
      const diff = Math.abs(personalityBeliefs[belief] - faction.beliefs[belief]);
      compatibility += (1 - diff) * 0.1;
    }
    
    return Math.min(1.0, compatibility);
  }
  
  // Agent joins faction
  joinFaction(agentId, factionId) {
    const faction = this.factions.get(factionId);
    if (!faction) return false;
    
    // Leave current faction if any
    const currentFactionId = this.agentFactionMap.get(agentId);
    if (currentFactionId) {
      this.leaveFaction(agentId);
    }
    
    faction.members.add(agentId);
    this.agentFactionMap.set(agentId, factionId);
    
    // Update leadership if newcomer has higher reputation
    // (simplified - would need reputation system access)
    
    return true;
  }
  
  // Agent leaves faction
  leaveFaction(agentId) {
    const factionId = this.agentFactionMap.get(agentId);
    if (!factionId) return false;
    
    const faction = this.factions.get(factionId);
    if (faction) {
      faction.members.delete(agentId);
      
      // Handle leader leaving
      if (faction.leaderId === agentId) {
        this.chooseNewLeader(faction);
      }
    }
    
    this.agentFactionMap.delete(agentId);
    return true;
  }
  
  // Choose new leader when current dies or leaves
  chooseNewLeader(faction) {
    if (faction.members.size === 0) return;
    
    // Select member with highest influence/reputation
    // Simplified: random selection for now
    const memberArray = Array.from(faction.members);
    faction.leaderId = memberArray[Math.floor(Math.random() * memberArray.length)];
    
    // Choose top 3 as advisors
    faction.advisors = memberArray.slice(0, Math.min(3, memberArray.length));
  }
  
  // Update diplomatic relations between factions
  updateDiplomacy() {
    const factionArray = Array.from(this.factions.values());
    
    for (let i = 0; i < factionArray.length; i++) {
      for (let j = i + 1; j < factionArray.length; j++) {
        const f1 = factionArray[i];
        const f2 = factionArray[j];
        
        const beliefSimilarity = this.calculateBeliefSimilarity(f1, f2);
        const currentStatus = f1.diplomaticStatus.get(f2.id);
        
        // Determine new status
        let newStatus = 'peace';
        
        if (beliefSimilarity > 0.75) {
          newStatus = 'alliance';
        } else if (beliefSimilarity < 0.25) {
          newStatus = 'war';
        } else if (beliefSimilarity > 0.5) {
          newStatus = 'trade';
        }
        
        // Update both factions
        if (newStatus !== currentStatus) {
          f1.diplomaticStatus.set(f2.id, newStatus);
          f2.diplomaticStatus.set(f1.id, newStatus);
          
          // Update ally/enemy sets
          if (newStatus === 'alliance') {
            f1.allies.add(f2.id);
            f2.allies.add(f1.id);
            f1.enemies.delete(f2.id);
            f2.enemies.delete(f1.id);
          } else if (newStatus === 'war') {
            f1.enemies.add(f2.id);
            f2.enemies.add(f1.id);
            f1.allies.delete(f2.id);
            f2.allies.delete(f1.id);
          } else {
            f1.allies.delete(f2.id);
            f2.allies.delete(f1.id);
            f1.enemies.delete(f2.id);
            f2.enemies.delete(f1.id);
          }
        }
      }
    }
  }
  
  // Calculate belief similarity between two factions
  calculateBeliefSimilarity(f1, f2) {
    let totalDiff = 0;
    
    for (const belief of this.beliefTypes) {
      const diff = Math.abs(f1.beliefs[belief] - f2.beliefs[belief]);
      totalDiff += diff;
    }
    
    const avgDiff = totalDiff / this.beliefTypes.length;
    return 1 - avgDiff;
  }
  
  // Process warfare between enemy factions
  processConflicts(agents, settlementSystem) {
    for (const faction of this.factions.values()) {
      if (faction.enemies.size === 0) continue;
      
      for (const enemyId of faction.enemies) {
        const enemyFaction = this.factions.get(enemyId);
        if (!enemyFaction) continue;
        
        // Check if already at war
        if (faction.diplomaticStatus.get(enemyId) === 'war') {
          // Chance of battle
          if (Math.random() < 0.05) {
            this.resolveBattle(faction, enemyFaction, agents);
          }
        }
      }
    }
  }
  
  // Resolve a battle between two factions
  resolveBattle(faction1, faction2, agents) {
    // Get members from both factions
    const members1 = agents.filter(a => a.alive && faction1.members.has(a.id));
    const members2 = agents.filter(a => a.alive && faction2.members.has(a.id));
    
    if (members1.length === 0 || members2.length === 0) return;
    
    // Calculate strength
    const strength1 = this.calculateFactionStrength(members1);
    const strength2 = this.calculateFactionStrength(members2);
    
    const totalStrength = strength1 + strength2;
    const winChance1 = strength1 / totalStrength;
    
    const winner = Math.random() < winChance1 ? faction1 : faction2;
    const loser = winner === faction1 ? faction2 : faction1;
    
    // Casualties (5-15% of losing side)
    const casualtyRate = 0.05 + Math.random() * 0.1;
    const casualties = Math.floor(loser.members.size * casualtyRate);
    
    // Kill random members of losing faction
    const memberArray = Array.from(loser.members);
    for (let i = 0; i < casualties && i < memberArray.length; i++) {
      const victimId = memberArray[Math.floor(Math.random() * memberArray.length)];
      const victim = agents.find(a => a.id === victimId);
      if (victim) {
        victim.alive = false;
        loser.members.delete(victimId);
        this.agentFactionMap.delete(victimId);
      }
    }
    
    // Record war event
    winner.wars.push({
      against: loser.id,
      startedAt: Date.now(),
      outcome: 'victory'
    });
    
    loser.wars.push({
      against: winner.id,
      startedAt: Date.now(),
      outcome: 'defeat'
    });
    
    // War weariness - may lead to peace
    if (casualties > 3) {
      // High casualties increase chance of seeking peace
      if (Math.random() < 0.3) {
        this.signPeaceTreaty(winner, loser);
      }
    }
  }
  
  // Calculate faction military strength
  calculateFactionStrength(members) {
    let strength = 0;
    
    for (const member of members) {
      strength += member.personality.brave * 10;
      strength += (member.skills.gather || 0) * 2; // Resource gathering = supplies
      strength += 5; // Base strength per member
    }
    
    return strength;
  }
  
  // Sign peace treaty
  signPeaceTreaty(faction1, faction2) {
    faction1.diplomaticStatus.set(faction2.id, 'peace');
    faction2.diplomaticStatus.set(faction1.id, 'peace');
    
    faction1.enemies.delete(faction2.id);
    faction2.enemies.delete(faction1.id);
    
    faction1.treaties.push({
      with: faction2.id,
      type: 'peace',
      signedAt: Date.now()
    });
    
    faction2.treaties.push({
      with: faction1.id,
      type: 'peace',
      signedAt: Date.now()
    });
  }
  
  // Evolve faction beliefs over time
  evolveBeliefs(agents) {
    for (const faction of this.factions.values()) {
      const memberAgents = agents.filter(a => a.alive && faction.members.has(a.id));
      
      if (memberAgents.length === 0) continue;
      
      // Average member personalities
      const avgPersonality = {
        curious: 0,
        industrious: 0,
        brave: 0,
        social: 0
      };
      
      for (const member of memberAgents) {
        avgPersonality.curious += member.personality.curious;
        avgPersonality.industrious += member.personality.industrious;
        avgPersonality.brave += member.personality.brave;
        avgPersonality.social += member.personality.social;
      }
      
      const count = memberAgents.length;
      for (const key of Object.keys(avgPersonality)) {
        avgPersonality[key] /= count;
      }
      
      // Slowly shift beliefs toward member average
      for (const belief of this.beliefTypes) {
        const targetValue = this.personalityToBelief(belief, avgPersonality);
        const currentValue = faction.beliefs[belief];
        faction.beliefs[belief] = currentValue + (targetValue - currentValue) * 0.05;
      }
    }
  }
  
  // Convert personality traits to belief values
  personalityToBelief(belief, personality) {
    switch (belief) {
      case 'tradition': return 1 - personality.curious;
      case 'prosperity': return personality.industrious;
      case 'conquest': return personality.brave;
      case 'isolation': return 1 - personality.social;
      case 'community': return personality.social;
      case 'innovation': return personality.curious;
      default: return 0.5;
    }
  }
  
  // Get faction for an agent
  getAgentFaction(agentId) {
    const factionId = this.agentFactionMap.get(agentId);
    if (!factionId) return null;
    return this.factions.get(factionId);
  }
  
  // Get faction statistics
  getFactionStats(factionId) {
    const faction = this.factions.get(factionId);
    if (!faction) return null;
    
    return {
      ...faction,
      memberCount: faction.members.size,
      allyCount: faction.allies.size,
      enemyCount: faction.enemies.size,
      beliefSummary: this.getDominantBeliefs(faction)
    };
  }
  
  // Get dominant beliefs of faction
  getDominantBeliefs(faction) {
    const sorted = Object.entries(faction.beliefs)
      .sort(([, a], [, b]) => b - a);
    
    return sorted.slice(0, 3).map(([belief, value]) => ({
      belief,
      value,
      label: this.beliefLabel(belief, value)
    }));
  }
  
  beliefLabel(belief, value) {
    const labels = {
      tradition: value > 0.7 ? 'Traditionalist' : value < 0.3 ? 'Progressive' : 'Balanced',
      prosperity: value > 0.7 ? 'Wealth-focused' : value < 0.3 ? 'Ascetic' : 'Moderate',
      piety: value > 0.7 ? 'Devout' : value < 0.3 ? 'Secular' : 'Spiritual',
      conquest: value > 0.7 ? 'Aggressive' : value < 0.3 ? 'Peaceful' : 'Defensive',
      isolation: value > 0.7 ? 'Isolationist' : value < 0.3 ? 'Outward-looking' : 'Selective',
      community: value > 0.7 ? 'Collectivist' : value < 0.3 ? 'Individualist' : 'Communal',
      innovation: value > 0.7 ? 'Innovative' : value < 0.3 ? 'Conservative' : 'Pragmatic'
    };
    return labels[beliefs] || belief;
  }
  
  serialize() {
    return {
      factions: Array.from(this.factions.entries()).map(([id, f]) => [
        id,
        {
          ...f,
          members: Array.from(f.members),
          allies: Array.from(f.allies),
          enemies: Array.from(f.enemies),
          diplomaticStatus: Array.from(f.diplomaticStatus.entries()),
          wars: [...f.wars],
          treaties: [...f.treaties]
        }
      ]),
      agentFactionMap: Array.from(this.agentFactionMap.entries()),
      nextFactionId: this.nextFactionId
    };
  }
  
  static deserialize(data) {
    const system = new FactionSystem();
    
    system.factions = new Map(
      data.factions.map(([id, f]) => [
        id,
        {
          ...f,
          members: new Set(f.members),
          allies: new Set(f.allies),
          enemies: new Set(f.enemies),
          diplomaticStatus: new Map(f.diplomaticStatus),
          wars: f.wars || [],
          treaties: f.treaties || []
        }
      ])
    );
    
    system.agentFactionMap = new Map(data.agentFactionMap);
    system.nextFactionId = data.nextFactionId || 1;
    
    return system;
  }
}
