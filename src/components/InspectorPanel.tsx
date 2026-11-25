import React from 'react';
import { AgentDossier, InspectedEntityData } from '../types';
import { BUILDING_META_MAP } from './inspector/InspectorShared';
import { InspectorAgentView } from './inspector/InspectorAgentView';
import { InspectorSettlementView } from './inspector/InspectorSettlementView';
import { InspectorBuildingView } from './inspector/InspectorBuildingView';
import { InspectorResourceView } from './inspector/InspectorResourceView';

interface InspectorPanelProps {
  data: InspectedEntityData | null;
  isFollowing?: boolean;
  onFollowAgent?: (agentId: number | null) => void;
  onSelectAgent?: (agentId: number) => void;
  onSelectBuilding?: (buildingId: number) => void;
  onPanTo?: (x: number, y: number) => void;
  onRallyWarband?: (settlementId: number) => void;
  onSpawnCitizens?: (settlementId: number, count: number) => void;
  onAdvanceWonder?: (settlementId: number) => void;
  onFortifySettlement?: (settlementId: number) => void;
  onUpgradeBuilding?: (buildingId: number) => void;
  onCommissionBuilding?: (settlementId: number, buildingType: string) => void;
  onClose: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  data,
  isFollowing = false,
  onFollowAgent,
  onSelectAgent,
  onSelectBuilding,
  onPanTo,
  onRallyWarband,
  onSpawnCitizens,
  onAdvanceWonder,
  onFortifySettlement,
  onUpgradeBuilding,
  onCommissionBuilding,
  onClose,
}) => {
  if (!data || !data.entity) return null;

  const e = data.entity;
  const dossier: AgentDossier | null = data.dossier || null;
  const isAlive = e.alive !== false && dossier?.alive !== false;
  const isDeceasedAgent = !isAlive && data.kind === 'agent';

  return (
    <div
      className={`bg-slate-900/92 backdrop-blur-md border ${
        isDeceasedAgent ? 'border-red-400/40' : 'border-white/12'
      } rounded-xl px-3.5 py-3 pointer-events-auto shadow-xl text-xs max-h-[420px] flex flex-col overflow-hidden`}
    >
      <div
        className={`flex items-center justify-between gap-2 font-semibold ${
          isDeceasedAgent ? 'text-red-300' : 'text-sky-400'
        } mb-2 border-b border-white/8 pb-1.5 text-[13px] shrink-0`}
      >
        <span className="truncate">
          {data.kind === 'agent' && (() => {
            const full =
              dossier?.fullName ||
              `${e.name || 'Citizen'}${e.surname && !String(e.name || '').includes(e.surname) ? ` ${e.surname}` : ''}${e.epithet ? ` ${e.epithet}` : ''}`;
            return `${isAlive ? '👤' : '🕯️'} ${full}`;
          })()}
          {data.kind === 'settlement' &&
            `${e.tierIcon || '🏡'} ${e.name} (${e.ruined ? 'Collapsed Ruins' : e.tier || 'Village'})`}
          {data.kind === 'building' && (() => {
            const bType = e.buildingType || e.type;
            const bMeta = BUILDING_META_MAP[bType];
            const lvl = e.level || 1;
            const maxLvl = e.maxLevel || bMeta?.maxLevel || 3;
            return `${bMeta?.icon || '🏛️'} ${bMeta?.name || bType} · Lv ${lvl}/${maxLvl}`;
          })()}
          {data.kind === 'resource' &&
            `${e.resourceType === 'food' ? '🌾' : e.resourceType === 'wood' ? '🌲' : e.resourceType === 'uranium' ? '☢️' : e.depositTier === 'iron_mountain' ? '⛰️' : e.resourceType === 'ore' ? '⛏️' : e.resourceType === 'gem' ? '💎' : '💧'} ${e.label || e.resourceType?.toUpperCase()}`}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {data.kind === 'agent' && isAlive && onFollowAgent && (
            <button
              type="button"
              onClick={() => onFollowAgent(e.id)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0 border transition-colors ${
                isFollowing
                  ? 'bg-sky-600 border-sky-400 text-white'
                  : 'bg-sky-400/15 border-sky-400/35 text-sky-400 hover:bg-sky-400/25'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="bg-transparent border-0 text-slate-400 hover:text-slate-200 cursor-pointer text-sm leading-none px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {data.kind === 'agent' ? (
        <InspectorAgentView
          entity={e}
          dossier={dossier}
          isAlive={isAlive}
          onSelectAgent={onSelectAgent}
          onSelectBuilding={onSelectBuilding}
          onPanTo={onPanTo}
        />
      ) : (
        <div className="overflow-y-auto flex-1 pr-1">
          {data.kind === 'settlement' && (
            <InspectorSettlementView
              entity={e}
              onRallyWarband={onRallyWarband}
              onSpawnCitizens={onSpawnCitizens}
              onAdvanceWonder={onAdvanceWonder}
              onFortifySettlement={onFortifySettlement}
              onCommissionBuilding={onCommissionBuilding}
            />
          )}
          {data.kind === 'building' && (
            <InspectorBuildingView
              entity={e}
              upgradeReq={data.upgradeReq}
              onSelectAgent={onSelectAgent}
              onUpgradeBuilding={onUpgradeBuilding}
            />
          )}
          {data.kind === 'resource' && <InspectorResourceView entity={e} />}
        </div>
      )}
    </div>
  );
};
