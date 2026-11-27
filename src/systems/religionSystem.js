/**
 * Religion System
 * Handles faith, priests, temples, rituals, and religious buffs.
 */

import { ENTITY_TYPES, JOB_TYPES } from '../core/constants.js';
import { distance } from '../utils/math.js';
import { RNG } from '../core/rng.js';

export const TENET_PROFILES = {
  zealous:    { icon: "🔥", color: "#ef4444", tenet: "Crusade & Orthodoxy",   warAffinity: 0.7 },
  pacifist:   { icon: "🕊️", color: "#38bdf8", tenet: "Mercy & Concord",       warAffinity: 0.05 },
  mercantile: { icon: "☀️", color: "#f59e0b", tenet: "Light & Prosperity",    warAffinity: 0.3 },
  ancestral:  { icon: "🕯️", color: "#a855f7", tenet: "Ancestral Veneration",  warAffinity: 0.25 },
  nature:     { icon: "🌿", color: "#10b981", tenet: "Harmony with Nature",   warAffinity: 0.2 },
  scholarly:  { icon: "📜", color: "#6366f1", tenet: "Sacred Wisdom",         warAffinity: 0.2 },
};

const TENET_MATRIX = {
  zealous:    { zealous: -0.85, pacifist: -0.65, mercantile: -0.4,  ancestral: -0.35, nature: -0.55, scholarly: -0.3 },
  pacifist:   { zealous: -0.65, pacifist:  0.90, mercantile:  0.55, ancestral:  0.45, nature:  0.70, scholarly:  0.65 },
  mercantile: { zealous: -0.40, pacifist:  0.55, mercantile:  0.60, ancestral:  0.35, nature:  0.30, scholarly:  0.45 },
  ancestral:  { zealous: -0.35, pacifist:  0.45, mercantile:  0.35, ancestral:  0.80, nature:  0.50, scholarly:  0.55 },
  nature:     { zealous: -0.55, pacifist:  0.70, mercantile:  0.30, ancestral:  0.50, nature:  0.85, scholarly:  0.40 },
  scholarly:  { zealous: -0.30, pacifist:  0.65, mercantile:  0.45, ancestral:  0.55, nature:  0.40, scholarly:  0.85 },
};

const FAITH_PREFIXES = [
  "Order of the", "Covenant of", "Path of the", "Sanctum of",
  "Fellowship of the", "Church of", "Keepers of the", "Way of"
];
const FAITH_EPITHETS = [
  "Dawn Flame", "Verdant Crown", "Silver Lantern", "Iron Oath",
  "Silent Stones", "Starlit Tide", "Ashen Vigil", "Sacred Hearth",
  "Eternal Spire", "Golden Bough", "Pale Bell", "Living Waters"
];
const TENET_KEYS = Object.keys(TENET_PROFILES);

export const BELIEF_CREEDS = {
  solar_creed: {
    id: "solar_creed",
    name: "Solar Creed",
    icon: "☀️",
    tenet: "Light & Prosperity",
    tenetType: "mercantile",
    color: "#f59e0b"
  },
  grove_communion: {
    id: "grove_communion",
    name: "Grove Communion",
    icon: "🌿",
    tenet: "Harmony with Nature",
    tenetType: "nature",
    color: "#10b981"
  },
  forge_doctrine: {
    id: "forge_doctrine",
    name: "Forge Doctrine",
    icon: "⚒️",
    tenet: "Iron & Resolve",
    tenetType: "zealous",
    color: "#ef4444"
  },
  ancestral_pact: {
    id: "ancestral_pact",
    name: "Ancestral Pact",
    icon: "📜",
    tenet: "Ancient Wisdom",
    tenetType: "ancestral",
    color: "#a855f7"
  }
};

export class ReligionSystem {
    constructor(worldState, simulation = null) {
        this.worldState = worldState;
        this.simulation = simulation;
        this.priests = new Set();
        this.activeRituals = new Map(); // templeId -> ritual data
        this.customCreeds = new Map();  // creedId -> procedural creed metadata
        this.faithDecayRate = 0.05; // Faith lost per tick without temple
        this._fallbackRng = null;
    }

    // Seeded RNG accessor. Always routes through the shared simulation RNG
    // stream for 100% determinism.
    _rng() {
        if (this.simulation && typeof this.simulation._rng === 'function') {
            return this.simulation._rng();
        }
        if (this.worldState && this.worldState.rng) return this.worldState.rng;
        if (!this._fallbackRng) this._fallbackRng = new RNG(0);
        return this._fallbackRng;
    }

