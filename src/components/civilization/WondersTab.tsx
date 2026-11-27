import React, { useState } from 'react';

interface WondersTabProps {
  simulation: any;
  settlements: any[];
  onAdvanceWonder?: (settlementId: number) => void;
  onCommissionWonder?: (settlementId: number, wonderKey: string) => void;
  onLaunchSpyOp?: (fromId: number, targetId: number, opType?: string) => void;
  onPanTo?: (x: number, y: number) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export const WondersTab: React.FC<WondersTabProps> = ({
  simulation,
  settlements: rawSettlements,
  onAdvanceWonder,
  onCommissionWonder,
  onLaunchSpyOp,
  onPanTo,
  onClose,
  onRefresh,
}) => {
  const settlements = Array.isArray(rawSettlements) ? rawSettlements : [];
  const [spyFromId, setSpyFromId] = useState<number | null>(null);
  const [spyTargetId, setSpyTargetId] = useState<number | null>(null);

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-y-auto lg:overflow-hidden">
      {/* Left: Multi-Stage Cultural Wonders & Civic Guilds */}
      <div className="flex-1 p-4 md:p-6 lg:overflow-y-auto flex flex-col gap-5">
        <div>
          <h2 className="m-0 text-base font-bold text-slate-50">
            Cultural Wonders &amp; Civic Guilds ({settlements.length} Realms)
          </h2>
          <div className="text-xs text-slate-400">
            Settlements raise three-stage monuments granting permanent economic, martial, and
            scientific mastery alongside Merchant, Masons, and Shadow guilds.
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {settlements.map((s) => {
            const ageSum = simulation.civilizationAgeSystem?.getSettlementAgeSummary?.(s.id);
            const wonder = ageSum?.wonder;
            const guilds = simulation.espionageSystem?.getSettlementGuilds?.(s.id);
            return (
              <div
                key={`wonder_${s.id}`}
                className="p-3.5 rounded-[10px] bg-slate-800/65 border border-white/8 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-50">
                    {s.tierIcon || '🏡'} {s.name}
                  </span>
                  <span
                    className="text-[11px] font-mono-tabular"
                    style={{ color: ageSum?.color || '#38bdf8' }}
                  >
                    {ageSum?.icon || ''} Era {ageSum?.id || 1}
                  </span>
                </div>

                {wonder ? (
                  <div className="text-xs text-slate-300 font-mono-tabular">
                    <div className="flex justify-between font-semibold text-emerald-300 gap-2">
                      <span>
                        {wonder.icon} {wonder.name}
                      </span>
                      <span>
                        {wonder.complete
                          ? 'Completed'
                          : `Stage ${wonder.stage}/${wonder.maxStage} · ${Math.round(wonder.progress || 0)}%`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Regional Buff: {wonder.buffLabel}
                    </div>
                    {!wonder.complete && (
                      <button
                        onClick={() => {
                          if (onAdvanceWonder) onAdvanceWonder(s.id);
                          else
                            simulation.civilizationAgeSystem?.advanceWonderProgress?.(
                              s.id,
                              50,
                              simulation.clock?.tick || 0
                            );
                          onRefresh();
                        }}
                        className="mt-1.5 py-1 px-2.5 bg-emerald-500/16 border border-emerald-500/40 rounded-md text-emerald-300 text-[11px] font-semibold cursor-pointer hover:bg-emerald-500/25"
                      >
                        Accelerate Construction
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    No Great Wonder commissioned yet.{' '}
                    <button
                      onClick={() => {
                        if (onCommissionWonder) onCommissionWonder(s.id, 'great_lighthouse');
                        else
                          simulation.civilizationAgeSystem?.commissionWonder?.(
                            s.id,
                            null,
                            simulation.clock?.tick || 0
                          );
                        onRefresh();
                      }}
                      className="py-1 px-2 bg-sky-400/14 border border-sky-400/35 rounded text-sky-400 text-[11px] font-semibold cursor-pointer hover:bg-sky-400/25"
                    >
                      Commission Wonder
                    </button>
                  </div>
                )}

                {guilds && (
                  <div className="text-[11px] text-slate-300 border-t border-white/6 pt-1.5 font-mono-tabular">
                    <div>
                      ⚖️ Merchant Guild:{' '}
                      {guilds.unlocked?.merchant ? 'Active (+25% Trade)' : 'Unformed'}
                    </div>
                    <div>
                      📐 Masons Guild:{' '}
                      {guilds.unlocked?.masons ? 'Active (+25% Wonders)' : 'Unformed'}
                    </div>
                    <div>
                      🗡️ Shadow Syndicate:{' '}
                      {guilds.unlocked?.shadows
                        ? `Active · ${guilds.opsSuccess || 0} Ops`
                        : 'Unformed'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Covert Espionage & Sabotage Command */}
      <div className="w-full lg:w-[430px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-900/45 p-4 md:p-5 lg:overflow-y-auto flex flex-col gap-3">
        <h3 className="m-0 text-[15px] font-bold text-slate-50">
          Espionage &amp; Sabotage Operations
        </h3>

        {settlements.length >= 2 &&
          (() => {
            const origin = settlements.find((s) => s.id === spyFromId) || settlements[0];
            const targets = settlements.filter((s) => s.id !== origin.id);
            const target = targets.find((s) => s.id === spyTargetId) || targets[0];
            const runOp = (opType: string) => {
              if (!origin || !target) return;
              if (onLaunchSpyOp)
                onLaunchSpyOp(
                  origin.id,
                  opType === 'counter_espionage' ? origin.id : target.id,
                  opType
                );
              else
                simulation.espionageSystem?.launchOperation?.(
                  origin.id,
                  opType === 'counter_espionage' ? origin.id : target.id,
                  opType,
                  simulation.clock?.tick || 0
                );
              onRefresh();
            };
            return (
              <div className="p-3 rounded-lg bg-slate-800/70 border border-white/8 flex flex-col gap-2">
                <div className="flex gap-2">
                  <label className="flex-1 text-[11px] text-slate-400">
                    Handler Realm
                    <select
                      value={origin.id}
                      onChange={(e) => setSpyFromId(Number(e.target.value))}
                      className="w-full mt-1 bg-slate-900 text-slate-50 border border-slate-700 rounded px-1.5 py-1 text-xs"
                    >
                      {settlements.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 text-[11px] text-slate-400">
                    Target Rival
                    <select
                      value={target?.id ?? ''}
                      onChange={(e) => setSpyTargetId(Number(e.target.value))}
                      className="w-full mt-1 bg-slate-900 text-slate-50 border border-slate-700 rounded px-1.5 py-1 text-xs"
                    >
                      {targets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => runOp('sabotage_granary')}
                    className="py-1.5 px-2 bg-orange-950 border-0 rounded text-orange-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-orange-900"
                  >
                    Burn Granary
                  </button>
                  <button
                    onClick={() => runOp('sabotage_bridge')}
                    className="py-1.5 px-2 bg-red-950 border-0 rounded text-red-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-red-900"
                  >
                    Blow Bridge
                  </button>
                  <button
                    onClick={() => runOp('sabotage_warhead')}
                    className="py-1.5 px-2 bg-lime-900 border-0 rounded text-lime-100 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-lime-800"
                  >
                    Disarm Warhead
                  </button>
                  <button
                    onClick={() => runOp('steal_blueprints')}
                    className="py-1.5 px-2 bg-blue-950 border-0 rounded text-blue-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-blue-900"
                  >
                    Steal Blueprints
                  </button>
                  <button
                    onClick={() => runOp('incite_revolt')}
                    className="py-1.5 px-2 bg-fuchsia-950 border-0 rounded text-fuchsia-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-fuchsia-900"
                  >
                    Incite Revolt
                  </button>
                  <button
                    onClick={() => runOp('counter_espionage')}
                    className="py-1.5 px-2 bg-teal-900 border-0 rounded text-teal-100 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-teal-800"
                  >
                    Counter-Intel Sweep
                  </button>
                </div>
              </div>
            );
          })()}

        <div className="flex flex-col gap-2">
          {(Array.isArray(simulation?.espionageSystem?.operationsLog) ? simulation.espionageSystem.operationsLog : [])
            .slice()
            .reverse()
            .slice(0, 18)
            .map((op: any) => (
              <div
                key={op.id}
                className={`p-2.5 rounded-lg border border-white/8 ${
                  op.success ? 'bg-slate-800/70' : 'bg-red-950/25'
                }`}
              >
                <div className="flex justify-between items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-50">{op.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono-tabular">T{op.tick}</span>
                    {onPanTo && typeof op.x === 'number' && typeof op.y === 'number' && (
                      <button
                        onClick={() => {
                          onPanTo(op.x, op.y);
                          onClose();
                        }}
                        className="bg-sky-400/15 border-0 text-sky-400 rounded text-[10px] py-0.5 px-1.5 cursor-pointer hover:bg-sky-400/25"
                      >
                        Locate
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">{op.what}</div>
                <div className="text-[10px] text-amber-400 mt-0.5">Why: {op.why}</div>
              </div>
            ))}
          {(!simulation.espionageSystem?.operationsLog ||
            simulation.espionageSystem.operationsLog.length === 0) && (
            <div className="text-slate-500 text-xs">No covert spy operations conducted yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};
