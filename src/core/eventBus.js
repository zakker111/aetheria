// Event bus for decoupled communication (doc 02: events are inputs to reactive systems)
export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
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
