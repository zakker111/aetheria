import { BUILDING_METADATA } from "../../core/constants.js";
import { Building } from "../building.js";
import { EconomySystem } from "../../systems/economySystem.js";
import { formatAgentFullName } from "../agent.js";

export function updateEnvironment(sim) {
  // Season transitions: log to chronicle + emit event (pure clock math —
  // deterministic and save-safe).
  if (sim.clock.seasonChanged()) {
    const season = sim.clock.getSeason();
    sim.eventBus.emit("SEASON_CHANGED", { season, year: sim.clock.getYear(), tick: sim.clock.tick });

    // Phase 3b Step 5: seasonal tribute collection for tributary/vassal settlements
    if (sim.settlementSystem?.settlements) {
      for (const vassal of sim.settlementSystem.settlements.values()) {
        if (vassal.tributeTo && vassal.tributeUntil && sim.clock.tick >= vassal.tributeUntil) {
          vassal.tributeTo = null;
          vassal.overlordId = null;
          vassal.tributeUntil = 0;
          continue;
        }
        if (vassal.tributeTo) {
          const overlord = sim.settlementSystem.settlements.get(vassal.tributeTo);
          if (overlord && overlord.stockpile && vassal.stockpile) {
            const rate = vassal.tributeRate || 0.15;
            const tributeFood = Math.floor((vassal.stockpile.food || 0) * rate);
            const tributeOre = Math.floor((vassal.stockpile.ore || 0) * rate);
            if (tributeFood > 0 || tributeOre > 0) {
              vassal.stockpile.food = Math.max(0, (vassal.stockpile.food || 0) - tributeFood);
              vassal.stockpile.ore = Math.max(0, (vassal.stockpile.ore || 0) - tributeOre);
              overlord.stockpile.food = (overlord.stockpile.food || 0) + tributeFood;
              overlord.stockpile.ore = (overlord.stockpile.ore || 0) + tributeOre;
              sim.eventBus.emit("TRIBUTE_PAID", {
                vassalId: vassal.id,
                vassalName: vassal.name,
                overlordId: overlord.id,
                overlordName: overlord.name,
                food: tributeFood,
                ore: tributeOre,
                season
              });
            }
          }
        }
      }
    }
  }

  // Dynamic Weather System (Rain, Storms, Lightning, Droughts)
  if (sim.weatherSystem) {
    sim.weatherSystem.update(sim.clock.tick);
  }

  // Persistent Nuclear Fallout & Radiation Sickness (must run independently of active fires)
  if (sim.world._radiationActive && sim.world.radiationTiles) {
    sim.world.updateRadiation(sim.clock.tick);
    if ((sim.clock.tick & 7) === 0) {
      const tick = sim.clock.tick;
      for (const a of sim.agents) {
        if (!a.alive) continue;
        const rad = sim.world.getRadiation(a.x, a.y);
        if (rad > 15) {
          const dmg = Math.max(1, Math.round(rad / 45));
          a.health = Math.max(0, (a.health ?? 100) - dmg);
          if (a.needs) a.needs.health = a.health;
          if (a.combat) a.combat.health = a.health;
          if (a.health <= 0) {
            a.alive = false;
            a.deathCause = "radiation";
            if (typeof a.addLifeEvent === "function") {
              a.addLifeEvent("DEATH", "Succumbed to lethal atomic radiation", tick, "☢️", true);
            }
          } else {
            const lastRad = a._lastRadEventTick ?? -999;
            if (tick - lastRad >= 60) {
              a._lastRadEventTick = tick;
              if (typeof a.remember === "function") {
                a.remember("SURVIVED_NUKE", tick, { x: a.x, y: a.y, rep: -1 });
              }
              if (typeof a.addLifeEvent === "function") {
                a.addLifeEvent("RADIATION", "Endured toxic nuclear fallout", tick, "☢️", false);
              }
            }
          }
        }
      }
      if (sim.resources) {
        for (const res of sim.resources) {
          if (res.destroyed || res.depleted) continue;
          if (res.resourceType === "food" || res.resourceType === "wood") {
            const rad = sim.world.getRadiation(res.x, res.y);
            if (rad > 90) {
              res.amount = Math.max(0, (res.amount || 10) - 3);
              if (res.amount <= 0) {
                res.destroyed = true;
                sim.world.scorchTile(Math.floor(res.x), Math.floor(res.y), 140);
              }
            }
          }
        }
      }
    }
  }

  // Perf: fire layer only matters while something burns. Skip the full-map
  // scan entirely when there are no active fires (common case). Fires can
  // only be created via world.startFire(), which sets _fireActive.
  if (!sim.world.fireTiles) return;
  if (!sim._fireActive && sim.burningTileCount === 0) return;
  sim.burningTileCount = sim.world.updateFires(sim.clock.tick);
  if (sim.burningTileCount > 0) sim._fireActive = true;
  else sim._fireActive = false;
  // Fires destroy buildings on burning tiles, scorch the earth, and consume resources
  if (sim.burningTileCount > 0) {
    if (sim.buildings) {
      for (const b of sim.buildings) {
        if (!b.isRuined && b.health > 0 && sim.world.isBurning(Math.floor(b.x), Math.floor(b.y))) {
          const destroyed = typeof b.applyDamage === "function"
            ? b.applyDamage(2, { cause: "fire", tick: sim.clock.tick })
            : (() => { b.health -= 2; return b.health <= 0; })();
          if (destroyed || b.health <= 0) {
            b.health = 0;
            b.isRuined = true;
            b.ruinedAtTick = sim.clock.tick;
            sim.world.scorchTile(Math.floor(b.x), Math.floor(b.y), 255);
            sim.eventBus.emit("building_destroyed", { building: b, cause: "fire" });
            // Memory: agents whose home burns remember the loss (ghost-quarter bias later).
            for (const a of sim.agents) {
              if (a.alive && a.homeId === b.id && typeof a.remember === "function") {
                a.remember("SACKED_HOME", sim.clock.tick, { x: b.x, y: b.y, rep: -1 });
              }
            }
          }
        }
      }
    }

    // Fires incinerate combustible resources (forests, crops, lumber piles)
    if (sim.resources) {
      for (const res of sim.resources) {
        if (res.destroyed) continue;
        if (res.resourceType === "wood" || res.resourceType === "food") {
          const rx = Math.floor(res.x);
          const ry = Math.floor(res.y);
          if (sim.world.isBurning(rx, ry)) {
            res.amount = (res.amount || 10) - 2;
            if (res.amount <= 0) {
              res.destroyed = true;
              sim.world.scorchTile(rx, ry, 220);
              sim.eventBus.emit("resource_depleted", { resource: res, cause: "fire" });
            }
          }
        }
      }
    }

    // Burning settlement centers/warehouses consume stockpiled supplies
    if (sim.settlementSystem?.settlements) {
      for (const s of sim.settlementSystem.settlements.values()) {
        if (!s.center || !s.stockpile) continue;
        const cx = Math.floor(s.center.x);
        const cy = Math.floor(s.center.y);
        if (sim.world.isBurning(cx, cy)) {
          if (s.stockpile.food > 0) s.stockpile.food = Math.max(0, s.stockpile.food - 0.5);
          if (s.stockpile.wood > 0) s.stockpile.wood = Math.max(0, s.stockpile.wood - 0.5);
          sim.world.scorchTile(cx, cy, 180);
        }
      }
    }
  }
  // Memory: agents standing next to fire remember surviving it (once per burn spell).
  if (sim.burningTileCount > 0) {
    for (const a of sim.agents) {
      if (!a.alive || typeof a.remember !== "function") continue;
      const lastFire = a.memories?.length ? a.memories[a.memories.length - 1] : null;
      if (lastFire && lastFire.type === "SURVIVED_FIRE" && sim.clock.tick - lastFire.tick < 60) continue;
      if (sim.world.isBurning(Math.floor(a.x), Math.floor(a.y)) ||
          sim.world.isBurning(Math.floor(a.x) + 1, Math.floor(a.y)) ||
          sim.world.isBurning(Math.floor(a.x) - 1, Math.floor(a.y)) ||
          sim.world.isBurning(Math.floor(a.x), Math.floor(a.y) + 1) ||
          sim.world.isBurning(Math.floor(a.x), Math.floor(a.y) - 1)) {
        a.remember("SURVIVED_FIRE", sim.clock.tick, { x: a.x, y: a.y });
        if (typeof a.addLifeEvent === "function") {
          a.addLifeEvent("SURVIVED_FIRE", "Braved a raging settlement blaze", sim.clock.tick, "🔥", false);
        }
      }
    }
  }
}

