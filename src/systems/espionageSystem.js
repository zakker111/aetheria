// Espionage, Sabotage & Guild Factions System
// Deterministic covert operations, counter-espionage sweeps, and civic guilds
// with regional trade, construction, and intelligence modifiers. Zero Math.random().

export const GUILD_CATALOG = {
  merchant: {
    id: 'merchant',
    name: 'Merchant Guild',
    icon: '⚖️',
    buffLabel: '+25% trade & caravan yield',
    unlockHint: 'Unlocks with active trade routes or pop ≥ 8',
  },
  masons: {
    id: 'masons',
    name: 'Masons & Engineers Guild',
    icon: '📐',
    buffLabel: '+25% wonder & bridge construction speed',
    unlockHint: 'Unlocks with 3+ completed buildings or a workshop',
  },
  shadows: {
    id: 'shadows',
    name: 'Shadow Syndicate',
    icon: '🗡️',
    buffLabel: '+20% covert op & counter-intel rating',
    unlockHint: 'Unlocks during war/tension or pop ≥ 10',
  },
};

export const ESPIONAGE_OPS = {
  sabotage_granary: {
    id: 'sabotage_granary',
    label: 'Sabotage Granary',
    shortLabel: 'Burn Granary',
    icon: '🔥',
    baseSuccess: 72,
    description: 'Ignite and spoil enemy grain reserves, triggering scarcity.',
  },
  sabotage_bridge: {
    id: 'sabotage_bridge',
    label: 'Sabotage Bridge',
    shortLabel: 'Blow Bridge',
    icon: '🧨',
    baseSuccess: 68,
    description: 'Collapse an enemy river bridge or cripple a frontier workshop.',
  },
  sabotage_warhead: {
    id: 'sabotage_warhead',
    label: 'Sabotage Warhead',
    shortLabel: 'Disarm Nuke',
    icon: '☢️',
    baseSuccess: 56,
    description: 'Infiltrate nuclear bunkers to disarm an assembled warhead or purge enrichment.',
  },
  steal_blueprints: {
    id: 'steal_blueprints',
    label: 'Steal Blueprints',
    shortLabel: 'Steal Tech',
    icon: '📐',
    baseSuccess: 74,
    description: 'Exfiltrate metallurgy and architectural blueprints to boost wonders & stockpiles.',
  },
  incite_revolt: {
    id: 'incite_revolt',
    label: 'Incite Revolt',
    shortLabel: 'Incite Revolt',
    icon: '✊',
    baseSuccess: 58,
    description: 'Arm dissidents inside an enemy city to spark an armed urban uprising.',
  },
  counter_espionage: {
    id: 'counter_espionage',
    label: 'Counter-Espionage Sweep',
    shortLabel: 'Counter-Intel',
    icon: '🛡️',
    baseSuccess: 90,
    description: 'Sweep the realm for foreign sleeper cells and fortify domestic security for 240 ticks.',
  },
};

const MAX_LOG = 90;

export class EspionageSystem {
  constructor(sim = null) {
    this.sim = sim;
    // Map settlementId -> { merchant: bool, masons: bool, shadows: bool, influence: { merchant, masons, shadows }, counterIntelUntil, alertsRaised }
    this.settlementGuilds = new Map();
    // Ring buffer of covert operation records (what, why, drivers, outcome)
    this.operationsLog = [];
    this.nextOpId = 1;
    this.lastEvalTick = 0;
  }

  getSettlementGuilds(settlementId) {
    let record = this.settlementGuilds.get(settlementId);
    if (!record) {
      record = {
        unlocked: { merchant: false, masons: false, shadows: false },
        influence: { merchant: 10, masons: 10, shadows: 10 },
        counterIntelUntil: 0,
        lastOpTick: -999,
        opsSuccess: 0,
        opsDetected: 0,
      };
      this.settlementGuilds.set(settlementId, record);
    }
    return record;
  }

  hasGuild(settlementId, guildKey) {
    return !!this.getSettlementGuilds(settlementId).unlocked?.[guildKey];
  }

