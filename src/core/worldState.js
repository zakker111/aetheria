// World state management (doc 02: terrain truth, entity state, spatial indexes)
import { RNG } from "./rng.js";

export class WorldState {
  constructor(width = 64, height = 64, seed = Date.now()) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.rng = new RNG(seed);
    
    // Terrain (doc 02: distinguish terrain truth from entity state)
    this.elevation = new Float32Array(width * height);
    this.moisture = new Float32Array(width * height);
    this.temperature = new Float32Array(width * height);
    
    // Spatial index for fast queries (doc 02: spatial indexes)
    this.spatialIndex = new Map();
    
    // Derived caches (doc 02: derived/temporary caches may be rebuilt)
    this.terrainCache = new Map();
    
    this.generateTerrain();
  }

  generateTerrain() {
    // Simple noise-based terrain generation
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        
        // Simple noise (would use Perlin/Simplex in production)
        const e = this.noise(x * 0.1, y * 0.1) * 0.5 + 
                  this.noise(x * 0.05, y * 0.05) * 0.3 +
                  this.noise(x * 0.02, y * 0.02) * 0.2;
        
        this.elevation[idx] = e;
        this.moisture[idx] = this.noise(x * 0.08 + 100, y * 0.08 + 100);
        this.temperature[idx] = 0.5 + (y / this.height - 0.5) * 0.3;
      }
    }
  }

  noise(x, y) {
    // Simple hash-based noise
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
      type: this.getTerrainType(this.elevation[idx], this.moisture[idx])
    };
  }

  getTerrainType(elevation, moisture) {
    if (elevation < 0.3) return "water";
    if (elevation < 0.35) return "beach";
    if (elevation > 0.7) return "mountain";
    if (moisture > 0.6) return "forest";
    if (moisture < 0.3) return "desert";
    return "grassland";
  }

  isWalkable(x, y) {
    const terrain = this.getTerrain(x, y);
    return terrain && terrain.type !== "water" && terrain.type !== "mountain";
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

  serialize() {
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      elevation: Array.from(this.elevation),
      moisture: Array.from(this.moisture),
      temperature: Array.from(this.temperature)
    };
  }

  static deserialize(data) {
    const world = new WorldState(data.width, data.height, data.seed);
    world.elevation = new Float32Array(data.elevation);
    world.moisture = new Float32Array(data.moisture);
    world.temperature = new Float32Array(data.temperature);
    return world;
  }
}
