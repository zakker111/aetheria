import React from 'react';
import { BUILDING_META_MAP, NeedBar } from './InspectorShared';

interface InspectorBuildingViewProps {
  entity: any;
  upgradeReq?: any;
  onSelectAgent?: (agentId: number) => void;
  onUpgradeBuilding?: (buildingId: number) => void;
}

export const InspectorBuildingView: React.FC<InspectorBuildingViewProps> = ({
  entity: e,
  upgradeReq = null,
  onSelectAgent,
  onUpgradeBuilding,
}) => {
  const bType = e.buildingType || e.type;
  const bMeta = BUILDING_META_MAP[bType];
  const lvl = e.level || 1;
  const maxLvl = e.maxLevel || bMeta?.maxLevel || 3;
  const tierName = bMeta?.levelNames?.[lvl - 1] || bMeta?.name || bType;
  const currentBonus = bMeta?.levelBonuses?.[lvl - 1];
  const hp = Math.round(e.health ?? 100);
  const maxHp = Math.round(e.maxHealth ?? 100);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5 items-center">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            e.isRuined
              ? 'bg-red-900 text-red-200'
              : e.complete
                ? 'bg-green-700 text-green-200'
                : 'bg-sky-700 text-sky-200'
          }`}
        >
          {e.isRuined ? 'RUINED' : e.complete ? 'COMPLETED' : 'UNDER CONSTRUCTION'}
        </span>
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            lvl >= 3
              ? 'bg-amber-400/20 text-amber-400 border-amber-400/45'
              : lvl === 2
                ? 'bg-sky-400/20 text-sky-400 border-sky-400/40'
                : 'bg-slate-500/25 text-slate-300 border-slate-400/30'
          }`}
        >
          Lv {lvl}/{maxLvl} · {tierName}
        </span>
        {bMeta?.minEra && <span className="text-[10px] text-slate-400">Era {bMeta.minEra}+</span>}
        {(e.isHeritage || bMeta?.isMonument || String(bType || '').startsWith('monument_')) && (
          <span className="text-[10px] font-bold text-yellow-300">
            · 🏛️ Heritage ({e.builtEraName || `Era ${e.builtInEra || bMeta?.minEra || 1}`})
          </span>
        )}
      </div>

      {!e.complete && <NeedBar label="Construction" value={e.constructionProgress || 0} />}
      <NeedBar label={`Integrity (${hp} / ${maxHp} HP)`} value={(hp / Math.max(1, maxHp)) * 100} />

      <div className="mt-2 text-[11px] text-slate-300 leading-snug font-mono-tabular">
        <div>
          📍 Position: ({Math.floor(e.x)}, {Math.floor(e.y)})
          {e.settlementName ? ` · ${e.settlementName}` : ''}
          {e.capacity > 0 ? ` · 📦 Storage ${e.capacity}` : ''}
        </div>
        {e.dedication && (
          <div className="mt-1.5 px-2 py-1.5 rounded-md bg-yellow-500/8 border border-yellow-500/25 text-yellow-200 text-[10px] italic">
            🏛️ Plaque: “{e.dedication}”
          </div>
        )}
        {bMeta?.roleSummary && (
          <div className="text-slate-200 mt-1">
            {bMeta.icon} <b>Society Role:</b> {bMeta.roleSummary}
          </div>
        )}
        {currentBonus && (
          <div className="text-emerald-300 mt-1 text-[10px]">
            ✦ Active Lv {lvl} Effect: {currentBonus}
          </div>
        )}
        {(e.builtByName ||
          e.upgradedByName ||
          (Array.isArray(e.contributors) && e.contributors.length > 0) ||
          (Array.isArray(e.upgradeHistory) && e.upgradeHistory.length > 0)) && (
          <div className="mt-1.5 px-2 py-1.5 rounded-md bg-slate-800/55 border border-white/8 text-[10px] text-slate-300 flex flex-col gap-1">
            {e.builtByName && (
              <div className="flex justify-between items-center gap-1.5">
                <span>
                  🔨 Built by <b className="text-slate-50">{e.builtByName}</b>
                  {e.builtYear ? ` · Year ${e.builtYear}` : ''}
                  {e.builtEraName ? ` · ${e.builtEraName}` : ''}
                </span>
                {e.builtByAgentId != null && onSelectAgent && (
                  <button
                    type="button"
                    onClick={() => onSelectAgent(e.builtByAgentId)}
                    className="bg-sky-400/15 border border-sky-400/35 hover:bg-sky-400/25 rounded text-sky-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Inspect Builder
                  </button>
                )}
              </div>
            )}
            {Array.isArray(e.contributors) && e.contributors.length > 1 && (
              <div className="text-slate-400 flex flex-wrap gap-1 items-center">
                <span>👥 Builders:</span>
                {e.contributors.map((c: any, idx: number) =>
                  c?.id != null && onSelectAgent ? (
                    <button
                      type="button"
                      key={`contrib_${c.id}_${idx}`}
                      onClick={() => onSelectAgent(c.id)}
                      className="bg-transparent border border-slate-400/28 hover:border-slate-300/60 rounded text-slate-300 text-[9px] px-1.5 py-0.5 cursor-pointer"
                    >
                      {c.name}
                    </button>
                  ) : (
                    <span key={`contrib_${idx}`}>{c?.name}</span>
                  )
                )}
              </div>
            )}
            {e.upgradedByName && (
              <div className="flex justify-between items-center gap-1.5 text-amber-400">
                <span>⬆ Renovated under {e.upgradedByName}</span>
                {e.upgradedByAgentId != null && onSelectAgent && (
                  <button
                    type="button"
                    onClick={() => onSelectAgent(e.upgradedByAgentId)}
                    className="bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 rounded text-amber-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Inspect
                  </button>
                )}
              </div>
            )}
            {Array.isArray(e.upgradeHistory) && e.upgradeHistory.length > 0 && (
              <div className="border-t border-white/6 pt-1 flex flex-col gap-0.5">
                <div className="text-[9px] text-slate-400 font-bold uppercase">
                  Renovation Ledger
                </div>
                {e.upgradeHistory.map((u: any, idx: number) => (
                  <div key={`up_${u.level}_${idx}`} className="flex justify-between items-center gap-1.5 text-slate-300">
                    <span>
                      Lv {u.level} · Year {u.year} · {u.eraName} · {u.byName}
                    </span>
                    {u.byAgentId != null && onSelectAgent && (
                      <button
                        type="button"
                        onClick={() => onSelectAgent(u.byAgentId)}
                        className="bg-transparent border-0 text-sky-400 hover:text-sky-300 text-[9px] font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {e.complete && !e.isRuined && lvl < maxLvl && upgradeReq && (
        <div className="mt-2.5 p-2 rounded-md bg-slate-800/72 border border-sky-400/25 font-mono-tabular">
          <div className="flex justify-between text-[11px] font-bold text-sky-400">
            <span>⬆ Next: Lv {upgradeReq.nextLevel} ({upgradeReq.nextName})</span>
            <span className={`text-[10px] ${upgradeReq.eraMet ? 'text-emerald-300' : 'text-amber-400'}`}>
              Era {upgradeReq.requiredEra}+
            </span>
          </div>
          {upgradeReq.nextBonus && (
            <div className="text-[10px] text-slate-300 mt-0.5">{upgradeReq.nextBonus}</div>
          )}
          <div className="text-[10px] text-slate-400 mt-1">
            Cost: 🌲 {upgradeReq.costs?.wood || 0} Wood · ⛏️ {upgradeReq.costs?.ore || 0} Ore
          </div>
          {onUpgradeBuilding && (
            <button
              type="button"
              disabled={!upgradeReq.eraMet}
              onClick={() => onUpgradeBuilding(e.id)}
              className={`mt-1.5 w-full py-1 px-2 rounded border-0 text-[11px] font-bold ${
                upgradeReq.eraMet
                  ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              {upgradeReq.eraMet
                ? `⬆ Upgrade to Lv ${upgradeReq.nextLevel}`
                : `🔒 Requires Era ${upgradeReq.requiredEra} (Currently Era ${upgradeReq.currentEra})`}
            </button>
          )}
        </div>
      )}

      {e.complete && !e.isRuined && lvl >= maxLvl && (
        <div className="mt-2 text-[10px] text-amber-400 font-bold">
          ★ Maximum Architectural Tier Reached (Lv {lvl}/{maxLvl})
        </div>
      )}
    </div>
  );
};
