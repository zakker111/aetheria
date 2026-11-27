import React from 'react';
import { AgentRelativeRef } from '../../types';
import { BUILDING_METADATA } from '../../core/constants.js';

export const BUILDING_META_MAP = BUILDING_METADATA as Record<string, any>;

export const ACTION_DESCRIPTIONS: Record<string, string> = {
  gather_at_hearth: '🔥 Gathering around village hearth',
  visit_market: '🛍️ Browsing market square',
  pray_at_temple: '🙏 Praying at temple',
  conjure_fallen: '👻 Conjuring ancestral spirits',
  wander_to_town: '🏘️ Visiting neighboring town',
  watch_crafts: '🔨 Watching blacksmith forge',
  train_at_barracks: '🛡️ Practicing combat drills',
  patrol_settlement: '🛡️ Patrolling town perimeter',
  play_in_town: '🪁 Playing in town square',
  fetch_town_water: '🪣 Drawing well water',
  tend_town_farm: '🌾 Tending communal crops',
  deposit_to_stockpile: '📦 Hauling goods to stockpile',
  eat_from_stockpile: '🍞 Dining from granary',
  eat_from_inventory: '🍞 Eating meal',
  visit_neighbor: '💬 Visiting neighbor',
  socialize: '💬 Socializing with townspeople',
  go_home_and_rest: '💤 Resting in cottage bed',
  rest: '💤 Taking rest',
  chop_wood: '🪓 Chopping timber',
  mine_ore: '⛏️ Mining mineral deposit',
  gather_food: '🌾 Foraging supplies',
  hunt: '🏹 Stalking quarry',
  hunt_patrol: '🏹 Tracking roaming game',
  build: '🔨 Constructing building',
  reproduce: '❤️ Courting spouse',
  return_home: '🚶 Returning to settlement',
  wander: '🚶 Strolling around neighborhood',
};

export const NeedBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const colorClass = clamped < 30 ? 'bg-red-500' : clamped < 60 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="my-1">
      <div className="flex justify-between text-[11px] text-slate-400 mb-0.5 font-mono-tabular">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="w-full h-[5px] bg-slate-800 rounded-sm overflow-hidden">
        <div
          className={`h-full rounded-sm transition-[width] duration-200 ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export const RelChipList: React.FC<{
  title: string;
  items: AgentRelativeRef[];
  onSelectAgent?: (agentId: number) => void;
}> = ({ title, items, onSelectAgent }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            type="button"
            key={`${title}_${item.id}`}
            onClick={() => onSelectAgent && onSelectAgent(item.id)}
            className={`flex justify-between items-center w-full text-left px-2 py-1 rounded bg-slate-800/70 border border-white/8 text-slate-200 text-[11px] ${
              onSelectAgent ? 'cursor-pointer hover:border-sky-400/40' : 'cursor-default'
            }`}
          >
            <span>
              {item.name}
              {item.label ? ` · ${item.label}` : ''}
            </span>
            <span
              className={`text-[10px] font-mono-tabular ${
                item.alive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {item.alive ? 'Living' : 'Fallen'}
              {item.score != null ? ` · ${item.score}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
