// Agent goal generation, legal action proposal, and memory-aware utility scoring.
// Extracted from Agent for modularity with zero RNG draws and zero circular dependencies.

function tickOf(simulation) {
  return (simulation && simulation.clock && simulation.clock.tick) || 0;
}

function canAgentMineResource(agent, res, simulation) {
  if (!res) return false;
  const reqEra = res.requiredEraId || (res.resourceType === "uranium" ? 6 : 1);
  if (reqEra <= 1) return true;
  const sid = agent.settlementId || simulation?.settlementSystem?.agentSettlementMap?.get(agent.id) || null;
  if (sid == null) return false;
  const eraId = simulation?.civilizationAgeSystem?.getSettlementAge?.(sid)?.ageId || 1;
  return eraId >= reqEra;
}

export function generateGoals(agent, simulation, perception = null) {
  if (!agent.goals) agent.goals = [];
  else agent.goals.length = 0;

  const homeSettlement = simulation?.settlementSystem?.getAgentSettlement?.(agent.id);
  const hasTownFood = (homeSettlement?.stockpile?.food || 0) + (homeSettlement?.stockpile?.bread || 0) > 0;

  // 1. Critical Hunger & Thirst
  if (agent.needs.food < 45) {
    const foodUrgent = agent.needs.food < 20 ? 152 - agent.needs.food : 122 - agent.needs.food;
    if (agent.inventory.bread > 0 || agent.inventory.wheat > 0) {
      agent.goals.push({ type: "eat_from_inventory", priority: foodUrgent });
    } else if (hasTownFood && homeSettlement?.center) {
      agent.goals.push({ type: "eat_from_stockpile", priority: foodUrgent - 2, target: homeSettlement.center });
      agent.goals.push({ type: "find_food", priority: foodUrgent - 8 });
    } else {
      agent.goals.push({ type: "find_food", priority: foodUrgent - 3 });
    }
  } else if (agent.needs.food < 75) {
    if (agent.inventory.bread > 0 || agent.inventory.wheat > 0) {
      agent.goals.push({ type: "eat_from_inventory", priority: 65 });
    } else if (hasTownFood && homeSettlement?.center) {
      agent.goals.push({ type: "eat_from_stockpile", priority: 60, target: homeSettlement.center });
      agent.goals.push({ type: "find_food", priority: 50 });
    } else {
      agent.goals.push({ type: "find_food", priority: 55 });
    }
  }

  if (agent.needs.water < 45) {
    const waterUrgent = agent.needs.water < 20 ? 155 - agent.needs.water : 120 - agent.needs.water;
    if (homeSettlement?.center) {
      agent.goals.push({ type: "fetch_town_water", priority: waterUrgent - 2, target: homeSettlement });
    }
    agent.goals.push({ type: "find_water", priority: waterUrgent });
  } else if (agent.needs.water < 75) {
    if (homeSettlement?.center) {
      agent.goals.push({ type: "fetch_town_water", priority: 58, target: homeSettlement });
    }
    agent.goals.push({ type: "find_water", priority: 55 });
  }

  // 2. Rest
  if (agent.needs.rest < 35) {
    agent.goals.push({ type: "rest", priority: 95 - agent.needs.rest });
  } else if (agent.needs.rest < 55) {
    agent.goals.push({ type: "rest", priority: 45 });
  }

  // 2.5 Military Duty & Warfare
  if (agent.militaryDuty && (agent.isExternalRaider || (agent.needs.food > 22 && agent.needs.water > 22))) {
    agent.goals.push({ type: "military_duty", priority: 88 });
    agent.goals.sort((a, b) => b.priority - a.priority);
    return;
  }

  if (agent.militaryDuty && (agent.needs.food <= 0 || agent.needs.water <= 0)) {
    agent.health = Math.max(0, agent.health - 1);
    if (agent.health <= 0) {
      agent.alive = false;
      agent.deathCause = agent.needs.water <= 0 ? "dehydration" : "starvation";
      return;
    }
  }

  // 2.6 Desperation & Panic Fleeing
  const desperate = agent.needs.health < 35 ||
    (agent.needs.food < 12 && agent.needs.water < 12);
  let threatX = null;
  let threatY = null;
  let threatDist = Infinity;
  let threatKind = null;
  if (simulation && simulation.world && simulation.diplomacySystem) {
    const mySid = agent.settlementId ||
      (simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(agent.id) : null);
    const tickNow = simulation && simulation.clock ? simulation.clock.tick : 0;
    if (agent._warThreatTick === undefined || tickNow - agent._warThreatTick >= 4) {
      agent._warThreatTick = tickNow;
      agent._warThreat = null;
      const hostiles = mySid != null ? simulation.diplomacySystem.getEnemies(mySid) : [];
      const hasActiveRaids = (simulation.warfareSystem?.warbands?.size || 0) > 0;
      if ((hostiles.length > 0 || hasActiveRaids) && !agent.militaryDuty) {
        const singleHostile = hostiles.length === 1 ? hostiles[0] : -1;
        const hostileSet = hostiles.length > 1 ? new Set(hostiles) : null;
        const agentSetMap = simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap : null;
        let best = null;
        let bestD = Infinity;
        const scanList = desperate
          ? simulation.agents
          : simulation.world._getScanBuckets(Math.floor(agent.x), Math.floor(agent.y), 10).agents;
        for (let i = 0; i < scanList.length; i++) {
          const other = scanList[i];
          if (!other.alive) continue;
          const isHostileRaider = Boolean(other.isExternalRaider);
          if (!isHostileRaider) {
            if (other.militaryDuty || hostiles.length === 0) continue;
            const osid = other.settlementId || (agentSetMap ? agentSetMap.get(other.id) : null);
            if (osid == null) continue;
            if (singleHostile !== -1 ? osid !== singleHostile : !hostileSet.has(osid)) continue;
          }
          const dx = other.x - agent.x;
          const dy = other.y - agent.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD) { bestD = d2; best = other; }
        }
        if (best) agent._warThreat = { x: best.x, y: best.y, dist: Math.sqrt(bestD) };
      }
    }
    if (agent._warThreat) {
      threatX = agent._warThreat.x;
      threatY = agent._warThreat.y;
      threatDist = agent._warThreat.dist;
      threatKind = "war";
    }
    const w = simulation.world;
    if (simulation._fireActive && w.fireTiles && threatKind !== "war") {
      const px = Math.floor(agent.x);
      const py = Math.floor(agent.y);
      const fMinX = w._fireMinX ?? 0;
      const fMaxX = w._fireMaxX ?? w.width;
      const fMinY = w._fireMinY ?? 0;
      const fMaxY = w._fireMaxY ?? w.height;
      if (px + 3 >= fMinX && px - 3 <= fMaxX && py + 3 >= fMinY && py - 3 <= fMaxY) {
        for (let dy = -3; dy <= 3; dy++) {
          const fy = py + dy;
          if (fy < 0 || fy >= w.height) continue;
          const rowOffset = fy * w.width;
          for (let dx = -3; dx <= 3; dx++) {
            const fx = px + dx;
            if (fx < 0 || fx >= w.width) continue;
            if (w.fireTiles[rowOffset + fx] > 0) {
              const d = Math.hypot(dx, dy);
              if (d < threatDist) {
                threatDist = d;
                threatX = fx;
                threatY = fy;
                threatKind = "fire";
              }
            }
          }
        }
      }
    }
  }

  const underThreat = threatKind !== null && threatDist < (threatKind === "fire" ? 4.5 : 9);
  if ((underThreat && (desperate || agent.personality.brave < 0.6 || agent.lifeStage !== "adult")) ||
      (desperate && threatKind !== null)) {
    agent.fleeFrom = { x: threatX, y: threatY };
    const fleePriority = (threatKind === "fire" && threatDist < 2.5) ? 145 : 130;
    agent.goals.push({ type: "flee", priority: fleePriority, target: { x: threatX, y: threatY }, kind: threatKind });
  } else {
    agent.fleeFrom = null;
  }
  if (underThreat || desperate) {
    agent.needs.safety = Math.min(agent.needs.safety, desperate ? 10 : 35);
  } else if (agent.needs.safety < 100) {
    agent.needs.safety = Math.min(100, agent.needs.safety + 0.3);
  }

  // 3. Construction & Civic Works
  const job = agent.job;
  const isBuilder = job === "builder";
  let hasPendingConstruction = false;

  if (simulation && simulation.buildings) {
    const tickNow = simulation.clock ? simulation.clock.tick : -1;
    if (agent._pendingBuildTick !== tickNow) {
      agent._pendingBuildTick = tickNow;
      agent._hasPendingBuild = false;
      const bldList = simulation._incompleteRealBuildings || simulation.buildings;
      if (bldList.length > 0) {
        const homeSid = agent.settlementId ||
          (simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(agent.id) : null);
        for (const b of bldList) {
          if (!b.complete && (b.constructionProgress || 0) < 100) {
            const sid = b.settlementId ?? null;
            if (sid == null || sid === homeSid) { agent._hasPendingBuild = true; break; }
            if (homeSid != null && simulation.diplomacySystem) {
              try {
                const rel = simulation.diplomacySystem.getRelation(homeSid, sid);
                if (rel && rel.status !== "war" && rel.score >= 40) { agent._hasPendingBuild = true; break; }
              } catch { /* ignore */ }
            }
          }
        }
      }
    }
    hasPendingConstruction = agent._hasPendingBuild;
  }

  if (isBuilder || (hasPendingConstruction && (job === "unemployed" || !job))) {
    agent.goals.push({ type: "build", priority: isBuilder ? 85 : 68 });
  }

  // 4. Active Job-Specific Goals
  if (agent.lifeStage === "child") {
    if ((agent.id * 11 + tickOf(simulation)) % 9 === 0) {
      agent.goals.push({ type: "play_in_town", priority: 45 });
    }
  } else if (job === "lumberjack") {
    agent.goals.push({ type: "chop_wood", priority: 75 });
  } else if (job === "miner") {
    agent.goals.push({ type: "mine_ore", priority: 75 });
  } else if (job === "farmer") {
    agent.goals.push({ type: "farm", priority: 75 });
  } else if (job === "hunter") {
    agent.goals.push({ type: "hunt_patrol", priority: 78 });
  } else if (job === "gatherer") {
    agent.goals.push({ type: "gather_resources", priority: 70 });
  } else if (job === "craftsman") {
    if (!agent.workplace && simulation?.craftingSystem) {
      const ws = simulation.craftingSystem.findNearestWorkshop(agent.x, agent.y);
      if (ws) {
        agent.workplace = ws.id;
        simulation.economySystem?.agentJobs?.set(agent.id, {
          job: "craftsman", skillLevel: 1, experience: 0, assignedAt: tickOf(simulation)
        });
      }
    }
    if (agent.workplace) {
      const ws = simulation?.craftingSystem?.workshops?.get(agent.workplace);
      if (!ws) {
        agent.workplace = null;
      } else {
        const haul = simulation.craftingSystem.haulUnits(agent.inventory);
        const breadStock = ws.storage.get("bread") || 0;
        const plankStock = ws.storage.get("plank") || 0;
        if (haul >= 2) {
          agent.goals.push({ type: "haul_to_workshop", priority: 86 });
        } else if ((breadStock >= 3 || plankStock >= 3) &&
                   !agent._workshopHasDemand(ws, simulation.craftingSystem)) {
          agent.goals.push({ type: "distribute_goods", priority: 88, workplaceId: ws.id });
        } else if (breadStock > 0 && agent.needs.food < 80) {
          agent.goals.push({ type: "collect_bread", priority: 88 });
        } else if (agent._workshopHasDemand(ws, simulation.craftingSystem)) {
          agent.goals.push({ type: "go_to_work", priority: 80 });
        } else if (breadStock >= 3 || plankStock >= 3) {
          agent.goals.push({ type: "go_to_work", priority: 76 });
        } else {
          agent.goals.push({ type: "go_to_work", priority: 55 });
        }
      }
    }
  } else if (job === "soldier" || job === "guard") {
    agent.goals.push({ type: "patrol", priority: 65 });
  } else if (job === "priest") {
    agent.goals.push({ type: "pray", priority: 70 });
  }

  // 5. Reproduction & Family Life
  const currentPop = simulation ? simulation.agents.length : 0;
  const popCap = simulation?.maxAgents ?? 360;
  const occupancy = currentPop / Math.max(1, popCap);
  const minFoodWater = occupancy > 0.75 ? 74 : (occupancy > 0.5 ? 58 : 46);
  const maxChildren = occupancy > 0.7 ? 2 : (occupancy > 0.45 ? 3 : 4);
  if (currentPop < popCap &&
      agent.lifeStage === "adult" &&
      agent.age >= 18 && agent.age <= agent.maxAge - 14 &&
      (!agent.reproduceCooldown || agent.reproduceCooldown <= 0) &&
      agent.needs.food > minFoodWater && agent.needs.water > minFoodWater &&
      agent.children < maxChildren) {
    agent.goals.push({ type: "reproduce", priority: 54 });
  }

  // 6. Social Interaction & Community Bonding
  const socialDrive = agent.personality.social || 0.5;
  if (agent.needs.social < 85) {
    agent.goals.push({ type: "socialize", priority: 50 });
  } else if (agent.lifeStage !== "child" && ((agent.id * 7 + tickOf(simulation)) % Math.max(4, Math.round(14 - socialDrive * 10))) === 0) {
    agent.goals.push({ type: "visit_neighbor", priority: 26 });
  }

  // 7. Settlement Stay, Tethering & Stockpile Sharing
  let cachedDistToCenter = -1;
  if (homeSettlement && homeSettlement.center) {
    const settlement = homeSettlement;
    const distToCenter = Math.hypot(agent.x - settlement.center.x, agent.y - settlement.center.y);
    cachedDistToCenter = distToCenter;

    const jobName = simulation.economySystem?.getAgentJob?.(agent.id)?.job;
    const isCraftsman = agent.job === "craftsman" || jobName === "craftsman";
    if (!isCraftsman) {
      const surplus = (agent.inventory.wood_log || 0) + (agent.inventory.ore_iron || 0) + (agent.inventory.wheat || 0) + (agent.inventory.meat || 0) + (agent.inventory.hide || 0);
      if (surplus >= 2) {
        let fedWorkshop = false;
        const canFeed = agent.needs.water > 50 && agent.needs.food > 40;
        if (simulation.craftingSystem && canFeed) {
          const ws = simulation.craftingSystem.findNearestWorkshop(agent.x, agent.y, 24);
          if (ws) {
            const wsDistToCenter = Math.hypot(ws.x - settlement.center.x, ws.y - settlement.center.y);
            const breadStock = ws.storage.get("bread") || 0;
            const plankStock = ws.storage.get("plank") || 0;
            if (wsDistToCenter <= 32 && breadStock < 6 && plankStock < 6) {
              const rawAtWs = (ws.storage.get("wood_log") || 0) + (ws.storage.get("wheat") || 0) + (ws.storage.get("ore_iron") || 0);
              if (rawAtWs < 6 && surplus >= 4) {
                agent.goals.push({ type: "haul_to_workshop_feed", priority: 85, workplaceId: ws.id });
                fedWorkshop = true;
              }
            }
          }
        }
        if (!fedWorkshop) {
          agent.goals.push({ type: "deposit_to_stockpile", priority: 84, target: settlement.center });
        }
      }
    } else if (agent.workplace && simulation.craftingSystem) {
      const ws = simulation.craftingSystem.workshops.get(agent.workplace);
      if (ws) {
        const breadStock = ws.storage.get("bread") || 0;
        const plankStock = ws.storage.get("plank") || 0;
        if ((breadStock >= 3 || plankStock >= 3) && agent.distanceTo(settlement.center) < 24) {
          agent.goals.push({ type: "distribute_goods", priority: 87, workplaceId: ws.id });
        }
      }
    }

    if (agent.needs.food < 45 && (!agent.inventory.wheat && !agent.inventory.bread)) {
      if (settlement.stockpile && ((settlement.stockpile.food || 0) + (settlement.stockpile.bread || 0)) > 0) {
        agent.goals.push({ type: "eat_from_stockpile", priority: 95, target: settlement.center });
      } else if (simulation.craftingSystem) {
        const bakery = simulation.craftingSystem.findNearestWorkshop(agent.x, agent.y, 16);
        if (bakery && (bakery.storage.get("bread") || 0) > 0) {
          agent.goals.push({ type: "collect_bread", priority: 93, workplaceId: bakery.id });
        }
      }
    }

    if (agent.needs.water < 65 && distToCenter <= 16) {
      agent.goals.push({ type: "fetch_town_water", priority: agent.needs.water < 45 ? 116 : 58, target: settlement });
    }

    if (agent.needs.rest < 65) {
      const home = simulation.settlementSystem.getAgentHome(agent.id);
      if (home) {
        agent.goals.push({ type: "rest_at_home", priority: agent.needs.rest < 35 ? 65 : 36, target: home });
      }
    }

    const urbanSpan = Math.max(14, Math.min(28, Math.round((settlement.urbanRadius || 16) * 0.85)));
    if (distToCenter > urbanSpan) {
      const homePull = Math.min(80, 52 + Math.floor(distToCenter - urbanSpan));
      agent.goals.push({ type: "return_to_settlement", priority: homePull, target: settlement.center });
    }
  }

  // 7.5 Town Life & Urban Activities
  if (homeSettlement && homeSettlement.center) {
    const settlement = homeSettlement;
    const distToCenter = cachedDistToCenter >= 0
      ? cachedDistToCenter
      : Math.hypot(agent.x - settlement.center.x, agent.y - settlement.center.y);
    const townLifeRadius = Math.max(18, Math.min(32, (settlement.urbanRadius || 18) + 2));
    if (distToCenter <= townLifeRadius) {
      const t = tickOf(simulation);
      const isChild = agent.lifeStage === "child";
      const isGuard = job === "soldier" || job === "guard";
      const isPriest = job === "priest";
      const isFarmer = job === "farmer";

      if (isChild) {
        agent.goals.push({ type: "play_in_town", priority: 42, target: settlement.center });
      }

      if (((agent.id * 3 + t) % 7) === 0 || agent.needs.social < 65) {
        agent.goals.push({ type: "gather_at_hearth", priority: 43, target: settlement.center });
      }

      const marketCadence = Math.max(6, Math.round(14 - (agent.personality.social || 0.5) * 8));
      if (((agent.id * 7 + t) % marketCadence) === 0) {
        agent.goals.push({ type: "visit_market", priority: 38, target: settlement.center });
      }

      const templeCadence = isPriest ? 8 : 14;
      if (((agent.id * 5 + t) % templeCadence) === 0 || (agent.personality.spirituality || 0.5) > 0.65) {
        agent.goals.push({ type: "pray_at_temple", priority: isPriest ? 55 : 34, target: settlement.center });
      }

      if (isPriest && ((agent.id * 11 + t) % 20) === 0) {
        agent.goals.push({ type: "conjure_fallen", priority: 58, target: settlement.center });
      }

      if (!isChild && !isGuard && !agent.militaryDuty && !agent.captive &&
          agent.needs.food > 45 && agent.needs.water > 45 &&
          ((agent.id * 19 + t) % 45) === 0 && simulation.settlementSystem?.settlements?.size > 1) {
        let bestNeighbor = null;
        let bestDist = Infinity;
        for (const other of simulation.settlementSystem.settlements.values()) {
          if (!other || other.id === settlement.id || other.ruined || !other.center) continue;
          const rel = simulation.diplomacySystem?.getRelation?.(settlement.id, other.id);
          if (rel?.status === "war") continue;
          const d = Math.hypot(other.center.x - agent.x, other.center.y - agent.y);
          if (d <= 55 && d < bestDist) {
            bestDist = d;
            bestNeighbor = other;
          }
        }
        if (bestNeighbor) {
          agent.goals.push({
            type: "wander_to_town",
            priority: 39,
            target: { x: bestNeighbor.center.x, y: bestNeighbor.center.y, settlementId: bestNeighbor.id }
          });
        }
      }

      if (!isChild && ((agent.id * 9 + t) % 15) === 0) {
        agent.goals.push({ type: "watch_crafts", priority: 30, target: settlement.center });
      }

      if (isGuard) {
        if (((agent.id * 5 + t) % 10) === 0) {
          agent.goals.push({ type: "patrol_settlement", priority: 46, target: settlement.center });
        }
        agent.goals.push({ type: "train_at_barracks", priority: 44, target: settlement.center });
      } else if (((agent.id * 13 + t) % 22) === 0) {
        agent.goals.push({ type: "train_at_barracks", priority: 28, target: settlement.center });
      }

      if (isFarmer || ((agent.id * 17 + t) % 24) === 0) {
        agent.goals.push({ type: "tend_town_farm", priority: isFarmer ? 76 : 31, target: settlement.center });
      }
    }
  }

  // 8. Proactive foraging if inventory has space
  let totalItems = 0;
  const inv = agent.inventory;
  for (const k in inv) {
    const v = inv[k];
    if (typeof v === "number") totalItems += v;
  }
  if (totalItems < inv.capacity) {
    agent.goals.push({ type: "forage_nearby", priority: 35 });
  }

  // 8b. Scavenging
  if (perception && perception.nearbyItems && perception.nearbyItems.length > 0 &&
      totalItems < agent.inventory.capacity) {
    let bestItem = null;
    let bestDist = Infinity;
    for (const it of perception.nearbyItems) {
      if (it.destroyed || it.total() <= 0) continue;
      const d = agent.distanceTo(it);
      if (d < bestDist || (d === bestDist && bestItem && it.id < bestItem.id)) {
        bestDist = d;
        bestItem = it;
      }
    }
    if (bestItem) {
      agent.goals.push({ type: "scavenge", priority: agent.needs.food < 45 ? 78 : 58, target: bestItem });
    }
  }

  // 7b. Hunting
  if (perception && perception.nearbyAnimals && perception.nearbyAnimals.length > 0 &&
      (agent.needs.food < 65 || agent.job === "hunter")) {
    const prey = perception.nearbyAnimals.find(a => a.species !== "wolf");
    if (prey) {
      agent.goals.push({ type: "hunt", priority: agent.job === "hunter" ? 92 : 82, target: prey });
    }
  }

  agent.goals.push({ type: "explore", priority: agent.goals.length === 0 ? 10 : 8 });
  agent.goals.sort((a, b) => b.priority - a.priority);
}

