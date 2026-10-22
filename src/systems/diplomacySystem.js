/**
 * Diplomacy System
 * Manages inter-settlement foreign relations, alliances, treaties, and declarations of war.
 */

export const DIPLOMATIC_STATUS = {
  ALLIANCE: "alliance",
  PEACE: "peace",
  TENSION: "tension",
  WAR: "war"
};

export class DiplomacySystem {
  constructor(simulation) {
    this.sim = simulation;
    // Map of key `${minId}_${maxId}` -> Relation Record
    this.relations = new Map();
    // List of active treaties: { id, type, settlements: [id1, id2], duration, startTick, terms }
    this.treaties = [];
    // War records: { id, attackerId, defenderId, startTick, battles: [], casualties: { [id]: count }, plundered: {} }
    this.activeWars = [];
    this.warHistory = [];
    this.nextWarId = 1;
    this.nextTreatyId = 1;
    this.lastDiplomacyTick = 0;
    // Step D: grievance ledger keyed by relation -> Map(targetId -> {weight, reason}).
    // Neighboring settlements accumulate friction toward their closest rival;
    // weights decay over time (see update()) so tension breathes instead of
    // hard-expiring. Purely deterministic bookkeeping — no RNG.
    this.grievances = new Map();
    // Step H: pre-seeded feuds from starter scenarios ("warring kingdoms").
    // Each entry declares war once both settlements exist at tick >= startTick.
    this.seededFeuds = [];
  }

  /**
   * Step H: register a pre-seeded rivalry for scenario starts. Names may be
   * settlement ids (numbers/numeric strings) or exact settlement names; id
   * feuds resolve the moment both towns exist, name feuds also match later-
   * founded towns. Deterministic: pure bookkeeping, no RNG. War declaration
   * is deferred to update() because settlement ids are assigned lazily as
   * towns are founded during world init.
   */
  seedFeud(nameA, nameB, startTick = 100) {
    if (!nameA || !nameB || nameA === nameB) return;
    if (this.seededFeuds.some(f => f.nameA === nameA && f.nameB === nameB)) return;
    this.seededFeuds.push({ nameA, nameB, startTick });
  }

  /** Resolve one feud endpoint (settlement id or exact name) to a live town. */
  _resolveFeudEndpoint(ref, settlements) {
    const byId = settlements.get(Number(ref));
    if (byId && !byId.ruined) return byId;
    let best = null;
    for (const s of settlements.values()) {
      if (!s || s.ruined || s.name !== ref) continue;
      // Deterministic tie-break: lowest id wins among same-named towns.
      if (!best || s.id < best.id) best = s;
    }
    return best;
  }

  /**
   * Step H: resolve seeded feuds once both sides exist — drag their relation
   * into open TENSION and load both grudge ledgers so the normal casus-belli
   * pipeline declares war within a few diplomacy cycles.
   */
  applySeededFeuds(tick) {
    if (!this.seededFeuds.length) return;
    const settlements = this.sim?.settlementSystem?.settlements;
    if (!settlements) return;
    const remaining = [];
    for (const feud of this.seededFeuds) {
      const a = this._resolveFeudEndpoint(feud.nameA, settlements);
      const b = this._resolveFeudEndpoint(feud.nameB, settlements);
      if (!a || !b || a.id === b.id || tick < feud.startTick) { remaining.push(feud); continue; }
      const rel = this.getRelation(a.id, b.id);
      if (rel.status !== DIPLOMATIC_STATUS.WAR) {
        rel.score = Math.min(rel.score, 15);
        rel.status = DIPLOMATIC_STATUS.TENSION;
      }
      this.addGrievance(a.id, b.id, "Old Border Feud", 24);
      this.addGrievance(b.id, a.id, "Old Border Feud", 24);
    }
    this.seededFeuds = remaining;
  }

  /**
   * Accumulate a weighted grievance from `fromId` against `targetId`.
   * The weight grows with the two settlements' belligerence and is capped so
   * no single grudge compounds forever.
   */
  addGrievance(fromId, targetId, reason, amount) {
    if (fromId === targetId || !Number.isFinite(amount)) return;
    if (!this.grievances.has(fromId)) this.grievances.set(fromId, new Map());
    const perTarget = this.grievances.get(fromId);
    const prev = perTarget.get(targetId);
    const sFrom = this.sim?.settlementSystem?.settlements?.get(fromId);
    const belligerence = sFrom?.culture?.values?.belligerence ?? 0.3;
    const inc = Math.min(6, amount * (0.7 + belligerence));
    const weight = Math.min(25, (prev?.weight ?? 0) + inc);
    perTarget.set(targetId, { weight, reason });
  }

