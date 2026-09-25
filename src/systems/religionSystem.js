/**
 * Religion System
 * Handles faith, priests, temples, rituals, and religious buffs.
 */

import { ENTITY_TYPES, JOB_TYPES } from '../core/constants.js';
import { distance } from '../utils/math.js';

export class ReligionSystem {
    constructor(worldState) {
        this.worldState = worldState;
        this.priests = new Set();
        this.activeRituals = new Map(); // templeId -> ritual data
        this.faithDecayRate = 0.05; // Faith lost per tick without temple
    }

    /**
     * Initialize religion stats for an agent
     */
    initReligionEntity(agent) {
        if (!agent.religion) {
            agent.religion = {
                faith: 50, // 0-100 scale
                maxFaith: 100,
                beliefId: null,
                lastRitualTime: 0,
                isPriest: false,
                sermonTimer: 0
            };
        }
        
        // Inherit faction belief if none set
        if (!agent.religion.beliefId && agent.factionId) {
            const faction = (this.worldState.factions || new Map()).get(agent.factionId);
            if (faction && faction.beliefs && faction.beliefs.length > 0) {
                agent.religion.beliefId = faction.beliefs[0];
            }
        }
    }

    /**
     * Check if an agent should become a priest
     */
    checkPriestEmergence(agent) {
        if (!agent.religion) this.initReligionEntity(agent);
        if (agent.religion.isPriest) return;
        
        // Priest requirements
        const hasTemple = this.hasNearbyTemple(agent);
        const highFaith = agent.religion.faith >= 80;
        // Agent personality stores social as 0..1 (no charisma field existed -> priests never emerged)
        const highCharisma = (agent.personality.social ?? 0) >= 0.7;
        const idle = !agent.currentJob || agent.job === JOB_TYPES.IDLE;
        
        if (hasTemple && highFaith && highCharisma && idle) {
            this.promoteToPriest(agent);
        }
    }

    /**
     * Promote agent to priest role
     */
    promoteToPriest(agent) {
        agent.religion.isPriest = true;
        agent.job = JOB_TYPES.PRIEST;
        agent.state = 'idle';
        
        this.priests.add(agent.id);
        
        this.worldState.events.trigger('priest_created', {
            agent: agent,
            factionId: agent.factionId
        });
    }

    /**
     * Demote priest back to regular agent
     */
    demoteFromPriest(agent) {
        if (!agent.religion.isPriest) return;
        
        agent.religion.isPriest = false;
        agent.job = JOB_TYPES.IDLE;
        this.priests.delete(agent.id);
        
        this.worldState.events.trigger('priest_removed', {
            agent: agent
        });
    }

    /**
     * Check if there's a temple nearby
     */
    hasNearbyTemple(agent, radius = 10) {
        const buildings = this.worldState.buildings || [];
        return buildings.some(b => 
            b.buildingType === 'temple' && 
            b.isComplete &&
            distance(agent.x, agent.y, b.x, b.y) <= radius
        );
    }

    /**
     * Get nearest temple for an agent
     */
    getNearestTemple(agent) {
        const buildings = this.worldState.buildings || [];
        let nearest = null;
        let minDist = Infinity;
        
        for (const b of buildings) {
            if (b.buildingType === 'temple' && b.isComplete) {
                const d = distance(agent.x, agent.y, b.x, b.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = b;
                }
            }
        }
        
        return nearest;
    }

    /**
     * Update faith levels for all agents
     */
    updateFaith() {
        for (const agent of (this.worldState.agents || [])) {
            if (agent.dead) continue;
            
            if (!agent.religion) this.initReligionEntity(agent);
            
            // Natural faith decay
            agent.religion.faith -= this.faithDecayRate;
            
            // Bonus if near temple
            const temple = this.getNearestTemple(agent);
            if (temple) {
                const dist = distance(agent.x, agent.y, temple.x, temple.y);
                if (dist <= 5) {
                    agent.religion.faith += 0.1; // Temple bonus
                }
            }
            
            // Clamp faith
            agent.religion.faith = Math.max(0, Math.min(100, agent.religion.faith));
            
            // Check priest emergence
            this.checkPriestEmergence(agent);
            
            // If priest died or lost faith, demote
            if (agent.religion.isPriest && agent.religion.faith < 30) {
                this.demoteFromPriest(agent);
            }
        }
    }

    /**
     * Priest AI: Perform rituals and sermons
     */
    updatePriests() {
        for (const priestId of this.priests) {
            const priest = this.worldState.getEntityById(priestId);
            if (!priest || priest.dead) {
                this.priests.delete(priestId);
                continue;
            }
            
            // Find nearest temple
            const temple = this.getNearestTemple(priest);
            if (!temple) {
                // Wander if no temple
                priest.state = 'wandering';
                continue;
            }
            
            // Move to temple if not there
            const dist = distance(priest.x, priest.y, temple.x, temple.y);
            if (dist > 2) {
                priest.state = 'moving_to_temple';
                priest.targetX = temple.x;
                priest.targetY = temple.y;
            } else {
                // At temple: perform ritual
                priest.state = 'performing_ritual';
                priest.religion.sermonTimer++;
                
                // Ritual every 200 ticks (~3 seconds)
                if (priest.religion.sermonTimer >= 200) {
                    this.performRitual(priest, temple);
                    priest.religion.sermonTimer = 0;
                }
            }
        }
    }

