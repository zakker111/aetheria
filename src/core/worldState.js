// World state management (doc 02: terrain truth, entity state, spatial indexes)
// Phase 8: Procedural Terrain & Hydrology - Milestone 8.1 & 8.2
import { RNG } from "./rng.js";

export class WorldState {
  constructor(width = 128, height = 128, seed = Date.now(), options = {}) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.rng = new RNG(seed);

    // Phase 8: Enhanced terrain data with heightmap (0-100 scale)
    this.elevation = new Float32Array(width * height); // Height 0-100
    this.moisture = new Float32Array(width * height);
    this.temperature = new Float32Array(width * height);
    this.waterLevel = new Float32Array(width * height); // Water depth 0-10
    this.biome = new Array(width * height).fill('ocean'); // Biome type per tile
    
    // River data
    this.riverFlow = new Float32Array(width * height); // Water flow intensity
    this.isRiverSource = new Uint8Array(width * height); // River source markers

    // Road network: persistent ground layer (0/1 per tile). Emergent paths are
    // trampled by foot traffic; planned roads are stamped by InfrastructureSystem.
    this.roadTiles = new Uint8Array(width * height);
    // Foot-traffic heat map: counts tile entries; hot tiles become desire-paths.
    this.footTraffic = new Uint16Array(width * height);
    // Persistent fire ground layer: per-tile remaining burn ticks (0 = no fire)
    this.fireTiles = new Uint16Array(width * height);
    this.bridgeTiles = new Uint8Array(width * height); // 1 = bridge deck (walkable over water)

    // Spatial index for fast queries (doc 02: spatial indexes)
    this.spatialIndex = new Map();

    // Entity registry: id -> entity (O(1) lookups; kept in sync by add/removeFromSpatialIndex)
    this.entityRegistry = new Map();

    // Derived caches (doc 02: derived/temporary caches may be rebuilt)
    this._tilesCache = null;
    this.simulation = null;
    this.eventBus = null;

