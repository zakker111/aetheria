// Event bus for decoupled communication (doc 02: events are inputs to reactive systems)

let instance = null;

export class EventBus {
  constructor(options = {}) {
    // By default act as the legacy global singleton bus. Pass { isolated: true }
    // (used by Simulation) to get a private per-instance bus so multiple
    // simulations/tests never share listeners or history (determinism fix).
    if (!options.isolated && instance) {
      return instance;
    }
    this.listeners = new Map();
    this.history = [];
    this.maxHistory = 500; // cap to prevent unbounded memory growth
    if (!options.isolated) {
      instance = this;
    }
  }

  static getInstance() {
    if (!instance) {
      instance = new EventBus();
    }
    return instance;
  }

  off(eventType, callback) {
    const callbacks = this.listeners.get(eventType);
    if (!callbacks) return;
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) callbacks.splice(idx, 1);
  }
  
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  emit(eventType, data = {}) {
    const event = { type: eventType, ...data, timestamp: Date.now() };
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
    
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach(cb => cb(event));
  }

  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }
}
