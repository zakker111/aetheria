import React from 'react';

interface WarRoomTabProps {
  simulation: any;
  settlements: any[];
  wars: any[];
  warHistory: any[];
  activeCivilWars: any[];
  onPanTo?: (x: number, y: number) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export const WarRoomTab: React.FC<WarRoomTabProps> = ({
  simulation,
  settlements,
  wars,
  warHistory,
  activeCivilWars,
  onPanTo,
  onClose,
  onRefresh,
}) => {
  const handleResolveCivilWar = (dyn: any, outcome: 'loyalist_victory' | 'usurpation') => {
    if (!simulation.dynastySystem?.resolveCivilWar) return;
    simulation.dynastySystem.resolveCivilWar(dyn, outcome);
    onRefresh();
  };

  const handleConveneConference = (s1Id: number, s2Id: number) => {
    if (!simulation.diplomacySystem) return;
    simulation.diplomacySystem.convenePeaceConference(s1Id, s2Id, null, 'Diplomatic Mediation');
    onRefresh();
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-y-auto lg:overflow-hidden">
      {/* Active Campaigns Column */}
      <div className="flex-1 p-4 md:p-6 lg:overflow-y-auto flex flex-col gap-4">
        <div>
          <h2 className="m-0 text-base font-bold text-slate-50">
            War Room &amp; Live Campaigns ({wars.length + activeCivilWars.length})
          </h2>
          <div className="text-xs text-slate-400">
            Monitor ongoing frontlines, dynastic civil wars, town sieges, and dynamic War Scores.
          </div>
        </div>

        {activeCivilWars.map((dyn) => {
          const sHome = settlements.find((s) => s.id === dyn.settlementId);
          return (
            <div
              key={`cw_${dyn.id}`}
              className="p-4 rounded-xl bg-red-950/35 border border-amber-500/45 flex flex-col gap-2.5"
            >
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="font-bold text-[15px] text-amber-100">
                  Dynastic Civil War — {dyn.settlementName} ({dyn.name})
                </div>
                {sHome && onPanTo && (
                  <button
                    onClick={() => {
                      onPanTo(sHome.center.x, sHome.center.y);
                      onClose();
                    }}
                    className="py-1 px-2.5 bg-amber-500/15 border border-amber-500/40 rounded-md text-amber-400 text-[11px] font-semibold cursor-pointer hover:bg-amber-500/25 whitespace-nowrap"
                  >
                    Pan to Capital
                  </button>
                )}
              </div>
              <div className="text-xs text-slate-200 font-mono-tabular">
                Crown: {dyn.civilWar.loyalistMonarchName} vs Claimant: {dyn.civilWar.claimantName}{' '}
                · Cause: {dyn.civilWar.reason}
              </div>
              <div className="text-xs text-slate-300 font-mono-tabular">
                Casualties: Crown {dyn.civilWar.loyalistCasualties || 0} · Rebels{' '}
                {dyn.civilWar.rebelCasualties || 0}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleResolveCivilWar(dyn, 'loyalist_victory')}
                  className="py-1.5 px-3 bg-slate-800 border border-sky-400/45 rounded-md text-sky-400 text-xs font-semibold cursor-pointer hover:bg-slate-700"
                >
                  Back Loyalists
                </button>
                <button
                  onClick={() => handleResolveCivilWar(dyn, 'usurpation')}
                  className="py-1.5 px-3 bg-amber-600 border-0 rounded-md text-white text-xs font-semibold cursor-pointer hover:bg-amber-500"
                >
                  Crown Claimant
                </button>
              </div>
            </div>
          );
        })}

        {wars.length > 0 ? (
          wars.map((w, idx) => {
            const sAttacker = settlements.find((s) => s.id === w.attackerId);
            const sDefender = settlements.find((s) => s.id === w.defenderId);
            const score = simulation.diplomacySystem
              ? simulation.diplomacySystem.calculateWarScore(w)
              : 0;
            const attCas = w.casualties?.[w.attackerId] || 0;
            const defCas = w.casualties?.[w.defenderId] || 0;

            const warbands: any[] = simulation.warfareSystem
              ? Array.from(simulation.warfareSystem.warbands.values()).filter(
                  (wb: any) =>
                    (wb.settlementId === w.attackerId && wb.targetSettlementId === w.defenderId) ||
                    (wb.settlementId === w.defenderId && wb.targetSettlementId === w.attackerId)
                )
              : [];

            return (
              <div
                key={w.id || idx}
                className="p-4 rounded-xl bg-slate-800/70 border border-red-500/30 flex flex-col gap-3.5"
              >
                {/* Attacker vs Defender Header */}
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{sAttacker?.bannerSymbol || '⚔️'}</span>
                    <div>
                      <span className="font-bold text-[15px] text-slate-50">{w.attackerName}</span>
                      <span className="text-xs text-slate-400 ml-1.5">(Aggressor)</span>
                    </div>
                  </div>

                  <span
                    className={`font-extrabold text-sm ${
                      w.totalWar ? 'text-orange-500' : 'text-red-500'
                    }`}
                  >
                    {w.totalWar ? '🔥 TOTAL WAR' : 'VS'}
                  </span>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <span className="font-bold text-[15px] text-slate-50">{w.defenderName}</span>
                      <span className="text-xs text-slate-400 ml-1.5">(Defender)</span>
                    </div>
                    <span className="text-xl">{sDefender?.bannerSymbol || '🛡️'}</span>
                  </div>
                </div>

                {/* Casus Belli & Causal Drivers */}
                <div className="text-xs text-slate-300 bg-slate-900/50 py-2 px-2.5 rounded-md">
                  <div>
                    <span className="text-slate-400">Casus Belli: </span>
                    <span className="font-semibold">{w.casusBelli}</span>
                  </div>
                  {w.whySummary && (
                    <div className="text-[11px] text-amber-400 mt-1">Why: {w.whySummary}</div>
                  )}
                  <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
                    War Weariness: {w.attackerName} {Math.round(w.weariness?.[w.attackerId] || 0)}% ·{' '}
                    {w.defenderName} {Math.round(w.weariness?.[w.defenderId] || 0)}%
                    {((simulation.civilizationAgeSystem?.getNuclearProgram?.(w.attackerId)
                      ?.warheads || 0) > 0 ||
                      (simulation.civilizationAgeSystem?.getNuclearProgram?.(w.defenderId)
                        ?.warheads || 0) > 0) &&
                      ` · ☢️ Warheads: ${simulation.civilizationAgeSystem?.getNuclearProgram?.(w.attackerId)?.warheads || 0} vs ${simulation.civilizationAgeSystem?.getNuclearProgram?.(w.defenderId)?.warheads || 0}`}
                  </div>
                </div>

                {/* Dynamic War Score Bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Attacker Favor</span>
                    <span
                      className={`font-bold font-mono-tabular ${
                        score > 0 ? 'text-sky-400' : score < 0 ? 'text-red-500' : 'text-slate-50'
                      }`}
                    >
                      War Score: {score > 0 ? `+${score}` : score}
                    </span>
                    <span>Defender Favor</span>
                  </div>
                  <div className="h-2 w-full bg-slate-900 rounded overflow-hidden relative">
                    <div className="absolute left-1/2 inset-y-0 w-0.5 bg-slate-500" />
                    <div
                      className={`h-full absolute ${score > 0 ? 'bg-sky-400' : 'bg-red-500'}`}
                      style={{
                        left: score < 0 ? `${50 + score / 2}%` : '50%',
                        width: `${Math.abs(score) / 2}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Casualties & Plunder Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-900/50 rounded-md">
                    <div className="text-slate-400 text-[10px]">CASUALTIES INFLICTED</div>
                    <div className="font-semibold text-slate-50 font-mono-tabular">
                      {w.attackerName}: {attCas} fallen · {w.defenderName}: {defCas} fallen
                    </div>
                  </div>

                  <div className="p-2 bg-slate-900/50 rounded-md">
                    <div className="text-slate-400 text-[10px]">PLUNDERED SPOILS</div>
                    <div className="font-semibold text-amber-400 font-mono-tabular">
                      {w.plundered
                        ? `${w.plundered.food || 0} food · ${w.plundered.wood || 0} wood · ${w.plundered.ore || 0} ore`
                        : 'None'}
                    </div>
                  </div>
                </div>

                {/* Active Amphibious Expeditions */}
                {warbands.filter((wb) => wb.isAmphibious || wb.embarked).length > 0 && (
                  <div className="border-t border-white/8 pt-2.5 flex flex-col gap-1.5">
                    <div className="text-[11px] text-sky-400 font-bold">
                      ⛵ AMPHIBIOUS EXPEDITIONS
                    </div>
                    {warbands
                      .filter((wb) => wb.isAmphibious || wb.embarked)
                      .map((wb) => (
                        <div
                          key={`amph_${wb.id}`}
                          className="py-2 px-2.5 bg-cyan-900/20 border border-sky-400/35 rounded-md text-xs flex justify-between items-center gap-2"
                        >
                          <span className="font-semibold text-sky-100">
                            {wb.settlementName} Longboat Fleet ({wb.soldiers?.length || 0} raiders)
                          </span>
                          <span className="text-[11px] text-sky-400 font-semibold">
                            {wb.embarked ? 'At Sea / River Crossing' : 'Landed Ashore'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Active Sieges Section */}
                {warbands.filter((wb) => wb.state === 'sieging').length > 0 && (
                  <div className="border-t border-white/8 pt-2.5 flex flex-col gap-1.5">
                    <div className="text-[11px] text-amber-400 font-bold">
                      🏰 ACTIVE SIEGES &amp; FORTRESS BREACHES
                    </div>
                    {warbands
                      .filter((wb) => wb.state === 'sieging')
                      .map((wb) => (
                        <div
                          key={wb.id}
                          className="py-2 px-2.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs flex justify-between items-center gap-2"
                        >
                          <div>
                            <span className="font-semibold">{wb.settlementName} Warband</span>
                            <span className="text-slate-400 ml-1.5">
                              (
                              {wb.siegeStage === 'breach'
                                ? 'Stage 2: Battering Ram Breach'
                                : wb.siegeStage === 'assault'
                                  ? 'Stage 3: Town Hall Storming'
                                  : 'Stage 1: Encirclement & Starvation'}
                              )
                            </span>
                          </div>
                          <span className="text-[11px] text-amber-400 font-semibold font-mono-tabular">
                            {wb.siegeTicks || 0} Siege Ticks
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Peace Action */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleConveneConference(w.attackerId, w.defenderId)}
                    className="py-2 px-4 bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 rounded-md text-white font-semibold text-xs cursor-pointer hover:from-emerald-400 hover:to-emerald-500"
                  >
                    Convene Peace Conference
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-slate-500 text-[13px]">
            The realm is currently at peace. No active wars.
          </div>
        )}
      </div>

      {/* War History Column */}
      <div className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-900/40 p-4 md:p-5 lg:overflow-y-auto flex flex-col gap-3.5">
        <h3 className="m-0 text-sm font-bold text-slate-50">
          Concluded Wars &amp; Historic Treaties ({warHistory.length})
        </h3>

        <div className="flex flex-col gap-2">
          {warHistory.length > 0 ? (
            warHistory.map((h, idx) => {
              const victor = settlements.find((s) => s.id === h.winnerId);
              return (
                <div
                  key={h.id || idx}
                  className="p-3 rounded-lg bg-slate-800/60 border border-white/8"
                >
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono-tabular">
                    <span>Concluded War</span>
                    <span>Day {Math.floor((h.endTick || 0) / 100)}</span>
                  </div>
                  <div className="font-semibold text-[13px] text-slate-50 mt-1">
                    {h.attackerName} vs {h.defenderName}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                    Victor: {victor ? victor.name : 'White Peace'}
                  </div>
                  {h.terms && <div className="text-[11px] text-slate-300 mt-0.5">Terms: {h.terms}</div>}
                </div>
              );
            })
          ) : (
            <div className="text-slate-500 text-xs">No historic wars recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};
