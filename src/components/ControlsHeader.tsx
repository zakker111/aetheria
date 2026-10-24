import React from 'react';

interface ControlsHeaderProps {
  is25D: boolean;
  heightScaleLabel: string;
  isPaused: boolean;
  speed: number;
  scenario: string | null;
  onToggleScenario: () => void;
  onToggleView: () => void;
  onCycleHeight: () => void;
  onTogglePause: () => void;
  onCycleSpeed: () => void;
  onCenterCamera: () => void;
  onSpawnResources: () => void;
  onToggleSocieties: () => void;
  onToggleDiplomacy: () => void;
  onSave: () => void;
  onLoad: () => void;
  onToggleHelp: () => void;
  societiesOpen: boolean;
  diplomacyOpen: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const ControlsHeader: React.FC<ControlsHeaderProps> = ({
  is25D,
  heightScaleLabel,
  isPaused,
  speed,
  scenario,
  onToggleScenario,
  onToggleView,
  onCycleHeight,
  onTogglePause,
  onCycleSpeed,
  onCenterCamera,
  onSpawnResources,
  onToggleSocieties,
  onToggleDiplomacy,
  onSave,
  onLoad,
  onToggleHelp,
  societiesOpen,
  diplomacyOpen,
  isMuted = false,
  onToggleMute,
}) => {
  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };

  const isWarring = scenario === 'warring';

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        padding: '8px 12px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        flexWrap: 'wrap',
      }}
    >
      <button
        style={{
          ...buttonStyle,
          background: is25D ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
          borderColor: is25D ? 'rgba(56, 189, 248, 0.5)' : '#334155',
          color: is25D ? '#38bdf8' : '#94a3b8',
        }}
        onClick={onToggleView}
        title="Switch between 2.5D Isometric and 2D Top-Down"
      >
        {is25D ? '📐 2.5D View' : '🗺️ 2D View'}
      </button>

      <button style={buttonStyle} onClick={onCycleHeight} title="Cycle terrain 3D heights">
        ⛰️ {heightScaleLabel}
      </button>

      <button style={buttonStyle} onClick={onTogglePause}>
        {isPaused ? '▶️ Play' : '⏸️ Pause'}
      </button>

      <button style={buttonStyle} onClick={onCycleSpeed}>
        ⚡ Speed ({speed}x)
      </button>

      <button style={buttonStyle} onClick={onCenterCamera} title="Center on civilization">
        🎯 Center
      </button>

      <button
        style={{
          ...buttonStyle,
          background: isWarring ? 'rgba(239, 68, 68, 0.25)' : '#1e293b',
          borderColor: isWarring ? '#ef4444' : '#475569',
          color: isWarring ? '#fca5a5' : '#e2e8f0',
        }}
        onClick={onToggleScenario}
        title={
          isWarring
            ? 'Warring Kingdoms active (hereditary rivals, instant war). Click to switch to normal world.'
            : 'Switch to Warring Kingdoms scenario (founding towns are hereditary rivals with fast warfare)'
        }
      >
        {isWarring ? '⚔️ Warring: ON' : '⚔️ Warring Scenario'}
      </button>

      <button
        style={{
          ...buttonStyle,
          background: 'rgba(34, 197, 94, 0.25)',
          borderColor: 'rgba(34, 197, 94, 0.5)',
          color: '#86efac',
        }}
        onClick={onSpawnResources}
        title="Spawn Wood, Water & Ore across the map"
      >
        🌱 Spawn Resources
      </button>

      <button
        style={{
          ...buttonStyle,
          background: societiesOpen ? '#334155' : '#1e293b',
          borderColor: societiesOpen ? '#38bdf8' : '#334155',
        }}
        onClick={onToggleSocieties}
        title="Toggle Societies List"
      >
        🏛️ Societies
      </button>

      <button
        style={{
          ...buttonStyle,
          background: diplomacyOpen ? '#334155' : '#1e293b',
          borderColor: diplomacyOpen ? '#ef4444' : '#334155',
        }}
        onClick={onToggleDiplomacy}
        title="Toggle Diplomacy & Treaties"
      >
        ⚔️ Diplomacy
      </button>

      <button style={buttonStyle} onClick={onSave} title="Save world state to local storage">
        💾 Save
      </button>

      <button style={buttonStyle} onClick={onLoad} title="Load world state from local storage">
        📂 Load
      </button>

      {onToggleMute && (
        <button
          style={{
            ...buttonStyle,
            color: isMuted ? '#94a3b8' : '#38bdf8',
            borderColor: isMuted ? '#334155' : 'rgba(56, 189, 248, 0.4)',
          }}
          onClick={onToggleMute}
          title={isMuted ? 'Sound Muted. Click to enable WebAudio SFX' : 'Sound Enabled. Click to mute'}
        >
          {isMuted ? '🔇 Muted' : '🔊 Sound'}
        </button>
      )}

      <button style={buttonStyle} onClick={onToggleHelp} title="Divine Instructions Guide">
        ❓ Guide
      </button>
    </div>
  );
};