export function updateSettlements(sim) {
  // Detect and update settlements every 10 ticks
  if (sim.clock.tick % 10 === 0) {
    const clusters = sim.settlementSystem.detectSettlements(sim.agents, sim.world);
    sim.settlementSystem.updateSettlements(clusters, sim.agents);

    // Try to assign homes to settled agents
    for (const cluster of clusters) {
      for (const agent of cluster) {
        const settlement = sim.settlementSystem.getAgentSettlement(agent.id);
        if (settlement && !sim.settlementSystem.getAgentHome(agent.id)) {
          // Agent claims a home near their position
          sim.settlementSystem.claimHome(agent.id, agent.x, agent.y, settlement.id);
        }
      }
    }

    // Close large peaceful cities periodically unite into a Metropolis
    if (sim.clock.tick % 100 === 0) {
      sim.settlementSystem.mergeCloseBigCities?.(sim.clock.tick);
    }

    // Autonomous demolition & salvage: clear ruined non-monument structures and spent central mine husks
    if (sim.clock.tick % 40 === 0 && sim.buildings.length > 0) {
      const pruneIds = new Set();
      let bw = 0;
      const tickNow = sim.clock.tick;
      for (let i = 0; i < sim.buildings.length; i++) {
        const b = sim.buildings[i];
        const isMonument = Boolean(b && (b.isHeritage || (typeof b.isMonument === "function" && b.isMonument()) || String(b.buildingType || "").startsWith("monument_")));
        let dismantle = false;
        if (b && !isMonument && b.isRuined) {
          const ruinedAge = tickNow - (b.ruinedAtTick ?? tickNow);
          const owner = b.settlementId != null ? sim.settlementSystem?.settlements?.get(b.settlementId) : null;
          const ownerPop = owner && !owner.ruined ? (owner.population || owner.agentIds?.size || 0) : 0;
          const nearCore = owner?.center ? Math.hypot(b.x - owner.center.x, b.y - owner.center.y) <= 6.5 : false;
          if (ruinedAge > 1200) {
            dismantle = true;
          } else if (ownerPop >= 4 && ruinedAge >= (nearCore ? 55 : 110)) {
            dismantle = true;
            if (owner.stockpile) {
              owner.stockpile.wood = (owner.stockpile.wood || 0) + 3;
              owner.stockpile.ore = (owner.stockpile.ore || 0) + 2;
            }
            if (sim.warfareSystem?.combatEffects && sim.warfareSystem.combatEffects.length < 44) {
              sim.warfareSystem.combatEffects.push({
                x: b.x,
                y: b.y,
                type: "loot",
                label: "🧹 Ruins Cleared",
                duration: 22
              });
            }
          }
        }
        if (dismantle) {
          pruneIds.add(b.id);
          sim.world.removeFromSpatialIndex(Math.floor(b.x), Math.floor(b.y), b);
          sim.world.entityRegistry?.delete(b.id);
        } else {
          sim.buildings[bw++] = b;
        }
      }
      if (pruneIds.size > 0) {
        sim.buildings.length = bw;
        sim._occStamp = -1;
        for (const st of sim.settlementSystem.settlements.values()) {
          if (Array.isArray(st.buildings) && st.buildings.length > 0) {
            st.buildings = st.buildings.filter((b) => b && !pruneIds.has(b.id));
          }
        }
      }
    }

    // Clear permanently exhausted mine husks inside active settlement cores to reclaim buildable land
    if (sim.clock.tick % 120 === 0 && Array.isArray(sim.resources) && sim.resources.length > 0) {
      let rw = 0;
      let removedAny = false;
      for (let i = 0; i < sim.resources.length; i++) {
        const r = sim.resources[i];
        let clearHusk = false;
        if (r && r.exhausted && !r.destroyed) {
          for (const st of sim.settlementSystem.settlements.values()) {
            if (!st || st.ruined || !st.center || (st.population || st.agentIds?.size || 0) < 4) continue;
            if (Math.hypot(r.x - st.center.x, r.y - st.center.y) <= 9.0) {
              clearHusk = true;
              break;
            }
          }
        }
        if (clearHusk) {
          r.destroyed = true;
          sim.world.removeFromSpatialIndex(Math.floor(r.x), Math.floor(r.y), r);
          sim.world.entityRegistry?.delete(r.id);
          removedAny = true;
        } else {
          sim.resources[rw++] = r;
        }
      }
      if (removedAny) sim.resources.length = rw;
    }

    // Perf: index buildings by owner once per pass so civic planning reads pre-bucketed lists
    const bBySettlement = new Map();
    for (const b of sim.buildings) {
      if (b.settlementId == null) continue;
      let bucket = bBySettlement.get(b.settlementId);
      if (!bucket) { bucket = []; bBySettlement.set(b.settlementId, bucket); }
      bucket.push(b);
    }
    if (sim._occStamp !== sim.buildings.length) {
      sim._occStamp = sim.buildings.length;
      sim._occGrid = new Uint8Array(sim.world.width * sim.world.height);
      const W = sim.world.width, H = sim.world.height;
      for (const b of sim.buildings) {
        const bx = Math.floor(b.x), by = Math.floor(b.y);
        for (let dy = -2; dy <= 2; dy++) {
          const gy = by + dy;
          if (gy < 0 || gy >= H) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const gx = bx + dx;
            if (gx < 0 || gx >= W) continue;
            sim._occGrid[gy * W + gx] = 1;
          }
        }
      }
    }

    // Autonomous civic planning & expansion for societies
    for (const settlement of sim.settlementSystem.settlements.values()) {
      const pop = settlement.population || settlement.agentIds?.size || 0;

      // Elect elder / leader if none
      if (!settlement.leadership && settlement.agentIds && settlement.agentIds.size > 0) {
        const citizens = sim.agents.filter((a) => settlement.agentIds.has(a.id) && a.alive);
        if (citizens.length > 0) {
          citizens.sort((a, b) => b.age - a.age);
          settlement.leadership = citizens[0].name;
        }
      }

      let houses = 0, workshops = 0, farms = 0, temples = 0, towers = 0;
      let granaries = 0, markets = 0, barracksCount = 0, warehouses = 0;
      let windmills = 0, inns = 0, libraries = 0, apothecaries = 0, banks = 0;
      let factories = 0, researchLabs = 0, radarStations = 0, nuclearPlants = 0, missileSilos = 0;
      let pending = 0, nonRuined = 0;
      const owned = bBySettlement.get(settlement.id);
      if (owned) {
        for (const b of owned) {
          if (!b || b.isRuined) continue;
          nonRuined++;
          if (!b.complete) pending++;
          switch (b.buildingType) {
            case "house": houses++; break;
            case "workshop": workshops++; break;
            case "farm": farms++; break;
            case "temple": temples++; break;
            case "tower": case "castle": towers++; break;
            case "granary": granaries++; break;
            case "market": markets++; break;
            case "barracks": barracksCount++; break;
            case "warehouse": warehouses++; break;
            case "windmill": windmills++; break;
            case "inn": inns++; break;
            case "library": libraries++; break;
            case "apothecary": apothecaries++; break;
            case "bank": banks++; break;
            case "factory": factories++; break;
            case "research_lab": researchLabs++; break;
            case "radar_station": radarStations++; break;
            case "nuclear_plant": nuclearPlants++; break;
            case "missile_silo": missileSilos++; break;
          }
        }
      }

      // Continuous urban civic planning & outward city expansion over time
      const ageId = sim.civilizationAgeSystem?.getSettlementAge?.(settlement.id)?.ageId || 1;
      const maxBuildings = Math.min(72, Math.max(12, Math.ceil(pop * 1.45) + ageId * 3 + 6));
      const maxPending = pop >= 16 ? 4 : 2;
      const stock = settlement.stockpile || {};
      const timberAvail = (stock.wood || 0) + (stock.plank || 0);
      if (pending < maxPending && nonRuined < maxBuildings) {
        const targetHouses = Math.max(2, Math.ceil(pop * 0.62) + Math.floor(ageId / 2));
        const targetFarms = pop >= 4 ? Math.max(1, Math.floor(pop / 7)) : 0;
        const targetWorkshops = pop >= 3 ? Math.max(1, Math.floor(pop / 10)) : 0;
        const targetGranaries = pop >= 18 ? 2 : (pop >= 6 ? 1 : 0);
        const targetMarkets = pop >= 20 ? 2 : (pop >= 7 ? 1 : 0);
        const targetBarracks = pop >= 22 ? 2 : (pop >= 9 ? 1 : 0);
        const targetWarehouses = pop >= 22 ? 2 : (pop >= 11 ? 1 : 0);
        const targetTowers = pop >= 8 ? Math.min(4, Math.max(1, Math.floor(pop / 9))) : 0;
        const targetWindmills = (ageId >= 2 && pop >= 7) ? (pop >= 19 ? 2 : 1) : 0;
        const targetInns = (ageId >= 2 && pop >= 8) ? (pop >= 21 ? 2 : 1) : 0;
        const targetLibraries = (ageId >= 3 && pop >= 9) ? (pop >= 24 ? 2 : 1) : 0;
        const targetApothecaries = (ageId >= 3 && pop >= 10) ? (pop >= 24 ? 2 : 1) : 0;
        const targetBanks = (ageId >= 4 && pop >= 11) ? (pop >= 26 ? 2 : 1) : 0;
        const targetFactories = (ageId >= 5 && pop >= 10) ? (pop >= 22 ? 2 : 1) : 0;
        const targetLabs = (ageId >= 5 && pop >= 12) ? (pop >= 26 ? 2 : 1) : 0;
        const targetPlants = (ageId >= 6 && pop >= 12) ? (pop >= 28 ? 2 : 1) : 0;
        const targetRadars = (ageId >= 6 && pop >= 12) ? (pop >= 24 ? 2 : 1) : 0;
        const targetSilos = (ageId >= 6 && pop >= 13) ? (pop >= 28 ? 2 : 1) : 0;

        let neededType = null;
        if (houses < Math.max(1, Math.min(4, Math.ceil(pop / 4)))) {
          neededType = "house";
        } else if (workshops < 1 && pop >= 3) {
          neededType = "workshop";
        } else if (farms < 1 && pop >= 4) {
          neededType = "farm";
        } else if (timberAvail < 8 && nonRuined >= 3) {
          // Preserve minimal timber reserve before queuing non-essential expansion
          neededType = null;
        } else if (temples === 0 && pop >= 6) {
          neededType = "temple";
        } else if (granaries < targetGranaries) {
          neededType = "granary";
        } else if (markets < targetMarkets) {
          neededType = "market";
        } else if (barracksCount < targetBarracks) {
          neededType = "barracks";
        } else if (warehouses < targetWarehouses) {
          neededType = "warehouse";
        } else if (windmills < targetWindmills) {
          neededType = "windmill";
        } else if (inns < targetInns) {
          neededType = "inn";
        } else if (libraries < targetLibraries) {
          neededType = "library";
        } else if (apothecaries < targetApothecaries) {
          neededType = "apothecary";
        } else if (farms < targetFarms) {
          neededType = "farm";
        } else if (workshops < targetWorkshops) {
          neededType = "workshop";
        } else if (houses < targetHouses) {
          neededType = "house";
        } else if (towers < targetTowers) {
          neededType = (ageId >= 4 && pop >= 15 && (towers === 0 || towers === 2)) ? "castle" : "tower";
        } else if (banks < targetBanks) {
          neededType = "bank";
        } else if (factories < targetFactories) {
          neededType = "factory";
        } else if (researchLabs < targetLabs) {
          neededType = "research_lab";
        } else if (factories >= 1 && nuclearPlants < targetPlants) {
          neededType = "nuclear_plant";
        } else if (radarStations < targetRadars) {
          neededType = "radar_station";
        } else if (nuclearPlants >= 1 && missileSilos < targetSilos) {
          neededType = "missile_silo";
        } else if (sim.clock.tick % 50 === 0) {
          const hasTimber = timberAvail >= 12;
          if (hasTimber) {
            const cycle = ["house", "farm", "house", "workshop", "house", ageId >= 5 ? "factory" : "tower"];
            neededType = cycle[(nonRuined + settlement.id) % cycle.length];
          }
        }

        if (neededType) {
          const tierRadius = sim.settlementSystem.getTierInfo(pop, nonRuined).radius || 16;
          const minR = nonRuined < 6 ? 2.5 : nonRuined < 14 ? 4 : 5.5;
          const maxR = Math.min(26, Math.max(10, 7 + Math.floor(nonRuined * 0.48) + Math.floor(pop * 0.14), Math.floor(tierRadius * 0.72)));
          const span = Math.max(4, maxR - minR);
          for (let a = 0; a < 36; a++) {
            const ang = sim._rng().next() * Math.PI * 2;
            const r = minR + sim._rng().next() * span;
            const bx = Math.floor(settlement.center.x + Math.cos(ang) * r);
            const by = Math.floor(settlement.center.y + Math.sin(ang) * r);
            if (bx >= 4 && bx < sim.world.width - 4 && by >= 4 && by < sim.world.height - 4 && sim.world.isWalkable(bx, by)) {
              const occupied = sim._occGrid[by * sim.world.width + bx] === 1 || Boolean(sim.fortificationSystem?.getSegmentAt?.(bx, by));
              if (!occupied) {
                const building = new Building(bx, by, neededType, sim.idGen, settlement.id, settlement.factionId ?? null);
                building.constructionProgress = 0;
                building.complete = false;
                sim.buildings.push(building);
                sim.world.addToSpatialIndex(bx, by, building);
                const W = sim.world.width, H = sim.world.height;
                for (let dy = -2; dy <= 2; dy++) {
                  const gy = by + dy;
                  if (gy < 0 || gy >= H) continue;
                  for (let dx = -2; dx <= 2; dx++) {
                    const gx = bx + dx;
                    if (gx < 0 || gx >= W) continue;
                    sim._occGrid[gy * W + gx] = 1;
                  }
                }
                if (!owned) {
                  bBySettlement.set(settlement.id, [building]);
                } else {
                  owned.push(building);
                }
                pending++;
                if (!settlement.buildings) settlement.buildings = [];
                settlement.buildings.push(building);
                sim.eventBus.emit("BLUEPRINT_PLACED", {
                  type: neededType,
                  settlementName: settlement.name,
                  x: bx,
                  y: by
                });
                break;
              }
            }
          }
        }
      }

      // Autonomous settlement building upgrades (deterministic, reserve-safe, every 40 ticks)
      if (sim.clock.tick % 40 === 0 && !settlement.ruined && owned && owned.length > 0) {
        const priority = [
          "farm", "granary", "windmill", "workshop", "house", "inn",
          "library", "apothecary", "market", "bank", "tower", "castle",
          "barracks", "factory", "research_lab", "nuclear_plant",
          "radar_station", "missile_silo", "temple", "warehouse", "dock",
          "monument_cairn", "monument_pyramid", "monument_colosseum",
          "monument_citadel", "monument_foundry", "monument_monolith", "monument_atomic_dome"
        ];
        const sortedOwned = [...owned].filter((b) => b && b.complete && !b.isRuined).sort((a, b) => {
          const pa = priority.indexOf(a.buildingType);
          const pb = priority.indexOf(b.buildingType);
          const ra = pa === -1 ? 99 : pa;
          const rb = pb === -1 ? 99 : pb;
          if ((a.level || 1) !== (b.level || 1)) return (a.level || 1) - (b.level || 1);
          if (ra !== rb) return ra - rb;
          return (a.id || 0) - (b.id || 0);
        });
        const stock = settlement.stockpile || {};
        const woodAvail = (stock.wood || 0) + (stock.plank || 0);
        const oreAvail = (stock.ore || 0) + (stock.iron_ingot || 0);
        for (const candidate of sortedOwned) {
          const req = getUpgradeRequirements(sim, candidate);
          if (!req.eraMet || !req.nextLevel) continue;
          if (woodAvail >= (req.costs.wood || 0) + 10 && oreAvail >= (req.costs.ore || 0) + 6) {
            const res = upgradeBuilding(sim, candidate.id, { byPlayer: false, tick: sim.clock.tick });
            if (res?.ok) break;
          }
        }
      }
    }
  }
}

