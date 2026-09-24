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
        this.ELDER_AGE = 60;
        this.MAX_AGE = 90;
        this.AGING_INTERVAL = 100; // Ticks per year of aging
        
        this.lastAgeTick = 0;
    }

    update() {
        const currentTick = this.sim.clock.tick;
        
        if (currentTick - this.lastAgeTick >= this.AGING_INTERVAL) {
            this.lastAgeTick = currentTick;
            this.agePopulation();
        }
        
        this.updateBehaviors();
    }

    /**
     * Age all agents and handle lifecycle events
     */
    agePopulation() {
        // sim.agents is an array (not a Map) — .values() used to throw TypeError
        const agents = Array.isArray(this.sim.agents) ? this.sim.agents : Array.from(this.sim.agents.values());

        agents.forEach(agent => {
            // NOTE: aging itself is owned by Agent.updateNeeds() (+0.01/tick).
            // This pass only fires lifecycle hooks — no duplicate aging.

            // Check for natural death (Agent also self-checks; keep parity here)
            if (agent.alive && agent.age >= this.MAX_AGE) {
                this.handleDeath(agent, 'old_age');
                return;
            }

            // Check life stage transitions (integer-safe comparisons)
            if (agent.lifeStage !== 'adult' && agent.age >= this.ADULT_AGE && agent.age < this.ELDER_AGE) {
                this.onBecomeAdult(agent);
            } else if (agent.lifeStage === 'adult' && agent.age >= this.ELDER_AGE) {
                this.onBecomeElder(agent);
            }
        });
    }

    onBecomeAdult(agent) {
        agent.lifeStage = 'adult';
        agent.canMarry = true;
        agent.canWork = true;
        
        // Assign adult job if not assigned (settlements have no assignJob — route via economySystem)
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
        
        // Elder wisdom bonus
        if (agent.personality.wisdom) {
            agent.personality.wisdom += 2;
        }
        
        this.eventBus.emit('agent:elder', { 
            id: agent.id, 
            name: agent.name 
        });
    }

    handleDeath(agent, cause) {
        // Handle inheritance/family notification
        if (agent.relationships) {
            const family = agent.relationships.family || [];
            family.forEach(relId => {
                const relative = (Array.isArray(this.sim.agents)
                    ? this.sim.agents.find(a => a.id === relId)
                    : this.sim.agents.get(relId));
                if (relative) {
                    // Grief debuff
                    if (relative.needs) {
                        relative.needs.morale = Math.max(0, (relative.needs.morale || 100) - 30);
                    }
                    
                    this.eventBus.emit('agent:grief', {
                        deceased: agent.name,
                        mourner: relative.name,
                        relationship: relId
                    });
                }
            });
        }
        
        // Remove agent
        this.sim.removeAgent(agent.id);
        
        this.eventBus.emit('agent:died', {
            id: agent.id,
            name: agent.name,
            age: agent.age,
            cause: cause
        });
    }

    /**
     * Update behaviors based on age/life stage
     */
    updateBehaviors() {
        const agents = this.sim.agents || [];
        
        agents.forEach(agent => {
            if (agent.lifeStage === 'child') {
                this.updateChildBehavior(agent);
            } else if (agent.lifeStage === 'elder') {
                this.updateElderBehavior(agent);
            }
        });
    }

    updateChildBehavior(agent) {
        // Children follow parents or stay in settlement (agents store parents[] array)
        const parentId = Array.isArray(agent.parents) ? agent.parents[0] : agent.parentId;
        if (!parentId) return;

        const parent = (Array.isArray(this.sim.agents)
            ? this.sim.agents.find(a => a.id === parentId)
            : this.sim.agents.get(parentId));
        if (parent && parent.alive !== false) {
            // Simple follow logic
            const dx = parent.x - agent.x;
            const dy = parent.y - agent.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 5) { // Keep close but not on top
                const moveX = (dx / dist) * 0.3; // Slower movement
                const moveY = (dy / dist) * 0.3;
                agent.x += moveX;
                agent.y += moveY;
            }
        }
        
        // Children play (random movement when close to parent)
        if (this.sim.world.rng.next() < 0.05) {
            agent.x += (this.sim.world.rng.next() - 0.5) * 2;
            agent.y += (this.sim.world.rng.next() - 0.5) * 2;
        }
        
        agent.state = 'playing';
    }

    updateElderBehavior(agent) {
        // Elders rest more, move slower, advise younger agents
        if (this.sim.world.rng.next() < 0.1) {
            agent.state = 'resting';
            return;
        }
        
        // Move slowly towards settlement center or community buildings
        if (agent.settlementId) {
            const settlement = this.sim.settlements.get(agent.settlementId);
            if (settlement) {
                const dx = settlement.center.x - agent.x;
                const dy = settlement.center.y - agent.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 2) {
                    const moveX = (dx / dist) * 0.2; // Very slow
                    const moveY = (dy / dist) * 0.2;
                    agent.x += moveX;
                    agent.y += moveY;
                }
            }
        }
        
        // Chance to mentor nearby young agents
        if (this.sim.world.rng.next() < 0.02) {
            this.mentorNearby(agent);
        }
    }

    mentorNearby(elder) {
        const nearby = this.sim.world.getNearbyAgents(elder.x, elder.y, 5);
        const youngOnes = nearby.filter(a => 
            a.lifeStage === 'child' || (a.age < 25 && a.lifeStage === 'adult')
        );
        
        if (youngOnes.length > 0) {
            const mentee = youngOnes[0];
            // Boost mentee's skill growth
            if (!mentee.skills) mentee.skills = {};
            Object.keys(elder.skills || {}).forEach(skill => {
                if (elder.skills[skill] > 5) {
                    mentee.skills[skill] = (mentee.skills[skill] || 0) + 0.1;
                }
            });
            
            this.eventBus.emit('agent:mentored', {
                mentor: elder.name,
                mentee: mentee.name,
                skill: Object.keys(elder.skills)[0] || 'wisdom'
            });
        }
    }

    /**
     * Spawn a new child agent
     */
    spawnChild(parentA, parentB, settlementId) {
        const settlement = this.sim.settlements.get(settlementId);
        if (!settlement) return null;
        
        const child = this.sim.spawnAgent(
            parentA.x,
            parentA.y,
            parentA.factionId
        );
        
        if (child) {
            child.age = 0;
            child.lifeStage = 'child';
            child.parentId = parentA.id;
            child.parentIds = [parentA.id, parentB.id];
            child.canWork = false;
            child.canMarry = false;
            
            // Inherit some traits
            child.personality = {
                intelligence: (parentA.personality.intelligence + parentB.personality.intelligence) / 2 + (this.sim.world.rng.next() - 0.5) * 2,
                strength: (parentA.personality.strength + parentB.personality.strength) / 2 + (this.sim.world.rng.next() - 0.5) * 2,
                charisma: (parentA.personality.charisma + parentB.personality.charisma) / 2 + (this.sim.world.rng.next() - 0.5) * 2
            };
            
            // Add to family trees
            if (!parentA.relationships.children) parentA.relationships.children = [];
            parentA.relationships.children.push(child.id);
            
            if (!parentB.relationships.children) parentB.relationships.children = [];
            parentB.relationships.children.push(child.id);
            
            this.eventBus.emit('agent:born', {
                id: child.id,
                name: child.name,
                parents: [parentA.name, parentB.name],
                settlement: settlement.name
            });
        }
        
        return child;
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
