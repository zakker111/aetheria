/**
 * Combat System
 * Handles health, damage, targeting, battles, and siege mechanics.
 * Decoupled from FactionSystem for better modularity.
 */

import { ENTITY_TYPES } from '../core/constants.js';
import { distance } from '../utils/math.js';

export class CombatSystem {
    constructor(worldState) {
        this.worldState = worldState;
        this.combatants = new Set(); // Entities currently in combat
        this.battleLog = [];
    }

    /**
     * Initialize combat capabilities for an entity
     */
    initCombatEntity(entity) {
        if (!entity.combat) {
            entity.combat = {
                health: entity.type === ENTITY_TYPES.AGENT ? 100 : 50,
                maxHealth: entity.type === ENTITY_TYPES.AGENT ? 100 : 50,
                damage: entity.type === ENTITY_TYPES.AGENT ? 10 : 5,
                range: 1.5, // Melee range
                attackCooldown: 0,
                attackSpeed: 60, // Frames between attacks
                targetId: null,
                isAttacking: false,
                attackFlashTicks: 0
            };
        }
    }

    /**
     * Deal damage to a target entity
     */
    dealDamage(attacker, target, amount) {
        if (!target.combat) return false;

        const actualDamage = Math.max(1, Math.floor(amount * (1 - (target.defense || 0))));
        target.combat.health -= actualDamage;

        // Visual feedback hook (called by renderer)
        if (target.visuals) {
            target.visuals.flashRed = 5; // Flash red for 5 frames
        }

        this.worldState.events.trigger('entity_damaged', {
            target: target,
            attacker: attacker,
            damage: actualDamage
        });

        if (target.combat.health <= 0) {
            this.handleDeath(target, attacker);
            return true; // Target died
        }
        return false; // Target survived
    }

    /**
     * Handle entity death
     */
    handleDeath(entity, killer) {
        entity.dead = true;
        entity.state = 'dead';
        
        // Drop loot (simplified)
        if (entity.inventory) {
            // Drop half inventory on ground (TODO: Implement ground items)
        }

        this.worldState.events.trigger('entity_death', {
            entity: entity,
            killer: killer,
            faction: entity.factionId
        });

        // Remove from combatants set
        this.combatants.delete(entity.id);
    }

    /**
     * Find nearest enemy for an entity based on faction relations
     */
    findNearestEnemy(entity) {
        if (!entity.factionId) return null;

        const myFaction = this.worldState.factions.get(entity.factionId);
        if (!myFaction) return null;

        let nearest = null;
        let minDist = Infinity;
        const searchRadius = 20; // Aggro radius

        // Check agents
        for (const agent of this.worldState.agents) {
            if (agent.dead || agent.id === entity.id) continue;
            if (!agent.factionId) continue;

            const relation = myFaction.getRelation(agent.factionId);
            if (relation <= 0) { // Hostile or neutral-aggressive
                const d = distance(entity.x, entity.y, agent.x, agent.y);
                if (d < searchRadius && d < minDist) {
                    minDist = d;
                    nearest = agent;
                }
            }
        }

        // Check animals (if implemented)
        // Check buildings (for siege)

        return nearest;
    }

    /**
     * Update combat state for all entities
     */
    update() {
        const agents = this.worldState.agents || [];
        
        for (const agent of agents) {
            if (!agent.alive) continue;
            
            // Ensure combat stats exist
            if (!agent.combat) this.initCombatEntity(agent);

            const combat = agent.combat;

            // Reduce cooldowns
            if (combat.attackCooldown > 0) combat.attackCooldown--;
            if (combat.attackFlashTicks > 0) {
                combat.attackFlashTicks--;
                if (combat.attackFlashTicks === 0) combat.isAttacking = false;
            }

            // If has target, validate it
            if (combat.targetId) {
                const target = this.worldState.getEntityById(combat.targetId);
                if (!target || target.dead) {
                    combat.targetId = null;
                    combat.isAttacking = false;
                } else {
                    const dist = distance(agent.x, agent.y, target.x, target.y);
                    
                    // In range? Attack
                    if (dist <= combat.range) {
                        if (combat.attackCooldown <= 0) {
                            this.dealDamage(agent, target, combat.damage);
                            combat.attackCooldown = combat.attackSpeed;
                            combat.isAttacking = true;
                            combat.attackFlashTicks = 12; // cleared after ~12 sim ticks (was wall-clock setTimeout)
                        }
                    } else {
                        // Move towards target
                        agent.state = 'combat_move';
                        agent.targetX = target.x;
                        agent.targetY = target.y;
                        combat.isAttacking = false;
                    }
                }
            } else {
                // No target: Look for enemies if idle or wandering
                if (agent.state === 'idle' || agent.state === 'wandering') {
                    const enemy = this.findNearestEnemy(agent);
                    if (enemy) {
                        combat.targetId = enemy.id;
                        this.combatants.add(agent.id);
                        this.worldState.events.trigger('combat_started', {
                            attacker: agent,
                            defender: enemy
                        });
                    }
                }
            }
        }

        // Cleanup dead combatants
        for (const id of this.combatants) {
            const entity = this.worldState.getEntityById(id);
            if (!entity || entity.dead) {
                this.combatants.delete(id);
            }
        }
    }

    /**
     * Force two entities to fight (God Tool / Events)
     */
    forceAttack(attacker, target) {
        if (!attacker.combat) this.initCombatEntity(attacker);
        attacker.combat.targetId = target.id;
        this.combatants.add(attacker.id);
    }

    /**
     * Siege Logic: Attack a building
     */
    siegeBuilding(agent, building) {
        if (!building.combat) {
            building.combat = {
                health: building.maxHealth || 500,
                maxHealth: building.maxHealth || 500,
                damage: 0, // Buildings don't attack back usually
                armor: 5
            };
        }

        const dist = distance(agent.x, agent.y, building.x, building.y);
        if (dist <= 2.0) { // Melee range for buildings
            if (agent.combat.attackCooldown <= 0) {
                const dmg = agent.combat.damage * 0.5; // Reduced damage vs buildings
                building.combat.health -= dmg;
                agent.combat.attackCooldown = agent.combat.attackSpeed;
                
                this.worldState.events.trigger('building_damaged', {
                    building: building,
                    attacker: agent,
                    damage: dmg
                });

                if (building.combat.health <= 0) {
                    this.worldState.events.trigger('building_destroyed', {
                        building: building,
                        destroyer: agent
                    });
                    building.destroyed = true;
                }
            }
            return true; // Engaged
        }
        return false; // Out of range
    }
}
