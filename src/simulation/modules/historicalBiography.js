import { BUILDING_METADATA } from "../../core/constants.js";
import { formatAgentFullName } from "../agent.js";

export function recordDeadDossier(sim, agent, cause = "natural") {
  if (!agent || agent.id == null) return null;
  if (!Array.isArray(sim._deadDossiers)) sim._deadDossiers = [];
  const dossier = buildAgentDossier(sim, agent, {
    alive: false,
    deathCause: cause || agent.deathCause || "natural",
  });
  const existingIdx = sim._deadDossiers.findIndex((d) => d.id === agent.id);
  if (existingIdx !== -1) {
    sim._deadDossiers[existingIdx] = dossier;
  } else {
    sim._deadDossiers.push(dossier);
    if (sim._deadDossiers.length > 120) {
      sim._deadDossiers.shift();
    }
  }
  return dossier;
}

/**
 * Pure zero-RNG 1-2 sentence historical biography or epitaph synthesized from an agent's life record.
 */
export function buildAgentBiography(sim, agentOrDossier, overrides = {}) {
  if (!agentOrDossier) return "";
  const alive = overrides.alive !== undefined ? overrides.alive : (agentOrDossier.alive !== false);
  const fullName = overrides.fullName || agentOrDossier.fullName || formatAgentFullName(agentOrDossier);
  const surname = agentOrDossier.surname || null;
  const gen = agentOrDossier.generation ?? 1;
  const age = Math.floor(overrides.age ?? agentOrDossier.age ?? 0);
  const home = overrides.settlementName || agentOrDossier.settlementName || (
    agentOrDossier.settlementId != null
      ? (sim.settlementSystem?.settlements?.get(agentOrDossier.settlementId)?.name || "the Wilds")
      : "the Wilds"
  );
  const job = String(agentOrDossier.jobTitle || agentOrDossier.job || "citizen");
  const kills = agentOrDossier.kills || 0;
  const battles = agentOrDossier.battlesFought || 0;
  const built = agentOrDossier.buildingsBuilt || 0;
  const isMonarch = !!agentOrDossier.isMonarch;
  const heirloomName = agentOrDossier.heirloom?.name || null;
  const weapon = agentOrDossier.legendaryWeapon || null;
  const childCount = Array.isArray(agentOrDossier.children)
    ? agentOrDossier.children.length
    : (agentOrDossier.children || 0);
  const deathCause = overrides.deathCause || agentOrDossier.deathCause || "natural causes";

  let roleClause = `a ${job.toLowerCase()} of ${home}`;
  if (isMonarch) {
    roleClause = `sovereign ruler of ${home}`;
  } else if (weapon || kills >= 3) {
    roleClause = `a decorated champion of ${home} (${kills} kills across ${battles} battles)`;
  } else if (built >= 2) {
    roleClause = `a master builder of ${home} who raised ${built} structures`;
  } else if (age >= 58) {
    roleClause = `a respected elder ${job.toLowerCase()} of ${home}`;
  }

  const houseClause = surname ? ` (House ${surname}, Gen ${gen})` : "";
  const firstSentence = alive
    ? `${fullName}${houseClause} is ${roleClause}, now aged ${age}.`
    : `${fullName}${houseClause} served as ${roleClause} before passing at age ${age} (${String(deathCause).replace(/_/g, " ")}).`;

  const details = [];
  if (weapon && !isMonarch && kills < 3) details.push(`wielded ${weapon}`);
  if (built === 1) details.push("raised 1 civic landmark");
  else if (built >= 2 && (isMonarch || weapon || kills >= 3)) details.push(`built ${built} landmarks`);
  if (heirloomName) details.push(`${alive ? "guards" : "carried"} the heirloom "${heirloomName}"`);
  if (childCount > 0) details.push(`parented ${childCount} ${childCount === 1 ? "child" : "children"}`);

  if (details.length === 0) return firstSentence;
  const secondSentence = details.length === 1
    ? `In life they ${details[0]}.`
    : `In life they ${details.slice(0, -1).join(", ")} and ${details[details.length - 1]}.`;
  return `${firstSentence} ${secondSentence}`;
}

