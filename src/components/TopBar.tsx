import React from 'react';
import pantheonEmblem from '../assets/images/god_avatar_pantheon_1790511705368.jpg';
import { TimeState, ResourceSummary } from '../types';

interface TopBarProps {
  time: TimeState;
  agentCount: number;
  births: number;
  deaths: number;
  avgDeathAge?: number;
  resources: ResourceSummary;
  societiesCount: number;
  speed: number;
  is25D: boolean;
  weather?: { name: string; icon: string; description: string };
  dominantAge?: { name: string; icon: string; color: string };
  lodStats?: { tier0: number; tier1: number; tier2: number; avgTickMs: number };
}

const TopBarComponent: React.FC<TopBarProps> = ({
  time,
  agentCount,
  births,
  deaths,
  avgDeathAge,
  resources,
  societiesCount,
  speed,
  is25D,
  weather,
  dominantAge,
  lodStats,
}) => {
  return (
    <div className="bg-slate-900/88 backdrop-blur-md border border-white/12 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-[13px] pointer-events-auto shadow-xl flex flex-col gap-1.5 w-full md:min-w-[272px] md:w-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={pantheonEmblem}
            alt="Pantheon Emblem"
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full border border-amber-400/60 object-cover shrink-0"
          />
          <span className="text-[15px] font-bold tracking-wide bg-gradient-to-br from-rose-500 via-rose-400 to-amber-400 bg-clip-text text-transparent font-display">
            Aetheria
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {weather && (
            <span
              title={weather.description}
              className="text-[11px] px-1.5 py-0.5 rounded-md bg-sky-400/15 border border-sky-400/30 text-sky-400 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>{weather.icon}</span>
              <span className="hidden sm:inline">{weather.name}</span>
            </span>
          )}
          <span className="text-[11px] text-slate-400">{is25D ? '2.5D' : '2D'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-0.5 font-mono-tabular">
        <div className="flex justify-between text-xs gap-1">
          <span className="text-slate-400">Day / Hour:</span>
          <span className="font-semibold text-slate-50">
            {time.days + 1} : {time.hours}
          </span>
        </div>
        <div className="flex justify-between text-xs gap-1">
          <span className="text-slate-400">Agents:</span>
          <span className="font-semibold text-slate-50">{agentCount}</span>
        </div>
        <div className="flex justify-between text-xs gap-1">
          <span className="text-slate-400">Births / Deaths:</span>
          <span className="font-semibold">
            <span className="text-green-500">{births}</span> /{' '}
            <span className="text-rose-500">{deaths}</span>
            {avgDeathAge !== undefined && avgDeathAge > 0 ? (
              <span className="text-slate-400 text-[11px] ml-1 hidden sm:inline" title="Average age at death">
                (avg {avgDeathAge.toFixed(1)}y)
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-between text-xs gap-1">
          <span className="text-slate-400">Era:</span>
          <span
            className="font-semibold inline-flex items-center gap-1 truncate"
            style={{ color: dominantAge?.color || '#fbbf24' }}
          >
            {dominantAge ? `${dominantAge.icon} ${dominantAge.name}` : 'Tribal'}
          </span>
        </div>
        <div className="flex justify-between text-xs gap-1">
          <span className="text-slate-400">Societies:</span>
          <span className="font-semibold text-amber-400">{societiesCount}</span>
        </div>
        <div className="flex justify-between text-xs gap-1">
          <span className="text-slate-400">Speed:</span>
          <span className="font-semibold text-slate-50">{speed}x</span>
        </div>
        <div className="col-span-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-slate-300 border-t border-white/8 pt-1 mt-0.5">
          <span>
            🌾 Food: <b className="text-red-400">{resources.food}</b>
          </span>
          <span>
            🌲 Wood: <b className="text-green-400">{resources.wood}</b>
          </span>
          <span>
            ⛏️ Ore: <b className="text-slate-300">{resources.ore}</b>
          </span>
          <span>
            💧 Water: <b className="text-sky-400">{resources.water}</b>
          </span>
        </div>
        {lodStats && (
          <div className="col-span-2 flex justify-between text-[11px] text-slate-400 border-t border-white/6 pt-1 mt-0.5">
            <span>
              ⚡ Sim: <b className="text-sky-400">{lodStats.avgTickMs.toFixed(1)}ms</b>
            </span>
            <span title="LOD Distribution: T0 (In Viewport), T1 (Active Towns), T2 (Hinterland Macro)">
              LOD: <span className="text-green-400">T0:{lodStats.tier0}</span> |{' '}
              <span className="text-amber-400">T1:{lodStats.tier1}</span> |{' '}
              <span className="text-violet-400">T2:{lodStats.tier2}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const TopBar = React.memo(TopBarComponent);
