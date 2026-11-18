import React from 'react';

interface ControlsHeaderProps {
  is25D: boolean;
  heightScaleLabel: string;
  isPaused: boolean;
  speed: number;
  onToggleView: () => void;
  onCycleHeight: () => void;
  onTogglePause: () => void;
  onCycleSpeed: () => void;
  onCenterCamera: () => void;
  onNextBattle?: () => void;
  onSpawnResources: () => void;
  onToggleSocieties: () => void;
  onToggleDiplomacy: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExportWorld?: () => void;
  onImportWorld?: (file: File) => void;
  onToggleHelp: () => void;
  societiesOpen: boolean;
  diplomacyOpen: boolean;
  civilizationOpen?: boolean;
  onToggleCivilization?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  warsCount?: number;
  treatiesCount?: number;
  scenario?: 'modern_nuclear' | 'warring';
  onChangeScenario?: (next: 'modern_nuclear' | 'warring') => void;
}

export const ControlsHeader: React.FC<ControlsHeaderProps> = ({
  is25D,
  heightScaleLabel,
  isPaused,
  speed,
  onToggleView,
  onCycleHeight,
  onTogglePause,
  onCycleSpeed,
  onCenterCamera,
  onNextBattle,
  onSpawnResources,
  onToggleSocieties,
  onToggleDiplomacy,
  onSave,
  onLoad,
  onExportWorld,
  onImportWorld,
  onToggleHelp,
  societiesOpen,
  diplomacyOpen,
  civilizationOpen = false,
  onToggleCivilization,
  isMuted = false,
  onToggleMute,
  warsCount = 0,
  treatiesCount = 0,
  scenario = 'warring',
  onChangeScenario,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
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
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

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

      {onNextBattle && (
        <button
          style={{
            ...buttonStyle,
            background: 'rgba(239, 68, 68, 0.22)',
            borderColor: 'rgba(239, 68, 68, 0.45)',
            color: '#fecaca',
          }}
          onClick={onNextBattle}
          title="Jump camera to next active battle, siege, or blast site"
        >
          ⚔️ Next Battle
        </button>
      )}

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
          background: diplomacyOpen ? '#334155' : (warsCount > 0 ? 'rgba(239, 68, 68, 0.16)' : '#1e293b'),
          borderColor: diplomacyOpen ? '#ef4444' : (warsCount > 0 ? 'rgba(239, 68, 68, 0.5)' : '#334155'),
          fontVariantNumeric: 'tabular-nums',
        }}
        onClick={onToggleDiplomacy}
        title="Toggle Diplomacy, Wars, Alliances & Treaties (W)"
      >
        ⚔️ Diplomacy
        {(warsCount > 0 || treatiesCount > 0) && (
          <span style={{ fontSize: '10px', color: warsCount > 0 ? '#fca5a5' : '#86efac', fontWeight: 700 }}>
            ({warsCount > 0 ? `${warsCount}⚔️` : ''}{warsCount > 0 && treatiesCount > 0 ? ' ' : ''}{treatiesCount > 0 ? `${treatiesCount}🤝` : ''})
          </span>
        )}
      </button>

      {onToggleCivilization && (
        <button
          style={{
            ...buttonStyle,
            background: civilizationOpen ? 'rgba(245, 158, 11, 0.25)' : '#1e293b',
            borderColor: civilizationOpen ? '#f59e0b' : 'rgba(245, 158, 11, 0.4)',
            color: '#fbbf24',
          }}
          onClick={onToggleCivilization}
          title="Open Full-Screen Civilization, Dynasties, Wonders & War Room (C)"
        >
          👑 Chancellery
        </button>
      )}

      <button style={buttonStyle} onClick={onSave} title="Save world state to local storage">
        💾 Save
      </button>

      <button style={buttonStyle} onClick={onLoad} title="Load world state from local storage">
        📂 Load
      </button>

      {onExportWorld && (
        <button style={buttonStyle} onClick={onExportWorld} title="Export full world snapshot as JSON">
          Export JSON
        </button>
      )}

      {onImportWorld && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportWorld(file);
              e.target.value = '';
            }}
          />
          <button
            style={buttonStyle}
            onClick={() => fileInputRef.current?.click()}
            title="Import exported world JSON snapshot"
          >
            Import JSON
          </button>
        </>
      )}

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

      {onChangeScenario && (
        <select
          value={scenario}
          onChange={(e) => onChangeScenario(e.target.value as 'modern_nuclear' | 'warring')}
          title="Start a fresh world in Modern & Nuclear Age or Tribal Warring Kingdoms"
          style={{
            ...buttonStyle,
            background: scenario === 'modern_nuclear' ? 'rgba(132, 204, 22, 0.16)' : '#1e293b',
            borderColor: scenario === 'modern_nuclear' ? 'rgba(132, 204, 22, 0.5)' : '#334155',
            color: scenario === 'modern_nuclear' ? '#bef264' : '#e2e8f0',
          }}
        >
          <option value="warring" style={{ background: '#0f172a', color: '#f8fafc' }}>
            ⚔️ Tribal Kingdoms
          </option>
          <option value="modern_nuclear" style={{ background: '#0f172a', color: '#f8fafc' }}>
            ☢️ Modern &amp; Nuclear
          </option>
        </select>
      )}

      <button style={buttonStyle} onClick={onToggleHelp} title="Divine Instructions Guide">
        ❓ Guide
      </button>
    </div>
  );
};
