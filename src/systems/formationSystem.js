/**
 * Formation & Tactics System (Phase 3 Completion)
 * Handles military formations, coordinated movement, and territory control.
 */

import { EventBus } from '../core/eventBus.js';

export class FormationSystem {
    constructor(simulation) {
        this.sim = simulation;
        this.eventBus = EventBus.getInstance();
        
        // Formations
        this.formations = {
            line: { offsets: [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]] },
            wedge: { offsets: [[0, 0], [-1, 1], [1, 1], [-2, 2], [2, 2]] },
            shield: { offsets: [[0, 1], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]] },
            scatter: { offsets: [[0, 0], [-3, -2], [3, 2], [-2, 3], [2, -3]] }
        };
        
        this.activeFormations = []; // Groups of agents in formation
        this.territories = new Map(); // factionId -> territory tiles
        
        this.lastTerritoryUpdate = 0;
        this.TERRITORY_UPDATE_INTERVAL = 500;
    }

    update() {
        const currentTick = this.sim.clock.tick;
        
        this.updateFormations();
        
        if (currentTick - this.lastTerritoryUpdate >= this.TERRITORY_UPDATE_INTERVAL) {
            this.lastTerritoryUpdate = currentTick;
            this.updateTerritories();
        }
    }

    /**
     * Create a military formation from a group of agents
     */
    createFormation(agentIds, type = 'line', leaderId = null) {
        if (agentIds.length < 2) return null;
        
        const agents = agentIds.map(id => this.sim.entities.agents.get(id)).filter(a => a);
        if (agents.length === 0) return null;
        
        const leader = leaderId ? 
            this.sim.entities.agents.get(leaderId) : 
            agents[0];
            
        if (!leader) return null;
        
        const formation = {
            id: `formation_${Date.now()}`,
            type: type,
            leaderId: leader.id,
            agents: agentIds,
            targetX: leader.x,
            targetY: leader.y,
            state: 'idle' // idle, moving, attacking, defending
        };
        
        this.assignFormationPositions(formation, agents);
        this.activeFormations.push(formation);
        
        // Tag agents as part of formation
        agents.forEach(agent => {
            agent.formationId = formation.id;
            agent.combatRole = 'soldier';
        });
        
        this.eventBus.emit('military:formation_created', {
            id: formation.id,
            type: type,
            size: agents.length,
            faction: leader.factionId
        });
        
        return formation;
    }

    assignFormationPositions(formation, agents) {
        const pattern = this.formations[formation.type] || this.formations.line;
        const offsets = pattern.offsets;
        
        agents.forEach((agent, index) => {
            const offset = offsets[index % offsets.length];
            agent.formationOffset = offset;
            
            // Initial positioning relative to leader
            const leader = this.sim.entities.agents.get(formation.leaderId);
            if (leader) {
                agent.targetX = leader.x + offset[0];
                agent.targetY = leader.y + offset[1];
            }
        });
    }

    updateFormations() {
        for (let i = this.activeFormations.length - 1; i >= 0; i--) {
            const formation = this.activeFormations[i];
            const leader = this.sim.entities.agents.get(formation.leaderId);
            
            // Remove if leader dead or no agents left
            if (!leader || formation.agents.length === 0) {
                this.dissolveFormation(formation);
                this.activeFormations.splice(i, 1);
                continue;
            }
            
            // Update target based on leader movement
            formation.targetX = leader.x;
            formation.targetY = leader.y;
            
            // Move formation members to their positions
            formation.agents.forEach(agentId => {
                const agent = this.sim.entities.agents.get(agentId);
                if (!agent || !agent.formationOffset) return;
                
                const targetX = formation.targetX + agent.formationOffset[0];
                const targetY = formation.targetY + agent.formationOffset[1];
                
                // Move towards target position
                const dx = targetX - agent.x;
                const dy = targetY - agent.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 0.5) {
                    const speed = agent.speed || 0.3;
                    agent.x += (dx / dist) * speed;
                    agent.y += (dy / dist) * speed;
                    agent.state = 'forming';
                } else {
                    agent.state = 'formed';
                }
            });
            
            // Check if formation should engage in combat
            if (formation.state === 'moving' && this.detectEnemyNearby(leader, 15)) {
                formation.state = 'attacking';
                this.engageEnemies(formation);
            }
        }
    }

    detectEnemyNearby(agent, range) {
        const faction = (this.sim.factionSystem?.factions || new Map()).get(agent.factionId);
        if (!faction) return false;
        
        const nearby = this.sim.world.getNearbyAgents(agent.x, agent.y, range);
        return nearby.some(a => {
            const otherFaction = (this.sim.factionSystem?.factions || new Map()).get(a.factionId);
            return otherFaction && faction.isHostile(otherFaction.id);
        });
    }

    engageEnemies(formation) {
        formation.agents.forEach(agentId => {
            const agent = this.sim.entities.agents.get(agentId);
            if (agent) {
                agent.state = 'combat';
                // Find nearest enemy and attack
                const enemy = this.findNearestEnemy(agent);
                if (enemy) {
                    agent.targetId = enemy.id;
                }
            }
        });
    }

    findNearestEnemy(agent) {
        const faction = (this.sim.factionSystem?.factions || new Map()).get(agent.factionId);
        if (!faction) return null;
        
        const nearby = this.sim.world.getNearbyAgents(agent.x, agent.y, 20);
        let nearest = null;
        let minDist = Infinity;
        
        nearby.forEach(other => {
            if (other.id === agent.id) return;
            const otherFaction = (this.sim.factionSystem?.factions || new Map()).get(other.factionId);
            if (otherFaction && faction.isHostile(otherFaction.id)) {
                const dist = Math.hypot(other.x - agent.x, other.y - agent.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = other;
                }
            }
        });
        
        return nearest;
    }

    dissolveFormation(formation) {
        formation.agents.forEach(agentId => {
            const agent = this.sim.entities.agents.get(agentId);
            if (agent) {
                delete agent.formationId;
                delete agent.formationOffset;
                delete agent.combatRole;
                agent.state = 'idle';
            }
        });
    }

    /**
     * Territory Control System
     */
    updateTerritories() {
        // Clear old territories
        this.territories.clear();
        
        // Calculate territory for each faction based on building proximity
        const factions = Array.from((this.sim.factionSystem?.factions || new Map()).values());
        const buildings = Array.from(this.sim.buildings.values());
        
        factions.forEach(faction => {
            const factionBuildings = buildings.filter(b => b.factionId === faction.id);
            const territoryTiles = new Set();
            
            factionBuildings.forEach(building => {
                // Claim surrounding tiles
                const range = 8; // Tiles around building
                const startX = Math.floor(building.x - range);
                const endX = Math.floor(building.x + range);
                const startY = Math.floor(building.y - range);
                const endY = Math.floor(building.y + range);
                
                for (let x = startX; x <= endX; x++) {
                    for (let y = startY; y <= endY; y++) {
                        const dist = Math.hypot(x - building.x, y - building.y);
                        if (dist <= range) {
                            territoryTiles.add(`${x},${y}`);
                        }
                    }
                }
            });
            
            this.territories.set(faction.id, territoryTiles);
            
            // Emit event if territory changed significantly
            if (territoryTiles.size > 0) {
                this.eventBus.emit('faction:territory_update', {
                    factionId: faction.id,
                    tileCount: territoryTiles.size
                });
            }
        });
    }

    isTileInTerritory(x, y, factionId) {
        const territory = this.territories.get(factionId);
        if (!territory) return false;
        return territory.has(`${Math.floor(x)},${Math.floor(y)}`);
    }

    getContestedTiles() {
        const contested = [];
        const factionIds = Array.from(this.territories.keys());
        
        for (let i = 0; i < factionIds.length; i++) {
            for (let j = i + 1; j < factionIds.length; j++) {
                const tilesA = this.territories.get(factionIds[i]);
                const tilesB = this.territories.get(factionIds[j]);
                
                tilesA.forEach(tile => {
                    if (tilesB.has(tile)) {
                        contested.push(tile);
                    }
                });
            }
        }
        
        return contested;
    }

    /**
     * Command formation to move to location
     */
    moveFormation(formationId, targetX, targetY) {
        const formation = this.activeFormations.find(f => f.id === formationId);
        if (!formation) return false;
        
        formation.state = 'moving';
        formation.targetX = targetX;
        formation.targetY = targetY;
        
        // Leader starts moving
        const leader = this.sim.entities.agents.get(formation.leaderId);
        if (leader) {
            leader.targetX = targetX;
            leader.targetY = targetY;
            leader.state = 'moving';
        }
        
        this.eventBus.emit('military:formation_moving', {
            id: formationId,
            target: { x: targetX, y: targetY }
        });
        
        return true;
    }

    serialize() {
        return {
            activeFormations: this.activeFormations,
            territories: Array.from(this.territories.entries())
        };
    }

    deserialize(data) {
        if (data.activeFormations) this.activeFormations = data.activeFormations;
        if (data.territories) {
            this.territories = new Map(data.territories);
        }
    }
}
