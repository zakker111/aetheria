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
        • <b>2.5D Isometric World &amp; Ecology:</b> Elevated terrain with growing forests (Sapling → Ancient), finite depleting ore mines, and wild herds stalked by settlement Hunters.
      </div>
      <div style={{ margin: '3px 0' }}>
        • <b>Mechanized Warfare &amp; Structures:</b> Build Granaries, Factories, Research Labs, Nuclear Plants &amp; Missile Silos; fight with siege catapults, Battle Tanks, Strike Aircraft, and Rocket Artillery.
      </div>
      <div style={{ margin: '3px 0' }}>
        • <b>Atomic Deterrence &amp; Infrastructure:</b> Warhead enrichment requires a <b>Factory + Nuclear Plant + Ore</b> (boosted by Labs &amp; Silos); autonomous nukes fire only as a last resort.
      </div>
      <div style={{ margin: '3px 0' }}>
        • <b>Deep Diplomacy (W):</b> Scarcity Trade &amp; Non-Aggression Pacts, nuclear proliferation sanctions, ultimatums, Tributary Vassalage, and third-party Peace Mediation.
      </div>
      <div style={{ margin: '3px 0' }}>
        • <b>Spectator Controls:</b> Use <b>⚔️ Next Battle</b> to jump to active fronts, or inspect citizens, buildings, and mines for live stats &amp; Follow camera.
      </div>
      <div style={{ margin: '3px 0' }}>• <b>Drag</b> map to pan · <b>Scroll wheel</b> to zoom · <b>Keys 1-0</b> for tools · <b>Spacebar</b> pause/resume</div>
      </div>
    </div>
  );
};