  getTradeYieldMultiplier(settlementId) {
    return this.hasGuild(settlementId, 'merchant') ? 1.25 : 1.0;
  }

  getConstructionMultiplier(settlementId) {
    return this.hasGuild(settlementId, 'masons') ? 1.25 : 1.0;
  }

  _deterministicRoll(seedSalt, fromId, targetId, tick) {
    const base = Math.abs(
      ((tick | 0) * 1103515245 +
        (fromId | 0) * 12345 +
        (targetId | 0) * 2654435761 +
        (this.nextOpId | 0) * 1597334677 +
        (seedSalt | 0) * 73856093 +
        ((this.sim?.seed || 1) | 0)) | 0
    );
    return base % 100;
  }

  _evaluateGuilds(tick) {
    const settlements = this.sim?.settlementSystem?.settlements;
    if (!settlements) return;

    for (const [sId, s] of settlements) {
      if (!s || s.ruined) continue;
      const g = this.getSettlementGuilds(sId);
      const pop = s.population || s.agentIds?.size || 0;
      const buildingsCount = Array.isArray(s.buildings)
        ? s.buildings.filter(b => b && b.complete && !b.isRuined).length
        : 0;
      const workshopCount = Array.isArray(s.buildings)
        ? s.buildings.filter(b => b && b.complete && !b.isRuined && b.buildingType === 'workshop').length
        : 0;
      const hasRoute = Array.isArray(this.sim?.tradeSystem?.tradeRoutes)
        ? this.sim.tradeSystem.tradeRoutes.some(r => r.active && (r.from === sId || r.to === sId))
        : false;
      const inConflict = Array.isArray(this.sim?.diplomacySystem?.activeWars)
        ? this.sim.diplomacySystem.activeWars.some(w => w.active && (w.attackerId === sId || w.defenderId === sId))
        : false;

      if (!g.unlocked.merchant && (hasRoute || pop >= 8)) {
        g.unlocked.merchant = true;
        g.influence.merchant = Math.min(100, g.influence.merchant + 25);
        this.sim?.eventBus?.emit('GUILD_FOUNDED', {
          settlementId: sId,
          settlementName: s.name,
          guildKey: 'merchant',
          guildName: GUILD_CATALOG.merchant.name,
          tick,
        });
      }
      if (!g.unlocked.masons && (buildingsCount >= 3 || workshopCount >= 1)) {
        g.unlocked.masons = true;
        g.influence.masons = Math.min(100, g.influence.masons + 25);
        this.sim?.eventBus?.emit('GUILD_FOUNDED', {
          settlementId: sId,
          settlementName: s.name,
          guildKey: 'masons',
          guildName: GUILD_CATALOG.masons.name,
          tick,
        });
      }
      if (!g.unlocked.shadows && (inConflict || pop >= 10)) {
        g.unlocked.shadows = true;
        g.influence.shadows = Math.min(100, g.influence.shadows + 25);
        this.sim?.eventBus?.emit('GUILD_FOUNDED', {
          settlementId: sId,
          settlementName: s.name,
          guildKey: 'shadows',
          guildName: GUILD_CATALOG.shadows.name,
          tick,
        });
      }
    }
  }

  _pickSabotageOp(fromSettlement, targetSettlement, tick) {
    const targetProg = this.sim?.civilizationAgeSystem?.getNuclearProgram?.(targetSettlement.id);
    if (targetProg && targetProg.unlocked && (targetProg.warheads > 0 || targetProg.progress >= 35)) {
      return 'sabotage_warhead';
    }
    const hasEnemyBridge = (this.sim?.infrastructureSystem?.bridges || []).some(
      b => (b.health ?? 100) > 0 && (b.settlementId === targetSettlement.id || b.factionId === targetSettlement.factionId)
    );
    if (hasEnemyBridge && (tick % 3 === 0)) {
      return 'sabotage_bridge';
    }
    const targetPop = targetSettlement.population || targetSettlement.agentIds?.size || 0;
    if (targetPop >= 6 && (tick % 5 === 0)) {
      return 'incite_revolt';
    }
    return (tick % 2 === 0) ? 'sabotage_granary' : 'steal_blueprints';
  }

