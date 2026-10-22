/**
 * Warfare System
 * Orchestrates militia drafting, army warbands, tactical formations,
 * real-time battlefield engagements, sieges, and plunder.
 */

export class WarfareSystem {
  constructor(simulation) {
    this.sim = simulation;
    // Map of warbandId -> Warband
    this.warbands = new Map();
    this.nextWarbandId = 1;
    // Clashing battle visual effects for renderer: [{ x, y, duration, type }]
    this.combatEffects = [];
  }

  // Called when war is declared between two settlements
  onWarDeclared(war) {
    // Mobilize offensive warband for attacker
    this.mobilizeWarband(war.attackerId, war.defenderId, "assault");
    // Mobilize defensive warband for defender
    this.mobilizeWarband(war.defenderId, war.attackerId, "defense");
  }

  // Mobilize a warband for a settlement
  mobilizeWarband(settlementId, targetSettlementId = null, role = "assault") {
    const settlement = this.sim.settlementSystem?.settlements.get(settlementId);
    if (!settlement) return null;

    // Check if settlement already has an active warband
    for (const wb of this.warbands.values()) {
      if (wb.settlementId === settlementId && wb.active) {
        if (targetSettlementId && !wb.targetSettlementId) {
          wb.targetSettlementId = targetSettlementId;
          wb.role = role;
          wb.state = role === "defense" ? "defending" : "marching";
        }
        return wb;
      }
    }

    // Find eligible adult citizens to recruit. Professional soldiers are
    // preferred over raw conscripts (Phase 3b Step 2): they drilled at the
    // barracks and carry combat XP, so they fill the warband first.
    const veterans = [];
    const eligible = [];
    for (const aId of settlement.agentIds) {
      // Perf: O(1) id lookup instead of a linear roster scan per citizen.
      const a = this.sim._agentById(aId);
      if (a && a.alive && a.age >= 18 && a.age <= 55 && (a.needs.health || 100) > 40 && !a.wounded) {
        if (a.job === 'soldier' && !a.militaryDuty) veterans.push(a);
        else eligible.push(a);
      }
    }

    if (veterans.length === 0 && eligible.length === 0) return null;

    // Determine squad size: 30% to 50% of eligible population, minimum 2, maximum 8
    const poolSize = veterans.length + eligible.length;
    const squadSize = Math.max(2, Math.min(8, Math.floor(poolSize * 0.4)));
    // Soldiers first (stable insertion order = deterministic), then civilians.
    const recruited = veterans.concat(eligible).slice(0, squadSize);

    // Pick commander: prefer the most experienced soldier, else highest brave.
    // Deterministic tie-break by id so save/load resumes behave identically.
    recruited.sort((a, b) => {
      const aSoldier = a.job === 'soldier' ? 1 : 0;
      const bSoldier = b.job === 'soldier' ? 1 : 0;
      if (aSoldier !== bSoldier) return bSoldier - aSoldier;
      const braveDiff = (b.personality?.brave ?? 0.5) - (a.personality?.brave ?? 0.5);
      if (Math.abs(braveDiff) > 1e-9) return braveDiff;
      return String(a.id).localeCompare(String(b.id));
    });
    const commander = recruited[0];

    const warbandId = this.nextWarbandId++;
    const formationType = role === "defense" ? "shield" : "wedge";

    // Equip soldiers with weapons and gear from settlement stockpile
    const hasOre = (settlement.stockpile?.ore ?? 0) >= 2;
    const hasWood = (settlement.stockpile?.wood ?? 0) >= 2;
    // Step 3: forged spears in the stockpile are real weapons — each recruit
    // draws one (deterministically, in recruitment order). A smithing
    // settlement marches an armed warband; a poor one marches farmers with
    // hoes. Visible quality difference on the battlefield.
    let spearStock = Math.floor(settlement.stockpile?.weapon_spear ?? 0);

    recruited.forEach((soldier, idx) => {
      soldier.militaryDuty = true;
      soldier.warbandId = warbandId;
      // Conscripts take up arms but keep their civilian profession on the
      // economy ledger (job field only reflects duty while mustered);
      // professional soldiers already carry a 'soldier' record. This keeps
      // records and agent state in sync after demobilization.
      if (soldier.job !== 'soldier') {
        this.sim.economySystem?.agentJobs?.set(soldier.id, {
          job: soldier.job || 'unemployed',
          skillLevel: 1,
          experience: 0,
          assignedAt: this.sim.clock.tick
        });
      }
      soldier.job = "soldier";
      // Phase 3b Step 3: battle-hardened veterans get promoted — after
      // surviving a campaign they march as elites (higher damage/defense
      // via the combat-skill bonus applied below). Deterministic counter.
      soldier.veteranCampaigns = (soldier.veteranCampaigns ?? 0) + 1;
      soldier.combatRole = idx === 0 ? "commander" : (role === "defense" ? "shieldbearer" : "vanguard");

      // Weaponry and defense
      const armed = spearStock > 0;
      if (armed) {
        spearStock--;
        settlement.stockpile.weapon_spear = (settlement.stockpile.weapon_spear || 0) - 1;
        soldier.inventory.weapon_spear = (soldier.inventory.weapon_spear || 0) + 1;
      }
      soldier.hasWeapon = armed || hasOre || !!(soldier.inventory.tool_pickaxe || soldier.inventory.tool_axe);
      soldier.hasShield = role === "defense" || hasWood;

      // Training + equipment determine combat stats.
      const training = soldier.skills?.combat ?? 1.0;
      // Phase 3b Step 3: campaign-hardened veterans fight sharper — each
      // survived muster adds a small multiplicative edge (capped at +15%).
      const hardening = 1 + Math.min(0.15, (soldier.veteranCampaigns ?? 1) > 1 ? ((soldier.veteranCampaigns ?? 1) - 1) * 0.05 : 0);
      const weaponDamage = armed ? 22 : (soldier.hasWeapon ? 15 : 9);
      const dmg = Math.round(weaponDamage * (0.8 + 0.2 * training) * hardening);
      const def = Math.min(0.6, (soldier.hasShield ? 0.35 : 0.1) + Math.min(0.15, (training - 1) * 0.05) + ((soldier.veteranCampaigns ?? 1) - 1) * 0.02);

      if (!soldier.combat) {
        soldier.combat = {
          health: 100,
          maxHealth: 100,
          damage: dmg,
          defense: def,
          range: armed ? 2.2 : 1.8,
          attackCooldown: 0,
          attackSpeed: armed ? 40 : 45
        };
      } else {
        soldier.combat.damage = dmg;
        soldier.combat.defense = def;
        soldier.combat.range = armed ? 2.2 : 1.8;
        soldier.combat.attackSpeed = armed ? 40 : 45;
      }
    });

    const targetSettlement = targetSettlementId ? this.sim.settlementSystem.settlements.get(targetSettlementId) : null;
    const marchTarget = targetSettlement ? { ...targetSettlement.center } : { ...settlement.center };

    const warband = {
      id: warbandId,
      settlementId,
      settlementName: settlement.name,
      bannerColor: settlement.bannerColor || "#ef4444",
      commanderId: commander.id,
      soldiers: recruited.map(a => a.id),
      role, // "assault" or "defense"
      formation: formationType,
      state: role === "defense" ? "defending" : "marching",
      targetSettlementId,
      marchTarget,
      morale: 100,
      initialSize: recruited.length,
      active: true,
      plunderCargo: { food: 0, wood: 0, ore: 0 }
    };

    this.warbands.set(warbandId, warband);

    // Apply formation offsets
    this.applyFormationPositions(warband);

    if (this.sim.eventBus) {
      this.sim.eventBus.emit("WARBAND_MOBILIZED", {
        warbandId,
        settlementName: settlement.name,
        size: recruited.length,
        role
      });
    }

    return warband;
  }

