import React from 'react';
import { SettlementSummary } from '../types';

interface SocietiesPanelProps {
  settlements: SettlementSummary[];
  onSelectSettlement: (s: SettlementSummary) => void;
  onClose: () => void;
}

const SocietiesPanelComponent: React.FC<SocietiesPanelProps> = ({
  settlements,
  onSelectSettlement,
  onClose,
}) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/12 rounded-xl px-3.5 py-3 pointer-events-auto shadow-xl text-xs max-h-[260px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between font-semibold text-sky-400 mb-2 border-b border-white/8 pb-1 text-[13px]">
        <span>🏛️ Societies &amp; Settlements</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close societies panel"
          className="bg-transparent border-0 text-slate-400 hover:text-slate-200 cursor-pointer text-sm leading-none px-1"
        >
          ✕
        </button>
      </div>

      <div className="overflow-y-auto flex-1 pr-1">
        {settlements.length === 0 ? (
          <div className="text-slate-400 italic">
            Detecting active tribes and settlements...
          </div>
        ) : (
          settlements.map((s) => {
            const leader = s.leadership
              ? `${s.leadershipTitle || 'Leader'}: ${s.leadership}`
              : 'Tribal Council';
            const cultureTag = s.culture?.ethos
              ? ` • ${s.culture.symbol || '⭐'} ${s.culture.ethos}`
              : '';

            return (
              <button
                type="button"
                key={s.id}
                onClick={() => onSelectSettlement(s)}
                className="w-full text-left bg-slate-800/60 hover:bg-slate-700/80 border border-white/6 hover:border-sky-400 px-2.5 py-2 rounded-lg mb-1.5 cursor-pointer transition-colors block"
              >
                <div className="font-semibold text-amber-400 flex justify-between items-center gap-2">
                  <span className="truncate">
                    {s.tierIcon || '🏡'} {s.name}{' '}
                    <small className="text-[10px] opacity-80">({s.tier || 'Village'})</small>
                  </span>
                  <span className="text-emerald-400 font-mono-tabular whitespace-nowrap shrink-0">
                    {s.population} citizens
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5 flex justify-between items-center gap-2">
                  <span className="truncate">
                    {leader} • {s.buildingsCount} structures{cultureTag}
                  </span>
                  {s.age && (
                    <span
                      className="text-[10px] font-semibold whitespace-nowrap shrink-0"
                      style={{ color: s.age.color || '#38bdf8' }}
                    >
                      {s.age.icon} {s.age.name}
                    </span>
                  )}
                </div>
                {s.age?.monumentName && (
                  <div className="text-sky-400 text-[10px] mt-0.5 flex justify-between items-center font-mono-tabular">
                    <span className="truncate">Wonder: {s.age.monumentName}</span>
                    <span className="font-semibold shrink-0">
                      {s.age.hasMonument ? '✅ Complete' : `${s.age.monumentProgress || 0}%`}
                    </span>
                  </div>
                )}
                <div className="text-slate-300 text-[10px] mt-0.5 font-mono-tabular">
                  Stockpile: 🌾 {s.stockpile?.food || 0} | 🌲 {s.stockpile?.wood || 0} | ⛏️{' '}
                  {s.stockpile?.ore || 0}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export const SocietiesPanel = React.memo(SocietiesPanelComponent);
