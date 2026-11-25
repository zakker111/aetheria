import { WorldState } from "../../core/worldState.js";
import { Resource } from "../resource.js";
import { getSettlementBuildingBonus } from "./settlementEconomy.js";

export function updateEvents(sim) {
  if (sim.clock.tick % 50 === 0) {
    const newEvent = sim.eventSystem.checkForNewEvents(
      sim.clock.tick,
      sim.agents,
      Array.from(sim.settlementSystem.settlements.values()),
      sim.world
    );

    if (newEvent) {
      sim.eventSystem.applyEventEffects(newEvent, sim);
      sim.eventBus.emit("EVENT_OCCURRED", newEvent);
    }
  }

  sim.eventSystem.updateActiveEvents(sim.clock.tick, sim);
}

export function updateFactions(sim) {
  if (sim.clock.tick % 100 === 0 && sim.agents.length > 10) {
    sim.factionSystem.checkForNewFactions(sim.agents, sim.relationshipSystem);
  }

  if (sim.clock.tick % 30 === 0) {
    sim.factionSystem.recruitMembers(
      sim.agents,
      sim.settlementSystem.settlements,
      sim.relationshipSystem
    );
  }

  if (sim.clock.tick % 50 === 0) {
    sim.factionSystem.updateDiplomacy();
  }

  if (sim.clock.tick % 20 === 0) {
    sim.factionSystem.processConflicts(sim.agents, sim.settlementSystem);
  }

  if (sim.clock.tick % 100 === 0) {
    sim.factionSystem.evolveBeliefs(sim.agents);
  }
}

export function updateResources(sim) {
  const season = sim.clock.getSeason();
  const seasonFertility = WorldState.seasonFertility(season);
  const weatherType = sim.weatherSystem?.currentWeather?.type;
  const isRaining = weatherType === "rain" || weatherType === "storm";
  const envBoost = (isRaining ? 1.6 : 1.0) * seasonFertility;

  for (const resource of sim.resources) {
    resource.update(envBoost, sim.world);
  }

  if (sim.groundItems.length > 0) {
    let writeIdx = 0;
    for (let i = 0; i < sim.groundItems.length; i++) {
      const it = sim.groundItems[i];
      it.update();
      if (!it.destroyed && it.total() > 0) {
        sim.groundItems[writeIdx++] = it;
      }
    }
    sim.groundItems.length = writeIdx;
  }

  if (sim.clock.tick % 30 === 0) {
    maintainWorldResources(sim);
  }
}

