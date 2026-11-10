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

    // Phase 3b Step 7: check demilitarization treaty terms
    if (settlement.demilitarizedUntil && settlement.demilitarizedUntil > this.sim.clock.tick) {
      return null;
    }

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

    // Determine squad size: 30% to 50% of eligible population, minimum 1, maximum 8
    const poolSize = veterans.length + eligible.length;
    const squadSize = Math.max(1, Math.min(8, Math.max(1, Math.floor(poolSize * 0.45))));
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
    // Step 3: forged weapons & shields in the stockpile are drawn deterministically
    // in recruitment order. Swords (dmg 28, spd 35, range 1.8), spears (dmg 22, spd 40, range 2.2),
    // bows (dmg 18, spd 50, range 5.5, role: archer), shields (+defense & deflection).
    let swordStock = Math.floor(settlement.stockpile?.weapon_sword ?? 0);
    let spearStock = Math.floor(settlement.stockpile?.weapon_spear ?? 0);
    let bowStock = Math.floor(settlement.stockpile?.weapon_bow ?? 0);
    let shieldStock = Math.floor(settlement.stockpile?.armor_shield ?? 0);

    recruited.forEach((soldier, idx) => {
      soldier.militaryDuty = true;
      soldier.warbandId = warbandId;
      if (soldier.job !== 'soldier') {
        this.sim.economySystem?.agentJobs?.set(soldier.id, {
          job: soldier.job || 'unemployed',
          skillLevel: 1,
          experience: 0,
          assignedAt: this.sim.clock.tick
        });
      }
      soldier.job = "soldier";
      soldier.veteranCampaigns = (soldier.veteranCampaigns ?? 0) + 1;

      // Draw weaponry
      let weaponType = "unarmed";
      let weaponDamage = 9;
      let weaponRange = 1.8;
      let attackSpeed = 45;

      if (swordStock > 0) {
        swordStock--;
        settlement.stockpile.weapon_sword = (settlement.stockpile.weapon_sword || 0) - 1;
        soldier.inventory.weapon_sword = (soldier.inventory.weapon_sword || 0) + 1;
        weaponType = "sword";
        weaponDamage = 28;
        weaponRange = 1.8;
        attackSpeed = 35;
      } else if (spearStock > 0) {
        spearStock--;
        settlement.stockpile.weapon_spear = (settlement.stockpile.weapon_spear || 0) - 1;
        soldier.inventory.weapon_spear = (soldier.inventory.weapon_spear || 0) + 1;
        weaponType = "spear";
        weaponDamage = 22;
        weaponRange = 2.2;
        attackSpeed = 40;
      } else if (bowStock > 0) {
        bowStock--;
        settlement.stockpile.weapon_bow = (settlement.stockpile.weapon_bow || 0) - 1;
        soldier.inventory.weapon_bow = (soldier.inventory.weapon_bow || 0) + 1;
        weaponType = "bow";
        weaponDamage = 18;
        weaponRange = 5.5;
        attackSpeed = 50;
      } else {
        const hasTool = !!(soldier.inventory.tool_pickaxe || soldier.inventory.tool_axe);
        if (hasOre || hasTool) {
          weaponType = "improvised";
          weaponDamage = 15;
          weaponRange = 1.8;
          attackSpeed = 45;
        }
      }

      // Draw shield
      let hasShield = false;
      let shieldDef = 0.0;
      let blockChance = 0.0;
      if (shieldStock > 0) {
        shieldStock--;
        settlement.stockpile.armor_shield = (settlement.stockpile.armor_shield || 0) - 1;
        soldier.inventory.armor_shield = (soldier.inventory.armor_shield || 0) + 1;
        hasShield = true;
        shieldDef = 0.25;
        blockChance = 0.35;
      } else if (role === "defense" || hasWood) {
        hasShield = true;
        shieldDef = 0.15;
        blockChance = 0.20;
      }

      soldier.hasWeapon = weaponType !== "unarmed";
      soldier.hasShield = hasShield;

      // Assign tactical combat role
      if (idx === 0) {
        soldier.combatRole = "commander";
      } else if (weaponType === "bow") {
        soldier.combatRole = "archer";
      } else if (hasShield && role === "defense") {
        soldier.combatRole = "shieldbearer";
      } else {
        soldier.combatRole = "vanguard";
      }

      // Phase 3b Step 6: check if mobilizing for a Holy War crusade
      const activeWar = this.sim.diplomacySystem?.activeWars?.find(w => 
        (w.attackerId === settlementId && w.defenderId === targetSettlementId) ||
        (w.defenderId === settlementId && w.attackerId === targetSettlementId)
      );
      const isHolyWar = !!(activeWar?.isHolyWar || activeWar?.casusBelli?.includes("Holy War"));

      // Training + equipment determine combat stats.
      const training = soldier.skills?.combat ?? 1.0;
      const hardening = 1 + Math.min(0.15, (soldier.veteranCampaigns ?? 1) > 1 ? ((soldier.veteranCampaigns ?? 1) - 1) * 0.05 : 0);
      let dmg = Math.round(weaponDamage * (0.8 + 0.2 * training) * hardening);
      if (isHolyWar) dmg = Math.round(dmg * 1.25); // Sacred zealot fervor!
      const def = Math.min(0.65, (hasShield ? (0.2 + shieldDef) : 0.1) + Math.min(0.15, (training - 1) * 0.05) + ((soldier.veteranCampaigns ?? 1) - 1) * 0.02);

      soldier.combat = {
        health: soldier.health ?? 100,
        maxHealth: 100,
        damage: dmg,
        defense: def,
        range: weaponRange,
        attackCooldown: 0,
        attackSpeed,
        weaponType,
        hasShield,
        blockChance,
        zealotFervor: isHolyWar
      };
    });

    const targetSettlement = targetSettlementId ? this.sim.settlementSystem.settlements.get(targetSettlementId) : null;
    const marchTarget = targetSettlement ? { ...targetSettlement.center } : { ...settlement.center };

    const activeWarForBand = this.sim.diplomacySystem?.activeWars?.find(w => 
      (w.attackerId === settlementId && w.defenderId === targetSettlementId) ||
      (w.defenderId === settlementId && w.attackerId === targetSettlementId)
    );
    const bandHolyWar = !!(activeWarForBand?.isHolyWar || activeWarForBand?.casusBelli?.includes("Holy War"));

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
      isHolyWar: bandHolyWar,
      morale: bandHolyWar ? 120 : 100,
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

            // Return surviving military equipment to settlement stockpile
            const sHome = this.sim.settlementSystem?.settlements.get(settlementId);
            if (sHome?.stockpile && soldier.inventory) {
              for (const gearKey of ['weapon_sword', 'weapon_spear', 'weapon_bow', 'armor_shield']) {
                if (soldier.inventory[gearKey]) {
                  sHome.stockpile[gearKey] = (sHome.stockpile[gearKey] || 0) + soldier.inventory[gearKey];
                  delete soldier.inventory[gearKey];
                }
              }
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

    // 2. Update active warbands and prune inactive/disbanded entries
    for (const [wbId, warband] of this.warbands.entries()) {
      if (!warband.active) {
        this.warbands.delete(wbId);
        continue;
      }
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
    const routThreshold = warband.isHolyWar ? 15 : 25;
    if (warband.morale <= routThreshold && warband.state !== "retreating") {
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
              // Heal the CANONICAL field too — needs.health is only a mirror
              // rebuilt from agent.health every tick by updateNeeds(), so
              // writing just the mirror was silently overwritten and wounded
              // men never actually recovered to fight strength again.
              wsa.health = Math.max(wsa.health ?? 100, 70);
              wsa.needs.health = wsa.health;
              if (this.sim.eventBus) {
                this.sim.eventBus.emit("SOLDIER_RECOVERED", { agentId: wsa.id });
              }
            }
          }
        }
      }
    }

    // Military supplies consumption: active warband consumes home rations on campaign
    if (this.sim.clock && (this.sim.clock.tick % 15 === 0) &&
        (warband.state === "marching" || warband.state === "engaging" || warband.state === "sieging")) {
      const homeSettlement = this.sim.settlementSystem?.settlements?.get(warband.settlementId);
      if (homeSettlement && homeSettlement.stockpile) {
        const foodCost = Math.max(1, Math.floor(warband.soldiers.length * 0.2));
        if (homeSettlement.stockpile.food >= foodCost) {
          homeSettlement.stockpile.food -= foodCost;
        } else {
          homeSettlement.stockpile.food = 0;
          warband.morale = Math.max(20, (warband.morale ?? 100) - 2);
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
    let finalDmg = Math.max(2, Math.round(rawDmg * (1 - def)));

    // Shield deflection / block check
    const hasShield = defender.combat?.hasShield || defender.hasShield;
    const blockChance = defender.combat?.blockChance ?? (hasShield ? 0.25 : 0.0);
    const blocked = hasShield && (this.sim.world.rng.next() < blockChance);
    if (blocked) {
      finalDmg = Math.max(1, Math.round(finalDmg * 0.45));
      this.combatEffects.push({
        x: (attacker.x + defender.x) / 2,
        y: (attacker.y + defender.y) / 2,
        type: "shield_block",
        duration: 15
      });
    }

    // Damage lands on the canonical agent.health field.
    defender.health = Math.max(0, (defender.health ?? 100) - finalDmg);
    defender.needs.health = defender.health;
    if (defender.combat) defender.combat.health = defender.health;

    // Phase 3b Step 3 (combat depth): a soldier knocked below 40 HP but not
    // killed is WOUNDED — he drops his weapon, stops fighting and must be
    // carried out of the line. Deterministic threshold check.
    if (defender.alive && defender.militaryDuty && defender.health < 40) {
      defender.wounded = true;
      const vBand = this.warbands.get(defender.warbandId);
      if (vBand) vBand.morale = Math.max(0, vBand.morale - 2); // seeing men fall hurts the band

      // Phase 3b Step 7: chance to capture wounded soldier as Prisoner of War
      if (!defender.captive && (this.sim._rng().next() < 0.35)) {
        defender.captive = true;
        defender.prisonerOf = warband.settlementId;
        defender.militaryDuty = false;
        defender.combatRole = null;
        if (this.sim.eventBus) {
          this.sim.eventBus.emit("SOLDIER_CAPTURED", {
            agentId: defender.id,
            captorSettlementId: warband.settlementId
          });
        }
      }

      if (this.sim.eventBus && !defender._woundEventSent) {
        defender._woundEventSent = true;
        this.sim.eventBus.emit("SOLDIER_WOUNDED", {
          agentId: defender.id, warbandId: defender.warbandId
        });
      }
    }

    // Visual combat clash or arrow trajectory
    const isRanged = attacker.combat.weaponType === "bow";
    if (!blocked) {
      this.combatEffects.push({
        x: (attacker.x + defender.x) / 2,
        y: (attacker.y + defender.y) / 2,
        type: isRanged ? "arrow" : "clash",
        duration: 15
      });
    }

    if (defender.needs.health <= 0) {
      defender.alive = false;
      defender.deathCause = "combat";

      // Slayer tracking & epic epithets
      attacker.kills = (attacker.kills || 0) + 1;
      attacker.battlesFought = (attacker.battlesFought || 0) + 1;
      defender.battlesFought = (defender.battlesFought || 0) + 1;

      if (!attacker.epithet) {
        if (attacker.kills >= 5) {
          attacker.epithet = "the Dreaded";
        } else if (attacker.kills >= 3) {
          attacker.epithet = "the Slayer";
        } else if (attacker.kills >= 2) {
          attacker.epithet = "the Fierce";
        } else {
          attacker.epithet = "the Blooded";
        }
      }

      // Step 3: war casualties leave scavengable gear behind — weapons, tools,
      // and carried goods drop as a ground loot pile via dropInventoryOnGround.
      this.sim.dropInventoryOnGround(defender);

      // Morale swing: losing a man hurts your band, emboldens the enemy's.
      const killerBand = this.warbands.get(attacker.warbandId);
      const victimBand = this.warbands.get(defender.warbandId);
      if (killerBand) killerBand.morale = Math.min(100, killerBand.morale + 4);
      if (victimBand) victimBand.morale = Math.max(0, victimBand.morale - 6);
      
      // Record war casualty & weariness
      let battleName = "the Front Line";
      if (this.sim.diplomacySystem) {
        const defenderSettlementId = this.sim.settlementSystem.getAgentSettlement(defender.id)?.id;
        const war = this.sim.diplomacySystem.activeWars.find(w => 
          (w.attackerId === warband.settlementId && w.defenderId === defenderSettlementId) ||
          (w.defenderId === warband.settlementId && w.attackerId === defenderSettlementId)
        );
        if (war && defenderSettlementId) {
          war.casualties[defenderSettlementId] = (war.casualties[defenderSettlementId] || 0) + 1;
          war.weariness = war.weariness || {};
          war.weariness[defenderSettlementId] = (war.weariness[defenderSettlementId] || 0) + 12;
          // Step E: track where the fighting last happened so the UI can
          // offer "jump to front line". Deterministic (derived from sim
          // state only); saved with the war record via serialize().
          war.frontLine = { x: defender.x, y: defender.y, tick: this.sim.clock.tick };
          const defSet = this.sim.settlementSystem.settlements.get(defenderSettlementId);
          const attSet = this.sim.settlementSystem.settlements.get(warband.settlementId);
          battleName = this.generateBattleName(defSet, attSet, defender.x, defender.y, war.battles.length);
          war.battles.push({
            name: battleName,
            tick: this.sim.clock.tick,
            x: defender.x,
            y: defender.y,
            casualties: war.casualties[defenderSettlementId]
          });
          if (war.battles.length > 50) war.battles.splice(0, war.battles.length - 50);
        }
      }

      if (this.sim.eventBus) {
        this.sim.eventBus.emit("COMBAT_KILL", {
          killerId: attacker.id,
          killerName: attacker.name,
          killerEpithet: attacker.epithet,
          victimId: defender.id,
          victimName: defender.name,
          victimSettlementId: this.sim.settlementSystem.getAgentSettlement(defender.id)?.id,
          battleName: battleName,
          x: defender.x,
          y: defender.y
        });
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

    // Multi-stage siege progression
    warband.siegeTicks = (warband.siegeTicks || 0) + 1;
    if (warband.siegeTicks < 3) {
      warband.siegeStage = "encirclement";
    } else if (warband.siegeTicks < 6) {
      warband.siegeStage = "breach";
      warband.hasRam = true;
    } else {
      warband.siegeStage = "assault";
    }

    // Plunder the enemy stockpile!
    if (enemySettlement.stockpile) {
      const stolenFood = Math.min(15, Math.floor((enemySettlement.stockpile.food || 0) * 0.4));
      const stolenWood = Math.min(12, Math.floor((enemySettlement.stockpile.wood || 0) * 0.4));
      const stolenOre = Math.min(10, Math.floor((enemySettlement.stockpile.ore || 0) * 0.4));

      enemySettlement.stockpile.food = Math.max(0, (enemySettlement.stockpile.food || 0) - stolenFood);
      enemySettlement.stockpile.wood = Math.max(0, (enemySettlement.stockpile.wood || 0) - stolenWood);
      enemySettlement.stockpile.ore = Math.max(0, (enemySettlement.stockpile.ore || 0) - stolenOre);

      // Phase 3b Step 4: plunder cargo is carried by the warband on wagons and
      // unloaded only when safely returning to home territory.
      warband.plunderCargo.food = (warband.plunderCargo.food || 0) + stolenFood;
      warband.plunderCargo.wood = (warband.plunderCargo.wood || 0) + stolenWood;
      warband.plunderCargo.ore = (warband.plunderCargo.ore || 0) + stolenOre;

      // Retaliatory casus belli / resource grievance: plundered town remembers the sack
      if (this.sim.diplomacySystem) {
        this.sim.diplomacySystem.addGrievance(enemySettlement.id, warband.settlementId, "Stockpile Sacked & Plundered", 18);
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

      // Pillaging: raiders torch the settlement — set buildings ablaze, scorch earth, and
      // reduce damaged buildings to ruins. Fires spread/decay via world.updateFires().
      const world = this.sim.world;
      if (world.startFire) {
        let burned = 0;
        for (const b of this.sim.buildings) {
          if (!b.complete || b.isRuined || (b.health !== undefined && b.health <= 0)) continue;
          const d = Math.hypot(b.x - enemySettlement.center.x, b.y - enemySettlement.center.y);
          if (d < 14 && burned < 5) {
            b.health = Math.max(0, (b.health ?? 100) - 45);
            world.startFire(Math.floor(b.x), Math.floor(b.y), 75);
            if (world.scorchTile) world.scorchTile(Math.floor(b.x), Math.floor(b.y), 240);
            if (b.health <= 0) {
              b.isRuined = true;
              b.health = 0;
              b.ruinedAtTick = this.sim.clock.tick;
              if (this.sim.eventBus) {
                this.sim.eventBus.emit("BUILDING_PILLAGED", {
                  settlementId: enemySettlement.id,
                  buildingId: b.id,
                  buildingType: b.buildingType,
                  attacker: warband.settlementName
                });
              }
            }
            burned++;
          }
        }
        // Ground fires and scorched earth around the center as well
        const ccx = Math.floor(enemySettlement.center.x);
        const ccy = Math.floor(enemySettlement.center.y);
        world.startFire(ccx + 1, ccy, 60);
        world.startFire(ccx, ccy + 1, 60);
        if (world.scorchTile) {
          world.scorchTile(ccx, ccy, 220);
          world.scorchTile(ccx + 1, ccy, 200);
          world.scorchTile(ccx, ccy + 1, 200);
        }
      }
      if (this.sim.eventBus) {
        this.sim.eventBus.emit("SETTLEMENT_BURNED", {
          attackerName: warband.settlementName,
          defenderName: enemySettlement.name
        });
      }

      // Phase 3b Step 6 & 7: weariness from sacking + Holy War temple desecration
      const war = this.sim.diplomacySystem?.activeWars?.find(w => 
        (w.attackerId === warband.settlementId && w.defenderId === enemySettlement.id) ||
        (w.defenderId === warband.settlementId && w.attackerId === enemySettlement.id)
      );

      if (war) {
        war.weariness = war.weariness || {};
        war.weariness[enemySettlement.id] = (war.weariness[enemySettlement.id] || 0) + 18;
      }
      const isConquest = Boolean(war?.goal === "conquest" || war?.isConquest || warband.isConquest);

      // Holy War temple desecration
      if (warband.isHolyWar) {
        for (const b of this.sim.buildings) {
          if (b.complete && b.buildingType === "temple" && (b.health === undefined || b.health > 0)) {
            const d = Math.hypot(b.x - enemySettlement.center.x, b.y - enemySettlement.center.y);
            if (d < 15) {
              b.health = 0;
              world.startFire(Math.floor(b.x), Math.floor(b.y), 80);
              if (this.sim.eventBus) {
                this.sim.eventBus.emit("TEMPLE_DESECRATED", {
                  settlementId: enemySettlement.id,
                  templeId: b.id,
                  desecrator: warband.settlementName
                });
              }
              if (this.sim.chronicleSystem?.addEntry) {
                this.sim.chronicleSystem.addEntry(
                  "TEMPLE_DESECRATED",
                  `🔥 The sacred Temple of ${enemySettlement.name} was desecrated and destroyed by holy crusaders from ${warband.settlementName}!`
                );
              }
              if (enemySettlement.agentIds) {
                for (const aid of enemySettlement.agentIds) {
                  const a = this.sim._agentById(aid);
                  if (a && a.alive && a.religion) {
                    a.religion.faith = Math.max(0, a.religion.faith - 25);
                    if (a.needs?.morale) a.needs.morale = Math.max(0, a.needs.morale - 20);
                  }
                }
              }
              break;
            }
          }
        }
      }

      let defenderPop = 0;
      if (enemySettlement.agentIds) {
        for (const id of enemySettlement.agentIds) {
          const a = this.sim._agentById(id);
          if (a && a.alive) defenderPop++;
        }
      }

      if (this.sim.eventBus) {
        this.sim.eventBus.emit("TOWN_CAPITULATED", {
          attackerName: warband.settlementName,
          defenderName: enemySettlement.name,
          settlementId: enemySettlement.id
        });
      }

      if (defenderPop === 0) {
        // Total War: entire village or city wiped out into desolate ruins!
        enemySettlement.ruined = true;
        enemySettlement.tier = "Ruins";
        enemySettlement.tierIcon = "🏚️";
        enemySettlement.status = "ruined";
        enemySettlement.name = "Ruins of " + enemySettlement.name.replace(/^Ruins of /, "");
        enemySettlement.abandonedTicks = 120;
        enemySettlement.leadership = null;

        // Destroy all buildings in the settlement into ruins
        if (this.sim.buildings) {
          for (const b of this.sim.buildings) {
            const d = Math.hypot(b.x - enemySettlement.center.x, b.y - enemySettlement.center.y);
            if (d <= 18) {
              b.health = 0;
              b.isRuined = true;
              b.ruinedAtTick = this.sim.clock.tick;
              if (world.scorchTile) world.scorchTile(Math.floor(b.x), Math.floor(b.y), 255);
              if (world.startFire) world.startFire(Math.floor(b.x), Math.floor(b.y), 80);
            }
          }
        }

        // Remaining resources plundered & incinerated
        if (enemySettlement.stockpile) {
          enemySettlement.stockpile.food = 0;
          enemySettlement.stockpile.wood = 0;
          enemySettlement.stockpile.ore = 0;
        }

        // Scorch the entire settlement ground
        const ccx = Math.floor(enemySettlement.center.x);
        const ccy = Math.floor(enemySettlement.center.y);
        for (let dy = -6; dy <= 6; dy++) {
          for (let dx = -6; dx <= 6; dx++) {
            if (dx * dx + dy * dy <= 36 && world.scorchTile) {
              world.scorchTile(ccx + dx, ccy + dy, 200);
            }
          }
        }

        if (this.sim.eventBus) {
          this.sim.eventBus.emit("SETTLEMENT_RAZED", {
            settlementId: enemySettlement.id,
            name: enemySettlement.name,
            razer: warband.settlementName
          });
        }
        if (this.sim.chronicleSystem?.addEntry) {
          this.sim.chronicleSystem.addEntry(
            "SETTLEMENT_RAZED",
            `🔥 The city of ${enemySettlement.name} was wiped out and razed to ruins by ${warband.settlementName}! Its citizens have fallen and only smoking ruins and scorched earth remain.`
          );
        }
        if (this.sim.diplomacySystem) {
          this.sim.diplomacySystem.signPeace(warband.settlementId, enemySettlement.id, warband.settlementId, this.sim.clock.tick, "Total Annihilation & City Razed");
        }
      } else if (isConquest) {
        this.annexSettlement(warband.settlementId, enemySettlement.id);
        if (this.sim.diplomacySystem) {
          this.sim.diplomacySystem.signPeace(warband.settlementId, enemySettlement.id, warband.settlementId, this.sim.clock.tick, "Conquest & Annexation");
        }
      } else if (war?.isHolyWar) {
        if (this.sim.diplomacySystem) {
          this.sim.diplomacySystem.signPeace(warband.settlementId, enemySettlement.id, warband.settlementId, this.sim.clock.tick, "Religious Conversion Concordat");
        }
      } else {
        this.makeTributary(warband.settlementId, enemySettlement.id);
        if (this.sim.diplomacySystem) {
          this.sim.diplomacySystem.signPeace(warband.settlementId, enemySettlement.id, warband.settlementId, this.sim.clock.tick, "Tributary Vassalage");
        }
      }

      warband.state = "retreating";
    }
  }

  handleRetreating(warband, commander) {
    const home = this.sim.settlementSystem.settlements.get(warband.settlementId);
    if (!home) return;

    const distToHome = Math.hypot(commander.x - home.center.x, commander.y - home.center.y);
    if (distToHome < 4.0) {
      // Safely returned home with plunder cargo: unload into home stockpile
      if (home.stockpile && warband.plunderCargo) {
        const pFood = warband.plunderCargo.food || 0;
        const pWood = warband.plunderCargo.wood || 0;
        const pOre = warband.plunderCargo.ore || 0;
        if (pFood > 0 || pWood > 0 || pOre > 0) {
          home.stockpile.food = (home.stockpile.food || 0) + pFood;
          home.stockpile.wood = (home.stockpile.wood || 0) + pWood;
          home.stockpile.ore = (home.stockpile.ore || 0) + pOre;
          if (this.sim.eventBus) {
            this.sim.eventBus.emit("VICTORY_PLUNDER_UNLOADED", {
              warbandId: warband.id,
              settlementId: home.id,
              settlementName: home.name,
              food: pFood,
              wood: pWood,
              ore: pOre
            });
          }
          warband.plunderCargo = { food: 0, wood: 0, ore: 0 };
        }
      }
      this.demobilizeSettlement(warband.settlementId);
      return;
    }

    commander.moveToward(home.center, this.sim.world);
    this.keepSquadInFormation(warband, commander);
  }

  annexSettlement(victorId, defeatedId) {
    const victor = this.sim.settlementSystem?.settlements.get(victorId);
    const defeated = this.sim.settlementSystem?.settlements.get(defeatedId);
    if (!victor || !defeated) return;

    defeated.overlordId = victorId;
    defeated.vassalOf = victorId;
    defeated.status = "annexed";
    defeated.bannerColor = victor.bannerColor || "#ef4444";

    // Appoint governor from victor settlement
    const firstAgentId = victor.agentIds ? victor.agentIds.values().next().value : null;
    const commander = this.sim._agentById(firstAgentId);
    if (commander) {
      defeated.governorId = commander.id;
      defeated.governorName = commander.name;
    }

    // Citizens remember conquest
    if (defeated.agentIds) {
      for (const aId of defeated.agentIds) {
        const citizen = this.sim._agentById(aId);
        if (citizen && citizen.alive && typeof citizen.remember === "function") {
          citizen.remember("REALM_CONQUERED", this.sim.clock.tick, { overlordId: victorId });
        }
      }
    }

    if (this.sim.chronicleSystem?.addEntry) {
      this.sim.chronicleSystem.addEntry(
        "CONQUEST",
        `🏛️ ${defeated.name} has been annexed into the sovereign realm of ${victor.name}! Governor ${defeated.governorName || 'appointed magistrate'} has taken administration.`
      );
    }

    if (this.sim.eventBus) {
      this.sim.eventBus.emit("SETTLEMENT_ANNEXED", {
        victorId,
        victorName: victor.name,
        defeatedId,
        defeatedName: defeated.name,
        governorName: defeated.governorName
      });
    }
  }

  makeTributary(victorId, defeatedId) {
    const victor = this.sim.settlementSystem?.settlements.get(victorId);
    const defeated = this.sim.settlementSystem?.settlements.get(defeatedId);
    if (!victor || !defeated) return;

    defeated.tributeTo = victorId;
    defeated.tributeRate = 0.15;

    if (this.sim.chronicleSystem?.addEntry) {
      this.sim.chronicleSystem.addEntry(
        "TRIBUTARY_VASSALAGE",
        `📜 ${defeated.name} sued for peace and pledged 15% seasonal tribute to ${victor.name}.`
      );
    }

    if (this.sim.eventBus) {
      this.sim.eventBus.emit("TRIBUTARY_ESTABLISHED", {
        overlordId: victorId,
        overlordName: victor.name,
        vassalId: defeatedId,
        vassalName: defeated.name,
        rate: 0.15
      });
    }
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

  generateBattleName(setA, setB, x, y, index = 0) {
    const nameA = setA?.name || "The Frontier";
    const nameB = setB?.name || "The Border";
    const prefixes = ["Battle of", "Clash of", "The Slaughter at", "Siege of", "Assault upon", "The Bloodied Stand at", "The Field of"];
    const terrains = ["Ridge", "Hills", "Fields", "Gates", "Crossing", "Plains", "Ford", "Valley", "Redoubt"];
    const hash = Math.abs((Math.floor(x) * 31 + Math.floor(y) * 17 + index * 13) | 0);
    const prefix = prefixes[hash % prefixes.length];
    const terrain = terrains[(hash >> 2) % terrains.length];
    const chosenName = (hash % 2 === 0) ? nameA : nameB;
    return `${prefix} ${chosenName} ${terrain}`;
  }
}

