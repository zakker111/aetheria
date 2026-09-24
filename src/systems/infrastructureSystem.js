/**
 * Infrastructure System (Phase 5 Completion)
 * Handles roads, irrigation canals, and bridges for advanced city building.
 */

import { EventBus } from '../core/eventBus.js';

export class InfrastructureSystem {
    constructor(simulation) {
        this.sim = simulation;
        this.eventBus = EventBus.getInstance();
        
        this.roads = []; // Array of road segments
        this.irrigation = []; // Array of irrigation channels
        this.bridges = []; // Array of bridge structures
        
        this.ROAD_BUILD_COST = { wood: 5, stone: 2 };
        this.IRRIGATION_BUILD_COST = { wood: 3, stone: 5 };
        this.BRIDGE_BUILD_COST = { wood: 15, stone: 10 };
        
        this.lastUpdate = 0;
        this.UPDATE_INTERVAL = 100;
    }

    getFaction(factionId) {
        if (this.sim.factionSystem?.factions?.get) {
            return this.sim.factionSystem.factions.get(factionId);
        }
        if (this.sim.factions?.get) {
            return this.sim.factions.get(factionId);
        }
        return null;
    }

    getTile(x, y) {
        if (this.sim.world?.getTile) {
            return this.sim.world.getTile(x, y);
        }
        if (this.sim.worldState?.getTile) {
            return this.sim.worldState.getTile(x, y);
        }
        return null;
    }

    getSettlements() {
        if (this.sim.settlementSystem?.settlements) {
            return Array.from(this.sim.settlementSystem.settlements.values());
        }
        if (this.sim.settlements) {
            return Array.isArray(this.sim.settlements) ? this.sim.settlements : Array.from(this.sim.settlements.values());
        }
        return [];
    }

    update() {
        const currentTick = this.sim.clock.tick;
        
        if (currentTick - this.lastUpdate >= this.UPDATE_INTERVAL) {
            this.lastUpdate = currentTick;
            this.updateInfrastructureEffects();
        }
    }

    /**
     * Road System
     * Improves movement speed on designated tiles
     */
    buildRoad(startX, startY, endX, endY, factionId) {
        // Validate resources
        const faction = this.getFaction(factionId);
        if (!faction || !this.hasResources(faction, this.ROAD_BUILD_COST)) {
            return { success: false, reason: 'insufficient_resources' };
        }
        
        // Generate road path (simple line algorithm)
        const path = this.generatePath(startX, startY, endX, endY);
        
        // Check if path is valid (no water gaps, reasonable slope)
        if (!this.validateRoadPath(path)) {
            return { success: false, reason: 'invalid_path' };
        }
        
        // Deduct resources
        this.deductResources(faction, this.ROAD_BUILD_COST);
        
        // Create road object
        const road = {
            id: `road_${Date.now()}`,
            factionId: factionId,
            path: path, // Array of {x, y} coordinates
            length: path.length,
            createdAt: this.sim.clock.tick
        };
        
        this.roads.push(road);
        
        // Mark tiles as road in world state
        path.forEach(tile => {
            const tileData = this.getTile(tile.x, tile.y);
            if (tileData) {
                tileData.road = true;
                tileData.roadFaction = factionId;
            }
        });
        
        this.eventBus.emit('infrastructure:road_built', {
            id: road.id,
            length: road.length,
            faction: faction.name
        });
        
        return { success: true, road: road };
    }

    generatePath(x1, y1, x2, y2) {
        const path = [];
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = Math.floor((dx > dy ? dx : -dy) / 2);
        
        let x = x1;
        let y = y1;
        
        while (true) {
            path.push({ x: Math.floor(x), y: Math.floor(y) });
            
            if (Math.abs(x - x2) < 1 && Math.abs(y - y2) < 1) break;
            
            const e2 = err;
            if (e2 > -dx) {
                err -= dy;
                x += sx;
            }
            if (e2 < dy) {
                err += dx;
                y += sy;
            }
        }
        
        return path;
    }

    validateRoadPath(path) {
        for (const tile of path) {
            const tileData = this.sim.worldState.getTile(tile.x, tile.y);
            if (!tileData) return false;
            
            // Can't build roads on deep water
            if (tileData.biome === 'water' && tileData.elevation < 0.2) {
                return false;
            }
            
            // Can't build on very steep slopes
            if (tileData.slope > 0.8) {
                return false;
            }
        }
        return true;
    }

