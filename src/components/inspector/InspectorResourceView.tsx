import React from 'react';
import { NeedBar } from './InspectorShared';

interface InspectorResourceViewProps {
  entity: any;
}

export const InspectorResourceView: React.FC<InspectorResourceViewProps> = ({ entity: e }) => {
  const isDepleted = Boolean(e.depleted || (e.amount || 0) <= 0);
  const reqEra = e.requiredEraId || (e.resourceType === 'uranium' ? 6 : 1);
  const isFiniteMineral = e.resourceType === 'ore' || e.resourceType === 'gem' || e.resourceType === 'uranium';
  return (
    <div>
      <div className="mb-2 flex gap-1.5 items-center flex-wrap">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
            e.exhausted
              ? 'bg-amber-950 text-orange-300'
              : isDepleted
                ? 'bg-red-900 text-red-200'
                : e.resourceType === 'uranium'
                  ? 'bg-lime-950 text-lime-300'
                  : 'bg-green-700 text-green-200'
          }`}
        >
          {e.exhausted
            ? 'EXHAUSTED MINE'
            : isDepleted
              ? 'DEPLETED'
              : e.depositTier === 'iron_mountain'
                ? 'IRON MOUNTAIN LODE'
                : e.resourceType === 'uranium'
                  ? 'URANIUM VEIN'
                  : `${e.resourceType?.toUpperCase()} DEPOSIT`}
        </span>
        {e.label && (
          <span className="text-[11px] text-slate-400 italic">{e.label}</span>
        )}
      </div>
      <NeedBar
        label={`Harvestable Reserve (${Math.round(e.amount || 0)} / ${e.maxAmount || 40})`}
        value={((e.amount || 0) / (e.maxAmount || 40)) * 100}
      />
      <div className="mt-2 text-[11px] text-slate-300 leading-relaxed font-mono-tabular">
        <div>
          📍 Location: ({Math.floor(e.x)}, {Math.floor(e.y)})
        </div>
        {reqEra > 1 && (
          <div className={e.resourceType === 'uranium' ? 'text-lime-300 font-semibold' : 'text-amber-300 font-semibold'}>
            🔒 Tech Requirement: Era {reqEra}+ ({reqEra >= 6 ? 'Modern / Nuclear Age' : 'Bronze Age'})
          </div>
        )}
        {e.resourceType === 'wood' && e.growthStage && (
          <div className="text-emerald-300">
            🌳 Growth Stage: <b className="capitalize">{e.growthStage}</b>
          </div>
        )}
        {e.exhausted ? (
          <div className="text-orange-400 font-semibold">
            ⛏️ Vein Permanently Exhausted: mineral seam depleted
          </div>
        ) : isDepleted ? (
          <div className="text-amber-400 font-medium">
            ⏳ Ecological Recovery: Regrowing in {e.recoveryTicks || 0} ticks
          </div>
        ) : (
          <div>
            {isFiniteMineral
              ? '⛏️ Finite Mountain Vein: depletes permanently after extraction'
              : '🌱 Regrowth: Natural ecological growth'}
          </div>
        )}
      </div>
    </div>
  );
};
