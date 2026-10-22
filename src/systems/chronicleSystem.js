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
    const list = this.entries.slice(-limit).reverse();
    this._refreshFrontLines(list);
    return list;
  }

  // Find the (active or historic) war record between two settlements.
  _findWarBetween(idA, idB) {
    if (idA == null || idB == null) return null;
    const dip = this.sim?.diplomacySystem;
    if (!dip) return null;
    const match = (w) => (w.attackerId === idA && w.defenderId === idB) ||
      (w.attackerId === idB && w.defenderId === idA);
    return (dip.activeWars || []).find(match) || (dip.warHistory || []).find(match) || null;
  }

  // Step E: war entries carry a snapshot of the front line taken at
  // declaration time (usually empty — battles haven't happened yet).
  // Refresh it from the live war record when the feed is read, so clicking
  // a ⚔️ entry always jumps to where the fighting actually is. Read-only
  // w.r.t. simulation state; safe during save/load and determinism checks.
  _refreshFrontLines(entries) {
    for (const e of entries) {
      if (e.kind !== 'war' || e.attackerId == null) continue;
      const w = this._findWarBetween(e.attackerId, e.defenderId);
      if (w?.frontLine) e.frontLine = { ...w.frontLine };
    }
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
      // Step E: ⚔️/🕊️ icons live in the entry text AND as the machine-
      // readable `icon` field so UI layers can render glyphs without
      // string-matching. War entries carry front-line coords for
      // click-to-jump; they refresh from the live war record at read time.
      if (/war/i.test(title)) {
        const w = this._findWarBetween(d.settlementA_id, d.settlementB_id);
        this.add('war', `⚔️ ${a} declared war on ${b} — "${title}".`, {
          icon: '⚔️', kind2: 'war',
          attackerId: d.settlementA_id, defenderId: d.settlementB_id,
          frontLine: w?.frontLine ? { ...w.frontLine } : null
        });
      } else if (/peace|treaty/i.test(title)) {
        this.add('peace', `🕊️ ${a} and ${b} made peace: ${title.replace(/[^\p{L}\p{P}\p{N}\s]/gu, '').trim() || 'a treaty'}.`, {
          icon: '🕊️', kind2: 'peace',
          settlementIds: [d.settlementA_id, d.settlementB_id]
        });
      } else if (/alliance/i.test(title)) {
        this.add('peace', `🤝 ${a} and ${b} became allies: ${title.replace(/[^\p{L}\p{P}\p{N}\s]/gu, '').trim() || 'an alliance'}.`, {
          icon: '🤝', kind2: 'peace',
          settlementIds: [d.settlementA_id, d.settlementB_id]
        });
      } else {
        this.add('era', `${title}: ${a} ↔ ${b}.`, { icon: '📜' });
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
    // Phase 3b Step 3: combat-depth chronicle entries (rout / wounds).
    bus.on('WARBAND_ROUTED', (d) => {
      this.add('war', `🏳️ ${d.settlementName || 'A warband'} broke and routed from the field.`);
    });
    bus.on('SOLDIER_WOUNDED', () => {
      // Wounds are common — record them in aggregate only, so the chronicle
      // stays readable (the renderer shows wounded status per soldier).
      this.woundCount = (this.woundCount ?? 0) + 1;
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
    bus.on('SETTLEMENT_REFUNDED', (d) => {
      this.add('founding', `${d.name || 'Ancient ruins'} was resettled — its halls echo with new voices.`);
    });
    bus.on('BUILDING_COLLAPSED', (d) => {
      this.add('ruin', `Another roof at ${d.name || 'the ruins'} collapsed into dust (${d.buildingType || 'structure'}).`);
    });
    bus.on('SETTLEMENT_FORGOTTEN', (d) => {
      this.add('ruin', `${d.name || 'A forgotten hold'} has crumbled beyond memory. Its name passes from the chronicle.`);
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
