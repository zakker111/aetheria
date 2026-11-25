import {
  ChronicleEntrySummary,
  DiplomaticLogEntry,
  InspectedEntityData,
  RelationSummary,
  ResourceSummary,
  SettlementSummary,
  TimeState,
  TreatySummary,
  WarSummary,
} from '../types';

export interface WorldHudSnapshot {
  time: TimeState;
  agentCount: number;
  births: number;
  deaths: number;
  avgDeathAge: number;
  speed: number;
  isPaused: boolean;
  lodStats: { tier0: number; tier1: number; tier2: number; avgTickMs: number } | null;
  weather: { name: string; icon: string; description: string } | null;
  dominantAge: { name: string; icon: string; color: string } | null;
  resources: ResourceSummary;
  societiesCount: number;
  societies: SettlementSummary[] | null;
  wars: WarSummary[];
  treaties: TreatySummary[];
  relations: RelationSummary[];
  diplomaticHistory: DiplomaticLogEntry[];
  chronicleEntries: ChronicleEntrySummary[];
}

export function buildSettlementSummary(sim: any, s: any): SettlementSummary {
  return {
    id: s.id,
    name: s.name,
    tier: s.tier || 'Village',
    tierIcon: s.tierIcon || '🏡',
    population: s.population || (s.agentIds ? s.agentIds.size : 0),
    center: { x: s.center?.x || 0, y: s.center?.y || 0 },
    stockpile: {
      food: s.stockpile?.food || 0,
      wood: s.stockpile?.wood || 0,
      ore: s.stockpile?.ore || 0,
      stone: s.stockpile?.stone || 0,
    },
    leadership: s.leadership,
    leadershipTitle: s.leadershipTitle,
    buildingsCount: s.buildings ? s.buildings.length : 0,
    age: sim.civilizationAgeSystem?.getSettlementAgeSummary(s.id),
    nuclearProgram: sim.civilizationAgeSystem?.getNuclearProgram?.(s.id),
    guilds: sim.espionageSystem?.getSettlementGuilds?.(s.id),
    fortifications: sim.fortificationSystem?.getSettlementFortificationSummary?.(s.id),
    culture: s.culture,
    growthTrend: s.growthTrend,
  };
}

export function buildSettlementInspectPayload(
  sim: any,
  settlement: any,
  fortSummaryOverride?: any
): InspectedEntityData {
  const sId = settlement.id;
  const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary?.(sId);
  const nuclearProgram = sim.civilizationAgeSystem?.getNuclearProgram?.(sId);
  const guilds = sim.espionageSystem?.getSettlementGuilds?.(sId);
  const fortifications =
    fortSummaryOverride ?? sim.fortificationSystem?.getSettlementFortificationSummary?.(sId);
  const docksCount = (sim.buildings || []).filter(
    (b: any) => b.settlementId === sId && (b.buildingType || b.type) === 'dock' && !b.isRuined
  ).length;
  const vesselsCount = (sim.navalSystem?.vessels || []).filter(
    (v: any) => v.settlementId === sId
  ).length;

  return {
    kind: 'settlement',
    entity: {
      ...settlement,
      age: ageSummary,
      nuclearProgram,
      guilds,
      fortifications,
      docksCount,
      vesselsCount,
    },
  };
}

export function buildBuildingInspectPayload(sim: any, building: any): InspectedEntityData {
  const sName =
    building.settlementId != null
      ? sim.settlementSystem?.settlements?.get(building.settlementId)?.name ?? null
      : null;
  const upgradeReq =
    typeof sim.getUpgradeRequirements === 'function' ? sim.getUpgradeRequirements(building) : null;

  return {
    kind: 'building',
    entity: { ...building, settlementName: sName },
    upgradeReq,
  };
}

export function buildAgentInspectPayload(
  sim: any,
  agentOrId: any,
  fallbackEntity?: any
): InspectedEntityData | null {
  const agentId = typeof agentOrId === 'number' ? agentOrId : agentOrId?.id;
  if (agentId == null) return null;

  const live =
    typeof sim._agentById === 'function'
      ? sim._agentById(agentId)
      : sim.agents?.find((a: any) => a.id === agentId);
  const dossier = typeof sim.getAgentDossier === 'function' ? sim.getAgentDossier(agentId) : null;

  if (live && live.alive) {
    return { kind: 'agent', entity: live, dossier };
  }
  if (dossier) {
    return {
      kind: 'agent',
      entity: { ...(fallbackEntity || {}), ...dossier, alive: false },
      dossier,
    };
  }
  if (fallbackEntity) {
    return {
      kind: 'agent',
      entity: { ...fallbackEntity, alive: false },
      dossier: null,
    };
  }
  if (typeof agentOrId === 'object' && agentOrId) {
    return { kind: 'agent', entity: agentOrId, dossier: null };
  }
  return null;
}

