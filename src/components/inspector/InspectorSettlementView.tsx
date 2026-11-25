import React from 'react';
import { BUILDING_META_MAP, NeedBar } from './InspectorShared';

interface InspectorSettlementViewProps {
  entity: any;
  onRallyWarband?: (settlementId: number) => void;
  onSpawnCitizens?: (settlementId: number, count: number) => void;
  onAdvanceWonder?: (settlementId: number) => void;
  onFortifySettlement?: (settlementId: number) => void;
  onCommissionBuilding?: (settlementId: number, buildingType: string) => void;
}

export const InspectorSettlementView: React.FC<InspectorSettlementViewProps> = ({
  entity: e,
  onRallyWarband,
  onSpawnCitizens,
  onAdvanceWonder,
  onFortifySettlement,
  onCommissionBuilding,
}) => {
  return (
    <div>
      {e.ruined && (
        <div className="bg-red-900/30 border border-red-400/35 rounded-md px-2 py-1.5 mb-2 text-[11px] text-red-200">
          🏚️ Settlement Collapsed ({e.collapseReason || 'Total destruction'})
        </div>
      )}

      <div className="flex justify-between items-center mb-2 gap-1.5">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold border text-slate-50"
          style={{
            borderColor: e.bannerColor || '#38bdf8',
            background: `${e.bannerColor || '#38bdf8'}22`,
          }}
        >
          {e.culture?.symbol || '⭐'} {e.culture?.ethos || 'Emergent Clan'}
        </span>
        <span className="text-amber-400 font-semibold text-[11px] truncate">
          👑 {e.leadershipTitle || 'Leader'}: {e.leadership || 'Council'}
        </span>
      </div>

      <div className="bg-white/3 border border-white/8 rounded-md p-2 mb-2.5">
        <div className="text-[11px] font-semibold text-sky-400 mb-1">
          COMMUNAL STOCKPILE &amp; GRANARY
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono-tabular">
          <div>
            🌾 Food: <b className="text-emerald-500">{e.stockpile?.food || 0}</b>
          </div>
          <div>
            🌲 Wood: <b className="text-amber-500">{e.stockpile?.wood || 0}</b>
          </div>
          <div>
            ⛏️ Ore: <b className="text-slate-400">{e.stockpile?.ore || 0}</b>
          </div>
          <div>
            🪨 Stone: <b className="text-slate-300">{e.stockpile?.stone || 0}</b>
          </div>
        </div>
      </div>

      {e.age && (
        <div
          className="bg-white/3 border rounded-md p-2 mb-2.5"
          style={{ borderColor: `${e.age.color || '#eab308'}44` }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-[11px]" style={{ color: e.age.color || '#eab308' }}>
              {e.age.icon} {e.age.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono-tabular">
              Era {e.age.id}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 mb-1.5">{e.age.description}</div>
          {e.age.wonder ? (
            <div className="mt-1 pt-1.5 border-t border-white/8">
              <div className="text-[10px] text-sky-400 flex justify-between font-mono-tabular">
                <span>{e.age.wonder.icon} {e.age.wonder.name}</span>
                <span className="font-semibold">
                  {e.age.wonder.complete
                    ? 'Completed'
                    : `Stage ${e.age.wonder.stage}/${e.age.wonder.maxStage} (${Math.round(e.age.wonder.progress || 0)}%)`}
                </span>
              </div>
              <div className="text-[10px] text-emerald-300 mt-0.5">
                Buff: {e.age.wonder.buffLabel}
              </div>
              {!e.age.wonder.complete && onAdvanceWonder && (
                <button
                  type="button"
                  onClick={() => onAdvanceWonder(e.id)}
                  className="mt-1.5 bg-sky-400/15 border border-sky-400/35 hover:bg-sky-400/25 rounded text-sky-400 text-[10px] font-semibold px-2 py-1 cursor-pointer"
                >
                  Fund Wonder Construction
                </button>
              )}
            </div>
          ) : (
            e.age.monumentName && (
              <div className="text-[10px] text-sky-400 flex justify-between font-mono-tabular">
                <span>Wonder: {e.age.monumentName}</span>
                <span className="font-semibold">
                  {e.age.hasMonument ? 'Complete' : `${e.age.monumentProgress || 0}%`}
                </span>
              </div>
            )
          )}
          {Array.isArray(e.age.heritageMonuments) && e.age.heritageMonuments.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-white/8">
              <div className="text-[10px] font-bold text-yellow-300 mb-1">
                🏛️ Grand Landmarks &amp; Heritage ({e.age.heritageMonuments.filter((m: any) => m.intact).length}/
                {e.age.heritageMonuments.length})
              </div>
              <div className="flex flex-col gap-0.5 text-[10px] text-slate-300 font-mono-tabular">
                {e.age.heritageMonuments.map((m: any) => (
                  <div key={m.buildingId} className="flex justify-between items-center">
                    <span>
                      {m.icon} {m.name} <span className="text-slate-400">(Era {m.eraId})</span>
                    </span>
                    <span
                      className={`font-semibold ${
                        m.intact
                          ? m.survivedToModern
                            ? 'text-yellow-300'
                            : 'text-emerald-300'
                          : 'text-red-400'
                      }`}
                    >
                      {m.intact ? (m.survivedToModern ? 'Ancient Heritage' : 'Intact') : 'Ruined'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {e.guilds && (
        <div className="bg-slate-800/55 border border-white/8 rounded-md p-2 mb-2.5 font-mono-tabular">
          <div className="text-[11px] font-bold text-amber-400 mb-1">
            Guild Factions &amp; Intelligence
          </div>
          <div className="text-[10px] text-slate-300 flex flex-col gap-0.5">
            <div>⚖️ Merchant Guild: {e.guilds.unlocked?.merchant ? 'Active (+25% Trade)' : 'Locked'}</div>
            <div>📐 Masons Guild: {e.guilds.unlocked?.masons ? 'Active (+25% Wonders)' : 'Locked'}</div>
            <div>
              🗡️ Shadow Syndicate:{' '}
              {e.guilds.unlocked?.shadows ? `Active · ${e.guilds.opsSuccess || 0} Ops` : 'Locked'}
            </div>
          </div>
        </div>
      )}

      {e.fortifications && !e.ruined && (
        <div
          className={`bg-slate-800/60 border rounded-md p-2 mb-2.5 font-mono-tabular ${
            e.fortifications.breaches > 0 ? 'border-red-500/45' : 'border-slate-400/25'
          }`}
        >
          <div className="flex justify-between text-[11px] font-bold text-slate-200 mb-1">
            <span>🧱 {e.fortifications.hasWalls ? e.fortifications.tierName : 'Unfortified Perimeter'}</span>
            <span className={e.fortifications.breaches > 0 ? 'text-red-300' : 'text-slate-400'}>
              {e.fortifications.breaches > 0
                ? `${e.fortifications.breaches} Breached`
                : `${e.fortifications.intactWalls} Walls`}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 flex justify-between mb-1.5">
            <span>🚪 {e.fortifications.intactGates} Gates · 🗼 {e.fortifications.towers} Watchtowers</span>
            {e.fortifications.defenseMultiplier > 1 && (
              <span className="text-amber-400 font-semibold">
                +{Math.round((e.fortifications.defenseMultiplier - 1) * 100)}% Citadel
              </span>
            )}
          </div>
          {onFortifySettlement && (
            <button
              type="button"
              onClick={() => onFortifySettlement(e.id)}
              className={`rounded px-2 py-1 text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0 border ${
                e.fortifications.breaches > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-slate-500/25 border-slate-400/40 text-slate-200'
              }`}
            >
              {e.fortifications.breaches > 0
                ? '🔧 Repair Breaches & Fortify'
                : e.fortifications.hasWalls
                  ? '🧱 Reinforce Perimeter'
                  : '🧱 Fortify Perimeter'}
            </button>
          )}
        </div>
      )}

      {e.tributeTo && (
        <div className="bg-amber-500/15 border border-amber-500/35 rounded-md px-2 py-1.5 mb-2.5 text-[10px] text-amber-200 font-semibold">
          👑 Tributary Vassal · Remitting {Math.round((e.tributeRate || 0.15) * 100)}% seasonal tribute to Overlord #
          {e.tributeTo}
        </div>
      )}

      {e.nuclearProgram &&
        (e.age?.id >= 5 || e.nuclearProgram.unlocked || e.nuclearProgram.warheads > 0) &&
        (() => {
          const infra = e.age?.nuclearInfra || e.nuclearProgram.infra;
          const checkItem = (ok: boolean | undefined, label: string) => (
            <span className={ok ? 'text-emerald-300' : 'text-amber-400'}>
              {ok ? '✓' : '○'} {label}
            </span>
          );
          return (
            <div className="bg-lime-500/8 border border-lime-500/35 rounded-md p-2 mb-2.5 font-mono-tabular">
              <div className="flex justify-between text-[11px] font-bold text-lime-300">
                <span>☢️ Atomic Program</span>
                <span>{e.nuclearProgram.warheads || 0} Warheads</span>
              </div>
              <div className="text-[10px] text-slate-300 mt-0.5">
                {e.nuclearProgram.unlocked
                  ? infra && !infra.canEnrich
                    ? `Enrichment Stalled (Requires Factory + Nuclear Plant) · Strikes: ${e.nuclearProgram.totalStrikes || 0}`
                    : `Enrichment: ${Math.round(e.nuclearProgram.progress || 0)}% · Strikes Launched: ${e.nuclearProgram.totalStrikes || 0}`
                  : 'Unlocks in Era 6 (Modern Era)'}
              </div>
              {infra && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] mt-1.5 pt-1 border-t border-lime-500/20">
                  {checkItem(infra.hasFactory, '🏭 Factory')}
                  {checkItem(infra.hasNuclearPlant, '☢️ Nuclear Plant')}
                  {checkItem(infra.hasResearchLab, '🔬 Research Lab')}
                  {checkItem(infra.hasMissileSilo, '🚀 Missile Silo')}
                </div>
              )}
            </div>
          );
        })()}

      <div className="mb-2">
        <div className="text-[11px] font-semibold text-slate-300 mb-1">
          CULTURAL DIMENSIONS
        </div>
        <NeedBar label="Industriousness" value={(e.culture?.values?.industriousness || 0.5) * 100} />
        <NeedBar label="Cooperation" value={(e.culture?.values?.cooperation || 0.5) * 100} />
        <NeedBar label="Spirituality" value={(e.culture?.values?.spirituality || 0.5) * 100} />
        <NeedBar label="Belligerence" value={(e.culture?.values?.belligerence || 0.5) * 100} />
      </div>

      {e.culture?.traditions && e.culture.traditions.length > 0 && (
        <div className="mb-2">
          <div className="text-[11px] font-semibold text-slate-300 mb-1">
            ACTIVE TRADITIONS
          </div>
          <div className="flex flex-wrap gap-1">
            {e.culture.traditions.map((t: string, idx: number) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-green-700 text-green-200 rounded text-[10px]"
              >
                📜 {String(t).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
            ))}
          </div>
        </div>
      )}

      {(onRallyWarband || onSpawnCitizens) && !e.ruined && (
        <div className="mb-2 bg-white/2 border border-white/7 rounded-md px-2 py-1.5">
          <div className="text-[11px] font-semibold text-slate-300 mb-1">
            CIVIC &amp; MILITARY COMMAND
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onRallyWarband && (
              <button
                type="button"
                onClick={() => onRallyWarband(e.id)}
                className="bg-red-600 hover:bg-red-500 text-white border-0 rounded text-[10px] px-2 py-1 cursor-pointer font-semibold whitespace-nowrap"
              >
                🛡️ Rally Warband
              </button>
            )}
            {onSpawnCitizens && (
              <>
                <button
                  type="button"
                  onClick={() => onSpawnCitizens(e.id, 1)}
                  className="bg-sky-600 hover:bg-sky-500 text-white border-0 rounded text-[10px] px-2 py-1 cursor-pointer font-semibold whitespace-nowrap"
                >
                  👤 +1 Citizen
                </button>
                <button
                  type="button"
                  onClick={() => onSpawnCitizens(e.id, 5)}
                  className="bg-teal-700 hover:bg-teal-600 text-white border-0 rounded text-[10px] px-2 py-1 cursor-pointer font-semibold whitespace-nowrap"
                >
                  👥 +5 Citizens
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {onCommissionBuilding && !e.ruined && (() => {
        const curEra = e.age?.id || 1;
        const catalogKeys = [
          'granary', 'windmill', 'inn', 'library',
          'apothecary', 'castle', 'bank', 'factory',
          'research_lab', 'radar_station', 'nuclear_plant', 'missile_silo',
        ];
        return (
          <div className="mb-2 bg-slate-800/50 border border-sky-400/20 rounded-md px-2 py-1.5">
            <div className="flex justify-between text-[11px] font-bold text-sky-400 mb-1">
              <span>🏗️ Commission Era Structures</span>
              <span className="text-[10px] text-slate-400 font-mono-tabular">Era {curEra}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {catalogKeys.map((bKey) => {
                const m = BUILDING_META_MAP[bKey];
                if (!m) return null;
                const unlocked = curEra >= (m.minEra || 1);
                return (
                  <button
                    type="button"
                    key={bKey}
                    disabled={!unlocked}
                    title={unlocked ? `${m.name}: ${m.roleSummary}` : `Unlocks in Era ${m.minEra}`}
                    onClick={() => unlocked && onCommissionBuilding(e.id, bKey)}
                    className={`flex justify-between items-center gap-1 px-1.5 py-1 rounded border text-[10px] font-semibold text-left ${
                      unlocked
                        ? 'border-sky-400/30 bg-slate-900/85 hover:border-sky-400/60 text-slate-200 cursor-pointer'
                        : 'border-slate-400/15 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <span className="truncate">
                      {m.icon} {m.name}
                    </span>
                    <span className={`text-[9px] shrink-0 font-mono-tabular ${unlocked ? 'text-sky-400' : 'text-slate-500'}`}>
                      {unlocked ? `E${m.minEra}` : `🔒E${m.minEra}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="mt-2 text-[11px] text-slate-300 border-t border-white/8 pt-1.5 leading-relaxed font-mono-tabular">
        <div>
          👥 Population: <b>{e.population || (e.agentIds ? e.agentIds.size : 0)}</b> citizens ({e.growthTrend || 'stable'})
        </div>
        <div>
          🏛️ Buildings: <b>{e.buildings ? e.buildings.length : 0}</b> structures
          {e.urbanRadius ? ` · 🌆 Radius ${e.urbanRadius}t` : ''}
          {(() => {
            const docks =
              e.docksCount ??
              (Array.isArray(e.buildings)
                ? e.buildings.filter((b: any) => (b.buildingType || b.type) === 'dock' && !b.isRuined).length
                : 0);
            const fleet = e.vesselsCount ?? 0;
            if (docks === 0 && fleet === 0) return null;
            return (
              <span className="text-sky-400">
                {' '}· ⚓ {docks} docks · ⛵ {fleet} vessels
              </span>
            );
          })()}
        </div>
        <div>
          📍 Center: ({Math.floor(e.center?.x || 0)}, {Math.floor(e.center?.y || 0)})
        </div>
      </div>
    </div>
  );
};
