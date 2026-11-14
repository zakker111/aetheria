/**
 * Infrastructure System (Phase 5 Completion)
 * Handles roads, irrigation canals, and bridges for advanced city building.
 */

import { EventBus } from '../core/eventBus.js';

export class InfrastructureSystem {
    constructor(simulation) {
        this.sim = simulation;
        this.eventBus = simulation?.eventBus || EventBus.getInstance();
        
        this.roads = []; // Array of road segments
        this.irrigation = []; // Array of irrigation channels
        this.bridges = []; // Array of bridge structures
        
        this.ROAD_BUILD_COST = { wood: 5, stone: 2 };
        this.IRRIGATION_BUILD_COST = { wood: 3, stone: 5 };
        this.BRIDGE_BUILD_COST = { wood: 15, stone: 10 };
        
        this.lastUpdate = 0;
        this.UPDATE_INTERVAL = 100;

        // Autonomous bridge builders: when settlements on opposite banks trade,
        // they pool resources and construct a crossing (rivers block movement).
        this.eventBus.on('trade:route_established', (e) => this.maybeBuildBridge(e));
    }

    /**
     * True if the tile is water-crossable terrain (river, lake, or ocean water).
     */
    isWaterTile(x, y) {
        const world = this.sim?.world;
        if (!world) return false;
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return false;
        const idx = ty * world.width + tx;
        const biome = world.biome ? world.biome[idx] : null;
        if (biome === 'water' || biome === 'ocean' || biome === 'deep_water') return true;
        if (world.waterLevel && world.waterLevel[idx] > 0.3) return true;
        if (world.riverFlow && world.riverFlow[idx] > 0.28) return true;
        return false;
    }

    _resolveSettlementRef(ref) {
        if (!ref) return null;
        const settlements = this.getSettlements();
        if (typeof ref === 'string') {
            return settlements.find(s => s.name === ref) || null;
        }
        if (typeof ref === 'number') {
            return settlements.find(s => s.id === ref) || null;
        }
        if (ref.center) return ref;
        if (ref.id != null) return settlements.find(s => s.id === ref.id) || ref;
        if (ref.name) return settlements.find(s => s.name === ref.name) || ref;
        return ref;
    }

    /**
     * Called when a trade route forms: if the two endpoints sit across a narrow
     * river/strait within reach (span <= 8), the wealthier side builds a bridge.
     */
    maybeBuildBridge(event) {
        const from = this._resolveSettlementRef(event.from || event.source || event.a);
        const to = this._resolveSettlementRef(event.to || event.target || event.b);
        if (!from || !to) return null;
        return this.tryBridgeBetweenSettlements(from, to, 8, 85);
    }

