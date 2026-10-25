import React from 'react';
import pantheonEmblem from '../assets/images/god_avatar_pantheon_1790511705368.jpg';
import { TimeState, ResourceSummary } from '../types';

interface TopBarProps {
  time: TimeState;
  agentCount: number;
  births: number;
  deaths: number;
  resources: ResourceSummary;
  societiesCount: number;
  speed: number;
  is25D: boolean;
  weather?: { name: string; icon: string; description: string };
  dominantAge?: { name: string; icon: string; color: string };
}

const TopBarComponent: React.FC<TopBarProps> = ({
  time,
  agentCount,
  births,
  deaths,
  resources,
  societiesCount,
  speed,
  is25D,
  weather,
  dominantAge,
}) => {
  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        padding: '10px 16px',
        borderRadius: '12px',
        fontSize: '13px',
        pointerEvents: 'auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '280px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={pantheonEmblem}
            alt="Pantheon Emblem"
            referrerPolicy="no-referrer"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1px solid rgba(251,191,36,0.6)',
              objectFit: 'cover',
            }}
          />
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              background: 'linear-gradient(135deg, #f43f5e, #fb7185, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aetheria
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {weather && (
            <span
              title={weather.description}
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>{weather.icon}</span>
              <span>{weather.name}</span>
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {is25D ? '2.5D' : '2D'}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '6px 12px',
          marginTop: '2px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Day / Hour:</span>{' '}
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>
            {time.days + 1} : {time.hours}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Agents:</span>{' '}
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{agentCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Births / Deaths:</span>{' '}
          <span style={{ fontWeight: 600 }}>
            <span style={{ color: '#22c55e' }}>{births}</span> /{' '}
            <span style={{ color: '#f43f5e' }}>{deaths}</span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Era:</span>{' '}
          <span
            style={{
              fontWeight: 600,
              color: dominantAge?.color || '#fbbf24',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            {dominantAge ? `${dominantAge.icon} ${dominantAge.name}` : 'Tribal'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Societies:</span>{' '}
          <span style={{ fontWeight: 600, color: '#fbbf24' }}>{societiesCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>Speed:</span>{' '}
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{speed}x</span>
        </div>
        <div
          style={{
            gridColumn: 'span 2',
            display: 'flex',
            gap: '10px',
            fontSize: '11px',
            color: '#cbd5e1',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '5px',
            marginTop: '2px',
          }}
        >
          <span>
            🌾 Food: <b style={{ color: '#f87171' }}>{resources.food}</b>
          </span>
          <span>
            🌲 Wood: <b style={{ color: '#4ade80' }}>{resources.wood}</b>
          </span>
          <span>
            ⛏️ Ore: <b style={{ color: '#cbd5e1' }}>{resources.ore}</b>
          </span>
          <span>
            💧 Water: <b style={{ color: '#38bdf8' }}>{resources.water}</b>
          </span>
        </div>
      </div>
    </div>
  );
};

export const TopBar = React.memo(TopBarComponent);