export function maintainWorldResources(sim) {
  if (sim.clock.tick % 300 === 0 && sim.resources.length > 0) {
    let rw = 0;
    for (let i = 0; i < sim.resources.length; i++) {
      const r = sim.resources[i];
      if (!r.destroyed) {
        sim.resources[rw++] = r;
      } else {
        sim.world.entityRegistry?.delete(r.id);
      }
    }
    sim.resources.length = rw;
  }

  let foodCount = 0;
  let woodCount = 0;
  let oreCount = 0;

  for (const r of sim.resources) {
    if (r.destroyed || r.depleted || r.amount <= 0) continue;
    if (r.resourceType === "food") foodCount++;
    else if (r.resourceType === "wood") woodCount++;
    else if (r.resourceType === "ore") oreCount++;
  }

  const season = sim.clock.getSeason();
  const fertility = WorldState.seasonFertility(season);
  const weatherType = sim.weatherSystem?.currentWeather?.type;
  const isRaining = weatherType === "rain" || weatherType === "storm";

  const targetWood = 150;
  if (woodCount < targetWood) {
    const needed = Math.max(1, Math.min(10, Math.round((targetWood - woodCount) * (isRaining ? 1.4 : 1.0) * fertility)));
    for (let k = 0; k < needed; k++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = Math.floor(sim._rng().next() * (sim.world.width - 4)) + 2;
        const y = Math.floor(sim._rng().next() * (sim.world.height - 4)) + 2;
        const terrain = sim.world.getTerrain(x, y);
        if (terrain && (terrain.biome === "forest" || terrain.biome === "jungle" || terrain.biome === "grassland") && sim.world.isWalkable(x, y)) {
          const entities = sim.world.getEntitiesAt(x, y);
          if (!entities.some((e) => e.type === "resource" || e.type === "building")) {
            const res = new Resource(x, y, "wood", 10, sim.idGen, { growthStage: "sapling", growthProgress: 12 });
            sim.resources.push(res);
            sim.world.addToSpatialIndex(x, y, res);
            woodCount++;
            break;
          }
        }
      }
    }
  }

  const targetFood = 140;
  if (foodCount < targetFood) {
    const needed = Math.max(1, Math.min(10, Math.round((targetFood - foodCount) * (isRaining ? 1.4 : 1.0) * fertility)));
    for (let k = 0; k < needed; k++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = Math.floor(sim._rng().next() * (sim.world.width - 4)) + 2;
        const y = Math.floor(sim._rng().next() * (sim.world.height - 4)) + 2;
        const terrain = sim.world.getTerrain(x, y);
        if (terrain && (terrain.biome === "grassland" || terrain.biome === "savanna" || terrain.biome === "beach" || terrain.biome === "forest") && sim.world.isWalkable(x, y)) {
          const entities = sim.world.getEntitiesAt(x, y);
          if (!entities.some((e) => e.type === "resource" || e.type === "building")) {
            const res = new Resource(x, y, "food", Math.floor(30 + sim._rng().next() * 25), sim.idGen);
            sim.resources.push(res);
            sim.world.addToSpatialIndex(x, y, res);
            foodCount++;
            break;
          }
        }
      }
    }
  }

  const targetOre = 48;
  if (oreCount < targetOre && (sim.clock.tick % 90 === 0)) {
    const needed = Math.min(2, targetOre - oreCount);
    for (let k = 0; k < needed; k++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = Math.floor(sim._rng().next() * (sim.world.width - 4)) + 2;
        const y = Math.floor(sim._rng().next() * (sim.world.height - 4)) + 2;
        const terrain = sim.world.getTerrain(x, y);
        if (terrain && (terrain.biome === "mountain" || terrain.biome === "highland" || terrain.biome === "tundra") && sim.world.isWalkable(x, y)) {
          const entities = sim.world.getEntitiesAt(x, y);
          if (!entities.some((e) => e.type === "resource" || e.type === "building")) {
            const res = new Resource(x, y, "ore", Math.floor(35 + sim._rng().next() * 25), sim.idGen, { exhaustionsRemaining: 1 });
            sim.resources.push(res);
            sim.world.addToSpatialIndex(x, y, res);
            oreCount++;
            break;
          }
        }
      }
    }
  }
}