export function getBuiltStructuresForAgent(sim, agentId) {
  if (agentId == null || !Array.isArray(sim.buildings)) return [];
  const results = [];
  for (const b of sim.buildings) {
    if (!b) continue;
    const isLead = b.builtByAgentId === agentId;
    const isRenovator = b.upgradedByAgentId === agentId ||
      (Array.isArray(b.upgradeHistory) && b.upgradeHistory.some((u) => u && u.byAgentId === agentId));
    const isContrib = Array.isArray(b.contributors) && b.contributors.some((c) => c && c.id === agentId);
    if (!isLead && !isRenovator && !isContrib) continue;
    const bType = b.buildingType || b.type || "structure";
    const meta = BUILDING_METADATA[bType];
    const sName = b.settlementId != null ? (sim.settlementSystem?.settlements?.get(b.settlementId)?.name || null) : null;
    results.push({
      id: b.id,
      buildingType: bType,
      name: b.customName || meta?.name || String(bType).replace(/_/g, " "),
      customName: b.customName || null,
      level: b.level || 1,
      maxLevel: b.maxLevel || meta?.maxLevel || 3,
      settlementName: sName,
      builtYear: b.builtYear ?? null,
      builtInEra: b.builtInEra ?? meta?.minEra ?? 1,
      builtEraName: b.builtEraName ?? null,
      isHeritage: Boolean(b.isHeritage || meta?.isMonument || String(bType).startsWith("monument_")),
      isRuined: Boolean(b.isRuined),
      role: isLead ? "lead" : (isRenovator ? "renovator" : "contributor"),
      x: b.x,
      y: b.y,
    });
  }
  results.sort((a, b) => (Number(b.isHeritage) - Number(a.isHeritage)) || (b.level - a.level) || (a.id - b.id));
  return results.slice(0, 16);
}

export function buildAgentDossier(sim, agent, overrides = {}) {
  if (!agent) return null;
  const settlementName = agent.settlementId
    ? (sim.settlementSystem?.settlements?.get(agent.settlementId)?.name || `Settlement ${agent.settlementId}`)
    : "Wilds";

  const resolveRef = (id) => {
    if (id == null) return null;
    const live = sim._agentById(id);
    if (live) return { id: live.id, name: formatAgentFullName(live), alive: !!live.alive };
    const archived = Array.isArray(sim._deadDossiers) ? sim._deadDossiers.find((d) => d.id === id) : null;
    if (archived) return { id: archived.id, name: archived.fullName || archived.name, alive: false };
    const hero = Array.isArray(sim.fallenHeroes) ? sim.fallenHeroes.find((h) => h.id === id) : null;
    if (hero) return { id: hero.id, name: hero.fullName || hero.name, alive: false };
    return { id, name: `#${id}`, alive: false };
  };

  const fam = sim.relationshipSystem?.getRelatives?.(agent.id);
  const parentIds = (fam?.parents?.length ? fam.parents : agent.parents) || [];
  const parents = parentIds.map(resolveRef).filter(Boolean);
  const spouseId = fam?.spouse ?? agent.partnerId ?? null;
  const spouse = spouseId != null ? resolveRef(spouseId) : null;
  const children = (fam?.children || []).map(resolveRef).filter(Boolean);
  const siblings = (fam?.siblings || []).map(resolveRef).filter(Boolean);

  const friends = [];
  const rivals = [];
  const relMap = sim.relationshipSystem?.relationships?.get(agent.id);
  if (relMap) {
    const entries = Array.from(relMap.entries()).sort((a, b) => a[0] - b[0]);
    for (const [otherId, rel] of entries) {
      const ref = resolveRef(otherId);
      if (!ref) continue;
      const net = Math.round((rel.friendship || 0) - (rel.rivalry || 0));
      if ((rel.rivalry || 0) >= 25 || net <= -20) {
        rivals.push({ ...ref, score: Math.round(rel.rivalry || Math.abs(net)), label: rel.relationType || "Rival" });
      } else if ((rel.friendship || 0) >= 25 || (rel.romance || 0) >= 40) {
        friends.push({
          ...ref,
          score: Math.round(Math.max(rel.friendship || 0, rel.romance || 0)),
          label: rel.relationType || ((rel.romance || 0) >= 60 ? "Romantic" : "Friend")
        });
      }
    }
    friends.sort((a, b) => b.score - a.score || a.id - b.id);
    rivals.sort((a, b) => b.score - a.score || a.id - b.id);
  }

  const aliveFlag = overrides.alive !== undefined ? overrides.alive : agent.alive !== false;
  const deathCause = overrides.deathCause ?? agent.deathCause ?? null;
  const fullName = formatAgentFullName(agent);
  const builtStructures = getBuiltStructuresForAgent(sim, agent.id);
  const dossier = {
    id: agent.id,
    name: agent.name,
    surname: agent.surname ?? null,
    fullName,
    epithet: agent.epithet ?? null,
    age: Math.floor(agent.age || 0),
    maxAge: Math.floor(agent.maxAge || 72),
    lifeStage: agent.lifeStage || "adult",
    gender: agent.gender || "neutral",
    alive: aliveFlag,
    deathCause,
    deathTick: aliveFlag === false ? (sim.clock?.tick ?? 0) : null,
    job: agent.job || "unemployed",
    jobTitle: agent.jobTitle || agent.job || "Unemployed",
    settlementId: agent.settlementId ?? null,
    settlementName,
    generation: agent.generation ?? 1,
    buildingsBuilt: agent.buildingsBuilt || 0,
    builtStructures,
    heirloom: agent.heirloom ? { ...agent.heirloom } : null,
    x: agent.x,
    y: agent.y,
    traits: agent.personality ? { ...agent.personality } : {},
    skills: agent.skills ? { ...agent.skills } : {},
    kills: agent.kills || 0,
    battlesFought: agent.battlesFought || 0,
    veteranCampaigns: agent.veteranCampaigns || 0,
    legendaryWeapon: agent.legendaryWeapon || null,
    isMonarch: agent.isMonarch === true,
    isRebel: agent.isRebel === true,
    captive: agent.captive === true,
    combatRole: agent.combatRole || null,
    faith: Math.round(agent.religion?.faith || 0),
    beliefId: agent.religion?.beliefId || null,
    reputation: Math.round(agent.reputation || 0),
    parents,
    spouse,
    children,
    siblings,
    friends: friends.slice(0, 6),
    rivals: rivals.slice(0, 6),
    lifeHistory: Array.isArray(agent.lifeHistory) ? agent.lifeHistory.map((e) => ({ ...e })) : []
  };
  dossier.biography = buildAgentBiography(sim, {
    ...dossier,
    children: children.length
  }, { alive: aliveFlag, deathCause, settlementName, fullName });
  return dossier;
}

