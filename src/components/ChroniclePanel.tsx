import React, { useState } from 'react';
import { ChronicleEntrySummary } from '../types';

interface ChroniclePanelProps {
  events: string[];
  structuredEntries?: ChronicleEntrySummary[];
  onExportWorld?: () => void;
  onExportChronicle?: () => void;
  onPanTo?: (x: number, y: number) => void;
  onSelectAgent?: (agentId: number) => void;
  onSelectBuilding?: (buildingId: number) => void;
}

const ERA_FILTERS: Array<{ id: number | null; label: string }> = [
  { id: null, label: 'All' },
  { id: 1, label: 'E1' },
  { id: 2, label: 'E2' },
  { id: 3, label: 'E3' },
  { id: 4, label: 'E4' },
  { id: 5, label: 'E5' },
  { id: 6, label: 'E6' },
  { id: 7, label: 'E7' },
];

const ChroniclePanelComponent: React.FC<ChroniclePanelProps> = ({
  events,
  structuredEntries = [],
  onExportWorld,
  onExportChronicle,
  onPanTo,
  onSelectAgent,
  onSelectBuilding,
}) => {
  const [eraFilter, setEraFilter] = useState<number | null>(null);

  const filteredEntries =
    structuredEntries.length > 0
      ? eraFilter == null
        ? structuredEntries
        : structuredEntries.filter((e) => (e.eraId ?? 1) === eraFilter)
      : [];

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-white/12 rounded-xl px-3.5 py-3 pointer-events-auto shadow-xl text-xs max-h-[240px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between font-semibold text-sky-400 mb-1.5 border-b border-white/8 pb-1 text-[13px] gap-1.5">
        <span className="whitespace-nowrap">📜 World Chronicle</span>
        <div className="flex gap-1 items-center">
          {onExportChronicle && (
            <button
              type="button"
              onClick={onExportChronicle}
              title="Download historical chronicle replay JSON"
              className="bg-sky-400/15 border border-sky-400/30 hover:bg-sky-400/25 rounded text-sky-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Export Log
            </button>
          )}
          {onExportWorld && (
            <button
              type="button"
              onClick={onExportWorld}
              title="Download full save snapshot JSON"
              className="bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 rounded text-amber-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
            >
              Export Save
            </button>
          )}
        </div>
      </div>

      {structuredEntries.length > 0 && (
        <div className="flex gap-1 mb-1.5 shrink-0">
          {ERA_FILTERS.map((ef) => (
            <button
              type="button"
              key={String(ef.id ?? 'all')}
              onClick={() => setEraFilter(ef.id)}
              title={ef.id == null ? 'All Eras' : `Filter Era ${ef.id}`}
              className={`flex-1 py-0.5 px-1 rounded border-0 text-[9px] font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                eraFilter === ef.id
                  ? 'bg-sky-400 text-slate-900'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              {ef.label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-y-auto flex-1 pr-1 max-h-[165px] leading-snug">
        {structuredEntries.length > 0 ? (
          filteredEntries.length === 0 ? (
            <div className="text-slate-400 italic text-[11px]">
              No chronicle highlights recorded in Era {eraFilter} yet.
            </div>
          ) : (
            filteredEntries.slice(0, 35).map((entry) => {
              const targetAgentId =
                entry.agentId ?? entry.killerId ?? entry.builderId ?? entry.victimId ?? null;
              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    if (onPanTo && typeof entry.x === 'number' && typeof entry.y === 'number') {
                      onPanTo(entry.x, entry.y);
                    }
                  }}
                  className={`py-1 border-b border-white/5 text-[11px] text-slate-300 flex justify-between items-start gap-1.5 ${
                    typeof entry.x === 'number' ? 'cursor-pointer hover:bg-slate-800/40 rounded px-0.5' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-slate-500 mr-1.5 font-mono-tabular">
                      {entry.date}
                    </span>
                    <span>{entry.text}</span>
                  </div>
                  <div className="flex gap-1 items-center shrink-0">
                    {entry.buildingId != null && onSelectBuilding && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectBuilding(entry.buildingId!);
                        }}
                        title="Inspect landmark structure"
                        className="bg-amber-500/15 border border-amber-500/35 hover:bg-amber-500/25 rounded text-amber-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap shrink-0 mt-0.5"
                      >
                        🏛️ Site
                      </button>
                    )}
                    {targetAgentId != null && onSelectAgent && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectAgent(targetAgentId);
                        }}
                        title="Inspect historical figure"
                        className="bg-sky-400/15 border border-sky-400/35 hover:bg-sky-400/25 rounded text-sky-400 text-[9px] font-semibold px-1.5 py-0.5 cursor-pointer whitespace-nowrap shrink-0 mt-0.5"
                      >
                        👤 Inspect
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )
        ) : events.length === 0 ? (
          <div className="text-slate-400 italic text-[11px]">
            World awakened with 160×160 terrain and biomes.
          </div>
        ) : (
          events.map((evt, idx) => (
            <div key={idx} className="py-1 border-b border-white/5 text-[11px] text-slate-300">
              {evt}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const ChroniclePanel = React.memo(ChroniclePanelComponent);