    if (!options.skipTerrain) {
      this.generateTerrain();
    }
  }

  // Compatibility getter for tests and external systems
  get tiles() {
    if (!this._tilesCache) {
      this._tilesCache = [];
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this._tilesCache.push(this.getTerrain(x, y));
        }
      }
    }
    return this._tilesCache;
  }

  // Helper to get single entity at tile
  getEntityAt(x, y) {
    const list = this.getEntitiesAt(x, y);
    return list && list.length > 0 ? list[0] : null;
  }

  // O(1) entity lookup by id (used by combat/religion/ui systems)
  getEntityById(id) {
    return this.entityRegistry.get(id) || null;
  }

  // Event bus triggering compatibility
  get events() {
    return {
      trigger: (eventName, data) => {
        const bus = this.eventBus || this.simulation?.eventBus;
        if (bus) {
          bus.emit(eventName, data);
        }
      }
    };
  }

  get agents() {
    return this.simulation ? this.simulation.agents : [];
  }

  get factions() {
    return this.simulation && this.simulation.factionSystem ? this.simulation.factionSystem.factions : new Map();
  }

  /**
   * Phase 8 Milestone 8.2: Improved noise generation with multiple octaves
   */
  generateTerrain() {
    // Step 1: Generate base elevation with multi-octave Perlin-like noise
    this.generateHeightmap();
    
    // Step 2: Generate moisture distribution
    this.generateMoisture();
    
    // Step 3: Calculate temperature based on latitude and elevation
    this.generateTemperature();
    
    // Step 4: Carve rivers from high points to edges
    this.carveRivers();
    
    // Step 5: Assign biomes based on elevation, moisture, temperature
    this.assignBiomes();
    
    // Step 6: Place resources based on biome
  }

  /**
   * Milestone 8.2: Generate heightmap using layered noise
   */
  generateHeightmap() {
    const baseFreq = 0.05; // Base frequency for continental shapes
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        
        // Multi-octave noise for natural-looking continents
        let elevation = 0;
        let amplitude = 1.0;
        let frequency = baseFreq;
        let maxVal = 0;
        
        // 4 octaves of noise
        for (let o = 0; o < 4; o++) {
          elevation += this.smoothNoise(x * frequency, y * frequency) * amplitude;
          maxVal += amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        elevation /= maxVal; // Normalize to 0-1
        
        // Add continental shelf effect
        const distFromCenter = Math.sqrt(
          Math.pow((x - this.width/2) / (this.width/2), 2) + 
          Math.pow((y - this.height/2) / (this.height/2), 2)
        );
        const continentMask = Math.max(0, 1 - distFromCenter * 0.8);
        
        elevation = elevation * 0.7 + continentMask * 0.3;
        
        this.elevation[idx] = Math.max(0, Math.min(100, elevation * 100)); // Scale to 0-100
      }
    }
  }

  /**
   * Milestone 8.2: Generate moisture map
   */
  generateMoisture() {
    const baseFreq = 0.08;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        
        let moisture = 0;
        let amplitude = 1.0;
        let frequency = baseFreq;
        let maxVal = 0;
        
        for (let o = 0; o < 3; o++) {
          moisture += this.smoothNoise(x * frequency + 1000, y * frequency + 1000) * amplitude;
          maxVal += amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        moisture /= maxVal;
        this.moisture[idx] = Math.max(0, Math.min(1, moisture));
      }
    }
  }

  /**
   * Milestone 8.2: Generate temperature based on latitude and elevation
   */
  generateTemperature() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        
        // Temperature decreases from equator (center) to poles (edges)
        const latFactor = Math.abs((y / this.height) - 0.5) * 2; // 0 at center, 1 at edges
        const baseTemp = 1.0 - latFactor * 0.6; // Warmer at equator
        
        // Temperature decreases with elevation
        const elevFactor = this.elevation[idx] / 100;
        const tempDrop = elevFactor * 0.4;
        
        // Add some noise
        const noise = (this.smoothNoise(x * 0.05, y * 0.05) - 0.5) * 0.2;
        
        this.temperature[idx] = Math.max(0, Math.min(1, baseTemp - tempDrop + noise));
      }
    }
  }

  /**
   * Milestone 8.4: River carving algorithm - water flows from high to low
   */
  carveRivers() {
    // Find potential river sources (high elevation points with good moisture)
    const sources = [];
    const numSources = Math.floor((this.width * this.height) / 500); // ~1 river per 500 tiles
    
    for (let attempt = 0; attempt < numSources * 3 && sources.length < numSources; attempt++) {
      const x = Math.floor(this.rng.next() * this.width);
      const y = Math.floor(this.rng.next() * this.height);
      const idx = y * this.width + x;
      
      // Source should be in mountains/highlands with moisture
      if (this.elevation[idx] > 60 && this.moisture[idx] > 0.4) {
        sources.push({x, y});
        this.isRiverSource[idx] = 1;
      }
    }
    
    // Carve river paths from each source to map edge or lake
    for (const source of sources) {
      this.carveSingleRiver(source.x, source.y);
    }
  }

  /**
   * Carve a single river from source to edge
   */
  carveSingleRiver(startX, startY) {
    let x = startX;
    let y = startY;
    let prevIdx = -1;
    
    const maxSteps = this.width * 2; // Prevent infinite loops
    let steps = 0;
    
    while (steps < maxSteps) {
      const idx = y * this.width + x;
      
      // Mark as river
      this.riverFlow[idx] = Math.max(this.riverFlow[idx], 0.5);
      this.waterLevel[idx] = Math.max(this.waterLevel[idx], 1.0);
      
      // Check if we reached the edge (ocean)
      if (x <= 1 || x >= this.width - 2 || y <= 1 || y >= this.height - 2) {
        break;
      }
      
      // Find lowest neighbor (water flows downhill)
      let lowestElev = this.elevation[idx];
      let nextX = x;
      let nextY = y;
      
      // Check 8 neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          const nIdx = ny * this.width + nx;
          
          // Prefer flowing away from previous tile
          if (nIdx === prevIdx) continue;
          
          const neighborElev = this.elevation[nIdx];
          if (neighborElev < lowestElev) {
            lowestElev = neighborElev;
            nextX = nx;
            nextY = ny;
          }
        }
      }
      
      // If no lower neighbor, river ends (forms a lake)
      if (nextX === x && nextY === y) {
        // Create a small lake at this point
        this.createLake(x, y, 3 + Math.floor(this.rng.next() * 3));
        break;
      }
      
      prevIdx = idx;
      x = nextX;
      y = nextY;
      steps++;
    }
  }

  /**
   * Create a lake at specified location
   */
  createLake(centerX, centerY, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const x = centerX + dx;
          const y = centerY + dy;
          
          if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const idx = y * this.width + x;
            this.waterLevel[idx] = Math.max(this.waterLevel[idx], 2.0);
            this.riverFlow[idx] = 0.2; // Stagnant water
            this.biome[idx] = 'water'; // Mark as lake so it renders & blocks movement
          }
        }
      }
    }
  }

  /**
   * Milestone 8.3: Assign biomes based on elevation, moisture, and temperature
   */
  assignBiomes() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const elev = this.elevation[idx];
        const moist = this.moisture[idx];
        const temp = this.temperature[idx];
        const water = this.waterLevel[idx];
        
        // Determine biome based on factors
        if (water > 1.5) {
          this.biome[idx] = 'water';
        } else if (elev < 15) {
          this.biome[idx] = 'beach';
        } else if (elev > 80) {
          this.biome[idx] = temp < 0.3 ? 'snow' : 'mountain';
        } else if (elev > 60) {
          this.biome[idx] = 'highland';
        } else if (moist < 0.2) {
          this.biome[idx] = temp > 0.6 ? 'desert' : 'tundra';
        } else if (moist < 0.4) {
          this.biome[idx] = temp > 0.5 ? 'savanna' : 'grassland';
        } else if (moist > 0.7) {
          this.biome[idx] = temp > 0.6 ? 'jungle' : 'forest';
        } else {
          this.biome[idx] = 'grassland';
        }
      }
    }
  }

  /**
   * Place resources based on biome types
   */
  placeResources() {
    // Resource placement logic will be implemented in ResourceSystem
    // This method marks tiles as resource-rich for later spawning
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const biome = this.biome[idx];
        
        // Mark resource potential (actual spawning done by ResourceSystem)
        if (biome === 'mountain' || biome === 'highland') {
          // Mountains have ore deposits
          if (this.rng.next() < 0.3) {
            // Mark for ore spawning
          }
        } else if (biome === 'forest' || biome === 'jungle') {
          // Forests have trees
          if (this.rng.next() < 0.6) {
            // Mark for wood spawning
          }
        } else if (biome === 'grassland' || biome === 'savanna') {
          // Plains have wheat/food
          if (this.rng.next() < 0.4) {
            // Mark for food spawning
          }
        } else if (biome === 'water') {
          // Water has fish
          if (this.rng.next() < 0.3) {
            // Mark for fish spawning
          }
        }
      }
    }
  }

  /**
   * Smooth noise function for terrain generation
   */
  smoothNoise(x, y) {
    // Get integer and fractional parts
    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const fracX = x - intX;
    const fracY = y - intY;
    
    // Get corner values
    const v1 = this.hashNoise(intX, intY);
    const v2 = this.hashNoise(intX + 1, intY);
    const v3 = this.hashNoise(intX, intY + 1);
    const v4 = this.hashNoise(intX + 1, intY + 1);
    
    // Bilinear interpolation
    const i1 = v1 * (1 - fracX) + v2 * fracX;
    const i2 = v3 * (1 - fracX) + v4 * fracX;
    
    return i1 * (1 - fracY) + i2 * fracY;
  }

  /**
   * Hash-based noise for consistent random values
   */
  hashNoise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  /**
   * Legacy noise functions for backward compatibility
   */
  noise(x, y) {
    const n = Math.sin(x * 12.9898 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  noise2D(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return n - Math.floor(n);
  }

  getTerrain(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    const idx = y * this.width + x;
    return {
      elevation: this.elevation[idx],
      moisture: this.moisture[idx],
      temperature: this.temperature[idx],
      waterLevel: this.waterLevel[idx],
      biome: this.biome[idx],
      riverFlow: this.riverFlow[idx],
      type: this.biome[idx] // Use pre-computed biome
    };
  }

  getTerrainType(elevation, moisture, temperature) {
    // Legacy function - use assignBiomes instead
    if (elevation < 25) return "water";
    if (elevation < 30) return "beach";
    if (elevation > 75) {
      return temperature < 0.3 ? "snow" : "mountain";
    }
    
    if (moisture < 0.2) {
      return temperature > 0.6 ? "desert" : "tundra";
    }
    if (moisture < 0.4) {
      return temperature > 0.5 ? "savanna" : "grassland";
    }
    if (moisture > 0.7) {
      return temperature > 0.6 ? "jungle" : "forest";
    }
    
    return "grassland";
  }

  isWalkable(x, y) {
    const terrain = this.getTerrain(x, y);
    if (!terrain) return false;
    // Bridges make any water tile passable (persistent ground layer).
    if (this.bridgeTiles && this.bridgeTiles[y * this.width + x] === 1) return true;
    // Mountains are impassable.
    if (terrain.type === 'mountain') return false;
    // Lakes and rivers (and ocean) are impassable without a bridge.
    if (terrain.waterLevel > 0.3) return false;
    // Some biomes are not walkable
    const nonWalkable = ["water", "deep_water"];
    return !nonWalkable.includes(terrain.type);
  }

  // Bridge network accessors (persistent ground layer, survives save/load).
  isBridge(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.bridgeTiles[y * this.width + x] === 1;
  }

  setBridge(x, y, on = true) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    this.bridgeTiles[y * this.width + x] = on ? 1 : 0;
    return true;
  }

  // Road network accessors (persistent ground layer)
  isRoad(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.roadTiles[y * this.width + x] === 1;
  }

  setRoad(x, y, on = true) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = y * this.width + x;
    if (!this.isWalkable(x, y)) return false;
    this.roadTiles[idx] = on ? 1 : 0;
    return true;
  }

  // Fire layer accessors: tiles hold remaining burn ticks (deterministic decay).
  isBurning(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return this.fireTiles[y * this.width + x] > 0;
  }

  startFire(x, y, duration = 60) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = y * this.width + x;
    this.fireTiles[idx] = Math.max(this.fireTiles[idx], duration);
    // Perf: wake the fire tick loop in Simulation.updateEnvironment()
    if (this.simulation) this.simulation._fireActive = true;
    return true;
  }

  /**
   * Advance the fire layer one tick: decay burn timers and spread to
   * adjacent flammable tiles (forests/grasslands). Deterministic — uses no
   * RNG draws; spread is gated on tile fuel and a fixed tick parity so
   * fires creep rather than explode. Returns count of burning tiles.
   */
  updateFires(tick) {
    const w = this.width, h = this.height;
    const ft = this.fireTiles;
    let burning = 0;
    // Perf: reuse scratch buffers instead of allocating arrays/objects per tick.
    if (!this._fireScratch || this._fireScratchCap !== ft.length) {
      this._fireScratch = new Int32Array(ft.length);
      this._fireScratchCap = ft.length;
    }
    const cand = this._fireScratch;
    let candCount = 0;
    const spread = (tick & 1) === 0; // spread every other tick to slow propagation
    // Global cap so fires creep instead of consuming the map / tanking perf.
    const MAX_BURNING = 512;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;
        const burn = ft[idx];
        if (burn <= 0) continue;
        burning++;
        ft[idx] = burn - 1;
        if (spread && burning < MAX_BURNING) {
          // Inline 4-neighbor check (no array-of-pairs allocation)
          if (x > 0) {
            const nidx = idx - 1;
            if (ft[nidx] <= 0) {
              const b = this.biome[nidx];
              if (b === 'forest' || b === 'jungle' || b === 'grassland' || b === 'plains' || b === 'savanna') cand[candCount++] = nidx;
            }
          }
          if (x < w - 1) {
            const nidx = idx + 1;
            if (ft[nidx] <= 0) {
              const b = this.biome[nidx];
              if (b === 'forest' || b === 'jungle' || b === 'grassland' || b === 'plains' || b === 'savanna') cand[candCount++] = nidx;
            }
          }
          if (y > 0) {
            const nidx = idx - w;
            if (ft[nidx] <= 0) {
              const b = this.biome[nidx];
              if (b === 'forest' || b === 'jungle' || b === 'grassland' || b === 'plains' || b === 'savanna') cand[candCount++] = nidx;
            }
          }
          if (y < h - 1) {
            const nidx = idx + w;
            if (ft[nidx] <= 0) {
              const b = this.biome[nidx];
              if (b === 'forest' || b === 'jungle' || b === 'grassland' || b === 'plains' || b === 'savanna') cand[candCount++] = nidx;
            }
          }
        }
      }
    }
    for (let i = 0; i < candCount && burning < MAX_BURNING; i++) {
      const nidx = cand[i];
      if (ft[nidx] <= 0) { ft[nidx] = 40; burning++; } // fresh flame, shorter life than source
    }
    return burning;
  }

  countFires() {
    let n = 0;
    for (let i = 0; i < this.fireTiles.length; i++) {
      if (this.fireTiles[i] > 0) n++;
    }
    return n;
  }

  /**
   * Get slope between two adjacent tiles
   */
  getSlope(x1, y1, x2, y2) {
    const idx1 = y1 * this.width + x1;
    const idx2 = y2 * this.width + x2;
    return Math.abs(this.elevation[idx1] - this.elevation[idx2]);
  }

  /**
   * Tile accessor used by infrastructure systems. Returns terrain data plus a
   * normalized slope (0..1 over the 0-100 elevation scale) and passability.
   */
  getTile(x, y) {
    const t = this.getTerrain(x, y);
    if (!t) return null;
    let slope = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.getTerrain(x + dx, y + dy);
      if (n) slope = Math.max(slope, Math.abs(n.elevation - t.elevation));
    }
    return {
      ...t,
      slope: slope / 100,
      // Passability must agree with isWalkable(): mountains and any water
      // (lakes/rivers/ocean) are impassable unless bridged.
      passable: this.isWalkable(x, y),
      mountain: t.type === 'mountain',
      water: t.waterLevel > 0.3 || t.type === 'water' || t.type === 'ocean' || t.type === 'deep_water'
    };
  }

  /**
   * Fertility multiplier for a tile given the current season. Pure function —
   * deterministic and save-safe (season derives from clock tick).
   */
  static seasonFertility(season) {
    switch (season) {
      case 'spring': return 1.1;
      case 'summer': return 1.0;
      case 'autumn': return 0.8;
      case 'winter': return 0.25;
      default: return 1.0;
    }
  }

  // Spatial indexing for fast entity lookup
  addToSpatialIndex(x, y, entity) {
    const key = `${x},${y}`;
    if (!this.spatialIndex.has(key)) {
      this.spatialIndex.set(key, []);
    }
    this.spatialIndex.get(key).push(entity);
  }

  removeFromSpatialIndex(x, y, entity) {
    const key = `${x},${y}`;
    const entities = this.spatialIndex.get(key);
    if (entities) {
      const idx = entities.indexOf(entity);
      if (idx >= 0) entities.splice(idx, 1);
    }
  }

  // Periodically rebuild the spatial index from authoritative entity lists.
  // Agents move every tick without re-registering, so the index drifts;
  // this corrects stale cells and prunes dead/removed entities.
  rebuildSpatialIndex(agents, resources, buildings, animals = []) {
    this.spatialIndex.clear();
    for (const agent of agents) {
      if (agent.alive !== false) this.addToSpatialIndex(Math.floor(agent.x), Math.floor(agent.y), agent);
    }
    for (const resource of resources) {
      if (resource.depleted === true || resource.amount <= 0) continue;
      this.addToSpatialIndex(Math.floor(resource.x), Math.floor(resource.y), resource);
    }
    for (const building of buildings) {
      if (building.destroyed === true) continue;
      this.addToSpatialIndex(Math.floor(building.x), Math.floor(building.y), building);
    }
    for (const animal of animals) {
      if (animal.alive === false) continue;
      this.addToSpatialIndex(Math.floor(animal.x), Math.floor(animal.y), animal);
    }
  }

  getEntitiesAt(x, y) {
    return this.spatialIndex.get(`${x},${y}`) || [];
  }

  getEntitiesNear(x, y, radius) {
    const entities = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          entities.push(...this.getEntitiesAt(x + dx, y + dy));
        }
      }
    }
    return entities;
  }

  // Helper methods for systems to query nearby entities
  getNearbyAgents(x, y, radius) {
    const entities = this.getEntitiesNear(Math.floor(x), Math.floor(y), Math.ceil(radius));
    return entities.filter(e => e.type === 'agent' && e.alive);
  }
  
  getNearbyBuildings(x, y, radius) {
    const entities = this.getEntitiesNear(Math.floor(x), Math.floor(y), Math.ceil(radius));
    return entities.filter(e => e.type === 'building');
  }

  serialize() {
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      rngState: this.rng.getState(), // determinism: terrain gen advanced the stream; persist position
      elevation: Array.from(this.elevation),
      moisture: Array.from(this.moisture),
      temperature: Array.from(this.temperature),
      waterLevel: Array.from(this.waterLevel),
      biome: [...this.biome],
      riverFlow: Array.from(this.riverFlow),
      isRiverSource: Array.from(this.isRiverSource),
      roadTiles: Array.from(this.roadTiles),
      footTraffic: Array.from(this.footTraffic),
      fireTiles: Array.from(this.fireTiles),
      bridgeTiles: Array.from(this.bridgeTiles)
    };
  }

  static deserialize(data) {
    const world = new WorldState(data.width, data.height, data.seed);
    // determinism: restore RNG stream position from the save (terrain gen in
    // the constructor above advanced it); fall back to legacy saves.
    if (data.rngState) {
      world.rng.setState(data.rngState);
    } else {
      world.rng.setState({ seed: data.seed, state: data.seed });
    }
    world.elevation = new Float32Array(data.elevation);
    world.moisture = new Float32Array(data.moisture);
    world.temperature = new Float32Array(data.temperature);
    world.waterLevel = new Float32Array(data.waterLevel || new Float32Array(data.width * data.height));
    world.biome = data.biome || new Array(data.width * data.height).fill('plains');
    world.riverFlow = new Float32Array(data.riverFlow || new Float32Array(data.width * data.height));
    world.isRiverSource = new Uint8Array(data.isRiverSource || new Uint8Array(data.width * data.height));
    world.roadTiles = new Uint8Array(data.roadTiles || new Uint8Array(data.width * data.height));
    world.footTraffic = new Uint16Array(data.footTraffic || new Uint16Array(data.width * data.height));
    world.fireTiles = new Uint16Array(data.fireTiles || new Uint16Array(data.width * data.height));
    world.bridgeTiles = new Uint8Array(data.bridgeTiles || new Uint8Array(data.width * data.height));
    return world;
  }
}
