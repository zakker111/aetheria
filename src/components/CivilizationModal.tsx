import React, { useState, useMemo } from 'react';
import { Simulation } from '../simulation/simulation.js';

interface CivilizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulation: any;
  onSelectAgent?: (id: number) => void;
  onPanTo?: (x: number, y: number) => void;
}

export const CivilizationModal: React.FC<CivilizationModalProps> = ({
  isOpen,
  onClose,
  simulation,
  onSelectAgent,
  onPanTo,
}) => {
  const [activeTab, setActiveTab] = useState<'dynasties' | 'diplomacy' | 'warroom'>('dynasties');
  const [selectedDynastyId, setSelectedDynastyId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedSettlementId, setSelectedSettlementId] = useState<number | null>(null);
  const [marriageTargetDynastyId, setMarriageTargetDynastyId] = useState<number | null>(null);

  if (!isOpen || !simulation) return null;

  const sim = simulation;
  const dynasties = sim.dynastySystem ? Array.from(sim.dynastySystem.dynasties.values()) : [];
  const settlements = sim.settlementSystem ? Array.from(sim.settlementSystem.settlements.values()) : [];
  const wars = sim.diplomacySystem ? sim.diplomacySystem.activeWars || [] : [];
  const warHistory = sim.diplomacySystem ? sim.diplomacySystem.warHistory || [] : [];
  const treaties = sim.diplomacySystem ? sim.diplomacySystem.treaties || [] : [];

  // Default selected dynasty to first available
  const currentDynasty = selectedDynastyId 
    ? dynasties.find(d => d.id === selectedDynastyId) || dynasties[0]
    : dynasties[0];

  const currentSettlement = settlements.find(s => s.id === currentDynasty?.settlementId);

  // Helper to arrange royal marriage
  const handleArrangeMarriage = (dynAId: number, dynBId: number) => {
    if (!sim.dynastySystem) return;
    const record = sim.dynastySystem.arrangeRoyalMarriage(dynAId, dynBId);
    if (record) {
      setMarriageTargetDynastyId(null);
    }
  };

  // Helper to convene peace conference
  const handleConveneConference = (s1Id: number, s2Id: number) => {
    if (!sim.diplomacySystem) return;
    sim.diplomacySystem.convenePeaceConference(s1Id, s2Id, null, "Diplomatic Mediation");
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(10, 15, 29, 0.94)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #d97706, #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            👑
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: '#f8fafc',
              }}
            >
              Imperial Chancellery & Realm Chronicles
            </h1>
            <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span>{settlements.length} Sovereign Settlements</span>
              <span aria-hidden="true">·</span>
              <span>{dynasties.length} Ruling Dynasties</span>
              <span aria-hidden="true">·</span>
              <span>{wars.length} Active Wars</span>
              {sim.mortalityStats && sim.mortalityStats.totalDeaths > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span style={{ color: '#cbd5e1' }}>
                    💀 Avg Death Age: <strong style={{ color: '#fbbf24' }}>{sim.mortalityStats.averageAgeAtDeath.toFixed(1)}y</strong> ({sim.mortalityStats.totalDeaths} deaths)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(30, 41, 59, 0.7)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            onClick={() => setActiveTab('dynasties')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'dynasties' ? '#38bdf8' : 'transparent',
              color: activeTab === 'dynasties' ? '#0f172a' : '#cbd5e1',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>👑</span>
            <span>Dynasties & Lineages</span>
          </button>

          <button
            onClick={() => setActiveTab('diplomacy')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'diplomacy' ? '#38bdf8' : 'transparent',
              color: activeTab === 'diplomacy' ? '#0f172a' : '#cbd5e1',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🌐</span>
            <span>Realpolitik Network</span>
          </button>

          <button
            onClick={() => setActiveTab('warroom')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'warroom' ? '#f43f5e' : 'transparent',
              color: activeTab === 'warroom' ? '#ffffff' : '#cbd5e1',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>⚔️</span>
            <span>War Room & Sieges ({wars.length})</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#cbd5e1',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            transition: 'background 0.15s',
          }}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Main Content Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* ========================================================== */}
        {/* TAB 1: DYNASTIES & LINEAGE TREES */}
        {/* ========================================================== */}
        {activeTab === 'dynasties' && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* Left Sidebar: House Selector & Monarch Dossier */}
            <div
              style={{
                width: '360px',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.4)',
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', fontWeight: 700 }}>
                  Select Noble House
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {dynasties.map(dyn => {
                    const isSelected = (currentDynasty?.id === dyn.id);
                    return (
                      <button
                        key={dyn.id}
                        onClick={() => { setSelectedDynastyId(dyn.id); setSelectedNodeId(null); }}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.4)',
                          color: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{dyn.coatOfArms?.symbol || '👑'}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{dyn.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{dyn.settlementName}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
                          Legitimacy {Math.round(dyn.legitimacy)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {currentDynasty && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: currentDynasty.coatOfArms?.bannerColor || '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '26px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      {currentDynasty.coatOfArms?.symbol || '👑'}
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                        {currentDynasty.name}
                      </div>
                      <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#cbd5e1' }}>
                        "{currentDynasty.motto}"
                      </div>
                    </div>
                  </div>

                  {/* Monarch Details */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>REIGNING MONARCH</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      {currentDynasty.monarchTitle} {currentDynasty.monarchName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      Succession: {currentDynasty.successionLaw === 'primogeniture' ? 'Hereditary Primogeniture' : 'Elective'}
                    </div>
                  </div>

                  {/* Consort & Designated Heir */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                    <div style={{ padding: '8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>ROYAL CONSORT</div>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{currentDynasty.consortName || 'Unmarried'}</div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>DESIGNATED HEIR</div>
                      <div style={{ fontWeight: 600, color: '#38bdf8' }}>{currentDynasty.heirName || 'None'}</div>
                    </div>
                  </div>

                  {/* Legitimacy Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      <span>Royal Legitimacy</span>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{Math.round(currentDynasty.legitimacy)}%</span>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(5, Math.min(100, currentDynasty.legitimacy))}%`,
                          background: currentDynasty.legitimacy > 60 ? '#10b981' : currentDynasty.legitimacy > 35 ? '#f59e0b' : '#ef4444',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Action: Arrange Royal Marriage */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                      Forge non-aggression peace pact via royal marriage:
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select
                        value={marriageTargetDynastyId || ''}
                        onChange={(e) => setMarriageTargetDynastyId(Number(e.target.value))}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '11px',
                        }}
                      >
                        <option value="">Select Rival House...</option>
                        {dynasties.filter(d => d.id !== currentDynasty.id).map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.settlementName})</option>
                        ))}
                      </select>
                      <button
                        disabled={!marriageTargetDynastyId}
                        onClick={() => marriageTargetDynastyId && handleArrangeMarriage(currentDynasty.id, marriageTargetDynastyId)}
                        style={{
                          padding: '6px 12px',
                          background: marriageTargetDynastyId ? '#38bdf8' : '#334155',
                          color: marriageTargetDynastyId ? '#0f172a' : '#64748b',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '11px',
                          cursor: marriageTargetDynastyId ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Seal Pact
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Zone: Interactive SVG Lineage Family Tree */}
            <div
              style={{
                flex: 1,
                padding: '24px',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                background: 'radial-gradient(ellipse at 50% 20%, rgba(30, 41, 59, 0.4), rgba(11, 15, 25, 0.95))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                    Royal Lineage & Bloodline Tree — {currentDynasty?.name}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Click any noble to inspect title, age, succession position, or pan to map.
                  </div>
                </div>
                {currentSettlement && onPanTo && (
                  <button
                    onClick={() => onPanTo(currentSettlement.center.x, currentSettlement.center.y)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📍 Pan to Capital ({currentSettlement.name})
                  </button>
                )}
              </div>

              {/* Interactive SVG Tree Canvas */}
              <div
                style={{
                  flex: 1,
                  minHeight: '480px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  position: 'relative',
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {currentDynasty?.lineage && currentDynasty.lineage.length > 0 ? (
                  <svg width="780" height="420" viewBox="0 0 780 420" style={{ maxWidth: '100%', height: 'auto' }}>
                    <defs>
                      <linearGradient id="royalGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                      <linearGradient id="monarchNode" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                      </linearGradient>
                    </defs>

                    {/* Genealogical Connection Lines */}
                    {/* Founder to Children */}
                    <path
                      d="M 390 115 L 390 190 M 230 190 L 550 190 M 230 190 L 230 250 M 390 190 L 390 250 M 550 190 L 550 250"
                      stroke="#475569"
                      strokeWidth="2"
                      fill="none"
                    />

                    {/* Marriage Bridge: Monarch to Consort */}
                    <path
                      d="M 330 85 L 230 85"
                      stroke="#d97706"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      fill="none"
                    />

                    {/* Nodes Rendering */}
                    {/* Monarch Node (Center Top) */}
                    <g
                      transform="translate(330, 50)"
                      onClick={() => setSelectedNodeId(currentDynasty.monarchId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        width="140"
                        height="64"
                        rx="8"
                        fill="url(#monarchNode)"
                        stroke={selectedNodeId === currentDynasty.monarchId ? '#38bdf8' : '#f59e0b'}
                        strokeWidth="2"
                      />
                      <text x="12" y="24" fill="#fbbf24" fontSize="11" fontWeight="700">👑 MONARCH</text>
                      <text x="12" y="44" fill="#f8fafc" fontSize="13" fontWeight="600">{currentDynasty.monarchName}</text>
                    </g>

                    {/* Consort Node (Left Top) */}
                    <g
                      transform="translate(130, 50)"
                      onClick={() => currentDynasty.consortId && setSelectedNodeId(currentDynasty.consortId)}
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
                      <text x="12" y="24" fill="#94a3b8" fontSize="11" fontWeight="600">CONSORT</text>
                      <text x="12" y="44" fill="#f8fafc" fontSize="13" fontWeight="600">{currentDynasty.consortName || 'No Consort'}</text>
                    </g>

                    {/* Heirs / Children (Generation 2) */}
                    {currentDynasty.lineage.slice(1, 4).map((child, idx) => {
                      const posX = 160 + idx * 160;
                      const isHeir = (child.id === currentDynasty.heirId);
                      const isSelected = (selectedNodeId === child.id);
                      return (
                        <g
                          key={child.id}
                          transform={`translate(${posX}, 250)`}
                          onClick={() => setSelectedNodeId(child.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <rect
                            width="140"
                            height="64"
                            rx="8"
                            fill="#1e293b"
                            stroke={isSelected ? '#38bdf8' : isHeir ? '#38bdf8' : '#475569'}
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
                  <div style={{ color: '#64748b', fontSize: '13px' }}>No lineage records yet for this dynasty.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 2: REALPOLITIK NETWORK & DIPLOMACY */}
        {/* ========================================================== */}
        {activeTab === 'diplomacy' && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* Left Zone: Force-Directed Realm Graph Visualizer */}
            <div
              style={{
                flex: 1,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.5), rgba(10, 15, 29, 0.98))',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                    Diplomatic Realpolitik Network & Treaties
                  </h2>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Cyan = Alliance · Crimson = War · Gold = Vassalage · Dashed Slate = Truce
                  </div>
                </div>
              </div>

              {/* Realm Graph SVG */}
              <div
                style={{
                  flex: 1,
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <svg width="680" height="440" viewBox="0 0 680 440" style={{ maxWidth: '100%', height: 'auto' }}>
                  {/* Settlement Nodes Positions calculated in circular ring */}
                  {settlements.map((s1, i) => {
                    const angle1 = (i / settlements.length) * 2 * Math.PI - Math.PI / 2;
                    const x1 = 340 + Math.cos(angle1) * 160;
                    const y1 = 220 + Math.sin(angle1) * 140;

                    return settlements.slice(i + 1).map((s2, j) => {
                      const idx2 = i + 1 + j;
                      const angle2 = (idx2 / settlements.length) * 2 * Math.PI - Math.PI / 2;
                      const x2 = 340 + Math.cos(angle2) * 160;
                      const y2 = 220 + Math.sin(angle2) * 140;

                      const rel = sim.diplomacySystem?.getRelation(s1.id, s2.id);
                      if (!rel) return null;

                      let stroke = '#334155';
                      let strokeWidth = '1.5';
                      let strokeDash = '4 4';

                      if (rel.status === 'war') {
                        stroke = '#ef4444';
                        strokeWidth = '3';
                        strokeDash = 'none';
                      } else if (rel.status === 'alliance') {
                        stroke = '#38bdf8';
                        strokeWidth = '2.5';
                        strokeDash = 'none';
                      } else if (s1.overlordId === s2.id || s2.overlordId === s1.id) {
                        stroke = '#f59e0b';
                        strokeWidth = '2.5';
                        strokeDash = 'none';
                      }

                      return (
                        <line
                          key={`${s1.id}-${s2.id}`}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          strokeDasharray={strokeDash}
                        />
                      );
                    });
                  })}

                  {/* Nodes for each settlement */}
                  {settlements.map((s, i) => {
                    const angle = (i / settlements.length) * 2 * Math.PI - Math.PI / 2;
                    const x = 340 + Math.cos(angle) * 160;
                    const y = 220 + Math.sin(angle) * 140;
                    const isSelected = (selectedSettlementId === s.id);

                    return (
                      <g
                        key={s.id}
                        transform={`translate(${x}, ${y})`}
                        onClick={() => setSelectedSettlementId(s.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          r={isSelected ? 32 : 26}
                          fill="#0f172a"
                          stroke={s.bannerColor || '#38bdf8'}
                          strokeWidth={isSelected ? 3 : 2}
                        />
                        <text textAnchor="middle" y="6" fontSize="18">
                          {s.bannerSymbol || '🏰'}
                        </text>
                        <text
                          textAnchor="middle"
                          y="42"
                          fill="#f8fafc"
                          fontSize="12"
                          fontWeight="700"
                          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                        >
                          {s.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Right Zone: Treaties & Active Ledgers */}
            <div
              style={{
                width: '380px',
                padding: '20px',
                overflowY: 'auto',
                background: 'rgba(15, 23, 42, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                Active Treaties & Concordats ({treaties.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {treaties.length > 0 ? (
                  treaties.map((t, idx) => {
                    const s1 = settlements.find(s => s.id === t.settlements?.[0]);
                    const s2 = settlements.find(s => s.id === t.settlements?.[1]);
                    return (
                      <div
                        key={t.id || idx}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(30, 41, 59, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '12px' }}>
                            {t.type || 'Peace Treaty'}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {t.duration ? `${t.duration} days remaining` : 'Permanent'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginTop: '4px' }}>
                          {s1?.name || 'Realm'} & {s2?.name || 'Realm'}
                        </div>
                        {t.terms && (
                          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                            {t.terms}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#64748b', fontSize: '12px' }}>No formal treaties currently active.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 3: WAR ROOM, SIEGES & PEACE CONFERENCES */}
        {/* ========================================================== */}
        {activeTab === 'warroom' && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* Active Campaigns Column */}
            <div
              style={{
                flex: 1,
                padding: '24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  War Room & Live Campaigns ({wars.length})
                </h2>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Monitor ongoing frontlines, multi-stage town sieges, and dynamic War Scores.
                </div>
              </div>

              {wars.length > 0 ? (
                wars.map((w, idx) => {
                  const sAttacker = settlements.find(s => s.id === w.attackerId);
                  const sDefender = settlements.find(s => s.id === w.defenderId);
                  const score = sim.diplomacySystem ? sim.diplomacySystem.calculateWarScore(w) : 0;
                  const attCas = w.casualties?.[w.attackerId] || 0;
                  const defCas = w.casualties?.[w.defenderId] || 0;

                  // Find active warbands in this war
                  const warbands = sim.warfareSystem ? Array.from(sim.warfareSystem.warbands.values()).filter(wb =>
                    (wb.settlementId === w.attackerId && wb.targetSettlementId === w.defenderId) ||
                    (wb.settlementId === w.defenderId && wb.targetSettlementId === w.attackerId)
                  ) : [];

                  return (
                    <div
                      key={w.id || idx}
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        background: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                      }}
                    >
                      {/* Attacker vs Defender Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{sAttacker?.bannerSymbol || '⚔️'}</span>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>{w.attackerName}</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>(Aggressor)</span>
                          </div>
                        </div>

                        <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '14px' }}>VS</span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>{w.defenderName}</span>
                            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '6px' }}>(Defender)</span>
                          </div>
                          <span style={{ fontSize: '20px' }}>{sDefender?.bannerSymbol || '🛡️'}</span>
                        </div>
                      </div>

                      {/* Casus Belli */}
                      <div style={{ fontSize: '12px', color: '#cbd5e1', background: 'rgba(15, 23, 42, 0.5)', padding: '6px 10px', borderRadius: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>Casus Belli: </span>
                        <span style={{ fontWeight: 600 }}>{w.casusBelli}</span>
                      </div>

                      {/* Dynamic War Score Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                          <span>Attacker Favor</span>
                          <span style={{ fontWeight: 700, color: score > 0 ? '#38bdf8' : score < 0 ? '#ef4444' : '#f8fafc' }}>
                            War Score: {score > 0 ? `+${score}` : score}
                          </span>
                          <span>Defender Favor</span>
                        </div>
                        <div style={{ height: '8px', width: '100%', background: '#0f172a', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              bottom: 0,
                              width: '2px',
                              background: '#64748b',
                            }}
                          />
                          <div
                            style={{
                              height: '100%',
                              position: 'absolute',
                              left: score < 0 ? `${50 + (score / 2)}%` : '50%',
                              width: `${Math.abs(score) / 2}%`,
                              background: score > 0 ? '#38bdf8' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>

                      {/* Casualties & Plunder Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '10px' }}>CASUALTIES INFLICTED</div>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                            {w.attackerName}: {attCas} fallen · {w.defenderName}: {defCas} fallen
                          </div>
                        </div>

                        <div style={{ padding: '8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '10px' }}>PLUNDERED SPOILS</div>
                          <div style={{ fontWeight: 600, color: '#f59e0b' }}>
                            {w.plundered ? `${w.plundered.food || 0} food · ${w.plundered.wood || 0} wood · ${w.plundered.ore || 0} ore` : 'None'}
                          </div>
                        </div>
                      </div>

                      {/* Active Sieges Section */}
                      {warbands.filter(wb => wb.state === 'sieging').length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, marginBottom: '6px' }}>
                            🏰 ACTIVE SIEGES & FORTRESS BREACHES
                          </div>
                          {warbands.filter(wb => wb.state === 'sieging').map(wb => (
                            <div
                              key={wb.id}
                              style={{
                                padding: '8px 10px',
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: '6px',
                                fontSize: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600 }}>{wb.settlementName} Warband</span>
                                <span style={{ color: '#94a3b8', marginLeft: '6px' }}>
                                  ({wb.siegeStage === 'breach' ? 'Stage 2: Battering Ram Breach' : wb.siegeStage === 'assault' ? 'Stage 3: Town Hall Storming' : 'Stage 1: Encirclement & Starvation'})
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                                {wb.siegeTicks || 0} Siege Ticks
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Peace Action */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          onClick={() => handleConveneConference(w.attackerId, w.defenderId)}
                          style={{
                            padding: '8px 16px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Convene Peace Conference
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#64748b', fontSize: '13px' }}>The realm is currently at peace. No active wars.</div>
              )}
            </div>

            {/* War History Column */}
            <div
              style={{
                width: '380px',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.4)',
                padding: '20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                Concluded Wars & Historic Treaties ({warHistory.length})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {warHistory.length > 0 ? (
                  warHistory.map((h, idx) => {
                    const victor = settlements.find(s => s.id === h.winnerId);
                    return (
                      <div
                        key={h.id || idx}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(30, 41, 59, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                          <span>Concluded War</span>
                          <span>Day {Math.floor((h.endTick || 0) / 100)}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', marginTop: '4px' }}>
                          {h.attackerName} vs {h.defenderName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                          Victor: {victor ? victor.name : 'White Peace'}
                        </div>
                        {h.terms && (
                          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                            Terms: {h.terms}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#64748b', fontSize: '12px' }}>No historic wars recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