    /**
     * Irrigation System
     * Brings water to dry farmland, improving crop yields
     */
    buildIrrigation(sourceX, sourceY, targetX, targetY, factionId) {
        const faction = this.getFaction(factionId);
        if (!faction || !this.hasResources(faction, this.IRRIGATION_BUILD_COST)) {
            return { success: false, reason: 'insufficient_resources' };
        }
        
        // Verify water source exists
        const sourceTile = this.getTile(sourceX, sourceY);
        if (!sourceTile || (sourceTile.biome !== 'water' && sourceTile.biome !== 'river')) {
            return { success: false, reason: 'no_water_source' };
        }
        
        const path = this.generatePath(sourceX, sourceY, targetX, targetY);
        
        if (!this.validateIrrigationPath(path, sourceTile)) {
            return { success: false, reason: 'invalid_path' };
        }
        
        this.deductResources(faction, this.IRRIGATION_BUILD_COST);
        
        const channel = {
            id: `irrigation_${Date.now()}`,
            factionId: factionId,
            source: { x: sourceX, y: sourceY },
            path: path,
            active: true,
            flowRate: 1.0
        };
        
        this.irrigation.push(channel);
        
        // Mark tiles as irrigated
        path.forEach(tile => {
            const tileData = this.getTile(tile.x, tile.y);
            if (tileData) {
                tileData.irrigated = true;
                tileData.irrigationSource = channel.id;
                // Increase moisture
                tileData.moisture = Math.min(1.0, (tileData.moisture || 0) + 0.5);
            }
        });
        
        this.eventBus.emit('infrastructure:irrigation_built', {
            id: channel.id,
            length: path.length,
            faction: faction.name
        });
        
        return { success: true, channel: channel };
    }

    validateIrrigationPath(path, sourceTile) {
        // Must start at water
        const firstTile = path[0];
        if (firstTile.x !== Math.floor(sourceTile.x) || firstTile.y !== Math.floor(sourceTile.y)) {
            return false;
        }
        
        // Path must be downhill or flat (water flows downhill)
        let prevElevation = sourceTile.elevation;
        for (const tile of path) {
            const tileData = this.getTile(tile.x, tile.y);
            if (!tileData) return false;
            
            // Allow slight uphill with pumps (future feature), for now strict downhill
            if (tileData.elevation > prevElevation + 0.1) {
                return false;
            }
            prevElevation = tileData.elevation;
        }
        
        return true;
    }

    /**
     * Bridge System
     * Allows crossing water obstacles
     */
    buildBridge(x, y, direction, factionId) {
        const faction = this.getFaction(factionId);
        if (!faction || !this.hasResources(faction, this.BRIDGE_BUILD_COST)) {
            return { success: false, reason: 'insufficient_resources' };
        }
        
        // Check if tile is water
        const centerTile = this.getTile(x, y);
        if (!centerTile || centerTile.biome !== 'water') {
            return { success: false, reason: 'not_over_water' };
        }
        
        // Determine bridge span based on water width
        const span = this.measureWaterWidth(x, y, direction);
        if (span < 2) {
            return { success: false, reason: 'water_too_narrow' };
        }
        
        this.deductResources(faction, this.BRIDGE_BUILD_COST);
        
        const bridgeTiles = [];
        for (let i = 0; i < span; i++) {
            const tx = direction === 'horizontal' ? x + i - Math.floor(span/2) : x;
            const ty = direction === 'vertical' ? y + i - Math.floor(span/2) : y;
            bridgeTiles.push({ x: tx, y: ty });
            
            const tileData = this.getTile(tx, ty);
            if (tileData) {
                tileData.bridge = true;
                tileData.bridgeFaction = factionId;
                tileData.passable = true; // Make walkable
            }
        }
        
        const bridge = {
            id: `bridge_${Date.now()}`,
            factionId: factionId,
            tiles: bridgeTiles,
            direction: direction,
            span: span,
            health: 100,
            maxHealth: 100
        };
        
        this.bridges.push(bridge);
        
        this.eventBus.emit('infrastructure:bridge_built', {
            id: bridge.id,
            span: span,
            faction: faction.name
        });
        
        return { success: true, bridge: bridge };
    }

