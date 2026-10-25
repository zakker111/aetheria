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
        maxHeight: '260px',
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
        <span>🏛️ Societies & Settlements</span>
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
        {settlements.length === 0 ? (
          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
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
              <div
                key={s.id}
                onClick={() => onSelectSettlement(s)}
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  marginBottom: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(51, 65, 85, 0.8)';
                  e.currentTarget.style.borderColor = '#38bdf8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: '#fbbf24',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    {s.tierIcon || '🏡'} {s.name}{' '}
                    <small style={{ fontSize: '10px', opacity: 0.8 }}>({s.tier || 'Village'})</small>
                  </span>
                  <span style={{ color: '#22c55e' }}>{s.population} citizens</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{leader} • {s.buildingsCount} structures{cultureTag}</span>
                  {s.age && (
                    <span style={{ fontSize: '10px', color: s.age.color || '#38bdf8', fontWeight: 600 }}>
                      {s.age.icon} {s.age.name}
                    </span>
                  )}
                </div>
                {s.age?.monumentName && (
                  <div style={{ color: '#38bdf8', fontSize: '10px', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Wonder: {s.age.monumentName}</span>
                    <span style={{ fontWeight: 600 }}>{s.age.hasMonument ? '✅ Complete' : `${s.age.monumentProgress || 0}%`}</span>
                  </div>
                )}
                <div style={{ color: '#cbd5e1', fontSize: '10px', marginTop: '2px' }}>
                  Stockpile: 🌾 {s.stockpile?.food || 0} | 🌲 {s.stockpile?.wood || 0} | ⛏️{' '}
                  {s.stockpile?.ore || 0}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const SocietiesPanel = React.memo(SocietiesPanelComponent);
