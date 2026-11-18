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
    this.diplomaticHistory = [];
    this.nextDiplomaticEventId = 1;
    this.MAX_DIPLOMATIC_HISTORY = 80;
    this.nextWarId = 1;
    this.nextTreatyId = 1;
    this.lastDiplomacyTick = 0;
    this.lastGlobalNukeTick = -999;
    // Step D: grievance ledger keyed by relation -> Map(targetId -> {weight, reason}).
    // Neighboring settlements accumulate friction toward their closest rival;
    // weights decay over time (see update()) so tension breathes instead of
    // hard-expiring. Purely deterministic bookkeeping — no RNG.
    this.grievances = new Map();
    // Step H: pre-seeded feuds from starter scenarios ("warring kingdoms").
    // Each entry declares war once both settlements exist at tick >= startTick.
    this.seededFeuds = [];
  }

  recordDiplomaticEvent({
    tick = null,
    type = "diplomacy",
    outcome = "enacted",
    title = "Diplomatic Shift",
    what = "",
    why = "",
    drivers = [],
    actors = [],
    actorNames = [],
    x = null,
    y = null
  }) {
    const t = tick ?? (this.sim?.clock?.tick ?? 0);
    const entry = {
      id: this.nextDiplomaticEventId++,
      tick: t,
      year: Math.floor(t / 100) + 1,
      season: this.sim?.clock?.getSeason?.() || "spring",
      type,
      outcome,
      title,
      what,
      why,
      drivers: Array.isArray(drivers) ? drivers.filter(Boolean).slice(0, 5) : [],
      actors: Array.isArray(actors) ? actors : [],
      actorNames: Array.isArray(actorNames) ? actorNames : [],
      x: Number.isFinite(x) ? x : null,
      y: Number.isFinite(y) ? y : null
    };
    this.diplomaticHistory.unshift(entry);
    if (this.diplomaticHistory.length > this.MAX_DIPLOMATIC_HISTORY) {
      this.diplomaticHistory.pop();
    }
    this.sim?.eventBus?.emit("DIPLOMATIC_LOGGED", entry);
    return entry;
  }

  cleanupSettlement(settlementId, reason = "Collapsed into ruin", attackerSettlementId = null, tickOverride = null) {
    const tick = tickOverride ?? (this.sim?.clock?.tick ?? 0);
    const settlement = this.sim?.settlementSystem?.settlements?.get(settlementId);
    const sName = settlement?.name || `Realm #${settlementId}`;
    const attName = attackerSettlementId
      ? (this.sim?.settlementSystem?.settlements?.get(attackerSettlementId)?.name || `Realm #${attackerSettlementId}`)
      : null;

    // Close any active wars involving the collapsed settlement
    for (let i = this.activeWars.length - 1; i >= 0; i--) {
      const w = this.activeWars[i];
      if (w.attackerId === settlementId || w.defenderId === settlementId) {
        this.activeWars.splice(i, 1);
        w.active = false;
        w.endTick = tick;
        w.winnerId = attackerSettlementId || (w.attackerId === settlementId ? w.defenderId : w.attackerId);
        w.terms = reason;
        this.warHistory.unshift(w);
        if (this.warHistory.length > 20) this.warHistory.pop();
        if (this.sim?.warfareSystem) {
          this.sim.warfareSystem.demobilizeSettlement(w.attackerId);
          this.sim.warfareSystem.demobilizeSettlement(w.defenderId);
        }
      }
    }

    // Purge relations, treaties, and grievances referencing this settlement
    for (const key of Array.from(this.relations.keys())) {
      if (String(key).split(/[_-]/).includes(String(settlementId))) {
        this.relations.delete(key);
      }
    }
    this.treaties = this.treaties.filter(t => !t.settlements.includes(settlementId));
    this.grievances.delete(settlementId);
    for (const m of this.grievances.values()) {
      m.delete(settlementId);
    }

    this.recordDiplomaticEvent({
      tick,
      type: "collapse",
      outcome: "destroyed",
      title: `${sName} Collapsed`,
      what: attName
        ? `${sName} was annihilated and collapsed into permanent ruins after devastation by ${attName}.`
        : `${sName} collapsed completely into ruins.`,
      why: reason,
      drivers: [reason, attName ? `Destroyed by ${attName}` : "Zero survivors / crumbled structures"],
      actors: attackerSettlementId ? [settlementId, attackerSettlementId] : [settlementId],
      actorNames: attName ? [sName, attName] : [sName],
      x: settlement?.center?.x ?? null,
      y: settlement?.center?.y ?? null
    });
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

  canDeclareWar(attackerId, defenderId, tick = null) {
    if (attackerId === defenderId) return false;
    const settlements = this.sim?.settlementSystem?.settlements;
    if (!settlements) return false;
    const sAtt = settlements.get(attackerId);
    const sDef = settlements.get(defenderId);
    if (!sAtt || !sDef || sAtt.ruined || sDef.ruined) return false;
    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    if (sAtt.demilitarizedUntil && sAtt.demilitarizedUntil > now) return false;

    const rel = this.getRelation(attackerId, defenderId);
    if (!rel || rel.status === DIPLOMATIC_STATUS.WAR || rel.truceUntilTick > now) return false;

    const activeSettlements = Array.from(settlements.values()).filter(s => s && !s.ruined);
    const numActive = activeSettlements.length;
    if (numActive <= 3) return true;

    // Preserve runaway guard (tests/warvisible.mjs): when numSettlements > 3, no side
    // may simultaneously fight >= numSettlements - 1 opponents.
    const maxWars = Math.max(1, Math.min(2, numActive - 2));
    let attWars = 0;
    let defWars = 0;
    for (const w of this.activeWars) {
      if (!w.active) continue;
      if (w.attackerId === attackerId || w.defenderId === attackerId) attWars++;
      if (w.attackerId === defenderId || w.defenderId === defenderId) defWars++;
    }
    return attWars < maxWars && defWars < maxWars;
  }

  imposeSanctions(fromId, targetId, reason = "Hostile trade rivalry & border friction", tick = null) {
    const sFrom = this.sim?.settlementSystem?.settlements?.get(fromId);
    const sTarget = this.sim?.settlementSystem?.settlements?.get(targetId);
    if (!sFrom || !sTarget || fromId === targetId || sFrom.ruined || sTarget.ruined) return false;
    const rel = this.getRelation(fromId, targetId);
    if (!rel || rel.status === DIPLOMATIC_STATUS.WAR) return false;

    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    if ((rel.sanctionedUntil || 0) > now) return false;

    rel.sanctionedUntil = now + 220;
    rel.sanctionedBy = fromId;
    rel.score = Math.max(5, Math.round(rel.score - 14));
    if (rel.score < 35 && rel.status === DIPLOMATIC_STATUS.PEACE) {
      rel.status = DIPLOMATIC_STATUS.TENSION;
    }

    this.addGrievance(targetId, fromId, "Punitive Trade Embargo", 12);
    this.addGrievance(fromId, targetId, reason, 8);

    const drivers = [
      reason,
      `Relation Score dropped to ${Math.round(rel.score)}`,
      "Caravans & resource trade suspended for 220 ticks"
    ];

    this.recordDiplomaticEvent({
      tick: now,
      type: "sanction",
      outcome: "enacted",
      title: `Trade Embargo: ${sFrom.name} vs ${sTarget.name}`,
      what: `${sFrom.name} imposed sweeping trade sanctions and froze commerce with ${sTarget.name}.`,
      why: reason,
      drivers,
      actors: [fromId, targetId],
      actorNames: [sFrom.name, sTarget.name],
      x: sTarget.center?.x ?? null,
      y: sTarget.center?.y ?? null
    });

    this.sim?.eventBus?.emit("SANCTIONS_IMPOSED", {
      fromId,
      fromName: sFrom.name,
      targetId,
      targetName: sTarget.name,
      reason,
      tick: now
    });
    this.emitDiplomacyEvent(sFrom, sTarget, "🚫 Trade Embargo Enacted", `${sFrom.name} sanctioned ${sTarget.name} (${reason}).`);
    return true;
  }

  issueUltimatum(fromId, targetId, demand = "tribute", reason = "Geopolitical brinkmanship", tick = null) {
    const sFrom = this.sim?.settlementSystem?.settlements?.get(fromId);
    const sTarget = this.sim?.settlementSystem?.settlements?.get(targetId);
    if (!sFrom || !sTarget || fromId === targetId || sFrom.ruined || sTarget.ruined) return null;
    const rel = this.getRelation(fromId, targetId);
    if (!rel || rel.status === DIPLOMATIC_STATUS.WAR) return null;

    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    if ((rel.ultimatumCooldownUntil || 0) > now) return null;
    rel.ultimatumCooldownUntil = now + 180;

    const popFrom = sFrom.population || sFrom.agentIds?.size || 1;
    const popTarget = sTarget.population || sTarget.agentIds?.size || 1;
    const progFrom = this.sim?.civilizationAgeSystem?.getNuclearProgram?.(fromId);
    const progTarget = this.sim?.civilizationAgeSystem?.getNuclearProgram?.(targetId);
    const nukesFrom = progFrom?.warheads || 0;
    const nukesTarget = progTarget?.warheads || 0;

    const leverageFrom = popFrom + nukesFrom * 14;
    const leverageTarget = popTarget + nukesTarget * 14;
    const targetBell = sTarget.culture?.values?.belligerence ?? 0.4;

    const targetYields = (leverageFrom >= leverageTarget * 1.45 || (nukesFrom > nukesTarget && popFrom >= popTarget)) && targetBell < 0.72;

    if (targetYields) {
      rel.truceUntilTick = now + 120;
      rel.score = Math.max(10, Math.round(rel.score - 8));
      let outcomeSummary = "conceded diplomatic demands";
      if (demand === "nuclear_stand_down" && progTarget) {
        progTarget.progress = 0;
        outcomeSummary = "halted atomic enrichment under coercion";
      } else if (sTarget.stockpile && sFrom.stockpile) {
        const foodTribute = Math.floor((sTarget.stockpile.food || 0) * 0.2);
        const oreTribute = Math.floor((sTarget.stockpile.ore || 0) * 0.2);
        sTarget.stockpile.food = Math.max(0, (sTarget.stockpile.food || 0) - foodTribute);
        sTarget.stockpile.ore = Math.max(0, (sTarget.stockpile.ore || 0) - oreTribute);
        sFrom.stockpile.food = (sFrom.stockpile.food || 0) + foodTribute;
        sFrom.stockpile.ore = (sFrom.stockpile.ore || 0) + oreTribute;
        outcomeSummary = `paid ${foodTribute} food & ${oreTribute} ore tribute`;
      }

      this.addGrievance(targetId, fromId, "Humiliating Ultimatum", 15);
      this.recordDiplomaticEvent({
        tick: now,
        type: "ultimatum",
        outcome: "accepted",
        title: `${sTarget.name} Bowed to Ultimatum`,
        what: `${sTarget.name} ${outcomeSummary} to avoid war with ${sFrom.name}.`,
        why: reason,
        drivers: [
          reason,
          `Power Disparity (${leverageFrom} vs ${leverageTarget})`,
          nukesFrom > nukesTarget ? `Atomic Leverage (${nukesFrom} warheads)` : "Militia Inferiority"
        ],
        actors: [fromId, targetId],
        actorNames: [sFrom.name, sTarget.name],
        x: sTarget.center?.x ?? null,
        y: sTarget.center?.y ?? null
      });
      this.sim?.eventBus?.emit("ULTIMATUM_ISSUED", {
        fromId, fromName: sFrom.name, targetId, targetName: sTarget.name, demand, outcome: "accepted", reason, tick: now
      });
      this.emitDiplomacyEvent(sFrom, sTarget, "📜 Ultimatum Accepted", `${sTarget.name} yielded to ${sFrom.name} and ${outcomeSummary}.`);
      return { outcome: "accepted" };
    }

    // Rejected -> Immediate war!
    this.recordDiplomaticEvent({
      tick: now,
      type: "ultimatum",
      outcome: "rejected",
      title: `${sTarget.name} Defied Ultimatum`,
      what: `${sTarget.name} rejected the ${demand.replace(/_/g, " ")} ultimatum issued by ${sFrom.name}, triggering immediate war.`,
      why: `${reason} — ${sTarget.name} refused submission (Belligerence ${Math.round(targetBell * 100)}%).`,
      drivers: [
        reason,
        `${sTarget.name} refused tribute/concessions`,
        `Strength Balance ${leverageFrom} vs ${leverageTarget}`
      ],
      actors: [fromId, targetId],
      actorNames: [sFrom.name, sTarget.name],
      x: sTarget.center?.x ?? null,
      y: sTarget.center?.y ?? null
    });
    this.sim?.eventBus?.emit("ULTIMATUM_ISSUED", {
      fromId, fromName: sFrom.name, targetId, targetName: sTarget.name, demand, outcome: "rejected", reason, tick: now
    });
    if (this.canDeclareWar(fromId, targetId, now)) {
      this.declareWar(fromId, targetId, "Diplomatic Rift — Rejected Ultimatum", now, {
        why: `${sTarget.name} defied ${sFrom.name}'s ultimatum (${reason})`,
        drivers: [reason, "Ultimatum Rejected", `Power Balance ${leverageFrom} vs ${leverageTarget}`]
      });
    }
    return { outcome: "rejected" };
  }

  evaluateDiplomacy(tick) {
    const settlements = Array.from(this.sim.settlementSystem.settlements.values())
      .filter(s => s && !s.ruined)
      .sort((a, b) => a.id - b.id);
    if (settlements.length < 2) return;

    // Neighboring friction feeds a grievance ledger.
    for (const s of settlements) {
      const pop = s.population || s.agentIds?.size || 0;
      if (pop < 3) continue;
      const rival = this.nearestRival(s);
      if (!rival || rival.ruined) continue;
      const dist = Math.hypot(s.center.x - rival.center.x, s.center.y - rival.center.y);
      if (dist > 85) continue;
      const rivalPop = rival.population || rival.agentIds?.size || 0;
      const scarcity = rivalPop > pop ? 1.5 : 1.1;
      this.addGrievance(s.id, rival.id, "Border Friction", 1.35 * scarcity);
    }

    // Active wars count per settlement (for opportunistic betrayal & multi-front checks)
    const activeWarCount = new Map();
    for (const w of this.activeWars) {
      if (!w.active) continue;
      activeWarCount.set(w.attackerId, (activeWarCount.get(w.attackerId) || 0) + 1);
      activeWarCount.set(w.defenderId, (activeWarCount.get(w.defenderId) || 0) + 1);
    }

    // Modern & Nuclear Era Deterrence & Near-Last-Resort Atomic Escalation
    // Conventional mechanized war (tanks, planes, artillery) & diplomatic ultimatums
    // always unfold first; autonomous nuclear launch happens only as an extreme last resort
    // AND requires functioning nuclear launch infrastructure (plant + silo/factory).
    if (this.sim.civilizationAgeSystem && typeof this.sim.detonateNuclearStrike === "function") {
      for (const s of settlements) {
        const prog = this.sim.civilizationAgeSystem.getNuclearProgram?.(s.id);
        if (!prog || !prog.unlocked || prog.warheads <= 0) continue;
        const infra = this.sim.civilizationAgeSystem.getNuclearInfrastructureStatus?.(s.id);
        if (infra && !infra.canLaunch) continue;
        const myAge = this.sim.civilizationAgeSystem.getSettlementAge?.(s.id)?.ageId || 1;
        const strikeCooldown = myAge >= 7 ? 260 : 320;
        if (tick - (prog.lastStrikeTick ?? -999) < strikeCooldown) continue;
        if (tick - (this.lastGlobalNukeTick ?? -999) < 320) continue;

        const warWithEnemy = this.activeWars.find(w => w.active && (w.attackerId === s.id || w.defenderId === s.id));
        if (!warWithEnemy) continue;

        const enemyId = warWithEnemy.attackerId === s.id ? warWithEnemy.defenderId : warWithEnemy.attackerId;
        const enemy = this.sim.settlementSystem.settlements.get(enemyId);
        if (!enemy || enemy.ruined || !enemy.center) continue;
        const enemyPop = enemy.population || enemy.agentIds?.size || 0;

        const score = this.calculateWarScore(warWithEnemy);
        const myScore = warWithEnemy.attackerId === s.id ? score : -score;
        const myPop = s.population || s.agentIds?.size || 0;
        const myCas = warWithEnemy.casualties?.[s.id] || 0;
        const totalCas = (warWithEnemy.casualties?.[s.id] || 0) + (warWithEnemy.casualties?.[enemyId] || 0);
        const warAge = tick - (warWithEnemy.startTick ?? tick);
        const myWarNukes = warWithEnemy.nukeStrikes?.[s.id] || 0;
        const besieged = Array.from(this.sim.warfareSystem?.warbands?.values() || []).some(
          wb => wb.active && wb.settlementId === enemyId && (wb.state === "sieging" || wb.state === "breaching") && wb.targetSettlementId === s.id
        );

        // Do not waste warheads on tiny remnants or in the opening ~200 ticks of conventional war
        if (enemyPop < 6 || myWarNukes >= 1 || warAge < 180) continue;

        // Step 1: Diplomatic Nuclear Crisis Warning / Ultimatum before launching
        const direCrisis = (besieged && myPop <= 9) || (myScore <= -40 && myCas >= 8) || (prog.doctrine === "first_strike" && totalCas >= 14 && warAge >= 320);
        if (direCrisis && !warWithEnemy.nuclearUltimatumIssued) {
          warWithEnemy.nuclearUltimatumIssued = true;
          warWithEnemy.nuclearUltimatumTick = tick;
          this.issueUltimatum(
            s.id,
            enemyId,
            "nuclear_stand_down",
            `${s.name} warned ${enemy.name} of last-resort atomic retaliation unless hostilities cease`,
            tick
          );
          continue;
        }

        // Step 2: True Near-Last-Resort Atomic Escalation (only after conventional arms & ultimatum fail)
        if (warAge < 260) continue;
        const ultimatumAged = warWithEnemy.nuclearUltimatumIssued && (tick - (warWithEnemy.nuclearUltimatumTick ?? tick)) >= 40;
        const existentialCollapse = besieged && (myPop <= 6 || (myCas >= 10 && myPop <= 9)) && ultimatumAged;
        const catastrophicDefeat = warAge >= 340 && myScore <= -56 && myCas >= 12 && myPop <= 8;
        const extremistLastResort = prog.doctrine === "first_strike" &&
          Boolean(warWithEnemy.totalWar) &&
          warAge >= 420 &&
          totalCas >= 18 &&
          myScore <= -30 &&
          ultimatumAged &&
          (tick - (warWithEnemy.nuclearUltimatumTick ?? tick)) >= 60;

        if (existentialCollapse || catastrophicDefeat || extremistLastResort) {
          const strikeWhy = existentialCollapse
            ? `After its nuclear ultimatum went unheeded under capital siege (${myPop} survivors), ${s.name} fired a last-resort atomic strike.`
            : catastrophicDefeat
              ? `With conventional armies shattered after ${warAge} ticks (War Score ${myScore}, ${myCas} dead), ${s.name} resorted to atomic escalation.`
              : `After ${totalCas} total casualties in a ${warAge}-tick Total War stalemate, ${s.name} broke the nuclear taboo as a final option.`;

          prog.warheads = Math.max(0, prog.warheads - 1);
          prog.totalStrikes = (prog.totalStrikes || 0) + 1;
          prog.lastStrikeTick = tick;
          this.lastGlobalNukeTick = tick;
          warWithEnemy.nukeStrikes = warWithEnemy.nukeStrikes || {};
          warWithEnemy.nukeStrikes[s.id] = myWarNukes + 1;

          this.sim.detonateNuclearStrike({
            x: enemy.center.x,
            y: enemy.center.y,
            attackerSettlementId: s.id,
            targetSettlementId: enemy.id,
            reason: strikeWhy,
            isGodPower: false
          });
          break; // Max 1 autonomous initiator per diplomacy cycle (MAD counter-strike may still respond immediately)
        }
      }
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

        if (cooperation > 0.6) rel.score += 0.25;
        if (belligerence1 > 0.4 || belligerence2 > 0.4) rel.score -= 0.45;
        if ((rel.sanctionedUntil || 0) > tick) rel.score -= 0.35;

        // Proximity friction across regional distances
        const dist = Math.hypot(s1.center.x - s2.center.x, s1.center.y - s2.center.y);
        if (dist < 75 && rel.status !== DIPLOMATIC_STATUS.ALLIANCE) {
          const proximityPressure = Math.max(0.16, (75 - dist) * 0.01);
          rel.score -= proximityPressure;
        }

        // Grievance pressure: accumulated grudges pull the relation score down
        const g12 = this.grievances.get(s1.id)?.get(s2.id)?.weight ?? 0;
        const g21 = this.grievances.get(s2.id)?.get(s1.id)?.weight ?? 0;
        const grudge = Math.max(g12, g21);
        if (grudge > 0) rel.score -= grudge * 0.09;

        rel.score = Math.max(0, Math.min(100, rel.score));

        // State transitions
        if (rel.status === DIPLOMATIC_STATUS.WAR) {
          this.checkWarWeariness(s1, s2, rel, tick);
        } else if (rel.status === DIPLOMATIC_STATUS.ALLIANCE) {
          // Opportunistic alliance betrayal if belligerence is very high and grudges fester
          if (rel.score < 55) {
            rel.status = DIPLOMATIC_STATUS.PEACE;
            this.removeTreatyBetween(s1.id, s2.id);
            this.recordDiplomaticEvent({
              tick,
              type: "alliance",
              outcome: "dissolved",
              title: `Alliance Dissolved: ${s1.name} & ${s2.name}`,
              what: `The defensive pact between ${s1.name} and ${s2.name} dissolved back into uneasy peace.`,
              why: `Diverging ambitions and border friction pulled standing down to ${Math.round(rel.score)}.`,
              drivers: [`Standing fell below 55 (${Math.round(rel.score)})`, `Grievance weight ${Math.round(grudge)}`],
              actors: [s1.id, s2.id],
              actorNames: [s1.name, s2.name]
            });
            this.emitDiplomacyEvent(s1, s2, "Alliance Dissolved", "Friendly ties have cooled back to standard peace.");
          } else if (grudge >= 18 && Math.max(belligerence1, belligerence2) >= 0.78 &&
                     ((s1.id * 31 + s2.id * 17 + Math.floor(tick / 25)) % 6) === 0 &&
                     this.canDeclareWar(belligerence1 >= belligerence2 ? s1.id : s2.id, belligerence1 >= belligerence2 ? s2.id : s1.id, tick)) {
            const betrayer = belligerence1 >= belligerence2 ? s1 : s2;
            const victim = betrayer.id === s1.id ? s2 : s1;
            const bReason = `${betrayer.name} tore up its alliance with ${victim.name} in a sudden backstab over ${Math.round(grudge)} accumulated border grievances.`;
            this.recordDiplomaticEvent({
              tick,
              type: "betrayal",
              outcome: "war",
              title: `Alliance Betrayal: ${betrayer.name} Backstabs ${victim.name}`,
              what: `${betrayer.name} shattered its mutual brotherhood pact and launched a surprise attack on ${victim.name}.`,
              why: bReason,
              drivers: [`Broken Pact of Brotherhood`, `High Belligerence (${Math.round(Math.max(belligerence1, belligerence2) * 100)}%)`, `Festering Grudge (${Math.round(grudge)}/25)`],
              actors: [betrayer.id, victim.id],
              actorNames: [betrayer.name, victim.name],
              x: victim.center?.x ?? null,
              y: victim.center?.y ?? null
            });
            this.declareWar(betrayer.id, victim.id, "Diplomatic Rift — Broken Treaty Betrayal", tick, {
              why: bReason,
              drivers: ["Alliance Betrayal", `Grievance ${Math.round(grudge)}/25`]
            });
          }
        } else if (rel.status === DIPLOMATIC_STATUS.PEACE) {
          // Proliferation Diplomacy: rivals constructing atomic reactors or missile silos draw scrutiny
          this.evaluateProliferationConcern(s1, s2, rel, tick);

          if (rel.score >= 82) {
            this.formAlliance(s1.id, s2.id, tick);
          } else if (rel.score < 38) {
            rel.status = DIPLOMATIC_STATUS.TENSION;
            this.recordDiplomaticEvent({
              tick,
              type: "tension",
              outcome: "escalated",
              title: `Border Tensions: ${s1.name} & ${s2.name}`,
              what: `Relations between ${s1.name} and ${s2.name} deteriorated into open geopolitical hostility.`,
              why: `Proximity friction (dist ${Math.round(dist)}) and grievances (${Math.round(grudge)}) drove score down to ${Math.round(rel.score)}.`,
              drivers: [`Relation Score ${Math.round(rel.score)}`, `Distance ${Math.round(dist)} tiles`, `Grudge ${Math.round(grudge)}/25`],
              actors: [s1.id, s2.id],
              actorNames: [s1.name, s2.name]
            });
            this.emitDiplomacyEvent(s1, s2, "Border Tensions", "Rivalry and border disputes spark rising friction.");
          } else {
            // Resource scarcity trade & non-aggression pacts between cooperative or complementary neighbors
            this.evaluateResourcePact(s1, s2, rel, tick);

            // Opportunistic backstab during peace if neighbor is fighting elsewhere
            const s1Distracted = (activeWarCount.get(s1.id) || 0) > 0;
            const s2Distracted = (activeWarCount.get(s2.id) || 0) > 0;
            const opAtt = (belligerence1 >= 0.72 && s2Distracted) ? s1 : ((belligerence2 >= 0.72 && s1Distracted) ? s2 : null);
            const opDef = opAtt ? (opAtt.id === s1.id ? s2 : s1) : null;
            if (opAtt && opDef && grudge >= 14 &&
                ((s1.id * 29 + s2.id * 19 + Math.floor(tick / 25)) % 4) === 0 &&
                this.canDeclareWar(opAtt.id, opDef.id, tick)) {
              const whyText = `${opAtt.name} exploited ${opDef.name}'s distraction on another front to break the peace.`;
              this.recordDiplomaticEvent({
                tick,
                type: "betrayal",
                outcome: "war",
                title: `Opportunistic Strike: ${opAtt.name} vs ${opDef.name}`,
                what: `${opAtt.name} broke peace and struck ${opDef.name} while its armies were committed elsewhere.`,
                why: whyText,
                drivers: [`${opDef.name} distracted on another front`, `Belligerence ${Math.round((opAtt.culture?.values?.belligerence ?? 0.5) * 100)}%`, `Grievance ${Math.round(grudge)}/25`],
                actors: [opAtt.id, opDef.id],
                actorNames: [opAtt.name, opDef.name],
                x: opDef.center?.x ?? null,
                y: opDef.center?.y ?? null
              });
              this.declareWar(opAtt.id, opDef.id, "Diplomatic Rift — Opportunistic Backstab", tick, {
                why: whyText,
                drivers: [`Two-front opportunism`, `Grievance ${Math.round(grudge)}/25`]
              });
            }
          }
        } else if (rel.status === DIPLOMATIC_STATUS.TENSION) {
          this.evaluateProliferationConcern(s1, s2, rel, tick);
          if (rel.score >= 48) {
            rel.status = DIPLOMATIC_STATUS.PEACE;
          } else if (rel.score > 22 && rel.score <= 34 && !(rel.sanctionedUntil > tick) &&
                     ((s1.id * 13 + s2.id * 23 + Math.floor(tick / 25)) % 3) === 0) {
            // Sanctions before outright war when tension simmers
            const sanctioner = belligerence1 >= belligerence2 ? s1 : s2;
            const target = sanctioner.id === s1.id ? s2 : s1;
            this.imposeSanctions(sanctioner.id, target.id, `Border hostility & accumulated grievance (${Math.round(grudge)})`, tick);
          } else if (rel.score <= 28 && (rel.ultimatumCooldownUntil || 0) <= tick &&
                     ((s1.id * 11 + s2.id * 7 + Math.floor(tick / 25)) % 3) === 0) {
            // Escalate via Ultimatum (nuclear coercion if Era 6 vs non-nuclear, else tribute extortion)
            const attFirst = belligerence1 >= belligerence2;
            const sender = attFirst ? s1 : s2;
            const receiver = attFirst ? s2 : s1;
            const sNukes = this.sim?.civilizationAgeSystem?.getNuclearProgram?.(sender.id)?.warheads || 0;
            const demand = sNukes > 0 ? "nuclear_stand_down" : "tribute";
            const ultReason = sNukes > 0
              ? `${sender.name} threatened atomic force over border disputes`
              : `${sender.name} demanded tribute under threat of invasion`;
            this.issueUltimatum(sender.id, receiver.id, demand, ultReason, tick);
          } else if (rel.score <= 22 && rel.truceUntilTick <= tick) {
            let grievance = this.evaluateCasusBelli(s1, s2);
            if (!grievance) {
              const attFirst = belligerence1 >= belligerence2;
              grievance = {
                attackerId: attFirst ? s1.id : s2.id,
                defenderId: attFirst ? s2.id : s1.id,
                reason: "Diplomatic Rift — Border Escalation",
                score: 25,
                drivers: [`Relation score collapsed (${Math.round(rel.score)})`, `Border friction (${Math.round(grudge)}/25)`]
              };
            }
            if (this.canDeclareWar(grievance.attackerId, grievance.defenderId, tick)) {
              this.declareWar(grievance.attackerId, grievance.defenderId, grievance.reason, tick, {
                drivers: grievance.drivers
              });
            }
          }
        }
      }
    }

    // Third-party peace mediation for grueling stalled wars
    this.evaluatePeaceMediation(settlements, activeWarCount, tick);
  }

  evaluateProliferationConcern(s1, s2, rel, tick) {
    if (!this.sim?.civilizationAgeSystem?.getNuclearInfrastructureStatus) return false;
    if ((rel.prolifAlertCooldownUntil || 0) > tick) return false;
    if (rel.status === DIPLOMATIC_STATUS.WAR || rel.status === DIPLOMATIC_STATUS.ALLIANCE) return false;

    const infra1 = this.sim.civilizationAgeSystem.getNuclearInfrastructureStatus(s1.id);
    const infra2 = this.sim.civilizationAgeSystem.getNuclearInfrastructureStatus(s2.id);
    const atomic1 = Boolean(infra1?.hasNuclearPlant || infra1?.hasMissileSilo);
    const atomic2 = Boolean(infra2?.hasNuclearPlant || infra2?.hasMissileSilo);
    if (atomic1 === atomic2) return false; // Either neither has nuclear infra, or both already reached parity

    const builder = atomic1 ? s1 : s2;
    const observer = atomic1 ? s2 : s1;
    if (rel.score >= 58) return false;

    rel.prolifAlertCooldownUntil = tick + 220;
    this.addGrievance(observer.id, builder.id, "Nuclear Proliferation & Silo Buildup", 8);
    rel.score = Math.max(10, Math.round(rel.score - 4));

    if (rel.score < 46 && !((rel.sanctionedUntil || 0) > tick) &&
        ((builder.id + observer.id + Math.floor(tick / 25)) % 2) === 0) {
      return this.imposeSanctions(
        observer.id,
        builder.id,
        `Non-proliferation sanctions over ${builder.name}'s nuclear reactor & missile facilities`,
        tick
      );
    }

    if (rel.score < 32 && (rel.ultimatumCooldownUntil || 0) <= tick &&
        (observer.population || 0) >= (builder.population || 0)) {
      this.issueUltimatum(
        observer.id,
        builder.id,
        "nuclear_stand_down",
        `${observer.name} demanded atomic inspections & enrichment suspension at ${builder.name}`,
        tick
      );
      return true;
    }

    this.recordDiplomaticEvent({
      tick,
      type: "proliferation",
      outcome: "protest",
      title: `Atomic Proliferation Alarm: ${builder.name}`,
      what: `${observer.name} issued a formal diplomatic protest over ${builder.name}'s nuclear infrastructure buildup.`,
      why: `Active reactor/silo construction shifted the regional balance of power (Standing ${Math.round(rel.score)}/100).`,
      drivers: [
        infra1?.hasMissileSilo || infra2?.hasMissileSilo ? "Missile Silo Deployed" : "Nuclear Reactor Operational",
        `Relation Score ${Math.round(rel.score)}/100`
      ],
      actors: [observer.id, builder.id],
      actorNames: [observer.name, builder.name],
      x: builder.center?.x ?? null,
      y: builder.center?.y ?? null
    });
    return true;
  }

  evaluateResourcePact(s1, s2, rel, tick) {
    if (!rel || rel.status !== DIPLOMATIC_STATUS.PEACE) return false;
    if (rel.score < 48 || rel.score >= 82) return false;
    if ((rel.sanctionedUntil || 0) > tick) return false;
    if ((rel.pactCooldownUntil || 0) > tick) return false;

    const alreadyPact = this.treaties.some(
      t => t.type === "RESOURCE_PACT" && t.settlements.includes(s1.id) && t.settlements.includes(s2.id)
    );
    if (alreadyPact) return false;

    const pairs = [[s1, s2], [s2, s1]];
    for (const [supplier, recipient] of pairs) {
      if (!supplier.stockpile || !recipient.stockpile) continue;
      for (const resKey of ["ore", "food", "wood"]) {
        const supAmt = supplier.stockpile[resKey] || 0;
        const recAmt = recipient.stockpile[resKey] || 0;
        const lowThresh = resKey === "ore" ? 10 : resKey === "food" ? 16 : 14;
        const highThresh = resKey === "ore" ? 26 : resKey === "food" ? 36 : 32;
        if (recAmt < lowThresh && supAmt >= highThresh) {
          return this.forgeResourcePact(s1.id, s2.id, supplier, recipient, resKey, tick);
        }
      }
    }
    return false;
  }

  forgeResourcePact(id1, id2, supplier, recipient, resourceKey, tick) {
    const rel = this.getRelation(id1, id2);
    if (!rel) return null;
    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    const labelMap = { ore: "Ore", food: "Grain", wood: "Timber" };
    const resLabel = labelMap[resourceKey] || "Resource";

    const shipment = Math.min(12, Math.max(4, Math.floor((supplier.stockpile[resourceKey] || 0) * 0.18)));
    supplier.stockpile[resourceKey] = Math.max(0, (supplier.stockpile[resourceKey] || 0) - shipment);
    recipient.stockpile[resourceKey] = (recipient.stockpile[resourceKey] || 0) + shipment;

    rel.score = Math.min(90, Math.round(rel.score + 7));
    rel.truceUntilTick = Math.max(rel.truceUntilTick || 0, now + 120);
    rel.pactCooldownUntil = now + 260;

    const treaty = {
      id: this.nextTreatyId++,
      type: "RESOURCE_PACT",
      settlements: [id1, id2],
      startTick: now,
      duration: 360,
      title: `${resLabel} Trade & Non-Aggression Pact (${supplier.name} → ${recipient.name})`
    };
    this.treaties.push(treaty);

    this.recordDiplomaticEvent({
      tick: now,
      type: "treaty",
      outcome: "signed",
      title: `${resLabel} Trade Pact: ${supplier.name} ↔ ${recipient.name}`,
      what: `${supplier.name} dispatched ${shipment} ${resLabel.toLowerCase()} under a 360-tick Non-Aggression & Trade Pact with ${recipient.name}.`,
      why: `Complementary scarcity forged mutual stability instead of resource conflict.`,
      drivers: [`${shipment} ${resLabel} delivered`, `120-tick Non-Aggression guarantee`, `Affinity ${Math.round(rel.score)}/100`],
      actors: [supplier.id, recipient.id],
      actorNames: [supplier.name, recipient.name],
      x: recipient.center?.x ?? null,
      y: recipient.center?.y ?? null
    });
    this.emitDiplomacyEvent(supplier, recipient, `⚖️ ${resLabel} Pact Signed`, `${supplier.name} & ${recipient.name} sealed a Trade & Non-Aggression Pact!`);
    return treaty;
  }

  evaluatePeaceMediation(settlements, activeWarCount, tick) {
    if (!settlements || settlements.length < 3 || this.activeWars.length === 0) return;
    for (let i = 0; i < this.activeWars.length; i++) {
      const war = this.activeWars[i];
      if (!war || !war.active || war.mediatedAttempted) continue;
      const warAge = tick - (war.startTick ?? tick);
      const totalCas = (war.casualties?.[war.attackerId] || 0) + (war.casualties?.[war.defenderId] || 0);
      if (warAge < 260 || totalCas < 10) continue;

      const mediator = settlements.find(m => {
        if (m.id === war.attackerId || m.id === war.defenderId || m.ruined) return false;
        if ((activeWarCount.get(m.id) || 0) > 0) return false;
        if ((m.culture?.values?.cooperation ?? 0.5) < 0.62) return false;
        const rA = this.getRelation(m.id, war.attackerId);
        const rD = this.getRelation(m.id, war.defenderId);
        return Boolean(rA && rD && rA.score >= 52 && rD.score >= 52);
      });

      if (!mediator) continue;
      war.mediatedAttempted = true;
      this.recordDiplomaticEvent({
        tick,
        type: "mediation",
        outcome: "brokered",
        title: `Peace Mediation by ${mediator.name}`,
        what: `${mediator.name} intervened diplomatically to broker a ceasefire between ${war.attackerName} and ${war.defenderName}.`,
        why: `After ${warAge} ticks and ${totalCas} casualties, neutral mediator ${mediator.name} convened peace talks.`,
        drivers: [`Mediator: ${mediator.name}`, `War Duration: ${warAge} ticks`, `Toll: ${totalCas} fallen`],
        actors: [mediator.id, war.attackerId, war.defenderId],
        actorNames: [mediator.name, war.attackerName, war.defenderName],
        x: mediator.center?.x ?? null,
        y: mediator.center?.y ?? null
      });
      this.convenePeaceConference(war.attackerId, war.defenderId, null, `Brokered by ${mediator.name} Mediation`);
      break;
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
          drivers: [`${att.name} food low (${Math.round(attFood)}) vs ${def.name} (${Math.round(defFood)})`],
          score: 30 + Math.min(40, foodGap * 2) });
      }
      const oreGap = defOre - attOre;
      if (attOre < 6 && defOre > 12) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Resource Wars — Ore Greed",
          drivers: [`${att.name} ore deficit (${Math.round(attOre)} vs ${Math.round(defOre)})`],
          score: 25 + Math.min(30, oreGap * 1.5) });
      }
      const woodGap = defWood - attWood;
      if (attWood < 6 && defWood > 15) {
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: "Resource Wars — Timber Raids",
          drivers: [`Timber scarcity (${Math.round(attWood)} vs ${Math.round(defWood)})`],
          score: 22 + Math.min(25, woodGap) });
      }

      // 2) Diplomatic rift — deep mutual distrust / sanctions / proximity friction
      const rel = this.getRelation(s1.id, s2.id);
      if (rel && rel.score <= 25) {
        const grudgeEntry = this.grievances.get(att.id)?.get(def.id);
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: (rel.sanctionedUntil || 0) > (this.sim?.clock?.tick ?? 0)
            ? "Diplomatic Rift — Sanctions & Border Skirmish"
            : "Diplomatic Rift — Border Skirmish",
          drivers: [
            `Diplomatic standing collapsed (${Math.round(rel.score)}/100)`,
            grudgeEntry ? `${grudgeEntry.reason} (${Math.round(grudgeEntry.weight)}/25)` : "Cumulative border friction"
          ],
          score: 20 + (25 - rel.score) * 1.5 });
      }

      // 3) Religious difference — zealous attacker vs heretic neighbor of a different faith
      const attFaith = att.id === s1.id ? faith1 : faith2;
      const defFaith = att.id === s1.id ? faith2 : faith1;
      if (attFaith && defFaith && attFaith !== defFaith) {
        let zealSum = 0, zealN = 0;
        for (const agent of this.sim.agents.values()) {
          if (!agent.alive || agent.settlementId !== att.id) continue;
          if (agent.religion?.beliefId === attFaith) {
            zealSum += agent.religion.faith ?? 50;
            zealN++;
          }
        }
        const zeal = zealN > 0 ? zealSum / zealN : 0;
        if (zeal >= 55) {
          candidates.push({ attackerId: att.id, defenderId: def.id,
            reason: "Holy War — Crusade Against Heretics",
            drivers: [`Competing creeds (${attFaith} vs ${defFaith})`, `Zeal ${Math.round(zeal)}%`],
            score: 28 + (zeal - 55) * 1.2 });
        }
      }

      // 4) Cultural militarism drift — belligerent society picking fights
      if (belligerence > 0.40) {
        const attNukes = this.sim?.civilizationAgeSystem?.getNuclearProgram?.(att.id)?.warheads || 0;
        candidates.push({ attackerId: att.id, defenderId: def.id,
          reason: attNukes > 0
            ? "Militarist Aggression — Nuclear Brinkmanship"
            : "Militarist Aggression — Conquest",
          drivers: [
            `Warlike culture (${Math.round(belligerence * 100)}% belligerence)`,
            attNukes > 0 ? `Atomic arsenal (${attNukes} warheads)` : "Expansionist ambition"
          ],
          score: 18 + belligerence * 35 });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.score - a.score) || (a.attackerId - b.attackerId) || (a.defenderId - b.defenderId));
    return candidates[0];
  }

  declareWar(attackerId, defenderId, casusBelli = "Militarist Aggression — Territorial Conquest", tick = 0, meta = {}) {
    const rel = this.getRelation(attackerId, defenderId);
    if (!rel || rel.status === DIPLOMATIC_STATUS.WAR) return;

    const sA = this.sim.settlementSystem.settlements.get(attackerId);
    const sD = this.sim.settlementSystem.settlements.get(defenderId);
    if (!sA || !sD || sA.ruined || sD.ruined) return;

    const now = tick || this.sim.clock.tick;
    const grievanceInfo = this.grievances.get(attackerId)?.get(defenderId);
    const drivers = Array.isArray(meta.drivers) && meta.drivers.length > 0
      ? meta.drivers.slice(0, 4)
      : [
          `Casus Belli: ${casusBelli}`,
          grievanceInfo ? `${grievanceInfo.reason} (${Math.round(grievanceInfo.weight)}/25)` : `Standing fell to ${Math.round(rel.score)}`,
          `Belligerence ${Math.round((sA.culture?.values?.belligerence ?? 0.4) * 100)}%`
        ];
    const whySummary = meta.why || drivers.join(" · ");

    rel.status = DIPLOMATIC_STATUS.WAR;
    rel.score = Math.min(rel.score, 5);
    if (this.grievances.has(attackerId)) this.grievances.get(attackerId).delete(defenderId);

    const isHolyWar = casusBelli.includes("Holy War");
    const eraA = this.sim.civilizationAgeSystem?.getSettlementAge?.(attackerId)?.ageId || 1;
    const eraD = this.sim.civilizationAgeSystem?.getSettlementAge?.(defenderId)?.ageId || 1;
    const maxEra = Math.max(eraA, eraD);
    const maxBell = Math.max(sA.culture?.values?.belligerence ?? 0.3, sD.culture?.values?.belligerence ?? 0.3);
    const warId = this.nextWarId++;
    const isTotalWar = Boolean(
      meta.totalWar ||
      (maxEra >= 6 && (
        maxEra >= 7 ||
        maxBell >= 0.55 ||
        casusBelli.includes("Conquest") ||
        casusBelli.includes("Nuclear") ||
        casusBelli.includes("Betrayal") ||
        casusBelli.includes("Total War") ||
        casusBelli.includes("Resource") ||
        (warId % 2 === 1)
      ))
    );

    const war = {
      id: warId,
      attackerId,
      defenderId,
      attackerName: sA.name,
      defenderName: sD.name,
      startTick: now,
      casusBelli: isTotalWar && !casusBelli.includes("Total War") ? `${casusBelli} (Total War)` : casusBelli,
      whySummary: isTotalWar ? `${whySummary} · Escalated into devastating Total War` : whySummary,
      drivers: isTotalWar && !drivers.includes("Total War Doctrine") ? [...drivers.slice(0, 3), "Total War Doctrine"] : drivers,
      isHolyWar,
      totalWar: isTotalWar,
      weariness: { [attackerId]: 0, [defenderId]: 0 },
      battles: [],
      casualties: { [attackerId]: 0, [defenderId]: 0 },
      plundered: { food: 0, wood: 0, ore: 0 },
      active: true
    };

    this.activeWars.push(war);

    this.removeTreatyBetween(attackerId, defenderId);
    if (!meta.skipAllyCall) {
      this.callAlliesToWar(war);
    }

    if (this.sim.warfareSystem) {
      this.sim.warfareSystem.onWarDeclared(war);
    }

    if (isHolyWar && this.sim.chronicleSystem?.addEntry) {
      this.sim.chronicleSystem.addEntry(
        "HOLY_WAR",
        `⚔️🔥 HOLY CRUSADE: ${sA.name} launched a sacred crusade against ${sD.name} (${casusBelli})!`
      );
    }

    this.recordDiplomaticEvent({
      tick: now,
      type: "war",
      outcome: "war_declared",
      title: `War Declared: ${sA.name} vs ${sD.name}`,
      what: `${sA.name} declared war on ${sD.name} (${casusBelli}).`,
      why: whySummary,
      drivers,
      actors: [attackerId, defenderId],
      actorNames: [sA.name, sD.name],
      x: sD.center?.x ?? null,
      y: sD.center?.y ?? null
    });

    this.emitDiplomacyEvent(sA, sD, `⚔️ War Declared!`, `${sA.name} has declared war on ${sD.name} (${casusBelli}) — ${whySummary}`);
    return war;
  }

  callAlliesToWar(war) {
    // Check defender allies and bring them into an official tracked war against the aggressor
    const defenderAllies = this.getAllies(war.defenderId);
    for (const allyId of defenderAllies) {
      if (allyId === war.attackerId) continue;
      if (!this.canDeclareWar(allyId, war.attackerId, war.startTick)) continue;
      const a = this.sim.settlementSystem.settlements.get(allyId);
      const att = this.sim.settlementSystem.settlements.get(war.attackerId);
      if (a && att && !a.ruined && !att.ruined) {
        this.declareWar(
          allyId,
          war.attackerId,
          `Defensive Pact — Defending ${war.defenderName}`,
          war.startTick,
          {
            why: `${a.name} honored its defensive alliance with ${war.defenderName} against ${att.name}.`,
            drivers: [`Mutual Defense Pact with ${war.defenderName}`, `Allied Intervention`],
            totalWar: Boolean(war.totalWar),
            skipAllyCall: true
          }
        );
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

    this.recordDiplomaticEvent({
      tick: tick ?? (this.sim?.clock?.tick ?? 0),
      type: "alliance",
      outcome: "signed",
      title: `Alliance Forged: ${s1.name} & ${s2.name}`,
      what: `${s1.name} and ${s2.name} signed a Pact of Mutual Brotherhood.`,
      why: `High diplomatic trust (${Math.round(rel.score)}/100) and shared cooperation brought both realms together.`,
      drivers: [`Trust Score ${Math.round(rel.score)}/100`, `600-tick mutual defense commitment`],
      actors: [id1, id2],
      actorNames: [s1.name, s2.name]
    });

    this.emitDiplomacyEvent(s1, s2, "🤝 Alliance Forged!", `${s1.name} and ${s2.name} signed a Grand Defensive Alliance!`);
  }

  /**
   * Calculates dynamic War Score (-100 to +100).
   * Positive favors attacker, negative favors defender.
   */
  calculateWarScore(war) {
    if (!war) return 0;
    let score = 0;
    const attCas = war.casualties?.[war.attackerId] || 0;
    const defCas = war.casualties?.[war.defenderId] || 0;
    score += (defCas - attCas) * 8; // casualties inflicted advantage

    // Plunder impact
    if (war.plundered) {
      const attPlunder = war.plundered[war.attackerId] || 0;
      const defPlunder = war.plundered[war.defenderId] || 0;
      score += Math.min(30, (attPlunder - defPlunder) * 2);
    }

    // Weariness impact
    const attWear = war.weariness?.[war.attackerId] || 0;
    const defWear = war.weariness?.[war.defenderId] || 0;
    score += Math.min(30, (defWear - attWear) * 0.5);

    return Math.max(-100, Math.min(100, Math.round(score)));
  }

  /**
   * Convenes a formal Peace Conference to negotiate terms.
   */
  convenePeaceConference(id1, id2, victorId = null, reason = "War Weariness") {
    const war = this.activeWars.find(w => 
      (w.attackerId === id1 && w.defenderId === id2) || (w.attackerId === id2 && w.defenderId === id1)
    );
    const score = war ? this.calculateWarScore(war) : 0;

    let determinedVictorId = victorId;
    if (!determinedVictorId && war) {
      if (score >= 15) determinedVictorId = war.attackerId;
      else if (score <= -15) determinedVictorId = war.defenderId;
    }

    let terms = null;

    // Check if a Royal Marriage peace treaty can be arranged between ruling dynasties
    const dynA = this.sim.dynastySystem?.settlementDynastyMap?.get(id1);
    const dynB = this.sim.dynastySystem?.settlementDynastyMap?.get(id2);
    if (dynA && dynB && Math.abs(score) < 35 && (!war?.casusBelli || !war.casusBelli.includes("Conquest"))) {
      const marriage = this.sim.dynastySystem.arrangeRoyalMarriage(dynA, dynB);
      if (marriage) {
        terms = "Dynastic Royal Marriage Concordat";
      }
    }

    if (!terms) {
      if (war?.isHolyWar && determinedVictorId) {
        terms = "Religious Conversion Concordat";
      } else if (determinedVictorId && (Math.abs(score) >= 60 || war?.casusBelli?.includes("Conquest"))) {
        terms = "Conquest & Annexation";
      } else if (determinedVictorId && (Math.abs(score) >= 30 || war?.casusBelli?.includes("Resource"))) {
        terms = "Tributary Vassalage";
      } else if (determinedVictorId) {
        terms = "Forced Demilitarization";
      } else {
        terms = "White Peace Concordat";
      }
    }

    const conferenceReport = {
      settlement1Id: id1,
      settlement2Id: id2,
      victorId: determinedVictorId,
      warScore: score,
      reason,
      terms,
      tick: this.sim.clock.tick
    };

    if (this.sim.eventBus) {
      this.sim.eventBus.emit("PEACE_CONFERENCE_CONCLUDED", conferenceReport);
    }

    this.signPeace(id1, id2, determinedVictorId, this.sim.clock.tick, terms);
    return conferenceReport;
  }

  signPeace(id1, id2, victorId = null, tick = 0, terms = null, reasonOverride = null) {
    const rel = this.getRelation(id1, id2);
    if (!rel) return;

    const now = tick || this.sim.clock.tick;
    rel.status = DIPLOMATIC_STATUS.PEACE;
    rel.score = 42;
    rel.truceUntilTick = now + 140; // Shorter truce keeps geopolitical map dynamic

    const s1 = this.sim.settlementSystem.settlements.get(id1);
    const s2 = this.sim.settlementSystem.settlements.get(id2);
    if (!s1 || !s2) return;

    // Archive war
    const warIdx = this.activeWars.findIndex(w => 
      (w.attackerId === id1 && w.defenderId === id2) || (w.attackerId === id2 && w.defenderId === id1)
    );

    let war = null;
    if (warIdx !== -1) {
      war = this.activeWars.splice(warIdx, 1)[0];
      war.active = false;
      war.endTick = tick || this.sim.clock.tick;
      war.winnerId = victorId;

      // Determine treaty terms dynamically if not specified
      if (!terms) {
        if (war.isHolyWar && victorId) {
          terms = "Religious Conversion Concordat";
        } else if (war.casusBelli.includes("Conquest") && victorId) {
          terms = "Conquest & Annexation";
        } else if (war.casusBelli.includes("Resource") && victorId) {
          terms = "Tributary Vassalage";
        } else if (victorId) {
          terms = "Forced Demilitarization";
        } else {
          terms = "White Peace Concordat";
        }
      }

      war.terms = terms;
      this.warHistory.unshift(war);
      if (this.warHistory.length > 20) this.warHistory.pop();
    } else if (!terms) {
      terms = "White Peace Concordat";
    }

    // Execute concrete treaty terms
    const victor = victorId ? this.sim.settlementSystem.settlements.get(victorId) : null;
    const defeatedId = victorId ? (victorId === id1 ? id2 : id1) : null;
    const defeated = defeatedId ? this.sim.settlementSystem.settlements.get(defeatedId) : null;

    if (terms === "Religious Conversion Concordat" && victor && defeated) {
      const victorFaith = this.dominantFaith(victor);
      if (victorFaith) {
        defeated.culture.beliefId = victorFaith;
        if (defeated.agentIds) {
          for (const aid of defeated.agentIds) {
            const a = this.sim._agentById(aid);
            if (a && a.alive) {
              if (!a.religion) this.sim.religionSystem?.initReligionEntity(a);
              if (a.religion) {
                a.religion.beliefId = victorFaith;
                a.religion.faith = 55;
              }
            }
          }
        }
        if (this.sim.chronicleSystem?.addEntry) {
          this.sim.chronicleSystem.addEntry(
            "FAITH_CONCORDAT",
            `📜 Peace of Faith: ${defeated.name} renounced their creed and converted to ${victorFaith}.`
          );
        }
      }
    } else if (terms === "Tributary Vassalage" && victor && defeated) {
      if (victor.tributeTo === defeated.id) {
        victor.tributeTo = null;
        victor.overlordId = null;
        victor.tributeUntil = 0;
      }
      defeated.tributeTo = victor.id;
      defeated.overlordId = victor.id;
      defeated.tributeRate = 0.15;
      defeated.tributeUntil = now + 500;
      if (this.sim.chronicleSystem?.addEntry) {
        this.sim.chronicleSystem.addEntry(
          "TRIBUTARY_VASSALAGE",
          `👑 Tributary Pact: ${defeated.name} swore vassalage to ${victor.name} with 15% seasonal tribute.`
        );
      }
    } else if (terms === "Forced Demilitarization" && defeated) {
      defeated.demilitarizedUntil = (tick || this.sim.clock.tick) + 400;
      if (this.sim.chronicleSystem?.addEntry) {
        this.sim.chronicleSystem.addEntry(
          "DEMILITARIZATION",
          `🛡️ Disarmament Pact: ${defeated.name} was disarmed and forbidden from raising warbands for 400 days.`
        );
      }
    }

    // Process Prisoners of War (POWs)
    const captorId = victorId || id1;
    const captiveVictimId = victorId ? (victorId === id1 ? id2 : id1) : id2;
    const sCaptor = this.sim.settlementSystem.settlements.get(captorId);
    const sVictim = this.sim.settlementSystem.settlements.get(captiveVictimId);
    const belligerence = sCaptor?.culture?.values?.belligerence ?? 0.3;

    if (this.sim.agents) {
      for (const a of this.sim.agents) {
        if (!a.alive || !a.captive) continue;
        if (a.prisonerOf === id1 || a.prisonerOf === id2) {
          if (belligerence >= 0.85) {
            a.alive = false;
            this.sim.deathsThisSession++;
            this.addGrievance(a.settlementId, a.prisonerOf, "Execution of War Prisoners", 25);
            if (this.sim.eventBus) {
              this.sim.eventBus.emit("PRISONER_EXECUTED", { agentId: a.id, executorId: a.prisonerOf });
            }
            if (this.sim.chronicleSystem?.addEntry) {
              this.sim.chronicleSystem.addEntry("PRISONER_EXECUTED", `☠️ Prisoners of war were executed in ${sCaptor?.name}, deepening border feuds!`);
            }
          } else {
            a.captive = false;
            a.prisonerOf = null;
            a.health = 70;
            if (sVictim?.stockpile && sCaptor?.stockpile) {
              sVictim.stockpile.food = Math.max(0, (sVictim.stockpile.food || 0) - 10);
              sCaptor.stockpile.food = (sCaptor.stockpile.food || 0) + 10;
            }
            if (this.sim.eventBus) {
              this.sim.eventBus.emit("PRISONERS_RANSOMED", { agentId: a.id, captorId: captorId, homeId: a.settlementId });
            }
          }
        }
      }
    }

    // Demobilize warbands assigned to this concluded front (keeps other active fronts mobilized)
    if (this.sim.warfareSystem) {
      this.sim.warfareSystem.demobilizeSettlement(id1, id2);
      this.sim.warfareSystem.demobilizeSettlement(id2, id1);
    }

    const victorName = victor ? victor.name : null;
    const details = victorName ? `Victory secured by ${victorName} (${terms}). A binding treaty has been concluded.` : "Both realms laid down arms and signed a peace concordat.";
    const cas1 = war?.casualties?.[id1] || 0;
    const cas2 = war?.casualties?.[id2] || 0;
    const peaceWhy = reasonOverride || (victorName
      ? `${victorName} prevailed after inflicting heavy battlefield losses (${cas1 + cas2} total dead).`
      : `Mutual exhaustion ended fighting after ${war ? (now - (war.startTick || now)) : 0} ticks.`);

    this.recordDiplomaticEvent({
      tick: now,
      type: "peace",
      outcome: "signed",
      title: `Peace Signed: ${s1.name} & ${s2.name}`,
      what: victorName
        ? `${s1.name} and ${s2.name} signed ${terms} with ${victorName} victorious.`
        : `${s1.name} and ${s2.name} agreed to a ${terms}.`,
      why: peaceWhy,
      drivers: [
        `Terms: ${terms}`,
        `Casualties: ${s1.name} ${cas1} · ${s2.name} ${cas2}`,
        `140-tick truce active`
      ],
      actors: [id1, id2],
      actorNames: [s1.name, s2.name]
    });

    this.emitDiplomacyEvent(s1, s2, "🕊️ Peace Treaty Signed", details);
  }

  checkWarWeariness(s1, s2, rel, tick) {
    const war = this.activeWars.find(w =>
      (w.attackerId === s1.id && w.defenderId === s2.id) || (w.attackerId === s2.id && w.defenderId === s1.id)
    );
    if (!war) return;

    const warAge = tick - war.startTick;
    const s1Weariness = war.weariness?.[s1.id] || 0;
    const s2Weariness = war.weariness?.[s2.id] || 0;
    const totalCasualties = (war.casualties[s1.id] || 0) + (war.casualties[s2.id] || 0);
    const pop1 = s1.population || s1.agentIds?.size || 4;
    const pop2 = s2.population || s2.agentIds?.size || 4;
    const era1 = this.sim.civilizationAgeSystem?.getSettlementAge?.(s1.id)?.ageId || 1;
    const era2 = this.sim.civilizationAgeSystem?.getSettlementAge?.(s2.id)?.ageId || 1;
    const isDevastating = Boolean(war.totalWar) || Math.max(era1, era2) >= 6;
    const casualtyThreshold = isDevastating
      ? Math.max(18, Math.floor((pop1 + pop2) * 0.78))
      : Math.max(10, Math.floor((pop1 + pop2) * 0.45));
    const maxWarAge = isDevastating ? 960 : 650;
    const wearinessCap = isDevastating ? 125 : 100;

    // Weariness threshold, prolonged duration, or scaled blood toll
    if (s1Weariness >= wearinessCap || s2Weariness >= wearinessCap || warAge > maxWarAge || totalCasualties >= casualtyThreshold) {
      let victorId = null;

      if (s1Weariness > s2Weariness + 15) {
        victorId = s2.id;
      } else if (s2Weariness > s1Weariness + 15) {
        victorId = s1.id;
      } else {
        const s1Losses = war.casualties[s1.id] || 0;
        const s2Losses = war.casualties[s2.id] || 0;
        if (s1Losses < s2Losses) victorId = s1.id;
        else if (s2Losses < s1Losses) victorId = s2.id;
      }

      const peaceReason = (s1Weariness >= wearinessCap || s2Weariness >= wearinessCap)
        ? `War weariness broke domestic morale (${Math.round(Math.max(s1Weariness, s2Weariness))}%).`
        : totalCasualties >= casualtyThreshold
          ? `Severe casualties (${totalCasualties} fallen across both sides) forced a truce.`
          : `Stalemate after ${warAge} ticks of continuous warfare.`;

      this.signPeace(s1.id, s2.id, victorId, tick, null, peaceReason);
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
        time: this.sim?.clock?.tick ?? 0
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
      diplomaticHistory: this.diplomaticHistory,
      nextDiplomaticEventId: this.nextDiplomaticEventId,
      nextWarId: this.nextWarId,
      nextTreatyId: this.nextTreatyId,
      lastDiplomacyTick: this.lastDiplomacyTick,
      lastGlobalNukeTick: this.lastGlobalNukeTick ?? -999,
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
    if (Array.isArray(data.diplomaticHistory)) this.diplomaticHistory = data.diplomaticHistory;
    if (Number.isFinite(data.nextDiplomaticEventId)) this.nextDiplomaticEventId = data.nextDiplomaticEventId;
    if (Number.isFinite(data.nextWarId)) this.nextWarId = data.nextWarId;
    if (Number.isFinite(data.nextTreatyId)) this.nextTreatyId = data.nextTreatyId;
    if (Number.isFinite(data.lastDiplomacyTick)) this.lastDiplomacyTick = data.lastDiplomacyTick;
    if (Number.isFinite(data.lastGlobalNukeTick)) this.lastGlobalNukeTick = data.lastGlobalNukeTick;
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