export function jobSettlementId(agent) {
  const site = agent.constructionTarget || agent.workplace;
  if (site && site.settlementId != null) return site.settlementId;
  return null;
}

export function updateEconomy(sim) {
  if (sim.clock.tick % 10 === 0) {
    const availableJobs = ["gatherer", "farmer", "hunter", "lumberjack", "miner", "builder", "craftsman", "soldier"];

    const adultCountBySettlement = new Map();
    const soldierCountBySettlement = new Map();
    for (const [sid, st] of sim.settlementSystem.settlements) {
      let adults = 0, soldiers = 0;
      for (const aId of st.agentIds) {
        const a = sim._agentById(aId);
        if (a && a.alive && a.lifeStage === "adult") {
          adults++;
          if (a.job === "soldier" || a.militaryDuty) soldiers++;
        }
      }
      adultCountBySettlement.set(sid, adults);
      soldierCountBySettlement.set(sid, soldiers);
    }

    const pendingCountBySettlement = new Map();
    const wsCountBySettlement = new Map();
    for (const b of sim.buildings) {
      if (b.settlementId != null && !b.complete && !b.isRuined && (b.constructionProgress || 0) < 100) {
        pendingCountBySettlement.set(b.settlementId, (pendingCountBySettlement.get(b.settlementId) || 0) + 1);
      }
      if (b.settlementId != null && b.buildingType === "workshop" && b.complete && !b.isRuined) {
        wsCountBySettlement.set(b.settlementId, (wsCountBySettlement.get(b.settlementId) || 0) + 1);
      }
    }

    const needsBuilders = new Set();
    const needsFood = new Set();
    const needsHunters = new Set();
    const craftsmanSurplus = new Set();
    const builderCountBySettlement = new Map();
    const craftsmanCountBySettlement = new Map();
    const workshopCapBySettlement = new Map();
    for (const [sid, settlement] of sim.settlementSystem.settlements) {
      let builders = 0, foodWorkers = 0, craftsmen = 0, hunters = 0;
      for (const agentId of settlement.agentIds) {
        const a = sim._agentById(agentId);
        if (!a || !a.alive) continue;
        if (a.job === "builder") builders++;
        else if (a.job === "craftsman") craftsmen++;
        else if (a.job === "hunter") { hunters++; foodWorkers++; }
        else if (a.job !== "unemployed") foodWorkers++;
      }
      const pop = settlement.agentIds.size;
      const pendingLocal = pendingCountBySettlement.get(sid) || 0;
      const builderQuota = pendingLocal > 0 ? (pop >= 22 ? 3 : (pop >= 10 ? 2 : 1)) : 0;
      builderCountBySettlement.set(sid, builders);
      craftsmanCountBySettlement.set(sid, craftsmen);
      if (pop >= 2 && pendingLocal > 0 && builders < builderQuota) needsBuilders.add(sid);
      if (pop >= 3 && foodWorkers <= 1) needsFood.add(sid);
      if (pop >= 5 && hunters === 0) needsHunters.add(sid);
      const wsCount = wsCountBySettlement.get(sid) || 0;
      const wsCap = Math.max(1, wsCount) * 4;
      workshopCapBySettlement.set(sid, wsCap);
      const target = Math.min(wsCap, Math.max(2, Math.floor(pop / 3)));
      if (craftsmen > target) craftsmanSurplus.add(sid);
    }
    sim._jobDemand = { needsBuilders, needsFood, needsHunters, craftsmanSurplus };

    for (const settlement of sim.settlementSystem.settlements.values()) {
      const homeSid = settlement.id;
      const sPop = settlement.agentIds.size;
      const localPending = pendingCountBySettlement.get(homeSid) || 0;
      const builderQuota = localPending > 0 ? (sPop >= 22 ? 3 : (sPop >= 10 ? 2 : 1)) : 0;
      const wsCap = workshopCapBySettlement.get(homeSid) || 4;
      for (const agentId of settlement.agentIds) {
        const agent = sim._agentById(agentId);
        if (agent && agent.alive) {
          const currentJob = sim.economySystem.getAgentJob(agentId);
          if (!currentJob || currentJob.job === "unemployed" || agent.job === "unemployed" || !agent.job) {
            if (agent._lastJobAssignedTick === Infinity) agent._lastJobAssignedTick = sim.clock.tick - 120;
            if (sim.clock.tick - (agent._lastJobAssignedTick ?? -9999) < 60) continue;
            const canEnlist = agent.lifeStage === "adult" &&
              agent.age >= 18 && agent.age <= 40 && (agent.personality?.brave ?? 0.5) > 0.6;
            const maxSoldiers = Math.floor((adultCountBySettlement.get(homeSid) || 0) / 8);
            const curSoldiers = soldierCountBySettlement.get(homeSid) || 0;
            const enlistOffered = canEnlist && curSoldiers < maxSoldiers;
            const attempts = (sim._jobChangeCount.get(agent.id) || 0) + 1;
            sim._jobChangeCount.set(agent.id, attempts);
            if (attempts > 3 && !enlistOffered) {
              // Back off temporarily instead of permanently locking citizen unemployed
              sim._jobChangeCount.set(agent.id, 0);
              agent._lastJobAssignedTick = sim.clock.tick + 60;
              continue;
            }
            let jobPool = availableJobs;
            const curBuilders = builderCountBySettlement.get(homeSid) || 0;
            const curCraftsmen = craftsmanCountBySettlement.get(homeSid) || 0;
            if (enlistOffered) {
              soldierCountBySettlement.set(homeSid, curSoldiers + 1);
              jobPool = ["soldier"];
            } else if (localPending > 0 && curBuilders < builderQuota) {
              jobPool = ["builder"];
            } else {
              jobPool = availableJobs.filter((j) =>
                j !== "soldier" &&
                (localPending > 0 || j !== "builder") &&
                (curCraftsmen < wsCap || j !== "craftsman")
              );
            }
            sim.economySystem.assignJob(agent, jobPool);
            if (agent.job === "builder") {
              builderCountBySettlement.set(homeSid, curBuilders + 1);
            } else if (agent.job === "craftsman") {
              craftsmanCountBySettlement.set(homeSid, curCraftsmen + 1);
            }
            if (agent.job && agent.job !== "unemployed") {
              sim._jobChangeCount.set(agent.id, Math.max(0, attempts - 1));
              agent._lastJobAssignedTick = sim.clock.tick;
            } else {
              if (enlistOffered) soldierCountBySettlement.set(homeSid, curSoldiers);
              sim._jobChangeCount.set(agent.id, Math.max(0, attempts - 1));
              agent._lastJobAssignedTick = sim.clock.tick;
            }
            agent._jobAssignedTick = sim.clock.tick;
          } else if (agent.lifeStage === "adult" && agent.job === "builder" &&
                     localPending === 0 && !agent.militaryDuty &&
                     agent.currentAction?.type !== "build" &&
                     (sim.clock.tick - (agent._jobAssignedTick || 0)) >= 40) {
            // Pivot idle builders when settlement has no pending construction
            const pivotPool = ["lumberjack", "farmer", "gatherer", "miner"];
            sim.economySystem.assignJob(agent, pivotPool);
            builderCountBySettlement.set(homeSid, Math.max(0, (builderCountBySettlement.get(homeSid) || 1) - 1));
            agent._jobAssignedTick = sim.clock.tick;
            agent._lastJobAssignedTick = sim.clock.tick;
          } else if (agent.lifeStage === "adult" && sim.clock.tick % 40 === 0 &&
                     agent.personality.curious > 0.4) {
            const jobSid = jobSettlementId(agent);
            const sameSite = jobSid == null || jobSid === homeSid;
            if (sameSite) {
              if (needsBuilders.has(homeSid) && localPending > 0 && agent.job !== "builder" &&
                  agent.job !== "soldier" && !agent.militaryDuty &&
                  (agent.skills.build >= 1.0 || agent.job !== "craftsman" || craftsmanSurplus.has(homeSid))) {
                sim.economySystem.assignJob(agent, ["builder"]);
                builderCountBySettlement.set(homeSid, (builderCountBySettlement.get(homeSid) || 0) + 1);
                if ((builderCountBySettlement.get(homeSid) || 0) >= builderQuota) {
                  needsBuilders.delete(homeSid);
                }
                agent._jobAssignedTick = sim.clock.tick;
                agent._lastJobAssignedTick = sim.clock.tick;
                sim._jobChangeCount.set(agent.id, (sim._jobChangeCount.get(agent.id) || 0) + 1);
              } else if (needsHunters.has(homeSid) && agent.job !== "hunter" && agent.job !== "craftsman" &&
                         agent.job !== "builder" && agent.job !== "soldier" &&
                         (sim.animalSystem?.animals?.length || 0) >= 6) {
                needsHunters.delete(homeSid);
                sim.economySystem.assignJob(agent, ["hunter"]);
                agent._jobAssignedTick = sim.clock.tick;
                agent._lastJobAssignedTick = sim.clock.tick;
                sim._jobChangeCount.set(agent.id, (sim._jobChangeCount.get(agent.id) || 0) + 1);
              } else if (needsFood.has(homeSid) && agent.job !== "farmer" && agent.job !== "gatherer" &&
                         agent.job !== "lumberjack" && agent.job !== "hunter" &&
                         agent.job !== "craftsman") {
                sim.economySystem.assignJob(agent, ["farmer", "hunter", "gatherer", "lumberjack"]);
                agent._jobAssignedTick = sim.clock.tick;
                agent._lastJobAssignedTick = sim.clock.tick;
                sim._jobChangeCount.set(agent.id, (sim._jobChangeCount.get(agent.id) || 0) + 1);
              }
            }
          }
        }
      }
    }

    for (const agent of sim.agents) {
      if (agent.alive && (!agent.job || agent.job === "unemployed")) {
        if (agent._lastJobAssignedTick === Infinity) agent._lastJobAssignedTick = sim.clock.tick - 120;
        if (sim.clock.tick - (agent._lastJobAssignedTick ?? -9999) < 60) continue;
        const attempts = (sim._jobChangeCount.get(agent.id) || 0) + 1;
        sim._jobChangeCount.set(agent.id, attempts);
        if (attempts > 3) {
          sim._jobChangeCount.set(agent.id, 0);
          agent._lastJobAssignedTick = sim.clock.tick + 60;
          continue;
        }
        const pool = availableJobs.filter(j => j !== "soldier" && j !== "builder");
        sim.economySystem.assignJob(agent, pool);
        agent._lastJobAssignedTick = sim.clock.tick;
        agent._jobAssignedTick = sim.clock.tick;
      }
    }
  }

  updateCareerChanges(sim);

  if (sim.clock.tick % 50 === 0) {
    const settlementResources = new Map();
    for (const id of sim.settlementSystem.settlements.keys()) {
      const stats = sim.settlementSystem.getSettlementStats(id);
      if (stats) {
        settlementResources.set(id, {
          food: stats.totalFood,
          wood: stats.totalWood,
          ore: stats.totalOre
        });
      }
    }
    sim.economySystem.updateMarketPrices(settlementResources);
  }
}