export function generateActions(agent, perception, world, simulation) {
  const actions = agent._actionsBuffer || (agent._actionsBuffer = []);
  actions.length = 0;

  let _lazyChecked = false;
  const needScan = () => {
    if (_lazyChecked) return;
    _lazyChecked = true;
    if (!agent._perceptionValid || agent._perceptionTick !== (world && world.clock ? world.clock.tick : 0)) {
      agent.perceive(world, [], 12);
    }
  };
  const tickNowForBlock = tickOf(simulation);
  const isBlockedTarget = (t) => {
    if (!t || !Array.isArray(agent._blockedTargets) || agent._blockedTargets.length === 0) return false;
    const key = t.id != null ? `id:${t.id}` : (typeof t.x === "number" ? `xy:${Math.floor(t.x)},${Math.floor(t.y)}` : null);
    if (!key) return false;
    for (let i = 0; i < agent._blockedTargets.length; i++) {
      const entry = agent._blockedTargets[i];
      if (entry && entry.key === key && entry.untilTick > tickNowForBlock) return true;
    }
    return false;
  };
  const isDominated = (maxPossibleScore) => {
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const t = a.target;
      if (t && typeof t === "object" && t.type === "agent") continue;
      const floor = (t && typeof t.x === "number") ? a.score - 10 : a.score;
      if (floor > maxPossibleScore) return true;
    }
    return false;
  };

  for (const goal of agent.goals) {
    switch (goal.type) {
      case "build": {
        const homeId = agent.settlementId ||
          (simulation && simulation.settlementSystem ? simulation.settlementSystem.agentSettlementMap.get(agent.id) : null);
        const diplo = simulation && simulation.diplomacySystem;

        let candidate = null;
        let bestDist = Infinity;

        const pendingList = (simulation && simulation.incompleteBuildings) || [];
        for (const b of pendingList) {
          const siteSid = b.settlementId ?? null;
          let friendly = true;
          if (siteSid != null) {
            if (homeId == null) {
              friendly = false;
            } else if (siteSid !== homeId) {
              if (diplo) {
                const rel = diplo.getRelation(homeId, siteSid);
                friendly = !!rel && rel.status !== "war" && rel.score >= 40;
              }
            }
          }
          if (friendly && !isBlockedTarget(b)) {
            const dist = agent.distanceTo(b);
            if (dist < bestDist) {
              bestDist = dist;
              candidate = b;
            }
          }
        }

        if (candidate) {
          const foreignPenalty = (candidate.settlementId != null && candidate.settlementId !== homeId) ? 15 : 0;
          actions.push({
            type: "build",
            target: candidate,
            score: goal.priority + (20 - Math.min(18, bestDist)) - foreignPenalty,
          });
        }
        break;
      }

      case "reproduce": {
        needScan();
        const relSys = simulation && simulation.relationshipSystem;
        const fam = relSys ? relSys.getRelatives(agent.id) : null;
        const myRelMap = relSys && relSys.relationships ? relSys.relationships.get(agent.id) : null;

        for (const otherAgent of perception.nearbyAgents) {
          if (otherAgent.alive && otherAgent !== agent &&
              otherAgent.lifeStage === "adult" &&
              otherAgent.age >= 18 && otherAgent.age <= otherAgent.maxAge - 15 &&
              otherAgent.gender !== agent.gender &&
              otherAgent.needs.food > 40 && otherAgent.needs.water > 40) {
            if (fam && (fam.spouse === otherAgent.id ||
                        fam.parents.includes(otherAgent.id) ||
                        fam.children.includes(otherAgent.id) ||
                        fam.siblings.includes(otherAgent.id))) continue;
            let bonus = 0;
            if (myRelMap) {
              const rel = myRelMap.get(otherAgent.id);
              if (rel) bonus += Math.min(8, (rel.friendship || 0) * 0.08);
            }
            if (agent.partnerId === otherAgent.id) bonus += 6;
            actions.push({
              type: "reproduce",
              target: otherAgent,
              score: goal.priority + (10 - Math.min(9, agent.distanceTo(otherAgent))) + bonus
            });
          }
        }
        break;
      }

      case "socialize":
        if (!_lazyChecked && isDominated(goal.priority + 32)) break;
        needScan();
        for (const otherAgent of perception.nearbyAgents) {
          if (otherAgent.alive && otherAgent !== agent) {
            actions.push({
              type: "socialize",
              target: otherAgent,
              score: goal.priority + (12 - Math.min(10, agent.distanceTo(otherAgent)))
            });
          }
        }
        break;

      case "go_to_work":
        if (agent.workplace) {
          actions.push({
            type: "go_to_workplace",
            workplaceId: agent.workplace,
            score: goal.priority
          });
        }
        break;

      case "haul_to_workshop":
        if (agent.workplace) {
          actions.push({
            type: "haul_to_workshop",
            workplaceId: agent.workplace,
            score: goal.priority
          });
        }
        break;

      case "haul_to_workshop_feed":
        if (goal.workplaceId) {
          actions.push({
            type: "haul_to_workshop_feed",
            workplaceId: goal.workplaceId,
            score: goal.priority
          });
          const home = simulation?.settlementSystem?.getAgentSettlement?.(agent.id);
          if (home && home.center) {
            actions.push({
              type: "deposit_to_stockpile",
              target: home.center,
              score: goal.priority - 1
            });
          }
        }
        break;

      case "collect_bread": {
        const wp = goal.workplaceId || agent.workplace;
        if (wp) {
          actions.push({
            type: "collect_bread",
            workplaceId: wp,
            score: goal.priority
          });
        }
        break;
      }

      case "distribute_goods":
        if (goal.workplaceId) {
          actions.push({
            type: "distribute_goods",
            workplaceId: goal.workplaceId,
            score: goal.priority
          });
        }
        break;

      case "chop_wood":
        needScan();
        for (const res of perception.nearbyResources) {
          if (res.resourceType === "wood" && res.amount > 0 && !res.depleted && !isBlockedTarget(res)) {
            actions.push({
              type: "chop_wood",
              target: res,
              score: goal.priority + (15 - Math.min(14, agent.distanceTo(res)))
            });
          }
        }
        break;

      case "mine_ore":
        needScan();
        for (const res of perception.nearbyResources) {
          if ((res.resourceType === "ore" || res.resourceType === "gem" || res.resourceType === "uranium") &&
              res.amount > 0 && !res.depleted && !isBlockedTarget(res) &&
              canAgentMineResource(agent, res, simulation)) {
            actions.push({
              type: "mine_ore",
              target: res,
              score: goal.priority + (15 - Math.min(14, agent.distanceTo(res))) +
                (res.resourceType === "uranium" ? 10 : res.resourceType === "gem" ? 8 : res.depositTier === "iron_mountain" ? 5 : 0)
            });
          }
        }
        break;

      case "farm":
      case "find_food": {
        if (!_lazyChecked && isDominated(goal.priority + 15)) break;
        needScan();
        let foundFoodAct = false;
        for (const res of perception.nearbyResources) {
          if (res.resourceType === "food" && res.amount > 0 && !res.depleted && !isBlockedTarget(res)) {
            actions.push({
              type: "gather_food",
              target: res,
              score: goal.priority + (15 - Math.min(14, agent.distanceTo(res)))
            });
            foundFoodAct = true;
          }
        }
        if (!foundFoodAct && goal.type === "find_food" && agent.needs.food < 48 && simulation?.world?._getScanBuckets) {
          const wide = simulation.world._getScanBuckets(Math.floor(agent.x), Math.floor(agent.y), 26);
          for (const res of wide.resources) {
            if (res.resourceType === "food" && res.amount > 0 && !res.depleted && !isBlockedTarget(res)) {
              actions.push({
                type: "gather_food",
                target: res,
                score: goal.priority + (12 - Math.min(11, agent.distanceTo(res) * 0.4))
              });
              foundFoodAct = true;
            }
          }
          if (!foundFoodAct && Array.isArray(simulation.groundItems)) {
            for (const gi of simulation.groundItems) {
              if (!gi || gi.destroyed || gi.total() <= 0 || isBlockedTarget(gi)) continue;
              const edible = (gi.items?.bread || 0) + (gi.items?.meat || 0) + (gi.items?.wheat || 0);
              if (edible > 0 && agent.distanceTo(gi) <= 26) {
                actions.push({
                  type: "scavenge",
                  target: gi,
                  score: goal.priority + (10 - Math.min(9, agent.distanceTo(gi) * 0.4))
                });
              }
            }
          }
        }
        break;
      }

      case "forage_nearby":
      case "gather_resources":
      case "gather_supplies": {
        if (!_lazyChecked && isDominated(goal.priority + 16)) break;
        const memNow = tickOf(simulation);
        needScan();
        for (const res of perception.nearbyResources) {
          if (res.amount > 0 && !res.depleted && !isBlockedTarget(res)) {
            if ((res.resourceType === "ore" || res.resourceType === "gem" || res.resourceType === "uranium") &&
                !canAgentMineResource(agent, res, simulation)) {
              continue;
            }
            let actType = "gather_food";
            if (res.resourceType === "wood") actType = "chop_wood";
            else if (res.resourceType === "ore" || res.resourceType === "uranium" || res.resourceType === "gem") actType = "mine_ore";
            else if (res.resourceType === "water") actType = "drink_water";
            let memoryBonus = 0;
            const mem = agent.recallNode(res.resourceType, agent.x, agent.y, 24, 4000, memNow);
            if (mem && Math.hypot(mem.x - res.x, mem.y - res.y) < 2.5) {
              memoryBonus = 6;
            }
            const score = goal.priority + (10 - Math.min(9, agent.distanceTo(res))) -
              (goal.target ? Math.min(8, agent.distanceTo(goal.target)) : 0) + memoryBonus;
            actions.push({
              type: actType,
              target: res,
              campTarget: goal.target || null,
              score
            });
          }
        }
        break;
      }

      case "eat_from_inventory":
        actions.push({
          type: "eat_from_inventory",
          score: goal.priority
        });
        break;

      case "scavenge":
        if (goal.target && !goal.target.destroyed && goal.target.total() > 0) {
          actions.push({
            type: "scavenge",
            target: goal.target,
            score: goal.priority + (12 - Math.min(11, agent.distanceTo(goal.target)))
          });
        }
        break;

      case "find_water": {
        if (!_lazyChecked && isDominated(goal.priority + 15)) break;
        needScan();
        let foundWaterAct = false;
        for (const res of perception.nearbyResources) {
          if (res.resourceType === "water" && res.amount > 0 && !res.depleted && !isBlockedTarget(res)) {
            actions.push({
              type: "drink_water",
              target: res,
              score: goal.priority + (15 - Math.min(14, agent.distanceTo(res)))
            });
            foundWaterAct = true;
          }
        }
        if (!foundWaterAct && agent.needs.water < 48 && simulation?.world?._getScanBuckets) {
          const wide = simulation.world._getScanBuckets(Math.floor(agent.x), Math.floor(agent.y), 26);
          for (const res of wide.resources) {
            if (res.resourceType === "water" && res.amount > 0 && !res.depleted && !isBlockedTarget(res)) {
              actions.push({
                type: "drink_water",
                target: res,
                score: goal.priority + (12 - Math.min(11, agent.distanceTo(res) * 0.4))
              });
            }
          }
        }
        break;
      }

      case "rest":
        actions.push({
          type: "rest",
          score: goal.priority
        });
        break;

      case "rest_at_home":
        if (goal.target) {
          actions.push({
            type: "go_home_and_rest",
            target: goal.target,
            score: goal.priority
          });
        }
        break;

      case "visit_neighbor": {
        if (!_lazyChecked && isDominated(goal.priority + 38)) break;
        let best = null;
        let bestScore = -Infinity;
        needScan();
        const relSys = simulation && simulation.relationshipSystem;
        const myRelMap = relSys && relSys.relationships ? relSys.relationships.get(agent.id) : null;
        for (const otherAgent of perception.nearbyAgents) {
          if (!otherAgent.alive || otherAgent === agent) continue;
          const d = agent.distanceTo(otherAgent);
          if (d < 4) continue;
          let affinity = 0;
          if (myRelMap) {
            const rel = myRelMap.get(otherAgent.id);
            if (rel) affinity = (rel.friendship || 0) * 0.1;
          }
          const score = affinity - Math.min(20, d) * 0.3;
          if (score > bestScore) { bestScore = score; best = otherAgent; }
        }
        if (best) {
          actions.push({
            type: "visit_neighbor",
            target: best,
            score: goal.priority + Math.max(0, 8 + bestScore)
          });
        }
        break;
      }

      case "return_to_settlement":
        if (goal.target) {
          actions.push({
            type: "return_home",
            target: goal.target,
            score: goal.priority
          });
        }
        break;

      case "visit_market": {
        const dest = agent.pickMarketSpot(simulation, goal.target);
        if (dest) {
          actions.push({
            type: "visit_market",
            target: dest,
            score: goal.priority + (10 - Math.min(9, Math.hypot(dest.x - agent.x, dest.y - agent.y)))
          });
        }
        break;
      }

      case "patrol_settlement": {
        const post = agent.pickPatrolPost(simulation, goal.target);
        if (post) {
          actions.push({ type: "patrol_settlement", target: post, score: goal.priority });
        }
        break;
      }

      case "gather_at_hearth": {
        const spot = agent.pickHearthSpot(simulation, goal.target);
        if (spot) {
          actions.push({
            type: "gather_at_hearth",
            target: spot,
            score: goal.priority + (10 - Math.min(9, Math.hypot(spot.x - agent.x, spot.y - agent.y)))
          });
        }
        break;
      }

      case "pray_at_temple": {
        const temple = agent.findSettlementBuilding(simulation, goal.target, ["temple", "church", "shrine"]);
        const target = temple || agent.pickTempleSpot(simulation, goal.target);
        if (target) {
          actions.push({ type: "pray_at_temple", target, score: goal.priority });
        }
        break;
      }

      case "conjure_fallen": {
        const cem = agent.findSettlementBuilding(simulation, goal.target, ["cemetery"]);
        const sacred = cem || agent.findSettlementBuilding(simulation, goal.target, ["temple", "church", "shrine"]) || agent.pickTempleSpot(simulation, goal.target);
        if (sacred) {
          actions.push({ type: "conjure_fallen", target: sacred, score: goal.priority });
        }
        break;
      }

      case "wander_to_town": {
        if (goal.target) {
          actions.push({ type: "wander_to_town", target: goal.target, score: goal.priority });
        }
        break;
      }

      case "watch_crafts": {
        const workshop = agent.findSettlementBuilding(simulation, goal.target, ["workshop"]);
        const target = workshop || agent.pickWorkshopSpot(simulation, goal.target);
        if (target) {
          actions.push({ type: "watch_crafts", target, score: goal.priority });
        }
        break;
      }

      case "train_at_barracks": {
        const post = agent.pickPatrolPost(simulation, goal.target);
        if (post) {
          actions.push({ type: "train_at_barracks", target: post, score: goal.priority });
        }
        break;
      }

      case "play_in_town": {
        const spot = agent.pickPlaySpot(simulation, goal.target);
        if (spot) {
          actions.push({ type: "play_in_town", target: spot, score: goal.priority });
        }
        break;
      }

      case "fetch_town_water": {
        const well = agent.pickWellSpot(simulation, goal.target);
        if (well) {
          actions.push({
            type: "fetch_town_water",
            target: well,
            score: goal.priority
          });
        }
        break;
      }

      case "tend_town_farm": {
        const farm = agent.findSettlementBuilding(simulation, goal.target, ["farm"]);
        const spot = farm || goal.target.center;
        if (spot) {
          actions.push({ type: "tend_town_farm", target: spot, score: goal.priority });
        }
        break;
      }

      case "deposit_to_stockpile":
        if (goal.target) {
          actions.push({
            type: "deposit_to_stockpile",
            target: goal.target,
            score: goal.priority
          });
        }
        break;

      case "eat_from_stockpile":
        if (goal.target) {
          actions.push({
            type: "eat_from_stockpile",
            target: goal.target,
            score: goal.priority
          });
        }
        break;

      case "military_duty":
        actions.push({
          type: "military_duty",
          score: goal.priority
        });
        break;

      case "hunt":
        if (goal.target && goal.target.alive !== false) {
          actions.push({
            type: "hunt",
            target: goal.target,
            score: goal.priority + (12 - Math.min(12, agent.distanceTo(goal.target)))
          });
        }
        break;

      case "hunt_patrol": {
        let targetPrey = null;
        let bestDist = Infinity;
        needScan();
        for (const an of perception.nearbyAnimals) {
          if (!an || an.alive === false || an.species === "wolf") continue;
          const d = agent.distanceTo(an);
          if (d < bestDist || (d === bestDist && targetPrey && String(an.id) < String(targetPrey.id))) {
            bestDist = d;
            targetPrey = an;
          }
        }
        if (!targetPrey && simulation?.animalSystem?.animals) {
          const animals = simulation.animalSystem.animals;
          for (let i = 0; i < animals.length; i++) {
            const an = animals[i];
            if (!an || an.alive === false || an.species === "wolf") continue;
            const d = agent.distanceTo(an);
            if (d <= 34 && (d < bestDist || (d === bestDist && targetPrey && String(an.id) < String(targetPrey.id)))) {
              bestDist = d;
              targetPrey = an;
            }
          }
        }
        if (targetPrey) {
          actions.push({
            type: "hunt",
            target: targetPrey,
            score: goal.priority + (12 - Math.min(11, bestDist * 0.35))
          });
        }
        break;
      }

      case "flee":
        actions.push({
          type: "flee",
          target: goal.target,
          kind: goal.kind,
          score: goal.priority
        });
        break;

      case "explore":
        actions.push({
          type: "wander",
          score: goal.priority * agent.personality.curious
        });
        break;
    }
  }

  if (actions.length === 0) {
    actions.push({ type: "wander", score: 1 });
  }

  return actions;
}