    getCreed(id) {
        if (!id) return null;
        return this.customCreeds.get(id) || BELIEF_CREEDS[id] || null;
    }

    registerCustomCreed(creed) {
        if (!creed || !creed.id) return null;
        this.customCreeds.set(creed.id, { ...creed });
        return this.customCreeds.get(creed.id);
    }

    /**
     * Pure deterministic procedural creed generator driven by a local hashed RNG
     * (never mutates world.rng so existing simulation streams stay byte-identical).
     */
    generateProceduralCreed(seedBasis, index = 0) {
        const h = ((((Number(seedBasis) || 1) * 2654435761) ^ ((index + 1) * 1597334677)) >>> 0);
        const localRng = new RNG(h || 1337);
        const prefix = FAITH_PREFIXES[Math.floor(localRng.next() * FAITH_PREFIXES.length)];
        const epithet = FAITH_EPITHETS[Math.floor(localRng.next() * FAITH_EPITHETS.length)];
        const tenetType = TENET_KEYS[Math.floor(localRng.next() * TENET_KEYS.length)];
        const profile = TENET_PROFILES[tenetType] || TENET_PROFILES.ancestral;
        const id = `proc_${tenetType}_${h.toString(36).slice(0, 6)}`;
        if (this.customCreeds.has(id)) return this.customCreeds.get(id);
        const creed = {
            id,
            name: `${prefix} ${epithet}`,
            icon: profile.icon,
            tenet: profile.tenet,
            tenetType,
            color: profile.color,
            procedural: true,
        };
        this.customCreeds.set(id, creed);
        return creed;
    }

    /**
     * Doctrinal compatibility in [-1, +1] between two belief IDs.
     * Shared faith = +1.0; ecumenical tenets > 0; zealous clash < -0.5.
     */
    getCreedCompatibility(f1, f2) {
        if (!f1 || !f2) return 0;
        if (f1 === f2) return 1.0;
        const c1 = this.getCreed(f1);
        const c2 = this.getCreed(f2);
        const t1 = c1?.tenetType || 'mercantile';
        const t2 = c2?.tenetType || 'mercantile';
        return TENET_MATRIX[t1]?.[t2] ?? -0.1;
    }

    /**
     * Initialize religion and procedural/core creeds across founded settlements and citizens
     * without consuming any draws from the shared world RNG stream.
     */
    initWorldBeliefs() {
        if (!this.simulation?.settlementSystem) return;
        const coreKeys = Object.keys(BELIEF_CREEDS);
        const worldSeed = Number(this.simulation?.seed ?? this.worldState?.seed ?? 1);
        for (const s of this.simulation.settlementSystem.settlements.values()) {
            if (!s.culture) s.culture = {};
            if (!s.culture.beliefId) {
                if ((s.id % 3) === 0) {
                    s.culture.beliefId = coreKeys[(s.id - 1) % coreKeys.length];
                } else {
                    const proc = this.generateProceduralCreed(worldSeed + s.id * 97, s.id);
                    s.culture.beliefId = proc.id;
                }
            } else if (!this.getCreed(s.culture.beliefId)) {
                this.generateProceduralCreed(worldSeed + s.id * 31, s.id);
            }
            if (s.agentIds) {
                for (const aid of s.agentIds) {
                    const a = this.simulation._agentById(aid);
                    if (a) {
                        this.initReligionEntity(a);
                        a.religion.beliefId = s.culture.beliefId;
                        a.religion.faith = 65;
                    }
                }
            }
        }
    }

