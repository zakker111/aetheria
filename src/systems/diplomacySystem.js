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

    // Check relations every 40 ticks
    if (tick - this.lastDiplomacyTick >= 40) {
      this.lastDiplomacyTick = tick;
      this.evaluateDiplomacy(tick);
      this.updateTreaties(tick);
    }
  }

  evaluateDiplomacy(tick) {
    const settlements = Array.from(this.sim.settlementSystem.settlements.values());
    if (settlements.length < 2) return;

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
            // High probability of war declaration if one side is militaristic or hungry
            const s1Food = s1.stockpile?.food ?? 20;
            const s2Food = s2.stockpile?.food ?? 20;
            const aggro = Math.max(belligerence1, belligerence2);

            if (aggro > 0.4 || (s1Food < 8 && s2Food > 20) || (s2Food < 8 && s1Food > 20)) {
              const attackerId = belligerence1 >= belligerence2 ? s1.id : s2.id;
              const defenderId = attackerId === s1.id ? s2.id : s1.id;
              this.declareWar(attackerId, defenderId, "Border Skirmish & Granary Raid", tick);
            }
          }
        }
      }
    }
  }

  declareWar(attackerId, defenderId, casusBelli = "Territorial Conquest", tick = 0) {
    const rel = this.getRelation(attackerId, defenderId);
    if (!rel || rel.status === DIPLOMATIC_STATUS.WAR) return;

    rel.status = DIPLOMATIC_STATUS.WAR;
    rel.score = Math.min(rel.score, 5);

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
    for (const [key, rel] of this.relations) {
      if (rel.status === DIPLOMATIC_STATUS.ALLIANCE) {
        if (rel.settlementA === settlementId) allies.push(rel.settlementB);
        else if (rel.settlementB === settlementId) allies.push(rel.settlementA);
      }
    }
    return allies;
  }

  getEnemies(settlementId) {
    const enemies = [];
    for (const [key, rel] of this.relations) {
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
        time: this.simulation?.clock?.tick ?? Date.now()
      });
    }
  }
}