export function soldierEnlistOffer(sim, agent, homeSid) {
  if (!agent || !agent.alive || agent.lifeStage !== "adult") return false;
  if (!(agent.age >= 18 && agent.age <= 40)) return false;
  if ((agent.personality?.brave ?? 0.5) <= 0.6) return false;
  const st = sim.settlementSystem.settlements.get(homeSid);
  if (!st) return false;
  let adults = 0, underArms = 0;
  for (const id of st.agentIds) {
    const a = sim._agentById(id);
    if (a && a.alive && a.lifeStage === "adult") {
      adults++;
      if (a.job === "soldier" || a.militaryDuty) underArms++;
    }
  }
  return underArms < Math.floor(adults / 8);
}

export function updateCareerChanges(sim) {
  if (sim.clock.tick % 20 !== 0) return;
  const demand = sim._jobDemand;
  const rng = sim._rng();

  for (const agent of sim.agents) {
    if (!agent.alive || agent.lifeStage !== "adult") continue;
    const rec = sim.economySystem.getAgentJob(agent.id);
    if (!rec || !rec.job || rec.job === "unemployed") continue;
    const assignedAt = Math.max(
      typeof agent._jobAssignedTick === "number" ? agent._jobAssignedTick : -1,
      typeof rec.assignedAt === "number" ? rec.assignedAt : -1);
    if (assignedAt < 0 || sim.clock.tick - assignedAt < 600) continue;

    if (rec.job === "soldier" || agent.job === "soldier") continue;

    const p26 = agent.personality;
    const restlessness = (p26.curious ?? 0.5) * 0.5
      + (1 - (p26.industrious ?? 0.7)) * 0.35
      + (p26.social ?? 0.5) * 0.15;
    const staleness = Math.min(1, (sim.clock.tick - assignedAt) / 2000);
    const chance = restlessness * (0.04 + 0.10 * staleness);
    if (rng.next() >= chance) continue;

    const homeSid = sim.settlementSystem.getAgentSettlement(agent.id)?.id ?? null;
    const jobSid = jobSettlementId(agent);
    if (jobSid != null && homeSid != null && jobSid !== homeSid) continue;

    let pool = EconomySystem.CAREER_ALTERNATIVES.filter((j) => j !== rec.job);
    if (rec.job === "craftsman") {
      if (!demand.craftsmanSurplus.has(homeSid)) continue;
      if (demand.needsFood.has(homeSid)) pool = ["farmer", "gatherer", "lumberjack"];
      const enlistOffer = soldierEnlistOffer(sim, agent, homeSid);
      if (enlistOffer) pool = ["soldier"];
    } else if (rec.job === "builder") {
      if (demand.needsBuilders.has(homeSid)) continue;
    } else if (rec.job === "farmer" || rec.job === "gatherer" || rec.job === "lumberjack") {
      if (demand.needsFood.has(homeSid)) continue;
    } else if (rec.job === "soldier") {
      const adultsHere = sim.settlementSystem.getAgentSettlement(agent.id)
        ? [...sim.settlementSystem.getAgentSettlement(agent.id).agentIds]
            .filter((id) => { const x = sim._agentById(id); return x && x.alive && x.lifeStage === "adult"; }).length
        : 0;
      const quotaHere = Math.floor(adultsHere / 8);
      let underArmsHere = 0;
      const stt = sim.settlementSystem.getAgentSettlement(agent.id);
      if (stt) for (const id of stt.agentIds) {
        const x = sim._agentById(id);
        if (x && x.alive && x.lifeStage === "adult" && (x.job === "soldier" || x.militaryDuty)) underArmsHere++;
      }
      if (underArmsHere <= quotaHere) continue;
    }
    if (pool.length === 0) continue;

    const newJob = sim.economySystem.switchCareer(agent, pool);
    if (!newJob) continue;
    agent._lastJobAssignedTick = sim.clock.tick;
    agent._jobAssignedTick = sim.clock.tick;
    sim._jobChangeCount.delete(agent.id);

    if (agent.workplace && sim.craftingSystem?.workshops?.has(agent.workplace)) {
      sim.craftingSystem.removeWorker(agent.workplace, agent.id);
    }

    if (typeof agent.addLifeEvent === "function") {
      agent.addLifeEvent("CAREER", `Retrained from ${rec.job} to ${newJob}`, sim.clock.tick, "🛠️", false);
    }

    sim.eventBus.emit("CAREER_CHANGED", {
      agentId: agent.id,
      name: agent.name,
      from: rec.job,
      to: newJob,
      reason: staleness > 0.6 ? "bored" : "wanderlust",
      settlementId: homeSid,
      tick: sim.clock.tick
    });
  }
}