    tryBridgeBetweenSettlements(from, to, maxSpan = 7, maxDist = 76) {
        const fx = Math.floor(from.center?.x ?? from.x ?? from.cx ?? -1);
        const fy = Math.floor(from.center?.y ?? from.y ?? from.cy ?? -1);
        const tx = Math.floor(to.center?.x ?? to.x ?? to.cx ?? -1);
        const ty = Math.floor(to.center?.y ?? to.y ?? to.cy ?? -1);
        if (fx < 0 || fy < 0 || tx < 0 || ty < 0) return null;
        if (Math.hypot(tx - fx, ty - fy) > maxDist) return null;

        const world = this.sim.world;
        if (!world) return null;

        // Walk the connecting corridor; look for a narrow unbridged river crossing.
        // Skip wide lakes (> maxSpan) rather than aborting on the first lake tile,
        // so corridors that graze a lake and also cross a river still get bridged.
        const steps = Math.max(2, Math.round(Math.hypot(tx - fx, ty - fy)));
        let spanInfo = null;
        let inWaterSpan = false;
        for (let i = 1; i < steps; i++) {
            const px = Math.round(fx + (tx - fx) * (i / steps));
            const py = Math.round(fy + (ty - fy) * (i / steps));
            if (world.isBridge && world.isBridge(px, py)) {
                return null;
            }
            if (this.isWaterTile(px, py)) {
                if (!inWaterSpan) {
                    inWaterSpan = true;
                    const candidate = this.findBestBridgeSpan(px, py, maxSpan);
                    if (candidate && candidate.tiles.every(t => !world.isBridge || !world.isBridge(t.x, t.y))) {
                        spanInfo = candidate;
                        break;
                    }
                }
            } else {
                inWaterSpan = false;
            }
        }
        if (!spanInfo) return null;

        // Paying settlement: prefer wealthier of the two endpoints (supports pre-faction towns)
        const candidates = [from, to]
            .filter(Boolean)
            .sort((a, b) => ((b.stockpile?.wood || 0) + (b.stockpile?.plank || 0) * 2) - ((a.stockpile?.wood || 0) + (a.stockpile?.plank || 0) * 2));

        for (const s of candidates) {
            const res = this.buildBridge(spanInfo.anchorX, spanInfo.anchorY, spanInfo.direction, s.factionId ?? null, { settlement: s, maxSpan });
            if (res.success) return res;
        }
        return null;
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
            if (currentTick > 0 && currentTick % 200 === 0) {
                this.planAutonomousBridges();
            }
        }
    }

    /**
     * Deterministically construct bridges across narrow rivers separating nearby settlements,
     * while leaving wide lakes/seas to river barges and amphibious vessels.
     */
    planAutonomousBridges() {
        const settlements = this.getSettlements().filter(s => !s.ruined && s.center);
        if (settlements.length < 2) return;

        for (let i = 0; i < settlements.length; i++) {
            for (let j = i + 1; j < settlements.length; j++) {
                this.tryBridgeBetweenSettlements(settlements[i], settlements[j], 7, 76);
            }
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
            id: `road_r${this.sim.clock.tick}_${(this.roadSeq = (this.roadSeq || 0) + 1)}`,
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
            id: `irrigation_i${this.sim.clock.tick}_${(this.irrigationSeq = (this.irrigationSeq || 0) + 1)}`,
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
     * Measures exact contiguous water crossing bounded by walkable banks on both sides.
     */
    measureBridgeSpan(x, y, direction, maxSpan = 10) {
        const world = this.sim?.world;
        if (!world) return { valid: false, tiles: [], reason: 'no_world' };
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (!this.isWaterTile(cx, cy)) return { valid: false, tiles: [], reason: 'not_over_water' };

        const dx = direction === 'horizontal' ? 1 : 0;
        const dy = direction === 'vertical' ? 1 : 0;
        const maxScan = maxSpan + 2;

        // Scan backward to bank
        let minOffset = 0;
        for (let step = 1; step <= maxScan; step++) {
            const nx = cx - dx * step;
            const ny = cy - dy * step;
            if (!this.isWaterTile(nx, ny)) break;
            minOffset = -step;
        }
        // Scan forward to bank
        let maxOffset = 0;
        for (let step = 1; step <= maxScan; step++) {
            const nx = cx + dx * step;
            const ny = cy + dy * step;
            if (!this.isWaterTile(nx, ny)) break;
            maxOffset = step;
        }

        const startBank = { x: cx + dx * (minOffset - 1), y: cy + dy * (minOffset - 1) };
        const endBank = { x: cx + dx * (maxOffset + 1), y: cy + dy * (maxOffset + 1) };

        if (!world.isWalkable(startBank.x, startBank.y) || this.isWaterTile(startBank.x, startBank.y)) {
            return { valid: false, tiles: [], reason: 'missing_start_bank' };
        }
        if (!world.isWalkable(endBank.x, endBank.y) || this.isWaterTile(endBank.x, endBank.y)) {
            return { valid: false, tiles: [], reason: 'missing_end_bank' };
        }

        const tiles = [];
        for (let off = minOffset; off <= maxOffset; off++) {
            tiles.push({ x: cx + dx * off, y: cy + dy * off });
        }

        if (tiles.length === 0 || tiles.length > maxSpan) {
            return { valid: false, tiles, reason: 'water_too_wide' };
        }

        return {
            valid: true,
            direction,
            tiles,
            span: tiles.length,
            startBank,
            endBank,
            anchorX: cx,
            anchorY: cy
        };
    }

    /**
     * Find the shortest valid bridge span passing through (x, y) or adjacent water,
     * plus whether any crossing failed specifically because water was too wide.
     */
    findBestBridgeSpan(x, y, maxSpan = 10) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        const candidates = [];

        const probeOffsets = this.isWaterTile(tx, ty)
            ? [[0, 0]]
            : [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (const [ox, oy] of probeOffsets) {
            const px = tx + ox;
            const py = ty + oy;
            if (!this.isWaterTile(px, py)) continue;
            const hSpan = this.measureBridgeSpan(px, py, 'horizontal', maxSpan);
            if (hSpan.valid) candidates.push(hSpan);
            const vSpan = this.measureBridgeSpan(px, py, 'vertical', maxSpan);
            if (vSpan.valid) candidates.push(vSpan);
        }

        if (candidates.length === 0) return null;
        candidates.sort((a, b) => a.span - b.span);
        return candidates[0];
    }

    /**
     * God Power / Direct helper to span a river or narrow channel at (x, y).
     */
    placeBridgeAt(x, y, maxSpan = 10) {
        const spanInfo = this.findBestBridgeSpan(x, y, maxSpan);
        if (!spanInfo) {
            const tx = Math.floor(x);
            const ty = Math.floor(y);
            const isOverWater = this.isWaterTile(tx, ty);
            if (isOverWater) {
                const h = this.measureBridgeSpan(tx, ty, 'horizontal', maxSpan);
                const v = this.measureBridgeSpan(tx, ty, 'vertical', maxSpan);
                if (h.reason === 'water_too_wide' || v.reason === 'water_too_wide' ||
                    (h.reason === 'missing_start_bank' && h.reason === v.reason)) {
                    return {
                        success: false,
                        reason: 'water_too_wide',
                        message: 'Too wide to bridge (>10 tiles) — build a Dock and sail boats across this lake!'
                    };
                }
            }
            return {
                success: false,
                reason: 'Bridges must span a river or narrow channel (1–10 tiles wide) between walkable banks!'
            };
        }
        // Check if already fully bridged
        const world = this.sim.world;
        if (spanInfo.tiles.every(t => world.isBridge(t.x, t.y))) {
            return { success: false, reason: 'A bridge already spans this crossing!' };
        }

        // Associate with nearest settlement if within 32 tiles
        let nearestS = null;
        let minDist = 32;
        for (const s of this.getSettlements()) {
            if (!s.center || s.ruined) continue;
            const d = Math.hypot(s.center.x - spanInfo.anchorX, s.center.y - spanInfo.anchorY);
            if (d < minDist) {
                minDist = d;
                nearestS = s;
            }
        }

        return this.buildBridge(
            spanInfo.anchorX,
            spanInfo.anchorY,
            spanInfo.direction,
            nearestS?.factionId ?? null,
            { free: true, maxSpan, settlement: nearestS }
        );
    }

    /**
     * Bridge System
     * Constructs a walkable bridge deck across a water channel and links bank approaches.
     */
    buildBridge(x, y, direction, factionId, options = {}) {
        const world = this.sim?.world;
        if (!world) return { success: false, reason: 'no_world' };

        const maxSpan = options.maxSpan || 10;
        const free = Boolean(options.free);
        let costToUse = { wood: 8 };
        const settlement = options.settlement || (factionId != null ? this.getSettlements().find(s => s.factionId === factionId) : null);
        const faction = factionId != null ? this.getFaction(factionId) : null;
        const payer = settlement || faction;

        if (!free) {
            if (!payer) return { success: false, reason: 'insufficient_resources' };
            if (this.hasResources(payer, { wood: 8 })) {
                costToUse = { wood: 8 };
            } else if (this.hasResources(payer, { plank: 4 })) {
                costToUse = { plank: 4 };
            } else {
                return { success: false, reason: 'insufficient_resources' };
            }
        }

        const spanInfo = this.measureBridgeSpan(x, y, direction, maxSpan);
        if (!spanInfo.valid) {
            return { success: false, reason: spanInfo.reason };
        }

        if (!free && payer) {
            this.deductResources(payer, costToUse);
        }

        const bridgeTiles = [];
        for (const t of spanInfo.tiles) {
            bridgeTiles.push({ x: t.x, y: t.y });
            world.setBridge(t.x, t.y, true);
        }
        // Connect bank road approaches deterministically
        if (typeof world.setRoad === 'function') {
            world.setRoad(spanInfo.startBank.x, spanInfo.startBank.y, true);
            world.setRoad(spanInfo.endBank.x, spanInfo.endBank.y, true);
        }
        this.sim._occStamp = -1;

        const bridge = {
            id: `bridge_b${this.sim.clock.tick}_${(this.bridgeSeq = (this.bridgeSeq || 0) + 1)}`,
            factionId: factionId ?? null,
            settlementId: settlement?.id ?? null,
            tiles: bridgeTiles,
            direction: spanInfo.direction,
            span: spanInfo.span,
            health: 100,
            maxHealth: 100
        };

        this.bridges.push(bridge);

        this.eventBus.emit('infrastructure:bridge_built', {
            id: bridge.id,
            span: spanInfo.span,
            x: spanInfo.anchorX,
            y: spanInfo.anchorY,
            faction: settlement?.name || faction?.name || 'Divine Builders'
        });

        return { success: true, bridge, span: spanInfo.span };
    }

    measureWaterWidth(x, y, direction) {
        const span = this.measureBridgeSpan(x, y, direction, 10);
        return span.tiles.length;
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
        
        // Bridges enable trade route continuity; collapsed bridges lose passability
        const world = this.sim?.world;
        this.bridges.forEach(bridge => {
            if (bridge.health <= 0 && world?.setBridge) {
                bridge.tiles.forEach(tile => {
                    world.setBridge(tile.x, tile.y, false);
                });
            }
        });
    }

    hasResources(factionOrSettlement, cost) {
        const settlement = factionOrSettlement?.stockpile
            ? factionOrSettlement
            : this.getSettlements().find(s => s.factionId === factionOrSettlement?.id);
        if (!settlement || !settlement.stockpile) return false;

        for (const [resource, amount] of Object.entries(cost)) {
            if ((settlement.stockpile[resource] || 0) < amount) {
                return false;
            }
        }
        return true;
    }

    deductResources(factionOrSettlement, cost) {
        const settlement = factionOrSettlement?.stockpile
            ? factionOrSettlement
            : this.getSettlements().find(s => s.factionId === factionOrSettlement?.id);
        if (!settlement || !settlement.stockpile) return;

        for (const [resource, amount] of Object.entries(cost)) {
            settlement.stockpile[resource] = Math.max(0, (settlement.stockpile[resource] || 0) - amount);
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
            bridges: this.bridges,
            lastUpdate: this.lastUpdate,
            bridgeSeq: this.bridgeSeq || 0,
            roadSeq: this.roadSeq || 0,
            irrigationSeq: this.irrigationSeq || 0
        };
    }

    deserialize(data) {
        if (data.roads) this.roads = data.roads;
        if (data.irrigation) this.irrigation = data.irrigation;
        if (data.bridges) this.bridges = data.bridges;
        if (data.lastUpdate !== undefined) this.lastUpdate = data.lastUpdate;
        if (data.bridgeSeq !== undefined) this.bridgeSeq = data.bridgeSeq;
        if (data.roadSeq !== undefined) this.roadSeq = data.roadSeq;
        if (data.irrigationSeq !== undefined) this.irrigationSeq = data.irrigationSeq;
        // Re-apply intact bridge decks to the world's passability grid so agents can
        // cross water after a load. WorldState.deserialize restores the raw
        // bridgeTiles array, but legacy saves (or paths that rebuild the world)
        // may lack it; re-marking from the bridge list keeps state consistent.
        const world = this.sim && this.sim.world;
        if (world && typeof world.setBridge === 'function') {
            for (const bridge of this.bridges || []) {
                const intact = bridge.health === undefined || bridge.health > 0;
                for (const t of bridge.tiles || []) {
                    world.setBridge(t.x, t.y, intact);
                }
            }
        }
    }

    static deserialize(data, sim) {
        const sys = new InfrastructureSystem(sim);
        sys.deserialize(data);
        return sys;
    }
}