    measureWaterWidth(x, y, direction) {
        let width = 0;
        const maxScan = 10;
        
        if (direction === 'horizontal') {
            // Scan left
            for (let i = x; i > x - maxScan; i--) {
                const tile = this.getTile(i, y);
                if (!tile || tile.biome !== 'water') break;
                width++;
            }
            // Scan right
            for (let i = x; i < x + maxScan; i++) {
                const tile = this.getTile(i, y);
                if (!tile || tile.biome !== 'water') break;
                width++;
            }
        } else {
            // Scan up
            for (let i = y; i > y - maxScan; i--) {
                const tile = this.getTile(x, i);
                if (!tile || tile.biome !== 'water') break;
                width++;
            }
            // Scan down
            for (let i = y; i < y + maxScan; i++) {
                const tile = this.getTile(x, i);
                if (!tile || tile.biome !== 'water') break;
                width++;
            }
        }
        
        return Math.min(width, 5); // Cap at 5 tiles
    }

    /**
     * Update infrastructure effects on economy and movement
     */
    updateInfrastructureEffects() {
        // Roads boost movement speed for agents on them
        this.roads.forEach(road => {
            road.path.forEach(tile => {
                const agents = this.sim.world?.getNearbyAgents ? this.sim.world.getNearbyAgents(tile.x, tile.y, 0.5) : [];
                agents.forEach(agent => {
                    agent.speedMultiplier = (agent.speedMultiplier || 1) + 0.5; // 50% faster
                });
            });
        });
        
        // Irrigation boosts farm productivity
        this.irrigation.forEach(channel => {
            if (!channel.active) return;
            
            channel.path.forEach(tile => {
                const nearbyBuildings = this.sim.world?.getNearbyBuildings ? this.sim.world.getNearbyBuildings(tile.x, tile.y, 2) : [];
                nearbyBuildings.forEach(building => {
                    if (building.type === 'farm') {
                        building.productivity = (building.productivity || 1) + 0.5; // 50% more yield
                    }
                });
            });
        });
        
        // Bridges enable trade route continuity
        this.bridges.forEach(bridge => {
            if (bridge.health <= 0) {
                // Destroyed bridge blocks movement
                bridge.tiles.forEach(tile => {
                    const tileData = this.getTile(tile.x, tile.y);
                    if (tileData) {
                        tileData.passable = false;
                    }
                });
            }
        });
    }

    hasResources(faction, cost) {
        const settlement = this.getSettlements()
            .find(s => s.factionId === faction.id);
        if (!settlement || !settlement.stockpile) return false;
        
        for (const [resource, amount] of Object.entries(cost)) {
            if ((settlement.stockpile[resource] || 0) < amount) {
                return false;
            }
        }
        return true;
    }

    deductResources(faction, cost) {
        const settlement = this.getSettlements()
            .find(s => s.factionId === faction.id);
        if (!settlement || !settlement.stockpile) return;
        
        for (const [resource, amount] of Object.entries(cost)) {
            settlement.stockpile[resource] = (settlement.stockpile[resource] || 0) - amount;
        }
    }

    /**
     * Repair damaged infrastructure
     */
    repairInfrastructure(infraId, type) {
        let infra = null;
        if (type === 'road') {
            infra = this.roads.find(r => r.id === infraId);
        } else if (type === 'bridge') {
            infra = this.bridges.find(b => b.id === infraId);
        } else if (type === 'irrigation') {
            infra = this.irrigation.find(i => i.id === infraId);
        }
        
        if (!infra) return false;
        
        if (type === 'bridge' && infra.health < infra.maxHealth) {
            infra.health = Math.min(infra.maxHealth, infra.health + 20);
            return true;
        }
        
        return false;
    }

    serialize() {
        return {
            roads: this.roads,
            irrigation: this.irrigation,
            bridges: this.bridges
        };
    }

    deserialize(data) {
        if (data.roads) this.roads = data.roads;
        if (data.irrigation) this.irrigation = data.irrigation;
        if (data.bridges) this.bridges = data.bridges;
    }

    static deserialize(data, sim) {
        const sys = new InfrastructureSystem(sim);
        sys.deserialize(data);
        return sys;
    }
}