  applyFormationPositions(warband) {
    const commander = this.sim._agentById(warband.commanderId);
    if (!commander || !commander.alive) return;

    const offsets = warband.formation === "shield" ? 
      [[-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [-1, 1], [1, 1]] :
      [[0, 0], [-1.5, 1.5], [1.5, 1.5], [-3, 3], [3, 3], [0, 2]];

    let idx = 0;
    for (const soldierId of warband.soldiers) {
      const soldier = this.sim._agentById(soldierId);
      if (soldier && soldier.alive && soldier.id !== commander.id) {
        soldier.formationOffset = offsets[idx % offsets.length];
        idx++;
      }
    }
  }

  // Demobilize warbands for a settlement when peace is signed
  demobilizeSettlement(settlementId) {
    for (const wb of this.warbands.values()) {
      if (wb.settlementId === settlementId && wb.active) {
        wb.active = false;
        wb.state = "disbanded";
        for (const sId of wb.soldiers) {
          const soldier = this.sim._agentById(sId);
          if (soldier) {
            soldier.militaryDuty = false;
            soldier.warbandId = null;
            soldier.combatRole = null;
            // Veterans keep their 'soldier' profession after the muster —
            // they return to barracks drills and answer the next war call
            // first (Phase 3b Step 2). Conscripts return to the civilian
            // profession recorded on the economy ledger at muster time.
            // IMPORTANT: mustering a *professional* soldier does not touch
            // his economy record (it stays 'soldier'), so rec.job alone can
            // never distinguish veteran from conscript here — consult the
            // agent's own job field as well, otherwise veterans get demoted
            // to whatever stale record predates their enlistment (Phase 3b
            // Step 3 regression: 0 professionals survived any campaign).
            const rec = this.sim.economySystem?.getAgentJob?.(sId);
            const isProfessional = soldier.job === 'soldier' || (rec && rec.job === 'soldier');
            if (isProfessional) {
              soldier.job = 'soldier';
              soldier.jobTitle = this.sim.economySystem.jobDefinitions.soldier?.name || 'Soldier';
              // Keep the two ledgers in sync so the career-change guard and
              // job-assignment pass both see him as enlisted content.
              if (rec && rec.job !== 'soldier') {
                this.sim.economySystem.assignJob?.(soldier, ['soldier']);
              }
            } else if (rec && rec.job !== 'soldier') {
              soldier.job = rec.job;
              soldier.jobTitle = this.sim.economySystem.jobDefinitions[rec.job]?.name || rec.job;
            } else {
              soldier.job = "unemployed";
            }
          }
        }
      }
    }
  }

  // Update warfare engine each tick
  update() {
    // 1. Update visual combat effects
    for (let i = this.combatEffects.length - 1; i >= 0; i--) {
      this.combatEffects[i].duration--;
      if (this.combatEffects[i].duration <= 0) {
        this.combatEffects.splice(i, 1);
      }
    }

    // Perf: invalidate the per-tick enemy snapshot cache so the first
    // getAllNearbyEnemies() call of this tick rebuilds it.
    this._enemySnapshot = null;

    // 2. Update active warbands
    for (const warband of this.warbands.values()) {
      if (!warband.active) continue;
      this.updateWarband(warband);
    }

    // Step G (presentation bookkeeping only — never read by sim logic):
    // stamp each active warband with its centroid + average morale so the
    // canvas renderer can draw clashing-army markers without scanning
    // soldier rosters every frame. Determinism-safe: purely derived data.
    for (const wb of this.warbands.values()) {
      if (!wb.active || wb.state === "destroyed") continue;
      let sx = 0, sy = 0, n = 0;
      for (const sid of wb.soldiers) {
        const a = this.sim._agentById(sid);
        if (a && a.alive) { sx += a.x; sy += a.y; n++; }
      }
      if (n > 0) {
        wb.centroidX = sx / n;
        wb.centroidY = sy / n;
        wb.markerSize = n;
      }
      wb.markerMorale = wb.morale;
    }
  }

  // Build (once per tick) a compact list of combat-capable agents bucketed by
  // settlement. Previously every getAllNearbyEnemies() call scanned the entire
  // roster; with many warbands clashing that was O(warbands x agents) per tick.
  // Bucket order follows this.sim.agents order, so results stay deterministic.
  _getEnemySnapshot() {
    if (this._enemySnapshot && this._enemySnapshot.tick === this.sim.tick) {
      return this._enemySnapshot;
    }
    const buckets = new Map(); // settlementId -> array of agents (roster order)
    const agentMap = this.sim.settlementSystem?.agentSettlementMap;
    for (const wb of this.warbands.values()) {
      if (!wb.active || wb.state === "destroyed") continue;
      let arr = buckets.get(wb.settlementId);
      for (const sId of wb.soldiers) {
        const a = this.sim._agentById(sId);
        // Only bucket soldiers whose home settlement matches the warband's —
        // exactly the agents the old full-roster filter could return for this
        // sid (agents stamped with a different settlementId belong to another
        // warband's bucket).
        if (!a || !a.alive) continue;
        const home = a.settlementId || (agentMap ? agentMap.get(a.id) : null);
        if (home !== wb.settlementId) continue;
        if (!arr) buckets.set(wb.settlementId, (arr = []));
        if (!arr.includes(a)) arr.push(a);
      }
    }
    this._enemySnapshot = { tick: this.sim.tick, buckets };
    return this._enemySnapshot;
  }

  updateWarband(warband) {
    // Filter alive soldiers — perf: O(1) id lookup per soldier instead of a
    // full roster scan (agents.find) for each one. Order preserved.
    const soldiers = warband.soldiers;
    let w = 0;
    for (let i = 0; i < soldiers.length; i++) {
      const a = this.sim._agentById(soldiers[i]);
      if (a && a.alive) soldiers[w++] = soldiers[i];
    }
    if (w < soldiers.length) soldiers.length = w;

    if (soldiers.length === 0) {
      warband.active = false;
      warband.state = "destroyed";
      return;
    }

    // Ensure commander is alive
    let commander = this.sim._agentById(warband.commanderId);
    if (!commander || !commander.alive) {
      // Perf: soldiers were just verified alive above, so the first entry is
      // the new leader (same agent as the old roster-order scan would pick).
      const nextLead = this.sim._agentById(soldiers[0]);
      if (nextLead && nextLead.alive) {
        warband.commanderId = nextLead.id;
        commander = nextLead;
      } else {
        warband.active = false;
        return;
      }
    }

    // Step 3: a band whose morale collapses breaks and routs home. This is
    // the "losing side penalty" — casualties drain morale, low morale drains
    // further fights, and routed bands abandon the field instead of dying
    // to a last stand. Deterministic (no RNG draw needed).
    if (warband.morale <= 25 && warband.state !== "retreating") {
      warband.state = "retreating";
      if (this.sim.eventBus) {
        this.sim.eventBus.emit("WARBAND_ROUTED", {
          warbandId: warband.id, settlementName: warband.settlementName
        });
      }
    }
    // Wounded, under-strength bands retreat too (fewer than 1/3 remain).
    const initialSize = warband.initialSize ?? warband.soldiers.length;
    if (warband.soldiers.length > 0 && warband.soldiers.length * 3 < initialSize && warband.state !== "retreating") {
      warband.state = "retreating";
    }

    // Phase 3b Step 3: wounded soldiers recover at home. Once the band is
    // back inside its settlement, every wounded man begins a convalescence
    // countdown; when it expires he is healed and returns to full duty.
    if (warband.state === "defending" || warband.state === "retreating") {
      const homeW2 = this.sim.settlementSystem.settlements.get(warband.settlementId);
      if (homeW2) {
        for (const sId of warband.soldiers) {
          const wsa = this.sim._agentById(sId);
          if (!wsa || !wsa.alive || !wsa.wounded) continue;
          const dH = Math.hypot(wsa.x - homeW2.center.x, wsa.y - homeW2.center.y);
          if (dH <= 6.0) {
            wsa.woundRecovery = (wsa.woundRecovery ?? 0) + 1;
            if (wsa.woundRecovery >= 150) {
              wsa.wounded = false;
              wsa.woundRecovery = 0;
              wsa.needs.health = Math.max(wsa.needs.health, 70);
              if (this.sim.eventBus) {
                this.sim.eventBus.emit("SOLDIER_RECOVERED", { agentId: wsa.id });
              }
            }
          }
        }
      }
    }

    // Execute state behavior
    switch (warband.state) {
      case "marching":
        this.handleMarching(warband, commander);
        break;

      case "defending":
        this.handleDefending(warband, commander);
        break;

      case "engaging":
        this.handleEngaging(warband, commander);
        break;

      case "sieging":
        this.handleSieging(warband, commander);
        break;

      case "retreating":
        this.handleRetreating(warband, commander);
        break;
    }
  }

  handleMarching(warband, commander) {
    const targetSettlement = this.sim.settlementSystem.settlements.get(warband.targetSettlementId);
    if (!targetSettlement) {
      warband.state = "retreating";
      return;
    }

    // Check if in range of any enemy soldier
    const nearbyEnemy = this.findNearbyEnemy(commander, warband.settlementId, 8.0);
    if (nearbyEnemy) {
      warband.state = "engaging";
      return;
    }

    // Check if reached enemy settlement center for siege
    const distToCenter = Math.hypot(commander.x - targetSettlement.center.x, commander.y - targetSettlement.center.y);
    if (distToCenter < 5.0) {
      warband.state = "sieging";
      return;
    }

    // Move commander toward enemy settlement
    commander.moveToward(targetSettlement.center, this.sim.world);

    // Keep squad in formation
    this.keepSquadInFormation(warband, commander);
  }

  handleDefending(warband, commander) {
    const home = this.sim.settlementSystem.settlements.get(warband.settlementId);
    if (!home) return;

    // Look for hostile attackers near home territory
    const nearbyEnemy = this.findNearbyEnemy(commander, warband.settlementId, 16.0);
    if (nearbyEnemy) {
      warband.state = "engaging";
      return;
    }

    // Guard home center
    const distToCenter = Math.hypot(commander.x - home.center.x, commander.y - home.center.y);
    if (distToCenter > 6.0) {
      commander.moveToward(home.center, this.sim.world);
    }

    this.keepSquadInFormation(warband, commander);
  }

  handleEngaging(warband, commander) {
    const enemies = this.getAllNearbyEnemies(commander, warband.settlementId, 14.0);
    if (enemies.length === 0) {
      // Revert to marching or defending
      warband.state = warband.role === "defense" ? "defending" : "marching";
      return;
    }

    // Each soldier engages nearest enemy
    for (const soldierId of warband.soldiers) {
      const s = this.sim._agentById(soldierId);
      const soldier = (s && s.alive) ? s : null;
      if (!soldier) continue;

      // Phase 3b Step 3: wounded soldiers break off the line and limp back
      // toward home to recover. They no longer fight until healed.
      if (soldier.wounded) {
        const homeW = this.sim.settlementSystem.settlements.get(warband.settlementId);
        if (homeW) soldier.moveToward(homeW.center, this.sim.world);
        continue;
      }

      let nearest = null;
      let minDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(soldier.x - e.x, soldier.y - e.y);
        if (d < minDist) {
          minDist = d;
          nearest = e;
        }
      }

      if (nearest) {
        if (minDist <= (soldier.combat?.range ?? 1.8)) {
          // Attack!
          this.executeMeleeAttack(soldier, nearest, warband);
        } else {
          // Charge toward enemy
          soldier.moveToward(nearest, this.sim.world);
        }
      }
    }
  }

