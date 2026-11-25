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
  onReturnToMenu?: () => void;
}

const baseBtn =
  'px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-200 cursor-pointer text-[11.5px] font-medium min-h-[30px] transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 hover:bg-slate-700';

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
  onReturnToMenu,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="bg-slate-900/88 backdrop-blur-md border border-white/12 px-2.5 py-1.5 rounded-xl flex items-center justify-start md:justify-end gap-1.5 pointer-events-auto shadow-xl flex-wrap max-w-full">
      <button
        className={`${baseBtn} ${
          is25D
            ? 'bg-sky-400/20 border-sky-400/50 text-sky-400 hover:bg-sky-400/30'
            : 'text-slate-400'
        }`}
        onClick={onToggleView}
        title="Switch between 2.5D Isometric and 2D Top-Down"
      >
        {is25D ? '📐 2.5D View' : '🗺️ 2D View'}
      </button>

      <button className={baseBtn} onClick={onCycleHeight} title="Cycle terrain 3D heights">
        ⛰️ {heightScaleLabel}
      </button>

      <button className={baseBtn} onClick={onTogglePause}>
        {isPaused ? '▶️ Play' : '⏸️ Pause'}
      </button>

      <button className={baseBtn} onClick={onCycleSpeed}>
        ⚡ Speed ({speed}x)
      </button>

      <button className={baseBtn} onClick={onCenterCamera} title="Center on civilization">
        🎯 Center
      </button>

      {onNextBattle && (
        <button
          className={`${baseBtn} bg-red-500/22 border-red-500/45 text-red-200 hover:bg-red-500/30`}
          onClick={onNextBattle}
          title="Jump camera to next active battle, siege, or blast site"
        >
          ⚔️ Next Battle
        </button>
      )}

      <button
        className={`${baseBtn} bg-green-500/25 border-green-500/50 text-green-300 hover:bg-green-500/35`}
        onClick={onSpawnResources}
        title="Spawn Wood, Water & Ore across the map"
      >
        🌱 Spawn Resources
      </button>

      <button
        className={`${baseBtn} ${societiesOpen ? 'bg-slate-700 border-sky-400' : ''}`}
        onClick={onToggleSocieties}
        title="Toggle Societies List"
      >
        🏛️ Societies
      </button>

      <button
        className={`${baseBtn} font-mono-tabular ${
          diplomacyOpen
            ? 'bg-slate-700 border-red-500'
            : warsCount > 0
              ? 'bg-red-500/16 border-red-500/50'
              : ''
        }`}
        onClick={onToggleDiplomacy}
        title="Toggle Diplomacy, Wars, Alliances & Treaties (W)"
      >
        ⚔️ Diplomacy
        {(warsCount > 0 || treatiesCount > 0) && (
          <span className={`text-[10px] font-bold ${warsCount > 0 ? 'text-red-300' : 'text-green-300'}`}>
            ({warsCount > 0 ? `${warsCount}⚔️` : ''}
            {warsCount > 0 && treatiesCount > 0 ? ' ' : ''}
            {treatiesCount > 0 ? `${treatiesCount}🤝` : ''})
          </span>
        )}
      </button>

      {onToggleCivilization && (
        <button
          className={`${baseBtn} text-amber-400 ${
            civilizationOpen ? 'bg-amber-500/25 border-amber-500' : 'border-amber-500/40'
          }`}
          onClick={onToggleCivilization}
          title="Open Full-Screen Civilization, Dynasties, Wonders & War Room (C)"
        >
          👑 Chancellery
        </button>
      )}

      <button className={baseBtn} onClick={onSave} title="Save world state to storage">
        💾 Save
      </button>

      <button className={baseBtn} onClick={onLoad} title="Load world state from storage">
        📂 Load
      </button>

      {onExportWorld && (
        <button className={baseBtn} onClick={onExportWorld} title="Export full world snapshot as JSON">
          Export JSON
        </button>
      )}

      {onImportWorld && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportWorld(file);
              e.target.value = '';
            }}
          />
          <button
            className={baseBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Import exported world JSON snapshot"
          >
            Import JSON
          </button>
        </>
      )}

      {onToggleMute && (
        <button
          className={`${baseBtn} ${
            isMuted ? 'text-slate-400 border-slate-700' : 'text-sky-400 border-sky-400/40'
          }`}
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
          className={`${baseBtn} ${
            scenario === 'modern_nuclear'
              ? 'bg-lime-500/16 border-lime-500/50 text-lime-300'
              : 'bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          <option value="warring" className="bg-slate-900 text-slate-50">
            ⚔️ Tribal Kingdoms
          </option>
          <option value="modern_nuclear" className="bg-slate-900 text-slate-50">
            ☢️ Modern &amp; Nuclear
          </option>
        </select>
      )}

      <button className={baseBtn} onClick={onToggleHelp} title="Divine Instructions Guide">
        ❓ Guide
      </button>

      {onReturnToMenu && (
        <button
          className={`${baseBtn} border-slate-400/35 text-slate-300`}
          onClick={onReturnToMenu}
          title="Return to Title Screen (New Game / Continue)"
        >
          🏠 Menu
        </button>
      )}
    </div>
  );
};