export function chooseAction(agent, AgentClass, actions, options = {}) {
  if (!actions || actions.length === 0) return null;

  const now = agent._memoryNow();
  let traumaFear = 0;
  for (const m of agent.memories) {
    if (m.type === "WITNESSED_DEATH" && now - (m.tick || 0) < AgentClass.MEMORY_RECENCY_TICKS) {
      traumaFear += 2;
    }
  }
  const rep = agent.reputation || 0;

  for (const action of actions) {
    const subj = agent._actionSubject(action);
    if (subj != null) {
      const aff = agent._feltAbout(subj, now);
      if (aff !== 0) {
        const weight = AgentClass.SOCIAL_ACTION_TYPES.has(action.type) ? 14 : 6;
        action.score += aff > 0
          ? Math.min(8, aff) * weight / 8
          : Math.max(-10, aff) * weight / 8;
      }
      if (traumaFear > 0 && AgentClass.SOCIAL_ACTION_TYPES.has(action.type)) {
        action.score -= Math.min(6, traumaFear);
      }
    }
    if (rep !== 0) action.score += rep * 0.02;

    const tTarget = action.target;
    if (tTarget && typeof tTarget.x === "number" && typeof tTarget.y === "number") {
      for (const m of agent.memories) {
        if (m.type === "SURVIVED_FIRE" && now - (m.tick || 0) < AgentClass.MEMORY_RECENCY_TICKS * 2) {
          const d = Math.hypot(tTarget.x - m.x, tTarget.y - m.y);
          if (d <= (m.radius || 15)) {
            action.score -= 10;
            break;
          }
        }
      }
    }

    const gossipOnMe = options.targetGossip;
    if (gossipOnMe && AgentClass.SOCIAL_ACTION_TYPES.has(action.type)) {
      const subjG = agent._actionSubject(action);
      const about = subjG != null ? gossipOnMe.get(subjG) : undefined;
      if (about) action.score += Math.max(-6, Math.min(6, about * 0.8));
    }
  }

  let best = actions[0];
  for (let i = 1; i < actions.length; i++) {
    if (actions[i].score > best.score) {
      best = actions[i];
    }
  }
  return best;
}