export function updatePioneers(sim) {
  if (!sim.settlementSystem || sim.clock.tick % 20 !== 0) return;
  const ssys = sim.settlementSystem;
  const pioneers = sim.agents.filter((a) =>
    a.alive && a.pioneer && !a.settlementId && !ssys.agentSettlementMap.get(a.id));
  if (pioneers.length > 0) {
    for (const seed of pioneers) {
      if (!seed.alive || !seed.pioneer || seed.settlementId || ssys.agentSettlementMap.get(seed.id)) continue;

      const band = [seed];
      for (const other of pioneers) {
        if (other === seed || !other.alive || !other.pioneer || other.settlementId || ssys.agentSettlementMap.get(other.id)) continue;
        if (Math.hypot(other.x - seed.x, other.y - seed.y) < 14) band.push(other);
      }
      const nearTown = [...ssys.settlements.values()].some((s) =>
        !s.ruined && s.center && Math.hypot(s.center.x - seed.x, s.center.y - seed.y) < 24);
      if (nearTown) continue;

      if (band.length >= 3) {
        let cx = 0, cy = 0;
        for (const b of band) { cx += b.x; cy += b.y; }
        cx /= band.length; cy /= band.length;
        const settlement = ssys.foundSettlement(cx, cy, band);
        for (const b of band) {
          b.pioneer = false;
          if (typeof b.addLifeEvent === "function") {
            b.addLifeEvent("FOUNDING", `Co-founded frontier settlement ${settlement?.name || "New Camp"}`, sim.clock.tick, "🏕️", true);
          }
        }
        if (settlement) {
          if (sim.religionSystem) {
            sim.religionSystem.initWorldBeliefs();
          }
          if (sim.diplomacySystem) {
            for (const other of ssys.settlements.values()) {
              if (other.id !== settlement.id && !other.ruined) {
                sim.diplomacySystem.initRelation(settlement.id, other.id);
              }
            }
          }
        }
        sim.eventBus.emit("SETTLEMENT_FOUNDED", {
          id: settlement?.id ?? null, name: settlement?.name ?? "New Camp",
          x: cx, y: cy, population: band.length, pioneer: true
        });
      } else {
        const angle = sim._rng().next() * Math.PI * 2;
        const dist = 3 + sim._rng().next() * 5;
        const tx = Math.max(8, Math.min(sim.world.width - 8, seed.x + Math.cos(angle) * dist));
        const ty = Math.max(8, Math.min(sim.world.height - 8, seed.y + Math.sin(angle) * dist));
        seed.goals = [{ type: "gather_supplies", priority: 60, target: { x: tx, y: ty } }];
      }
    }
  }

  // Autonomous organic frontier splintering after world init (keeps tick 0 at 3 cities)
  if (sim.clock.tick >= 120 && sim.clock.tick % 100 === 0 && ssys.settlements.size < 6) {
    const sortedCities = [...ssys.settlements.values()]
      .filter((s) => s && !s.ruined && (s.population || s.agentIds?.size || 0) >= 16)
      .sort((a, b) => a.id - b.id);
    for (const origin of sortedCities) {
      const candidates = [];
      for (const aid of origin.agentIds || []) {
        const a = sim._agentById(aid);
        if (a && a.alive && a.lifeStage === "adult" && !a.isMonarch && !a.militaryDuty && !a.captive && !a.isRebel) {
          candidates.push(a);
        }
      }
      candidates.sort((a, b) => a.id - b.id);
      if (candidates.length < 3) continue;

      let fx = null, fy = null;
      for (let attempt = 0; attempt < 24; attempt++) {
        const ang = sim._rng().next() * Math.PI * 2;
        const dist = 27 + sim._rng().next() * 14;
        const cx = Math.floor(origin.center.x + Math.cos(ang) * dist);
        const cy = Math.floor(origin.center.y + Math.sin(ang) * dist);
        if (cx < 10 || cy < 10 || cx >= sim.world.width - 10 || cy >= sim.world.height - 10) continue;
        if (!sim.world.isWalkable(cx, cy)) continue;
        const terr = sim.world.getTerrain(cx, cy);
        if (!terr || terr.type === "water" || terr.type === "snow") continue;
        const farFromAll = [...ssys.settlements.values()].every((s) =>
          !s.center || Math.hypot(s.center.x - cx, s.center.y - cy) >= 25
        );
        if (farFromAll) { fx = cx; fy = cy; break; }
      }
      if (fx === null) continue;

      const colonists = candidates.slice(0, 3);
      for (const col of colonists) {
        origin.agentIds.delete(col.id);
        ssys.agentSettlementMap.delete(col.id);
        if (col._sx !== undefined) sim.world.removeFromSpatialIndex(col._sx, col._sy, col);
        col.x = fx + (sim._rng().next() - 0.5) * 2;
        col.y = fy + (sim._rng().next() - 0.5) * 2;
        col.homeId = null;
        col.workplace = null;
        col.constructionTarget = null;
        col.path = null;
        col.goals = [];
        sim.world.addToSpatialIndex(Math.floor(col.x), Math.floor(col.y), col);
      }
      origin.population = origin.agentIds.size;

      const colony = ssys.foundSettlement(fx, fy, colonists);
      if (colony) {
        for (const col of colonists) {
          if (typeof col.addLifeEvent === "function") {
            col.addLifeEvent("FOUNDING", `Settled splinter kingdom ${colony.name} from ${origin.name}`, sim.clock.tick, "🏕️", true);
          }
        }
        if (sim.diplomacySystem) {
          for (const other of ssys.settlements.values()) {
            if (other.id !== colony.id && !other.ruined) {
              sim.diplomacySystem.initRelation(colony.id, other.id);
            }
          }
          sim.diplomacySystem.seedFeud(colony.id, origin.id, 65);
        }
        if (sim.chronicleSystem?.add) {
          sim.chronicleSystem.add("founding", `🚩 Frontier colonists from ${origin.name} broke away to establish ${colony.name}!`, {
            icon: "🚩",
            x: fx,
            y: fy
          });
        }
        sim.eventBus.emit("SETTLEMENT_FOUNDED", {
          id: colony.id, name: colony.name, x: fx, y: fy, population: colonists.length, splinterFrom: origin.name
        });
      }
      break;
    }
  }
}

