/**
 * Age & Lifecycle System (Phase 2 Completion)
 * Handles child/elder behaviors, aging, birth, and natural death.
 */

import { EventBus } from '../core/eventBus.js';

export class AgeSystem {
    constructor(simulation) {
        this.sim = simulation;
        this.eventBus = EventBus.getInstance();
        
        // Configuration
        this.CHILD_AGE = 0;
        this.ADULT_AGE = 18;
        this.ELDER_AGE = 58;
        this.MAX_AGE = 82;
        this.AGING_INTERVAL = 100; // Ticks per year of aging
        
        this.lastAgeTick = 0;
    }

    update() {
        const currentTick = this.sim.clock.tick;
        
        if (currentTick - this.lastAgeTick >= this.AGING_INTERVAL) {
            this.lastAgeTick = currentTick;
            this.agePopulation();
        }
        
        this.updateBehaviors(currentTick);
    }

    /**
     * Age all agents and handle lifecycle events
     */
    agePopulation() {
        const agents = Array.isArray(this.sim.agents) ? this.sim.agents : Array.from(this.sim.agents.values());
        const expired = [];

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            if (!agent || !agent.alive) continue;

            // Check for natural death (respect personal maxAge)
            const limit = agent.maxAge || this.MAX_AGE;
            if (agent.age >= limit) {
                expired.push(agent);
                continue;
            }

            // Check life stage transitions
            if (agent.lifeStage !== 'adult' && agent.age >= this.ADULT_AGE && agent.age < this.ELDER_AGE) {
                this.onBecomeAdult(agent);
            } else if (agent.lifeStage === 'adult' && agent.age >= this.ELDER_AGE) {
                this.onBecomeElder(agent);
            }
        }

