// Simulation clock (doc 03: fixed simulation tick, clock is source of truth)
import { SEASON_TYPES } from '../core/constants.js';

const SEASONS = [SEASON_TYPES.SPRING, SEASON_TYPES.SUMMER, SEASON_TYPES.AUTUMN, SEASON_TYPES.WINTER];
export const TICKS_PER_SEASON = 100; // 400 ticks = 1 year
export const TICKS_PER_YEAR = TICKS_PER_SEASON * 4;

export class SimulationClock {
  constructor() {
    this.tick = 0;
    this.speed = 1.0; // 0 = paused, 1 = normal, 2 = fast, etc.
    this.tickRate = 100; // ms per tick at speed 1.0
  }

  // --- Seasons (pure functions of tick: deterministic & save-safe) ---
  getSeason() {
    return SEASONS[Math.floor((this.tick % TICKS_PER_YEAR) / TICKS_PER_SEASON)];
  }

  getYear() {
    return Math.floor(this.tick / TICKS_PER_YEAR) + 1;
  }

  // 0..1 progress through the current season
  getSeasonProgress() {
    return (this.tick % TICKS_PER_SEASON) / TICKS_PER_SEASON;
  }

  // True on the exact tick the season flips (for events/chronicle logging)
  seasonChanged() {
    return this.tick > 0 && this.tick % TICKS_PER_SEASON === 0;
  }

  advance() {
    if (this.speed > 0) {
      this.tick++;
    }
  }

  setSpeed(speed) {
    this.speed = Math.max(0, speed);
  }

  pause() {
    this.speed = 0;
  }

  getTime() {
    // Convert ticks to in-game time (1 tick = 1 hour, 24 ticks = 1 day)
    const hours = this.tick % 24;
    const days = Math.floor(this.tick / 24);
    return { tick: this.tick, days, hours };
  }

  serialize() {
    return { tick: this.tick, speed: this.speed };
  }

  static deserialize(data) {
    const clock = new SimulationClock();
    clock.tick = data.tick;
    clock.speed = data.speed;
    return clock;
  }
}
