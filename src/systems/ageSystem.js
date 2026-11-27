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
        const hazards = [];

        const rng = typeof this.sim?._rng === 'function' ? this.sim._rng() : null;
        const season = this.sim?.clock?.getSeason?.() || 'spring';
        const isWinter = season === 'winter';

        // Per-settlement population & apothecary mitigation cache (zero RNG)
        const popBySettlement = new Map();
        for (let i = 0; i < agents.length; i++) {
            const a = agents[i];
            if (a && a.alive && a.settlementId != null) {
                popBySettlement.set(a.settlementId, (popBySettlement.get(a.settlementId) || 0) + 1);
            }
        }
        const apothecaryBySettlement = new Map();
        if (Array.isArray(this.sim.buildings)) {
            for (const b of this.sim.buildings) {
                if (b && b.complete && !b.isRuined && b.buildingType === 'apothecary' && b.settlementId != null) {
                    apothecaryBySettlement.set(b.settlementId, (apothecaryBySettlement.get(b.settlementId) || 0) + (b.level || 1));
                }
            }
        }

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

            // Seeded annual hazards for non-expired citizens (protect tiny struggling villages <= 4 pop)
            if (rng) {
                const sPop = agent.settlementId != null ? (popBySettlement.get(agent.settlementId) || 0) : 6;
                if (sPop <= 4) continue;

                const apothecaryLevel = agent.settlementId != null ? (apothecaryBySettlement.get(agent.settlementId) || 0) : 0;
                const medicineMitigation = 1 + apothecaryLevel * 1.4;
                const crowdingFactor = sPop >= 16 ? 1.35 : (sPop >= 10 ? 1.15 : 1.0);
                const winterFactor = isWinter ? 1.5 : 1.0;

                const age = agent.age || 0;
                const baseDisease = age >= this.ELDER_AGE ? 0.010 : (age < this.ADULT_AGE ? 0.0025 : 0.0038);
                const diseaseProb = (baseDisease * winterFactor * crowdingFactor) / medicineMitigation;

                const roll = rng.next();
                if (roll < diseaseProb) {
                    const pool = isWinter
                        ? ['Winter lung fever', 'Bitter hearth chill', 'Frostbite gangrene', 'Seasonal chest rot']
                        : ['Marsh ague', 'Wasting fever', 'Camp dysentery', 'Sweating sickness', 'Spotted pox'];
                    const detail = pool[Math.floor(rng.next() * pool.length)];
                    hazards.push({ agent, cause: 'disease', detail });
                    continue;
                }

                // Occupational accident for working non-military adults
                let accidentProb = 0;
                if (agent.lifeStage === 'adult' && !agent.militaryDuty && agent.job && agent.job !== 'unemployed') {
                    accidentProb = (agent.job === 'miner' || agent.job === 'lumberjack' || agent.job === 'hunter')
                        ? 0.0030
                        : 0.0018;
                }
                if (accidentProb > 0 && roll < diseaseProb + accidentProb) {
                    const detail = this._pickAccidentDetail(agent.job, rng);
                    hazards.push({ agent, cause: 'accident', detail });
                    continue;
                }

                // Very rare procedurally generated funny misadventure (ages 10+)
                if (age >= 10) {
                    const recklessBoost = ((agent.personality?.curious || 0) > 0.7 || (agent.personality?.brave || 0) > 0.75) ? 1.4 : 1.0;
                    const misadventureProb = 0.0015 * recklessBoost;
                    if (roll < diseaseProb + accidentProb + misadventureProb) {
                        const detail = this._generateMisadventureDetail(rng);
                        hazards.push({ agent, cause: 'misadventure', detail });
                        continue;
                    }
                }
            }
        }

        for (let i = 0; i < expired.length; i++) {
            this.handleDeath(expired[i], 'old_age', 'Passed peacefully of old age');
        }
        for (let i = 0; i < hazards.length; i++) {
            const h = hazards[i];
            this.handleDeath(h.agent, h.cause, h.detail);
        }
    }

    _pickAccidentDetail(job, rng) {
        const byJob = {
            miner: ['Deep shaft cave-in', 'Firedamp tunnel blast', 'Collapsed ore hoist'],
            lumberjack: ['Felled by a falling ancient oak', 'Pinned beneath rolling logs', 'Sawmill kickback injury'],
            builder: ['Scaffolding collapse', 'Crushed by a dropped masonry block', 'Stepped off an unfinished roofline'],
            hunter: ['Gored by a cornered wild boar', 'Sprung bear trap mishap', 'Fell from a mossy crag while stalking'],
            craftsman: ['Forge crucible burst', 'Kiln overheat collapse', 'Chisel & anvil splinter wound'],
            farmer: ['Grain wagon overturn', 'Kicked by a startled plow ox', 'Thresher blade mishap'],
            gatherer: ['Ate suspiciously bright forest berries', 'Slipped down a slick ravine', 'Bitten by a riverbank viper'],
            priest: ['Brazier incense asphyxiation', 'Bell-tower rope snap', 'Collapsed sanctuary stone'],
        };
        const pool = byJob[job] || ['Slip on wet cobblestones', 'Runaway cart collision', 'Hearth grease fire'];
        return pool[Math.floor(rng.next() * pool.length)];
    }

    _generateMisadventureDetail(rng) {
        const actions = [
            'Tried to juggle lit torches',
            'Chased a runaway wheel of cheese',
            'Attempted to hug a suspiciously fluffy wild bear',
            'Tested whether lightning strikes twice',
            'Tried to teach a stubborn mule to swim',
            'Entered an intense staring contest with a badger',
            'Attempted to brew ale out of swamp mushrooms',
            'Tried to ride a greased barrel down the watchtower stairs',
            'Dared a rival to catch a falling anvil',
            'Snoozed inside a grain chute during harvest',
            'Tried to pet a wild bull moose',
            'Attempted a heroic backflip off the granary roof',
        ];
        const twists = [
            'with predictably catastrophic results',
            'directly into a shallow town well',
            'moments before sunset',
            'to the lasting bewilderment of the town elders',
            'while wearing ceremonial wooden clogs',
            'against everyone’s shouted advice',
        ];
        const a = actions[Math.floor(rng.next() * actions.length)];
        const t = twists[Math.floor(rng.next() * twists.length)];
        return `${a} ${t}`;
    }

    onBecomeAdult(agent) {
        agent.lifeStage = 'adult';
        agent.canMarry = true;
        agent.canWork = true;
        
        if ((!agent.job || agent.job === 'unemployed') && this.sim.economySystem) {
            const availableJobs = ['gatherer', 'farmer', 'lumberjack', 'miner', 'builder', 'craftsman'];
            this.sim.economySystem.assignJob(agent, availableJobs);
        }

        if (typeof agent.addLifeEvent === 'function') {
            agent.addLifeEvent('ADULT', 'Came of age and entered adulthood', this.sim?.clock?.tick ?? 0, '🎓', true);
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

        if (typeof agent.addLifeEvent === 'function') {
            agent.addLifeEvent('ELDER', 'Entered elderhood as a respected sage', this.sim?.clock?.tick ?? 0, '🕯️', true);
        }
        
        this.eventBus.emit('agent:elder', { 
            id: agent.id, 
            name: agent.name 
        });
    }

    handleDeath(agent, cause, detail = null) {
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
        
        // Deterministic heirloom inheritance: transfer existing heirloom, relic weapon,
        // or newly consecrated family keepsake (for monarchs, veterans, master builders)
        // to the eldest living child (or sibling/spouse fallback). Zero RNG.
        this._bequeathHeirloomOnDeath(agent);

        agent.alive = false;
        agent.deathCause = cause || 'old_age';
        if (detail) agent.deathDetail = detail;

        if (typeof agent.addLifeEvent === 'function' && (!agent.lifeHistory || !agent.lifeHistory.some(e => e.kind === 'DEATH'))) {
            const iconMap = { disease: '🤒', accident: '⚠️', misadventure: '🤪', old_age: '🕯️' };
            const icon = iconMap[agent.deathCause] || '🕯️';
            const ageYr = Math.floor(agent.age || 0);
            const text = agent.deathDetail
                ? `Died at age ${ageYr} (${agent.deathCause.replace(/_/g, ' ')}): ${agent.deathDetail}`
                : `Died of ${agent.deathCause.replace(/_/g, ' ')} at age ${ageYr}`;
            agent.addLifeEvent('DEATH', text, this.sim?.clock?.tick ?? 0, icon, true);
        }

        this.sim.removeAgent(agent.id, agent.deathCause);
        
        this.eventBus.emit('agent:died', {
            id: agent.id,
            name: agent.name,
            age: agent.age,
            cause: agent.deathCause,
            detail: agent.deathDetail || null
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
                const nx = Math.max(2, Math.min((this.sim.world?.width || 160) - 2, agent.x + jx));
                const ny = Math.max(2, Math.min((this.sim.world?.height || 160) - 2, agent.y + jy));
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

    _bequeathHeirloomOnDeath(agent) {
        if (!agent || agent._heirloomBequeathed) return null;
        agent._heirloomBequeathed = true;
        const tick = this.sim?.clock?.tick ?? 0;
        const year = Math.floor(tick / 400) + 1;
        const surname = agent.surname || 'House';
        const fullName = agent.surname && !String(agent.name || '').includes(agent.surname)
            ? `${agent.name} ${agent.surname}`
            : (agent.name || 'Ancestor');

        let heirloom = agent.heirloom ? { ...agent.heirloom } : null;
        if (!heirloom) {
            if (agent.legendaryWeapon) {
                heirloom = { name: agent.legendaryWeapon, kind: 'relic', originName: fullName, originYear: year, generationsHeld: 1 };
            } else if (agent.isMonarch) {
                heirloom = { name: `${surname} Royal Signet`, kind: 'crown', originName: fullName, originYear: year, generationsHeld: 1 };
            } else if ((agent.buildingsBuilt || 0) >= 2) {
                heirloom = { name: `${surname} Master Compasses`, kind: 'craft', originName: fullName, originYear: year, generationsHeld: 1 };
            } else if ((agent.kills || 0) >= 2) {
                heirloom = { name: `${surname} Veteran Blade`, kind: 'blade', originName: fullName, originYear: year, generationsHeld: 1 };
            } else if ((agent.age || 0) >= 62 && (agent.children || 0) >= 1) {
                heirloom = { name: `${surname} Hearth Seal`, kind: 'keepsake', originName: fullName, originYear: year, generationsHeld: 1 };
            }
        }
        if (!heirloom) return null;

        const rels = this.sim?.relationshipSystem?.getRelatives?.(agent.id);
        const resolveLiving = (ids) => (ids || [])
            .map(id => (typeof this.sim?._agentById === 'function' ? this.sim._agentById(id) : null))
            .filter(a => a && a.alive && a.id !== agent.id)
            .sort((a, b) => (b.age - a.age) || (a.id - b.id));

        const livingChildren = resolveLiving(rels?.children);
        const livingSiblings = resolveLiving(rels?.siblings);
        const livingSpouse = rels?.spouse ? resolveLiving([rels.spouse]) : [];
        const heir = livingChildren[0] || livingSiblings[0] || livingSpouse[0] || null;
        if (!heir) return null;

        heir.heirloom = {
            ...heirloom,
            inheritedFrom: fullName,
            generationsHeld: (heirloom.generationsHeld || 1) + (agent.heirloom ? 1 : 0)
        };
        const heirFull = heir.surname && !String(heir.name || '').includes(heir.surname)
            ? `${heir.name} ${heir.surname}`
            : (heir.name || 'Heir');
        if (typeof heir.addLifeEvent === 'function') {
            heir.addLifeEvent('HEIRLOOM', `Inherited "${heir.heirloom.name}" from ${fullName}`, tick, '💍', true);
        }
        if (typeof agent.addLifeEvent === 'function') {
            agent.addLifeEvent('HEIRLOOM', `Bequeathed "${heirloom.name}" to ${heirFull}`, tick, '💍', true);
        }
        return heir;
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