export function getAgentDossier(sim, agentOrId) {
  if (!agentOrId && agentOrId !== 0) return null;
  const id = typeof agentOrId === "object" ? agentOrId.id : agentOrId;
  const live = sim._agentById(id);
  if (live && live.alive) {
    return buildAgentDossier(sim, live);
  }
  if (Array.isArray(sim._deadDossiers)) {
    const archived = sim._deadDossiers.find((d) => d.id === id);
    if (archived) {
      if (!archived.biography) archived.biography = buildAgentBiography(sim, archived, { alive: false });
      if (!archived.fullName) archived.fullName = formatAgentFullName(archived);
      const liveBuilt = getBuiltStructuresForAgent(sim, id);
      return liveBuilt.length > 0 || !archived.builtStructures
        ? { ...archived, builtStructures: liveBuilt }
        : archived;
    }
  }
  if (Array.isArray(sim.fallenHeroes)) {
    const hero = sim.fallenHeroes.find((h) => h.id === id);
    if (hero) {
      const deathTick = hero.deathTick || 0;
      const fullName = hero.fullName || formatAgentFullName(hero);
      return {
        id: hero.id,
        name: hero.name,
        surname: hero.surname || null,
        fullName,
        epithet: hero.epithet || null,
        age: hero.age || 0,
        maxAge: hero.age || 72,
        lifeStage: "fallen",
        gender: "neutral",
        alive: false,
        deathCause: hero.cause || "combat",
        deathTick,
        job: "soldier",
        jobTitle: hero.isMonarch ? "Fallen Sovereign" : "Fallen Hero",
        settlementId: null,
        settlementName: hero.settlementName || "Wilds",
        generation: hero.generation ?? 1,
        buildingsBuilt: hero.buildingsBuilt || 0,
        builtStructures: getBuiltStructuresForAgent(sim, hero.id),
        heirloom: hero.heirloom ? { ...hero.heirloom } : null,
        x: hero.x,
        y: hero.y,
        traits: {},
        skills: {},
        kills: hero.kills || 0,
        battlesFought: hero.battlesFought || 0,
        veteranCampaigns: 0,
        legendaryWeapon: hero.legendaryWeapon || null,
        isMonarch: !!hero.isMonarch,
        isRebel: false,
        captive: false,
        combatRole: null,
        faith: 0,
        beliefId: null,
        reputation: 0,
        parents: [],
        spouse: null,
        children: [],
        siblings: [],
        friends: [],
        rivals: [],
        biography: hero.biography || buildAgentBiography(sim, hero, { alive: false, fullName }),
        lifeHistory: [
          { tick: deathTick, year: Math.floor(deathTick / 400) + 1, kind: "DEATH", icon: "🕯️", text: `Fell (${hero.cause || "combat"}) with ${hero.kills || 0} kills.`, milestone: true }
        ]
      };
    }
  }
  if (typeof agentOrId === "object") {
    return buildAgentDossier(sim, agentOrId, { alive: false });
  }
  return null;
}