export function getSettlementBuildingBonus(sim, settlementId, buildingType) {
  let count = 0;
  let maxLevel = 0;
  let totalLevels = 0;
  let power = 0;
  if (settlementId == null || !Array.isArray(sim.buildings)) {
    return { count, maxLevel, totalLevels, power };
  }
  for (const b of sim.buildings) {
    if (!b || b.isRuined || !b.complete) continue;
    if (b.settlementId !== settlementId || b.buildingType !== buildingType) continue;
    const lvl = b.level || 1;
    count++;
    if (lvl > maxLevel) maxLevel = lvl;
    totalLevels += lvl;
    power += typeof b.getLevelMultiplier === "function"
      ? b.getLevelMultiplier()
      : (1 + Math.max(0, lvl - 1) * 0.45);
  }
  return { count, maxLevel, totalLevels, power };
}

export function getUpgradeRequirements(sim, building) {
  if (!building || building.isRuined) {
    return { ok: false, eraMet: false, affordable: false, reason: "Building is ruined" };
  }
  if (!building.complete) {
    return { ok: false, eraMet: false, affordable: false, reason: "Under construction" };
  }
  const meta = BUILDING_METADATA[building.buildingType];
  const maxLevel = building.maxLevel || meta?.maxLevel || 3;
  const currentLevel = building.level || 1;
  if (currentLevel >= maxLevel) {
    return { ok: false, eraMet: false, affordable: false, maxLevel, currentLevel, reason: "Max tier reached" };
  }
  const nextLevel = currentLevel + 1;
  const requiredEra = meta?.upgradeEras?.[nextLevel] || (nextLevel === 2 ? 2 : 4);
  const settlement = building.settlementId != null ? sim.settlementSystem?.settlements?.get(building.settlementId) : null;
  const ageId = building.settlementId != null
    ? (sim.civilizationAgeSystem?.getSettlementAge?.(building.settlementId)?.ageId || 1)
    : 7;
  const costs = meta?.upgradeCosts?.[nextLevel] || { wood: 18 * currentLevel, ore: 8 * currentLevel };
  const stock = settlement?.stockpile || {};
  const woodAvail = (stock.wood || 0) + (stock.plank || 0);
  const oreAvail = (stock.ore || 0) + (stock.iron_ingot || 0);
  const eraMet = ageId >= requiredEra;
  const affordable = !settlement || (woodAvail >= (costs.wood || 0) && oreAvail >= (costs.ore || 0));
  return {
    ok: eraMet && affordable,
    eraMet,
    affordable,
    currentLevel,
    nextLevel,
    maxLevel,
    requiredEra,
    currentEra: ageId,
    costs,
    nextName: meta?.levelNames?.[nextLevel - 1] || `Level ${nextLevel}`,
    nextBonus: meta?.levelBonuses?.[nextLevel - 1] || "",
    reason: !eraMet
      ? `Requires Era ${requiredEra}`
      : (!affordable ? `Need ${costs.wood || 0} Wood & ${costs.ore || 0} Ore` : null),
  };
}

