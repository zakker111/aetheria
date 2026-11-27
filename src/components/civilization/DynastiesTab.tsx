import React, { useState } from 'react';

interface DynastiesTabProps {
  simulation: any;
  dynasties: any[];
  settlements: any[];
  onRenameSettlement?: (settlementId: number, newName: string) => void;
  onRenameAgent?: (agentId: number, newName: string) => void;
  onPanTo?: (x: number, y: number) => void;
  onRefresh: () => void;
}

export const DynastiesTab: React.FC<DynastiesTabProps> = ({
  simulation,
  dynasties,
  settlements,
  onRenameSettlement,
  onRenameAgent,
  onPanTo,
  onRefresh,
}) => {
  const [selectedDynastyId, setSelectedDynastyId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [marriageTargetDynastyId, setMarriageTargetDynastyId] = useState<number | null>(null);
  const [editKind, setEditKind] = useState<'monarch' | 'settlement' | null>(null);
  const [draftName, setDraftName] = useState('');

  const currentDynasty = selectedDynastyId
    ? dynasties.find((d) => d.id === selectedDynastyId) || dynasties[0]
    : dynasties[0];

  const currentSettlement = settlements.find((s) => s.id === currentDynasty?.settlementId);

  const handleArrangeMarriage = (dynAId: number, dynBId: number) => {
    if (!simulation.dynastySystem) return;
    const record = simulation.dynastySystem.arrangeRoyalMarriage(dynAId, dynBId);
    if (record) {
      setMarriageTargetDynastyId(null);
      onRefresh();
    }
  };

  const handleSetSuccessionLaw = (dynId: number, law: 'primogeniture' | 'elective') => {
    if (!simulation.dynastySystem?.setSuccessionLaw) return;
    if (simulation.dynastySystem.setSuccessionLaw(dynId, law)) {
      onRefresh();
    }
  };

  const handleSparkCrisis = (dynId: number) => {
    if (!simulation.dynastySystem?.sparkSuccessionCrisis) return;
    simulation.dynastySystem.sparkSuccessionCrisis(dynId, 'Imperial Chancellery Intervention');
    onRefresh();
  };

  const handleResolveCivilWar = (dyn: any, outcome: 'loyalist_victory' | 'usurpation') => {
    if (!simulation.dynastySystem?.resolveCivilWar) return;
    simulation.dynastySystem.resolveCivilWar(dyn, outcome);
    onRefresh();
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-y-auto lg:overflow-hidden">
      {/* Left Sidebar: House Selector & Monarch Dossier */}
      <div className="w-full lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-900/40 p-4 md:p-5 lg:overflow-y-auto flex flex-col gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            Select Noble House
          </label>
          <div className="flex flex-col gap-1.5 mt-2">
            {dynasties.map((dyn) => {
              const isSelected = currentDynasty?.id === dyn.id;
              return (
                <button
                  key={dyn.id}
                  onClick={() => {
                    setSelectedDynastyId(dyn.id);
                    setSelectedNodeId(null);
                  }}
                  className={`text-left px-3 py-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'border-sky-400 bg-sky-400/12'
                      : 'border-white/8 bg-slate-800/40 hover:bg-slate-800/70'
                  } text-slate-50`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{dyn.coatOfArms?.symbol || '👑'}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] truncate">{dyn.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{dyn.settlementName}</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-sky-400 font-semibold font-mono-tabular shrink-0 ml-2">
                    Legitimacy {Math.round(dyn.legitimacy)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {currentDynasty && (
          <div className="p-4 rounded-xl bg-slate-800/60 border border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-[10px] flex items-center justify-center text-[26px] shadow-md shrink-0"
                style={{ background: currentDynasty.coatOfArms?.bannerColor || '#38bdf8' }}
              >
                {currentDynasty.coatOfArms?.symbol || '👑'}
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-slate-50 truncate">{currentDynasty.name}</div>
                <div className="text-xs italic text-slate-300">"{currentDynasty.motto}"</div>
              </div>
            </div>

            {/* Succession Law Switcher */}
            <div className="border-t border-white/8 pt-2.5">
              <div className="text-[11px] text-slate-500 font-semibold">REIGNING MONARCH</div>
              {editKind === 'monarch' ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="text"
                    value={draftName}
                    maxLength={40}
                    autoFocus
                    onChange={(ev) => setDraftName(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' && draftName.trim() && currentDynasty.monarchId != null) {
                        onRenameAgent?.(currentDynasty.monarchId, draftName.trim());
                        setEditKind(null);
                        onRefresh();
                      } else if (ev.key === 'Escape') {
                        setEditKind(null);
                      }
                    }}
                    className="flex-1 min-w-0 px-2 py-0.5 rounded bg-slate-900 border border-sky-400/60 text-slate-50 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (draftName.trim() && currentDynasty.monarchId != null) {
                        onRenameAgent?.(currentDynasty.monarchId, draftName.trim());
                        onRefresh();
                      }
                      setEditKind(null);
                    }}
                    className="px-2 py-0.5 rounded bg-sky-400 text-slate-950 text-[10px] font-bold border-0 cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditKind(null)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] border-0 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-sm font-bold text-slate-50 truncate">
                    {currentDynasty.monarchTitle} {currentDynasty.monarchName}
                  </div>
                  {onRenameAgent && currentDynasty.monarchId != null && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(currentDynasty.monarchName || '');
                        setEditKind('monarch');
                      }}
                      title="Rename monarch"
                      className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-white/15 text-slate-300 hover:text-white text-[10px] cursor-pointer shrink-0"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-1 mt-2 bg-slate-900 p-0.5 rounded-md">
                <button
                  onClick={() => handleSetSuccessionLaw(currentDynasty.id, 'primogeniture')}
                  className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold cursor-pointer border-0 transition-colors ${
                    currentDynasty.successionLaw !== 'elective'
                      ? 'bg-slate-700 text-slate-50'
                      : 'bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Primogeniture
                </button>
                <button
                  onClick={() => handleSetSuccessionLaw(currentDynasty.id, 'elective')}
                  className={`flex-1 py-1.5 px-2 rounded text-[11px] font-semibold cursor-pointer border-0 transition-colors ${
                    currentDynasty.successionLaw === 'elective'
                      ? 'bg-slate-700 text-slate-50'
                      : 'bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Elective Council
                </button>
              </div>
            </div>

            {/* Consort & Designated Heir */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-900/50 rounded-md">
                <div className="text-[10px] text-slate-500">ROYAL CONSORT</div>
                <div className="font-semibold text-slate-50 truncate">
                  {currentDynasty.consortName || 'Unmarried'}
                </div>
              </div>
              <div className="p-2 bg-slate-900/50 rounded-md">
                <div className="text-[10px] text-slate-500">DESIGNATED HEIR</div>
                <div className="font-semibold text-sky-400 truncate">
                  {currentDynasty.heirName || 'None'}
                </div>
              </div>
            </div>

            {/* Legitimacy Bar */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Royal Legitimacy</span>
                <span className="font-bold text-slate-50 font-mono-tabular">
                  {Math.round(currentDynasty.legitimacy)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm ${
                    currentDynasty.legitimacy > 60
                      ? 'bg-emerald-500'
                      : currentDynasty.legitimacy > 35
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.max(5, Math.min(100, currentDynasty.legitimacy))}%` }}
                />
              </div>
            </div>

            {/* Claimant & Civil War Crisis Status */}
            <div className="border-t border-white/8 pt-2.5">
              {currentDynasty.civilWar?.active ? (
                <div className="p-2.5 rounded-lg bg-red-600/15 border border-red-500/35">
                  <div className="text-xs font-bold text-red-300">Active Civil War</div>
                  <div className="text-[11px] text-slate-200 mt-0.5 font-mono-tabular">
                    Claimant {currentDynasty.civilWar.claimantName} · Fallen: Rebels{' '}
                    {currentDynasty.civilWar.rebelCasualties || 0} / Crown{' '}
                    {currentDynasty.civilWar.loyalistCasualties || 0}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => handleResolveCivilWar(currentDynasty, 'loyalist_victory')}
                      className="flex-1 py-1.5 px-2 bg-slate-800 border border-sky-400/40 rounded-md text-sky-400 text-[11px] font-semibold cursor-pointer hover:bg-slate-700"
                    >
                      Back Loyalists
                    </button>
                    <button
                      onClick={() => handleResolveCivilWar(currentDynasty, 'usurpation')}
                      className="flex-1 py-1.5 px-2 bg-slate-800 border border-amber-500/40 rounded-md text-amber-400 text-[11px] font-semibold cursor-pointer hover:bg-slate-700"
                    >
                      Crown Claimant
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center gap-2">
                  <div className="text-[11px] text-slate-400">
                    <div>
                      Rival Claimant:{' '}
                      <span className="text-slate-200 font-semibold">
                        {currentDynasty.pretenderName || 'None'}
                      </span>
                    </div>
                    <div className="font-mono-tabular">
                      Unrest: {Math.round(currentDynasty.crisisTension || 0)}%
                    </div>
                  </div>
                  {currentDynasty.pretenderId && (
                    <button
                      onClick={() => handleSparkCrisis(currentDynasty.id)}
                      className="py-1.5 px-2.5 bg-red-500/15 border border-red-500/35 rounded-md text-red-300 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-red-500/25"
                    >
                      Spark Crisis
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action: Arrange Royal Marriage */}
            <div className="border-t border-white/8 pt-2.5">
              <div className="text-[11px] text-slate-400 mb-2">
                Forge non-aggression peace pact via royal marriage:
              </div>
              <div className="flex gap-1.5">
                <select
                  value={marriageTargetDynastyId || ''}
                  onChange={(e) => setMarriageTargetDynastyId(Number(e.target.value))}
                  className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-md text-slate-50 text-[11px]"
                >
                  <option value="">Select Rival House...</option>
                  {dynasties
                    .filter((d) => d.id !== currentDynasty.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.settlementName})
                      </option>
                    ))}
                </select>
                <button
                  disabled={!marriageTargetDynastyId}
                  onClick={() =>
                    marriageTargetDynastyId &&
                    handleArrangeMarriage(currentDynasty.id, marriageTargetDynastyId)
                  }
                  className={`py-1.5 px-3 rounded-md border-0 font-semibold text-[11px] whitespace-nowrap ${
                    marriageTargetDynastyId
                      ? 'bg-sky-400 text-slate-900 cursor-pointer hover:bg-sky-300'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Seal Pact
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Zone: Interactive SVG Lineage Family Tree */}
      <div className="flex-1 p-4 md:p-6 lg:overflow-auto flex flex-col bg-slate-950/75">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-50">
              Royal Lineage &amp; Bloodline Tree — {currentDynasty?.name}
            </h2>
            <div className="text-xs text-slate-400">
              Click any noble to inspect title, age, succession position, or pan to map.
            </div>
          </div>
          {currentSettlement && (
            <div className="flex items-center gap-2 flex-wrap">
              {editKind === 'settlement' ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={draftName}
                    maxLength={40}
                    autoFocus
                    onChange={(ev) => setDraftName(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' && draftName.trim()) {
                        onRenameSettlement?.(currentSettlement.id, draftName.trim());
                        setEditKind(null);
                        onRefresh();
                      } else if (ev.key === 'Escape') {
                        setEditKind(null);
                      }
                    }}
                    className="w-36 px-2 py-1 rounded bg-slate-900 border border-sky-400/60 text-slate-50 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (draftName.trim()) {
                        onRenameSettlement?.(currentSettlement.id, draftName.trim());
                        onRefresh();
                      }
                      setEditKind(null);
                    }}
                    className="px-2 py-1 rounded bg-sky-400 text-slate-950 text-xs font-bold border-0 cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditKind(null)}
                    className="px-2 py-1 rounded bg-slate-700 text-slate-200 text-xs border-0 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                onRenameSettlement && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(currentSettlement.name || '');
                      setEditKind('settlement');
                    }}
                    className="py-1.5 px-2.5 bg-slate-800 border border-white/15 text-slate-200 rounded-md text-xs font-semibold cursor-pointer hover:bg-slate-700 whitespace-nowrap"
                  >
                    ✏️ Rename {currentSettlement.name}
                  </button>
                )
              )}
              {onPanTo && (
                <button
                  onClick={() => onPanTo(currentSettlement.center.x, currentSettlement.center.y)}
                  className="py-1.5 px-3 bg-sky-400/15 border border-sky-400/40 text-sky-400 rounded-md text-xs font-semibold cursor-pointer hover:bg-sky-400/25 whitespace-nowrap"
                >
                  📍 Pan to Capital ({currentSettlement.name})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Interactive SVG Tree Canvas */}
        <div className="flex-1 min-h-[380px] lg:min-h-[480px] border border-white/8 rounded-xl bg-slate-900/60 relative overflow-auto flex items-center justify-center p-2">
          {currentDynasty?.lineage && currentDynasty.lineage.length > 0 ? (
            <svg width="780" height="420" viewBox="0 0 780 420" className="max-w-full h-auto">
              <defs>
                <linearGradient id="monarchNode" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>

              <path
                d="M 390 115 L 390 190 M 230 190 L 550 190 M 230 190 L 230 250 M 390 190 L 390 250 M 550 190 L 550 250"
                stroke="#475569"
                strokeWidth="2"
                fill="none"
              />

              <path
                d="M 330 85 L 230 85"
                stroke="#d97706"
                strokeWidth="2"
                strokeDasharray="4 4"
                fill="none"
              />

              {/* Monarch Node */}
              <g
                transform="translate(330, 50)"
                onClick={() => setSelectedNodeId(currentDynasty.monarchId)}
                className="cursor-pointer"
              >
                <rect
                  width="140"
                  height="64"
                  rx="8"
                  fill="url(#monarchNode)"
                  stroke={selectedNodeId === currentDynasty.monarchId ? '#38bdf8' : '#f59e0b'}
                  strokeWidth="2"
                />
                <text x="12" y="24" fill="#fbbf24" fontSize="11" fontWeight="700">
                  👑 MONARCH
                </text>
                <text x="12" y="44" fill="#f8fafc" fontSize="13" fontWeight="600">
                  {currentDynasty.monarchName}
                </text>
              </g>

              {/* Consort Node */}
              <g
                transform="translate(130, 50)"
                onClick={() =>
                  currentDynasty.consortId && setSelectedNodeId(currentDynasty.consortId)
                }
                style={{ cursor: currentDynasty.consortId ? 'pointer' : 'default' }}
              >
                <rect
                  width="130"
                  height="64"
                  rx="8"
                  fill="#1e293b"
                  stroke={selectedNodeId === currentDynasty.consortId ? '#38bdf8' : '#64748b'}
                  strokeWidth="1.5"
                />
                <text x="12" y="24" fill="#94a3b8" fontSize="11" fontWeight="600">
                  CONSORT
                </text>
                <text x="12" y="44" fill="#f8fafc" fontSize="13" fontWeight="600">
                  {currentDynasty.consortName || 'No Consort'}
                </text>
              </g>

              {/* Heirs / Children */}
              {currentDynasty.lineage.slice(1, 4).map((child: any, idx: number) => {
                const posX = 160 + idx * 160;
                const isHeir = child.id === currentDynasty.heirId;
                const isSelected = selectedNodeId === child.id;
                return (
                  <g
                    key={child.id}
                    transform={`translate(${posX}, 250)`}
                    onClick={() => setSelectedNodeId(child.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      width="140"
                      height="64"
                      rx="8"
                      fill="#1e293b"
                      stroke={isSelected || isHeir ? '#38bdf8' : '#475569'}
                      strokeWidth={isHeir ? 2 : 1}
                    />
                    <text x="10" y="22" fill={isHeir ? '#38bdf8' : '#94a3b8'} fontSize="10" fontWeight="700">
                      {isHeir ? '★ HEIR APPARENT' : 'PRINCE / PRINCESS'}
                    </text>
                    <text x="10" y="42" fill="#f8fafc" fontSize="12" fontWeight="600">
                      {child.name}
                    </text>
                    <text x="10" y="56" fill={child.alive ? '#10b981' : '#ef4444'} fontSize="9">
                      {child.alive ? '● Living' : '✝ Deceased'}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="text-slate-500 text-[13px]">
              No lineage records yet for this dynasty.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