        for (let i = 0; i < expired.length; i++) {
            this.handleDeath(expired[i], 'old_age');
        }
    }

    onBecomeAdult(agent) {
        agent.lifeStage = 'adult';
        agent.canMarry = true;
        agent.canWork = true;
        
        if ((!agent.job || agent.job === 'unemployed') && this.sim.economySystem) {
            const availableJobs = ['gatherer', 'farmer', 'lumberjack', 'miner', 'builder', 'craftsman'];
            this.sim.economySystem.assignJob(agent, availableJobs);
        }
        
        this.eventBus.emit('agent:adult', { 
            id: agent.id, 
            name: agent.name,
            traits: agent.personality 
        });
    }

    onBecomeElder(agent) {
        agent.lifeStage = 'elder';
        agent.canWork = false; // Retire from job
        agent.job = null;
        agent.productivity = 0.6; // Slower movement/actions
        
        if (agent.personality && agent.personality.wisdom) {
            agent.personality.wisdom += 2;
        }
        
        this.eventBus.emit('agent:elder', { 
            id: agent.id, 
            name: agent.name 
        });
    }

    handleDeath(agent, cause) {
        // Notify living relatives via RelationshipSystem
        if (this.sim.relationshipSystem?.getRelatives) {
            const rels = this.sim.relationshipSystem.getRelatives(agent.id);
            const familyIds = [
                ...(rels.parents || []),
                ...(rels.children || []),
                ...(rels.siblings || []),
                ...(rels.spouse ? [rels.spouse] : [])
            ];
            for (let i = 0; i < familyIds.length; i++) {
                const relId = familyIds[i];
                const relative = (typeof this.sim._agentById === 'function')
                    ? this.sim._agentById(relId)
                    : null;
                if (relative && relative.alive && relative.needs) {
                    relative.needs.morale = Math.max(0, (relative.needs.morale || 100) - 25);
                    this.eventBus.emit('agent:grief', {
                        deceased: agent.name,
                        mourner: relative.name,
                        relationship: relId
                    });
                }
            }
        }
        
        agent.alive = false;
        agent.deathCause = cause || 'old_age';
        this.sim.removeAgent(agent.id, agent.deathCause);
        
        this.eventBus.emit('agent:died', {
            id: agent.id,
            name: agent.name,
            age: agent.age,
            cause: agent.deathCause
        });
    }

    /**
     * Update behaviors based on age/life stage (throttled & zero-RNG for late-game speed)
     */
    updateBehaviors(currentTick = 0) {
        const agents = this.sim.agents || [];
        let mentorsThisTick = 0;
        
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            if (!agent || !agent.alive || agent._lodTier === 2) continue;
            if (((agent.id + currentTick) & 3) !== 0) continue; // deterministic 1-in-4 throttle

            if (agent.lifeStage === 'child') {
                this.updateChildBehavior(agent, currentTick);
            } else if (agent.lifeStage === 'elder') {
                if (this.updateElderBehavior(agent, currentTick, mentorsThisTick < 3)) {
                    mentorsThisTick++;
                }
            }
        }
    }

    updateChildBehavior(agent, currentTick = 0) {
        const parentId = Array.isArray(agent.parents) ? agent.parents[0] : agent.parentId;
        if (!parentId) return;

        const parent = (typeof this.sim._agentById === 'function')
            ? this.sim._agentById(parentId)
            : null;
        if (parent && parent.alive !== false) {
            const dx = parent.x - agent.x;
            const dy = parent.y - agent.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq > 25) {
                const dist = Math.sqrt(distSq);
                const nx = agent.x + (dx / dist) * 0.6;
                const ny = agent.y + (dy / dist) * 0.6;
                if (!this.sim.world || this.sim.world.isWalkable(Math.floor(nx), Math.floor(ny))) {
                    agent.x = nx;
                    agent.y = ny;
                }
            } else if ((agent.id * 17 + currentTick) % 20 === 0) {
                const jx = (((agent.id * 13 + currentTick) % 3) - 1) * 0.5;
                const jy = (((agent.id * 29 + currentTick) % 3) - 1) * 0.5;
                const nx = Math.max(2, Math.min((this.sim.world?.width || 128) - 2, agent.x + jx));
                const ny = Math.max(2, Math.min((this.sim.world?.height || 128) - 2, agent.y + jy));
                if (!this.sim.world || this.sim.world.isWalkable(Math.floor(nx), Math.floor(ny))) {
                    agent.x = nx;
                    agent.y = ny;
                }
            }
        }
        
        agent.state = 'playing';
    }

    updateElderBehavior(agent, currentTick = 0, allowMentor = true) {
        if ((agent.id * 11 + currentTick) % 10 === 0) {
            agent.state = 'resting';
            return false;
        }
        
        if (agent.settlementId) {
            const settlement = this.sim.settlements.get(agent.settlementId);
            if (settlement && settlement.center) {
                const dx = settlement.center.x - agent.x;
                const dy = settlement.center.y - agent.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq > 4) {
                    const dist = Math.sqrt(distSq);
                    const nx = agent.x + (dx / dist) * 0.4;
                    const ny = agent.y + (dy / dist) * 0.4;
                    if (!this.sim.world || this.sim.world.isWalkable(Math.floor(nx), Math.floor(ny))) {
                        agent.x = nx;
                        agent.y = ny;
                    }
                }
            }
        }
        
        if (allowMentor && (agent.id * 23 + currentTick) % 60 === 0) {
            return this.mentorNearby(agent);
        }
        return false;
    }

    mentorNearby(elder) {
        const nearby = this.sim.world.getNearbyAgents(elder.x, elder.y, 5);
        for (let i = 0; i < nearby.length; i++) {
            const a = nearby[i];
            if (a.alive && (a.lifeStage === 'child' || (a.age < 25 && a.lifeStage === 'adult'))) {
                if (!a.skills) a.skills = {};
                const skills = Object.keys(elder.skills || {});
                for (let k = 0; k < skills.length; k++) {
                    const skill = skills[k];
                    if (elder.skills[skill] > 2) {
                        a.skills[skill] = Math.min(5, (a.skills[skill] || 1) + 0.08);
                    }
                }
                this.eventBus.emit('agent:mentored', {
                    mentor: elder.name,
                    mentee: a.name,
                    skill: skills[0] || 'wisdom'
                });
                return true;
            }
        }
        return false;
    }

    serialize() {
        return {
            lastAgeTick: this.lastAgeTick
        };
    }

    deserialize(data) {
        if (data.lastAgeTick) this.lastAgeTick = data.lastAgeTick;
    }

    static deserialize(data, sim) {
        const sys = new AgeSystem(sim);
        sys.deserialize(data);
        return sys;
    }
}