export function deductUpgradeCost(stockpile, primaryKey, fallbackKey, amount) {
  if (!stockpile || amount <= 0) return;
  let remaining = amount;
  const primaryHave = stockpile[primaryKey] || 0;
  const takePrimary = Math.min(primaryHave, remaining);
  stockpile[primaryKey] = primaryHave - takePrimary;
  remaining -= takePrimary;
  if (remaining > 0 && fallbackKey) {
    const fbHave = stockpile[fallbackKey] || 0;
    const takeFb = Math.min(fbHave, remaining);
    stockpile[fallbackKey] = fbHave - takeFb;
  }
}

export function upgradeBuilding(sim, buildingId, { byPlayer = false, tick = sim.clock?.tick ?? 0 } = {}) {
  const building = Array.isArray(sim.buildings) ? sim.buildings.find((b) => b && b.id === buildingId) : null;
  if (!building) return { ok: false, reason: "Building not found" };
  const req = getUpgradeRequirements(sim, building);
  if (!req.eraMet) return { ok: false, reason: req.reason || "Era requirement not met" };
  if (!byPlayer && !req.affordable) return { ok: false, reason: req.reason || "Insufficient stockpile" };

  const settlement = building.settlementId != null ? sim.settlementSystem?.settlements?.get(building.settlementId) : null;
  if (settlement?.stockpile) {
    deductUpgradeCost(settlement.stockpile, "wood", "plank", req.costs?.wood || 0);
    deductUpgradeCost(settlement.stockpile, "ore", "iron_ingot", req.costs?.ore || 0);
  }

  const upgraded = typeof building.applyUpgrade === "function" ? building.applyUpgrade(tick) : false;
  if (!upgraded) return { ok: false, reason: "Upgrade failed" };

  const dyn = building.settlementId != null ? sim.dynastySystem?.getSettlementDynasty?.(building.settlementId) : null;
  const monarch = dyn?.monarchId != null ? sim._agentById(dyn.monarchId) : null;
  let renovatorId = null;
  if (monarch && monarch.alive) {
    renovatorId = monarch.id;
    building.upgradedByName = formatAgentFullName(monarch);
  } else if (Array.isArray(building.contributors) && building.contributors.length > 0) {
    renovatorId = building.contributors[0].id ?? null;
    building.upgradedByName = building.contributors[0].name || "Civic Guilds";
  } else if (building.builtByName) {
    renovatorId = building.builtByAgentId ?? null;
    building.upgradedByName = building.builtByName;
  } else {
    building.upgradedByName = byPlayer ? "Royal Decree" : "Civic Guilds";
  }
  building.upgradedByAgentId = renovatorId;

  const ageSummary = building.settlementId != null
    ? sim.civilizationAgeSystem?.getSettlementAge?.(building.settlementId)
    : sim.civilizationAgeSystem?.getDominantAge?.();
  const eraId = ageSummary?.ageId ?? ageSummary?.id ?? 1;
  const eraName = ageSummary?.name || "Tribal Era";
  const year = Math.floor(tick / 400) + 1;
  if (!Array.isArray(building.upgradeHistory)) building.upgradeHistory = [];
  building.upgradeHistory.push({
    level: building.level,
    byAgentId: renovatorId,
    byName: building.upgradedByName,
    year,
    eraId,
    eraName,
  });

  const meta = BUILDING_METADATA[building.buildingType];
  const levelTitle = meta?.levelNames?.[building.level - 1] || `${meta?.name || building.buildingType} Lv ${building.level}`;
  sim.eventBus.emit("BUILDING_UPGRADED", {
    buildingId: building.id,
    buildingType: building.buildingType,
    level: building.level,
    levelTitle,
    settlementId: building.settlementId,
    settlementName: settlement?.name || "Realm",
    x: building.x,
    y: building.y,
    byPlayer,
  });
  if (sim.chronicleSystem?.add && building.level >= 2) {
    sim.chronicleSystem.add("construction", `${meta?.icon || "🏛️"} ${settlement?.name || "A town"} upgraded ${levelTitle} (Lv ${building.level})!`, {
      icon: meta?.icon || "🏛️",
      buildingId: building.id,
      agentId: renovatorId,
      x: building.x,
      y: building.y,
    });
  }
  return { ok: true, building, level: building.level, levelTitle };
}

