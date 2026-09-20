// Entity store (doc 02: explicit EntityStore interface)
export class EntityStore {
  constructor() {
    this.entities = new Map();
    this.nextId = 1;
  }

  create(type, data = {}) {
    const id = this.nextId++;
    const entity = {
      id,
      type,
      ...data,
      createdAt: Date.now()
    };
    this.entities.set(id, entity);
    return entity;
  }

  get(id) {
    return this.entities.get(id);
  }

  update(id, updates) {
    const entity = this.entities.get(id);
    if (entity) {
      Object.assign(entity, updates);
    }
    return entity;
  }

  delete(id) {
    return this.entities.delete(id);
  }

  getByType(type) {
    const result = [];
    for (const entity of this.entities.values()) {
      if (entity.type === type) {
        result.push(entity);
      }
    }
    return result;
  }

  getAll() {
    return Array.from(this.entities.values());
  }

  serialize() {
    return {
      nextId: this.nextId,
      entities: Array.from(this.entities.entries())
    };
  }

  static deserialize(data) {
    const store = new EntityStore();
    store.nextId = data.nextId;
    store.entities = new Map(data.entities);
    return store;
  }
}