  executeMeleeAttack(attacker, defender, warband) {
    if (!attacker.combat) attacker.combat = { damage: 12, defense: 0.1, attackCooldown: 0, attackSpeed: 45 };
    if (!defender.combat) defender.combat = { damage: 10, defense: 0.1, attackCooldown: 0, attackSpeed: 45, health: 100 };

    if (attacker.combat.attackCooldown > 0) {
      attacker.combat.attackCooldown--;
      return;
    }

    attacker.combat.attackCooldown = attacker.combat.attackSpeed;

    // Step 3: fighting trains soldiers — combat skill rises with experience
    // (capped), and veteran veterans hit harder via the live-skill bonus.
    if (attacker.gainSkill) attacker.gainSkill("combat", 0.02, 5, 1, this.sim.clock?.tick ?? 0);
    const veteranBonus = 1 + Math.min(0.3, ((attacker.skills?.combat ?? 1.0) - 1.0) * 0.1);

    // Damage formula
    const rawDmg = attacker.combat.damage * veteranBonus + (this.sim.world.rng.next() * 4 - 2);
    const def = defender.combat.defense || 0;
    const finalDmg = Math.max(2, Math.round(rawDmg * (1 - def)));

    // Damage lands on the canonical agent.health field. needs.health is a
    // per-tick mirror rebuilt by updateNeeds(); writing only the mirror let
    // regen re-inflate it between ticks and made soldiers immortal in melee.
    defender.health = Math.max(0, (defender.health ?? 100) - finalDmg);
    defender.needs.health = defender.health;
    if (defender.combat) defender.combat.health = defender.health;

    // Phase 3b Step 3 (combat depth): a soldier knocked below 40 HP but not
    // killed is WOUNDED — he drops his weapon, stops fighting and must be
    // carried out of the line. Deterministic threshold check (no RNG draw).
    // The canonical health field is agent.health (needs.health is only a
    // mirror rebuilt by updateNeeds each tick — and regen re-inflates it
    // between the warfare tick and the next mirror sync, which previously
    // let wounded men keep taking hits until the stale mirror crossed 40).
    if (defender.alive && defender.militaryDuty && defender.health < 40) {
      defender.wounded = true;
      const vBand = this.warbands.get(defender.warbandId);
      if (vBand) vBand.morale = Math.max(0, vBand.morale - 2); // seeing men fall hurts the band
      if (this.sim.eventBus && !defender._woundEventSent) {
        defender._woundEventSent = true;
        this.sim.eventBus.emit("SOLDIER_WOUNDED", {
          agentId: defender.id, warbandId: defender.warbandId
        });
      }
    }

    // Visual sparks
    this.combatEffects.push({
      x: (attacker.x + defender.x) / 2,
      y: (attacker.y + defender.y) / 2,
      type: "clash",
      duration: 15
    });

    if (defender.needs.health <= 0) {
      defender.alive = false;
      this.sim.deathsThisSession++;

      // Step 3: war casualties leave scavengable gear behind — spears, tools
      // and half of carried goods drop as a ground loot pile via the same
      // deterministic system used for all deaths.
      if (defender.inventory) {
        defender.inventory.weapon_spear = undefined;
        delete defender.inventory.weapon_spear;
      }
      this.sim.dropInventoryOnGround(defender);

      // Morale swing: losing a man hurts your band, emboldens the enemy's.
      const killerBand = this.warbands.get(attacker.warbandId);
      const victimBand = this.warbands.get(defender.warbandId);
      if (killerBand) killerBand.morale = Math.min(100, killerBand.morale + 4);
      if (victimBand) victimBand.morale = Math.max(0, victimBand.morale - 6);
      
      // Record war casualty
      if (this.sim.diplomacySystem) {
        const defenderSettlementId = this.sim.settlementSystem.getAgentSettlement(defender.id)?.id;
        const war = this.sim.diplomacySystem.activeWars.find(w => 
          (w.attackerId === warband.settlementId && w.defenderId === defenderSettlementId) ||
          (w.defenderId === warband.settlementId && w.attackerId === defenderSettlementId)
        );
        if (war && defenderSettlementId) {
          war.casualties[defenderSettlementId] = (war.casualties[defenderSettlementId] || 0) + 1;
          // Step E: track where the fighting last happened so the UI can
          // offer "jump to front line". Deterministic (derived from sim
          // state only); saved with the war record via serialize().
          war.frontLine = { x: defender.x, y: defender.y, tick: this.sim.clock.tick };
          war.battles.push({
            tick: this.sim.clock.tick,
            x: defender.x,
            y: defender.y,
            casualties: war.casualties[defenderSettlementId]
          });
          if (war.battles.length > 50) war.battles.splice(0, war.battles.length - 50);
        }
      }

      this.combatEffects.push({
        x: defender.x,
        y: defender.y,
        type: "casualty",
        duration: 25
      });
    }
  }

