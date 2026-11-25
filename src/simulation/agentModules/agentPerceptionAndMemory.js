// Agent spatial memory, sensory perception, personal memory, biography, and gossip network.
// Extracted from Agent for modularity with zero circular dependencies and byte-identical determinism.

export function rememberNode(agent, x, y, type, richness = 1, tick = 0) {
  if (!Array.isArray(agent.spatialMemory)) agent.spatialMemory = [];
  const existing = agent.spatialMemory.find(m => m.x === x && m.y === y && m.type === type);
  if (existing) {
    existing.richness = Math.max(existing.richness, richness);
    existing.tick = tick;
    return;
  }
  agent.spatialMemory.push({ x, y, type, richness, tick });
  const maxEntries = agent.constructor.SPATIAL_MEMORY_MAX || 12;
  if (agent.spatialMemory.length > maxEntries) {
    agent.spatialMemory.sort((a, b) => (a.tick - b.tick) || (a.x - b.x) || (a.y - b.y));
    agent.spatialMemory.splice(0, agent.spatialMemory.length - maxEntries);
  }
}

export function recallNode(agent, type, x, y, radius = 20, maxAgeTicks = 4000, now = 0) {
  let best = null;
  let bestScore = -Infinity;
  for (const m of agent.spatialMemory || []) {
    if (type && m.type !== type) continue;
    if (now - (m.tick || 0) > maxAgeTicks) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d > radius) continue;
    const score = m.richness * 10 - d + (m.tick || 0) * 1e-6;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function ensurePerceptionBlock(agent) {
  let perception = agent._perception;
  if (!perception) {
    perception = agent._perception = {
      nearbyAgents: [],
      nearbyResources: [],
      nearbyBuildings: [],
      nearbyAnimals: [],
      nearbyItems: [],
      dangers: [],
      opportunities: []
    };
  }
  perception.nearbyAgents.length = 0;
  perception.nearbyResources.length = 0;
  perception.nearbyBuildings.length = 0;
  perception.nearbyAnimals.length = 0;
  if (!agent._perceptionItemsFilled) perception.nearbyItems.length = 0;
  perception.dangers.length = 0;
  perception.opportunities.length = 0;
  return perception;
}

export function perceiveAgent(agent, world, entities, radius = 12) {
  const perception = ensurePerceptionBlock(agent);
  agent._perceptionWorld = world;
  agent._perceptionTick = world.clock ? world.clock.tick : 0;
  agent._perceptionItemsFilled = true;
  agent._perceptionValid = true;

  const r = Math.max(0, radius | 0);
  const MAX_NEARBY_AGENTS = r <= 12 ? 12 : 24;
  const MAX_NEARBY_RESOURCES = r <= 12 ? 8 : 16;
  const MAX_NEARBY_BUILDINGS = r <= 12 ? 6 : 12;
  const MAX_NEARBY_ANIMALS = r <= 12 ? 6 : 12;

  const rSq = radius * radius;
  const fx = Math.floor(agent.x);
  const fy = Math.floor(agent.y);
  const ax = agent.x;
  const ay = agent.y;
  const selfId = agent.id;

  if (world && typeof world._getScanBuckets === "function") {
    const buckets = world._getScanBuckets(fx, fy, r);
    const bAgents = buckets.agents;
    const outAgents = perception.nearbyAgents;
    for (let i = 0; i < bAgents.length && outAgents.length < MAX_NEARBY_AGENTS; i++) {
      const entity = bAgents[i];
      if (entity.id === selfId) continue;
      const dx = entity.x - ax;
      const dy = entity.y - ay;
      if (dx * dx + dy * dy <= rSq) outAgents.push(entity);
    }

    const bRes = buckets.resources;
    const outRes = perception.nearbyResources;
    for (let i = 0; i < bRes.length && outRes.length < MAX_NEARBY_RESOURCES; i++) {
      const entity = bRes[i];
      const dx = entity.x - ax;
      const dy = entity.y - ay;
      if (dx * dx + dy * dy <= rSq) outRes.push(entity);
    }

    const bBld = buckets.buildings;
    const outBld = perception.nearbyBuildings;
    for (let i = 0; i < bBld.length && outBld.length < MAX_NEARBY_BUILDINGS; i++) {
      const entity = bBld[i];
      const dx = entity.x - ax;
      const dy = entity.y - ay;
      if (dx * dx + dy * dy <= rSq) outBld.push(entity);
    }

    const bAni = buckets.animals;
    const outAni = perception.nearbyAnimals;
    for (let i = 0; i < bAni.length && outAni.length < MAX_NEARBY_ANIMALS; i++) {
      const entity = bAni[i];
      if (entity.alive === false) continue;
      const dx = entity.x - ax;
      const dy = entity.y - ay;
      if (dx * dx + dy * dy <= rSq) outAni.push(entity);
    }
    return perception;
  }

  const nearby = world && typeof world._getScan === "function"
    ? world._getScan(fx, fy, r)
    : world.getEntitiesNear(fx, fy, r);

  for (const entity of nearby) {
    if (
      perception.nearbyAgents.length >= MAX_NEARBY_AGENTS &&
      perception.nearbyResources.length >= MAX_NEARBY_RESOURCES &&
      perception.nearbyBuildings.length >= MAX_NEARBY_BUILDINGS &&
      perception.nearbyAnimals.length >= MAX_NEARBY_ANIMALS
    ) {
      break;
    }

    if (entity.id === selfId) continue;

    const dx = entity.x - ax;
    const dy = entity.y - ay;
    const distSq = dx * dx + dy * dy;

    if (distSq <= rSq) {
      if (entity.type === "agent") {
        if (perception.nearbyAgents.length < MAX_NEARBY_AGENTS) perception.nearbyAgents.push(entity);
      } else if (entity.type === "resource") {
        if (perception.nearbyResources.length < MAX_NEARBY_RESOURCES) perception.nearbyResources.push(entity);
      } else if (entity.type === "building") {
        if (perception.nearbyBuildings.length < MAX_NEARBY_BUILDINGS) perception.nearbyBuildings.push(entity);
      } else if (entity.type === "animal" && entity.alive !== false) {
        if (perception.nearbyAnimals.length < MAX_NEARBY_ANIMALS) perception.nearbyAnimals.push(entity);
      }
    }
  }

  return perception;
}

export function rememberMemory(agent, AgentClass, type, tick, extra = {}) {
  if (!Array.isArray(agent.memories)) agent.memories = [];
  agent.memories.push({ type, tick, ...extra });
  if (agent.memories.length > AgentClass.MEMORIES_MAX) {
    agent.memories.splice(0, agent.memories.length - AgentClass.MEMORIES_MAX);
  }
  const delta = extra.rep || 0;
  if (delta) agent.reputation = Math.max(-100, Math.min(100, (agent.reputation || 0) + delta));

  if (
    extra.subjectId != null &&
    agent.sim?.relationshipSystem &&
    AgentClass.NEGATIVE_MEMORY_TYPES.has(type)
  ) {
    agent.sim.relationshipSystem.addMemory(agent.id, extra.subjectId, {
      type: "negative",
      description: type.replace(/_/g, " ").toLowerCase(),
      impact: Math.max(-5, -(Math.abs(delta) || 1))
    });
  }
  return agent;
}

export function addLifeEvent(agent, AgentClass, kind, text, tick = 0, icon = "📜", milestone = false) {
  if (!text) return agent;
  if (!Array.isArray(agent.lifeHistory)) agent.lifeHistory = [];
  const safeTick = Number.isFinite(tick) ? tick : 0;
  const prev = agent.lifeHistory[agent.lifeHistory.length - 1];
  if (prev && prev.kind === kind && prev.text === text && (safeTick - (prev.tick || 0)) < 15) {
    return agent;
  }
  const year = Math.floor(safeTick / 400) + 1;
  const ageSys = agent.sim?.civilizationAgeSystem;
  const eraObj = (agent.settlementId != null && ageSys?.getSettlementAge?.(agent.settlementId))
    || ageSys?.getDominantAge?.()
    || null;
  const eraId = eraObj?.ageId ?? eraObj?.id ?? 1;
  const eraName = eraObj?.ageName ?? eraObj?.name ?? "Tribal Era";
  const eraIcon = eraObj?.icon ?? "🏕️";
  agent.lifeHistory.push({
    tick: safeTick,
    year,
    eraId,
    eraName,
    eraIcon,
    kind,
    icon,
    text,
    milestone: Boolean(milestone)
  });
  if (agent.lifeHistory.length > AgentClass.LIFE_HISTORY_MAX) {
    const evictIdx = agent.lifeHistory.findIndex((e, idx) => idx > 0 && !e.milestone);
    agent.lifeHistory.splice(evictIdx >= 0 ? evictIdx : 1, 1);
  }
  return agent;
}

export function feltAbout(agent, AgentClass, subjectId, now) {
  let aff = 0;

  for (const m of agent.memories) {
    if (m.subjectId !== subjectId) continue;
    const age = Math.max(0, now - (m.tick || 0));
    if (age > AgentClass.MEMORY_RECENCY_TICKS) continue;
    const w = 1 - age / AgentClass.MEMORY_RECENCY_TICKS;
    if (AgentClass.POSITIVE_MEMORY_TYPES.has(m.type)) aff += 4 * w;
    else if (AgentClass.NEGATIVE_MEMORY_TYPES.has(m.type)) aff -= 6 * w;
  }

  const rel = agent.sim?.relationshipSystem?.getRelationship?.(agent.id, subjectId);
  if (rel) {
    const bond = (rel.friendship || 0) - (rel.rivalry || 0);
    aff += Math.max(-5, Math.min(5, bond / 20));
    if (Array.isArray(rel.memories)) {
      for (const dm of rel.memories) {
        if (dm.type !== "negative" && dm.type !== "traumatic") continue;
        const age = Math.max(0, now - (dm.timestamp || 0));
        if (age > AgentClass.MEMORY_RECENCY_TICKS) continue;
        aff += (dm.impact || -1) * 0.3 * (1 - age / AgentClass.MEMORY_RECENCY_TICKS);
      }
    }
  }

  if (agent.gossipViews && agent.gossipViews.has(subjectId)) {
    const heardAt = agent._gossipHeard?.get(subjectId);
    const gAge = heardAt != null ? Math.max(0, now - heardAt) : 0;
    const decay = Math.max(0.2, 1 - gAge / AgentClass.MEMORY_RECENCY_TICKS);
    aff += 0.6 * agent.gossipViews.get(subjectId) * decay;
  }

  return Math.max(-10, Math.min(10, aff));
}

export function hearGossip(agent, AgentClass, teller, subjectId, now) {
  if (!teller || !subjectId || subjectId === agent.id || subjectId === teller.id) return;
  if (!agent.gossipViews) agent.gossipViews = new Map();
  if (!agent._gossipHeard) agent._gossipHeard = new Map();
  if (!teller.gossipViews) teller.gossipViews = new Map();

  const claim = teller._feltAbout(subjectId, now);
  if (claim === 0) return;

  let fresh = false;
  for (const m of (teller.memories || [])) {
    if (m.subjectId === subjectId && now - (m.tick || 0) < AgentClass.MEMORY_RECENCY_TICKS) {
      fresh = true;
      break;
    }
  }
  if (!fresh) {
    const rel = teller.sim?.relationshipSystem?.getRelationship?.(teller.id, subjectId);
    const relRecent = rel && (rel.lastInteraction ?? 0) > now - AgentClass.MEMORY_RECENCY_TICKS;
    const heardAt = teller._gossipHeard?.get(subjectId);
    const gossipRecent = heardAt != null && now - heardAt < AgentClass.MEMORY_RECENCY_TICKS;
    if (!relRecent && !gossipRecent) return;
  }

  const credibility = AgentClass.GOSSIP_FACTOR *
    (1 + Math.max(-0.5, Math.min(0.5, (teller.reputation || 0) / 100)));
  const message = Math.max(-10, Math.min(10, claim * credibility));

  const prev = agent.gossipViews.get(subjectId) || 0;
  agent.gossipViews.set(subjectId, Math.max(-10, Math.min(10, prev * 0.4 + message)));
  agent._gossipHeard.set(subjectId, now);

  if (agent.gossipViews.size > 1) {
    for (const [id, heard] of [...agent._gossipHeard.entries()]) {
      if (now - heard > AgentClass.MEMORY_RECENCY_TICKS && agent.gossipViews.has(id)) {
        agent.gossipViews.delete(id);
        agent._gossipHeard.delete(id);
      }
    }
  }

  if (agent.gossipViews.size > 12) {
    const rank = (id) => {
      const heardAt = agent._gossipHeard?.get(id);
      return heardAt == null ? -Infinity : Math.max(0, now - heardAt);
    };
    let victim = null;
    let victimAge = -Infinity;
    for (const id of agent.gossipViews.keys()) {
      const age = rank(id);
      if (age > victimAge || (age === victimAge && (victim === null || id < victim))) {
        victim = id;
        victimAge = age;
      }
    }
    if (victim !== null) {
      agent.gossipViews.delete(victim);
      agent._gossipHeard?.delete(victim);
    }
  }
}

export function gossipCandidates(agent, targetAgent) {
  const out = [];
  const seen = new Set();
  const add = (id) => {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const m of (targetAgent.memories || [])) add(m.subjectId);
  for (const k of (targetAgent.gossipViews?.keys() || [])) add(k);
  const relSys = agent.sim?.relationshipSystem;
  const relMap = relSys?.relationships?.get?.(targetAgent.id);
  if (relMap && typeof relMap.keys === "function") {
    for (const k of relMap.keys()) add(k);
  }
  out.sort((a, b) => a - b);
  return out;
}

export function exchangeGossip(agent, other, now) {
  if (!other || other.id === agent.id) return;
  const ourNews = gossipCandidates(agent, agent);
  const theirNews = gossipCandidates(agent, other);
  const inOur = new Set(ourNews);
  const inTheir = new Set(theirNews);

  for (const subjectId of ourNews) {
    if (subjectId !== other.id && inTheir.has(subjectId)) {
      other.hearGossip(agent, subjectId, now);
    }
  }
  for (const subjectId of theirNews) {
    if (subjectId !== agent.id && inOur.has(subjectId)) {
      agent.hearGossip(other, subjectId, now);
    }
  }
}
