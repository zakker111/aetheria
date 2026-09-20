// Deterministic seeded RNG (doc 02: all randomness through one seeded service)
export class RNG {
  constructor(seed = Date.now()) {
    this.seed = seed;
    this.state = seed;
  }

  // Mulberry32 algorithm
  next() {
    this.state |= 0;
    this.state = this.state + 0x6D2B79F5 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick(array) {
    return array[this.int(0, array.length - 1)];
  }

  chance(probability) {
    return this.next() < probability;
  }

  // Save/restore state for determinism
  getState() {
    return { seed: this.seed, state: this.state };
  }

  setState(state) {
    this.seed = state.seed;
    this.state = state.state;
  }
}