export function commissionSettlementBuilding(sim, settlementId, buildingType, { byPlayer = true } = {}) {
  const settlement = sim.settlementSystem?.settlements?.get(settlementId);
  if (!settlement || settlement.ruined || !settlement.center) {
    return { ok: false, reason: "Settlement not found" };
  }
  const meta = BUILDING_METADATA[buildingType];
  if (!meta) return { ok: false, reason: "Unknown building type" };
  const ageId = sim.civilizationAgeSystem?.getSettlementAge?.(settlementId)?.ageId || 1;
  if (ageId < meta.minEra) {
    return { ok: false, reason: `${meta.name} unlocks in Era ${meta.minEra}` };
  }

  const W = sim.world.width || 128;
  const H = sim.world.height || 128;
  let chosenX = null;
  let chosenY = null;
  for (let r = 2; r <= 12 && chosenX === null; r++) {
    const steps = Math.max(12, r * 8);
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * Math.PI * 2;
      const bx = Math.floor(settlement.center.x + Math.cos(ang) * r);
      const by = Math.floor(settlement.center.y + Math.sin(ang) * r);
      if (bx < 4 || by < 4 || bx >= W - 4 || by >= H - 4) continue;
      if (!sim.world.isWalkable(bx, by)) continue;
      if (sim.fortificationSystem?.segments?.has(`${bx},${by}`)) continue;
      const nearBld = sim.buildings.some((b) => b && !b.isRuined && Math.hypot(b.x - bx, b.y - by) < 1.6);
      if (nearBld) continue;
      chosenX = bx;
      chosenY = by;
      break;
    }
  }

  if (chosenX === null) {
    return { ok: false, reason: "No clear buildable ground nearby" };
  }

  const building = new Building(chosenX, chosenY, buildingType, sim.idGen, settlement.id, settlement.factionId ?? null);
  building.constructionProgress = 0;
  building.complete = false;
  sim.buildings.push(building);
  sim.world.addToSpatialIndex(chosenX, chosenY, building);
  sim.world.entityRegistry?.set(building.id, building);
  sim._occStamp = -1;
  if (!settlement.buildings) settlement.buildings = [];
  settlement.buildings.push(building);

  sim.eventBus.emit("BLUEPRINT_PLACED", {
    type: buildingType,
    settlementName: settlement.name,
    x: chosenX,
    y: chosenY,
    byPlayer,
  });
  return { ok: true, building, meta };
}