  /** Closest OTHER settlement to `settlement` (by squared center distance). */
  nearestRival(settlement) {
    let best = null, bestD = Infinity;
    for (const other of this.sim.settlementSystem.settlements.values()) {
      if (!other || other.id === settlement.id) continue;
      const d = (other.center.x - settlement.center.x) ** 2 +
        (other.center.y - settlement.center.y) ** 2;
      if (d < bestD || (d === bestD && best && other.id < best.id)) { best = other; bestD = d; }
    }
    return best;
  }

  getRelationKey(id1, id2) {
    const min = Math.min(id1, id2);
    const max = Math.max(id1, id2);
    return `${min}_${max}`;
  }

  getRelation(id1, id2) {
    if (id1 === id2) return { score: 100, status: DIPLOMATIC_STATUS.ALLIANCE };
    const key = this.getRelationKey(id1, id2);
    if (!this.relations.has(key)) {
      this.initRelation(id1, id2);
    }
    return this.relations.get(key);
  }

  initRelation(id1, id2) {
    const s1 = this.sim.settlementSystem?.settlements.get(id1);
    const s2 = this.sim.settlementSystem?.settlements.get(id2);
    if (!s1 || !s2) return;

    const key = this.getRelationKey(id1, id2);

    // Initial score based on cultural similarity and distance
    let baseScore = 55;
    if (s1.culture && s2.culture) {
      if (s1.culture.ethos === s2.culture.ethos) baseScore += 20;
      const b1 = s1.culture.values?.belligerence ?? 0.3;
      const b2 = s2.culture.values?.belligerence ?? 0.3;
      baseScore -= (b1 + b2) * 20;
    }

    const dist = Math.hypot(s1.center.x - s2.center.x, s1.center.y - s2.center.y);
    if (dist < 30) baseScore -= 10; // Natural border friction

    baseScore = Math.max(15, Math.min(95, Math.round(baseScore)));

    let status = DIPLOMATIC_STATUS.PEACE;
    if (baseScore >= 80) status = DIPLOMATIC_STATUS.ALLIANCE;
    else if (baseScore <= 25) status = DIPLOMATIC_STATUS.TENSION;

    const record = {
      settlementA: Math.min(id1, id2),
      settlementB: Math.max(id1, id2),
      score: baseScore,
      status,
      grievances: [],
      tradeVisits: 0,
      truceUntilTick: 0
    };

    this.relations.set(key, record);
    return record;
  }

  // Periodic diplomacy evaluation
  update(tick) {
    if (!this.sim || !this.sim.settlementSystem) return;

    // Check relations every 25 ticks (Step D: faster cadence so wars start
    // within a watchable session)
    if (tick - this.lastDiplomacyTick >= 25) {
      this.lastDiplomacyTick = tick;
      // Step H: resolve any pre-seeded scenario feuds first.
      this.applySeededFeuds(tick);
      // Grievance decay: accumulated slights fade over time instead of
      // persisting forever, letting tension breathe before it boils over.
      for (const rel of this.relations.values()) {
        if (rel.grievances?.length && rel.status !== DIPLOMATIC_STATUS.WAR) {
          rel.grievances = rel.grievances
            .map(g => ({ ...g, weight: g.weight * 0.995 }))
            .filter(g => g.weight > 0.25);
        }
      }
      this.evaluateDiplomacy(tick);
      this.updateTreaties(tick);
    } else if (this.seededFeuds.length) {
      // Step H: scenario feuds can fire on any tick once both towns exist —
      // don't wait up to 25 ticks for the first diplomacy pass.
      this.applySeededFeuds(tick);
    }
  }

