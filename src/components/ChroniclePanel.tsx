import React from 'react';

interface ChroniclePanelProps {
  events: string[];
}

const ChroniclePanelComponent: React.FC<ChroniclePanelProps> = ({ events }) => {
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
        maxHeight: '180px',
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
        <span>📜 World Chronicle</span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', maxHeight: '130px' }}>
        {events.length === 0 ? (
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
