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
    for (const [id, wb] of this.warbands) {
      if (wb.settlementId === settlementId && wb.active) {
        if (targetSettlementId && !wb.targetSettlementId) {
          wb.targetSettlementId = targetSettlementId;
          wb.role = role;
          wb.state = role === "defense" ? "defending" : "marching";
        }
        return wb;
      }
    }

    // Find eligible adult citizens to recruit
    const eligible = [];
    for (const aId of settlement.agentIds) {
      const a = this.sim.agents.find(ag => ag.id === aId && ag.alive);
      if (a && a.age >= 18 && a.age <= 55 && (a.needs.health || 100) > 40) {
        eligible.push(a);
      }
    }

    if (eligible.length === 0) return null;

    // Determine squad size: 30% to 50% of eligible population, minimum 2, maximum 8
    const squadSize = Math.max(2, Math.min(8, Math.floor(eligible.length * 0.4)));
    const recruited = eligible.slice(0, squadSize);

    // Pick commander (highest brave/industrious or elder)
    recruited.sort((a, b) => (b.personality?.brave ?? 0.5) - (a.personality?.brave ?? 0.5));
    const commander = recruited[0];

    const warbandId = this.nextWarbandId++;
    const formationType = role === "defense" ? "shield" : "wedge";

    // Equip soldiers with weapons and gear from settlement stockpile
    const hasOre = (settlement.stockpile?.ore ?? 0) >= 2;
    const hasWood = (settlement.stockpile?.wood ?? 0) >= 2;

    recruited.forEach((soldier, idx) => {
      soldier.militaryDuty = true;
      soldier.warbandId = warbandId;
      soldier.job = "soldier";
      soldier.combatRole = idx === 0 ? "commander" : (role === "defense" ? "shieldbearer" : "vanguard");
      
      // Weaponry and defense
      soldier.hasWeapon = hasOre || (soldier.inventory.tool_pickaxe || soldier.inventory.tool_axe);
      soldier.hasShield = role === "defense" || hasWood;
      
      if (!soldier.combat) {
        soldier.combat = {
          health: 100,
          maxHealth: 100,
          damage: soldier.hasWeapon ? 18 : 10,
          defense: soldier.hasShield ? 0.35 : 0.1,
          range: 1.8,
          attackCooldown: 0,
          attackSpeed: 45
        };
      } else {
        soldier.combat.damage = soldier.hasWeapon ? 18 : 10;
        soldier.combat.defense = soldier.hasShield ? 0.35 : 0.1;
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
    const commander = this.sim.agents.find(a => a.id === warband.commanderId && a.alive);
    if (!commander) return;

    const offsets = warband.formation === "shield" ? 
      [[-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [-1, 1], [1, 1]] :
      [[0, 0], [-1.5, 1.5], [1.5, 1.5], [-3, 3], [3, 3], [0, 2]];

    let idx = 0;
    for (const soldierId of warband.soldiers) {
      const soldier = this.sim.agents.find(a => a.id === soldierId && a.alive);
      if (soldier && soldier.id !== commander.id) {
        soldier.formationOffset = offsets[idx % offsets.length];
        idx++;
      }
    }
  }

  // Demobilize warbands for a settlement when peace is signed
  demobilizeSettlement(settlementId) {
    for (const [id, wb] of this.warbands) {
      if (wb.settlementId === settlementId && wb.active) {
        wb.active = false;
        wb.state = "disbanded";
        for (const sId of wb.soldiers) {
          const soldier = this.sim.agents.find(a => a.id === sId);
          if (soldier) {
            soldier.militaryDuty = false;
            soldier.warbandId = null;
            soldier.combatRole = null;
            soldier.job = "unemployed";
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

    // 2. Update active warbands
    for (const [id, warband] of this.warbands) {
      if (!warband.active) continue;
      this.updateWarband(warband);
    }
  }

  updateWarband(warband) {
    // Filter alive soldiers
    warband.soldiers = warband.soldiers.filter(id => {
      const a = this.sim.agents.find(ag => ag.id === id);
      return a && a.alive;
    });

    if (warband.soldiers.length === 0) {
      warband.active = false;
      warband.state = "destroyed";
      return;
    }

    // Ensure commander is alive
    let commander = this.sim.agents.find(a => a.id === warband.commanderId && a.alive);
    if (!commander) {
      const nextLead = this.sim.agents.find(a => warband.soldiers.includes(a.id) && a.alive);
      if (nextLead) {
        warband.commanderId = nextLead.id;
        commander = nextLead;
      } else {
        warband.active = false;
        return;
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
      const soldier = this.sim.agents.find(a => a.id === soldierId && a.alive);
      if (!soldier) continue;

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

    // Damage formula
    const rawDmg = attacker.combat.damage + (this.sim.world.rng.next() * 4 - 2);
    const def = defender.combat.defense || 0;
    const finalDmg = Math.max(2, Math.round(rawDmg * (1 - def)));

    defender.needs.health = Math.max(0, (defender.needs.health || 100) - finalDmg);
    if (defender.combat) defender.combat.health = defender.needs.health;

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
      
      // Record war casualty
      if (this.sim.diplomacySystem) {
        const defenderSettlementId = this.sim.settlementSystem.getAgentSettlement(defender.id)?.id;
        const war = this.sim.diplomacySystem.activeWars.find(w => 
          (w.attackerId === warband.settlementId && w.defenderId === defenderSettlementId) ||
          (w.defenderId === warband.settlementId && w.attackerId === defenderSettlementId)
        );
        if (war && defenderSettlementId) {
          war.casualties[defenderSettlementId] = (war.casualties[defenderSettlementId] || 0) + 1;
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
      const soldier = this.sim.agents.find(a => a.id === sId && a.alive);
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

    return this.sim.agents.filter(a => {
      if (!a.alive || a.id === agent.id) return false;
      const sid = a.settlementId || this.sim.settlementSystem.agentSettlementMap.get(a.id);
      if (!sid || !hostileSettlementIds.includes(sid)) return false;
      return Math.hypot(a.x - agent.x, a.y - agent.y) <= radius;
    });
  }
}