  evaluateDiplomacy(tick) {
    const settlements = Array.from(this.sim.settlementSystem.settlements.values());
    if (settlements.length < 2) return;

    // Step D: neighboring friction feeds a grievance ledger. Each settlement
    // accumulates weight against its CLOSEST rival (border pressure is
    // directional and localized), scaled by how big/bellicose it is. This is
    // what eventually tips deep peace into tension even when trade is good.
    for (const s of settlements) {
      const pop = s.population || s.agentIds?.size || 0;
      if (pop < 35) continue; // too small to project power — no grudges yet
      const rival = this.nearestRival(s);
      if (!rival) continue;
      const dist = Math.hypot(s.center.x - rival.center.x, s.center.y - rival.center.y);
      if (dist > 60) continue; // only genuine neighbors chafe
      const rivalPop = rival.population || rival.agentIds?.size || 0;
      const scarcity = rivalPop > pop ? 1.4 : 1.0; // envied stronger neighbor
      this.addGrievance(s.id, rival.id, "Border Friction", 0.8 * scarcity);
    }

    for (let i = 0; i < settlements.length; i++) {
      for (let j = i + 1; j < settlements.length; j++) {
        const s1 = settlements[i];
        const s2 = settlements[j];
        const rel = this.getRelation(s1.id, s2.id);
        if (!rel) continue;

        // Truce cooldown check
        if (rel.truceUntilTick > tick) {
          if (rel.status === DIPLOMATIC_STATUS.WAR) {
            rel.status = DIPLOMATIC_STATUS.PEACE;
          }
          continue;
        }

        // Natural decay or growth towards cultural baseline
        const belligerence1 = s1.culture?.values?.belligerence ?? 0.3;
        const belligerence2 = s2.culture?.values?.belligerence ?? 0.3;
        const cooperation = ((s1.culture?.values?.cooperation ?? 0.5) + (s2.culture?.values?.cooperation ?? 0.5)) / 2;

        if (cooperation > 0.65) rel.score += 0.2;
        if (belligerence1 > 0.6 || belligerence2 > 0.6) rel.score -= 0.3;

        // Proximity friction
        const dist = Math.hypot(s1.center.x - s2.center.x, s1.center.y - s2.center.y);
        if (dist < 28 && rel.status !== DIPLOMATIC_STATUS.ALLIANCE) {
          rel.score -= 0.15;
        }

        // Grievance pressure: accumulated grudges pull the relation score
        // down toward whichever side resents the other more.
        const g12 = this.grievances.get(s1.id)?.get(s2.id)?.weight ?? 0;
        const g21 = this.grievances.get(s2.id)?.get(s1.id)?.weight ?? 0;
        const grudge = Math.max(g12, g21);
        if (grudge > 0) rel.score -= grudge * 0.04;

        rel.score = Math.max(0, Math.min(100, rel.score));

        // State transitions
        if (rel.status === DIPLOMATIC_STATUS.WAR) {
          // Check if either side is exhausted or wants peace
          this.checkWarWeariness(s1, s2, rel, tick);
        } else if (rel.status === DIPLOMATIC_STATUS.ALLIANCE) {
          if (rel.score < 60) {
            rel.status = DIPLOMATIC_STATUS.PEACE;
            this.emitDiplomacyEvent(s1, s2, "Alliance Dissolved", "Friendly ties have cooled back to standard peace.");
          }
        } else if (rel.status === DIPLOMATIC_STATUS.PEACE) {
          if (rel.score >= 82) {
            this.formAlliance(s1.id, s2.id, tick);
          } else if (rel.score < 28) {
            rel.status = DIPLOMATIC_STATUS.TENSION;
            this.emitDiplomacyEvent(s1, s2, "Border Tensions", "Rivalry and border disputes spark rising friction.");
          }
        } else if (rel.status === DIPLOMATIC_STATUS.TENSION) {
          if (rel.score >= 38) {
            rel.status = DIPLOMATIC_STATUS.PEACE;
          } else if (rel.score <= 12 && rel.truceUntilTick <= tick) {
            // Evaluate all potential casus belli for each direction and pick the best-justified war
            const grievance = this.evaluateCasusBelli(s1, s2);
            if (grievance) {
              this.declareWar(grievance.attackerId, grievance.defenderId, grievance.reason, tick);
            }
          }
        }
      }
    }
  }

