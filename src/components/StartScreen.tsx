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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at 50% 35%, rgba(15, 23, 42, 0.72) 0%, rgba(9, 14, 28, 0.90) 100%)',
        backdropFilter: 'blur(6px)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1040px',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '16px',
          padding: '32px 36px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65)',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Main Two-Column Desktop Split */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.12fr) minmax(0, 0.96fr)',
            gap: '32px',
            alignItems: 'stretch',
          }}
        >
          {/* Left Column: Title, Version, Brief Explanation & Primary Actions */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '20px',
            }}
          >
            <div>
              {/* Quiet Unboxed Metadata Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#94a3b8',
                  marginBottom: '12px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <img
                  src={pantheonEmblem}
                  alt="Aetheria crest"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                    border: '1px solid rgba(251, 191, 36, 0.45)',
                    flexShrink: 0,
                  }}
                />
                <span>Version {version}</span>
                <span aria-hidden="true">·</span>
                <span>2.5D Emergent Civilization Simulator</span>
              </div>

              <h1
                id="aetheria-start-title"
                className="font-display"
                style={{
                  fontSize: 'clamp(2.25rem, 3.8vw, 3.25rem)',
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: '-0.01em',
                  color: '#f8fafc',
                  textWrap: 'balance',
                  marginBottom: '14px',
                }}
              >
                Aetheria
              </h1>

              <p
                style={{
                  fontSize: '15px',
                  lineHeight: 1.65,
                  color: '#cbd5e1',
                  maxWidth: '58ch',
                }}
              >
                Observe and guide autonomous civilizations across a living 2.5D isometric
                world. Watch citizens harvest growing forests and finite ore veins, build
                fortified cities, conduct diplomacy, and advance from Tribal Kingdoms into
                the Modern &amp; Nuclear Age—or intervene directly with divine powers.
              </p>
            </div>

            {/* Starting Era Preset */}
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#94a3b8',
                  marginBottom: '8px',
                }}
              >
                Starting World Preset
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectScenario('warring')}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border:
                      selectedScenario === 'warring'
                        ? '1px solid #38bdf8'
                        : '1px solid rgba(148, 163, 184, 0.18)',
                    background:
                      selectedScenario === 'warring'
                        ? 'rgba(56, 189, 248, 0.14)'
                        : 'rgba(30, 41, 59, 0.55)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: selectedScenario === 'warring' ? '#7dd3fc' : '#f1f5f9' }}>
                    ⚔️ Tribal Kingdoms
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px', lineHeight: 1.4 }}>
                    Default Era 1 start · Evolve naturally through all 7 ages
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectScenario('modern_nuclear')}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border:
                      selectedScenario === 'modern_nuclear'
                        ? '1px solid #a3e635'
                        : '1px solid rgba(148, 163, 184, 0.18)',
                    background:
                      selectedScenario === 'modern_nuclear'
                        ? 'rgba(132, 204, 22, 0.12)'
                        : 'rgba(30, 41, 59, 0.55)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background 150ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: selectedScenario === 'modern_nuclear' ? '#bef264' : '#f1f5f9' }}>
                    ☢️ Modern &amp; Nuclear
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px', lineHeight: 1.4 }}>
                    Era 7 sandbox · Tanks, aircraft, atomic deterrence &amp; total war
                  </div>
                </button>
              </div>
            </div>

            {/* Primary Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => onPlayNewGame(selectedScenario)}
                  style={{
                    flex: '1 1 200px',
                    minHeight: '44px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(251, 113, 133, 0.65)',
                    background: '#e11d48',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 20px rgba(225, 29, 72, 0.3)',
                    transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1), background 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f43f5e';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#e11d48';
                  }}
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
                  style={{
                    flex: '1 1 200px',
                    minHeight: '44px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: hasValidSave
                      ? '1px solid rgba(56, 189, 248, 0.5)'
                      : '1px solid rgba(148, 163, 184, 0.16)',
                    background: hasValidSave
                      ? 'rgba(14, 116, 144, 0.35)'
                      : 'rgba(30, 41, 59, 0.45)',
                    color: hasValidSave ? '#e0f2fe' : '#64748b',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: hasValidSave ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}
                >
                  Continue Saved Game
                </button>
              </div>

              {/* Save status + JSON import */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontVariantNumeric: 'tabular-nums',
                  paddingTop: '2px',
                }}
              >
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
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportWorldFile(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    padding: '4px 6px',
                  }}
                >
                  Import Save (.json)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: World Artwork & Core Pillars */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                aspectRatio: '16 / 9',
                position: 'relative',
              }}
            >
              {!bannerFailed ? (
                <img
                  src={gameBanner}
                  alt="Aetheria 2.5D isometric kingdoms, rivers, bridges, and harbors"
                  referrerPolicy="no-referrer"
                  onError={() => setBannerFailed(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}
                >
                  2.5D Isometric World Preview
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.08) 45%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* 3 Concise Pillars separated by hairline dividers (no nested cards) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                paddingTop: '4px',
              }}
            >
              <div style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.12)', paddingBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                  Living Ecology &amp; Multi-Tier Economy
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Trees grow from saplings to ancient groves, ore veins exhaust permanently,
                  and hunters track roaming wildlife to supply workshops and granaries.
                </div>
              </div>

              <div style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.12)', paddingBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                  Dynasties, Diplomacy &amp; Combined-Arms War
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Trade and non-aggression pacts, proliferation sanctions, vassalage, siege
                  breaches, tanks, strike aircraft, and last-resort nuclear deterrence.
                </div>
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                  Inspect, Follow &amp; Intervene
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Click any citizen, mine, or city for live telemetry, follow individual
                  lives, shape the world with divine tools, or save &amp; export JSON snapshots.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Desktop Controls Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
            paddingTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
            color: '#94a3b8',
          }}
        >
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
