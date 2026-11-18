import React, { useState } from 'react';
import { DiplomaticLogEntry, RelationSummary, TreatySummary, WarSummary } from '../types';

interface DiplomacyPanelProps {
  wars: WarSummary[];
  treaties: TreatySummary[];
  relations: RelationSummary[];
  diplomaticHistory?: DiplomaticLogEntry[];
  onSignPeace: (s1: number, s2: number) => void;
  onEnforceAllPeace: () => void;
  onProvokeWar: (s1: number, s2: number) => void;
  onFormAlliance: (s1: number, s2: number) => void;
  onImposeSanctions?: (fromId: number, targetId: number) => void;
  onIssueUltimatum?: (fromId: number, targetId: number, demand?: string) => void;
  onLaunchNuke?: (attackerId: number, targetId: number) => void;
  onLaunchSpyOp?: (fromId: number, targetId: number, opType?: string) => void;
  onPanTo?: (x: number, y: number) => void;
  onClose: () => void;
}

type DiploTab = 'wars' | 'why' | 'relations';

const DiplomacyPanelComponent: React.FC<DiplomacyPanelProps> = ({
  wars,
  treaties,
  relations,
  diplomaticHistory = [],
  onSignPeace,
  onEnforceAllPeace,
  onProvokeWar,
  onFormAlliance,
  onImposeSanctions,
  onIssueUltimatum,
  onLaunchNuke,
  onLaunchSpyOp,
  onPanTo,
  onClose,
}) => {
  const [tab, setTab] = useState<DiploTab>('wars');

  const tabStyle = (t: DiploTab): React.CSSProperties => ({
    flex: 1,
    padding: '4px 6px',
    borderRadius: '5px',
    border: 'none',
    background: tab === t ? '#38bdf8' : 'transparent',
    color: tab === t ? '#0f172a' : '#94a3b8',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  });

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '12px 14px',
        pointerEvents: 'auto',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        fontSize: '12px',
        maxHeight: '340px',
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
        }}
      >
        <span>⚔️ Diplomacy & Geopolitics</span>
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

      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(30, 41, 59, 0.7)',
          padding: '3px',
          borderRadius: '7px',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        <button style={tabStyle('wars')} onClick={() => setTab('wars')}>
          Wars ({wars.length})
        </button>
        <button style={tabStyle('why')} onClick={() => setTab('why')}>
          Events & Why ({diplomaticHistory.length})
        </button>
        <button style={tabStyle('relations')} onClick={() => setTab('relations')}>
          Realms ({relations.length})
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {tab === 'wars' && (
          <>
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
              <span>⚔️ ACTIVE CONFLICTS ({wars.length})</span>
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
                    whiteSpace: 'nowrap',
                  }}
                >
                  Enforce Peace
                </button>
              )}
            </div>

            {wars.length === 0 ? (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '6px', fontStyle: 'italic' }}>
                  🕊️ No active wars right now.
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
                      border: '1px solid rgba(239, 68, 68, 0.35)',
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
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span>
                        {w.totalWar ? '🔥 ' : '⚔️ '}
                        {w.attackerName} vs {w.defenderName}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        {w.totalWar && (
                          <span style={{ fontSize: '9px', color: '#fecaca', background: 'rgba(185, 28, 28, 0.65)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            TOTAL WAR
                          </span>
                        )}
                        {w.warScore != null && (
                          <span style={{ fontSize: '10px', color: '#fde68a' }}>
                            Score {w.warScore > 0 ? `+${w.warScore}` : w.warScore}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px' }}>
                      {w.casusBelli}
                    </div>
                    {w.whySummary && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                        Why: {w.whySummary}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#f87171', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                      Fallen: {w.attackerName} {casualtiesA} · {w.defenderName} {casualtiesD}
                    </div>
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

            <div style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', margin: '8px 0 4px' }}>
              🤝 ALLIANCES ({treaties.length})
            </div>
            {treaties.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>No active defensive pacts.</div>
            ) : (
              treaties.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    marginBottom: '4px',
                    fontSize: '11px',
                    color: '#86efac',
                  }}
                >
                  🤝 {t.title}
                </div>
              ))
            )}
          </>
        )}

        {tab === 'why' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {diplomaticHistory.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                No diplomatic crises, ultimatums, or strikes logged yet.
              </div>
            ) : (
              diplomaticHistory.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    background: ev.type === 'nuclear_strike' || ev.type === 'nuke' || ev.type === 'proliferation'
                      ? 'rgba(132, 204, 22, 0.12)'
                      : ev.type === 'war' || ev.type === 'betrayal'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '7px',
                    padding: '7px 8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px', color: '#f8fafc' }}>{ev.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                        T{ev.tick}
                      </span>
                      {onPanTo && typeof ev.x === 'number' && typeof ev.y === 'number' && (
                        <button
                          onClick={() => onPanTo(ev.x as number, ev.y as number)}
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: 'none',
                            color: '#38bdf8',
                            borderRadius: '3px',
                            fontSize: '9px',
                            padding: '1px 5px',
                            cursor: 'pointer',
                          }}
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#e2e8f0', marginTop: '2px' }}>{ev.what}</div>
                  <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '2px' }}>
                    Why: {ev.why}
                  </div>
                  {ev.drivers && ev.drivers.length > 0 && (
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                      {ev.drivers.join(' · ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'relations' && (
          <>
            {relations.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                At least 2 settlements needed for diplomacy.
              </div>
            ) : (
              relations.map((rel, idx) => {
                let statusLabel = <span style={{ color: '#22c55e', fontWeight: 600 }}>Alliance 🤝</span>;
                if (rel.status === 'war') statusLabel = <span style={{ color: '#ef4444', fontWeight: 600 }}>At War ⚔️</span>;
                else if (rel.status === 'tension') statusLabel = <span style={{ color: '#f59e0b', fontWeight: 600 }}>Tension ⚠️</span>;
                else if (rel.status === 'peace') statusLabel = <span style={{ color: '#94a3b8' }}>Peace 🕊️</span>;

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(30, 41, 59, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      marginBottom: '6px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{rel.s1Name} ↔ {rel.s2Name}</span>
                      <span>{statusLabel}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      Affinity: {Math.round(rel.score)}/100
                      {rel.sanctioned ? ' · 🚫 Embargoed' : ''}
                      {((rel.s1Warheads || 0) > 0 || (rel.s2Warheads || 0) > 0) &&
                        ` · ☢️ ${rel.s1Warheads || 0}:${rel.s2Warheads || 0}`}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
                      {rel.status !== 'war' && (
                        <>
                          <button
                            onClick={() => onProvokeWar(rel.s1Id, rel.s2Id)}
                            style={{ background: '#7f1d1d', border: 'none', color: '#fecaca', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                          >
                            Provoke War
                          </button>
                          {onImposeSanctions && !rel.sanctioned && (
                            <button
                              onClick={() => onImposeSanctions(rel.s1Id, rel.s2Id)}
                              style={{ background: '#78350f', border: 'none', color: '#fde68a', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              Sanction
                            </button>
                          )}
                          {onIssueUltimatum && (
                            <button
                              onClick={() => onIssueUltimatum(rel.s1Id, rel.s2Id, 'tribute')}
                              style={{ background: '#334155', border: 'none', color: '#e2e8f0', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              Ultimatum
                            </button>
                          )}
                        </>
                      )}
                      {rel.status !== 'alliance' && rel.status !== 'war' && (
                        <button
                          onClick={() => onFormAlliance(rel.s1Id, rel.s2Id)}
                          style={{ background: '#14532d', border: 'none', color: '#bbf7d0', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          Ally
                        </button>
                      )}
                      {onLaunchSpyOp && (
                        <button
                          onClick={() => onLaunchSpyOp(rel.s1Id, rel.s2Id, 'sabotage_granary')}
                          style={{ background: '#312e81', border: '1px solid rgba(165, 180, 252, 0.35)', color: '#e0e7ff', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          Spy Sabotage
                        </button>
                      )}
                      {onLaunchNuke && (rel.s1Warheads || 0) > 0 && (
                        <button
                          onClick={() => onLaunchNuke(rel.s1Id, rel.s2Id)}
                          style={{ background: '#3f6212', border: '1px solid #84cc16', color: '#ecfccb', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          ☢️ Strike {rel.s2Name}
                        </button>
                      )}
                      {onLaunchNuke && (rel.s2Warheads || 0) > 0 && (
                        <button
                          onClick={() => onLaunchNuke(rel.s2Id, rel.s1Id)}
                          style={{ background: '#3f6212', border: '1px solid #84cc16', color: '#ecfccb', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}
                        >
                          ☢️ Strike {rel.s1Name}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const DiplomacyPanel = React.memo(DiplomacyPanelComponent);
