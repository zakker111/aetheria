import React from 'react';
import gameBanner from '../assets/images/aetheria_game_banner_1790511715234.jpg';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          padding: '16px 20px',
          borderRadius: '16px',
          fontSize: '12px',
          maxWidth: '380px',
          width: '90vw',
          color: '#cbd5e1',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
      <img
        src={gameBanner}
        alt="Aetheria 2.5D Realm"
        referrerPolicy="no-referrer"
        style={{
          width: '100%',
          borderRadius: '8px',
          marginBottom: '10px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      />
      <h3
        style={{
          marginBottom: '6px',
          color: '#f43f5e',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Divine Instructions</span>
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
      </h3>
      <div style={{ margin: '3px 0' }}>
        • <b>2.5D Isometric World:</b> Full 3D elevated terrain with realistic mountains, valleys & flowing rivers.
      </div>
      <div style={{ margin: '3px 0' }}>
        • <b>Heights Control:</b> Tap <b>⛰️ Heights</b> to switch between relief levels.
      </div>
      <div style={{ margin: '3px 0' }}>
        • <b>View Toggle:</b> Switch between <b>📐 2.5D Isometric</b> and <b>🗺️ 2D View</b> anytime.
      </div>
      <div style={{ margin: '3px 0' }}>• <b>Drag</b> mouse to pan across the 128×128 realm</div>
      <div style={{ margin: '3px 0' }}>• <b>Scroll wheel</b> to zoom in and out</div>
      <div style={{ margin: '3px 0' }}>• <b>Click</b> with tool selected to act, build or cast miracles</div>
      <div style={{ margin: '3px 0' }}>• <b>Keys 1-0</b> for rapid tool switching</div>
      <div style={{ margin: '3px 0' }}>• <b>Spacebar</b> to pause / resume time</div>
      <div style={{ margin: '3px 0' }}>• Click <b>Inspect</b> and tap any citizen, building, or realm</div>
      </div>
    </div>
  );
};
