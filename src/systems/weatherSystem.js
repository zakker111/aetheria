/**
 * Weather & Environmental Cataclysm System
 * Governs dynamic weather cycles (Clear, Rain, Thunderstorm, Drought),
 * physical environmental interactions, lightning strikes, and wildfire dousing.
 */

export const WEATHER_TYPES = {
  CLEAR: { id: 'clear', name: 'Clear Skies', icon: '☀️', ambientLight: 1.0, description: 'Gentle breeze and fertile clear skies' },
  RAIN: { id: 'rain', name: 'Rainstorm', icon: '🌧️', ambientLight: 0.85, description: 'Precipitation douses wildfires & enriches soil' },
  STORM: { id: 'storm', name: 'Thunderstorm', icon: '⛈️', ambientLight: 0.65, description: 'Severe thunder, dark tempest & lightning strikes' },
  DROUGHT: { id: 'drought', name: 'Solar Drought', icon: '🔥', ambientLight: 1.15, description: 'Intense sun increases wildfire hazards' },
};

export class WeatherSystem {
  constructor(simulation) {
    this.sim = simulation;
    this.currentWeather = 'clear';
    this.weatherDuration = 500;
    this.weatherStartTick = 0;
    this.recentLightning = null; // { x, y, tick, expires }
  }

  getWeatherInfo() {
    const wConfig = Object.values(WEATHER_TYPES).find(w => w.id === this.currentWeather) || WEATHER_TYPES.CLEAR;
    return {
      type: this.currentWeather,
      name: wConfig.name,
      icon: wConfig.icon,
      description: wConfig.description,
      ambientLight: wConfig.ambientLight,
    };
  }

  setWeather(type, duration = 600) {
    if (!WEATHER_TYPES[type.toUpperCase()] && !Object.values(WEATHER_TYPES).some(w => w.id === type)) return;
    this.currentWeather = type;
    this.weatherDuration = duration;
    this.weatherStartTick = this.sim.clock.tick;

    const wConfig = Object.values(WEATHER_TYPES).find(w => w.id === type) || WEATHER_TYPES.CLEAR;

    this.sim.eventBus.emit('WEATHER_CHANGED', {
      weather: type,
      name: wConfig.name,
      icon: wConfig.icon,
      tick: this.sim.clock.tick,
    });
  }

  update(tick) {
    // Natural weather cycles every weatherDuration ticks
    if (tick - this.weatherStartTick >= this.weatherDuration) {
      this.cycleNaturalWeather(tick);
    }

    const world = this.sim.world;
    if (!world) return;

    // Rain & Storm environmental effects
    if (this.currentWeather === 'rain' || this.currentWeather === 'storm') {
      // 1. Douse burning fires naturally
      if (world.fireTiles && this.sim._fireActive) {
        for (let i = 0; i < world.fireTiles.length; i++) {
          if (world.fireTiles[i] > 0) {
            world.fireTiles[i] = Math.max(0, world.fireTiles[i] - 2);
          }
        }
      }

      // 2. Replenish water nodes periodically
      if (tick % 60 === 0 && this.sim.resources) {
        for (const res of this.sim.resources) {
          if (res.resourceType === 'water' && !res.destroyed) {
            res.amount = Math.min(res.maxAmount || 100, res.amount + 4);
          }
        }
      }
    }

    // Storm lightning strikes
    if (this.currentWeather === 'storm' && tick % 45 === 0) {
      // Deterministic lightning strike
      const rng = this.sim._rng();
      if (rng.next() < 0.45) {
        const lx = Math.floor(rng.next() * (world.width - 8)) + 4;
        const ly = Math.floor(rng.next() * (world.height - 8)) + 4;
        this.strikeLightning(lx, ly, false);
      }
    }

    // Drought effects: increase fire spread sensitivity and dry shallow springs
    if (this.currentWeather === 'drought' && tick % 80 === 0) {
      if (this.sim.resources) {
        for (const res of this.sim.resources) {
          if (res.resourceType === 'water' && !res.destroyed && res.amount > 10) {
            res.amount = Math.max(5, res.amount - 2);
          }
        }
      }
    }
  }

  cycleNaturalWeather(tick) {
    const types = ['clear', 'clear', 'rain', 'clear', 'storm', 'drought'];
    const rng = this.sim._rng();
    const nextType = types[Math.floor(rng.next() * types.length)];
    this.setWeather(nextType, 450 + Math.floor(rng.next() * 350));
  }

  strikeLightning(x, y, manual = false) {
    const world = this.sim.world;
    if (!world) return;

    this.recentLightning = {
      x,
      y,
      tick: this.sim.clock.tick,
      timestamp: Date.now(),
      expires: Date.now() + 350,
    };

    // Chance to ignite forest or wood tile
    const fx = Math.max(0, Math.min(world.width - 1, Math.floor(x)));
    const fy = Math.max(0, Math.min(world.height - 1, Math.floor(y)));
    const idx = fy * world.width + fx;
    const biome = world.biome ? world.biome[idx] : 'grassland';
    if (biome === 'forest' || biome === 'jungle' || biome === 'savanna') {
      world.startFire(fx, fy, 90);
    }

    this.sim.eventBus.emit('LIGHTNING_STRIKE', {
      x,
      y,
      manual,
      tick: this.sim.clock.tick,
    });
  }

  douseFireArea(cx, cy, radius = 8) {
    const world = this.sim.world;
    if (!world || !world.fireTiles) return 0;

    let doused = 0;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const tx = Math.floor(cx + dx);
          const ty = Math.floor(cy + dy);
          if (tx >= 0 && tx < world.width && ty >= 0 && ty < world.height) {
            const idx = ty * world.width + tx;
            if (world.fireTiles[idx] > 0) {
              world.fireTiles[idx] = 0;
              doused++;
            }
          }
        }
      }
    }
    return doused;
  }

  serialize() {
    return {
      currentWeather: this.currentWeather,
      weatherDuration: this.weatherDuration,
      weatherStartTick: this.weatherStartTick,
    };
  }

  static deserialize(data, sim) {
    const sys = new WeatherSystem(sim);
    if (data) {
      sys.currentWeather = data.currentWeather || 'clear';
      sys.weatherDuration = data.weatherDuration || 600;
      sys.weatherStartTick = data.weatherStartTick || 0;
    }
    return sys;
  }
}