    /**
     * Get dominant faith for a settlement
     */
    getDominantFaith(settlement) {
        if (!this.simulation) return settlement?.culture?.beliefId || 'solar_creed';
        const counts = new Map();
        if (settlement.agentIds) {
            for (const aid of settlement.agentIds) {
                const a = this.simulation._agentById(aid);
                if (!a || !a.alive) continue;
                const b = a.religion?.beliefId;
                if (!b) continue;
                counts.set(b, (counts.get(b) || 0) + 1);
            }
        }
        let best = settlement?.culture?.beliefId || 'solar_creed';
        let bestN = 0;
        for (const [b, n] of counts) {
            if (n > bestN) { best = b; bestN = n; }
        }
        return best;
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
        
        // Inherit settlement belief if available
        if (!agent.religion.beliefId && agent.settlementId && this.simulation?.settlementSystem) {
            const s = this.simulation.settlementSystem.settlements.get(agent.settlementId);
            if (s && s.culture?.beliefId) {
                agent.religion.beliefId = s.culture.beliefId;
            }
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
    checkPriestEmergence(agent, temples = null) {
        if (!agent.religion) this.initReligionEntity(agent);
        if (agent.religion.isPriest) return;
        
        // Fast-fail priest requirements before spatial building scan
        if (agent.religion.faith < 80) return;
        if ((agent.personality.social ?? 0) < 0.7) return;
        if (agent.currentJob && agent.job !== JOB_TYPES.IDLE) return;
        
        if (temples) {
            for (let i = 0; i < temples.length; i++) {
                const b = temples[i];
                const dx = agent.x - b.x;
                const dy = agent.y - b.y;
                if (dx * dx + dy * dy <= 100) { // radius 10
                    this.promoteToPriest(agent);
                    return;
                }
            }
        } else if (this.hasNearbyTemple(agent)) {
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

    _isActiveSacredBuilding(b) {
        if (!b) return false;
        const bt = b.buildingType || b.type;
        if (bt !== 'temple' && bt !== 'church' && bt !== 'shrine') return false;
        if (!(b.complete || b.isComplete)) return false;
        if (b.isRuined) return false;
        if (b.health !== undefined && b.health <= 0) return false;
        return true;
    }

    /**
     * Check if there's a temple/shrine/church nearby
     */
    hasNearbyTemple(agent, radius = 10) {
        const buildings = this.worldState.buildings || [];
        return buildings.some(b =>
            this._isActiveSacredBuilding(b) &&
            distance(agent.x, agent.y, b.x, b.y) <= radius
        );
    }

    /**
     * Get nearest active temple/shrine/church for an agent
     */
    getNearestTemple(agent) {
        const buildings = this.worldState.buildings || [];
        let nearest = null;
        let minDist = Infinity;
        
        for (const b of buildings) {
            if (this._isActiveSacredBuilding(b)) {
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
        const buildings = this.worldState.buildings || [];
        const temples = [];
        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            if (this._isActiveSacredBuilding(b)) {
                temples.push(b);
            }
        }
        const hasTemples = temples.length > 0;

        const agents = this.worldState.agents || [];
        for (let aIdx = 0; aIdx < agents.length; aIdx++) {
            const agent = agents[aIdx];
            if (agent.dead || agent.alive === false) continue;
            
            if (!agent.religion) this.initReligionEntity(agent);
            
            // Natural faith decay
            agent.religion.faith -= this.faithDecayRate;
            
            // Bonus if near temple (squared distance check, no square roots)
            if (hasTemples) {
                for (let i = 0; i < temples.length; i++) {
                    const t = temples[i];
                    const dx = agent.x - t.x;
                    const dy = agent.y - t.y;
                    if (dx * dx + dy * dy <= 25) { // dist <= 5
                        agent.religion.faith += 0.1; // Temple bonus
                        break;
                    }
                }
            }
            
            // Clamp faith
            agent.religion.faith = Math.max(0, Math.min(100, agent.religion.faith));
            
            // Check priest emergence (reusing already filtered temples list)
            if (hasTemples) this.checkPriestEmergence(agent, temples);
            
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
        const ritualTick = this.simulation?.clock?.tick ?? this.worldState?.simulation?.clock?.tick ?? 0;
        this.activeRituals.set(temple.id, {
            startTime: ritualTick,
            duration: 300,
            priestId: priest.id
        });
    }

    /**
     * Inspire faith and optionally spread a settlement creed in an area (Divine Miracle).
     */
    inspireArea(x, y, radius = 9, targetBeliefId = null) {
        const agents = this.worldState?.agents || this.simulation?.agents || [];
        let inspired = 0;
        let converted = 0;
        for (const a of agents) {
            if (!a || !a.alive) continue;
            if (Math.hypot(a.x - x, a.y - y) > radius) continue;
            if (!a.religion) this.initReligionEntity(a);
            a.religion.faith = Math.min(100, (a.religion.faith ?? 50) + 25);
            if (targetBeliefId && this.getCreed(targetBeliefId) && a.religion.beliefId !== targetBeliefId) {
                a.religion.beliefId = targetBeliefId;
                converted++;
            }
            if (a.needs) {
                a.needs.social = Math.min(100, (a.needs.social ?? 50) + 15);
            }
            inspired++;
        }
        return { inspired, converted };
    }

    /**
     * Missionary conversion & Heresy spread (Phase 3b Step 6):
     * Devout priests and missionaries visit neighboring towns of differing faiths,
     * converting citizens, sparking theological friction and religious schisms.
     */
    checkMissionariesAndHeresy(tick = 0) {
        if (!this.simulation || !this.simulation.settlementSystem) return;
        if (tick % 100 !== 0) return;

        const settlements = Array.from(this.simulation.settlementSystem.settlements.values());
        if (settlements.length < 2) return;

        for (const s of settlements) {
            if (s.ruined) continue;
            const domFaith = this.getDominantFaith(s);

            // Find an eligible devout missionary or priest
            let missionary = null;
            if (s.agentIds) {
                for (const aid of s.agentIds) {
                    const a = this.simulation._agentById(aid);
                    if (a && a.alive && (a.religion?.isPriest || a.job === 'priest' || (a.religion?.faith ?? 0) >= 75)) {
                        missionary = a;
                        break;
                    }
                }
            }
            if (!missionary) continue;

            // Pick a rival/neighboring town with a different dominant faith
            const rivals = settlements.filter(other => other.id !== s.id && !other.ruined && this.getDominantFaith(other) !== domFaith);
            if (rivals.length === 0) continue;

            // Deterministic pick: nearest rival
            let targetTown = null;
            let minDist = Infinity;
            for (const r of rivals) {
                const d = Math.hypot(s.center.x - r.center.x, s.center.y - r.center.y);
                if (d < minDist) { minDist = d; targetTown = r; }
            }
            if (!targetTown) continue;

            // Missionary converts a citizen in target town
            let targetCitizen = null;
            if (targetTown.agentIds) {
                for (const aid of targetTown.agentIds) {
                    const c = this.simulation._agentById(aid);
                    if (c && c.alive && c.religion?.beliefId !== domFaith && !c.religion?.isPriest) {
                        targetCitizen = c;
                        break;
                    }
                }
            }
            if (!targetCitizen) continue;

            // Conversion!
            this.initReligionEntity(targetCitizen);
            const prevFaith = targetCitizen.religion.beliefId;
            targetCitizen.religion.beliefId = domFaith;
            targetCitizen.religion.faith = 60;

            if (this.simulation.eventBus) {
                this.simulation.eventBus.emit("HERESY_SPREAD", {
                    missionaryId: missionary.id,
                    missionaryHomeId: s.id,
                    targetSettlementId: targetTown.id,
                    convertedAgentId: targetCitizen.id,
                    beliefId: domFaith
                });
            }

            // Grievance in target town against the proselytizing settlement
            if (this.simulation.diplomacySystem) {
                this.simulation.diplomacySystem.addGrievance(targetTown.id, s.id, "Heretical Infiltration & Conversion", 18);
            }

            // Check if religious schism threshold reached (>= 2 heretics in town)
            let hereticCount = 0;
            if (targetTown.agentIds) {
                for (const aid of targetTown.agentIds) {
                    const a = this.simulation._agentById(aid);
                    if (a && a.alive && a.religion?.beliefId === domFaith) {
                        hereticCount++;
                    }
                }
            }

            if (hereticCount >= 2 && !targetTown._schismReported) {
                targetTown._schismReported = true;
                if (this.simulation.eventBus) {
                    this.simulation.eventBus.emit("RELIGIOUS_SCHISM", {
                        settlementId: targetTown.id,
                        dominantFaith: prevFaith,
                        hereticFaith: domFaith
                    });
                }
                if (this.simulation.chronicleSystem?.addEntry) {
                    const creedName = this.getCreed(domFaith)?.name || domFaith;
                    this.simulation.chronicleSystem.addEntry(
                        "RELIGIOUS_SCHISM",
                        `🔥 Religious Schism in ${targetTown.name}! Foreign missionaries from ${s.name} have converted citizens to the ${creedName}.`
                    );
                }
            }
        }
    }

    /**
     * Inquisitor actions (Phase 3b Step 6):
     * Priests and defenders root out foreign heresies within their settlement,
     * re-converting heretics to state orthodoxy.
     */
    checkInquisitions(tick = 0) {
        if (!this.simulation || !this.simulation.settlementSystem) return;
        if (tick % 80 !== 0) return;

        for (const s of this.simulation.settlementSystem.settlements.values()) {
            if (s.ruined) continue;
            const domFaith = this.getDominantFaith(s);

            let inquisitor = null;
            if (s.agentIds) {
                for (const aid of s.agentIds) {
                    const a = this.simulation._agentById(aid);
                    if (a && a.alive && (a.religion?.isPriest || a.job === 'priest' || a.job === 'soldier')) {
                        inquisitor = a;
                        break;
                    }
                }
            }
            if (!inquisitor) continue;

            if (s.agentIds) {
                for (const aid of s.agentIds) {
                    const a = this.simulation._agentById(aid);
                    if (a && a.alive && a.religion?.beliefId && a.religion.beliefId !== domFaith) {
                        const hereticFaith = a.religion.beliefId;
                        a.religion.beliefId = domFaith;
                        a.religion.faith = 40;

                        if (this.simulation.eventBus) {
                            this.simulation.eventBus.emit("HERETIC_CLEANSED", {
                                inquisitorId: inquisitor.id,
                                hereticId: a.id,
                                settlementId: s.id,
                                cleansedFaith: hereticFaith,
                                stateFaith: domFaith
                            });
                        }

                        if (this.simulation.chronicleSystem?.addEntry) {
                            this.simulation.chronicleSystem.addEntry(
                                "INQUISITION",
                                `⚖️ The Inquisition in ${s.name} cleansed foreign heresy, reconverting ${a.name} to the true faith.`
                            );
                        }
                        break;
                    }
                }
            }
        }
    }

    /**
     * Handle holy war tensions between different beliefs
     */
    checkHolyWars() {
        if (!this.simulation || !this.simulation.diplomacySystem || !this.simulation.settlementSystem) return;
        const settlements = Array.from(this.simulation.settlementSystem.settlements.values());
        const count = settlements.length;
        if (count < 2) return;

        // Precompute each settlement's dominant faith once per tick instead of O(N^2 * agents)
        const faiths = new Array(count);
        for (let i = 0; i < count; i++) {
            faiths[i] = this.getDominantFaith(settlements[i]);
        }

        const diplo = this.simulation.diplomacySystem;
        for (let i = 0; i < count; i++) {
            const s1 = settlements[i];
            const f1 = faiths[i];
            if (!f1) continue;
            for (let j = i + 1; j < count; j++) {
                const f2 = faiths[j];
                if (f2 && f1 !== f2) {
                    const s2 = settlements[j];
                    const rel = diplo.getRelation(s1.id, s2.id);
                    if (rel && rel.status === "tension") {
                        diplo.addGrievance(s1.id, s2.id, "Zealous Crusade Grievance", 12);
                        diplo.addGrievance(s2.id, s1.id, "Zealous Crusade Grievance", 12);
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
     * Priest action: conjure a spectral ancestor spirit linked to a cemetery tomb or shrine.
     */
    conjureFallenSpirit(priest, anchor = null) {
        const sim = this.simulation;
        if (!sim || !priest || !priest.alive) return null;
        const tick = sim.clock?.tick ?? 0;
        if ((priest._lastConjureTick ?? -999) > tick - 80) return null;

        if (!Array.isArray(sim.spectralSpirits)) sim.spectralSpirits = [];
        if (sim.spectralSpirits.length >= 6) return null;
        const sid = priest.settlementId ?? null;
        const townSpirits = sim.spectralSpirits.filter(sp => sp && sp.settlementId === sid);
        if (townSpirits.length >= 2) return null;

        // Choose ancestor deterministically via cemetery roster -> _deadDossiers -> fallenHeroes
        let ancestorId = null;
        let ancestorName = null;
        const rng = this._rng();

        if (anchor && Array.isArray(anchor.interredAgentIds) && anchor.interredAgentIds.length > 0) {
            const pickId = anchor.interredAgentIds[Math.floor(rng.next() * anchor.interredAgentIds.length)];
            const dossier = typeof sim.getAgentDossier === 'function' ? sim.getAgentDossier(pickId) : null;
            if (dossier) {
                ancestorId = dossier.id;
                ancestorName = dossier.fullName || dossier.name;
            }
        }
        if (!ancestorName && Array.isArray(sim._deadDossiers) && sim._deadDossiers.length > 0) {
            const pool = sim._deadDossiers.filter(d => sid == null || d.settlementId === sid);
            const list = pool.length > 0 ? pool : sim._deadDossiers;
            const d = list[Math.floor(rng.next() * list.length)];
            if (d) {
                ancestorId = d.id;
                ancestorName = d.fullName || d.name;
            }
        }
        if (!ancestorName && Array.isArray(sim.fallenHeroes) && sim.fallenHeroes.length > 0) {
            const h = sim.fallenHeroes[Math.floor(rng.next() * sim.fallenHeroes.length)];
            if (h) {
                ancestorId = h.id;
                ancestorName = h.fullName || h.name;
            }
        }
        if (!ancestorName) {
            ancestorName = 'Ancestral Shade';
        }

        const ax = anchor?.x ?? priest.x;
        const ay = anchor?.y ?? priest.y;
        const ang = rng.next() * Math.PI * 2;
        const spirit = {
            id: sim.idGen.next(),
            agentId: ancestorId,
            name: ancestorName,
            beliefId: priest.religion?.beliefId || 'ancestral_pact',
            settlementId: sid,
            x: ax + Math.cos(ang) * 0.8,
            y: ay + Math.sin(ang) * 0.8,
            anchorX: ax,
            anchorY: ay,
            phase: ang,
            createdAt: tick,
            expiresAt: tick + 160,
        };
        priest._lastConjureTick = tick;
        sim.spectralSpirits.push(spirit);

        if (typeof priest.addLifeEvent === 'function') {
            priest.addLifeEvent('RITUAL', `Conjured the spirit of ${ancestorName}`, tick, '👻', false);
        }
        if (sim.eventBus) {
            sim.eventBus.emit('SPIRIT_CONJURED', {
                spiritId: spirit.id,
                agentId: spirit.agentId,
                name: spirit.name,
                priestId: priest.id,
                settlementId: sid,
                x: spirit.x,
                y: spirit.y,
            });
        }
        return spirit;
    }

    updateSpectralSpirits(tick = 0) {
        const sim = this.simulation;
        if (!sim || !Array.isArray(sim.spectralSpirits) || sim.spectralSpirits.length === 0) return;

        let writeIdx = 0;
        const agents = sim.agents || [];
        for (let i = 0; i < sim.spectralSpirits.length; i++) {
            const sp = sim.spectralSpirits[i];
            if (!sp || tick >= (sp.expiresAt ?? 0)) continue;
            sp.phase = (sp.phase || 0) + 0.14;
            const cx = sp.anchorX ?? sp.x;
            const cy = sp.anchorY ?? sp.y;
            sp.x = cx + Math.cos(sp.phase) * 1.4;
            sp.y = cy + Math.sin(sp.phase) * 1.4;

            if (tick % 10 === 0) {
                for (let j = 0; j < agents.length; j++) {
                    const a = agents[j];
                    if (!a || !a.alive) continue;
                    if (sp.settlementId != null && a.settlementId !== sp.settlementId) continue;
                    const dx = a.x - sp.x;
                    const dy = a.y - sp.y;
                    if (dx * dx + dy * dy <= 36) { // radius 6
                        if (a.religion) a.religion.faith = Math.min(100, (a.religion.faith || 50) + 1.5);
                        if (a.needs) {
                            a.needs.social = Math.min(100, (a.needs.social ?? 50) + 1.2);
                            if (a.needs.morale != null) a.needs.morale = Math.min(100, a.needs.morale + 1.2);
                        }
                    }
                }
            }
            sim.spectralSpirits[writeIdx++] = sp;
        }
        sim.spectralSpirits.length = writeIdx;
    }

    /**
     * Main update loop
     */
    update() {
        const tick = this.simulation?.clock?.tick ?? 0;
        this.updateFaith();
        this.updatePriests();
        this.updateSpectralSpirits(tick);
        this.checkMissionariesAndHeresy(tick);
        this.checkInquisitions(tick);
        this.checkHolyWars();
        
        // Cleanup old rituals
        for (const [templeId, ritual] of this.activeRituals.entries()) {
            if (tick - ritual.startTime > ritual.duration) {
                this.activeRituals.delete(templeId);
            }
        }
    }
}