  handleSieging(warband, commander) {
    const enemySettlement = this.sim.settlementSystem.settlements.get(warband.targetSettlementId);
    if (!enemySettlement) {
      warband.state = "retreating";
      return;
    }

    // Check if enemy defenders attack us
    const defenders = this.getAllNearbyEnemies(commander, warband.settlementId, 10.0);
    if (defenders.length > 0) {
      warband.state = "engaging";
      return;
    }

    // Plunder the enemy stockpile!
    if (enemySettlement.stockpile) {
      const stolenFood = Math.min(10, Math.floor((enemySettlement.stockpile.food || 0) * 0.4));
      const stolenWood = Math.min(8, Math.floor((enemySettlement.stockpile.wood || 0) * 0.4));
      const stolenOre = Math.min(6, Math.floor((enemySettlement.stockpile.ore || 0) * 0.4));

      enemySettlement.stockpile.food -= stolenFood;
      enemySettlement.stockpile.wood -= stolenWood;
      enemySettlement.stockpile.ore -= stolenOre;

      warband.plunderCargo.food += stolenFood;
      warband.plunderCargo.wood += stolenWood;
      warband.plunderCargo.ore += stolenOre;

      // Transfer to home settlement
      const home = this.sim.settlementSystem.settlements.get(warband.settlementId);
      if (home && home.stockpile) {
        home.stockpile.food += stolenFood;
        home.stockpile.wood += stolenWood;
        home.stockpile.ore += stolenOre;
      }

      if (this.sim.eventBus) {
        this.sim.eventBus.emit("SETTLEMENT_PLUNDERED", {
          attackerName: warband.settlementName,
          defenderName: enemySettlement.name,
          food: stolenFood,
          wood: stolenWood,
          ore: stolenOre
        });
      }

      // Pillaging: raiders torch the settlement — set buildings ablaze and
      // light the surrounding ground on fire. Fires then spread/decay via
      // world.updateFires() in the environment tick. Deterministic.
      const world = this.sim.world;
      if (world.startFire) {
        let burned = 0;
        for (const b of this.sim.buildings) {
          if (!b.complete || b.health !== undefined && b.health <= 0) continue;
          const d = Math.hypot(b.x - enemySettlement.center.x, b.y - enemySettlement.center.y);
          if (d < 12 && burned < 4) {
            b.health = (b.health ?? 100) - 40;
            world.startFire(Math.floor(b.x), Math.floor(b.y), 70);
            burned++;
          }
        }
        // Ground fires around the center as well
        const ccx = Math.floor(enemySettlement.center.x);
        const ccy = Math.floor(enemySettlement.center.y);
        world.startFire(ccx + 1, ccy, 50);
        world.startFire(ccx, ccy + 1, 50);
      }
      if (this.sim.eventBus) {
        this.sim.eventBus.emit("SETTLEMENT_BURNED", {
          attackerName: warband.settlementName,
          defenderName: enemySettlement.name
        });
      }

      // Check unconditional surrender
      if (this.sim.diplomacySystem) {
        this.sim.diplomacySystem.signPeace(warband.settlementId, enemySettlement.id, warband.settlementId);
      }

      warband.state = "retreating";
    }
  }

