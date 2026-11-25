import React, { useRef, useState } from 'react';

interface HeroesAndArchivesTabProps {
  simulation: any;
  settlements: any[];
  wars: any[];
  warHistory: any[];
  onSelectAgent?: (id: number) => void;
  onSelectBuilding?: (buildingId: number) => void;
  onExportWorld?: () => void;
  onExportChronicle?: () => void;
  onImportWorld?: (file: File) => void;
  onPanTo?: (x: number, y: number) => void;
  onFollowAgent?: (id: number) => void;
  onClose: () => void;
}

export const HeroesAndArchivesTab: React.FC<HeroesAndArchivesTabProps> = ({
  simulation,
  settlements,
  wars,
  warHistory,
  onSelectAgent,
  onSelectBuilding,
  onExportWorld,
  onExportChronicle,
  onImportWorld,
  onPanTo,
  onFollowAgent,
  onClose,
}) => {
  const [archiveEraFilter, setArchiveEraFilter] = useState<number | null>(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'legends' | 'builders' | 'heirlooms'>('all');
  const [peopleSettlementFilter, setPeopleSettlementFilter] = useState<string>('all');
  const [selectedHouseSurname, setSelectedHouseSurname] = useState<string | null>(null);
  const archiveFileInputRef = useRef<HTMLInputElement | null>(null);

  const roster = simulation.getHistoricalPeopleRoster?.() || null;
  const rawLivingLegends: any[] =
    roster?.livingLegends ||
    (simulation.agents || [])
      .filter((a: any) => a.alive)
      .slice()
      .sort(
        (a: any, b: any) =>
          (b.kills || 0) - (a.kills || 0) ||
          (b.buildingsBuilt || 0) - (a.buildingsBuilt || 0) ||
          a.id - b.id
      )
      .slice(0, 48);
  const rawFallenArchives: any[] = roster?.fallenArchives || (simulation.fallenHeroes || []).slice(0, 36);
  const rawFamilyLines: any[] = roster?.familyLines || [];

  const settlementFilterOptions: string[] = Array.from(
    new Set([
      ...settlements.map((s) => s?.name).filter(Boolean),
      ...rawLivingLegends.map((p) => p?.settlementName).filter((n) => n && n !== 'Wilds'),
      ...rawFallenArchives.map((p) => p?.settlementName).filter((n) => n && n !== 'Wilds'),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const q = peopleSearch.trim().toLowerCase();
  const matchesSettlement = (p: any) => {
    if (peopleSettlementFilter === 'all') return true;
    const sName =
      p.settlementName ||
      (p.settlementId ? settlements.find((s) => s.id === p.settlementId)?.name || 'Wilds' : 'Wilds');
    return sName === peopleSettlementFilter;
  };
  const matchesRole = (p: any) => {
    if (peopleFilter === 'legends')
      return Boolean(p.isMonarch || (p.kills || 0) >= 1 || p.legendaryWeapon || p.epithet);
    if (peopleFilter === 'builders')
      return Boolean((p.buildingsBuilt || 0) >= 1 || p.job === 'builder' || /builder/i.test(p.jobTitle || ''));
    if (peopleFilter === 'heirlooms') return Boolean(p.heirloom || p.legendaryWeapon);
    return true;
  };
  const matchesQuery = (p: any) => {
    if (!q) return true;
    const hay = `${p.fullName || p.name || ''} ${p.surname || ''} ${p.settlementName || ''} ${p.jobTitle || ''} ${p.heirloom?.name || ''} ${p.legendaryWeapon || ''} ${p.biography || ''}`.toLowerCase();
    return hay.includes(q);
  };

  const livingHeroes = rawLivingLegends.filter(
    (p) => matchesSettlement(p) && matchesRole(p) && matchesQuery(p)
  );
  const fallenLegends = rawFallenArchives.filter(
    (p) => matchesSettlement(p) && matchesRole(p) && matchesQuery(p)
  );
  const familyLines = rawFamilyLines.filter((f) => {
    if (peopleSettlementFilter !== 'all') {
      const hasTown =
        (f.activeSettlements || []).includes(peopleSettlementFilter) ||
        f.originSettlement === peopleSettlementFilter;
      if (!hasTown) return false;
    }
    if (!q) return true;
    return (
      f.surname.toLowerCase().includes(q) ||
      (f.activeSettlements || []).some((s: string) => s.toLowerCase().includes(q)) ||
      (f.heirloomNames || []).some((h: string) => h.toLowerCase().includes(q)) ||
      (f.members || []).some((m: any) => (m.fullName || '').toLowerCase().includes(q))
    );
  });

  const selectedHouse = selectedHouseSurname
    ? familyLines.find((f) => f.surname === selectedHouseSurname) ||
      rawFamilyLines.find((f) => f.surname === selectedHouseSurname) ||
      null
    : null;

  const historicBattles = [...wars, ...warHistory]
    .flatMap((w) =>
      (w.battles || []).map((b: any) => ({
        ...b,
        attackerName: w.attackerName,
        defenderName: w.defenderName,
      }))
    )
    .filter((b) => b && b.name)
    .sort((a, b) => (b.tick || 0) - (a.tick || 0))
    .slice(0, 20);

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-y-auto lg:overflow-hidden">
      {/* Living Champions & Fallen Legends */}
      <div className="flex-1 p-4 md:p-6 lg:overflow-y-auto flex flex-col gap-5">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="m-0 text-base font-bold text-slate-50">
              People &amp; Historical Archives ({livingHeroes.length} Living · {familyLines.length}{' '}
              Houses · {fallenLegends.length} Fallen)
            </h2>
            <div className="text-xs text-slate-400">
              Browse living citizens, monarchs, master builders, multi-generation bloodlines, and
              heirloom bearers.
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {onExportChronicle && (
              <button
                onClick={onExportChronicle}
                className="py-1.5 px-3 bg-sky-400/15 border border-sky-400/35 rounded-md text-sky-400 text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-sky-400/25"
              >
                Download Chronicle JSON
              </button>
            )}
            {onExportWorld && (
              <button
                onClick={onExportWorld}
                className="py-1.5 px-3 bg-amber-500/16 border border-amber-500/40 rounded-md text-amber-400 text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-amber-500/25"
              >
                Export World Snapshot
              </button>
            )}
            {onImportWorld && (
              <>
                <input
                  ref={archiveFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportWorld(file);
                      onClose();
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => archiveFileInputRef.current?.click()}
                  className="py-1.5 px-3 bg-emerald-500/16 border border-emerald-500/40 rounded-md text-emerald-300 text-xs font-semibold cursor-pointer whitespace-nowrap hover:bg-emerald-500/25"
                >
                  Import Save File
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search, Settlement & Role Filter Bar */}
        <div className="flex gap-2.5 items-center flex-wrap py-2.5 px-3 rounded-[10px] bg-slate-900/70 border border-white/8">
          <input
            type="text"
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder="Search citizen, House surname, settlement, or heirloom..."
            className="flex-1 min-w-[200px] py-1.5 px-2.5 rounded-md border border-slate-400/30 bg-slate-800/85 text-slate-50 text-xs outline-none focus:border-sky-400"
          />
          <select
            aria-label="Filter by settlement"
            value={peopleSettlementFilter}
            onChange={(e) => setPeopleSettlementFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-md border border-slate-400/30 bg-slate-800/90 text-slate-50 text-xs outline-none cursor-pointer whitespace-nowrap"
          >
            <option value="all">All Settlements</option>
            {settlementFilterOptions.map((sName) => (
              <option key={`sf_${sName}`} value={sName}>
                {sName}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: 'All People' },
                { id: 'legends', label: '👑 Monarchs & Heroes' },
                { id: 'builders', label: '🔨 Master Builders' },
                { id: 'heirlooms', label: '💍 Heirloom Bearers' },
              ] as const
            ).map((rf) => (
              <button
                key={rf.id}
                onClick={() => setPeopleFilter(rf.id)}
                className={`py-1.5 px-2.5 rounded-md border-0 text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  peopleFilter === rf.id
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800/85 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Era-by-Era World History Timeline Filter */}
        <div className="p-3.5 rounded-[10px] bg-slate-900/60 border border-white/8">
          <div className="flex justify-between items-center mb-2.5 flex-wrap gap-2">
            <h3 className="m-0 text-sm font-bold text-slate-50">Era-by-Era Replay Highlights</h3>
            <div className="flex gap-1 flex-wrap">
              {[
                { id: null, label: 'All Eras' },
                { id: 1, label: 'Era 1 Tribal' },
                { id: 2, label: 'Era 2 Bronze' },
                { id: 3, label: 'Era 3 Classical' },
                { id: 4, label: 'Era 4 Imperial' },
                { id: 5, label: 'Era 5 Industrial' },
                { id: 6, label: 'Era 6 Modern' },
                { id: 7, label: 'Era 7 Nuclear' },
              ].map((ef) => (
                <button
                  key={String(ef.id ?? 'all')}
                  onClick={() => setArchiveEraFilter(ef.id)}
                  className={`py-1 px-2 rounded border-0 text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    archiveEraFilter === ef.id
                      ? 'bg-sky-400 text-slate-900'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {ef.label}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[165px] overflow-y-auto flex flex-col gap-1">
            {(() => {
              const items = simulation.chronicleSystem?.getHighlights?.(40, archiveEraFilter) || [];
              if (items.length === 0) {
                return (
                  <div className="text-xs text-slate-500">
                    No highlights recorded for this era yet.
                  </div>
                );
              }
              return items.map((ev: any) => {
                const targetAgentId =
                  ev.agentId ?? ev.killerId ?? ev.builderId ?? ev.victimId ?? null;
                return (
                  <div
                    key={ev.id}
                    className="flex justify-between items-center gap-2.5 text-xs py-1 px-1.5 border-b border-white/5"
                  >
                    <span className="text-slate-200">
                      <span className="text-slate-400 text-[10px] mr-1.5 font-mono-tabular">
                        {ev.date}
                      </span>
                      {ev.text}
                    </span>
                    <div className="flex gap-2 shrink-0">
                      {ev.buildingId != null && onSelectBuilding && (
                        <button
                          onClick={() => {
                            onSelectBuilding(ev.buildingId);
                            onClose();
                          }}
                          className="bg-transparent border-0 text-amber-500 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:underline"
                        >
                          Inspect Structure
                        </button>
                      )}
                      {targetAgentId != null && onSelectAgent && (
                        <button
                          onClick={() => {
                            onSelectAgent(targetAgentId);
                            onClose();
                          }}
                          className="bg-transparent border-0 text-amber-400 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:underline"
                        >
                          Inspect Person
                        </button>
                      )}
                      {onPanTo && typeof ev.x === 'number' && typeof ev.y === 'number' && (
                        <button
                          onClick={() => {
                            onPanTo(ev.x, ev.y);
                            onClose();
                          }}
                          className="bg-transparent border-0 text-sky-400 text-[11px] cursor-pointer whitespace-nowrap hover:underline"
                        >
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Living People & Legends */}
        <div>
          <h3 className="m-0 mb-2 text-[15px] font-bold text-slate-50">
            Living Citizens &amp; Legends ({livingHeroes.length})
          </h3>
          {livingHeroes.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {livingHeroes.map((h) => {
                const homeName =
                  h.settlementName ||
                  (h.settlementId
                    ? settlements.find((s) => s.id === h.settlementId)?.name || 'Wilds'
                    : 'Wilds');
                const displayName =
                  h.fullName ||
                  `${h.name}${h.surname ? ` ${h.surname}` : ''}${h.epithet ? ` ${h.epithet}` : ''}`;
                return (
                  <div
                    key={h.id}
                    className={`p-3 rounded-[10px] bg-slate-800/65 border flex flex-col gap-1.5 ${
                      h.isMonarch ? 'border-amber-400/35' : 'border-white/8'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-50 truncate">
                          {h.isMonarch ? '👑 ' : ''}
                          {displayName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                          {homeName} · {h.jobTitle || 'Citizen'} · Age {Math.floor(h.age || 0)} · Gen{' '}
                          {h.generation ?? 1}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {onSelectAgent && (
                          <button
                            onClick={() => {
                              onSelectAgent(h.id);
                              if (onPanTo && typeof h.x === 'number' && typeof h.y === 'number')
                                onPanTo(h.x, h.y);
                              onClose();
                            }}
                            className="py-1 px-2 bg-sky-400/14 border border-sky-400/35 rounded-md text-sky-400 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-sky-400/25"
                          >
                            Inspect
                          </button>
                        )}
                        {onFollowAgent && (
                          <button
                            onClick={() => {
                              if (onSelectAgent) onSelectAgent(h.id);
                              onFollowAgent(h.id);
                              onClose();
                            }}
                            className="py-1 px-2 bg-emerald-500/14 border border-emerald-500/35 rounded-md text-emerald-400 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-emerald-500/25"
                          >
                            Follow
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono-tabular">
                      ⚔️ {h.kills || 0} Kills · 🔨 {h.buildingsBuilt || 0} Built
                      {h.lifeHistoryCount ? ` · 📜 ${h.lifeHistoryCount} Milestones` : ''}
                    </div>
                    {(h.heirloom || h.legendaryWeapon) && (
                      <div className="text-[11px] text-amber-400 font-semibold">
                        {h.heirloom
                          ? `💍 Heirloom: ${h.heirloom.name}`
                          : `🗡️ Relic: ${h.legendaryWeapon}`}
                      </div>
                    )}
                    {h.biography && (
                      <div className="text-[11px] text-slate-400 leading-relaxed">{h.biography}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500 text-[13px]">
              No living citizens match the current filter.
            </div>
          )}
        </div>

        {/* Multi-Generation Family Bloodlines */}
        {familyLines.length > 0 && (
          <div>
            <h3 className="mt-1 mb-2 text-[15px] font-bold text-slate-50">
              Family Bloodlines &amp; Houses ({familyLines.length})
            </h3>

            {selectedHouse && (
              <div className="mb-3 p-3.5 rounded-[10px] bg-slate-900/88 border border-sky-400/35 flex flex-col gap-2.5">
                <div className="flex justify-between items-center gap-2.5 flex-wrap">
                  <div>
                    <div className="font-bold text-[15px] text-sky-200">
                      🛡️ House {selectedHouse.surname} Chronicle
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono-tabular">
                      {selectedHouse.originSettlement
                        ? `Origin: ${selectedHouse.originSettlement} · `
                        : ''}
                      Gen {selectedHouse.maxGeneration} · {selectedHouse.livingCount} Living ·{' '}
                      {selectedHouse.fallenCount} Fallen · ⚔️ {selectedHouse.totalKills || 0} Kills ·
                      🔨 {selectedHouse.totalBuildingsBuilt || 0} Built
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedHouseSurname(null)}
                    className="py-1 px-2.5 rounded-md border border-slate-400/30 bg-slate-800/85 text-slate-300 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-slate-700"
                  >
                    Close House View
                  </button>
                </div>

                {Array.isArray(selectedHouse.heirlooms) && selectedHouse.heirlooms.length > 0 && (
                  <div className="flex flex-col gap-1 py-2 px-2.5 rounded-lg bg-yellow-500/8 border border-yellow-500/22">
                    <div className="text-[11px] font-bold text-amber-400">
                      House Heirlooms &amp; Provenance ({selectedHouse.heirlooms.length})
                    </div>
                    {selectedHouse.heirlooms.map((hl: any) => (
                      <div
                        key={`hl_${hl.name}`}
                        className="flex justify-between items-center gap-2 text-[11px] text-slate-200 font-mono-tabular"
                      >
                        <span>
                          💍 <b>{hl.name}</b>
                          {hl.originName ? ` · Origin: ${hl.originName}` : ''}
                          {hl.originYear ? ` (Y${hl.originYear})` : ''}
                          {hl.generationsHeld ? ` · ${hl.generationsHeld} gen` : ''}
                          {` · ${hl.holderAlive ? 'Held by' : 'Last held by'} ${hl.holderName}`}
                        </span>
                        {onSelectAgent && hl.holderId != null && (
                          <button
                            onClick={() => {
                              onSelectAgent(hl.holderId);
                              onClose();
                            }}
                            className="bg-transparent border-0 text-sky-400 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:underline"
                          >
                            Inspect Bearer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1.5">
                  {(selectedHouse.members || []).map((m: any) => (
                    <div
                      key={`hd_${m.id}`}
                      className={`py-1.5 px-2.5 rounded-md bg-slate-800/72 border flex justify-between items-center gap-1.5 ${
                        m.alive ? 'border-emerald-400/28' : 'border-slate-400/18'
                      }`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`text-[11px] font-bold truncate ${
                            m.alive ? 'text-slate-50' : 'text-slate-400'
                          }`}
                        >
                          {m.isMonarch ? '👑 ' : m.alive ? '' : '🕯️ '}
                          {m.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-tabular">
                          Gen {m.generation} · {m.jobTitle} · {m.settlementName || 'Wilds'} ·{' '}
                          {m.kills}K / {m.buildingsBuilt}B
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {onSelectAgent && (
                          <button
                            onClick={() => {
                              onSelectAgent(m.id);
                              onClose();
                            }}
                            className="py-0.5 px-1.5 rounded border border-sky-400/35 bg-sky-400/14 text-sky-400 text-[10px] font-semibold cursor-pointer whitespace-nowrap hover:bg-sky-400/25"
                          >
                            Inspect
                          </button>
                        )}
                        {m.alive && onFollowAgent && (
                          <button
                            onClick={() => {
                              if (onSelectAgent) onSelectAgent(m.id);
                              onFollowAgent(m.id);
                              onClose();
                            }}
                            className="py-0.5 px-1.5 rounded border border-emerald-500/35 bg-emerald-500/14 text-emerald-400 text-[10px] font-semibold cursor-pointer whitespace-nowrap hover:bg-emerald-500/25"
                          >
                            Follow
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
              {familyLines.map((fam) => {
                const isExpanded = selectedHouseSurname === fam.surname;
                return (
                  <div
                    key={`house_${fam.surname}`}
                    className={`p-3 rounded-lg border flex flex-col gap-1.5 ${
                      isExpanded
                        ? 'bg-slate-800/85 border-sky-400/50'
                        : 'bg-slate-900/65 border-sky-400/18'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-1.5">
                      <span className="font-bold text-[13px] text-sky-200">
                        🛡️ House {fam.surname}
                      </span>
                      <button
                        onClick={() => setSelectedHouseSurname(isExpanded ? null : fam.surname)}
                        className={`py-0.5 px-2 rounded border border-sky-400/35 text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                          isExpanded ? 'bg-sky-400 text-slate-900' : 'bg-sky-400/12 text-sky-400'
                        }`}
                      >
                        {isExpanded ? 'Selected' : 'Explore Lineage'}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular">
                      Gen {fam.maxGeneration} · {fam.livingCount} Living · {fam.fallenCount} Fallen
                      {(fam.totalKills || 0) > 0 ? ` · ⚔️ ${fam.totalKills}` : ''}
                      {(fam.totalBuildingsBuilt || 0) > 0 ? ` · 🔨 ${fam.totalBuildingsBuilt}` : ''}
                    </div>
                    {fam.activeSettlements?.length > 0 && (
                      <div className="text-[11px] text-slate-300">
                        🏘️ {fam.activeSettlements.join(', ')}
                      </div>
                    )}
                    {fam.heirloomNames?.length > 0 && (
                      <div className="text-[11px] text-amber-400">
                        💍 {fam.heirloomNames.join(', ')}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(fam.members || []).slice(0, 8).map((m: any) => (
                        <button
                          key={`fam_m_${m.id}`}
                          onClick={() => {
                            if (onSelectAgent) {
                              onSelectAgent(m.id);
                              onClose();
                            }
                          }}
                          className={`py-0.5 px-1.5 rounded border text-[10px] cursor-pointer ${
                            m.alive
                              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
                              : 'border-slate-400/25 bg-slate-800/60 text-slate-400'
                          }`}
                        >
                          {m.isMonarch ? '👑 ' : m.alive ? '' : '🕯️ '}
                          {m.fullName} (G{m.generation})
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallen Memorials */}
        <div>
          <h3 className="mt-2 mb-1 text-[15px] font-bold text-slate-50">
            Memorial of Fallen Citizens &amp; Legends ({fallenLegends.length})
          </h3>
          {fallenLegends.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5 mt-2">
              {fallenLegends.map((h) => {
                const displayName =
                  h.fullName ||
                  `${h.name}${h.surname ? ` ${h.surname}` : ''}${h.epithet ? ` ${h.epithet}` : ''}`;
                return (
                  <div
                    key={`fallen_${h.id}`}
                    className="p-3 rounded-lg bg-slate-900/65 border border-white/8 flex flex-col gap-1.5"
                  >
                    <div className="flex justify-between items-center gap-1.5">
                      <div className="font-semibold text-[13px] text-slate-200 truncate">
                        🕯️ {displayName}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {onSelectAgent && (
                          <button
                            onClick={() => {
                              onSelectAgent(h.id);
                              onClose();
                            }}
                            className="py-1 px-2 bg-sky-400/14 border border-sky-400/35 rounded text-sky-400 text-[10px] font-semibold cursor-pointer hover:bg-sky-400/25"
                          >
                            Inspect Dossier
                          </button>
                        )}
                        {onPanTo && typeof h.x === 'number' && typeof h.y === 'number' && (
                          <button
                            onClick={() => {
                              onPanTo(h.x, h.y);
                              onClose();
                            }}
                            className="py-1 px-2 bg-amber-500/14 border border-amber-500/35 rounded text-amber-400 text-[10px] font-semibold cursor-pointer hover:bg-amber-500/25"
                          >
                            Locate
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular">
                      {h.settlementName} · {h.kills || 0} Kills · {h.buildingsBuilt || 0} Built ·
                      Died Age {h.age} ({String(h.deathCause || h.cause || 'natural').replace(/_/g, ' ')})
                    </div>
                    {(h.heirloom || h.legendaryWeapon) && (
                      <div className="text-[11px] text-amber-500">
                        {h.heirloom ? `💍 Carried "${h.heirloom.name}"` : `🗡️ Wielded ${h.legendaryWeapon}`}
                      </div>
                    )}
                    {h.biography && (
                      <div className="text-[11px] text-slate-300 italic leading-snug">
                        “{h.biography}”
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-slate-500 text-xs">
              No fallen citizens or legends recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Historic Battlefields Sidebar */}
      <div className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-900/40 p-4 md:p-5 lg:overflow-y-auto flex flex-col gap-3">
        <h3 className="m-0 text-sm font-bold text-slate-50">
          Historic Battlefields ({historicBattles.length})
        </h3>
        {historicBattles.length > 0 ? (
          historicBattles.map((b, i) => (
            <div
              key={`${b.name}_${b.tick}_${i}`}
              className="p-3 rounded-lg bg-slate-800/60 border border-white/8 flex justify-between items-center gap-2.5"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[13px] text-slate-50 truncate">{b.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono-tabular">
                  {b.attackerName} vs {b.defenderName} · Year {Math.floor((b.tick || 0) / 400) + 1}
                  {b.eraId ? ` · Era ${b.eraId}` : ''}
                  {b.casualties ? ` · ${b.casualties} Fallen` : ''}
                </div>
              </div>
              {onPanTo && typeof b.x === 'number' && typeof b.y === 'number' && (
                <button
                  onClick={() => {
                    onPanTo(b.x, b.y);
                    onClose();
                  }}
                  className="py-1 px-2.5 bg-amber-500/15 border border-amber-500/35 rounded-md text-amber-400 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-amber-500/25 shrink-0"
                >
                  View Site
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="text-slate-500 text-xs">No named battles recorded yet.</div>
        )}
      </div>
    </div>
  );
};
