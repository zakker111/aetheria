// World state management (doc 02: terrain truth, entity state, spatial indexes)
// Phase 8: Procedural Terrain & Hydrology - Milestone 8.1 & 8.2
import { RNG } from "./rng.js";

export class WorldState {
  constructor(width = 128, height = 128, seed = Date.now()) {
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

    // Spatial index for fast queries (doc 02: spatial indexes)
    this.spatialIndex = new Map();

    // Derived caches (doc 02: derived/temporary caches may be rebuilt)
    this.terrainCache = new Map();
    this.simulation = null;
    this.eventBus = null;

    // Compatibility properties for combat and construction systems
    Object.defineProperty(this, 'factions', {
      get: () => this.simulation?.factionSystem?.factions || new Map(),
      configurable: true
    });

    Object.defineProperty(this, 'agents', {
      get: () => this.simulation?.agents || [],
      configurable: true
    });

    Object.defineProperty(this, 'events', {
      get: () => ({
        trigger: (evt, data) => this.eventBus?.emit(evt, data)
      }),
      configurable: true
    });

    this.generateTerrain();
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

  // Map compatibility interface
  get map() {
    return {
      size: this.width,
      width: this.width,
      height: this.height,
      getTile: (x, y) => this.getTerrain(x, y)
    };
  }

  // Helper to get single entity at tile
  getEntityAt(x, y) {
    const list = this.getEntitiesAt(x, y);
    return list && list.length > 0 ? list[0] : null;
  }

  // Event bus triggering compatibility
  get events() {
    return {
      trigger: (eventName, data) => {
        if (this.eventBus) {
          this.eventBus.emit(eventName, data);
        } else if (this.simulation && this.simulation.eventBus) {
          this.simulation.eventBus.emit(eventName, data);
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
    this.placeResources();
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
    // Water deeper than 1.5 units is not walkable
    if (terrain.waterLevel > 1.5) return false;
    // Some biomes are not walkable
    const nonWalkable = ["water", "deep_water"];
    return !nonWalkable.includes(terrain.type);
  }

  /**
   * Get slope between two adjacent tiles
   */
  getSlope(x1, y1, x2, y2) {
    const idx1 = y1 * this.width + x1;
    const idx2 = y2 * this.width + x2;
    return Math.abs(this.elevation[idx1] - this.elevation[idx2]);
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
      elevation: Array.from(this.elevation),
      moisture: Array.from(this.moisture),
      temperature: Array.from(this.temperature),
      waterLevel: Array.from(this.waterLevel),
      biome: [...this.biome],
      riverFlow: Array.from(this.riverFlow),
      isRiverSource: Array.from(this.isRiverSource)
    };
  }

  static deserialize(data) {
    const world = new WorldState(data.width, data.height, data.seed);
    world.elevation = new Float32Array(data.elevation);
    world.moisture = new Float32Array(data.moisture);
    world.temperature = new Float32Array(data.temperature);
    world.waterLevel = new Float32Array(data.waterLevel || new Float32Array(data.width * data.height));
    world.biome = data.biome || new Array(data.width * data.height).fill('plains');
    world.riverFlow = new Float32Array(data.riverFlow || new Float32Array(data.width * data.height));
    world.isRiverSource = new Uint8Array(data.isRiverSource || new Uint8Array(data.width * data.height));
    return world;
  }
}
