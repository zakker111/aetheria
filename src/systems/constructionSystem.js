/**
 * Construction System
 * Handles building placement, construction jobs, and progress tracking.
 */

import { ENTITY_TYPES, JOB_TYPES, BUILDING_TYPES } from '../core/constants.js';
import { distance } from '../utils/math.js';

export class ConstructionSystem {
    constructor(worldState) {
        this.worldState = worldState;
        this.pendingBuildings = []; // Buildings waiting to be constructed
        this.constructionQueue = new Map(); // buildingId -> {progress, requiredResources}
    }

    /**
     * Validate if a building can be placed at location
     * Returns: { valid: boolean, reason?: string }
     */
    validatePlacement(type, x, y, rotation = 0) {
        const tileSize = 1;
        const footprint = this.getBuildingFootprint(type, rotation);
        
        // Check map bounds
        const mapSize = this.worldState.map.size;
        for (let dx = 0; dx < footprint.width; dx++) {
            for (let dy = 0; dy < footprint.height; dy++) {
                const checkX = Math.floor(x + dx);
                const checkY = Math.floor(y + dy);
                
                if (checkX < 0 || checkX >= mapSize || checkY < 0 || checkY >= mapSize) {
                    return { valid: false, reason: 'Out of bounds' };
                }
                
                const tile = this.worldState.map.getTile(checkX, checkY);
                
                // Check terrain suitability
                if (!this.isTerrainSuitable(type, tile)) {
                    return { valid: false, reason: 'Unsuitable terrain' };
                }
                
                // Check for existing entities
                if (this.worldState.getEntityAt(checkX, checkY)) {
                    return { valid: false, reason: 'Space occupied' };
                }
            }
        }
        
        return { valid: true };
    }

    /**
     * Get building footprint based on type and rotation
     */
    getBuildingFootprint(type, rotation) {
        const baseSizes = {
            [BUILDING_TYPES.HOUSE]: { width: 2, height: 2 },
            [BUILDING_TYPES.WORKSHOP]: { width: 3, height: 2 },
            [BUILDING_TYPES.TEMPLE]: { width: 4, height: 3 },
            [BUILDING_TYPES.WALL]: { width: 1, height: 1 },
            [BUILDING_TYPES.FARM]: { width: 3, height: 3 },
            [BUILDING_TYPES.TOWER]: { width: 2, height: 2 },
            [BUILDING_TYPES.BARRACKS]: { width: 3, height: 3 },
            [BUILDING_TYPES.MARKET]: { width: 3, height: 2 }
        };
        
        const base = baseSizes[type] || { width: 2, height: 2 };
        
        // Swap dimensions if rotated 90 degrees
        if (rotation % 2 === 1) {
            return { width: base.height, height: base.width };
        }
        return base;
    }

    /**
     * Check if terrain is suitable for building type
     */
    isTerrainSuitable(type, tile) {
        // Water tiles cannot have buildings (except maybe docks - future feature)
        if (tile.biome === 'water' || tile.biome === 'ocean') {
            return false;
        }
        
        // Steep slopes are difficult (could allow with engineering tech later)
        if (tile.slope > 0.6) {
            return false;
        }
        
        // Walls can be built on more terrain types
        if (type === BUILDING_TYPES.WALL) {
            return tile.biome !== 'water';
        }
        
        return true;
    }

