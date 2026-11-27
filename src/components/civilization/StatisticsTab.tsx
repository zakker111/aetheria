import React, { useEffect, useMemo, useState } from 'react';

interface StatisticsTabProps {
  simulation: any;
  onRenameSettlement?: (settlementId: number, newName: string) => void;
  onPanTo?: (x: number, y: number) => void;
  onClose: () => void;
}

interface SliceItem {
  key: string;
  label: string;
  count: number;
  color: string;
  sublabel?: string;
}

interface DonutChartPanelProps {
  title: string;
  subtitle: string;
  centerLabel: string;
  centerValue: string;
  items: SliceItem[];
  emptyText: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArcSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

const DonutChartPanel: React.FC<DonutChartPanelProps> = ({
  title,
  subtitle,
  centerLabel,
  centerValue,
  items,
  emptyText,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const total = useMemo(() => items.reduce((sum, item) => sum + item.count, 0), [items]);
  const activeSlice = items.find((item) => item.key === hoveredKey) || null;

  const segments = useMemo(() => {
    if (total <= 0) return [];
    let angle = 0;
    return items.map((item) => {
      const span = (item.count / total) * 360;
      const startAngle = angle;
      const endAngle = angle + span;
      angle = endAngle;
      return {
        ...item,
        startAngle,
        endAngle,
        pct: ((item.count / total) * 100).toFixed(1),
      };
    });
  }, [items, total]);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/8 pb-2">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-bold text-slate-100 truncate">{title}</h3>
          <div className="text-[11px] text-slate-400 truncate">{subtitle}</div>
        </div>
        <span className="text-[11px] text-slate-400 font-mono-tabular whitespace-nowrap shrink-0">
          n = {total}
        </span>
      </div>

      {total === 0 ? (
        <div className="min-h-[164px] flex items-center justify-center text-center px-4 text-xs text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-[156px] h-[156px] shrink-0">
            <svg viewBox="0 0 160 160" className="w-full h-full overflow-visible" role="img" aria-label={title}>
              <circle
                cx="80"
                cy="80"
                r="56"
                fill="none"
                stroke="#1e293b"
                strokeWidth="20"
              />
              {segments.length === 1 ? (
                <circle
                  cx="80"
                  cy="80"
                  r="56"
                  fill="none"
                  stroke={segments[0].color}
                  strokeWidth={hoveredKey === segments[0].key ? 24 : 20}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredKey(segments[0].key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              ) : (
                segments.map((seg) => {
                  const isHovered = hoveredKey === seg.key;
                  const gap = seg.endAngle - seg.startAngle > 6 ? 1.5 : 0.2;
                  const pathD = describeArcSlice(80, 80, 56, seg.startAngle + gap / 2, seg.endAngle - gap / 2);
                  return (
                    <path
                      key={seg.key}
                      d={pathD}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isHovered ? 25 : 20}
                      strokeLinecap="butt"
                      opacity={hoveredKey && !isHovered ? 0.45 : 1}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredKey(seg.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                    />
                  );
                })
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-5 text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate max-w-full">
                {activeSlice ? activeSlice.label : centerLabel}
              </div>
              <div className="text-base font-bold text-slate-50 font-mono-tabular">
                {activeSlice ? `${activeSlice.count} (${((activeSlice.count / total) * 100).toFixed(0)}%)` : centerValue}
              </div>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col gap-1 max-h-[164px] overflow-y-auto pr-1">
            {segments.map((seg) => {
              const isHovered = hoveredKey === seg.key;
              return (
                <div
                  key={seg.key}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                    isHovered ? 'bg-slate-800/90 text-white' : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{seg.label}</span>
                  </div>
                  <div className="font-mono-tabular text-[11px] text-slate-300 shrink-0 whitespace-nowrap">
                    {seg.count} <span className="text-slate-500">({seg.pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

type TrendCategory = 'demographics' | 'stockpiles' | 'military';

interface HistorySeriesDef {
  key: string;
  label: string;
  color: string;
}

const TREND_SERIES: Record<TrendCategory, HistorySeriesDef[]> = {
  demographics: [
    { key: 'population', label: 'Living Pop', color: '#38bdf8' },
    { key: 'births', label: 'Cum. Births', color: '#22c55e' },
    { key: 'deaths', label: 'Cum. Deaths', color: '#ef4444' },
  ],
  stockpiles: [
    { key: 'food', label: 'Food Stock', color: '#f59e0b' },
    { key: 'wood', label: 'Timber Stock', color: '#84cc16' },
    { key: 'ore', label: 'Ore Stock', color: '#a855f7' },
  ],
  military: [
    { key: 'buildings', label: 'Structures', color: '#10b981' },
    { key: 'soldiers', label: 'Soldiers', color: '#f43f5e' },
    { key: 'activeWars', label: 'Active Wars', color: '#fbbf24' },
  ],
};

export const StatisticsTab: React.FC<StatisticsTabProps> = ({
  simulation,
  onRenameSettlement,
  onPanTo,
  onClose,
}) => {
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>('all');
  const [trendCategory, setTrendCategory] = useState<TrendCategory>('demographics');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [liveTick, setLiveTick] = useState<number>(() => simulation?.clock?.tick ?? 0);
  const [editingSid, setEditingSid] = useState<number | null>(null);
  const [draftRealmName, setDraftRealmName] = useState('');
  const [renameRev, setRenameRev] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const nextTick = simulation?.clock?.tick ?? 0;
      setLiveTick((prev) => (prev !== nextTick ? nextTick : prev));
    }, 650);
    return () => window.clearInterval(id);
  }, [simulation]);

  const stats = useMemo(() => {
    if (liveTick < 0 || renameRev < 0 || !simulation || typeof simulation.getStatisticsSnapshot !== 'function') {
      return null;
    }
    const filterId = selectedSettlementId === 'all' ? null : Number(selectedSettlementId);
    return simulation.getStatisticsSnapshot(filterId);
  }, [simulation, selectedSettlementId, liveTick, renameRev]);

  const activeSeries = TREND_SERIES[trendCategory];
  const history = useMemo(() => stats?.history ?? [], [stats]);

  const maxTrendVal = useMemo(() => {
    let maxV = 10;
    for (const pt of history) {
      for (const s of activeSeries) {
        const v = Number(pt?.[s.key] ?? 0);
        if (v > maxV) maxV = v;
      }
    }
    return Math.ceil(maxV * 1.12);
  }, [history, activeSeries]);

  if (!stats) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-slate-400 p-8">
        Statistics telemetry is unavailable for this simulation snapshot.
      </div>
    );
  }

  const { demographics, causesOfDeath, ageBrackets, religions, professions, settlements } = stats;

  const totalFood = settlements.reduce((s: number, r: any) => s + r.food, 0);
  const totalWood = settlements.reduce((s: number, r: any) => s + r.wood, 0);
  const totalOre = settlements.reduce((s: number, r: any) => s + r.ore, 0);
  const totalBuildings = settlements.reduce((s: number, r: any) => s + r.buildingsCount, 0);

  const religionSlices: SliceItem[] = religions.map((r: any) => ({
    key: r.id,
    label: `${r.icon} ${r.name}`,
    count: r.count,
    color: r.color,
  }));

  const chartW = 720;
  const chartH = 190;
  const padL = 42;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const hoveredPoint = hoverIdx != null && history[hoverIdx] ? history[hoverIdx] : null;

  return (
    <div className="w-full h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-slate-950/60">
      {/* Header & Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="m-0 text-base font-bold text-slate-50 font-display">
            World Telemetry, Demographics &amp; Historical Charts
          </h2>
          <div className="text-xs text-slate-400">
            Tick {liveTick} · Year {Math.floor(liveTick / 400) + 1} · Periodic census &amp; mortality analytics
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="stats-realm-filter" className="text-xs text-slate-400 whitespace-nowrap">
            Scope:
          </label>
          <select
            id="stats-realm-filter"
            value={selectedSettlementId}
            onChange={(e) => setSelectedSettlementId(e.target.value)}
            className="bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 cursor-pointer"
          >
            <option value="all">All Realms ({settlements.length})</option>
            {settlements.map((s: any) => (
              <option key={s.id} value={String(s.id)}>
                {s.tierIcon} {s.name} (Pop {s.population})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Single-Elevation KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-white/10 rounded-xl bg-slate-900/75 divide-y sm:divide-y-0 sm:divide-x divide-white/10 overflow-hidden">
        <div className="p-3">
          <div className="text-[11px] text-slate-400">Living Citizens</div>
          <div className="text-lg font-bold text-sky-300 font-mono-tabular mt-0.5">
            {demographics.totalLiving}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            {demographics.children}Y · {demographics.youngAdults + demographics.matureAdults}A · {demographics.elders}E
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] text-slate-400">Avg Living Age</div>
          <div className="text-lg font-bold text-emerald-300 font-mono-tabular mt-0.5">
            {demographics.averageLivingAge.toFixed(1)}y
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            Avg Faith {demographics.avgFaith.toFixed(0)}%
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] text-slate-400">Avg Age at Death</div>
          <div className="text-lg font-bold text-amber-300 font-mono-tabular mt-0.5">
            {demographics.totalDeaths > 0 ? `${demographics.averageDeathAge.toFixed(1)}y` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            {demographics.totalDeaths > 0 ? `Range ${demographics.minDeathAge}–${demographics.maxDeathAge}y` : 'No mortality yet'}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] text-slate-400">Vital Turnover</div>
          <div className="text-lg font-bold text-slate-100 font-mono-tabular mt-0.5">
            +{demographics.births} / -{demographics.deaths}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            Net {demographics.births - demographics.deaths >= 0 ? '+' : ''}{demographics.births - demographics.deaths}
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] text-slate-400">Realm Stockpiles</div>
          <div className="text-lg font-bold text-lime-300 font-mono-tabular mt-0.5">
            {totalFood + totalWood + totalOre}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            {totalFood}F · {totalWood}W · {totalOre}O
          </div>
        </div>

        <div className="p-3">
          <div className="text-[11px] text-slate-400">Civic Infrastructure</div>
          <div className="text-lg font-bold text-slate-100 font-mono-tabular mt-0.5">
            {totalBuildings}
          </div>
          <div className="text-[11px] text-slate-500 font-mono-tabular">
            Across {settlements.length} realms
          </div>
        </div>
      </div>

      {/* 2x2 Interactive SVG Donut / Pie Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DonutChartPanel
          title="Causes of Death"
          subtitle="Recorded fatalities across combat, famine, age, and disasters"
          centerLabel="Deaths"
          centerValue={String(demographics.totalDeaths)}
          items={causesOfDeath}
          emptyText="No recorded fatalities yet — causes of death populate once citizens perish."
        />

        <DonutChartPanel
          title="Age Brackets & Lifespan"
          subtitle="Current living cohort distribution by life stage"
          centerLabel="Avg Age"
          centerValue={`${demographics.averageLivingAge.toFixed(1)}y`}
          items={ageBrackets}
          emptyText="No living citizens in the selected scope."
        />

        <DonutChartPanel
          title="Religions & Creeds"
          subtitle="Adherents by creed across temples and households"
          centerLabel="Avg Faith"
          centerValue={`${demographics.avgFaith.toFixed(0)}%`}
          items={religionSlices}
          emptyText="No active religious creeds recorded in this scope."
        />

        <DonutChartPanel
          title="Professions & Labor"
          subtitle="Workforce allocation across production, military, and clergy"
          centerLabel="Workforce"
          centerValue={String(demographics.totalLiving)}
          items={professions}
          emptyText="No citizens in the selected scope."
        />
      </div>

      {/* Historical Time-Series SVG Line Chart */}
      <div className="rounded-xl border border-white/10 bg-slate-900/75 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2.5">
          <div>
            <h3 className="m-0 text-sm font-bold text-slate-100">Historical World Trajectory</h3>
            <div className="text-[11px] text-slate-400">
              Sampled deterministically every 20 simulation ticks ({history.length} points stored)
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-white/10">
            {(
              [
                ['demographics', 'Population'],
                ['stockpiles', 'Stockpiles'],
                ['military', 'Civic & War'],
              ] as Array<[TrendCategory, string]>
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setTrendCategory(cat);
                  setHoverIdx(null);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  trendCategory === cat
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-transparent text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            {activeSeries.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: s.color }} />
                <span>{s.label}</span>
                {hoveredPoint && (
                  <span className="font-mono-tabular text-slate-100 font-semibold">
                    {hoveredPoint[s.key] ?? 0}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-400 font-mono-tabular">
            {hoveredPoint
              ? `Year ${hoveredPoint.year} · Tick ${hoveredPoint.tick}`
              : history.length > 0
                ? `Ticks ${history[0].tick}–${history[history.length - 1].tick}`
                : 'Awaiting samples'}
          </div>
        </div>

        {history.length < 2 ? (
          <div className="h-[150px] flex items-center justify-center text-xs text-slate-400 text-center px-4">
            Awaiting at least 2 simulation snapshots (unpause or advance 20 ticks to plot historical trends).
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-[190px]"
              onMouseLeave={() => setHoverIdx(null)}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = padT + plotH * (1 - frac);
                const val = Math.round(maxTrendVal * frac);
                return (
                  <g key={frac}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={chartW - padR}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 6}
                      y={y + 3}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="10"
                      className="font-mono-tabular"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {activeSeries.map((s) => {
                const pts = history.map((pt: any, idx: number) => {
                  const x = padL + (idx / Math.max(1, history.length - 1)) * plotW;
                  const y = padT + plotH - (Number(pt[s.key] ?? 0) / maxTrendVal) * plotH;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                });
                return (
                  <polyline
                    key={s.key}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={pts.join(' ')}
                  />
                );
              })}

              {hoverIdx != null && history[hoverIdx] && (
                <line
                  x1={padL + (hoverIdx / Math.max(1, history.length - 1)) * plotW}
                  y1={padT}
                  x2={padL + (hoverIdx / Math.max(1, history.length - 1)) * plotW}
                  y2={padT + plotH}
                  stroke="#475569"
                  strokeWidth="1"
                />
              )}

              {hoverIdx != null && history[hoverIdx] && activeSeries.map((s) => {
                const x = padL + (hoverIdx / Math.max(1, history.length - 1)) * plotW;
                const y = padT + plotH - (Number(history[hoverIdx][s.key] ?? 0) / maxTrendVal) * plotH;
                return (
                  <circle
                    key={`dot-${s.key}`}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={s.color}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                );
              })}

              {history.map((pt: any, idx: number) => {
                const sliceW = plotW / Math.max(1, history.length - 1);
                const x = padL + idx * sliceW - sliceW / 2;
                return (
                  <rect
                    key={`hit-${pt.tick}-${idx}`}
                    x={Math.max(padL, x)}
                    y={padT}
                    width={Math.max(4, sliceW)}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoverIdx(idx)}
                  />
                );
              })}

              <text
                x={padL}
                y={chartH - 6}
                fill="#64748b"
                fontSize="10"
                className="font-mono-tabular"
              >
                Y{history[0].year} (t{history[0].tick})
              </text>
              <text
                x={chartW - padR}
                y={chartH - 6}
                textAnchor="end"
                fill="#64748b"
                fontSize="10"
                className="font-mono-tabular"
              >
                Y{history[history.length - 1].year} (t{history[history.length - 1].tick})
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* Realm Ledger Comparison Table */}
      <div className="rounded-xl border border-white/10 bg-slate-900/75 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-sm font-bold text-slate-100">Realm Ledger Comparison</h3>
            <div className="text-[11px] text-slate-400">Click any settlement row to center the world camera</div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono-tabular">{settlements.length} active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[11px] text-slate-400 bg-slate-950/50">
                <th className="py-2 px-3 font-semibold">Realm</th>
                <th className="py-2 px-3 font-semibold">Era</th>
                <th className="py-2 px-3 font-semibold">Dominant Creed</th>
                <th className="py-2 px-3 font-semibold text-right">Pop</th>
                <th className="py-2 px-3 font-semibold text-right">Food</th>
                <th className="py-2 px-3 font-semibold text-right">Wood</th>
                <th className="py-2 px-3 font-semibold text-right">Ore</th>
                <th className="py-2 px-3 font-semibold text-right">Built</th>
                <th className="py-2 px-3 font-semibold text-right">Troops</th>
                <th className="py-2 px-3 font-semibold text-right">Wars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-400">
                    No active settlements currently exist in the world.
                  </td>
                </tr>
              ) : (
                settlements.map((s: any) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      if (onPanTo) {
                        onPanTo(s.x, s.y);
                        onClose();
                      }
                    }}
                    className="hover:bg-slate-800/70 cursor-pointer transition-colors h-10"
                  >
                    <td
                      className="py-2 px-3 font-semibold text-slate-100 whitespace-nowrap"
                      onClick={editingSid === s.id ? (ev) => ev.stopPropagation() : undefined}
                    >
                      {editingSid === s.id ? (
                        <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                          <input
                            type="text"
                            value={draftRealmName}
                            maxLength={40}
                            autoFocus
                            onChange={(ev) => setDraftRealmName(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter' && draftRealmName.trim()) {
                                onRenameSettlement?.(s.id, draftRealmName.trim());
                                setEditingSid(null);
                                setRenameRev((r) => r + 1);
                              } else if (ev.key === 'Escape') {
                                setEditingSid(null);
                              }
                            }}
                            className="w-32 px-1.5 py-0.5 rounded bg-slate-900 border border-sky-400/60 text-slate-50 text-xs outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (draftRealmName.trim()) {
                                onRenameSettlement?.(s.id, draftRealmName.trim());
                                setRenameRev((r) => r + 1);
                              }
                              setEditingSid(null);
                            }}
                            className="px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[10px] font-bold border-0 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span>{s.tierIcon} {s.name}</span>
                          {onRenameSettlement && (
                            <button
                              type="button"
                              title="Rename settlement"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setDraftRealmName(s.name || '');
                                setEditingSid(s.id);
                              }}
                              className="px-1 py-0.5 rounded bg-slate-800/90 border border-white/15 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                            >
                              ✏️
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                      {s.eraIcon} {s.eraName}
                    </td>
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                      {s.creedIcon} {s.creedName}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-sky-300 font-semibold">
                      {s.population}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-slate-200">{s.food}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-slate-200">{s.wood}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-slate-200">{s.ore}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-emerald-300">{s.buildingsCount}</td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-slate-200">{s.soldiersCount}</td>
                    <td
                      className={`py-2 px-3 text-right font-mono-tabular font-semibold ${
                        s.activeWars > 0 ? 'text-rose-400' : 'text-slate-500'
                      }`}
                    >
                      {s.activeWars}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
