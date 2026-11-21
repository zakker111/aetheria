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

  const filteredEntries = structuredEntries.length > 0
    ? (eraFilter == null
      ? structuredEntries
      : structuredEntries.filter((e) => (e.eraId ?? 1) === eraFilter))
    : [];

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '12px 14px',
        pointerEvents: 'auto',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        fontSize: '12px',
        maxHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600,
          color: '#38bdf8',
          marginBottom: '6px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '4px',
          fontSize: '13px',
          gap: '6px',
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>📜 World Chronicle</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {onExportChronicle && (
            <button
              onClick={onExportChronicle}
              title="Download historical chronicle replay JSON"
              style={{
                background: 'rgba(56, 189, 248, 0.14)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '4px',
                color: '#38bdf8',
                fontSize: '9px',
                fontWeight: 600,
                padding: '2px 6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Export Log
            </button>
          )}
          {onExportWorld && (
            <button
              onClick={onExportWorld}
              title="Download full save snapshot JSON"
              style={{
                background: 'rgba(245, 158, 11, 0.14)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '4px',
                color: '#fbbf24',
                fontSize: '9px',
                fontWeight: 600,
                padding: '2px 6px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Export Save
            </button>
          )}
        </div>
      </div>

      {structuredEntries.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '3px',
            marginBottom: '6px',
            flexShrink: 0,
          }}
        >
          {ERA_FILTERS.map((ef) => (
            <button
              key={String(ef.id ?? 'all')}
              onClick={() => setEraFilter(ef.id)}
              title={ef.id == null ? 'All Eras' : `Filter Era ${ef.id}`}
              style={{
                flex: 1,
                padding: '2px 4px',
                borderRadius: '4px',
                border: 'none',
                background: eraFilter === ef.id ? '#38bdf8' : 'rgba(30, 41, 59, 0.7)',
                color: eraFilter === ef.id ? '#0f172a' : '#94a3b8',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {ef.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', maxHeight: '165px', lineHeight: 1.4 }}>
        {structuredEntries.length > 0 ? (
          filteredEntries.length === 0 ? (
            <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
              No chronicle highlights recorded in Era {eraFilter} yet.
            </div>
          ) : (
            filteredEntries.slice(0, 35).map((entry) => {
              const targetAgentId = entry.agentId ?? entry.killerId ?? entry.builderId ?? entry.victimId ?? null;
              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    if (onPanTo && typeof entry.x === 'number' && typeof entry.y === 'number') {
                      onPanTo(entry.x, entry.y);
                    }
                  }}
                  style={{
                    padding: '4px 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    cursor: typeof entry.x === 'number' ? 'pointer' : 'default',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '6px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '9px', color: '#64748b', marginRight: '5px', fontVariantNumeric: 'tabular-nums' }}>
                      {entry.date}
                    </span>
                    <span>{entry.text}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                    {entry.buildingId != null && onSelectBuilding && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectBuilding(entry.buildingId!);
                        }}
                        title="Inspect landmark structure"
                        style={{
                          background: 'rgba(245, 158, 11, 0.14)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          borderRadius: '4px',
                          color: '#fbbf24',
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '1px 5px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        🏛️ Site
                      </button>
                    )}
                    {targetAgentId != null && onSelectAgent && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectAgent(targetAgentId);
                        }}
                        title="Inspect historical figure"
                        style={{
                          background: 'rgba(56, 189, 248, 0.14)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: '4px',
                          color: '#38bdf8',
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '1px 5px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
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
          <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
            World awakened with 128×128 terrain and biomes.
          </div>
        ) : (
          events.map((evt, idx) => (
            <div
              key={idx}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                fontSize: '11px',
                color: '#cbd5e1',
              }}
            >
              {evt}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const ChroniclePanel = React.memo(ChroniclePanelComponent);
