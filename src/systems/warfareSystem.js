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

    // Era military doctrine (Eras 1-6: Stone -> Modern Tactical)
    const eraInfo = this.sim.civilizationAgeSystem?.getEraCombatDoctrine?.(settlementId) || { ageId: 1, doctrine: 'skirmish' };
    const eraId = eraInfo.ageId || 1;
    const doctrine = eraInfo.doctrine || 'skirmish';

    // Equip soldiers with weapons and gear from settlement stockpile
    const hasOre = (settlement.stockpile?.ore ?? 0) >= 2;
    const hasWood = (settlement.stockpile?.wood ?? 0) >= 2;
    // Forged weapons & shields in the stockpile are drawn deterministically
    // in recruitment order, scaled cleanly by civilization age.
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

      const isArtillerySlot = (eraId === 5 && recruited.length >= 4 && idx === recruited.length - 1) ||
                              (eraId >= 6 && recruited.length >= 3 && idx === recruited.length - 1);

      // Draw weaponry (stockpiles first, then era-modernized standard kit)
      let weaponType = "unarmed";
      let weaponDamage = 13 + (eraId - 1) * 3;
      let weaponRange = 1.9;
      let attackSpeed = Math.max(24, 38 - (eraId - 1) * 2);
      let splashRadius = 0;

      if (isArtillerySlot) {
        if (eraId >= 6) {
          weaponType = "artillery";
          weaponDamage = 56;
          weaponRange = 13.5;
          attackSpeed = 42;
          splashRadius = 3.0;
        } else {
          weaponType = "cannon";
          weaponDamage = 46;
          weaponRange = 11.5;
          attackSpeed = 50;
          splashRadius = 2.2;
        }
      } else if (swordStock > 0) {
        swordStock--;
        settlement.stockpile.weapon_sword = (settlement.stockpile.weapon_sword || 0) - 1;
        soldier.inventory.weapon_sword = (soldier.inventory.weapon_sword || 0) + 1;
        weaponType = "sword";
        weaponDamage = 34 + (eraId >= 5 ? 4 : eraId >= 3 ? 2 : 0);
        weaponRange = 1.9;
        attackSpeed = eraId >= 5 ? 26 : 30;
      } else if (spearStock > 0) {
        spearStock--;
        settlement.stockpile.weapon_spear = (settlement.stockpile.weapon_spear || 0) - 1;
        soldier.inventory.weapon_spear = (soldier.inventory.weapon_spear || 0) + 1;
        weaponType = "spear";
        weaponDamage = 28 + (eraId >= 5 ? 4 : eraId >= 3 ? 2 : 0);
        weaponRange = 2.3;
        attackSpeed = 34;
      } else if (bowStock > 0) {
        bowStock--;
        settlement.stockpile.weapon_bow = (settlement.stockpile.weapon_bow || 0) - 1;
        soldier.inventory.weapon_bow = (soldier.inventory.weapon_bow || 0) + 1;
        if (eraId >= 6) {
          weaponType = "rifle";
          weaponDamage = 44;
          weaponRange = 10.5;
          attackSpeed = 22;
        } else if (eraId === 5) {
          weaponType = "musket";
          weaponDamage = 38;
          weaponRange = 8.5;
          attackSpeed = 32;
        } else {
          weaponType = "bow";
          weaponDamage = 24 + (eraId >= 3 ? 3 : 0);
          weaponRange = 5.8;
          attackSpeed = 40;
        }
      } else if (eraId >= 6) {
        weaponType = "rifle";
        weaponDamage = 44;
        weaponRange = 10.5;
        attackSpeed = 22;
      } else if (eraId === 5) {
        weaponType = "musket";
        weaponDamage = 38;
        weaponRange = 8.5;
        attackSpeed = 32;
      } else {
        const hasTool = !!(soldier.inventory.tool_pickaxe || soldier.inventory.tool_axe);
        if (hasOre || hasTool || eraId >= 2) {
          weaponType = "improvised";
          weaponDamage = 20 + (eraId - 1) * 3;
          weaponRange = 1.9;
          attackSpeed = 35;
        }
      }

      // Draw shield / tactical vest armor
      let hasShield = false;
      let shieldDef = eraId >= 6 ? 0.16 : 0.0;
      let blockChance = 0.0;
      if (shieldStock > 0) {
        shieldStock--;
        settlement.stockpile.armor_shield = (settlement.stockpile.armor_shield || 0) - 1;
        soldier.inventory.armor_shield = (soldier.inventory.armor_shield || 0) + 1;
        hasShield = true;
        shieldDef = Math.max(shieldDef, 0.25);
        blockChance = 0.35;
      } else if (eraId < 5 && (role === "defense" || hasWood)) {
        hasShield = true;
        shieldDef = 0.15;
        blockChance = 0.20;
      }

      soldier.hasWeapon = weaponType !== "unarmed";
      soldier.hasShield = hasShield;

      // Assign tactical combat role
      if (idx === 0) {
        soldier.combatRole = "commander";
      } else if (weaponType === "cannon" || weaponType === "artillery") {
        soldier.combatRole = "artillery";
      } else if (weaponType === "rifle") {
        soldier.combatRole = "rifleman";
      } else if (weaponType === "musket") {
        soldier.combatRole = "musketeer";
      } else if (weaponType === "bow") {
        soldier.combatRole = "archer";
      } else if (hasShield && (role === "defense" || idx % 3 === 1)) {
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
      const hardening = 1 + Math.min(0.18, (soldier.veteranCampaigns ?? 1) > 1 ? ((soldier.veteranCampaigns ?? 1) - 1) * 0.06 : 0);
      let dmg = Math.round(weaponDamage * (0.85 + 0.2 * training) * hardening);
      if (isHolyWar) dmg = Math.round(dmg * 1.25); // Sacred zealot fervor!
      const def = Math.min(0.70, (hasShield ? (0.18 + shieldDef) : (0.08 + shieldDef)) + Math.min(0.15, (training - 1) * 0.05) + ((soldier.veteranCampaigns ?? 1) - 1) * 0.02);

      soldier.combat = {
        health: soldier.health ?? 100,
        maxHealth: 100,
        damage: dmg,
        defense: def,
        range: weaponRange,
        attackCooldown: 0,
        attackSpeed,
        weaponType,
        splashRadius,
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
      eraId,
      doctrine,
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
        role,
        eraId,
        doctrine
      });
    }

    return warband;
  }

  // Mobilize Loyalist and Rebel warbands for a dynastic Succession Crisis
  mobilizeCivilWar(dynasty, claimant, monarch) {
    const settlement = this.sim.settlementSystem?.settlements.get(dynasty.settlementId);
    if (!settlement || !settlement.agentIds || !claimant || !claimant.alive) return null;

    const pool = [];
    for (const aid of settlement.agentIds) {
      const a = this.sim._agentById(aid);
      if (a && a.alive && (a.age || 0) >= 18 && !a.wounded && a.id !== claimant.id && a.id !== monarch?.id && !a.militaryDuty) {
        pool.push(a);
      }
    }
    pool.sort((a, b) => ((b.skills?.combat || 1) + (b.personality?.brave || 0.5)) - ((a.skills?.combat || 1) + (a.personality?.brave || 0.5)) || (a.id - b.id));

    const rebels = [claimant];
    const loyalists = [];
    if (monarch && monarch.alive && !monarch.militaryDuty) loyalists.push(monarch);

    for (let i = 0; i < pool.length && (rebels.length < 4 || loyalists.length < 4); i++) {
      if (i % 2 === 0 && rebels.length < 4) rebels.push(pool[i]);
      else if (loyalists.length < 4) loyalists.push(pool[i]);
    }
    if (loyalists.length === 0 && rebels.length > 1) {
      loyalists.push(rebels.pop());
    }
    if (loyalists.length === 0) return null;

    const eraInfo = this.sim.civilizationAgeSystem?.getEraCombatDoctrine?.(dynasty.settlementId) || { ageId: 1, doctrine: 'skirmish' };
    const eraId = eraInfo.ageId || 1;
    const doctrine = eraInfo.doctrine || 'skirmish';

    const equipSoldier = (soldier, wbId, roleTag, isRebelSide) => {
      soldier.militaryDuty = true;
      soldier.warbandId = wbId;
      soldier.isRebel = isRebelSide;
      if (soldier.job !== 'soldier') {
        this.sim.economySystem?.agentJobs?.set(soldier.id, {
          job: soldier.job || 'unemployed',
          skillLevel: 1,
          experience: 0,
          assignedAt: this.sim.clock.tick
        });
      }
      soldier.job = "soldier";
      soldier.hasWeapon = true;
      soldier.hasShield = eraId < 5;
      const weaponType = eraId >= 6 ? "rifle" : eraId === 5 ? "musket" : "sword";
      const finalRole = roleTag === "commander" ? "commander" : eraId >= 6 ? "rifleman" : eraId === 5 ? "musketeer" : roleTag;
      soldier.combatRole = finalRole;
      const training = soldier.skills?.combat ?? 1.0;
      const baseDmg = eraId >= 6 ? 42 : eraId === 5 ? 36 : (26 + (eraId - 1) * 2);
      soldier.combat = {
        health: soldier.health ?? 100,
        maxHealth: 100,
        damage: Math.round(baseDmg * (0.85 + 0.15 * training)),
        defense: Math.min(0.65, (eraId >= 6 ? 0.24 : 0.22) + (training - 1) * 0.05),
        range: eraId >= 6 ? 10.5 : eraId === 5 ? 8.5 : 1.9,
        attackCooldown: 0,
        attackSpeed: eraId >= 6 ? 22 : eraId === 5 ? 32 : 30,
        weaponType,
        splashRadius: 0,
        hasShield: eraId < 5,
        blockChance: eraId < 5 ? 0.25 : 0.0,
        zealotFervor: false
      };
    };

    const rebelBandId = this.nextWarbandId++;
    rebels.forEach((s, idx) => equipSoldier(s, rebelBandId, idx === 0 ? "commander" : "vanguard", true));
    const rebelBand = {
      id: rebelBandId,
      settlementId: dynasty.settlementId,
      settlementName: `${claimant.name}'s Rebels`,
      bannerColor: "#dc2626",
      commanderId: claimant.id,
      soldiers: rebels.map(a => a.id),
      role: "assault",
      formation: "wedge",
      eraId,
      doctrine,
      state: "defending",
      targetSettlementId: dynasty.settlementId,
      marchTarget: { ...settlement.center },
      isCivilWar: true,
      civilWarSide: "rebel",
      dynastyId: dynasty.id,
      morale: 105,
      initialSize: rebels.length,
      active: true,
      plunderCargo: { food: 0, wood: 0, ore: 0 }
    };
    this.warbands.set(rebelBandId, rebelBand);

    const loyalBandId = this.nextWarbandId++;
    loyalists.forEach((s, idx) => equipSoldier(s, loyalBandId, idx === 0 ? "commander" : "shieldbearer", false));
    const loyalBand = {
      id: loyalBandId,
      settlementId: dynasty.settlementId,
      settlementName: `${settlement.name} Loyalists`,
      bannerColor: settlement.bannerColor || "#38bdf8",
      commanderId: loyalists[0].id,
      soldiers: loyalists.map(a => a.id),
      role: "defense",
      formation: "shield",
      eraId,
      doctrine,
      state: "defending",
      targetSettlementId: dynasty.settlementId,
      marchTarget: { ...settlement.center },
      isCivilWar: true,
      civilWarSide: "loyalist",
      dynastyId: dynasty.id,
      morale: 105,
      initialSize: loyalists.length,
      active: true,
      plunderCargo: { food: 0, wood: 0, ore: 0 }
    };
    this.warbands.set(loyalBandId, loyalBand);

    return { rebelWarbandId: rebelBandId, loyalistWarbandId: loyalBandId };
  }

  demobilizeCivilWar(dynastyId) {
    for (const wb of this.warbands.values()) {
      if (wb.isCivilWar && wb.dynastyId === dynastyId && wb.active) {
        wb.active = false;
        wb.state = "disbanded";
        for (const sId of wb.soldiers) {
          const soldier = this.sim._agentById(sId);
          if (soldier) {
            soldier.militaryDuty = false;
            soldier.warbandId = null;
            soldier.combatRole = null;
            soldier.isRebel = false;
            const rec = this.sim.economySystem?.getAgentJob?.(sId);
            if (rec && rec.job !== 'soldier') {
              soldier.job = rec.job;
              soldier.jobTitle = this.sim.economySystem.jobDefinitions[rec.job]?.name || rec.job;
            }
          }
        }
      }
    }
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
            soldier.embarked = false;
            soldier.vesselId = null;
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
    const tickNow = this.sim.clock?.tick ?? 0;
    if (this._enemySnapshot && this._enemySnapshot.tick === tickNow) {
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
    this._enemySnapshot = { tick: tickNow, buckets };
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

    // Check if in range of any enemy soldier (disembarked only)
    if (!warband.embarked) {
      const nearbyEnemy = this.findNearbyEnemy(commander, warband.settlementId, 8.0);
      if (nearbyEnemy) {
        warband.state = "engaging";
        return;
      }
    }

    // Check if reached enemy settlement center for siege
    const distToCenter = Math.hypot(commander.x - targetSettlement.center.x, commander.y - targetSettlement.center.y);
    if (distToCenter < 5.0 && !warband.embarked) {
      warband.state = "sieging";
      return;
    }

    // Amphibious embarkation when crossing rivers or coastal waters
    if (warband.embarked) {
      return; // NavalSystem steers the raid vessel and embarked troops
    }
    if (this.sim.navalSystem?.tryEmbarkWarband(warband, commander, targetSettlement.center)) {
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
    const searchRadius = (warband.eraId || 1) >= 5 ? 18.0 : 14.0;
    const enemies = this.getAllNearbyEnemies(commander, warband.settlementId, searchRadius);
    if (enemies.length === 0) {
      // Revert to marching or defending
      warband.state = warband.role === "defense" ? "defending" : "marching";
      return;
    }

    const tickNow = this.sim.clock?.tick ?? 0;

    // Collect friendly ranged/artillery positions for shieldbearer screening
    const rangedAllies = [];
    for (const sid of warband.soldiers) {
      const a = this.sim._agentById(sid);
      if (a && a.alive && !a.wounded && (a.combatRole === "archer" || a.combatRole === "musketeer" || a.combatRole === "rifleman" || a.combatRole === "artillery")) {
        rangedAllies.push(a);
      }
    }

    // Tactical engagement per soldier role
    for (const soldierId of warband.soldiers) {
      const s = this.sim._agentById(soldierId);
      const soldier = (s && s.alive) ? s : null;
      if (!soldier) continue;

      // Wounded soldiers break off the line and limp home slowly (alternate ticks)
      if (soldier.wounded) {
        if ((tickNow & 1) === 0) {
          const homeW = this.sim.settlementSystem.settlements.get(warband.settlementId);
          if (homeW) soldier.moveToward(homeW.center, this.sim.world);
        }
        continue;
      }

      const role = soldier.combatRole || "vanguard";
      const range = soldier.combat?.range ?? 1.9;
      const isRangedUnit = role === "archer" || role === "musketeer" || role === "rifleman" || role === "artillery" || range >= 4.0;

      let nearest = null;
      let minDist = Infinity;
      let focusTarget = null;
      let bestFocusScore = Infinity;

      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(soldier.x - e.x, soldier.y - e.y);
        if (d < minDist) {
          minDist = d;
          nearest = e;
        }
        // Ranged/modernized units focus-fire wounded enemies inside engagement envelope
        const focusScore = d + ((e.health ?? 100) * (isRangedUnit ? 0.08 : 0.03));
        if (focusScore < bestFocusScore) {
          bestFocusScore = focusScore;
          focusTarget = e;
        }
      }

      if (!nearest) continue;

      if (isRangedUnit) {
        const target = (focusTarget && Math.hypot(soldier.x - focusTarget.x, soldier.y - focusTarget.y) <= range + 2.0)
          ? focusTarget
          : nearest;
        const targetDist = Math.hypot(soldier.x - target.x, soldier.y - target.y);
        const minSafeDist = role === "artillery" ? 4.8 : Math.min(4.2, range * 0.45);

        // Tactical standoff: kite backwards if enemies close inside safe range
        if (minDist < minSafeDist && this.sim.world) {
          const dx = soldier.x - nearest.x;
          const dy = soldier.y - nearest.y;
          const norm = Math.hypot(dx, dy) || 1;
          const retreatTarget = {
            x: Math.max(2, Math.min(this.sim.world.width - 3, soldier.x + (dx / norm) * 2.5)),
            y: Math.max(2, Math.min(this.sim.world.height - 3, soldier.y + (dy / norm) * 2.5))
          };
          if (this.sim.world.isWalkable(Math.floor(retreatTarget.x), Math.floor(retreatTarget.y))) {
            soldier.moveToward(retreatTarget, this.sim.world);
          }
          // Still fire volley if target remains within range
          if (targetDist <= range) {
            this.executeMeleeAttack(soldier, target, warband);
          }
        } else if (targetDist <= range) {
          // Hold tactical firing line & engage
          this.executeMeleeAttack(soldier, target, warband);
        } else {
          // Advance into firing envelope
          soldier.moveToward(target, this.sim.world);
        }
      } else {
        // Shieldbearers screen allies under close threat; vanguard charges nearest
        let engageTarget = focusTarget || nearest;
        if (role === "shieldbearer" && rangedAllies.length > 0) {
          let threatEnemy = null;
          let threatDist = Infinity;
          for (const ally of rangedAllies) {
            for (const e of enemies) {
              if (!e.alive) continue;
              const dToAlly = Math.hypot(ally.x - e.x, ally.y - e.y);
              if (dToAlly < 4.5 && dToAlly < threatDist) {
                threatDist = dToAlly;
                threatEnemy = e;
              }
            }
          }
          if (threatEnemy) engageTarget = threatEnemy;
        }
        const tDist = Math.hypot(soldier.x - engageTarget.x, soldier.y - engageTarget.y);
        if (tDist <= range) {
          this.executeMeleeAttack(soldier, engageTarget, warband);
        } else {
          soldier.moveToward(engageTarget, this.sim.world);
        }
      }
    }
  }

  executeMeleeAttack(attacker, defender, warband) {
    if (!attacker || !defender || !defender.alive) return;
    if (!attacker.combat) attacker.combat = { damage: 18, defense: 0.1, attackCooldown: 0, attackSpeed: 36 };
    if (!defender.combat) defender.combat = { damage: 14, defense: 0.1, attackCooldown: 0, attackSpeed: 36, health: defender.health ?? 100 };

    if (attacker.combat.attackCooldown > 0) {
      attacker.combat.attackCooldown--;
      return;
    }

    attacker.combat.attackCooldown = attacker.combat.attackSpeed || 35;

    // Fighting trains soldiers — combat skill rises with experience
    if (attacker.gainSkill) attacker.gainSkill("combat", 0.02, 5, 1, this.sim.clock?.tick ?? 0);
    const veteranBonus = 1 + Math.min(0.3, ((attacker.skills?.combat ?? 1.0) - 1.0) * 0.1);

    // Commander rally aura (+15% damage within 7 tiles of alive warband commander)
    let rallyBonus = 1.0;
    if (warband?.commanderId && warband.commanderId !== attacker.id) {
      const cmd = this.sim._agentById(warband.commanderId);
      if (cmd && cmd.alive && Math.hypot(attacker.x - cmd.x, attacker.y - cmd.y) <= 7.0) {
        rallyBonus = 1.15;
      }
    }

    // Critical strike & execute bonus vs weakened enemies (< 45 HP)
    const isCrit = this.sim.world.rng.next() < 0.22;
    const executeBonus = (defender.health ?? 100) < 45 ? 8 : 0;
    const critMul = isCrit ? 1.45 : 1.0;

    // Damage formula
    const variance = this.sim.world.rng.next() * 4 - 2;
    const rawDmg = (attacker.combat.damage * veteranBonus * rallyBonus + executeBonus + variance) * critMul;
    const def = defender.combat.defense || 0;
    let finalDmg = Math.max(4, Math.round(rawDmg * (1 - def)));

    // Shield deflection / block check (reduced block vs gunfire/artillery)
    const wType = attacker.combat.weaponType || "unarmed";
    const isGunfire = wType === "musket" || wType === "rifle" || wType === "cannon" || wType === "artillery";
    const hasShield = defender.combat?.hasShield || defender.hasShield;
    const rawBlock = defender.combat?.blockChance ?? (hasShield ? 0.25 : 0.0);
    const blockChance = isGunfire ? rawBlock * 0.25 : rawBlock;
    const blocked = hasShield && (this.sim.world.rng.next() < blockChance);
    if (blocked) {
      finalDmg = Math.max(2, Math.round(finalDmg * 0.5));
      this.combatEffects.push({
        x: (attacker.x + defender.x) / 2,
        y: (attacker.y + defender.y) / 2,
        type: "shield_block",
        duration: 15
      });
    }

    const tickNow = this.sim.clock?.tick ?? 0;

    // Apply damage cleanly and suppress passive regen while in active battle
    defender.health = Math.max(0, (defender.health ?? 100) - finalDmg);
    defender.needs.health = defender.health;
    defender._lastCombatTick = tickNow;
    if (defender.combat) defender.combat.health = defender.health;

    // Visual projectile / clash / artillery effect
    let fxType = "clash";
    if (wType === "cannon" || wType === "artillery") fxType = "artillery_shell";
    else if (wType === "rifle") fxType = "tracer_fire";
    else if (wType === "musket") fxType = "musket_shot";
    else if (wType === "bow") fxType = "arrow";

    if (!blocked) {
      this.combatEffects.push({
        x: (attacker.x + defender.x) / 2,
        y: (attacker.y + defender.y) / 2,
        fromX: attacker.x,
        fromY: attacker.y,
        toX: defender.x,
        toY: defender.y,
        type: fxType,
        duration: 15
      });
    }

    // Artillery / Cannon AOE splash damage against clustered enemies
    const splashRad = attacker.combat.splashRadius || 0;
    if (splashRad > 0) {
      this.combatEffects.push({
        x: defender.x,
        y: defender.y,
        type: "explosion",
        duration: 20
      });
      const nearbyTargets = this.getAllNearbyEnemies(attacker, warband.settlementId, (attacker.combat.range || 12) + splashRad);
      let hitCount = 0;
      for (const adj of nearbyTargets) {
        if (!adj.alive || adj.id === defender.id) continue;
        if (Math.hypot(adj.x - defender.x, adj.y - defender.y) <= splashRad) {
          const splashDmg = Math.max(5, Math.round(finalDmg * 0.45));
          adj.health = Math.max(0, (adj.health ?? 100) - splashDmg);
          adj.needs.health = adj.health;
          adj._lastCombatTick = tickNow;
          if (adj.combat) adj.combat.health = adj.health;
          if (adj.needs.health <= 0) {
            this._recordCombatKill(attacker, adj, warband);
          }
          if (++hitCount >= 2) break;
        }
      }
    }

    if (defender.needs.health <= 0) {
      this._recordCombatKill(attacker, defender, warband);
    } else if (defender.alive && defender.militaryDuty && defender.health < 35) {
      // Surviving gravely wounded soldiers limp off the line (or get captured as POW)
      defender.wounded = true;
      const vBand = this.warbands.get(defender.warbandId);
      if (vBand) vBand.morale = Math.max(0, vBand.morale - 2);

      if (!defender.captive && (this.sim._rng().next() < 0.30)) {
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
  }

  _recordCombatKill(attacker, defender, warband) {
    if (!defender || !defender.alive) return;
    defender.alive = false;
    defender.deathCause = "combat";
    defender.health = 0;
    defender.needs.health = 0;

    if (attacker) {
      attacker.kills = (attacker.kills || 0) + 1;
      attacker.battlesFought = (attacker.battlesFought || 0) + 1;
      if (!attacker.epithet) {
        if (attacker.kills >= 5) attacker.epithet = "the Dreaded";
        else if (attacker.kills >= 3) attacker.epithet = "the Slayer";
        else if (attacker.kills >= 2) attacker.epithet = "the Fierce";
        else attacker.epithet = "the Blooded";
      }
      if (attacker.kills >= 3 && !attacker.legendaryWeapon) {
        const relicNames = ["Oathkeeper", "Dawnbreaker", "Bloodthorn", "Ashfang", "Kingsbane", "Ironcrown", "Stormbrand", "Grimfang"];
        attacker.legendaryWeapon = relicNames[(Number(attacker.id) || 0) % relicNames.length];
      }
    }
    defender.battlesFought = (defender.battlesFought || 0) + 1;

    // Scavengable gear left behind on the field
    this.sim.dropInventoryOnGround(defender);

    // Civil war casualty tracking & immediate resolution if claimant/monarch fell
    if (warband?.isCivilWar && this.sim.dynastySystem) {
      const dyn = this.sim.dynastySystem.dynasties.get(warband.dynastyId);
      if (dyn?.civilWar?.active) {
        if (warband.civilWarSide === "rebel") dyn.civilWar.loyalistCasualties = (dyn.civilWar.loyalistCasualties || 0) + 1;
        else dyn.civilWar.rebelCasualties = (dyn.civilWar.rebelCasualties || 0) + 1;

        if (defender.id === dyn.civilWar.claimantId) {
          this.sim.dynastySystem.resolveCivilWar(dyn, "loyalist_victory");
        } else if (defender.id === dyn.monarchId) {
          this.sim.dynastySystem.resolveCivilWar(dyn, "usurpation");
        }
      }
    }

    // Morale swing
    const killerBand = attacker?.warbandId ? this.warbands.get(attacker.warbandId) : warband;
    const victimBand = defender.warbandId ? this.warbands.get(defender.warbandId) : null;
    if (killerBand) killerBand.morale = Math.min(100, (killerBand.morale ?? 100) + 4);
    if (victimBand) victimBand.morale = Math.max(0, (victimBand.morale ?? 100) - 6);

    // Record war casualty & weariness
    let battleName = "the Front Line";
    if (this.sim.diplomacySystem && warband) {
      const defenderSettlementId = this.sim.settlementSystem.getAgentSettlement(defender.id)?.id;
      const war = this.sim.diplomacySystem.activeWars.find(w =>
        (w.attackerId === warband.settlementId && w.defenderId === defenderSettlementId) ||
        (w.defenderId === warband.settlementId && w.attackerId === defenderSettlementId)
      );
      if (war && defenderSettlementId) {
        war.casualties[defenderSettlementId] = (war.casualties[defenderSettlementId] || 0) + 1;
        war.weariness = war.weariness || {};
        war.weariness[defenderSettlementId] = (war.weariness[defenderSettlementId] || 0) + 12;
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
        killerId: attacker?.id ?? null,
        killerName: attacker?.name || warband?.settlementName || "Raiders",
        killerEpithet: attacker?.epithet || null,
        victimId: defender.id,
        victimName: defender.name,
        victimSettlementId: this.sim.settlementSystem.getAgentSettlement(defender.id)?.id,
        battleName,
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

    let hasArtillery = false;
    for (const sid of warband.soldiers) {
      const s = this.sim._agentById(sid);
      if (s && s.alive && s.combatRole === "artillery") {
        hasArtillery = true;
        break;
      }
    }

    // Multi-stage siege progression (accelerated with cannon/artillery bombardment)
    warband.siegeTicks = (warband.siegeTicks || 0) + (hasArtillery ? 2 : 1);
    if (hasArtillery) {
      this.combatEffects.push({
        x: enemySettlement.center.x,
        y: enemySettlement.center.y,
        type: "explosion",
        duration: 20
      });
      this.combatEffects.push({
        x: commander.x,
        y: commander.y,
        fromX: commander.x,
        fromY: commander.y,
        toX: enemySettlement.center.x,
        toY: enemySettlement.center.y,
        type: "artillery_shell",
        duration: 15
      });
    }

    if (warband.siegeTicks < 3) {
      warband.siegeStage = "encirclement";
    } else if (warband.siegeTicks < 6) {
      warband.siegeStage = "breach";
      warband.hasRam = true;
    } else {
      warband.siegeStage = "assault";
    }

    // Storming/bombardment inflicts garrison & defender fatalities during breach/assault
    if (warband.siegeTicks >= 4 && enemySettlement.agentIds && enemySettlement.agentIds.size > 0) {
      let stormKills = 0;
      const maxStormKills = hasArtillery ? 2 : 1;
      for (const did of enemySettlement.agentIds) {
        if (stormKills >= maxStormKills) break;
        const victim = this.sim._agentById(did);
        if (victim && victim.alive && (victim.age ?? 20) >= 16) {
          this._recordCombatKill(commander, victim, warband);
          stormKills++;
        }
      }
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
            world.startFire(Math.floor(b.x), Math.floor(b.y), 40);
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
        world.startFire(ccx + 1, ccy, 35);
        world.startFire(ccx, ccy + 1, 35);
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
              world.startFire(Math.floor(b.x), Math.floor(b.y), 45);
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
              if (world.startFire) world.startFire(Math.floor(b.x), Math.floor(b.y), 45);
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

    if (warband.embarked) {
      return; // NavalSystem steers the returning raid vessel
    }
    if (this.sim.navalSystem?.tryEmbarkWarband(warband, commander, home.center)) {
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
    if (warband.embarked) return;
    for (const sId of warband.soldiers) {
      if (sId === commander.id) continue;
      const s = this.sim._agentById(sId);
      const soldier = (s && s.alive && !s.embarked) ? s : null;
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
    const out = [];
    const r2 = radius * radius;

    // Civil war opponents (rebel vs loyalist inside same realm)
    const myBand = agent.warbandId ? this.warbands.get(agent.warbandId) : null;
    if (myBand?.isCivilWar) {
      for (const wb of this.warbands.values()) {
        if (!wb.active || !wb.isCivilWar || wb.dynastyId !== myBand.dynastyId || wb.civilWarSide === myBand.civilWarSide) continue;
        for (const sId of wb.soldiers) {
          const a = this.sim._agentById(sId);
          if (!a || !a.alive || a.id === agent.id) continue;
          const dx = a.x - agent.x;
          const dy = a.y - agent.y;
          if (dx * dx + dy * dy <= r2) out.push(a);
        }
      }
    }

    if (!this.sim.diplomacySystem) return out;
    const hostileSettlementIds = this.sim.diplomacySystem.getEnemies(mySettlementId);
    if (hostileSettlementIds.length === 0) return out;

    // Perf: scan only the agents currently in combat (bucketed by settlement
    // once per tick) instead of filtering the entire roster on every call.
    // Only in-combat agents can appear in a filter result anyway, and bucket
    // order mirrors roster order, so output is identical to the old scan.
    const snapshot = this._getEnemySnapshot();
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