  update(tick) {
    if (!this.sim || !this.sim.settlementSystem) return;
    if (tick - this.lastEvalTick < 60) return;
    this.lastEvalTick = tick;

    this._evaluateGuilds(tick);

    // Autonomous covert ops cadence every 120 ticks for hostile/tense realms
    if (tick < 120 || (tick % 120) !== 0) return;
    const settlements = Array.from(this.sim.settlementSystem.settlements.values())
      .filter(s => s && !s.ruined && (s.population || s.agentIds?.size || 0) >= 6)
      .sort((a, b) => a.id - b.id);
    if (settlements.length < 2) return;

    const dip = this.sim.diplomacySystem;
    if (!dip) return;

    for (let i = 0; i < settlements.length; i++) {
      const sFrom = settlements[i];
      const gFrom = this.getSettlementGuilds(sFrom.id);
      if (tick - gFrom.lastOpTick < 150) continue;

      // Only act covertly on deterministic slot
      if (((sFrom.id * 13 + Math.floor(tick / 120)) % 3) !== 0) continue;

      // Find worst rival
      let bestTarget = null;
      let worstScore = 999;
      for (const sOther of settlements) {
        if (sOther.id === sFrom.id) continue;
        const rel = dip.getRelation(sFrom.id, sOther.id);
        if (!rel) continue;
        const isHostile = rel.status === 'war' || rel.status === 'tension' || rel.score <= 34 || (rel.sanctionedUntil || 0) > tick;
        if (isHostile && rel.score < worstScore) {
          worstScore = rel.score;
          bestTarget = sOther;
        }
      }

      if (!bestTarget) continue;
      const opType = this._pickSabotageOp(sFrom, bestTarget, tick);
      this.launchOperation(sFrom.id, bestTarget.id, opType, tick, {
        reason: `Shadow Syndicate covert mission against hostile rival ${bestTarget.name} (Standing ${Math.round(worstScore)})`,
      });
    }
  }

