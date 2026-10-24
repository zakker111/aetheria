import React from 'react';
import { WarSummary, TreatySummary, RelationSummary } from '../types';

interface DiplomacyPanelProps {
  wars: WarSummary[];
  treaties: TreatySummary[];
  relations: RelationSummary[];
  onSignPeace: (s1: number, s2: number) => void;
  onEnforceAllPeace: () => void;
  onProvokeWar: (s1: number, s2: number) => void;
  onFormAlliance: (s1: number, s2: number) => void;
  onClose: () => void;
}

export const DiplomacyPanel: React.FC<DiplomacyPanelProps> = ({
  wars,
  treaties,
  relations,
  onSignPeace,
  onEnforceAllPeace,
  onProvokeWar,
  onFormAlliance,
  onClose,
}) => {
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
        maxHeight: '280px',
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
          marginBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '4px',
          fontSize: '13px',
        }}
      >
        <span>⚔️ Diplomacy & Warfare</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {/* 1. Active Wars */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#ef4444',
            marginBottom: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚔️ ACTIVE WARS ({wars.length})</span>
          {wars.length > 0 && (
            <button
              onClick={onEnforceAllPeace}
              style={{
                background: '#1e293b',
                border: '1px solid #475569',
                color: '#f8fafc',
                borderRadius: '4px',
                fontSize: '9px',
                padding: '2px 6px',
                cursor: 'pointer',
              }}
            >
              Enforce Peace
            </button>
          )}
        </div>

        {wars.length === 0 ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', fontStyle: 'italic' }}>
              🕊️ The realms are at peace. No active hostilities.
            </div>
            {relations.length > 0 && (
              <button
                onClick={() => onProvokeWar(relations[0].s1Id, relations[0].s2Id)}
                style={{
                  background: '#7f1d1d',
                  border: '1px solid #ef4444',
                  color: '#fecaca',
                  borderRadius: '4px',
                  fontSize: '10px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ⚔️ Provoke War ({relations[0].s1Name} vs {relations[0].s2Name})
              </button>
            )}
          </div>
        ) : (
          wars.map((w, idx) => {
            const casualtiesA = w.casualties[w.attackerId] || 0;
            const casualtiesD = w.casualties[w.defenderId] || 0;
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  padding: '8px',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 600,
                    fontSize: '11px',
                    color: '#fca5a5',
                  }}
                >
                  <span>
                    ⚔️ {w.attackerName} vs {w.defenderName}
                  </span>
                  <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>WAR</span>
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px' }}>
                  Casus Belli: {w.casusBelli}
                </div>
                <div style={{ fontSize: '10px', color: '#f87171', marginTop: '2px' }}>
                  Casualties: {w.attackerName} ({casualtiesA}) • {w.defenderName} ({casualtiesD})
                </div>
                {(w.plundered.food > 0 || w.plundered.wood > 0 || w.plundered.ore > 0) && (
                  <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '2px' }}>
                    Plundered: 🌾 {w.plundered.food} | 🌲 {w.plundered.wood} | ⛏️ {w.plundered.ore}
                  </div>
                )}
                <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => onSignPeace(w.attackerId, w.defenderId)}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #64748b',
                      color: '#cbd5e1',
                      borderRadius: '4px',
                      fontSize: '10px',
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    🕊️ Sign Peace
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* 2. Treaties & Alliances */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', margin: '10px 0 6px 0' }}>
          🤝 ALLIANCES & TREATIES ({treaties.length})
        </div>
        {treaties.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '10px', fontStyle: 'italic' }}>
            No formal defensive pacts active.
          </div>
        ) : (
          treaties.map((t, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                padding: '6px 8px',
                marginBottom: '6px',
                fontSize: '11px',
              }}
            >
              <div style={{ color: '#86efac', fontWeight: 600 }}>🤝 {t.title}</div>
            </div>
          ))
        )}

        {/* 3. Bilateral Relations */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', margin: '10px 0 6px 0' }}>
          🌐 BILATERAL RELATIONS
        </div>
        {relations.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' }}>
            At least 2 settlements needed for diplomatic relations.
          </div>
        ) : (
          relations.map((rel, idx) => {
            let statusBadge = (
              <span style={{ color: '#22c55e', fontWeight: 600 }}>Alliance 🤝</span>
            );
            if (rel.status === 'war') {
              statusBadge = <span style={{ color: '#ef4444', fontWeight: 600 }}>At War ⚔️</span>;
            } else if (rel.status === 'tension') {
              statusBadge = <span style={{ color: '#f59e0b', fontWeight: 600 }}>Tension ⚠️</span>;
            } else if (rel.status === 'peace') {
              statusBadge = <span style={{ color: '#94a3b8' }}>Peace 🕊️</span>;
            }

            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  marginBottom: '5px',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {rel.s1Name} ↔ {rel.s2Name}
                  </span>
                  <span>{statusBadge}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '4px',
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    Affinity: {Math.round(rel.score)}/100
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {rel.status !== 'war' && (
                      <button
                        onClick={() => onProvokeWar(rel.s1Id, rel.s2Id)}
                        style={{
                          background: '#7f1d1d',
                          border: 'none',
                          color: '#fecaca',
                          fontSize: '9px',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        Provoke War
                      </button>
                    )}
                    {rel.status !== 'alliance' && rel.status !== 'war' && (
                      <button
                        onClick={() => onFormAlliance(rel.s1Id, rel.s2Id)}
                        style={{
                          background: '#14532d',
                          border: 'none',
                          color: '#bbf7d0',
                          fontSize: '9px',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        Ally
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
