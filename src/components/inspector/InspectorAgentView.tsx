import React, { useState } from 'react';
import { AgentDossier } from '../../types';
import {
  ACTION_DESCRIPTIONS,
  BUILDING_META_MAP,
  NeedBar,
  RelChipList,
} from './InspectorShared';

type AgentTab = 'overview' | 'history' | 'combat' | 'bonds';

interface InspectorAgentViewProps {
  entity: any;
  dossier: AgentDossier | null;
  isAlive: boolean;
  onSelectAgent?: (agentId: number) => void;
  onSelectBuilding?: (buildingId: number) => void;
  onPanTo?: (x: number, y: number) => void;
}

export const InspectorAgentView: React.FC<InspectorAgentViewProps> = ({
  entity: e,
  dossier,
  isAlive,
  onSelectAgent,
  onSelectBuilding,
  onPanTo,
}) => {
  const [agentTab, setAgentTab] = useState<AgentTab>('overview');

  const tabBtnClass = (tab: AgentTab) =>
    `flex-1 py-1 px-1.5 rounded border-0 text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
      agentTab === tab
        ? 'bg-sky-400 text-slate-900'
        : 'bg-transparent text-slate-400 hover:text-slate-200'
    }`;

  const traitsObj = dossier?.traits || e.personality || {};
  const traitEntries = Object.entries(traitsObj)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4);

  const skillsObj = dossier?.skills || e.skills || {};
  const skillEntries = Object.entries(skillsObj)
    .filter(([, v]) => typeof v === 'number' && Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

  const lifeEvents = (dossier?.lifeHistory || e.lifeHistory || []).slice().reverse();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex gap-1 bg-slate-800/70 p-0.5 rounded-lg mb-2 shrink-0">
        <button type="button" className={tabBtnClass('overview')} onClick={() => setAgentTab('overview')}>
          Overview
        </button>
        <button type="button" className={tabBtnClass('history')} onClick={() => setAgentTab('history')}>
          History ({lifeEvents.length})
        </button>
        <button type="button" className={tabBtnClass('combat')} onClick={() => setAgentTab('combat')}>
          Combat
        </button>
        <button type="button" className={tabBtnClass('bonds')} onClick={() => setAgentTab('bonds')}>
          Bonds
        </button>
      </div>

      <div className="overflow-y-auto flex-1 pr-1">
        {!isAlive && (
          <div className="bg-red-900/30 border border-red-400/35 rounded-lg p-2 mb-2">
            <div className="text-[11px] font-bold text-red-200">
              🕯️ Fallen Memorial
            </div>
            <div className="text-[11px] text-slate-200 mt-0.5 font-mono-tabular">
              Age {Math.floor(dossier?.age ?? e.age ?? 0)} · Cause: {dossier?.deathCause || e.deathCause || 'Natural'}
              {dossier?.deathTick != null ? ` · Tick ${dossier.deathTick}` : ''}
            </div>
            <div className="text-[10px] text-red-300 mt-0.5 font-mono-tabular">
              Legacy: {dossier?.kills ?? e.kills ?? 0} Kills · {dossier?.battlesFought ?? e.battlesFought ?? 0} Battles · {dossier?.buildingsBuilt ?? e.buildingsBuilt ?? 0} Built · {dossier?.settlementName || 'Wilds'}
            </div>
            {dossier?.biography && (
              <div className="text-[10px] text-slate-100 mt-1 italic leading-snug border-t border-red-400/20 pt-1">
                “{dossier.biography}”
              </div>
            )}
          </div>
        )}

        {agentTab === 'overview' && (
          <>
            <div className="flex justify-between items-center mb-1.5 font-mono-tabular">
              <span className={`text-[11px] font-bold ${isAlive ? 'text-emerald-300' : 'text-red-300'}`}>
                {isAlive ? `${e.lifeStage || 'adult'} · Age ${Math.floor(e.age || 0)}` : 'Deceased'}
                {dossier?.settlementName ? ` · ${dossier.settlementName}` : ''}
              </span>
              <span className="text-amber-400 font-semibold text-[11px]">
                {dossier?.jobTitle || e.job || 'Civilian'}
              </span>
            </div>

            {isAlive && dossier?.biography && (
              <div className="text-[10px] text-slate-300 bg-slate-800/50 border-l-2 border-sky-400/50 px-2 py-1 rounded-r mb-2 leading-snug">
                {dossier.biography}
              </div>
            )}

            {isAlive && e.needs && (
              <>
                <NeedBar label="Food" value={e.needs.food} />
                <NeedBar label="Water" value={e.needs.water} />
                <NeedBar label="Rest" value={e.needs.rest} />
                <NeedBar label="Social" value={e.needs.social} />
              </>
            )}

            {traitEntries.length > 0 && (
              <div className="mt-2 text-[11px] text-slate-300">
                <span className="text-slate-400 font-semibold">Traits: </span>
                <span className="font-mono-tabular">
                  {traitEntries.map(([k, v]) => `${k} ${Math.round(Number(v) * 100)}%`).join(' · ')}
                </span>
              </div>
            )}

            {skillEntries.length > 0 && (
              <div className="mt-1 text-[11px] text-slate-300">
                <span className="text-slate-400 font-semibold">Skills: </span>
                <span className="font-mono-tabular">
                  {skillEntries.map(([k, v]) => `${k} ${Math.round(Number(v))}`).join(' · ')}
                </span>
              </div>
            )}

            <div className="mt-2 text-[11px] text-slate-300 border-t border-white/8 pt-1.5 font-mono-tabular">
              {typeof e.x === 'number' && typeof e.y === 'number' && (
                <div>
                  📍 Position: ({e.x.toFixed(1)}, {e.y.toFixed(1)}) · Gen {dossier?.generation ?? e.generation ?? 1}
                </div>
              )}
              <div>
                👶 Children: {dossier?.children?.length ?? e.children ?? 0}
                {(dossier?.buildingsBuilt ?? e.buildingsBuilt ?? 0) > 0
                  ? ` · 🔨 Built: ${dossier?.buildingsBuilt ?? e.buildingsBuilt}`
                  : ''}
                {dossier?.faith ? ` · 🙏 Faith ${dossier.faith}%${dossier.beliefId ? ` (${dossier.beliefId})` : ''}` : ''}
              </div>
              {(dossier?.heirloom || e.heirloom) && (() => {
                const hl = dossier?.heirloom || e.heirloom;
                return (
                  <div className="mt-1">
                    <div className="text-amber-400 font-semibold">
                      💍 Heirloom: {hl.name}
                      {hl.inheritedFrom ? ` · From ${hl.inheritedFrom}` : ''}
                    </div>
                    {(hl.originName || hl.originYear || (hl.generationsHeld && hl.generationsHeld > 1)) && (
                      <div className="text-[10px] text-slate-400">
                        {hl.originName ? `Forged by ${hl.originName}` : 'Ancestral Relic'}
                        {hl.originYear ? ` (Year ${hl.originYear})` : ''}
                        {hl.generationsHeld ? ` · Held ${hl.generationsHeld} gen` : ''}
                      </div>
                    )}
                  </div>
                );
              })()}
              {Array.isArray(dossier?.builtStructures) && dossier.builtStructures.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-white/8">
                  <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    Architectural Works ({dossier.builtStructures.length})
                  </div>
                  <div className="flex flex-col gap-1">
                    {dossier.builtStructures.slice(0, 6).map((b) => {
                      const bMeta = BUILDING_META_MAP[b.buildingType];
                      return (
                        <div
                          key={`built_${b.id}`}
                          className="flex justify-between items-center gap-1.5 px-1.5 py-1 rounded bg-slate-800/55 border border-white/6"
                        >
                          <div className="min-w-0 truncate text-[10px]">
                            <span className="text-slate-100 font-semibold">
                              {bMeta?.icon || '🏛️'} {b.name}
                            </span>
                            <span className="text-slate-400">
                              {' '}· Lv {b.level}/{b.maxLevel}
                              {b.builtYear ? ` · Y${b.builtYear}` : ''}
                              {b.isRuined ? ' · Ruined' : ''}
                            </span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {onSelectBuilding && (
                              <button
                                type="button"
                                onClick={() => onSelectBuilding(b.id)}
                                className="bg-sky-400/15 border border-sky-400/35 hover:bg-sky-400/25 rounded text-sky-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap"
                              >
                                Inspect
                              </button>
                            )}
                            {!onSelectBuilding && onPanTo && (
                              <button
                                type="button"
                                onClick={() => onPanTo(b.x, b.y)}
                                className="bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 rounded text-amber-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap"
                              >
                                Locate
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {isAlive && e.inventory && (
                <div className="mt-1">
                  🎒 Stock: 🌲 {e.inventory?.wood_log || 0} · ⛏️ {e.inventory?.ore_iron || 0} · 🌾 {e.inventory?.wheat || 0} · 🥩 {e.inventory?.meat || 0}
                </div>
              )}
              {isAlive && (
                <div className="mt-1 font-semibold text-sky-400">
                  🧠{' '}
                  {ACTION_DESCRIPTIONS[e.currentAction?.type] ||
                    (e.currentAction?.type
                      ? String(e.currentAction.type).replace(/_/g, ' ')
                      : 'Observing community')}
                </div>
              )}
            </div>
          </>
        )}

        {agentTab === 'history' && (
          <div className="flex flex-col gap-1.5">
            {lifeEvents.length === 0 ? (
              <div className="text-slate-400 text-[11px]">No recorded life milestones yet.</div>
            ) : (
              lifeEvents.map((ev: any, idx: number) => (
                <div
                  key={`${ev.tick}_${ev.kind}_${idx}`}
                  className={`px-2 py-1.5 rounded-md border ${
                    ev.milestone
                      ? 'bg-sky-400/8 border-sky-400/25'
                      : 'bg-slate-800/55 border-white/6'
                  }`}
                >
                  <div className="flex justify-between items-center gap-1.5 text-[10px] text-slate-400 font-mono-tabular">
                    <span>{ev.icon || '📜'} {ev.kind}</span>
                    <span className="flex items-center gap-1.5">
                      {ev.eraName && (
                        <span className="px-1 py-0.5 rounded bg-slate-400/15 text-slate-300 text-[9px]">
                          {ev.eraIcon ? `${ev.eraIcon} ` : ''}{ev.eraName}
                        </span>
                      )}
                      <span>Year {ev.year} · T{ev.tick}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-100 mt-0.5">{ev.text}</div>
                </div>
              ))
            )}
          </div>
        )}

        {agentTab === 'combat' && (
          <div className="flex flex-col gap-2 font-mono-tabular">
            <div className="grid grid-cols-2 gap-1.5">
              <div className="p-2 rounded-md bg-slate-800/60">
                <div className="text-[10px] text-slate-400">KILLS</div>
                <div className="text-sm font-bold text-red-400">{dossier?.kills ?? e.kills ?? 0}</div>
              </div>
              <div className="p-2 rounded-md bg-slate-800/60">
                <div className="text-[10px] text-slate-400">BATTLES FOUGHT</div>
                <div className="text-sm font-bold text-amber-400">{dossier?.battlesFought ?? e.battlesFought ?? 0}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-300 leading-relaxed">
              {(() => {
                const rawRole = dossier?.combatRole || e.combatRole || 'Militia';
                const roleMap: Record<string, string> = {
                  tank: 'Battle Tank',
                  plane: 'Strike Aircraft',
                  artillery: 'Rocket Artillery',
                  rifle: 'Rifleman',
                  musket: 'Musketeer',
                  halberdier: 'Halberdier',
                  crossbow: 'Crossbowman',
                  knight: 'Heavy Knight',
                  catapult: 'Siege Catapult',
                  cavalry: 'Cavalry',
                  archer: 'Archer',
                  vanguard: 'Vanguard',
                };
                const roleLabel = roleMap[String(rawRole)] || String(rawRole);
                return (
                  <div>
                    🎖️ Campaigns: {dossier?.veteranCampaigns ?? e.veteranCampaigns ?? 0} · Role: <b>{roleLabel}</b>
                  </div>
                );
              })()}
              {e.combat && isAlive && (
                <div>
                  ⚔️ Stats: DMG {Math.round(e.combat.damage || 10)} · Range {Number(e.combat.range || e.combat.attackRange || 1.5).toFixed(1)} · Speed {Number(e.combat.speedMultiplier || e.combat.speedMult || 1).toFixed(2)}x
                  {e.combat.isFlying ? ' · ✈️ Air Overflight' : e.combat.weaponType === 'tank' ? ' · 🛡️ Heavy Armor' : ''}
                </div>
              )}
              <div>⭐ Reputation: {dossier?.reputation ?? Math.round(e.reputation || 0)}</div>
              {(dossier?.legendaryWeapon || e.legendaryWeapon) && (
                <div className="text-amber-400 font-semibold">
                  🗡️ Relic Blade: {dossier?.legendaryWeapon || e.legendaryWeapon}
                </div>
              )}
              {(dossier?.isMonarch || e.isMonarch) && <div className="text-amber-400">👑 Reigning Monarch</div>}
              {(dossier?.isRebel || e.isRebel) && <div className="text-red-400">🔥 Rebel Insurgent</div>}
              {(dossier?.captive || e.captive) && <div className="text-red-300">⛓️ Prisoner of War</div>}
              {e.wounded && <div className="text-red-400">🩸 Wounded in Combat</div>}
            </div>
          </div>
        )}

        {agentTab === 'bonds' && (
          <div>
            {(dossier?.surname || e.surname) && (
              <div className="mb-2 px-2 py-1 rounded-md bg-slate-800/70 border border-sky-400/22 text-[11px] text-sky-200 font-semibold flex justify-between">
                <span>🛡️ House {dossier?.surname || e.surname}</span>
                <span className="text-slate-400 font-mono-tabular">
                  Generation {dossier?.generation ?? e.generation ?? 1}
                </span>
              </div>
            )}
            {dossier?.spouse && <RelChipList title="Spouse" items={[dossier.spouse]} onSelectAgent={onSelectAgent} />}
            {dossier?.parents && <RelChipList title="Parents" items={dossier.parents} onSelectAgent={onSelectAgent} />}
            {dossier?.children && <RelChipList title="Children" items={dossier.children} onSelectAgent={onSelectAgent} />}
            {dossier?.siblings && <RelChipList title="Siblings" items={dossier.siblings} onSelectAgent={onSelectAgent} />}
            {dossier?.friends && <RelChipList title="Friends & Allies" items={dossier.friends} onSelectAgent={onSelectAgent} />}
            {dossier?.rivals && <RelChipList title="Rivals" items={dossier.rivals} onSelectAgent={onSelectAgent} />}
            {!dossier?.spouse &&
              !dossier?.parents?.length &&
              !dossier?.children?.length &&
              !dossier?.siblings?.length &&
              !dossier?.friends?.length &&
              !dossier?.rivals?.length && (
                <div className="text-slate-400 text-[11px]">No close blood ties or rivalries recorded yet.</div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
