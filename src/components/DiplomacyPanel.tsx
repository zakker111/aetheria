import React, { useState } from 'react';
import { DiplomaticLogEntry, RelationSummary, TreatySummary, WarSummary } from '../types';

interface DiplomacyPanelProps {
  wars: WarSummary[];
  treaties: TreatySummary[];
  relations: RelationSummary[];
  diplomaticHistory?: DiplomaticLogEntry[];
  onSignPeace: (s1: number, s2: number) => void;
  onEnforceAllPeace: () => void;
  onProvokeWar: (s1: number, s2: number) => void;
  onFormAlliance: (s1: number, s2: number) => void;
  onImposeSanctions?: (fromId: number, targetId: number) => void;
  onIssueUltimatum?: (fromId: number, targetId: number, demand?: string) => void;
  onLaunchNuke?: (attackerId: number, targetId: number) => void;
  onLaunchSpyOp?: (fromId: number, targetId: number, opType?: string) => void;
  onPanTo?: (x: number, y: number) => void;
  onClose: () => void;
}

type DiploTab = 'wars' | 'why' | 'relations';

const DiplomacyPanelComponent: React.FC<DiplomacyPanelProps> = ({
  wars,
  treaties,
  relations,
  diplomaticHistory = [],
  onSignPeace,
  onEnforceAllPeace,
  onProvokeWar,
  onFormAlliance,
  onImposeSanctions,
  onIssueUltimatum,
  onLaunchNuke,
  onLaunchSpyOp,
  onPanTo,
  onClose,
}) => {
  const [tab, setTab] = useState<DiploTab>('wars');

  const tabClass = (t: DiploTab): string =>
    `flex-1 py-1 px-1.5 rounded border-0 text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
      tab === t ? 'bg-sky-400 text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/12 rounded-xl px-3.5 py-3 pointer-events-auto shadow-lg text-xs max-h-[340px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between font-semibold text-sky-400 mb-1.5 border-b border-white/8 pb-1 text-[13px]">
        <span>⚔️ Diplomacy &amp; Geopolitics</span>
        <button
          onClick={onClose}
          aria-label="Close diplomacy panel"
          className="bg-transparent border-0 text-slate-500 hover:text-slate-300 cursor-pointer text-sm leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-1 bg-slate-800/70 p-0.5 rounded-md mb-2 shrink-0">
        <button className={tabClass('wars')} onClick={() => setTab('wars')}>
          Wars ({wars.length})
        </button>
        <button className={tabClass('why')} onClick={() => setTab('why')}>
          Events &amp; Why ({diplomaticHistory.length})
        </button>
        <button className={tabClass('relations')} onClick={() => setTab('relations')}>
          Realms ({relations.length})
        </button>
      </div>

      <div className="overflow-y-auto flex-1 pr-1">
        {tab === 'wars' && (
          <>
            <div className="text-[11px] font-bold text-red-500 mb-1.5 flex justify-between items-center">
              <span>⚔️ ACTIVE CONFLICTS ({wars.length})</span>
              {wars.length > 0 && (
                <button
                  onClick={onEnforceAllPeace}
                  className="bg-slate-800 border border-slate-600 text-slate-50 rounded text-[9px] py-0.5 px-1.5 cursor-pointer whitespace-nowrap hover:bg-slate-700"
                >
                  Enforce Peace
                </button>
              )}
            </div>

            {wars.length === 0 ? (
              <div className="mb-2.5">
                <div className="text-slate-400 text-[11px] mb-1.5 italic">
                  🕊️ No active wars right now.
                </div>
                {relations.length > 0 && (
                  <button
                    onClick={() => onProvokeWar(relations[0].s1Id, relations[0].s2Id)}
                    className="bg-red-900 border border-red-500 text-red-200 rounded text-[10px] py-1 px-2 cursor-pointer font-semibold hover:bg-red-800"
                  >
                    ⚔️ Provoke War ({relations[0].s1Name} vs {relations[0].s2Name})
                  </button>
                )}
              </div>
            ) : (
              wars.map((w, idx) => {
                const casualtiesA = w.casualties[w.attackerId] || 0;
                const casualtiesD = w.casualties[w.defenderId] || 0;
                return (
                  <div
                    key={idx}
                    className="bg-red-500/12 border border-red-500/35 rounded-lg p-2 mb-2"
                  >
                    <div className="flex justify-between font-semibold text-[11px] text-red-300 font-mono-tabular gap-1">
                      <span>
                        {w.totalWar ? '🔥 ' : '⚔️ '}
                        {w.attackerName} vs {w.defenderName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {w.totalWar && (
                          <span className="text-[9px] text-red-200 bg-red-700/65 px-1 py-0.5 rounded font-bold">
                            TOTAL WAR
                          </span>
                        )}
                        {w.warScore != null && (
                          <span className="text-[10px] text-amber-200">
                            Score {w.warScore > 0 ? `+${w.warScore}` : w.warScore}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">{w.casusBelli}</div>
                    {w.whySummary && (
                      <div className="text-[10px] text-slate-400 mt-0.5">Why: {w.whySummary}</div>
                    )}
                    <div className="text-[10px] text-red-400 mt-1 font-mono-tabular">
                      Fallen: {w.attackerName} {casualtiesA} · {w.defenderName} {casualtiesD}
                    </div>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        onClick={() => onSignPeace(w.attackerId, w.defenderId)}
                        className="bg-slate-900 border border-slate-500 text-slate-300 rounded text-[10px] py-0.5 px-2 cursor-pointer hover:bg-slate-800"
                      >
                        🕊️ Sign Peace
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            <div className="text-[11px] font-bold text-green-500 mt-2 mb-1">
              🤝 ALLIANCES ({treaties.length})
            </div>
            {treaties.length === 0 ? (
              <div className="text-slate-400 text-[11px]">No active defensive pacts.</div>
            ) : (
              treaties.map((t, idx) => (
                <div
                  key={idx}
                  className="bg-green-500/10 border border-green-500/25 rounded-md py-1 px-2 mb-1 text-[11px] text-green-300"
                >
                  🤝 {t.title}
                </div>
              ))
            )}
          </>
        )}

        {tab === 'why' && (
          <div className="flex flex-col gap-1.5">
            {diplomaticHistory.length === 0 ? (
              <div className="text-slate-400 text-[11px]">
                No diplomatic crises, ultimatums, or strikes logged yet.
              </div>
            ) : (
              diplomaticHistory.map((ev) => (
                <div
                  key={ev.id}
                  className={`border border-white/8 rounded-md p-2 ${
                    ev.type === 'nuclear_strike' || ev.type === 'nuke' || ev.type === 'proliferation'
                      ? 'bg-lime-500/12'
                      : ev.type === 'war' || ev.type === 'betrayal'
                        ? 'bg-red-500/10'
                        : 'bg-slate-800/65'
                  }`}
                >
                  <div className="flex justify-between items-center gap-1.5">
                    <span className="font-bold text-[11px] text-slate-50">{ev.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-slate-400 font-mono-tabular">
                        T{ev.tick}
                      </span>
                      {onPanTo && typeof ev.x === 'number' && typeof ev.y === 'number' && (
                        <button
                          onClick={() => onPanTo(ev.x as number, ev.y as number)}
                          className="bg-sky-400/15 border-0 text-sky-400 rounded text-[9px] py-0.5 px-1.5 cursor-pointer hover:bg-sky-400/25"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-200 mt-0.5">{ev.what}</div>
                  <div className="text-[10px] text-amber-400 mt-0.5">Why: {ev.why}</div>
                  {ev.drivers && ev.drivers.length > 0 && (
                    <div className="text-[9px] text-slate-400 mt-0.5">{ev.drivers.join(' · ')}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'relations' && (
          <>
            {relations.length === 0 ? (
              <div className="text-slate-400 text-[11px]">
                At least 2 settlements needed for diplomacy.
              </div>
            ) : (
              relations.map((rel, idx) => {
                let statusLabel = <span className="text-green-500 font-semibold">Alliance 🤝</span>;
                if (rel.status === 'war')
                  statusLabel = <span className="text-red-500 font-semibold">At War ⚔️</span>;
                else if (rel.status === 'tension')
                  statusLabel = <span className="text-amber-500 font-semibold">Tension ⚠️</span>;
                else if (rel.status === 'peace')
                  statusLabel = <span className="text-slate-400">Peace 🕊️</span>;

                return (
                  <div
                    key={idx}
                    className="bg-slate-800/65 border border-white/6 rounded-md p-2 mb-1.5 text-[11px]"
                  >
                    <div className="flex justify-between gap-1">
                      <span>
                        {rel.s1Name} ↔ {rel.s2Name}
                      </span>
                      <span>{statusLabel}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono-tabular">
                      Affinity: {Math.round(rel.score)}/100
                      {rel.sanctioned ? ' · 🚫 Embargoed' : ''}
                      {((rel.s1Warheads || 0) > 0 || (rel.s2Warheads || 0) > 0) &&
                        ` · ☢️ ${rel.s1Warheads || 0}:${rel.s2Warheads || 0}`}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rel.status !== 'war' && (
                        <>
                          <button
                            onClick={() => onProvokeWar(rel.s1Id, rel.s2Id)}
                            className="bg-red-900 border-0 text-red-200 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-red-800"
                          >
                            Provoke War
                          </button>
                          {onImposeSanctions && !rel.sanctioned && (
                            <button
                              onClick={() => onImposeSanctions(rel.s1Id, rel.s2Id)}
                              className="bg-amber-900 border-0 text-amber-200 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-amber-800"
                            >
                              Sanction
                            </button>
                          )}
                          {onIssueUltimatum && (
                            <button
                              onClick={() => onIssueUltimatum(rel.s1Id, rel.s2Id, 'tribute')}
                              className="bg-slate-700 border-0 text-slate-200 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-slate-600"
                            >
                              Ultimatum
                            </button>
                          )}
                        </>
                      )}
                      {rel.status !== 'alliance' && rel.status !== 'war' && (
                        <button
                          onClick={() => onFormAlliance(rel.s1Id, rel.s2Id)}
                          className="bg-green-900 border-0 text-green-200 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-green-800"
                        >
                          Ally
                        </button>
                      )}
                      {onLaunchSpyOp && (
                        <button
                          onClick={() => onLaunchSpyOp(rel.s1Id, rel.s2Id, 'sabotage_granary')}
                          className="bg-indigo-950 border border-indigo-300/35 text-indigo-100 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-indigo-900"
                        >
                          Spy Sabotage
                        </button>
                      )}
                      {onLaunchNuke && (rel.s1Warheads || 0) > 0 && (
                        <button
                          onClick={() => onLaunchNuke(rel.s1Id, rel.s2Id)}
                          className="bg-lime-900 border border-lime-500 text-lime-100 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-lime-800"
                        >
                          ☢️ Strike {rel.s2Name}
                        </button>
                      )}
                      {onLaunchNuke && (rel.s2Warheads || 0) > 0 && (
                        <button
                          onClick={() => onLaunchNuke(rel.s2Id, rel.s1Id)}
                          className="bg-lime-900 border border-lime-500 text-lime-100 text-[9px] py-0.5 px-1.5 rounded cursor-pointer hover:bg-lime-800"
                        >
                          ☢️ Strike {rel.s1Name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const DiplomacyPanel = React.memo(DiplomacyPanelComponent);