export function updateBuildings(sim) {
  const tick = sim.clock.tick;
  const season = sim.clock.getSeason();
  const fertility = WorldState.seasonFertility(season);
  const settlements = sim.settlementSystem?.settlements;

  const windmillPowerBySettlement = new Map();
  if (settlements) {
    for (const sId of settlements.keys()) {
      windmillPowerBySettlement.set(sId, getSettlementBuildingBonus(sim, sId, "windmill").power);
    }
  }

  for (const building of sim.buildings) {
    if (!building) continue;
    if (typeof building.update === "function") building.update();
    if (!building.complete || building.isRuined) continue;

    const lvl = building.level || 1;
    const lvlMult = typeof building.getLevelMultiplier === "function" ? building.getLevelMultiplier() : (1 + (lvl - 1) * 0.45);
    const settlement = building.settlementId != null ? settlements?.get(building.settlementId) : null;

    if (building.buildingType === "farm") {
      const farmInterval = season === "winter"
        ? (lvl >= 3 ? 110 : lvl === 2 ? 150 : 200)
        : (lvl >= 3 ? 30 : lvl === 2 ? 40 : 50);
      if (tick % farmInterval === 0) {
        const wmPower = building.settlementId != null ? (windmillPowerBySettlement.get(building.settlementId) || 0) : 0;
        const cropCap = (lvl >= 2 || wmPower > 0) ? 4 : 3;
        let nearFood = 0;
        for (let r = 0; r < sim.resources.length; r++) {
          const res = sim.resources[r];
          if (!res.destroyed && !res.depleted && res.resourceType === "food" &&
              Math.abs(res.x - building.x) <= 4 && Math.abs(res.y - building.y) <= 4) {
            nearFood++;
            if (nearFood >= cropCap) break;
          }
        }
        if (nearFood < cropCap && sim.resources.length < 700) {
          const fx = Math.floor(building.x + (sim._rng().next() - 0.5) * 4);
          const fy = Math.floor(building.y + (sim._rng().next() - 0.5) * 4);
          if (fx >= 2 && fx < sim.world.width - 2 && fy >= 2 && fy < sim.world.height - 2 && sim.world.isWalkable(fx, fy)) {
            const entities = sim.world.getEntitiesAt(fx, fy);
            const hasFood = entities.some((e) => e.type === "resource" && e.resourceType === "food");
            if (!hasFood) {
              const wmMult = 1 + Math.min(0.9, wmPower * 0.3);
              const amount = Math.round(30 * fertility * lvlMult * wmMult);
              if (amount > 0) {
                const crop = new Resource(fx, fy, "food", amount, sim.idGen);
                sim.resources.push(crop);
                sim.world.addToSpatialIndex(fx, fy, crop);
              }
            }
          }
        }
      }
    }

    if (building.buildingType === "windmill" && tick % 60 === 0 && settlement && !settlement.ruined) {
      settlement.stockpile = settlement.stockpile || { food: 0, wood: 0, ore: 0 };
      settlement.stockpile.food = (settlement.stockpile.food || 0) + (3 + (lvl - 1) * 2);
    }

    if (building.buildingType === "granary" && lvl >= 2 && tick % 60 === 0 && settlement && !settlement.ruined) {
      settlement.stockpile = settlement.stockpile || { food: 0, wood: 0, ore: 0 };
      settlement.stockpile.food = (settlement.stockpile.food || 0) + (lvl - 1) * 2;
    }

    if (building.buildingType === "house" && tick % 40 === 0) {
      const restGain = 4 + (lvl - 1) * 2;
      const healGain = 2 + (lvl - 1);
      for (const a of sim.agents) {
        if (!a || !a.alive) continue;
        if (building.settlementId != null && a.settlementId !== building.settlementId) continue;
        if (Math.abs(a.x - building.x) <= 3.5 && Math.abs(a.y - building.y) <= 3.5) {
          if (a.needs) {
            a.needs.rest = Math.min(100, (a.needs.rest ?? 60) + restGain);
          }
          if ((a.health ?? 100) < 100) {
            a.health = Math.min(100, (a.health ?? 100) + healGain);
            if (a.needs) a.needs.health = a.health;
            if (a.combat) a.combat.health = a.health;
          }
        }
      }
    }

    if (building.buildingType === "inn" && tick % 40 === 0 && building.settlementId != null) {
      const restBoost = 6 + (lvl - 1) * 3;
      const socialBoost = 10 + (lvl - 1) * 5;
      for (const a of sim.agents) {
        if (!a || !a.alive || a.settlementId !== building.settlementId) continue;
        if (Math.hypot(a.x - building.x, a.y - building.y) <= 12) {
          if (a.needs) {
            a.needs.rest = Math.min(100, (a.needs.rest ?? 60) + restBoost);
            a.needs.social = Math.min(100, (a.needs.social ?? 60) + socialBoost);
          }
        }
      }
    }

    if (building.buildingType === "apothecary" && tick % 30 === 0 && building.settlementId != null) {
      const healAmt = lvl >= 3 ? 18 : lvl === 2 ? 12 : 7;
      for (const a of sim.agents) {
        if (!a || !a.alive || a.settlementId !== building.settlementId) continue;
        if ((a.health ?? 100) >= 100 && !a.wounded) continue;
        if (Math.hypot(a.x - building.x, a.y - building.y) <= 20) {
          a.health = Math.min(100, (a.health ?? 100) + healAmt);
          if (a.needs) a.needs.health = a.health;
          if (a.combat) a.combat.health = a.health;
          if (a.wounded && a.health >= 65) {
            a.wounded = false;
          }
        }
      }
    }

    if (building.buildingType === "bank" && tick % 90 === 0 && settlement && !settlement.ruined) {
      const div = lvl >= 3 ? 5 : lvl === 2 ? 3 : 2;
      const keys = ["food", "wood", "ore"];
      const resKey = keys[(Math.floor(tick / 90) + (building.id || 0)) % keys.length];
      settlement.stockpile = settlement.stockpile || { food: 0, wood: 0, ore: 0 };
      settlement.stockpile[resKey] = (settlement.stockpile[resKey] || 0) + div;
    }
  }
}

