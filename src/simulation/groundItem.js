// Ground items (Phase 1 — Deep Economy): loot dropped by the dead, scavenged by the living.
// Deterministic: no RNG draws at construction; decay uses fixed ttl + id parity so
// save/load resume matches an uninterrupted run exactly.
export class GroundItem {
  constructor(x, y, contents = {}, ttl = 600, id = -1) {
    this.id = id;
    this.type = 'item'; // distinct from agent/resource/building/animal — ignored by perception filters
    this.x = x;
    this.y = y;
    // itemKey -> count (e.g. { wheat: 2, bread: 1 })
    this.contents = { ...contents };
    this.ttl = ttl; // ticks before the pile rots/vanishes
    this.destroyed = false;
  }

  total() {
    let n = 0;
    for (const k of Object.keys(this.contents)) {
      if (k !== 'capacity') n += this.contents[k] || 0;
    }
    return n;
  }

  update() {
    if (this.destroyed) return;
    this.ttl--;
    if (this.ttl <= 0) this.destroyed = true;
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      contents: { ...this.contents },
      ttl: this.ttl,
      destroyed: this.destroyed
    };
  }

  static deserialize(data, idGen) {
    // determinism: don't consume ids from the shared generator during load
    const item = new GroundItem(data.x, data.y, data.contents || {}, data.ttl ?? 600, -1);
    item.id = data.id;
    item.destroyed = data.destroyed || false;
    return item;
  }
}