  handleRetreating(warband, commander) {
    const home = this.sim.settlementSystem.settlements.get(warband.settlementId);
    if (!home) return;

    const distToHome = Math.hypot(commander.x - home.center.x, commander.y - home.center.y);
    if (distToHome < 4.0) {
      // Safely returned home: disband warband
      this.demobilizeSettlement(warband.settlementId);
      return;
    }

    commander.moveToward(home.center, this.sim.world);
    this.keepSquadInFormation(warband, commander);
  }

  keepSquadInFormation(warband, commander) {
    for (const sId of warband.soldiers) {
      if (sId === commander.id) continue;
      const s = this.sim._agentById(sId);
      const soldier = (s && s.alive) ? s : null;
      if (!soldier) continue;

      const offset = soldier.formationOffset || [0, 1];
      const targetPos = {
        x: Math.max(2, Math.min(this.sim.world.width - 2, commander.x + offset[0])),
        y: Math.max(2, Math.min(this.sim.world.height - 2, commander.y + offset[1]))
      };

      const d = Math.hypot(soldier.x - targetPos.x, soldier.y - targetPos.y);
      if (d > 0.8) {
        soldier.moveToward(targetPos, this.sim.world);
      }
    }
  }

  findNearbyEnemy(agent, mySettlementId, radius) {
    const enemies = this.getAllNearbyEnemies(agent, mySettlementId, radius);
    return enemies.length > 0 ? enemies[0] : null;
  }