  launchOperation(fromId, targetId, opType = 'sabotage_granary', tick = null, options = {}) {
    const settlements = this.sim?.settlementSystem?.settlements;
    if (!settlements) return null;
    const sFrom = settlements.get(fromId);
    if (!sFrom || sFrom.ruined) return null;

    const now = tick ?? (this.sim?.clock?.tick ?? 0);
    const opDef = ESPIONAGE_OPS[opType] || ESPIONAGE_OPS.sabotage_granary;
    const gFrom = this.getSettlementGuilds(fromId);
    gFrom.lastOpTick = now;

    // Self-targeted counter-espionage sweep
    if (opType === 'counter_espionage') {
      gFrom.counterIntelUntil = now + 240;
      gFrom.influence.shadows = Math.min(100, gFrom.influence.shadows + 10);
      const entry = this._recordOp({
        tick: now,
        opType,
        fromId,
        fromName: sFrom.name,
        targetId: fromId,
        targetName: sFrom.name,
        success: true,
        detected: false,
        title: `Counter-Intel Sweep in ${sFrom.name}`,
        what: `${sFrom.name} swept its quarters and ports for hostile sleeper agents.`,
        why: options.reason || 'Fortified domestic counter-intelligence perimeter for 240 ticks',
        drivers: ['Counter-Espionage Alert (+25 defense)', 'Active for 240 ticks'],
        x: sFrom.center?.x ?? null,
        y: sFrom.center?.y ?? null,
      });
      this.sim?.eventBus?.emit('ESPIONAGE_OPERATION', entry);
      return entry;
    }

    const sTarget = settlements.get(targetId);
    if (!sTarget || sTarget.ruined || fromId === targetId) return null;

    const gTarget = this.getSettlementGuilds(targetId);
    const stealthBonus = gFrom.unlocked.shadows ? 14 : 0;
    const targetCounter = (gTarget.unlocked.shadows ? 10 : 0) + ((gTarget.counterIntelUntil || 0) > now ? 25 : 0);
    const chance = Math.max(20, Math.min(92, opDef.baseSuccess + stealthBonus - targetCounter));

    const rollSuccess = options.forceSuccess !== undefined
      ? (options.forceSuccess ? 0 : 99)
      : this._deterministicRoll(11, fromId, targetId, now);
    const success = rollSuccess < chance;

    const detectionRisk = Math.max(15, Math.min(85, (success ? 35 : 70) + targetCounter - stealthBonus));
    const rollDetect = options.forceDetected !== undefined
      ? (options.forceDetected ? 0 : 99)
      : this._deterministicRoll(37, targetId, fromId, now);
    const detected = rollDetect < detectionRisk;

    let effectText = '';
    const drivers = [
      options.reason || `Covert ${opDef.label} directive`,
      `Success odds ${chance}% (roll ${rollSuccess})`,
    ];

    if (success) {
      gFrom.opsSuccess += 1;
      gFrom.influence.shadows = Math.min(100, gFrom.influence.shadows + 8);

      if (opType === 'sabotage_granary') {
        const lostFood = Math.max(4, Math.floor((sTarget.stockpile?.food || 0) * 0.3));
        const lostBread = Math.floor((sTarget.stockpile?.bread || 0) * 0.3);
        if (sTarget.stockpile) {
          sTarget.stockpile.food = Math.max(0, (sTarget.stockpile.food || 0) - lostFood);
          sTarget.stockpile.bread = Math.max(0, (sTarget.stockpile.bread || 0) - lostBread);
        }
        if (sTarget.center && this.sim?.world?.startFire) {
          this.sim.world.startFire(Math.floor(sTarget.center.x), Math.floor(sTarget.center.y), 20);
        }
        effectText = `Saboteurs torched granaries in ${sTarget.name}, spoiling ${lostFood} food${lostBread > 0 ? ` and ${lostBread} bread` : ''}.`;
        drivers.push(`Destroyed ${lostFood} food${lostBread > 0 ? ` + ${lostBread} bread` : ''}`);
      } else if (opType === 'sabotage_bridge') {
        const infra = this.sim?.infrastructureSystem;
        const bridges = (infra?.bridges || []).filter(b => (b.health ?? 100) > 0);
        // Prefer bridge owned by target or nearest to target settlement center
        let victimBridge = bridges.find(b => b.settlementId === targetId || b.factionId === sTarget.factionId) || null;
        if (!victimBridge && bridges.length > 0 && sTarget.center) {
          let bestDist = Infinity;
          for (const b of bridges) {
            const t0 = b.tiles?.[0];
            if (!t0) continue;
            const d = Math.hypot(t0.x - sTarget.center.x, t0.y - sTarget.center.y);
            if (d < bestDist && d <= 45) {
              bestDist = d;
              victimBridge = b;
            }
          }
        }
        if (victimBridge && Array.isArray(victimBridge.tiles)) {
          victimBridge.health = 0;
          for (const t of victimBridge.tiles) {
            this.sim?.world?.setBridge?.(t.x, t.y, false);
          }
          if (this.sim) this.sim._occStamp = -1;
          const anchor = victimBridge.tiles[0];
          if (anchor && this.sim?.world?.scorchTile) {
            this.sim.world.scorchTile(anchor.x, anchor.y, 180);
          }
          effectText = `Sappers blew up a ${victimBridge.tiles.length}-tile river bridge serving ${sTarget.name}, severing overland supply.`;
          drivers.push(`Collapsed ${victimBridge.tiles.length}-tile bridge`);
        } else {
          // Fallback: damage target building & steal wood
          const intactBldg = (sTarget.buildings || []).find(b => b && !b.isRuined && b.health > 0);
          if (intactBldg) {
            intactBldg.health = Math.max(10, intactBldg.health - Math.round((intactBldg.maxHealth || 100) * 0.45));
          }
          if (sTarget.stockpile) {
            sTarget.stockpile.wood = Math.max(0, (sTarget.stockpile.wood || 0) - 8);
          }
          effectText = `Saboteurs struck supply depots and masonry works inside ${sTarget.name}.`;
          drivers.push('Damaged logistics structure (-8 wood)');
        }
      } else if (opType === 'sabotage_warhead') {
        const prog = this.sim?.civilizationAgeSystem?.getNuclearProgram?.(targetId);
        if (prog && prog.warheads > 0) {
          prog.warheads = Math.max(0, prog.warheads - 1);
          prog.progress = Math.max(0, Math.floor((prog.progress || 0) * 0.5));
          effectText = `Covert operatives infiltrated atomic silos in ${sTarget.name} and disabled 1 nuclear warhead (${prog.warheads} remaining).`;
          drivers.push('Neutralized 1 armed nuclear warhead');
        } else if (prog && prog.unlocked) {
          prog.progress = 0;
          effectText = `Agents sabotaged centrifuges in ${sTarget.name}, wiping out atomic enrichment progress.`;
          drivers.push('Purged nuclear enrichment progress');
        } else {
          if (sTarget.stockpile) sTarget.stockpile.ore = Math.max(0, (sTarget.stockpile.ore || 0) - 10);
          effectText = `Infiltrators raided metal stores in ${sTarget.name}, seizing 10 ore.`;
          drivers.push('Disrupted 10 strategic ore');
        }
      } else if (opType === 'steal_blueprints') {
        const stolenOre = Math.min(8, Math.floor((sTarget.stockpile?.ore || 0) * 0.25));
        const stolenWood = Math.min(10, Math.floor((sTarget.stockpile?.wood || 0) * 0.2));
        if (sTarget.stockpile) {
          sTarget.stockpile.ore = Math.max(0, (sTarget.stockpile.ore || 0) - stolenOre);
          sTarget.stockpile.wood = Math.max(0, (sTarget.stockpile.wood || 0) - stolenWood);
        }
        if (sFrom.stockpile) {
          sFrom.stockpile.ore = (sFrom.stockpile.ore || 0) + Math.max(3, stolenOre);
          sFrom.stockpile.wood = (sFrom.stockpile.wood || 0) + Math.max(4, stolenWood);
        }
        // Boost active wonder construction if any
        const wonder = this.sim?.civilizationAgeSystem?.getWonderState?.(fromId);
        if (wonder && !wonder.complete) {
          this.sim.civilizationAgeSystem.advanceWonderProgress?.(fromId, 28, now);
        }
        effectText = `Spies exfiltrated guild blueprints from ${sTarget.name}, boosting ${sFrom.name}'s reserves & architecture.`;
        drivers.push(`Recovered blueprints (+${Math.max(3, stolenOre)} ore, +28 Wonder pts)`);
      } else if (opType === 'incite_revolt') {
        const reb = this.sim?.warfareSystem?.spawnUrbanRebellion?.(
          targetId,
          `Covert foreign agitation backed by ${sFrom.name}`,
          now,
          [`Covert agitators smuggled arms into ${sTarget.name}`]
        );
        if (reb) {
          effectText = `Foreign agitators armed dissidents inside ${sTarget.name}, sparking an armed street rebellion!`;
          drivers.push('Armed insurgents rose inside the city');
        } else {
          if (sTarget.stockpile) sTarget.stockpile.food = Math.max(0, (sTarget.stockpile.food || 0) - 5);
          effectText = `Agitators stirred strikes and unrest inside ${sTarget.name}.`;
          drivers.push('Disrupted civic order');
        }
      }
    } else {
      effectText = `${sTarget.name}'s watch intercepted ${sFrom.name}'s ${opDef.label.toLowerCase()} cell before the strike landed.`;
      drivers.push('Operation thwarted by garrison watch');
    }

    if (detected) {
      gFrom.opsDetected += 1;
      const dip = this.sim?.diplomacySystem;
      if (dip) {
        const rel = dip.getRelation(fromId, targetId);
        if (rel) {
          rel.score = Math.max(0, Math.round(rel.score - (success ? 16 : 10)));
          if (rel.score < 30 && rel.status === 'peace') rel.status = 'tension';
        }
        dip.addGrievance(targetId, fromId, `Exposed Spy Ring (${opDef.label})`, success ? 14 : 9);
      }
      drivers.push(`Cell Exposed! Diplomatic outrage against ${sFrom.name}`);
    }

    const what = `${effectText}${detected ? ` (${sFrom.name}'s involvement was exposed!)` : ' (Covertly executed without proof)'}`;
    const why = options.reason || `Rival geopolitical subversion between ${sFrom.name} and ${sTarget.name}`;

    const entry = this._recordOp({
      tick: now,
      opType,
      fromId,
      fromName: sFrom.name,
      targetId,
      targetName: sTarget.name,
      success,
      detected,
      title: `${success ? opDef.icon : '🚨'} ${opDef.label}: ${sFrom.name} → ${sTarget.name}`,
      what,
      why,
      drivers,
      x: sTarget.center?.x ?? null,
      y: sTarget.center?.y ?? null,
    });

    if (this.sim?.diplomacySystem?.recordDiplomaticEvent) {
      this.sim.diplomacySystem.recordDiplomaticEvent({
        tick: now,
        type: 'espionage',
        outcome: success ? (detected ? 'exposed_success' : 'covert_success') : (detected ? 'foiled_exposed' : 'foiled'),
        title: entry.title,
        what,
        why,
        drivers,
        actors: [fromId, targetId],
        actorNames: [sFrom.name, sTarget.name],
        x: sTarget.center?.x ?? null,
        y: sTarget.center?.y ?? null,
      });
    }

    this.sim?.eventBus?.emit('ESPIONAGE_OPERATION', entry);
    return entry;
  }

  _recordOp(entry) {
    const record = { id: this.nextOpId++, ...entry };
    this.operationsLog.push(record);
    if (this.operationsLog.length > MAX_LOG) {
      this.operationsLog.splice(0, this.operationsLog.length - MAX_LOG);
    }
    return record;
  }

  cleanupSettlement(settlementId) {
    this.settlementGuilds.delete(settlementId);
  }

  serialize() {
    return {
      nextOpId: this.nextOpId,
      lastEvalTick: this.lastEvalTick,
      guilds: Array.from(this.settlementGuilds.entries()).map(([id, g]) => [
        id,
        {
          unlocked: { ...g.unlocked },
          influence: { ...g.influence },
          counterIntelUntil: g.counterIntelUntil || 0,
          lastOpTick: g.lastOpTick ?? -999,
          opsSuccess: g.opsSuccess || 0,
          opsDetected: g.opsDetected || 0,
        },
      ]),
      operationsLog: this.operationsLog.map(o => ({ ...o, drivers: [...(o.drivers || [])] })),
    };
  }

  static deserialize(data, sim) {
    const sys = new EspionageSystem(sim);
    if (!data) return sys;
    sys.nextOpId = data.nextOpId || 1;
    sys.lastEvalTick = data.lastEvalTick || 0;
    if (Array.isArray(data.guilds)) {
      for (const [id, g] of data.guilds) {
        sys.settlementGuilds.set(id, {
          unlocked: { ...(g.unlocked || { merchant: false, masons: false, shadows: false }) },
          influence: { ...(g.influence || { merchant: 10, masons: 10, shadows: 10 }) },
          counterIntelUntil: g.counterIntelUntil || 0,
          lastOpTick: g.lastOpTick ?? -999,
          opsSuccess: g.opsSuccess || 0,
          opsDetected: g.opsDetected || 0,
        });
      }
    }
    if (Array.isArray(data.operationsLog)) {
      sys.operationsLog = data.operationsLog.slice(-MAX_LOG).map(o => ({ ...o }));
    }
    return sys;
  }
}