export function buildInspectedEntityPayload(
  sim: any,
  currentInspect: InspectedEntityData | null
): InspectedEntityData | null {
  if (!sim || !currentInspect || !currentInspect.entity) return null;

  if (currentInspect.kind === 'agent') {
    return (
      buildAgentInspectPayload(sim, currentInspect.entity.id, currentInspect.entity) || {
        kind: 'agent',
        entity: { ...currentInspect.entity, alive: false },
        dossier: currentInspect.dossier || null,
      }
    );
  }

  if (currentInspect.kind === 'settlement') {
    const updated = sim.settlementSystem?.settlements?.get(currentInspect.entity.id);
    return updated ? buildSettlementInspectPayload(sim, updated) : null;
  }

  if (currentInspect.kind === 'building') {
    const bId = currentInspect.entity.id;
    const stillBuilding = (sim.buildings || []).find((b: any) => b.id === bId);
    return stillBuilding ? buildBuildingInspectPayload(sim, stillBuilding) : null;
  }

  if (currentInspect.kind === 'resource') {
    const rId = currentInspect.entity.id;
    const stillRes = (sim.resources || []).find((r: any) => r.id === rId && !r.destroyed);
    return stillRes ? { kind: 'resource', entity: stillRes } : null;
  }

  return currentInspect;
}

export function buildWorldHudSnapshot(sim: any, includeSocieties: boolean): WorldHudSnapshot {
  const time: TimeState = sim.clock?.getTime?.() || { days: 0, hours: 0, tick: 0 };

  let food = 0;
  let wood = 0;
  let ore = 0;
  let water = 0;
  const resList = sim.resources;
  if (resList) {
    for (let i = 0; i < resList.length; i++) {
      const r = resList[i];
      if (r.destroyed) continue;
      if (r.resourceType === 'food') food++;
      else if (r.resourceType === 'wood') wood++;
      else if (r.resourceType === 'ore' || r.resourceType === 'uranium') ore++;
      else if (r.resourceType === 'water') water++;
    }
  }
  const total = resList ? resList.length : 0;

  const settlementMap: Map<number, any> | undefined = sim.settlementSystem?.settlements;
  const societiesCount = settlementMap ? settlementMap.size : 0;
  let societies: SettlementSummary[] | null = null;
  let wars: WarSummary[] = [];
  let treaties: TreatySummary[] = [];
  let relations: RelationSummary[] = [];
  let diplomaticHistory: DiplomaticLogEntry[] = [];

  if (settlementMap) {
    if (includeSocieties) {
      societies = [];
      for (const s of settlementMap.values()) {
        societies.push(buildSettlementSummary(sim, s));
      }
    }

    const diplomacy = sim.diplomacySystem;
    if (diplomacy) {
      const tickNow = sim.clock?.tick ?? 0;
      wars = (diplomacy.activeWars || []).map((w: any) => ({
        attackerId: w.attackerId,
        attackerName: w.attackerName,
        defenderId: w.defenderId,
        defenderName: w.defenderName,
        casusBelli: w.casusBelli,
        whySummary: w.whySummary,
        drivers: w.drivers,
        warScore: diplomacy.calculateWarScore ? diplomacy.calculateWarScore(w) : 0,
        totalWar: Boolean(w.totalWar),
        casualties: w.casualties || {},
        plundered: w.plundered || { food: 0, wood: 0, ore: 0 },
      }));

      treaties = (diplomacy.treaties || []).map((tr: any) => ({
        title: tr.title || 'Defensive Alliance',
        settlements: tr.settlements,
      }));

      const allSettlements = Array.from(settlementMap.values());
      const relArr: RelationSummary[] = [];
      for (let i = 0; i < allSettlements.length; i++) {
        for (let j = i + 1; j < allSettlements.length; j++) {
          const s1: any = allSettlements[i];
          const s2: any = allSettlements[j];
          const rel = diplomacy.getRelation(s1.id, s2.id);
          if (rel) {
            relArr.push({
              s1Id: s1.id,
              s1Name: s1.name,
              s2Id: s2.id,
              s2Name: s2.name,
              status: rel.status,
              score: rel.score,
              sanctioned: (rel.sanctionedUntil || 0) > tickNow,
              s1Warheads: sim.civilizationAgeSystem?.getNuclearProgram?.(s1.id)?.warheads || 0,
              s2Warheads: sim.civilizationAgeSystem?.getNuclearProgram?.(s2.id)?.warheads || 0,
            });
          }
        }
      }
      relations = relArr;
      diplomaticHistory = Array.isArray(diplomacy.diplomaticHistory)
        ? diplomacy.diplomaticHistory.slice(0, 40)
        : [];
    }
  }

  const speed = sim.clock?.speed ?? 0;

  return {
    time,
    agentCount: sim.agents ? sim.agents.length : 0,
    births: sim.birthsThisSession || 0,
    deaths: sim.deathsThisSession || 0,
    avgDeathAge: sim.mortalityStats?.averageAgeAtDeath || 0,
    speed,
    isPaused: speed === 0,
    lodStats: sim.lodStats
      ? {
          tier0: sim.lodStats.tier0,
          tier1: sim.lodStats.tier1,
          tier2: sim.lodStats.tier2,
          avgTickMs: sim.lodStats.avgTickMs || 0,
        }
      : null,
    weather: sim.weatherSystem ? sim.weatherSystem.getWeatherInfo() : null,
    dominantAge: sim.civilizationAgeSystem ? sim.civilizationAgeSystem.getDominantAge() : null,
    resources: { food, wood, ore, water, total },
    societiesCount,
    societies,
    wars,
    treaties,
    relations,
    diplomaticHistory,
    chronicleEntries: sim.chronicleSystem?.getHighlights ? sim.chronicleSystem.getHighlights(80) : [],
  };
}