/**
 * Read-only roster of living notables, multi-generation family bloodlines, and fallen memorials.
 * Deterministic: zero RNG draws, pure sort by notability & ID.
 */
export function getHistoricalPeopleRoster(sim) {
  const settlementNameOf = (sid) =>
    sid != null ? (sim.settlementSystem?.settlements?.get(sid)?.name || "Wilds") : "Wilds";

  const scoreLiving = (a) => (
    (a.isMonarch ? 100 : 0) +
    (a.legendaryWeapon ? 45 : 0) +
    (a.heirloom ? 30 : 0) +
    ((a.kills || 0) * 14) +
    ((a.buildingsBuilt || 0) * 12) +
    (a.epithet ? 18 : 0) +
    ((a.lifeHistory?.length || 0) * 2) +
    (a.age >= 58 ? 8 : 0)
  );

  const livingAgents = (sim.agents || []).filter((a) => a && a.alive);
  const livingLegends = livingAgents
    .slice()
    .sort((a, b) => (scoreLiving(b) - scoreLiving(a)) || (a.id - b.id))
    .slice(0, 60)
    .map((a) => {
      const sName = settlementNameOf(a.settlementId);
      const fullName = formatAgentFullName(a);
      return {
        id: a.id,
        name: a.name,
        surname: a.surname || null,
        fullName,
        epithet: a.epithet || null,
        age: Math.floor(a.age || 0),
        job: a.job || "unemployed",
        jobTitle: a.jobTitle || a.job || "Citizen",
        settlementId: a.settlementId ?? null,
        settlementName: sName,
        generation: a.generation ?? 1,
        isMonarch: !!a.isMonarch,
        kills: a.kills || 0,
        battlesFought: a.battlesFought || 0,
        buildingsBuilt: a.buildingsBuilt || 0,
        legendaryWeapon: a.legendaryWeapon || null,
        heirloom: a.heirloom ? { ...a.heirloom } : null,
        biography: buildAgentBiography(sim, a, { alive: true, settlementName: sName, fullName }),
        x: a.x,
        y: a.y,
        lifeHistoryCount: Array.isArray(a.lifeHistory) ? a.lifeHistory.length : 0,
      };
    });

  // Fallen Archives: merge _deadDossiers & fallenHeroes keyed by id
  const fallenMap = new Map();
  if (Array.isArray(sim._deadDossiers)) {
    for (const d of sim._deadDossiers) {
      if (!d || d.id == null) continue;
      fallenMap.set(d.id, {
        id: d.id,
        name: d.name,
        surname: d.surname || null,
        fullName: d.fullName || formatAgentFullName(d),
        epithet: d.epithet || null,
        age: Math.floor(d.age || 0),
        deathCause: d.deathCause || "natural",
        deathTick: d.deathTick ?? 0,
        settlementId: d.settlementId ?? null,
        settlementName: d.settlementName || "Wilds",
        generation: d.generation ?? 1,
        isMonarch: !!d.isMonarch,
        kills: d.kills || 0,
        battlesFought: d.battlesFought || 0,
        buildingsBuilt: d.buildingsBuilt || 0,
        legendaryWeapon: d.legendaryWeapon || null,
        heirloom: d.heirloom ? { ...d.heirloom } : null,
        biography: d.biography || buildAgentBiography(sim, d, { alive: false }),
        x: d.x ?? null,
        y: d.y ?? null,
        lifeHistoryCount: Array.isArray(d.lifeHistory) ? d.lifeHistory.length : 0,
      });
    }
  }
  if (Array.isArray(sim.fallenHeroes)) {
    for (const h of sim.fallenHeroes) {
      if (!h || h.id == null || fallenMap.has(h.id)) continue;
      const fullName = h.fullName || formatAgentFullName(h);
      fallenMap.set(h.id, {
        id: h.id,
        name: h.name,
        surname: h.surname || null,
        fullName,
        epithet: h.epithet || null,
        age: Math.floor(h.age || 0),
        deathCause: h.cause || "combat",
        deathTick: h.deathTick ?? 0,
        settlementId: h.settlementId ?? null,
        settlementName: h.settlementName || "Wilds",
        generation: h.generation ?? 1,
        isMonarch: !!h.isMonarch,
        kills: h.kills || 0,
        battlesFought: h.battlesFought || 0,
        buildingsBuilt: h.buildingsBuilt || 0,
        legendaryWeapon: h.legendaryWeapon || null,
        heirloom: h.heirloom ? { ...h.heirloom } : null,
        biography: h.biography || buildAgentBiography(sim, h, { alive: false, fullName }),
        x: h.x ?? null,
        y: h.y ?? null,
        lifeHistoryCount: 1,
      });
    }
  }

  const scoreFallen = (d) => (
    (d.isMonarch ? 100 : 0) +
    (d.legendaryWeapon ? 45 : 0) +
    (d.heirloom ? 25 : 0) +
    ((d.kills || 0) * 12) +
    ((d.buildingsBuilt || 0) * 10) +
    ((d.deathTick || 0) * 0.001)
  );
  const fallenArchives = Array.from(fallenMap.values())
    .sort((a, b) => (scoreFallen(b) - scoreFallen(a)) || ((b.deathTick || 0) - (a.deathTick || 0)) || (a.id - b.id))
    .slice(0, 60);

  // Group Family Bloodlines by surname across living + archived dead
  const houses = new Map();
  const touchHouse = (person, alive) => {
    if (!person?.surname) return;
    let house = houses.get(person.surname);
    if (!house) {
      house = {
        surname: person.surname,
        livingCount: 0,
        fallenCount: 0,
        maxGeneration: 1,
        totalKills: 0,
        totalBuildingsBuilt: 0,
        originSettlement: null,
        _originGen: 999,
        _originId: 999999999,
        settlementSet: new Set(),
        heirloomSet: new Set(),
        heirloomMap: new Map(),
        members: [],
      };
      houses.set(person.surname, house);
    }
    if (alive) house.livingCount++;
    else house.fallenCount++;
    const gen = person.generation ?? 1;
    house.maxGeneration = Math.max(house.maxGeneration, gen);
    house.totalKills += person.kills || 0;
    house.totalBuildingsBuilt += person.buildingsBuilt || 0;
    const sName = alive ? settlementNameOf(person.settlementId) : person.settlementName;
    if (sName && sName !== "Wilds") {
      house.settlementSet.add(sName);
      if (gen < house._originGen || (gen === house._originGen && person.id < house._originId)) {
        house._originGen = gen;
        house._originId = person.id;
        house.originSettlement = sName;
      }
    }
    const fullName = formatAgentFullName(person);
    if (person.heirloom?.name) {
      house.heirloomSet.add(person.heirloom.name);
      const prev = house.heirloomMap.get(person.heirloom.name);
      if (!prev || (alive && !prev.holderAlive) || (person.heirloom.generationsHeld || 1) > (prev.generationsHeld || 1)) {
        house.heirloomMap.set(person.heirloom.name, {
          ...person.heirloom,
          holderId: person.id,
          holderName: fullName,
          holderAlive: alive,
        });
      }
    }
    house.members.push({
      id: person.id,
      fullName,
      alive,
      age: Math.floor(person.age || 0),
      generation: gen,
      isMonarch: !!person.isMonarch,
      jobTitle: person.jobTitle || person.job || (alive ? "Citizen" : "Fallen"),
      settlementName: sName || "Wilds",
      epithet: person.epithet || null,
      kills: person.kills || 0,
      buildingsBuilt: person.buildingsBuilt || 0,
      heirloomName: person.heirloom?.name || null,
      heirloom: person.heirloom ? { ...person.heirloom } : null,
    });
  };

  for (const a of livingAgents) touchHouse(a, true);
  for (const d of fallenMap.values()) touchHouse(d, false);

  const familyLines = Array.from(houses.values())
    .map((h) => {
      h.members.sort((a, b) => (Number(b.alive) - Number(a.alive)) || (b.generation - a.generation) || (b.kills - a.kills) || (a.id - b.id));
      const heirlooms = Array.from(h.heirloomMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      return {
        surname: h.surname,
        livingCount: h.livingCount,
        fallenCount: h.fallenCount,
        maxGeneration: h.maxGeneration,
        totalKills: h.totalKills,
        totalBuildingsBuilt: h.totalBuildingsBuilt,
        originSettlement: h.originSettlement,
        totalMembersCount: h.members.length,
        activeSettlements: Array.from(h.settlementSet).sort(),
        heirloomNames: Array.from(h.heirloomSet).sort(),
        heirlooms,
        members: h.members.slice(0, 24),
      };
    })
    .sort((a, b) =>
      (b.maxGeneration - a.maxGeneration) ||
      ((b.livingCount * 2 + b.fallenCount) - (a.livingCount * 2 + a.fallenCount)) ||
      a.surname.localeCompare(b.surname)
    )
    .slice(0, 24);

  return { livingLegends, familyLines, fallenArchives };
}
