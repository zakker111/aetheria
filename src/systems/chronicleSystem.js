// Chronicle System — the world's living history book.
// Subscribes to major simulation events (wars, plagues, famines, founding,
// destruction, great deeds) and records timestamped entries with in-world
// dates derived from the simulation clock. Deterministic: no RNG usage.

const MAX_ENTRIES = 400; // ring buffer cap keeps saves bounded

export class ChronicleSystem {
  constructor(sim = null) {
    this.sim = sim;
    this.entries = [];
    this._nextEntryId = 1;
    this._wireEvents();
  }

  // In-world calendar: 1 year = 400 ticks, 1 season = 100 ticks
  formatDate(tick) {
    const year = Math.floor(tick / 400) + 1;
    const seasonIdx = Math.floor((tick % 400) / 100);
    const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
    const day = (tick % 100) + 1;
    return `Y${year} ${seasons[seasonIdx]} d${day}`;
  }

  add(kind, text, extra = {}) {
    const tick = this.sim?.clock?.tick ?? 0;
    const entry = {
      id: this._nextEntryId++,
      tick,
      date: this.formatDate(tick),
      kind,          // founding | war | plague | famine | fire | death | wonder | ruin | peace | era
      text,
      ...extra
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    return entry;
  }

  recent(limit = 30) {
    return this.entries.slice(-limit).reverse();
  }

  _wireEvents() {
    const bus = this.sim?.eventBus;
    if (!bus) return;

    bus.on('SETTLEMENT_FOUNDED', (d) => {
      this.add('founding', `${d.name || 'A new settlement'} was founded at (${Math.round(d.x)},${Math.round(d.y)}).`,
        { settlementName: d.name });
    });
    bus.on('DIPLOMATIC_EVENT', (d) => {
      const title = d.title || 'A treaty';
      const a = d.settlementA || 'A realm';
      const b = d.settlementB || 'a neighbor';
      if (/war/i.test(title)) {
        this.add('war', `${a} declared war on ${b} — "${title}".`);
      } else if (/peace|treaty|alliance/i.test(title)) {
        this.add('peace', `${a} and ${b} made peace: ${title}.`);
      } else {
        this.add('era', `${title}: ${a} ↔ ${b}.`);
      }
    });
    bus.on('WARBAND_MOBILIZED', (d) => {
      this.add('war', `${d.settlementName || 'A town'} mobilized a warband of ${d.size || '?'} (${d.role || 'attack'}).`);
    });
    bus.on('SETTLEMENT_PLUNDERED', (d) => {
      this.add('war', `${d.attackerName || 'Raiders'} plundered ${d.defenderName || 'a town'} — ${Math.round(d.food || 0)} food, ${Math.round(d.wood || 0)} wood seized.`);
    });
    bus.on('SETTLEMENT_BURNED', (d) => {
      this.add('fire', `${d.defenderName || 'A town'} was set ablaze by ${d.attackerName || 'raiders'}. Flames spread across the rooftops.`);
    });
    bus.on('building_destroyed', (d) => {
      const b = d.building;
      if (b && (b.buildingType === 'castle' || b.buildingType === 'tower')) {
        this.add('ruin', `The great ${b.buildingType} fell to ${d.cause || 'war'}. Only smoldering stones remain.`);
      }
    });
    bus.on('EVENT_OCCURRED', (ev) => {
      if (!ev) return;
      const kindMap = { plague: 'plague', famine: 'famine', earthquake: 'wonder', golden_harvest: 'wonder' };
      const kind = kindMap[ev.type] || 'wonder';
      this.add(kind, `${ev.name}: ${ev.description || ''}`.trim());
    });
    bus.on('CASTLE_BUILT', (d) => {
      this.add('era', `${d.settlementName || 'A lord'} raised a castle — an age of stone begins.`);
    });
    bus.on('SETTLEMENT_ABANDONED', (d) => {
      this.add('ruin', `${d.name || 'A settlement'} stands abandoned. Nature reclaims its roads.`);
    });
    bus.on('ANIMAL_KILLED', (d) => {
      // Only notable kills make the chronicle (keeps it readable)
      if (d.by === 'wolf') this.add('death', `A ${d.species} was torn apart by wolves in the wild.`);
    });
  }

  serialize() {
    return {
      nextEntryId: this._nextEntryId,
      entries: this.entries.map(e => ({ ...e }))
    };
  }

  static deserialize(data, sim) {
    const system = new ChronicleSystem(sim);
    if (data) {
      system.entries = Array.isArray(data.entries) ? data.entries.slice(-MAX_ENTRIES) : [];
      system._nextEntryId = data.nextEntryId || (system.entries.length + 1);
    }
    return system;
  }
}
