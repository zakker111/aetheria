import React, { useRef, useState } from 'react';
import gameBanner from '../assets/images/aetheria_game_banner_1790511715234.jpg';
import pantheonEmblem from '../assets/images/god_avatar_pantheon_1790511705368.jpg';

export interface SavedWorldMeta {
  exists: boolean;
  days: number;
  settlementsCount: number;
  agentsCount: number;
  scenario: 'warring' | 'modern_nuclear';
}

interface StartScreenProps {
  version: string;
  selectedScenario: 'warring' | 'modern_nuclear';
  onSelectScenario: (scenario: 'warring' | 'modern_nuclear') => void;
  savedMeta: SavedWorldMeta | null;
  onPlayNewGame: (scenario: 'warring' | 'modern_nuclear') => void;
  onContinueSavedGame: () => void;
  onImportWorldFile: (file: File) => Promise<boolean> | void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  version,
  selectedScenario,
  onSelectScenario,
  savedMeta,
  onPlayNewGame,
  onContinueSavedGame,
  onImportWorldFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bannerFailed, setBannerFailed] = useState(false);

  const hasValidSave = Boolean(savedMeta && savedMeta.exists);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aetheria-start-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_50%_35%,rgba(15,23,42,0.72)_0%,rgba(9,14,28,0.90)_100%)] backdrop-blur-sm pointer-events-auto"
    >
      <div className="w-full max-w-[1040px] max-h-[calc(100vh-32px)] sm:max-h-[calc(100vh-48px)] overflow-y-auto bg-slate-900/95 border border-slate-400/20 rounded-2xl p-5 sm:px-9 sm:py-8 shadow-[0_24px_64px_rgba(0,0,0,0.65)] text-slate-100 flex flex-col gap-6">
        {/* Main Two-Column Desktop Split (stacks cleanly on narrow screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.96fr] gap-6 lg:gap-8 items-stretch">
          {/* Left Column: Title, Version, Brief Explanation & Primary Actions */}
          <div className="flex flex-col justify-between gap-5">
            <div>
              {/* Quiet Unboxed Metadata Header */}
              <div className="flex items-center gap-2.5 text-[13px] text-slate-400 mb-3 font-mono-tabular">
                <img
                  src={pantheonEmblem}
                  alt="Aetheria crest"
                  referrerPolicy="no-referrer"
                  className="w-[26px] h-[26px] rounded-md object-cover border border-amber-400/45 shrink-0"
                />
                <span>Version {version}</span>
                <span aria-hidden="true">·</span>
                <span>2.5D Emergent Civilization Simulator</span>
              </div>

              <h1
                id="aetheria-start-title"
                className="font-display text-[clamp(2.25rem,3.8vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-slate-50 text-balance mb-3.5"
              >
                Aetheria
              </h1>

              <p className="text-[15px] leading-relaxed text-slate-300 max-w-[58ch]">
                Observe and guide autonomous civilizations across a living 2.5D isometric
                world. Watch citizens harvest growing forests and finite ore veins, build
                fortified cities, conduct diplomacy, and advance from Tribal Kingdoms into
                the Modern &amp; Nuclear Age—or intervene directly with divine powers.
              </p>
            </div>

            {/* Starting Era Preset */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2">
                Starting World Preset
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onSelectScenario('warring')}
                  className={`text-left px-3.5 py-2.5 rounded-[10px] border text-slate-50 cursor-pointer transition-colors ${
                    selectedScenario === 'warring'
                      ? 'border-sky-400 bg-sky-400/14'
                      : 'border-slate-400/18 bg-slate-800/55 hover:border-slate-400/35'
                  }`}
                >
                  <div
                    className={`text-[13px] font-bold ${
                      selectedScenario === 'warring' ? 'text-sky-300' : 'text-slate-100'
                    }`}
                  >
                    ⚔️ Tribal Kingdoms
                  </div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5 leading-snug">
                    Default Era 1 start · Evolve naturally through all 7 ages
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectScenario('modern_nuclear')}
                  className={`text-left px-3.5 py-2.5 rounded-[10px] border text-slate-50 cursor-pointer transition-colors ${
                    selectedScenario === 'modern_nuclear'
                      ? 'border-lime-400 bg-lime-500/12'
                      : 'border-slate-400/18 bg-slate-800/55 hover:border-slate-400/35'
                  }`}
                >
                  <div
                    className={`text-[13px] font-bold ${
                      selectedScenario === 'modern_nuclear' ? 'text-lime-300' : 'text-slate-100'
                    }`}
                  >
                    ☢️ Modern &amp; Nuclear
                  </div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5 leading-snug">
                    Era 7 sandbox · Tanks, aircraft, atomic deterrence &amp; total war
                  </div>
                </button>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => onPlayNewGame(selectedScenario)}
                  className="flex-1 min-w-[200px] min-h-[44px] px-5 py-2.5 rounded-[10px] border border-rose-400/65 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer whitespace-nowrap shadow-[0_8px_20px_rgba(225,29,72,0.3)] transition-colors"
                >
                  Play New Game
                </button>

                <button
                  type="button"
                  disabled={!hasValidSave}
                  onClick={onContinueSavedGame}
                  title={
                    hasValidSave
                      ? 'Resume your most recent local save'
                      : 'Save a world in-game to enable Continue'
                  }
                  className={`flex-1 min-w-[200px] min-h-[44px] px-5 py-2.5 rounded-[10px] border text-sm font-semibold whitespace-nowrap transition-colors ${
                    hasValidSave
                      ? 'border-sky-400/50 bg-cyan-700/35 hover:bg-cyan-700/50 text-sky-100 cursor-pointer'
                      : 'border-slate-400/16 bg-slate-800/45 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Continue Saved Game
                </button>
              </div>

              {/* Save status + JSON import */}
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400 font-mono-tabular pt-0.5 flex-wrap">
                <span>
                  {hasValidSave && savedMeta ? (
                    <>
                      Saved World: Day {savedMeta.days + 1} · {savedMeta.settlementsCount}{' '}
                      societies · {savedMeta.agentsCount} citizens ·{' '}
                      {savedMeta.scenario === 'modern_nuclear'
                        ? 'Modern & Nuclear'
                        : 'Tribal Kingdoms'}
                    </>
                  ) : (
                    'No local save found yet — start a new world or import a JSON snapshot.'
                  )}
                </span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportWorldFile(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-transparent border-0 text-sky-400 hover:text-sky-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 px-1.5 py-1"
                >
                  Import Save (.json)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: World Artwork & Core Pillars */}
          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-xl overflow-hidden border border-slate-400/20 bg-gradient-to-br from-slate-800 to-slate-900 aspect-video relative">
              {!bannerFailed ? (
                <img
                  src={gameBanner}
                  alt="Aetheria 2.5D isometric kingdoms, rivers, bridges, and harbors"
                  referrerPolicy="no-referrer"
                  onError={() => setBannerFailed(true)}
                  className="w-full h-full object-cover block"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[13px]">
                  2.5D Isometric World Preview
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/10 to-transparent pointer-events-none" />
            </div>

            {/* 3 Concise Pillars separated by hairline dividers */}
            <div className="flex flex-col gap-3 pt-1">
              <div className="border-b border-slate-400/12 pb-2.5">
                <div className="text-[13px] font-bold text-slate-50 mb-0.5">
                  Living Ecology &amp; Multi-Tier Economy
                </div>
                <div className="text-xs text-slate-400 leading-normal">
                  Trees grow from saplings to ancient groves, ore veins exhaust permanently,
                  and hunters track roaming wildlife to supply workshops and granaries.
                </div>
              </div>

              <div className="border-b border-slate-400/12 pb-2.5">
                <div className="text-[13px] font-bold text-slate-50 mb-0.5">
                  Dynasties, Diplomacy &amp; Combined-Arms War
                </div>
                <div className="text-xs text-slate-400 leading-normal">
                  Trade and non-aggression pacts, proliferation sanctions, vassalage, siege
                  breaches, tanks, strike aircraft, and last-resort nuclear deterrence.
                </div>
              </div>

              <div>
                <div className="text-[13px] font-bold text-slate-50 mb-0.5">
                  Inspect, Follow &amp; Intervene
                </div>
                <div className="text-xs text-slate-400 leading-normal">
                  Click any citizen, mine, or city for live telemetry, follow individual
                  lives, shape the world with divine tools, or save &amp; export JSON snapshots.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Desktop Controls Footer */}
        <div className="border-t border-slate-400/12 pt-3.5 flex justify-between items-center flex-wrap gap-3 text-xs text-slate-400">
          <span>
            Desktop Controls: Drag map to pan · Mouse wheel to zoom · Keys 1–0 select tools ·
            Space pause/resume
          </span>
          <span>W Diplomacy · C Chancellery · Left-click any entity to inspect</span>
        </div>
      </div>
    </div>
  );
};