    /**
     * Create a new building blueprint
     */
    createBlueprint(type, x, y, factionId, rotation = 0) {
        const validation = this.validatePlacement(type, x, y, rotation);
        if (!validation.valid) {
            return { success: false, error: validation.reason };
        }
        
        const buildingData = this.getBuildingStats(type);
        const footprint = this.getBuildingFootprint(type, rotation);
        
        const building = {
            id: `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: ENTITY_TYPES.BUILDING,
            buildingType: type,
            x: x,
            y: y,
            rotation: rotation,
            factionId: factionId,
            width: footprint.width,
            height: footprint.height,
            
            // Construction state
            isComplete: false,
            constructionProgress: 0,
            maxConstructionProgress: buildingData.buildTime || 600,
            requiredResources: { ...buildingData.cost },
            remainingResources: { ...buildingData.cost },
            
            // Functional stats
            maxHealth: buildingData.maxHealth || 500,
            health: buildingData.maxHealth || 500,
            capacity: buildingData.capacity || 0,
            jobType: buildingData.jobType || null,
            bonuses: buildingData.bonuses || {},
            
            visuals: {
                flashRed: 0
            }
        };
        
        this.pendingBuildings.push(building);
        this.constructionQueue.set(building.id, {
            progress: 0,
            resourcesNeeded: buildingData.cost
        });
        
        this.worldState.events.trigger('blueprint_created', {
            building: building,
            factionId: factionId
        });
        
        return { success: true, building: building };
    }

    /**
     * Get building statistics from config
     */
    getBuildingStats(type) {
        const configs = {
            [BUILDING_TYPES.HOUSE]: {
                cost: { wood_log: 20 },
                buildTime: 300,
                maxHealth: 300,
                capacity: 4,
                bonuses: { popCap: 4 }
            },
            [BUILDING_TYPES.WORKSHOP]: {
                cost: { wood_log: 30, stone: 10 },
                buildTime: 450,
                maxHealth: 400,
                jobType: JOB_TYPES.CRAFTER
            },
            [BUILDING_TYPES.TEMPLE]: {
                cost: { wood_log: 40, stone: 30 },
                buildTime: 600,
                maxHealth: 500,
                jobType: JOB_TYPES.PRIEST,
                bonuses: { faith: 0.1 }
            },
            [BUILDING_TYPES.FARM]: {
                cost: { wood_log: 15 },
                buildTime: 200,
                maxHealth: 200,
                jobType: JOB_TYPES.FARMER
            },
            [BUILDING_TYPES.WALL]: {
                cost: { stone: 20 },
                buildTime: 150,
                maxHealth: 800,
                bonuses: { defense: 10 }
            },
            [BUILDING_TYPES.TOWER]: {
                cost: { wood_log: 25, stone: 25 },
                buildTime: 400,
                maxHealth: 600,
                bonuses: { vision: 5 }
            },
            [BUILDING_TYPES.BARRACKS]: {
                cost: { wood_log: 50, stone: 20 },
                buildTime: 500,
                maxHealth: 500,
                jobType: JOB_TYPES.SOLDIER
            },
            [BUILDING_TYPES.MARKET]: {
                cost: { wood_log: 35, stone: 15 },
                buildTime: 400,
                maxHealth: 350,
                jobType: JOB_TYPES.TRADER,
                bonuses: { tradeEfficiency: 0.2 }
            }
        };
        
        return configs[type] || configs[BUILDING_TYPES.HOUSE];
    }

    /**
     * Assign builder agents to construction sites
     */
    assignBuilders() {
        const builders = (this.worldState.agents || []).filter(a => 
            a.job === JOB_TYPES.BUILDER && !a.dead && !a.currentJob
        );
        
        for (const building of this.pendingBuildings) {
            if (building.isComplete) continue;
            
            // Check if already has enough workers
            const currentWorkers = (this.worldState.agents || []).filter(a => 
                a.currentJob && a.currentJob.targetId === building.id
            ).length;
            
            const maxWorkers = Math.min(3, Math.ceil(building.width * building.height / 2));
            if (currentWorkers >= maxWorkers) continue;
            
            // Find nearby idle builder
            const nearbyBuilder = builders.find(b => {
                const d = distance(b.x, b.y, building.x, building.y);
                return d < 15; // Aggro radius for jobs
            });
            
            if (nearbyBuilder) {
                this.assignBuilderToSite(nearbyBuilder, building);
                builders.splice(builders.indexOf(nearbyBuilder), 1);
            }
        }
    }

    /**
     * Assign a specific builder to a construction site
     */
    assignBuilderToSite(agent, building) {
        agent.state = 'moving_to_construction';
        agent.currentJob = {
            type: 'construct',
            targetId: building.id,
            targetX: building.x,
            targetY: building.y
        };
        agent.targetX = building.x;
        agent.targetY = building.y;
    }

    /**
     * Update construction progress
     */
    updateConstruction() {
        for (const building of this.pendingBuildings) {
            if (building.isComplete) continue;
            
            // Count workers actively building
            const workers = (this.worldState.agents || []).filter(a => 
                a.currentJob && a.currentJob.targetId === building.id && !a.dead
            );
            
            if (workers.length === 0) continue;
            
            // Check if all workers are in range
            const allInRange = workers.every(w => 
                distance(w.x, w.y, building.x, building.y) <= 3
            );
            
            if (allInRange) {
                // Each worker contributes progress
                const progressPerWorker = 1 + (workers.length * 0.5);
                building.constructionProgress += progressPerWorker * workers.length;
                
                // Visual feedback
                if (building.visuals) {
                    building.visuals.dustParticles = 3;
                }
                
                // Mark workers as building
                workers.forEach(w => {
                    w.state = 'building';
                    w.actionTimer = (w.actionTimer || 0) + 1;
                });
            } else {
                // Workers still moving
                workers.forEach(w => {
                    w.state = 'moving_to_construction';
                });
            }
            
            // Check completion
            if (building.constructionProgress >= building.maxConstructionProgress) {
                this.completeConstruction(building);
            }
        }
        
        // Remove completed buildings from pending list
        this.pendingBuildings = this.pendingBuildings.filter(b => !b.isComplete);
    }

    /**
     * Complete construction and activate building
     */
    completeConstruction(building) {
        building.isComplete = true;
        building.health = building.maxHealth;
        
        // Apply bonuses immediately
        if (building.bonuses.popCap) {
            const faction = this.worldState.factions.get(building.factionId);
            if (faction) {
                faction.maxPopulation += building.bonuses.popCap;
            }
        }
        
        // Spawn job site if applicable
        if (building.jobType) {
            this.worldState.events.trigger('job_site_created', {
                building: building,
                jobType: building.jobType,
                factionId: building.factionId
            });
        }
        
        this.worldState.events.trigger('construction_complete', {
            building: building,
            factionId: building.factionId
        });
        
        // Clear worker assignments
        (this.worldState.agents || []).forEach(agent => {
            if (agent.currentJob && agent.currentJob.targetId === building.id) {
                agent.currentJob = null;
                agent.state = 'idle';
            }
        });
    }

    /**
     * Cancel construction and refund partial resources
     */
    cancelConstruction(buildingId) {
        const index = this.pendingBuildings.findIndex(b => b.id === buildingId);
        if (index === -1) return false;
        
        const building = this.pendingBuildings[index];
        const refundRatio = 1 - (building.constructionProgress / building.maxConstructionProgress);
        
        // Refund resources (simplified - would need ground item system)
        const refund = {};
        for (const [res, amount] of Object.entries(building.remainingResources)) {
            refund[res] = Math.floor(amount * refundRatio);
        }
        
        this.pendingBuildings.splice(index, 1);
        this.constructionQueue.delete(buildingId);
        
        this.worldState.events.trigger('construction_cancelled', {
            building: building,
            refund: refund
        });
        
        return true;
    }

    /**
     * Main update loop
     */
    update() {
        this.assignBuilders();
        this.updateConstruction();
    }
}
