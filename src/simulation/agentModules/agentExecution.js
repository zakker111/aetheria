// Agent action execution, town-life spot selection, and movement steering.
// Extracted from Agent for modularity with zero circular imports and byte-identical RNG order.

import { BUILD_COSTS } from "../../core/constants.js";

function tickOf(simulation) {
  return (simulation && simulation.clock && simulation.clock.tick) || 0;
}

function formatFullName(agent) {
  if (!agent) return "Unknown";
  const base = agent.surname && !String(agent.name || "").includes(agent.surname)
    ? `${agent.name || "Citizen"} ${agent.surname}`
    : (agent.name || "Citizen");
  return agent.epithet ? `${base} ${agent.epithet}` : base;
}

export function findSettlementBuilding(agent, simulation, settlement, types) {
  if (!simulation || !settlement) return null;
  const list = settlement.buildings && settlement.buildings.length > 0
    ? settlement.buildings
    : simulation.buildings;
  let best = null;
  let bestD = Infinity;
  for (const b of list) {
    if (!b || b.settlementId !== settlement.id) continue;
    if (!(b.complete || b.isComplete)) continue;
    if (!types.includes(b.buildingType)) continue;
    const d = agent.distanceTo(b);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

export function pickMarketSpot(agent, simulation, settlement) {
  if (!settlement || !settlement.center) return null;
  const t = tickOf(simulation);
  const angle = ((agent.id + Math.floor(t / 24)) % 8) * (Math.PI / 4);
  const radius = 2 + ((agent.id * 3) % 4);
  const x = settlement.center.x + Math.cos(angle) * radius;
  const y = settlement.center.y + Math.sin(angle) * radius;
  if (simulation.world && !simulation.world.isWalkable(Math.floor(x), Math.floor(y))) {
    return { x: settlement.center.x, y: settlement.center.y };
  }
  return { x, y };
}

export function pickPatrolPost(agent, simulation, settlement) {
  if (!settlement) return null;
  const civic = findSettlementBuilding(agent, simulation, settlement, ["castle", "tower", "temple"]);
  const anchor = civic || settlement.center;
  if (!anchor) return null;
  const t = tickOf(simulation);
  const angle = ((agent.id + Math.floor(t / 16)) % 8) * (Math.PI / 4);
  const radius = civic ? 5 : 9;
  const x = anchor.x + Math.cos(angle) * radius;
  const y = anchor.y + Math.sin(angle) * radius;
  if (simulation.world && !simulation.world.isWalkable(Math.floor(x), Math.floor(y))) {
    return { x: anchor.x, y: anchor.y };
  }
  return { x, y };
}

export function pickHearthSpot(agent, simulation, settlement) {
  if (!settlement || !settlement.center) return null;
  const t = tickOf(simulation);
  const angle = ((agent.id * 2 + Math.floor(t / 18)) % 8) * (Math.PI / 4);
  const radius = 1.2 + ((agent.id % 3) * 0.6);
  const x = settlement.center.x + Math.cos(angle) * radius;
  const y = settlement.center.y + Math.sin(angle) * radius;
  if (simulation.world && !simulation.world.isWalkable(Math.floor(x), Math.floor(y))) {
    return { x: settlement.center.x, y: settlement.center.y };
  }
  return { x, y };
}

export function pickPlaySpot(agent, simulation, settlement) {
  if (!settlement || !settlement.center) return null;
  const t = tickOf(simulation);
  const angle = ((agent.id * 3 + Math.floor(t / 12)) % 8) * (Math.PI / 4);
  const radius = 2.5 + ((agent.id % 4) * 1.2);
  const x = settlement.center.x + Math.cos(angle) * radius;
  const y = settlement.center.y + Math.sin(angle) * radius;
  if (simulation.world && !simulation.world.isWalkable(Math.floor(x), Math.floor(y))) {
    return { x: settlement.center.x, y: settlement.center.y };
  }
  return { x, y };
}

export function workshopHasDemand(ws, craftingSystem) {
  if (!ws || !craftingSystem) return false;
  if (ws.activeTask) return true;
  if (ws.queue.length === 0) return false;
  const tickNow = craftingSystem.simulation?.clock?.tick ?? 0;
  if (ws._demandTick === tickNow) return ws._demandResult === true;
  let result = false;
  for (const t of ws.queue) {
    const r = craftingSystem.recipes.get(t.recipeId);
    if (r && craftingSystem.canCraft(ws, r)) { result = true; break; }
  }
  ws._demandTick = tickNow;
  ws._demandResult = result;
  return result;
}

export function pickWorkshopSpot(agent, simulation, settlement) {
  if (!settlement) return null;
  const workshop = findSettlementBuilding(agent, simulation, settlement, ["workshop"]);
  if (workshop) {
    return { x: workshop.x, y: workshop.y, buildingId: workshop.id };
  }
  return settlement.center ? { x: settlement.center.x + 2, y: settlement.center.y - 1 } : null;
}

export function pickTempleSpot(agent, simulation, settlement) {
  if (!settlement) return null;
  const temple = findSettlementBuilding(agent, simulation, settlement, ["temple", "church", "shrine"]);
  if (temple) {
    return { x: temple.x, y: temple.y, buildingId: temple.id };
  }
  return settlement.center ? { x: settlement.center.x - 2, y: settlement.center.y - 2 } : null;
}

export function pickWellSpot(settlement) {
  if (!settlement || !settlement.center) return null;
  return { x: settlement.center.x, y: settlement.center.y };
}

export function resolveLiveTarget(targetOrAction, world) {
  const t = (targetOrAction && typeof targetOrAction === "object" && "target" in targetOrAction)
    ? targetOrAction.target
    : targetOrAction;
  if (!t || typeof t !== "object") return t ?? null;
  const needsResolve = t.id != null && typeof t.needs !== "object" && typeof t.total !== "function";
  if (needsResolve && world && typeof world.getEntityById === "function") {
    const ent = world.getEntityById(t.id);
    if (ent) return ent;
  }
  return t;
}

export function executeAction(agent, AgentClass, action, world, eventBus, craftingSystem, simulation) {
  agent.craftingSystem = craftingSystem || agent.craftingSystem;
  if (!action) return null;

  agent.currentAction = AgentClass.snapshotAction(action);

  switch (action.type) {
    case "build": {
      if (!action.target) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 2.5) {
        const sid = agent.settlementId || (simulation?.settlementSystem?.agentSettlementMap?.get(agent.id));
        const bType = action.target.buildingType || action.target.type || "house";
        const costSpec = BUILD_COSTS[bType] || { plank: 2 };
        const prevProg = action.target.constructionProgress || 0;
        const needsMaterial = prevProg === 0 || Math.floor(prevProg / 15) < Math.floor((prevProg + 5) / 15);
        let woodUsed = 0;
        let oreUsed = 0;
        if (needsMaterial) {
          if (sid && simulation?.settlementSystem) {
            woodUsed = simulation.settlementSystem.withdrawFromStockpile(sid, "wood", 1);
            if (woodUsed === 0 && (simulation.settlementSystem.settlements.get(sid)?.stockpile?.plank || 0) > 0) {
              woodUsed = simulation.settlementSystem.withdrawFromStockpile(sid, "plank", 1);
            }
          }
          if (woodUsed === 0 && (agent.inventory.wood_log || 0) > 0) {
            agent.inventory.wood_log--;
            woodUsed = 1;
          } else if (woodUsed === 0 && (agent.inventory.plank || 0) > 0) {
            agent.inventory.plank--;
            woodUsed = 1;
          }

          // Stone/iron buildings also consume ore/iron_ingot across construction milestones
          const oreNeed = Math.min(4, costSpec.iron_ingot || 0);
          if (oreNeed > 0 && (action.target._orePaid || 0) < oreNeed) {
            if (sid && simulation?.settlementSystem) {
              const st = simulation.settlementSystem.settlements.get(sid);
              if ((st?.stockpile?.ore || 0) > 2) {
                oreUsed = simulation.settlementSystem.withdrawFromStockpile(sid, "ore", 1);
              }
              if (oreUsed === 0 && (st?.stockpile?.iron_ingot || 0) > 0) {
                oreUsed = simulation.settlementSystem.withdrawFromStockpile(sid, "iron_ingot", 1);
              }
            }
            if (oreUsed === 0 && (agent.inventory.ore_iron || 0) > 0) {
              agent.inventory.ore_iron--;
              oreUsed = 1;
            } else if (oreUsed === 0 && (agent.inventory.iron_ingot || 0) > 0) {
              agent.inventory.iron_ingot--;
              oreUsed = 1;
            }
            if (oreUsed > 0) {
              action.target._orePaid = (action.target._orePaid || 0) + oreUsed;
            }
          }

          // Prestige buildings (e.g. Castle) consume a gem/jewel halfway through when available
          if ((costSpec.gem || 0) > 0 && !action.target._gemPaid && prevProg >= 45 && sid && simulation?.settlementSystem) {
            let gemUsed = simulation.settlementSystem.withdrawFromStockpile(sid, "gem", 1);
            if (gemUsed === 0) gemUsed = simulation.settlementSystem.withdrawFromStockpile(sid, "jewel", 1);
            if (gemUsed > 0) {
              action.target._gemPaid = (action.target._gemPaid || 0) + gemUsed;
              if (eventBus) {
                eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, settlementId: sid, resourceType: "gem", amount: gemUsed });
              }
            }
          }
        }

        const fullName = formatFullName(agent);
        if (!Array.isArray(action.target.contributors)) action.target.contributors = [];
        if (!action.target.contributors.some(c => c.id === agent.id) && action.target.contributors.length < 4) {
          action.target.contributors.push({ id: agent.id, name: fullName });
        }

        const progressInc = (!needsMaterial || woodUsed > 0 || oreUsed > 0) ? 5 : 2;
        action.target.constructionProgress = (action.target.constructionProgress || 0) + progressInc;
        agent.gainSkill("build", 0.05, 5, 1, tickOf(simulation));
        if (woodUsed > 0 && eventBus) {
          eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, settlementId: sid, resourceType: "wood", amount: woodUsed });
        }
        if (oreUsed > 0 && eventBus) {
          eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, settlementId: sid, resourceType: "ore", amount: oreUsed });
        }

        if (action.target.constructionProgress >= 100) {
          const wasComplete = action.target.complete === true;
          action.target.isComplete = true;
          action.target.complete = true;
          if (!wasComplete) {
            const tickNow = tickOf(simulation);
            const builtYear = Math.floor(tickNow / 400) + 1;
            const targetSid = action.target.settlementId ?? sid ?? null;
            const homeName = targetSid != null
              ? (simulation?.settlementSystem?.settlements?.get(targetSid)?.name || null)
              : null;
            const ageSummary = targetSid != null
              ? simulation?.civilizationAgeSystem?.getSettlementAge?.(targetSid)
              : simulation?.civilizationAgeSystem?.getDominantAge?.();
            const builtEraId = ageSummary?.ageId ?? ageSummary?.id ?? action.target.builtInEra ?? 1;
            const builtEraName = ageSummary?.name || "Tribal Era";

            if (!action.target.builtByAgentId) {
              action.target.builtByAgentId = agent.id;
              action.target.builtByName = fullName;
              action.target.builtYear = builtYear;
            }
            if (targetSid != null) {
              const targetSettlement = simulation?.settlementSystem?.settlements?.get(targetSid);
              if (targetSettlement) {
                if (!targetSettlement.stats) {
                  targetSettlement.stats = { births: 0, deaths: 0, buildingsBuilt: 0, warsFought: 0, battlesWon: 0, peakPopulation: targetSettlement.population || 0 };
                }
                targetSettlement.stats.buildingsBuilt = (targetSettlement.stats.buildingsBuilt || 0) + 1;
              }
            }
            action.target.builtInEra = builtEraId;
            action.target.builtEraName = builtEraName;
            agent.buildingsBuilt = (agent.buildingsBuilt || 0) + 1;
            const bType = action.target.buildingType || action.target.type || "structure";
            const bLabel = action.target.customName || bType.replace(/_/g, " ");
            const isGrand = String(bType).startsWith("monument_") || bType === "castle" || bType === "nuclear_plant" || bType === "research_lab" || Boolean(action.target.isHeritage);
            if (isGrand && !action.target.dedication) {
              action.target.dedication = `Raised in Year ${builtYear} (${builtEraName}) by ${fullName}${homeName ? ` of ${homeName}` : ""}`;
            }
            agent.addLifeEvent("BUILT", `Led construction of ${bLabel} (Year ${builtYear})`, tickNow, isGrand ? "🏛️" : "🔨", isGrand || agent.buildingsBuilt === 1);
          }
          if (eventBus) {
            eventBus.emit("CONSTRUCTION_COMPLETED", {
              buildingId: action.target.id,
              buildingType: action.target.buildingType || action.target.type,
              customName: action.target.customName || null,
              settlementId: action.target.settlementId ?? sid ?? null,
              builderId: agent.id,
              builderName: fullName,
              builtYear: action.target.builtYear ?? null,
              x: action.target.x,
              y: action.target.y
            });
          }
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "reproduce": {
      const mate = resolveLiveTarget(action, world);
      if (!mate || !mate.alive) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(mate) < 2.2) {
        agent.needs.social = Math.min(100, agent.needs.social + 20);
        agent.needs.food = Math.max(0, agent.needs.food - 7);
        agent.needs.water = Math.max(0, agent.needs.water - 7);
        agent.children++;
        const houseBonus = (agent.settlementId && agent.sim?.getSettlementBuildingBonus)
          ? agent.sim.getSettlementBuildingBonus(agent.settlementId, "house").count
          : 0;
        const townPop = agent.settlementId
          ? (agent.sim?.settlementSystem?.settlements?.get(agent.settlementId)?.population || 0)
          : 0;
        const cooldownTicks = (houseBonus * 3 > townPop) ? 270 : 340;
        agent.reproduceCooldown = cooldownTicks;

        mate.children++;
        mate.reproduceCooldown = cooldownTicks;
        mate.needs.social = Math.min(100, mate.needs.social + 20);

        const babyX = Math.max(2, Math.min(world.width - 2, agent.x + (agent.rng.next() - 0.5) * 2));
        const babyY = Math.max(2, Math.min(world.height - 2, agent.y + (agent.rng.next() - 0.5) * 2));

        if (eventBus) {
          eventBus.emit("AGENT_BORN", {
            parentId1: agent.id,
            parentId2: mate.id,
            x: babyX,
            y: babyY
          });
        }

        agent.currentAction = null;
        return { type: "birth", x: babyX, y: babyY, parentId1: agent.id, parentId2: mate.id };
      } else {
        agent.moveToward(mate, world);
      }
      break;
    }

    case "socialize": {
      const peer = resolveLiveTarget(action, world);
      if (!peer || !peer.alive) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(peer) < 2.5) {
        agent.needs.social = Math.min(100, agent.needs.social + 18);
        peer.needs.social = Math.min(100, peer.needs.social + 18);

        const relKey = `${peer.id}`;
        const currentRel = agent.relationships.get(relKey) || 0;
        agent.relationships.set(relKey, Math.min(100, currentRel + 6));

        if (simulation && simulation.relationshipSystem) {
          simulation.relationshipSystem.modifyRelationship(agent.id, peer.id, {
            friendship: 6,
            trust: 3
          });
        }

        if (eventBus) {
          eventBus.emit("RELATIONSHIP_CHANGED", {
            agentId1: agent.id,
            agentId2: peer.id,
            change: 6
          });
        }
        agent.remember("MADE_FRIEND", simulation?.clock?.tick ?? 0, { subjectId: peer.id, rep: 1 });
        if (typeof peer.remember === "function") {
          peer.remember("MADE_FRIEND", simulation?.clock?.tick ?? 0, { subjectId: agent.id, rep: 1 });
        }
        if (simulation?.relationshipSystem) {
          simulation.relationshipSystem.addMemory(agent.id, peer.id, {
            type: "positive", description: `Shared stories with ${peer.name}`, impact: 2
          });
        }
        agent._exchangeGossip(peer, tickOf(simulation));
        agent.currentAction = null;
      } else {
        agent.moveToward(peer, world);
      }
      break;
    }

    case "go_to_workplace": {
      const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
      if (workshop) {
        const workshopEntity = { x: workshop.x + 1, y: workshop.y + 1 };
        if (agent.distanceTo(workshopEntity) < 2) {
          agent.currentAction = null;
        } else {
          agent.moveToward(workshopEntity, world);
        }
      }
      break;
    }

    case "haul_to_workshop": {
      const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
      if (!workshop) { agent.workplace = null; agent.currentAction = null; break; }
      const site = { x: workshop.x + 1, y: workshop.y + 1 };
      if (agent.distanceTo(site) < 2) {
        const delivered = craftingSystem.deliverHaul(workshop.id, agent);
        if (delivered > 0 && eventBus) {
          eventBus.emit("HAUL_DELIVERED", { agentId: agent.id, workshopId: workshop.id, units: delivered });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(site, world);
      }
      break;
    }

    case "haul_to_workshop_feed": {
      const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
      if (!workshop) { agent.currentAction = null; break; }
      const site = { x: workshop.x + 1, y: workshop.y + 1 };
      if (agent.distanceTo(site) < 2) {
        const logHalf = Math.floor((agent.inventory.wood_log || 0) / 2);
        const oreHalf = Math.floor((agent.inventory.ore_iron || 0) / 2);
        const wheatHalf = Math.max(0, Math.floor(((agent.inventory.wheat || 0) - 1) / 2));
        let delivered = 0;
        if (logHalf > 0) { agent.inventory.wood_log -= logHalf; craftingSystem.depositToWorkshop(workshop.id, "wood_log", logHalf); delivered += logHalf; }
        if (oreHalf > 0) { agent.inventory.ore_iron -= oreHalf; craftingSystem.depositToWorkshop(workshop.id, "ore_iron", oreHalf); delivered += oreHalf; }
        if (wheatHalf > 0) { agent.inventory.wheat -= wheatHalf; craftingSystem.depositToWorkshop(workshop.id, "wheat", wheatHalf); delivered += wheatHalf; }
        if (delivered > 0 && eventBus) {
          eventBus.emit("HAUL_DELIVERED", { agentId: agent.id, workshopId: workshop.id, units: delivered });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(site, world);
      }
      break;
    }

    case "collect_bread": {
      const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
      if (!workshop) { agent.currentAction = null; break; }
      const site = { x: workshop.x + 1, y: workshop.y + 1 };
      if (agent.distanceTo(site) < 2) {
        const taken = craftingSystem.takeFromWorkshop(workshop.id, agent, "bread", 2);
        if (taken > 0) {
          agent.remember("GOOD_MEAL", simulation?.clock?.tick ?? 0, { food: "bread", from: "bakery" });
          let eaten = 0;
          while (eaten < taken && agent.needs.food < 75 && agent.inventory.bread > 0) {
            agent.inventory.bread--;
            agent.needs.food = Math.min(100, agent.needs.food + 45);
            eaten++;
          }
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(site, world);
      }
      break;
    }

    case "distribute_goods": {
      const workshop = craftingSystem ? craftingSystem.workshops.get(action.workplaceId) : null;
      if (!workshop) { agent.currentAction = null; break; }
      const site = { x: workshop.x + 1, y: workshop.y + 1 };
      if (agent.distanceTo(site) < 2) {
        let taken = craftingSystem.takeFromWorkshop(workshop.id, agent, "bread", 5);
        if (taken === 0) taken = craftingSystem.takeFromWorkshop(workshop.id, agent, "plank", 5);
        if (taken > 0) {
          const settlement = simulation?.settlementSystem?.getAgentSettlement?.(agent.id);
          let deposited = 0;
          if (settlement) {
            if (agent.inventory.bread > 0) {
              simulation.settlementSystem.depositToStockpile(settlement.id, "bread", agent.inventory.bread);
              if (eventBus) eventBus.emit("STOCKPILE_DEPOSITED", { settlementId: settlement.id, resource: "bread", units: agent.inventory.bread });
              deposited += agent.inventory.bread;
              agent.inventory.bread = 0;
            }
            if (agent.inventory.plank > 0) {
              simulation.settlementSystem.depositToStockpile(settlement.id, "plank", agent.inventory.plank);
              if (eventBus) eventBus.emit("STOCKPILE_DEPOSITED", { settlementId: settlement.id, resource: "plank", units: agent.inventory.plank });
              deposited += agent.inventory.plank;
              agent.inventory.plank = 0;
            }
          }
          if (deposited > 0 && eventBus) {
            eventBus.emit("GOODS_DISTRIBUTED", { agentId: agent.id, workshopId: workshop.id, units: taken });
          }
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(site, world);
      }
      break;
    }

    case "eat_from_inventory":
      if (agent.inventory.bread > 0) {
        agent.inventory.bread--;
        const wasHungry = agent.needs.food < 40;
        agent.needs.food = Math.min(100, agent.needs.food + 45);
        if (wasHungry) agent.remember("GOOD_MEAL", simulation?.clock?.tick ?? 0, { food: "bread" });
        if (eventBus) {
          eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, resourceType: "bread", amount: 1 });
        }
        agent.currentAction = null;
      } else if (agent.inventory.wheat > 0) {
        agent.inventory.wheat--;
        const wasHungry2 = agent.needs.food < 40;
        agent.needs.food = Math.min(100, agent.needs.food + 25);
        if (wasHungry2) agent.remember("GOOD_MEAL", simulation?.clock?.tick ?? 0, { food: "wheat" });
        if (eventBus) {
          eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, resourceType: "wheat", amount: 1 });
        }
        agent.currentAction = null;
      }
      break;

    case "scavenge": {
      const pile = resolveLiveTarget(action, world);
      if (!pile || pile.destroyed || pile.total() <= 0) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(pile) < 1.8) {
        const EDIBLE = ["bread", "wheat", "meat"];
        const held = Object.values(agent.inventory).reduce((a, b) => typeof b === "number" && b > 0 ? a + b : a, 0) - (agent.inventory.capacity || 0);
        let freeSpace = Math.max(0, (agent.inventory.capacity || 15) - Math.max(0, held));
        for (const key of Object.keys(pile.contents)) {
          while (pile.contents[key] > 0) {
            const wantEat = agent.needs.food < 60 && EDIBLE.includes(key);
            if (wantEat) {
              pile.contents[key]--;
              const gain = key === "bread" ? 45 : key === "meat" ? 35 : 25;
              agent.needs.food = Math.min(100, agent.needs.food + gain);
              agent.remember("GOOD_MEAL", simulation?.clock?.tick ?? 0, { food: key, scavenged: true });
            } else if (freeSpace > 0) {
              pile.contents[key]--;
              agent.inventory[key] = (agent.inventory[key] || 0) + 1;
              freeSpace--;
            } else {
              break;
            }
          }
        }
        if (pile.total() <= 0) pile.destroyed = true;
        agent.currentAction = null;
      } else {
        agent.moveToward(pile, world);
      }
      break;
    }

    case "gather_food":
      if (!action.target || action.target.amount <= 0 || action.target.depleted) {
        agent._harvestTicks = 0;
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 1.8) {
        if ((agent.needs?.food ?? 100) >= 25 && (agent._harvestTicks || 0) < 1) {
          agent._harvestTicks = (agent._harvestTicks || 0) + 1;
          break;
        }
        agent._harvestTicks = 0;
        if (action.target.normalLabel) action.target.label = action.target.normalLabel;
        if (typeof action.target.consume === "function") {
          action.target.consume(1.5, world);
        } else {
          action.target.amount = Math.max(0, action.target.amount - 1.5);
          if (action.target.amount <= 0 && typeof action.target.markDepleted === "function") {
            action.target.markDepleted(world);
          }
        }
        if ((action.target.amount <= 0 || action.target.depleted) && eventBus) {
          eventBus.emit("RESOURCE_DEPLETED", {
            agentId: agent.id,
            resourceType: "food",
            x: action.target.x,
            y: action.target.y
          });
        }
        agent.inventory.wheat = (agent.inventory.wheat || 0) + 1;
        agent.needs.food = Math.min(100, agent.needs.food + 30);
        {
          const stageMul = agent.lifeStage === "child" ? 1.5 : (agent.lifeStage === "elder" ? 0.5 : 1.0);
          agent.gainSkill("farm", 0.05 * stageMul, 5, 1, tickOf(simulation));
          agent.rememberNode(Math.floor(action.target.x), Math.floor(action.target.y),
            "food", action.target.amount || 1, tickOf(simulation));
        }
        if (simulation?.warfareSystem?.combatEffects && simulation.warfareSystem.combatEffects.length < 44) {
          simulation.warfareSystem.combatEffects.push({
            x: action.target.x,
            y: action.target.y,
            type: "resource_gain",
            label: "+1 🌾",
            duration: 20
          });
        }
        if (eventBus) {
          eventBus.emit("RESOURCE_GATHERED", {
            agentId: agent.id,
            resourceType: "wheat",
            x: action.target.x,
            y: action.target.y
          });
        }
        agent.currentAction = null;
      } else {
        agent._harvestTicks = 0;
        if (agent.pioneer && action.campTarget) {
          const mid = {
            x: (action.target.x + action.campTarget.x) / 2,
            y: (action.target.y + action.campTarget.y) / 2
          };
          agent.moveToward(mid, world);
        } else {
          agent.moveToward(action.target, world);
        }
      }
      break;

    case "chop_wood":
      if (!action.target || action.target.amount <= 0 || action.target.depleted) {
        agent._harvestTicks = 0;
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 1.8) {
        if ((agent._harvestTicks || 0) < 1) {
          agent._harvestTicks = (agent._harvestTicks || 0) + 1;
          break;
        }
        agent._harvestTicks = 0;
        if (action.target.normalLabel) action.target.label = action.target.normalLabel;
        if (typeof action.target.consume === "function") {
          action.target.consume(1.5, world);
        } else {
          action.target.amount = Math.max(0, action.target.amount - 1.5);
          if (action.target.amount <= 0 && typeof action.target.markDepleted === "function") {
            action.target.markDepleted(world);
          }
        }
        if ((action.target.amount <= 0 || action.target.depleted) && eventBus) {
          eventBus.emit("RESOURCE_DEPLETED", {
            agentId: agent.id,
            resourceType: "wood",
            x: action.target.x,
            y: action.target.y
          });
        }
        agent.inventory.wood_log = (agent.inventory.wood_log || 0) + 1;
        {
          const stageMul = agent.lifeStage === "child" ? 1.5 : (agent.lifeStage === "elder" ? 0.5 : 1.0);
          agent.gainSkill("gather", 0.05 * stageMul, 5, 1, tickOf(simulation));
          agent.rememberNode(Math.floor(action.target.x), Math.floor(action.target.y),
            "wood", action.target.amount || 1, tickOf(simulation));
        }
        if (simulation?.warfareSystem?.combatEffects && simulation.warfareSystem.combatEffects.length < 44) {
          simulation.warfareSystem.combatEffects.push({
            x: action.target.x,
            y: action.target.y,
            type: "resource_gain",
            label: "+1 🪵",
            duration: 20
          });
        }
        if (eventBus) {
          eventBus.emit("RESOURCE_GATHERED", {
            agentId: agent.id,
            resourceType: "wood",
            x: action.target.x,
            y: action.target.y
          });
        }
        agent.currentAction = null;
      } else {
        agent._harvestTicks = 0;
        agent.moveToward(action.target, world);
      }
      break;

    case "mine_ore":
      if (!action.target || action.target.amount <= 0 || action.target.depleted) {
        agent._harvestTicks = 0;
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 1.8) {
        const reqEra = action.target.requiredEraId || (action.target.resourceType === "uranium" ? 6 : 1);
        if (reqEra > 1) {
          const sid = agent.settlementId || simulation?.settlementSystem?.agentSettlementMap?.get(agent.id) || null;
          const eraId = sid != null ? (simulation?.civilizationAgeSystem?.getSettlementAge?.(sid)?.ageId || 1) : 1;
          if (eraId < reqEra) {
            agent._harvestTicks = 0;
            agent.currentAction = null;
            break;
          }
        }
        if ((agent._harvestTicks || 0) < 1) {
          agent._harvestTicks = (agent._harvestTicks || 0) + 1;
          break;
        }
        agent._harvestTicks = 0;
        if (action.target.normalLabel) action.target.label = action.target.normalLabel;
        const isGemNode = action.target.resourceType === "gem";
        const isUraniumNode = action.target.resourceType === "uranium";
        const isIronMountain = action.target.depositTier === "iron_mountain";
        const harvestUnits = isIronMountain ? 3.0 : isUraniumNode ? 2.5 : 2.0;
        if (typeof action.target.consume === "function") {
          action.target.consume(harvestUnits, world);
        } else {
          action.target.amount = Math.max(0, action.target.amount - harvestUnits);
          if (action.target.amount <= 0 && typeof action.target.markDepleted === "function") {
            action.target.markDepleted(world);
          }
        }
        const minedType = isUraniumNode ? "uranium" : (isGemNode ? "gem" : "ore");
        if ((action.target.amount <= 0 || action.target.depleted) && eventBus) {
          eventBus.emit("RESOURCE_DEPLETED", {
            agentId: agent.id,
            resourceType: minedType,
            x: action.target.x,
            y: action.target.y
          });
        }
        if (isUraniumNode) {
          agent.inventory.uranium = (agent.inventory.uranium || 0) + 1;
        } else if (isGemNode) {
          agent.inventory.gem_raw = (agent.inventory.gem_raw || 0) + 1;
        } else {
          agent.inventory.ore_iron = (agent.inventory.ore_iron || 0) + (isIronMountain ? 2 : 1);
        }
        {
          const stageMul = agent.lifeStage === "child" ? 1.5 : (agent.lifeStage === "elder" ? 0.5 : 1.0);
          agent.gainSkill("gather", 0.05 * stageMul, 5, 1, tickOf(simulation));
          agent.rememberNode(Math.floor(action.target.x), Math.floor(action.target.y),
            minedType, action.target.amount || 1, tickOf(simulation));
        }
        if (simulation?.warfareSystem?.combatEffects && simulation.warfareSystem.combatEffects.length < 44) {
          simulation.warfareSystem.combatEffects.push({
            x: action.target.x,
            y: action.target.y,
            type: "resource_gain",
            label: isUraniumNode ? "+1 ☢️" : isGemNode ? "+1 💎" : (isIronMountain ? "+2 ⛏️" : "+1 ⛏️"),
            duration: 20
          });
        }
        if (eventBus) {
          eventBus.emit("RESOURCE_GATHERED", {
            agentId: agent.id,
            resourceType: minedType,
            x: action.target.x,
            y: action.target.y
          });
        }
        agent.currentAction = null;
      } else {
        agent._harvestTicks = 0;
        agent.moveToward(action.target, world);
      }
      break;

    case "drink_water":
      if (!action.target || action.target.amount <= 0 || action.target.depleted) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 1.8) {
        agent.needs.water = Math.min(100, agent.needs.water + 45);
        if (typeof action.target.consume === "function") {
          action.target.consume(2.5, world);
        } else if (typeof action.target.amount === "number" && action.target.amount > 0) {
          action.target.amount = Math.max(0, action.target.amount - 2.5);
          if (action.target.amount <= 0 && typeof action.target.markDepleted === "function") {
            action.target.markDepleted(world);
          }
        }
        if ((action.target.amount <= 0 || action.target.depleted) && eventBus) {
          eventBus.emit("RESOURCE_DEPLETED", {
            agentId: agent.id,
            resourceType: "water",
            x: action.target.x,
            y: action.target.y
          });
        }
        if (eventBus) {
          eventBus.emit("RESOURCE_CONSUMED", {
            agentId: agent.id,
            resourceType: "water",
            amount: 2.5
          });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;

    case "rest":
      agent.needs.rest = Math.min(100, agent.needs.rest + 10);
      if (agent.needs.rest > 90) {
        agent.currentAction = null;
      }
      break;

    case "go_home_and_rest": {
      if (!action.target) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 2.5) {
        agent.needs.rest = Math.min(100, agent.needs.rest + 14);
        if (agent.needs.rest > 85) {
          agent.restCycles++;
          agent.currentAction = null;
        }
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "gather_at_hearth": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.0) {
        agent.needs.social = Math.min(100, agent.needs.social + 10);
        agent.needs.rest = Math.min(100, agent.needs.rest + 4);
        const hearthTick = tickOf(simulation);
        const hearthNear = typeof world._getScan === "function"
          ? world._getScan(Math.floor(agent.x), Math.floor(agent.y), 4)
          : world.getEntitiesNear(Math.floor(agent.x), Math.floor(agent.y), 4);
        for (const other of hearthNear) {
          if (other.type === "agent" && other.id !== agent.id && other.alive) {
            other.needs.social = Math.min(100, other.needs.social + 4);
            if (simulation && simulation.relationshipSystem) {
              simulation.relationshipSystem.modifyRelationship(agent.id, other.id, { friendship: 1 });
            }
            agent._exchangeGossip(other, hearthTick);
          }
        }
        if (eventBus) {
          eventBus.emit("HEARTH_GATHER", { agentId: agent.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "watch_crafts": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.4) {
        agent.needs.social = Math.min(100, agent.needs.social + 5);
        const appMul = agent.lifeStage === "child" ? 2.0 : 1.0;
        agent.gainSkill("craft", 0.02 * appMul, 5, 1, tickOf(simulation));
        if (agent.lifeStage === "child") {
          agent.gainSkill("carpentry", 0.01, 5, 2, tickOf(simulation));
          agent.gainSkill("milling", 0.01, 5, 2, tickOf(simulation));
          agent.gainSkill("cooking", 0.01, 5, 2, tickOf(simulation));
        }
        if (eventBus) {
          eventBus.emit("CRAFT_WATCH", { agentId: agent.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "train_at_barracks": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.2) {
        agent.needs.rest = Math.max(0, agent.needs.rest - 0.4);
        agent.gainSkill("combat", 0.03, 5, 1, tickOf(simulation));
        if (eventBus) {
          eventBus.emit("TRAINING", { agentId: agent.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "play_in_town": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.2) {
        agent.needs.social = Math.min(100, agent.needs.social + 12);
        agent.needs.rest = Math.max(0, agent.needs.rest - 0.2);
        if (eventBus) {
          eventBus.emit("CHILD_PLAY", { agentId: agent.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world, 1.2);
      }
      break;
    }

    case "fetch_town_water": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.2) {
        agent.needs.water = Math.min(100, agent.needs.water + 65);
        const sid = agent.settlementId || (simulation?.settlementSystem?.agentSettlementMap?.get(agent.id));
        if (sid && simulation?.settlementSystem) {
          simulation.settlementSystem.withdrawFromStockpile(sid, "water", 1);
        }
        if (action.target && typeof action.target.consume === "function") {
          action.target.consume(2.0, world);
        }
        if (eventBus) {
          eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, settlementId: sid, resourceType: "water", amount: 1 });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "tend_town_farm": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.4) {
        agent.skills.farm = (agent.skills.farm || 1.0) + 0.03;
        if (eventBus) {
          eventBus.emit("FARMING", { agentId: agent.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "visit_market": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 1.6) {
        agent.needs.social = Math.min(100, agent.needs.social + 8);
        const marketTick = tickOf(simulation);
        const marketNear = typeof world._getScan === "function"
          ? world._getScan(Math.floor(agent.x), Math.floor(agent.y), 3)
          : world.getEntitiesNear(Math.floor(agent.x), Math.floor(agent.y), 3);
        for (const other of marketNear) {
          if (other.type === "agent" && other.id !== agent.id && other.alive) {
            other.needs.social = Math.min(100, other.needs.social + 3);
            if (simulation && simulation.relationshipSystem) {
              simulation.relationshipSystem.modifyRelationship(agent.id, other.id, { friendship: 1 });
            }
            agent._exchangeGossip(other, marketTick);
          }
        }
        if (eventBus) {
          eventBus.emit("MARKET_VISIT", { agentId: agent.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "patrol_settlement": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 1.8) {
        agent.needs.rest = Math.max(0, agent.needs.rest - 0.5);
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "pray_at_temple": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 2.2) {
        agent.needs.social = Math.min(100, agent.needs.social + 6);
        if (eventBus) {
          eventBus.emit("PRAYER", { agentId: agent.id, buildingId: action.target.id, x: agent.x, y: agent.y });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "conjure_fallen": {
      if (!action.target) { agent.currentAction = null; break; }
      const anchor = resolveLiveTarget(action, world) || action.target;
      if (agent.distanceTo(anchor) < 2.5) {
        if (simulation?.religionSystem?.conjureFallenSpirit) {
          simulation.religionSystem.conjureFallenSpirit(agent, anchor);
        }
        agent.needs.social = Math.min(100, agent.needs.social + 6);
        agent.currentAction = null;
      } else {
        agent.moveToward(anchor, world);
      }
      break;
    }

    case "wander_to_town": {
      if (!action.target) { agent.currentAction = null; break; }
      if (agent.distanceTo(action.target) < 3.0) {
        agent.needs.social = Math.min(100, (agent.needs.social ?? 50) + 15);
        const hostId = action.target.settlementId ?? action.settlementId ?? null;
        if (hostId != null && simulation?.settlementSystem?.settlements) {
          const host = simulation.settlementSystem.settlements.get(hostId);
          if (host && host.agentIds) {
            let met = 0;
            for (const aid of host.agentIds) {
              const other = simulation._agentById(aid);
              if (other && other.alive && other.id !== agent.id) {
                if (simulation.relationshipSystem) {
                  simulation.relationshipSystem.modifyRelationship(agent.id, other.id, { friendship: 2 });
                }
                if (typeof agent._exchangeGossip === "function") {
                  agent._exchangeGossip(other, tickOf(simulation));
                }
                met++;
                if (met >= 2) break;
              }
            }
          }
          if (agent.settlementId != null && agent.settlementId !== hostId && simulation.diplomacySystem) {
            const rel = simulation.diplomacySystem.getRelation(agent.settlementId, hostId);
            if (rel && rel.status !== "war") {
              rel.score = Math.min(100, (rel.score ?? 50) + 0.5);
              rel.tradeVisits = (rel.tradeVisits || 0) + 1;
            }
          }
          if (eventBus) {
            eventBus.emit("INTERTOWN_VISIT", {
              agentId: agent.id,
              fromSettlementId: agent.settlementId ?? null,
              toSettlementId: hostId,
              x: agent.x,
              y: agent.y
            });
          }
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;
    }

    case "visit_neighbor": {
      const neighbor = resolveLiveTarget(action, world);
      if (!neighbor || !neighbor.alive) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(neighbor) < 2.5) {
        agent.needs.social = Math.min(100, agent.needs.social + 12);
        neighbor.needs.social = Math.min(100, neighbor.needs.social + 6);
        if (simulation && simulation.relationshipSystem) {
          simulation.relationshipSystem.modifyRelationship(agent.id, neighbor.id, {
            friendship: 3
          });
        }
        agent._exchangeGossip(neighbor, tickOf(simulation));
        agent.currentAction = null;
      } else {
        agent.moveToward(neighbor, world);
      }
      break;
    }

    case "return_home":
      if (!action.target) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 2.5) {
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;

    case "deposit_to_stockpile":
      if (!action.target) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 3.0) {
        if (simulation && simulation.settlementSystem) {
          const sid = agent.settlementId || simulation.settlementSystem.agentSettlementMap.get(agent.id);
          if (sid) {
            if (agent.inventory.wood_log > 0) {
              simulation.settlementSystem.depositToStockpile(sid, "wood", agent.inventory.wood_log);
              agent.inventory.wood_log = 0;
            }
            if (agent.inventory.ore_iron > 0) {
              simulation.settlementSystem.depositToStockpile(sid, "ore", agent.inventory.ore_iron);
              agent.inventory.ore_iron = 0;
            }
            if (agent.inventory.uranium > 0) {
              simulation.settlementSystem.depositToStockpile(sid, "uranium", agent.inventory.uranium);
              agent.inventory.uranium = 0;
            }
            if (agent.inventory.gem_raw > 0) {
              simulation.settlementSystem.depositToStockpile(sid, "gem", agent.inventory.gem_raw);
              agent.inventory.gem_raw = 0;
            }
            if (agent.inventory.wheat > 1) {
              const donate = agent.inventory.wheat - 1;
              simulation.settlementSystem.depositToStockpile(sid, "food", donate);
              agent.inventory.wheat = 1;
            }
            if (agent.inventory.meat > 0) {
              simulation.settlementSystem.depositToStockpile(sid, "food", agent.inventory.meat * 6);
              agent.inventory.meat = 0;
            }
            if (agent.inventory.hide > 0) {
              simulation.settlementSystem.depositToStockpile(sid, "hide", agent.inventory.hide);
              agent.inventory.hide = 0;
            }
          }
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;

    case "eat_from_stockpile":
      if (!action.target) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(action.target) < 3.0) {
        if (simulation && simulation.settlementSystem) {
          const sid = agent.settlementId || simulation.settlementSystem.agentSettlementMap.get(agent.id);
          if (sid) {
            let taken = simulation.settlementSystem.withdrawFromStockpile(sid, "food", 1);
            if (taken === 0) taken = simulation.settlementSystem.withdrawFromStockpile(sid, "bread", 1);
            if (taken > 0) {
              agent.needs.food = Math.min(100, agent.needs.food + 45);
              agent.remember("GOOD_MEAL", simulation?.clock?.tick ?? 0, { food: "stockpile", from: "settlement" });
              if (eventBus) {
                eventBus.emit("RESOURCE_CONSUMED", { agentId: agent.id, settlementId: sid, resourceType: "food", amount: taken });
              }
            }
          }
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(action.target, world);
      }
      break;

    case "military_duty":
      agent.currentAction = null;
      break;

    case "hunt": {
      const prey = resolveLiveTarget(action, world);
      if (!prey || prey.alive === false) {
        agent.currentAction = null;
        break;
      }
      if (agent.distanceTo(prey) < 1.6) {
        const gain = prey.species === "boar" ? 38 : 30;
        prey.alive = false;
        agent.needs.food = Math.min(100, agent.needs.food + gain);
        agent.inventory.meat = (agent.inventory.meat || 0) + 2;
        agent.inventory.hide = (agent.inventory.hide || 0) + 1;
        agent.gainSkill("hunt", 0.06, 5, 1, tickOf(simulation));
        simulation?.animalSystem?.removeAnimal?.(prey);
        if (eventBus) {
          eventBus.emit("ANIMAL_KILLED", {
            species: prey.species, x: prey.x, y: prey.y, by: agent.id
          });
          eventBus.emit("RESOURCE_GATHERED", {
            agentId: agent.id, resourceType: "meat", x: prey.x, y: prey.y
          });
        }
        agent.currentAction = null;
      } else {
        agent.moveToward(prey, world, 1.5);
        agent.currentAction = AgentClass.snapshotAction(action);
      }
      break;
    }

    case "flee": {
      const threat = action.target || agent.fleeFrom;
      if (!threat) { agent.currentAction = null; break; }
      let awayX = agent.x - threat.x;
      let awayY = agent.y - threat.y;
      const mag = Math.hypot(awayX, awayY) || 1;
      awayX /= mag;
      awayY /= mag;
      const veerAngle = ((agent.id % 7) - 3) * 0.18;
      const cosV = Math.cos(veerAngle);
      const sinV = Math.sin(veerAngle);
      const dirX = awayX * cosV - awayY * sinV;
      const dirY = awayX * sinV + awayY * cosV;
      const runDist = 6;
      const margin = 4;
      let destX = Math.max(margin, Math.min((world.width || 160) - margin, agent.x + dirX * runDist));
      let destY = Math.max(margin, Math.min((world.height || 160) - margin, agent.y + dirY * runDist));
      if (!world.isWalkable(Math.floor(destX), Math.floor(destY))) {
        const alt = [
          { x: agent.x + dirY * runDist, y: agent.y - dirX * runDist },
          { x: agent.x - dirY * runDist, y: agent.y + dirX * runDist },
          { x: agent.x + dirX * 3, y: agent.y + dirY * 3 }
        ];
        for (const cand of alt) {
          const cx = Math.max(margin, Math.min((world.width || 160) - margin, cand.x));
          const cy = Math.max(margin, Math.min((world.height || 160) - margin, cand.y));
          if (world.isWalkable(Math.floor(cx), Math.floor(cy))) { destX = cx; destY = cy; break; }
        }
      }
      agent.moveToward({ x: destX, y: destY }, world, 1.8);
      agent.needs.rest = Math.max(0, agent.needs.rest - 0.15);
      agent.currentAction = null;
      break;
    }

    case "wander": {
      agent.wanderTicks = (agent.wanderTicks || 0) + 1;

      if (!agent.path || agent.path.length === 0 || agent.wanderTicks > 12) {
        agent.wanderTicks = 0;

        const margin = 8;
        let centerX = world.width / 2;
        let centerY = world.height / 2;

        if (simulation && simulation.settlementSystem) {
          const sid = agent.settlementId || simulation.settlementSystem.agentSettlementMap.get(agent.id);
          if (sid) {
            const s = simulation.settlementSystem.settlements.get(sid);
            if (s && s.center) {
              centerX = s.center.x;
              centerY = s.center.y;
            }
          } else if (agent.pioneer) {
            centerX = agent.spawnX ?? agent.x;
            centerY = agent.spawnY ?? agent.y;
          }
        }

        let targetX = agent.x;
        let targetY = agent.y;

        const nearLeft = agent.x < 12;
        const nearRight = agent.x > world.width - 12;
        const nearTop = agent.y < 12;
        const nearBottom = agent.y > world.height - 12;

        if (nearLeft || nearRight || nearTop || nearBottom) {
          const dirX = Math.sign(centerX - agent.x);
          const dirY = Math.sign(centerY - agent.y);
          targetX = agent.x + dirX * (5 + agent.rng.next() * 6);
          targetY = agent.y + dirY * (5 + agent.rng.next() * 6);
        } else {
          const distFromTown = Math.hypot(agent.x - centerX, agent.y - centerY);
          if (distFromTown > 16) {
            const dirX = Math.sign(centerX - agent.x);
            const dirY = Math.sign(centerY - agent.y);
            targetX = agent.x + dirX * (3 + agent.rng.next() * 4);
            targetY = agent.y + dirY * (3 + agent.rng.next() * 4);
          } else {
            const angle = agent.rng.next() * Math.PI * 2;
            const dist = 2 + agent.rng.next() * 4;
            targetX = agent.x + Math.cos(angle) * dist;
            targetY = agent.y + Math.sin(angle) * dist;
          }
        }

        targetX = Math.max(margin, Math.min(world.width - margin, targetX));
        targetY = Math.max(margin, Math.min(world.height - margin, targetY));

        if (!world.isWalkable(Math.floor(targetX), Math.floor(targetY))) {
          targetX = agent.x + Math.sign(centerX - agent.x) * 2;
          targetY = agent.y + Math.sign(centerY - agent.y) * 2;
        }

        agent.path = [{ x: targetX, y: targetY }];
        agent._pathGoalKey = `${Math.floor(targetX)},${Math.floor(targetY)}`;
      }

      if (agent.path && agent.path.length > 0) {
        const dest = agent.path[agent.path.length - 1];
        agent.moveToward(dest, world);
        if (agent.path && agent.path.length > 0 && agent.distanceTo(dest) < 1.2) {
          agent.path = null;
          agent._pathGoalKey = null;
          agent.currentAction = null;
          agent.wanderTicks = 0;
        }
      }
      break;
    }
  }

  return null;
}

function canStepTile(tx, ty, world, agent, isFlyingUnit) {
  if (!world || tx < 1 || ty < 1 || tx >= world.width - 1 || ty >= world.height - 1) return false;
  if (isFlyingUnit) return true;
  return world.isTilePassableForAgent
    ? world.isTilePassableForAgent(tx, ty, agent)
    : world.isWalkable(tx, ty);
}

function hasClearLineOfSight(x0, y0, x1, y1, world, agent, isFlyingUnit) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist <= 1.2) return true;
  const maxCheck = Math.min(dist, 24);
  const steps = Math.ceil(maxCheck / 0.75);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = Math.floor(x0 + dx * (maxCheck / dist) * t);
    const py = Math.floor(y0 + dy * (maxCheck / dist) * t);
    if (!canStepTile(px, py, world, agent, isFlyingUnit)) return false;
  }
  return true;
}

const ASTAR_DIRS = [
  [1, 0, 1.0], [-1, 0, 1.0], [0, 1, 1.0], [0, -1, 1.0],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]
];

let _astarSize = 0;
let _astarStamp = 0;
let _astarClosedStamp = null;
let _astarSeenStamp = null;
let _astarG = null;
let _astarParent = null;
const _astarHeapK = new Int32Array(4096);
const _astarHeapF = new Float64Array(4096);

function ensureAStarBuffers(totalTiles) {
  if (_astarSize !== totalTiles) {
    _astarSize = totalTiles;
    _astarClosedStamp = new Int32Array(totalTiles);
    _astarSeenStamp = new Int32Array(totalTiles);
    _astarG = new Float64Array(totalTiles);
    _astarParent = new Int32Array(totalTiles);
    _astarStamp = 0;
  }
  _astarStamp++;
  if (_astarStamp >= 0x7fffffff) {
    _astarClosedStamp.fill(0);
    _astarSeenStamp.fill(0);
    _astarStamp = 1;
  }
  return _astarStamp;
}

function findLocalAStarPath(startX, startY, goalX, goalY, world, agent) {
  const W = world.width;
  const H = world.height;
  const sx = Math.max(1, Math.min(W - 2, Math.floor(startX)));
  const sy = Math.max(1, Math.min(H - 2, Math.floor(startY)));
  const gx = Math.max(1, Math.min(W - 2, Math.floor(goalX)));
  const gy = Math.max(1, Math.min(H - 2, Math.floor(goalY)));
  if (sx === gx && sy === gy) return null;

  const radius = 22;
  const minX = Math.max(1, Math.min(sx, gx) - radius);
  const maxX = Math.min(W - 2, Math.max(sx, gx) + radius);
  const minY = Math.max(1, Math.min(sy, gy) - radius);
  const maxY = Math.min(H - 2, Math.max(sy, gy) + radius);

  const stamp = ensureAStarBuffers(W * H);
  const closedStamp = _astarClosedStamp;
  const seenStamp = _astarSeenStamp;
  const gScore = _astarG;
  const cameFrom = _astarParent;

  const startKey = sy * W + sx;
  const goalKey = gy * W + gx;
  const startH = Math.hypot(gx - sx, gy - sy);

  seenStamp[startKey] = stamp;
  gScore[startKey] = 0;
  cameFrom[startKey] = -1;

  let heapLen = 1;
  _astarHeapK[0] = startKey;
  _astarHeapF[0] = startH;

  let bestKey = startKey;
  let bestDist = startH;
  let expansions = 0;
  const maxExpansions = 260;
  const hasIsRoad = typeof world.isRoad === "function";

  while (heapLen > 0 && expansions < maxExpansions) {
    const ck = _astarHeapK[0];
    heapLen--;
    if (heapLen > 0) {
      const lastK = _astarHeapK[heapLen];
      const lastF = _astarHeapF[heapLen];
      let idx = 0;
      const half = heapLen >> 1;
      while (idx < half) {
        let child = (idx << 1) + 1;
        let childF = _astarHeapF[child];
        let childK = _astarHeapK[child];
        const right = child + 1;
        if (right < heapLen) {
          const rf = _astarHeapF[right];
          const rk = _astarHeapK[right];
          if (rf < childF || (rf === childF && rk < childK)) {
            child = right;
            childF = rf;
            childK = rk;
          }
        }
        if (lastF < childF || (lastF === childF && lastK <= childK)) break;
        _astarHeapK[idx] = childK;
        _astarHeapF[idx] = childF;
        idx = child;
      }
      _astarHeapK[idx] = lastK;
      _astarHeapF[idx] = lastF;
    }

    if (closedStamp[ck] === stamp) continue;
    closedStamp[ck] = stamp;
    expansions++;

    const cx = ck % W;
    const cy = (ck / W) | 0;
    const distToGoal = Math.hypot(gx - cx, gy - cy);
    if (distToGoal < bestDist) {
      bestDist = distToGoal;
      bestKey = ck;
    }

    if (ck === goalKey || (distToGoal <= 1.5 && canStepTile(cx, cy, world, agent, false))) {
      bestKey = ck;
      break;
    }

    const cg = gScore[ck];
    // Cache cardinal passability checks (E, W, S, N) for diagonal corner-cut checks
    let cardPass0 = -1, cardPass1 = -1, cardPass2 = -1, cardPass3 = -1;

    for (let d = 0; d < 8; d++) {
      const dx = ASTAR_DIRS[d][0];
      const dy = ASTAR_DIRS[d][1];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const nk = ny * W + nx;
      if (closedStamp[nk] === stamp) continue;

      const pass = canStepTile(nx, ny, world, agent, false);
      if (d === 0) cardPass0 = pass ? 1 : 0;
      else if (d === 1) cardPass1 = pass ? 1 : 0;
      else if (d === 2) cardPass2 = pass ? 1 : 0;
      else if (d === 3) cardPass3 = pass ? 1 : 0;
      if (!pass) continue;

      // Prevent corner-cutting through solid diagonals
      if (d >= 4) {
        const pxOk = dx > 0
          ? (cardPass0 !== -1 ? cardPass0 === 1 : canStepTile(cx + 1, cy, world, agent, false))
          : (cardPass1 !== -1 ? cardPass1 === 1 : canStepTile(cx - 1, cy, world, agent, false));
        if (!pxOk) {
          const pyOk = dy > 0
            ? (cardPass2 !== -1 ? cardPass2 === 1 : canStepTile(cx, cy + 1, world, agent, false))
            : (cardPass3 !== -1 ? cardPass3 === 1 : canStepTile(cx, cy - 1, world, agent, false));
          if (!pyOk) continue;
        }
      }

      const roadMul = (hasIsRoad && world.isRoad(nx, ny)) ? 0.72 : 1.0;
      const tentativeG = cg + ASTAR_DIRS[d][2] * roadMul;
      if (seenStamp[nk] !== stamp || tentativeG < gScore[nk]) {
        cameFrom[nk] = ck;
        gScore[nk] = tentativeG;
        seenStamp[nk] = stamp;
        const h = Math.hypot(gx - nx, gy - ny);
        const nf = tentativeG + h * 1.15;
        if (heapLen < _astarHeapK.length) {
          let i = heapLen++;
          while (i > 0) {
            const p = (i - 1) >> 1;
            const pf = _astarHeapF[p];
            const pk = _astarHeapK[p];
            if (pf < nf || (pf === nf && pk <= nk)) break;
            _astarHeapK[i] = pk;
            _astarHeapF[i] = pf;
            i = p;
          }
          _astarHeapK[i] = nk;
          _astarHeapF[i] = nf;
        }
      }
    }
  }

  if (bestKey === startKey || bestDist > startH - 0.5) return null;

  const rev = [];
  let cur = bestKey;
  let guard = 0;
  while (cur !== -1 && cur !== startKey && guard++ < 120) {
    const px = cur % W;
    const py = (cur / W) | 0;
    rev.push({ x: px + 0.5, y: py + 0.5 });
    cur = cameFrom[cur];
  }
  if (rev.length === 0) return null;
  rev.reverse();
  return rev;
}

function recordBlockedTarget(agent, target, world) {
  if (!target) return;
  const tickNow = world?.simulation?.clock?.tick ?? agent?.sim?.clock?.tick ?? world?.clock?.tick ?? 0;
  const key = target.id != null ? `id:${target.id}` : `xy:${Math.floor(target.x)},${Math.floor(target.y)}`;
  if (!Array.isArray(agent._blockedTargets)) agent._blockedTargets = [];
  // Prune expired
  agent._blockedTargets = agent._blockedTargets.filter(b => b && b.untilTick > tickNow);
  if (!agent._blockedTargets.some(b => b.key === key)) {
    agent._blockedTargets.push({ key, untilTick: tickNow + 45 });
    if (agent._blockedTargets.length > 8) agent._blockedTargets.shift();
  }
}

export function moveToward(agent, target, world, speedBoost = 1) {
  if (!target || agent.embarked) return;

  const isFlyingUnit = Boolean(agent.militaryDuty && (agent.combatRole === "plane" || agent.combat?.isFlying));
  const isArmoredTank = Boolean(agent.militaryDuty && (agent.combatRole === "tank" || agent.combat?.weaponType === "tank"));
  let effectiveSpeed = agent.speed * speedBoost;
  if (isFlyingUnit) {
    effectiveSpeed *= (agent.combat?.speedMultiplier || 2.2);
  } else if (isArmoredTank) {
    effectiveSpeed *= (agent.combat?.speedMultiplier || 1.35);
  } else {
    if (agent.lifeStage === "elder") {
      effectiveSpeed *= 0.75;
    }
    if (agent.needs.food < 30 || agent.needs.water < 30) {
      effectiveSpeed *= 1.35;
    }
    const ax = Math.floor(agent.x);
    const ay = Math.floor(agent.y);
    if (world.isPavedRoad && world.isPavedRoad(ax, ay)) {
      effectiveSpeed *= 1.85;
    } else if (world.isRoad && world.isRoad(ax, ay)) {
      effectiveSpeed *= 1.45;
    }
  }

  const goalKey = target.id != null ? `id:${target.id}` : `${Math.floor(target.x)},${Math.floor(target.y)}`;
  if (agent._pathGoalKey && agent._pathGoalKey !== goalKey) {
    agent.path = null;
    agent._pathGoalKey = null;
    agent._oscillateCount = 0;
  }

  // Follow cached A* waypoints when present (non-flying)
  let steerTarget = target;
  if (!isFlyingUnit && Array.isArray(agent.path) && agent.path.length > 0 && agent._pathGoalKey === goalKey) {
    while (agent.path.length > 0 && Math.hypot(agent.path[0].x - agent.x, agent.path[0].y - agent.y) < 0.75) {
      agent.path.shift();
    }
    if (agent.path.length > 0) {
      steerTarget = agent.path[0];
    } else {
      agent.path = null;
      agent._pathGoalKey = null;
    }
  }

  const dx = steerTarget.x - agent.x;
  const dy = steerTarget.y - agent.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= 0.1) {
    agent.path = null;
    agent._pathGoalKey = null;
    return;
  }

  const step = Math.min(dist, effectiveSpeed);
  let newX = Math.max(1, Math.min(world.width - 1.1, agent.x + (dx / dist) * step));
  let newY = Math.max(1, Math.min(world.height - 1.1, agent.y + (dy / dist) * step));
  const newTileX = Math.floor(newX);
  const newTileY = Math.floor(newY);
  const W = world.width;
  const beforeTileKey = Math.floor(agent.y) * W + Math.floor(agent.x);

  const commitStep = (nx, ny, tx, ty) => {
    if (!isFlyingUnit && world.footTraffic) {
      const wIdx = ty * W + tx;
      const heat = (world.footTraffic[wIdx] || 0) + 1;
      world.footTraffic[wIdx] = heat;
      if (heat >= 24 && !world.isRoad(tx, ty)) {
        world.setRoad(tx, ty, true);
      }
    }
    const afterKey = ty * W + tx;
    if (afterKey !== beforeTileKey && afterKey === agent._prevTileKey) {
      agent._oscillateCount = (agent._oscillateCount || 0) + 1;
    } else if (afterKey !== beforeTileKey) {
      agent._oscillateCount = 0;
    }
    agent._prevTileKey = beforeTileKey;
    agent._lastTileKey = afterKey;
    agent.x = nx;
    agent.y = ny;
    agent.stuckTicks = 0;
  };

  if (canStepTile(newTileX, newTileY, world, agent, isFlyingUnit)) {
    commitStep(newX, newY, newTileX, newTileY);
    if (!isFlyingUnit && (agent._oscillateCount || 0) >= 4) {
      recordBlockedTarget(agent, target, world);
      agent.path = null;
      agent._pathGoalKey = null;
      agent.currentAction = null;
      agent._oscillateCount = 0;
    }
    return;
  }

  // Direct step blocked: if not already following an A* path and no clear LOS, compute bounded local A*
  if (!isFlyingUnit && (!Array.isArray(agent.path) || agent.path.length === 0 || agent._pathGoalKey !== goalKey)) {
    if (!hasClearLineOfSight(agent.x, agent.y, target.x, target.y, world, agent, false)) {
      const astarPath = findLocalAStarPath(agent.x, agent.y, target.x, target.y, world, agent);
      if (astarPath && astarPath.length > 0) {
        agent.path = astarPath;
        agent._pathGoalKey = goalKey;
        const wp = astarPath[0];
        const wdx = wp.x - agent.x;
        const wdy = wp.y - agent.y;
        const wd = Math.hypot(wdx, wdy) || 1;
        const wStep = Math.min(wd, effectiveSpeed);
        const wx = Math.max(1, Math.min(world.width - 1.1, agent.x + (wdx / wd) * wStep));
        const wy = Math.max(1, Math.min(world.height - 1.1, agent.y + (wdy / wd) * wStep));
        const wtx = Math.floor(wx);
        const wty = Math.floor(wy);
        if (canStepTile(wtx, wty, world, agent, false)) {
          commitStep(wx, wy, wtx, wty);
          return;
        }
      }
    }
  }

  // Fallback gate + perpendicular tangent sidestep
  const fort = world.simulation?.fortificationSystem;
  const blockingSeg = fort?.getSegmentAt?.(newTileX, newTileY);
  const candidates = [];
  if (blockingSeg && blockingSeg.state !== "breach" && blockingSeg.settlementId && !fort.isHostileAgentToSettlement(agent, blockingSeg.settlementId)) {
    const gate = fort.getNearestGateOrBreach(agent.x, agent.y, blockingSeg.settlementId);
    if (gate) {
      const gdx = (gate.x + 0.5) - agent.x;
      const gdy = (gate.y + 0.5) - agent.y;
      const gd = Math.hypot(gdx, gdy) || 1;
      candidates.push({ x: agent.x + (gdx / gd) * step, y: agent.y + (gdy / gd) * step });
    }
  }
  candidates.push(
    { x: agent.x + (-dy / dist) * step * 0.75, y: agent.y + (dx / dist) * step * 0.75 },
    { x: agent.x + (dy / dist) * step * 0.75, y: agent.y + (-dx / dist) * step * 0.75 },
    { x: agent.x + Math.sign(world.width / 2 - agent.x) * step * 0.6, y: agent.y + Math.sign(world.height / 2 - agent.y) * step * 0.6 }
  );

  let moved = false;
  for (const cand of candidates) {
    const clampedX = Math.max(1, Math.min(world.width - 1.1, cand.x));
    const clampedY = Math.max(1, Math.min(world.height - 1.1, cand.y));
    const tileX = Math.floor(clampedX);
    const tileY = Math.floor(clampedY);
    if (canStepTile(tileX, tileY, world, agent, isFlyingUnit)) {
      commitStep(clampedX, clampedY, tileX, tileY);
      moved = true;
      break;
    }
  }

  if (!moved) {
    agent.stuckTicks = (agent.stuckTicks || 0) + 1;
    if (agent.stuckTicks >= 3) {
      recordBlockedTarget(agent, target, world);
      agent.path = null;
      agent._pathGoalKey = null;
      agent.currentAction = null;
      agent.stuckTicks = 0;
      agent._oscillateCount = 0;
    }
  } else if ((agent._oscillateCount || 0) >= 4) {
    recordBlockedTarget(agent, target, world);
    agent.path = null;
    agent._pathGoalKey = null;
    agent.currentAction = null;
    agent._oscillateCount = 0;
  }
}
