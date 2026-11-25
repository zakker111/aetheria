import React, { useState } from 'react';

interface DiplomacyTabProps {
  simulation: any;
  settlements: any[];
  treaties: any[];
  onImposeSanctions?: (fromId: number, targetId: number) => void;
  onIssueUltimatum?: (fromId: number, targetId: number, demand?: string) => void;
  onLaunchNuke?: (attackerId: number, targetId: number) => void;
  onPanTo?: (x: number, y: number) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export const DiplomacyTab: React.FC<DiplomacyTabProps> = ({
  simulation,
  settlements,
  treaties,
  onImposeSanctions,
  onIssueUltimatum,
  onLaunchNuke,
  onPanTo,
  onClose,
  onRefresh,
}) => {
  const [selectedSettlementId, setSelectedSettlementId] = useState<number | null>(null);

  const diplomaticHistory: any[] = Array.isArray(simulation.diplomacySystem?.diplomaticHistory)
    ? simulation.diplomacySystem.diplomaticHistory.slice(0, 24)
    : [];
  const activeSettlement = selectedSettlementId
    ? settlements.find((s) => s.id === selectedSettlementId)
    : settlements[0];
  const activeNukes = activeSettlement
    ? simulation.civilizationAgeSystem?.getNuclearProgram?.(activeSettlement.id)?.warheads || 0
    : 0;

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-y-auto lg:overflow-hidden">
      {/* Left Zone: Force-Directed Realm Graph Visualizer */}
      <div className="flex-1 p-4 md:p-6 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-950/80">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-50">
              Diplomatic Realpolitik Network &amp; Treaties
            </h2>
            <div className="text-xs text-slate-400">
              Cyan = Alliance · Crimson = War · Gold = Vassalage · Dashed Slate = Truce
            </div>
          </div>
        </div>

        {/* Realm Graph SVG */}
        <div className="flex-1 min-h-[300px] rounded-xl border border-white/8 bg-slate-900/60 flex items-center justify-center relative p-2">
          <svg width="680" height="440" viewBox="0 0 680 440" className="max-w-full h-auto">
            {settlements.map((s1, i) => {
              const angle1 = (i / settlements.length) * 2 * Math.PI - Math.PI / 2;
              const x1 = 340 + Math.cos(angle1) * 160;
              const y1 = 220 + Math.sin(angle1) * 140;

              return settlements.slice(i + 1).map((s2, j) => {
                const idx2 = i + 1 + j;
                const angle2 = (idx2 / settlements.length) * 2 * Math.PI - Math.PI / 2;
                const x2 = 340 + Math.cos(angle2) * 160;
                const y2 = 220 + Math.sin(angle2) * 140;

                const rel = simulation.diplomacySystem?.getRelation(s1.id, s2.id);
                if (!rel) return null;

                let stroke = '#334155';
                let strokeWidth = '1.5';
                let strokeDash = '4 4';

                if (rel.status === 'war') {
                  stroke = '#ef4444';
                  strokeWidth = '3';
                  strokeDash = 'none';
                } else if (rel.status === 'alliance') {
                  stroke = '#38bdf8';
                  strokeWidth = '2.5';
                  strokeDash = 'none';
                } else if (s1.overlordId === s2.id || s2.overlordId === s1.id) {
                  stroke = '#f59e0b';
                  strokeWidth = '2.5';
                  strokeDash = 'none';
                }

                return (
                  <line
                    key={`${s1.id}-${s2.id}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                  />
                );
              });
            })}

            {settlements.map((s, i) => {
              const angle = (i / settlements.length) * 2 * Math.PI - Math.PI / 2;
              const x = 340 + Math.cos(angle) * 160;
              const y = 220 + Math.sin(angle) * 140;
              const isSelected = selectedSettlementId === s.id;

              return (
                <g
                  key={s.id}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => setSelectedSettlementId(s.id)}
                  className="cursor-pointer"
                >
                  <circle
                    r={isSelected ? 32 : 26}
                    fill="#0f172a"
                    stroke={s.bannerColor || '#38bdf8'}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <text textAnchor="middle" y="6" fontSize="18">
                    {s.bannerSymbol || '🏰'}
                  </text>
                  <text
                    textAnchor="middle"
                    y="42"
                    fill="#f8fafc"
                    fontSize="12"
                    fontWeight="700"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {s.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Right Zone: Bilateral Controls, Treaties & Causal Diplomatic Feed */}
      <div className="w-full lg:w-[410px] shrink-0 p-4 md:p-5 lg:overflow-y-auto bg-slate-900/40 flex flex-col gap-4">
        {activeSettlement && settlements.length > 1 && (
          <div className="p-3 rounded-lg bg-slate-800/70 border border-sky-400/25">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-sky-400">
                Enact Policy as {activeSettlement.name}
              </span>
              {activeNukes > 0 && (
                <span className="text-[11px] text-lime-300 font-bold font-mono-tabular">
                  ☢️ {activeNukes} Warheads
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {settlements
                .filter((other) => other.id !== activeSettlement.id && !other.ruined)
                .map((other) => {
                  const rel = simulation.diplomacySystem?.getRelation(activeSettlement.id, other.id);
                  return (
                    <div
                      key={`pol_${other.id}`}
                      className="flex justify-between items-center gap-1.5 py-1.5 px-2 rounded-md bg-slate-900/55"
                    >
                      <div className="text-[11px] text-slate-200 font-mono-tabular">
                        <div>{other.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {rel?.status || 'peace'} · {Math.round(rel?.score ?? 50)}/100
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {onImposeSanctions && rel?.status !== 'war' && (
                          <button
                            onClick={() => {
                              onImposeSanctions(activeSettlement.id, other.id);
                              onRefresh();
                            }}
                            className="py-1 px-1.5 text-[10px] rounded border-0 bg-amber-900 text-amber-200 cursor-pointer whitespace-nowrap hover:bg-amber-800"
                          >
                            Sanction
                          </button>
                        )}
                        {onIssueUltimatum && rel?.status !== 'war' && (
                          <button
                            onClick={() => {
                              onIssueUltimatum(
                                activeSettlement.id,
                                other.id,
                                activeNukes > 0 ? 'nuclear_stand_down' : 'tribute'
                              );
                              onRefresh();
                            }}
                            className="py-1 px-1.5 text-[10px] rounded border-0 bg-slate-700 text-slate-50 cursor-pointer whitespace-nowrap hover:bg-slate-600"
                          >
                            Ultimatum
                          </button>
                        )}
                        {onLaunchNuke && activeNukes > 0 && (
                          <button
                            onClick={() => {
                              onLaunchNuke(activeSettlement.id, other.id);
                              onRefresh();
                            }}
                            className="py-1 px-1.5 text-[10px] rounded border border-lime-500 bg-lime-900 text-lime-100 cursor-pointer whitespace-nowrap hover:bg-lime-800"
                          >
                            ☢️ Nuke
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div>
          <h3 className="m-0 mb-2 text-sm font-bold text-slate-50">
            What Occurred &amp; Why ({diplomaticHistory.length})
          </h3>
          <div className="flex flex-col gap-2">
            {diplomaticHistory.length > 0 ? (
              diplomaticHistory.map((ev) => (
                <div
                  key={ev.id}
                  className={`py-2.5 px-3 rounded-lg border border-white/8 ${
                    ev.type === 'nuclear_strike' || ev.type === 'nuke' || ev.type === 'proliferation'
                      ? 'bg-lime-500/12'
                      : ev.type === 'war' || ev.type === 'betrayal'
                        ? 'bg-red-500/10'
                        : 'bg-slate-800/65'
                  }`}
                >
                  <div className="flex justify-between items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-50">{ev.title}</span>
                    <div className="flex gap-1.5 items-center shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono-tabular">
                        T{ev.tick}
                      </span>
                      {onPanTo && typeof ev.x === 'number' && typeof ev.y === 'number' && (
                        <button
                          onClick={() => {
                            onPanTo(ev.x, ev.y);
                            onClose();
                          }}
                          className="py-0.5 px-1.5 bg-sky-400/15 border-0 rounded text-sky-400 text-[10px] cursor-pointer hover:bg-sky-400/25"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-200 mt-1">{ev.what}</div>
                  <div className="text-[11px] text-amber-400 mt-1">Why: {ev.why}</div>
                  {Array.isArray(ev.drivers) && ev.drivers.length > 0 && (
                    <div className="text-[10px] text-slate-400 mt-1">{ev.drivers.join(' · ')}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs">No diplomatic crises recorded yet.</div>
            )}
          </div>
        </div>

        <h3 className="mt-1 mb-0 text-sm font-bold text-slate-50">
          Active Treaties &amp; Concordats ({treaties.length})
        </h3>

        <div className="flex flex-col gap-2">
          {treaties.length > 0 ? (
            treaties.map((t, idx) => {
              const s1 = settlements.find((s) => s.id === t.settlements?.[0]);
              const s2 = settlements.find((s) => s.id === t.settlements?.[1]);
              return (
                <div
                  key={t.id || idx}
                  className="py-2.5 px-3 rounded-lg bg-slate-800/60 border border-white/8"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sky-400 text-xs">
                      {t.type || 'Peace Treaty'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono-tabular">
                      {t.duration ? `${t.duration} ticks` : 'Permanent'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-50 mt-1">
                    {s1?.name || 'Realm'} &amp; {s2?.name || 'Realm'}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-slate-500 text-xs">No formal treaties currently active.</div>
          )}
        </div>
      </div>
    </div>
  );
};