    /**
     * Perform a ritual at a temple
     */
    performRitual(priest, temple) {
        // Find nearby agents of same faction
        const nearbyAgents = (this.worldState.agents || []).filter(a => {
            if (a.dead || a.id === priest.id) return false;
            if (a.factionId !== priest.factionId) return false;
            return distance(a.x, a.y, temple.x, temple.y) <= 8;
        });
        
        // Apply faith buff to nearby agents
        for (const agent of nearbyAgents) {
            if (!agent.religion) this.initReligionEntity(agent);
            agent.religion.faith = Math.min(100, agent.religion.faith + 15);
            
            // Also boost morale
            if (agent.needs && agent.needs.morale) {
                agent.needs.morale = Math.min(100, agent.needs.morale + 10);
            }
        }
        
        // Visual event
        this.worldState.events.trigger('ritual_performed', {
            priest: priest,
            temple: temple,
            participants: nearbyAgents.length,
            effects: {
                faithBoost: 15,
                moraleBoost: 10,
                duration: 300 // 5 seconds visual
            }
        });
        
        // Track active ritual visuals
        this.activeRituals.set(temple.id, {
            startTime: this.world?.simulation?.clock?.tick ?? 0, // deterministic sim ticks
            duration: 300,
            priestId: priest.id
        });
    }

    /**
     * Handle holy war tensions between different beliefs
     */
    checkHolyWars() {
        const factions = Array.from((this.worldState.factions || new Map()).values());
        
        for (let i = 0; i < factions.length; i++) {
            for (let j = i + 1; j < factions.length; j++) {
                const f1 = factions[i];
                const f2 = factions[j];
                
                // Get dominant beliefs
                const belief1 = f1.beliefs && f1.beliefs[0];
                const belief2 = f2.beliefs && f2.beliefs[0];
                
                if (!belief1 || !belief2 || belief1 === belief2) continue;
                
                // Different beliefs increase tension
                const currentRelation = f1.getRelation(f2.id);
                if (currentRelation > -50) {
                    // Gradually decrease relations between different faiths
                    f1.adjustRelation(f2.id, -0.1);
                    
                    // Chance of holy war declaration if relations very bad
                    if (currentRelation < -80 && (this.worldState && this.worldState.rng ? this.worldState.rng : { next: Math.random }).next() < 0.001) {
                        this.declareHolyWar(f1, f2);
                    }
                }
            }
        }
    }

    /**
     * Declare a holy war between factions
     */
    declareHolyWar(attackerFaction, defenderFaction) {
        this.worldState.events.trigger('holy_war_declared', {
            attacker: attackerFaction,
            defender: defenderFaction,
            reason: 'Religious conflict'
        });
        
        // Set relations to minimum
        attackerFaction.adjustRelation(defenderFaction.id, -100);
        defenderFaction.adjustRelation(attackerFaction.id, -100);
        
        // Mobilize all priests as combat supporters
        for (const priestId of this.priests) {
            const priest = this.worldState.getEntityById(priestId);
            if (priest && (priest.factionId === attackerFaction.id || priest.factionId === defenderFaction.id)) {
                priest.religion.faith = 100; // Zealots!
            }
        }
    }

    /**
     * Get faith-based modifiers for an agent
     */
    getFaithModifiers(agent) {
        if (!agent.religion) return {};
        
        const modifiers = {};
        
        // High faith bonuses
        if (agent.religion.faith >= 80) {
            modifiers.morale = 1.2; // +20% morale gain
            modifiers.social = 1.1; // +10% relationship gain
        }
        
        // Low faith penalties
        if (agent.religion.faith <= 20) {
            modifiers.morale = 0.8; // -20% morale gain
            modifiers.productivity = 0.9; // -10% work efficiency
        }
        
        // Priest bonus
        if (agent.religion.isPriest) {
            modifiers.faithGeneration = 2.0; // Double faith generation for others
        }
        
        return modifiers;
    }

    /**
     * Main update loop
     */
    update() {
        this.updateFaith();
        this.updatePriests();
        this.checkHolyWars();
        
        // Cleanup old rituals (measured in sim ticks so behavior survives save/load)
        const now = this.world?.simulation?.clock?.tick ?? Date.now();
        for (const [templeId, ritual] of this.activeRituals.entries()) {
            if (now - ritual.startTime > ritual.duration) {
                this.activeRituals.delete(templeId);
            }
        }
    }
}