export function detonateNuclearStrike(
  sim,
  { x, y, attackerSettlementId = null, targetSettlementId = null, reason = "Strategic Nuclear Strike", isGodPower = false, isRetaliation = false } = {}
) {
  const tick = sim.clock?.tick ?? 0;
  const W = sim.world.width || 128;
  const H = sim.world.height || 128;
  const cx = Math.max(1, Math.min(W - 2, Math.floor(x ?? W / 2)));
  const cy = Math.max(1, Math.min(H - 2, Math.floor(y ?? H / 2)));

  const attacker = attackerSettlementId != null ? sim.settlementSystem?.settlements?.get(attackerSettlementId) : null;
  const target = targetSettlementId != null ? sim.settlementSystem?.settlements?.get(targetSettlementId) : null;
  const attackerEraId = attackerSettlementId != null
    ? (sim.civilizationAgeSystem?.getSettlementAge?.(attackerSettlementId)?.ageId || 6)
    : 7;
  const isNuclearAgeYield = attackerEraId >= 7 || isGodPower;

  const craterRadius = isNuclearAgeYield ? 6 : 5;
  const falloutRadius = isNuclearAgeYield ? 11 : 9;
  const fireBound = isNuclearAgeYield ? 5 : 4;
  const buildingRadius = isNuclearAgeYield ? 10.5 : 8.5;
  const coreRuinRadius = isNuclearAgeYield ? 5.5 : 4.5;
  const wallBreachRadius = isNuclearAgeYield ? 7.2 : 5.5;
  const vaporizeRadius = isNuclearAgeYield ? 6.0 : 4.5;
  const shockRadius = isNuclearAgeYield ? 13.5 : 10.5;

  sim.world.addCrater(cx, cy, craterRadius, 255);
  sim.world.addFallout(cx, cy, falloutRadius, 255);

  for (let dy = -fireBound; dy <= fireBound; dy++) {
    for (let dx = -fireBound; dx <= fireBound; dx++) {
      const d = Math.hypot(dx, dy);
      if (d >= 2 && d <= (fireBound + 0.4) && ((dx * dx + dy * dy + tick) % 3 === 0)) {
        const fx = cx + dx;
        const fy = cy + dy;
        if (fx >= 0 && fx < W && fy >= 0 && fy < H && sim.world.isWalkable(fx, fy)) {
          sim.world.startFire(fx, fy, 50);
        }
      }
    }
  }

  let buildingsRuined = 0;
  if (Array.isArray(sim.buildings)) {
    for (const b of sim.buildings) {
      if (!b || b.isRuined) continue;
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d <= buildingRadius) {
        const isMonument = Boolean(b.isHeritage || (typeof b.isMonument === "function" && b.isMonument()));
        if (isMonument && d > coreRuinRadius * 0.65 && typeof b.applyDamage === "function") {
          b.applyDamage(Math.round((b.maxHealth || 500) * 0.72), { cause: "nuclear_outer", tick, allowDestruction: false });
        } else {
          const dmg = d <= coreRuinRadius ? (b.maxHealth || 200) : Math.round((b.maxHealth || 200) * 0.7);
          b.health = Math.max(0, (b.health ?? 100) - dmg);
          if (b.health <= 0 || d <= coreRuinRadius) {
            b.health = 0;
            b.isRuined = true;
            b.ruinedAtTick = tick;
            buildingsRuined++;
            sim.eventBus.emit("building_destroyed", { building: b, cause: "nuclear_strike" });
          }
        }
      }
    }
  }

  if (sim.fortificationSystem?.segments?.size > 0) {
    const attackerLabel = attacker?.name || "Nuclear Blast";
    for (const seg of sim.fortificationSystem.segments.values()) {
      if (!seg || seg.state === "breach" || seg.hp <= 0) continue;
      const d = Math.hypot(seg.x + 0.5 - cx, seg.y + 0.5 - cy);
      if (d <= wallBreachRadius) {
        sim.fortificationSystem.damageSegment(seg, seg.maxHp + 100, attackerLabel, null, { silent: true });
      } else if (d <= buildingRadius) {
        const dmg = Math.round((seg.maxHp || 200) * 0.65);
        sim.fortificationSystem.damageSegment(seg, dmg, attackerLabel, null, { silent: true });
      }
    }
  }

  let casualties = 0;
  for (const a of sim.agents) {
    if (!a || !a.alive) continue;
    const d = Math.hypot(a.x - cx, a.y - cy);
    if (d <= vaporizeRadius) {
      if (!a._heirloomBequeathed && sim.ageSystem?._bequeathHeirloomOnDeath) {
        sim.ageSystem._bequeathHeirloomOnDeath(a);
      }
      a.health = 0;
      if (a.needs) a.needs.health = 0;
      if (a.combat) a.combat.health = 0;
      a.alive = false;
      a.deathCause = "nuclear_blast";
      if (typeof a.addLifeEvent === "function") {
        a.addLifeEvent("DEATH", "Vaporized in a nuclear detonation", tick, "☢️", true);
      }
      sim._recordDeadDossier(a, "nuclear_blast");
      casualties++;
    } else if (d <= shockRadius) {
      const dmg = Math.round((isNuclearAgeYield ? 80 : 65) - (d - vaporizeRadius) * 5);
      a.health = Math.max(0, (a.health ?? 100) - dmg);
      if (a.needs) a.needs.health = a.health;
      if (a.combat) a.combat.health = a.health;
      if (a.health <= 0) {
        if (!a._heirloomBequeathed && sim.ageSystem?._bequeathHeirloomOnDeath) {
          sim.ageSystem._bequeathHeirloomOnDeath(a);
        }
        a.alive = false;
        a.deathCause = "nuclear_blast";
        if (typeof a.addLifeEvent === "function") {
          a.addLifeEvent("DEATH", "Perished in the nuclear shockwave", tick, "☢️", true);
        }
        sim._recordDeadDossier(a, "nuclear_blast");
        casualties++;
      } else {
        if (typeof a.remember === "function") {
          a.remember("SURVIVED_NUKE", tick, { x: a.x, y: a.y, rep: -1 });
        }
        if (typeof a.addLifeEvent === "function") {
          a.addLifeEvent("NUKE", "Survived a blinding nuclear flash", tick, "☢️", true);
        }
      }
    }
  }

  if (sim.diplomacySystem && attacker && target && casualties > 0) {
    const war = sim.diplomacySystem.activeWars?.find((w) =>
      w.active &&
      ((w.attackerId === attacker.id && w.defenderId === target.id) ||
       (w.defenderId === attacker.id && w.attackerId === target.id))
    );
    if (war) {
      war.casualties = war.casualties || {};
      war.casualties[target.id] = (war.casualties[target.id] || 0) + casualties;
      war.weariness = war.weariness || {};
      war.weariness[target.id] = (war.weariness[target.id] || 0) + Math.min(35, casualties * 3);
    }
  }

  const blastTitle = target ? `Atomic Ground Zero: ${target.name}` : "Atomic Ground Zero";
  sim.world.addSkullMonument(blastTitle, cx, cy, Math.max(1, casualties), "nuke", tick);

  if (sim.warfareSystem && Array.isArray(sim.warfareSystem.combatEffects)) {
    sim.warfareSystem.combatEffects.push({
      type: "nuke",
      x: cx,
      y: cy,
      radius: isNuclearAgeYield ? 12 : 10,
      tick,
      duration: 55
    });
  }

  if (target) {
    let aliveTargetPop = 0;
    for (const a of sim.agents) {
      if (a && a.alive && a.settlementId === target.id) aliveTargetPop++;
    }
    if (aliveTargetPop === 0 && typeof sim.settlementSystem?.collapseSettlement === "function") {
      sim.settlementSystem.collapseSettlement(
        target.id,
        isGodPower ? "Obliterated by Divine Atomic Fire" : `Nuclear annihilation by ${attacker?.name || "a rival power"}`,
        attacker?.id ?? null,
        tick
      );
    } else if (buildingsRuined >= 3 && aliveTargetPop <= 2) {
      target.ruined = true;
      target.ruinsTicks = Math.max(target.ruinsTicks || 0, 20);
      target.collapseReason = `Devastated by atomic strike (${reason})`;
    }
  }

  if (sim.diplomacySystem) {
    if (attacker && sim.settlementSystem?.settlements) {
      for (const other of sim.settlementSystem.settlements.values()) {
        if (!other || other.id === attacker.id || other.ruined) continue;
        const rel = sim.diplomacySystem.getRelation(other.id, attacker.id);
        if (rel) {
          rel.score = Math.max(-100, (rel.score || 0) - 25);
        }
        sim.diplomacySystem.addGrievance(other.id, attacker.id, "Atomic Atrocity", 20);
      }
    }
    const actorIds = [];
    const actorNames = [];
    if (attacker) { actorIds.push(attacker.id); actorNames.push(attacker.name); }
    if (target) { actorIds.push(target.id); actorNames.push(target.name); }
    sim.diplomacySystem.recordDiplomaticEvent({
      tick,
      type: "nuke",
      outcome: isRetaliation ? "retaliated" : "detonated",
      title: isRetaliation
        ? `☢️ MAD Nuclear Retaliation on ${target?.name || `(${cx}, ${cy})`}`
        : target ? `Atomic Strike on ${target.name}` : `Nuclear Detonation (${cx}, ${cy})`,
      what: attacker
        ? `${attacker.name} detonated a nuclear warhead over ${target?.name || `(${cx}, ${cy})`}, killing ${casualties} and ruining ${buildingsRuined} buildings.`
        : `A nuclear detonation struck ${target?.name || `(${cx}, ${cy})`}, killing ${casualties} and ruining ${buildingsRuined} buildings.`,
      why: reason,
      drivers: [
        `${casualties} blast casualties · ${buildingsRuined} structures ruined`,
        `Persistent toxic fallout across radius ${falloutRadius}`,
        attacker ? `Global atomic outrage (-25 standing, +20 grievance)` : `Divine atomic reckoning`
      ],
      actors: actorIds,
      actorNames,
      x: cx,
      y: cy
    });
  }

  sim.eventBus.emit("NUCLEAR_STRIKE", {
    x: cx,
    y: cy,
    attackerId: attacker?.id ?? null,
    attackerName: attacker?.name || (isGodPower ? "Divine Wrath" : "Atomic Power"),
    targetId: target?.id ?? null,
    targetName: target?.name || "Frontier",
    reason,
    casualties,
    buildingsRuined,
    isGodPower,
    isRetaliation,
    tick
  });

  if (!isGodPower && !isRetaliation && target && attacker && !target.ruined && !attacker.ruined && attacker.id !== target.id && attacker.center) {
    const targetProg = sim.civilizationAgeSystem?.getNuclearProgram?.(target.id);
    if (targetProg && targetProg.unlocked && targetProg.warheads > 0 && (targetProg.lastRetaliationTick ?? -999) <= tick - 30) {
      targetProg.warheads = Math.max(0, targetProg.warheads - 1);
      targetProg.totalStrikes = (targetProg.totalStrikes || 0) + 1;
      targetProg.lastStrikeTick = tick;
      targetProg.lastRetaliationTick = tick;
      detonateNuclearStrike(sim, {
        x: attacker.center.x,
        y: attacker.center.y,
        attackerSettlementId: target.id,
        targetSettlementId: attacker.id,
        reason: `Mutual Assured Destruction (MAD) automatic nuclear counter-strike after ${attacker.name} hit ${target.name}`,
        isGodPower: false,
        isRetaliation: true,
      });
    }
  }

  return { x: cx, y: cy, casualties, buildingsRuined };
}