  /**
   * Dominant faith of a settlement: majority beliefId among its living agents.
   * Deterministic — iterates sim.agents Map in insertion order.
   */
  dominantFaith(settlement) {
    const counts = new Map();
    for (const agent of this.sim.agents.values()) {
      if (!agent.alive || agent.settlementId !== settlement.id) continue;
      const b = agent.religion?.beliefId;
      if (!b) continue;
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    let best = null, bestN = 0;
    for (const [belief, n] of counts) {
      if (n > bestN) { best = belief; bestN = n; }
    }
    return best;
  }

  /**
   * Casus belli engine: scores every plausible grievance in BOTH directions and
   * returns the best-justified war ({ attackerId, defenderId, reason, score }) or null.
   * Causes: resource hunger, diplomatic rift, religious difference, cultural militarism drift.
   * Purely deterministic (no RNG) so save/load resumes behave identically.
   */
  evaluateCasusBelli(s1, s2) {
    const candidates = [];
    const pairs = [[s1, s2], [s2, s1]]; // [attacker, defender] orientations

    // Precompute dominant faiths once per pair evaluation
    const faith1 = this.dominantFaith(s1);
    const faith2 = this.dominantFaith(s2);

    for (const [att, def] of pairs) {
      const attFood = att.stockpile?.food ?? 20;
      const defFood = def.stockpile?.food ?? 20;
      const attOre = att.stockpile?.ore ?? 10;
      const defOre = def.stockpile?.ore ?? 10;
      const attWood = att.stockpile?.wood ?? 15;
      const defWood = def.stockpile?.wood ?? 15;
      const belligerence = att.culture?.values?.belligerence ?? 0.3;

      // 1) Resource hunger — starving/impoverished attacker eyes richer neighbor's stockpiles
      const foodGap = defFood - attFood;
      if (attFood < 10 && defFood > 18) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Resource Wars — Granary Hunger",
          score: 30 + Math.min(40, foodGap * 2) });
      }
      const oreGap = defOre - attOre;
      if (attOre < 6 && defOre > 12) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Resource Wars — Ore Greed",
          score: 25 + Math.min(30, oreGap * 1.5) });
      }
      const woodGap = defWood - attWood;
      if (attWood < 6 && defWood > 15) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Resource Wars — Timber Raids",
          score: 22 + Math.min(25, woodGap) });
      }

      // 2) Diplomatic rift — deep mutual distrust / betrayed proximity friction
      const rel = this.getRelation(s1.id, s2.id);
      if (rel && rel.score <= 12) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Diplomatic Rift — Border Skirmish",
          score: 20 + (12 - rel.score) * 1.5 });
      }

      // 3) Religious difference — zealous attacker vs heretic neighbor of a different faith
      const attFaith = att.id === s1.id ? faith1 : faith2;
      const defFaith = att.id === s1.id ? faith2 : faith1;
      if (attFaith && defFaith && attFaith !== defFaith) {
        // Zealotry proxy: average faith of attacker's believers of that creed
        let zealSum = 0, zealN = 0;
        for (const agent of this.sim.agents.values()) {
          if (!agent.alive || agent.settlementId !== att.id) continue;
          if (agent.religion?.beliefId === attFaith) {
            zealSum += agent.religion.faith ?? 50;
            zealN++;
          }
        }
        const zeal = zealN > 0 ? zealSum / zealN : 0;
        if (zeal >= 65) {
          candidates.push({ attackerId: att.id, defenderId: def.id,
            reason: "Holy War — Crusade Against Heretics",
            score: 28 + (zeal - 65) * 1.2 });
        }
      }

      // 4) Cultural militarism drift — highly belligerent society picking fights
      if (belligerence > 0.55) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Militarist Aggression — Conquest",
          score: 15 + belligerence * 35 });
      }
    }

    if (candidates.length === 0) return null;
    // Deterministic pick: highest score; tie-break by attacker id then defender id
    candidates.sort((a, b) => (b.score - a.score) || (a.attackerId - b.attackerId) || (a.defenderId - b.defenderId));
    return candidates[0];
  }

  declareWar(attackerId, defenderId, casusBelli = "Territorial Conquest", tick = 0) {
    const rel = this.getRelation(attackerId, defenderId);
    if (!rel || rel.status === DIPLOMATIC_STATUS.WAR) return;

    rel.status = DIPLOMATIC_STATUS.WAR;
    rel.score = Math.min(rel.score, 5);
    // The grievance that justified this war is now spent.
    if (this.grievances.has(attackerId)) this.grievances.get(attackerId).delete(defenderId);

    const sA = this.sim.settlementSystem.settlements.get(attackerId);
    const sD = this.sim.settlementSystem.settlements.get(defenderId);
    if (!sA || !sD) return;

    const war = {
      id: this.nextWarId++,
      attackerId,
      defenderId,
      attackerName: sA.name,
      defenderName: sD.name,
      startTick: tick || this.sim.clock.tick,
      casusBelli,
      battles: [],
      casualties: { [attackerId]: 0, [defenderId]: 0 },
      plundered: { food: 0, wood: 0, ore: 0 },
      active: true
    };

    this.activeWars.push(war);

    // Break any existing alliances or treaties
    this.removeTreatyBetween(attackerId, defenderId);

    // Call defense allies
    this.callAlliesToWar(war);

    // Trigger warfare system mobilization
    if (this.sim.warfareSystem) {
      this.sim.warfareSystem.onWarDeclared(war);
    }

    this.emitDiplomacyEvent(sA, sD, `⚔️ War Declared!`, `${sA.name} has declared war on ${sD.name} (${casusBelli})!`);
    return war;
  }

  callAlliesToWar(war) {
    // Check defender allies
    const defenderAllies = this.getAllies(war.defenderId);
    for (const allyId of defenderAllies) {
      if (allyId !== war.attackerId) {
        const allyRel = this.getRelation(allyId, war.attackerId);
        if (allyRel.status !== DIPLOMATIC_STATUS.WAR) {
          allyRel.status = DIPLOMATIC_STATUS.WAR;
          const a = this.sim.settlementSystem.settlements.get(allyId);
          const att = this.sim.settlementSystem.settlements.get(war.attackerId);
          if (a && att) {
            this.emitDiplomacyEvent(a, att, "Allied Intervention", `${a.name} honors alliance with ${war.defenderName} and joins the war!`);
          }
        }
      }
    }
  }

  formAlliance(id1, id2, tick) {
    const rel = this.getRelation(id1, id2);
    if (!rel || rel.status === DIPLOMATIC_STATUS.ALLIANCE) return;

    rel.status = DIPLOMATIC_STATUS.ALLIANCE;
    rel.score = Math.max(rel.score, 85);

    const s1 = this.sim.settlementSystem.settlements.get(id1);
    const s2 = this.sim.settlementSystem.settlements.get(id2);
    if (!s1 || !s2) return;

    const treaty = {
      id: this.nextTreatyId++,
      type: "DEFENSIVE_ALLIANCE",
      settlements: [id1, id2],
      startTick: tick,
      duration: 600, // 600 ticks
      title: "Pact of Mutual Brotherhood"
    };
    this.treaties.push(treaty);

    this.emitDiplomacyEvent(s1, s2, "🤝 Alliance Forged!", `${s1.name} and ${s2.name} signed a Grand Defensive Alliance!`);
  }

  signPeace(id1, id2, victorId = null, tick = 0) {
    const rel = this.getRelation(id1, id2);
    if (!rel) return;

    rel.status = DIPLOMATIC_STATUS.PEACE;
    rel.score = 45;
    rel.truceUntilTick = (tick || this.sim.clock.tick) + 300; // 300 ticks truce

    const s1 = this.sim.settlementSystem.settlements.get(id1);
    const s2 = this.sim.settlementSystem.settlements.get(id2);
    if (!s1 || !s2) return;

    // Archive war
    const warIdx = this.activeWars.findIndex(w => 
      (w.attackerId === id1 && w.defenderId === id2) || (w.attackerId === id2 && w.defenderId === id1)
    );

    if (warIdx !== -1) {
      const war = this.activeWars.splice(warIdx, 1)[0];
      war.active = false;
      war.endTick = tick || this.sim.clock.tick;
      war.winnerId = victorId;
      this.warHistory.unshift(war);
      if (this.warHistory.length > 20) this.warHistory.pop();
    }

    // Demobilize warbands
    if (this.sim.warfareSystem) {
      this.sim.warfareSystem.demobilizeSettlement(id1);
      this.sim.warfareSystem.demobilizeSettlement(id2);
    }

    const victorName = victorId ? this.sim.settlementSystem.settlements.get(victorId)?.name : null;
    const details = victorName ? `Victory secured by ${victorName}. A binding peace treaty has been signed.` : "Both realms laid down arms and signed a peace concordat.";
    this.emitDiplomacyEvent(s1, s2, "🕊️ Peace Treaty Signed", details);
  }

  checkWarWeariness(s1, s2, rel, tick) {
    const war = this.activeWars.find(w => 
      (w.attackerId === s1.id && w.defenderId === s2.id) || (w.attackerId === s2.id && w.defenderId === s1.id)
    );
    if (!war) return;

    const warAge = tick - war.startTick;
    // After 250 ticks or high casualties, negotiate peace
    const totalCasualties = (war.casualties[s1.id] || 0) + (war.casualties[s2.id] || 0);

    if (warAge > 350 || totalCasualties >= 4) {
      const s1Losses = war.casualties[s1.id] || 0;
      const s2Losses = war.casualties[s2.id] || 0;
      let victorId = null;
      if (s1Losses < s2Losses) victorId = s1.id;
      else if (s2Losses < s1Losses) victorId = s2.id;
      this.signPeace(s1.id, s2.id, victorId, tick);
    }
  }

  getAllies(settlementId) {
    const allies = [];
    for (const rel of this.relations.values()) {
      if (rel.status === DIPLOMATIC_STATUS.ALLIANCE) {
        if (rel.settlementA === settlementId) allies.push(rel.settlementB);
        else if (rel.settlementB === settlementId) allies.push(rel.settlementA);
      }
    }
    return allies;
  }

  getEnemies(settlementId) {
    const enemies = [];
    for (const rel of this.relations.values()) {
      if (rel.status === DIPLOMATIC_STATUS.WAR) {
        if (rel.settlementA === settlementId) enemies.push(rel.settlementB);
        else if (rel.settlementB === settlementId) enemies.push(rel.settlementA);
      }
    }
    return enemies;
  }

  removeTreatyBetween(id1, id2) {
    this.treaties = this.treaties.filter(t => 
      !(t.settlements.includes(id1) && t.settlements.includes(id2))
    );
  }

  updateTreaties(tick) {
    this.treaties = this.treaties.filter(t => {
      if (t.duration && (tick - t.startTick) >= t.duration) {
        return false;
      }
      return true;
    });
  }

  emitDiplomacyEvent(s1, s2, title, description) {
    if (this.sim && this.sim.eventBus) {
      this.sim.eventBus.emit("DIPLOMATIC_EVENT", {
        title,
        description,
        settlementA: s1.name,
        settlementB: s2.name,
        // Step E: ids let the chronicle attach front-line coords for
        // click-to-jump camera. Additive payload field — no sim-state impact.
        settlementA_id: s1.id,
        settlementB_id: s2.id,
        time: this.simulation?.clock?.tick ?? Date.now()
      });
    }
  }

  // Determinism: diplomacy state drives war declarations and treaty expiry
  // every 40 ticks. It was never persisted, so a resumed world re-initialized
  // relations from scratch (extra RNG draws) and diverged from an
  // uninterrupted run. All values are plain JSON-safe objects/arrays.
  serialize() {
    return {
      relations: Array.from(this.relations.entries()),
      treaties: this.treaties,
      activeWars: this.activeWars,
      warHistory: this.warHistory,
      nextWarId: this.nextWarId,
      nextTreatyId: this.nextTreatyId,
      lastDiplomacyTick: this.lastDiplomacyTick,
      // Grievance ledger (Step D): Map<fromId, Map<targetId, {weight, reason}>>
      grievances: Array.from(this.grievances.entries()).map(
        ([k, m]) => [k, Array.from(m.entries())]
      ),
      // Step H: unresolved scenario feuds must survive save/load or a
      // resumed "warring kingdoms" game would silently lose its pending wars.
      seededFeuds: this.seededFeuds
    };
  }

  deserialize(data) {
    // Relations/wars/treaties are plain JSON-safe records (no classed values),
    // so a direct restore preserves field shapes exactly.
    if (data.relations) this.relations = new Map(data.relations);
    if (Array.isArray(data.treaties)) this.treaties = data.treaties;
    if (Array.isArray(data.activeWars)) this.activeWars = data.activeWars;
    if (Array.isArray(data.warHistory)) this.warHistory = data.warHistory;
    if (Number.isFinite(data.nextWarId)) this.nextWarId = data.nextWarId;
    if (Number.isFinite(data.nextTreatyId)) this.nextTreatyId = data.nextTreatyId;
    if (Number.isFinite(data.lastDiplomacyTick)) this.lastDiplomacyTick = data.lastDiplomacyTick;
    if (Array.isArray(data.grievances)) {
      this.grievances = new Map(data.grievances.map(([k, entries]) => [k, new Map(entries)]));
    }
    if (Array.isArray(data.seededFeuds)) this.seededFeuds = data.seededFeuds;
  }

  static deserialize(data, sim) {
    const sys = new DiplomacySystem(sim);
    sys.deserialize(data);
    return sys;
  }
}