  getAllNearbyEnemies(agent, mySettlementId, radius) {
    if (!this.sim.diplomacySystem) return [];
    const hostileSettlementIds = this.sim.diplomacySystem.getEnemies(mySettlementId);
    if (hostileSettlementIds.length === 0) return [];

    // Perf: scan only the agents currently in combat (bucketed by settlement
    // once per tick) instead of filtering the entire roster on every call.
    // Only in-combat agents can appear in a filter result anyway, and bucket
    // order mirrors roster order, so output is identical to the old scan.
    const r2 = radius * radius;
    const snapshot = this._getEnemySnapshot();
    const out = [];
    for (const sid of hostileSettlementIds) {
      const bucket = snapshot.buckets.get(sid);
      if (!bucket) continue;
      for (const a of bucket) {
        if (a.id === agent.id) continue;
        const dx = a.x - agent.x;
        if (dx < -radius || dx > radius) continue;
        const dy = a.y - agent.y;
        if (dy < -radius || dy > radius) continue;
        if (dx * dx + dy * dy <= r2) out.push(a);
      }
    }
    if (out.length < 2) return out;
    // Restore global roster ordering across buckets (deterministic tie-break).
    const pos = this.sim._agentIdMap;
    out.sort((p, q) => (pos.get(p.id) ?? 0) - (pos.get(q.id) ?? 0));
    return out;
  }
}
