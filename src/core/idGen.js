// Deterministic ID generator
export class IDGenerator {
  constructor(startId = 1) {
    this.nextId = startId;
  }

  next() {
    return this.nextId++;
  }

  getState() {
    return { nextId: this.nextId };
  }

  setState(state) {
    this.nextId = state.nextId;
  }
}
