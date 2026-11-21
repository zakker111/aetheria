import React, { useState } from 'react';
import { AgentDossier, AgentRelativeRef, InspectedEntityData } from '../types';
import { BUILDING_METADATA } from '../core/constants.js';

const BUILDING_META_MAP = BUILDING_METADATA as Record<string, any>;

interface InspectorPanelProps {
  data: InspectedEntityData | null;
  isFollowing?: boolean;
  onFollowAgent?: (agentId: number | null) => void;
  onSelectAgent?: (agentId: number) => void;
  onSelectBuilding?: (buildingId: number) => void;
  onPanTo?: (x: number, y: number) => void;
  onRallyWarband?: (settlementId: number) => void;
  onSpawnCitizens?: (settlementId: number, count: number) => void;
  onAdvanceWonder?: (settlementId: number) => void;
  onFortifySettlement?: (settlementId: number) => void;
  onUpgradeBuilding?: (buildingId: number) => void;
  onCommissionBuilding?: (settlementId: number, buildingType: string) => void;
  onClose: () => void;
}

type AgentTab = 'overview' | 'history' | 'combat' | 'bonds';

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  data,
  isFollowing = false,
  onFollowAgent,
  onSelectAgent,
  onSelectBuilding,
  onPanTo,
  onRallyWarband,
  onSpawnCitizens,
  onAdvanceWonder,
  onFortifySettlement,
  onUpgradeBuilding,
  onCommissionBuilding,
  onClose,
}) => {
  const [agentTab, setAgentTab] = useState<AgentTab>('overview');

  if (!data || !data.entity) return null;

  const e = data.entity;
  const dossier: AgentDossier | null = data.dossier || null;
  const isAlive = e.alive !== false && dossier?.alive !== false;

  const actionDescriptions: Record<string, string> = {
    gather_at_hearth: '🔥 Gathering around village hearth',
    visit_market: '🛍️ Browsing market square',
    pray_at_temple: '🙏 Praying at temple',
    watch_crafts: '🔨 Watching blacksmith forge',
    train_at_barracks: '🛡️ Practicing combat drills',
    patrol_settlement: '🛡️ Patrolling town perimeter',
    play_in_town: '🪁 Playing in town square',
    fetch_town_water: '🪣 Drawing well water',
    tend_town_farm: '🌾 Tending communal crops',
    deposit_to_stockpile: '📦 Hauling goods to stockpile',
    eat_from_stockpile: '🍞 Dining from granary',
    eat_from_inventory: '🍞 Eating meal',
    visit_neighbor: '💬 Visiting neighbor',
    socialize: '💬 Socializing with townspeople',
    go_home_and_rest: '💤 Resting in cottage bed',
    rest: '💤 Taking rest',
    chop_wood: '🪓 Chopping timber',
    mine_ore: '⛏️ Mining mineral deposit',
    gather_food: '🌾 Foraging supplies',
    hunt: '🏹 Stalking quarry',
    hunt_patrol: '🏹 Tracking roaming game',
    build: '🔨 Constructing building',
    reproduce: '❤️ Courting spouse',
    return_home: '🚶 Returning to settlement',
    wander: '🚶 Strolling around neighborhood',
  };

  const renderNeedBar = (label: string, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const color = clamped < 30 ? '#ef4444' : clamped < 60 ? '#f59e0b' : '#10b981';

    return (
      <div style={{ margin: '4px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#94a3b8',
            marginBottom: '2px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '5px',
            background: '#1e293b',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${clamped}%`,
              background: color,
              borderRadius: '3px',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      </div>
    );
  };

  const tabBtnStyle = (tab: AgentTab): React.CSSProperties => ({
    flex: 1,
    padding: '4px 6px',
    borderRadius: '5px',
    border: 'none',
    background: agentTab === tab ? '#38bdf8' : 'transparent',
    color: agentTab === tab ? '#0f172a' : '#94a3b8',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  });

  const renderRelChipList = (title: string, items: AgentRelativeRef[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {items.map((item) => (
            <button
              key={`${title}_${item.id}`}
              onClick={() => onSelectAgent && onSelectAgent(item.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                padding: '4px 8px',
                borderRadius: '5px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                fontSize: '11px',
                cursor: onSelectAgent ? 'pointer' : 'default',
              }}
            >
              <span>
                {item.name}
                {item.label ? ` · ${item.label}` : ''}
              </span>
              <span style={{ fontSize: '10px', color: item.alive ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
                {item.alive ? 'Living' : 'Fallen'}
                {item.score != null ? ` · ${item.score}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const traitsObj = dossier?.traits || e.personality || {};
  const traitEntries = Object.entries(traitsObj)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4);

  const skillsObj = dossier?.skills || e.skills || {};
  const skillEntries = Object.entries(skillsObj)
    .filter(([, v]) => typeof v === 'number' && Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5);

  const lifeEvents = (dossier?.lifeHistory || e.lifeHistory || []).slice().reverse();

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${!isAlive && data.kind === 'agent' ? 'rgba(248, 113, 113, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
        borderRadius: '12px',
        padding: '12px 14px',
        pointerEvents: 'auto',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        fontSize: '12px',
        maxHeight: '420px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontWeight: 600,
          color: !isAlive && data.kind === 'agent' ? '#fca5a5' : '#38bdf8',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '6px',
          fontSize: '13px',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.kind === 'agent' && (() => {
            const full = dossier?.fullName || `${e.name || 'Citizen'}${e.surname && !String(e.name || '').includes(e.surname) ? ` ${e.surname}` : ''}${e.epithet ? ` ${e.epithet}` : ''}`;
            return `${isAlive ? '👤' : '🕯️'} ${full}`;
          })()}
          {data.kind === 'settlement' && `${e.tierIcon || '🏡'} ${e.name} (${e.ruined ? 'Collapsed Ruins' : (e.tier || 'Village')})`}
          {data.kind === 'building' && (() => {
            const bType = e.buildingType || e.type;
            const bMeta = BUILDING_META_MAP[bType];
            const lvl = e.level || 1;
            const maxLvl = e.maxLevel || bMeta?.maxLevel || 3;
            return `${bMeta?.icon || '🏛️'} ${bMeta?.name || bType} · Lv ${lvl}/${maxLvl}`;
          })()}
          {data.kind === 'resource' &&
            `${e.resourceType === 'food' ? '🌾' : e.resourceType === 'wood' ? '🌲' : e.resourceType === 'ore' ? '⛏️' : '💧'} ${e.label || e.resourceType?.toUpperCase()}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {data.kind === 'agent' && isAlive && onFollowAgent && (
            <button
              onClick={() => onFollowAgent(e.id)}
              style={{
                background: isFollowing ? '#0284c7' : 'rgba(56, 189, 248, 0.14)',
                border: `1px solid ${isFollowing ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)'}`,
                color: isFollowing ? '#ffffff' : '#38bdf8',
                borderRadius: '5px',
                padding: '2px 7px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
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
        </div>
      </div>

      {data.kind === 'agent' && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'rgba(30, 41, 59, 0.7)',
            padding: '3px',
            borderRadius: '7px',
            marginBottom: '8px',
            flexShrink: 0,
          }}
        >
          <button style={tabBtnStyle('overview')} onClick={() => setAgentTab('overview')}>
            Overview
          </button>
          <button style={tabBtnStyle('history')} onClick={() => setAgentTab('history')}>
            History ({lifeEvents.length})
          </button>
          <button style={tabBtnStyle('combat')} onClick={() => setAgentTab('combat')}>
            Combat
          </button>
          <button style={tabBtnStyle('bonds')} onClick={() => setAgentTab('bonds')}>
            Bonds
          </button>
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {data.kind === 'agent' && (
          <div>
            {!isAlive && (
              <div
                style={{
                  background: 'rgba(127, 29, 29, 0.3)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  borderRadius: '7px',
                  padding: '8px',
                  marginBottom: '8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#fecaca' }}>
                  🕯️ Fallen Memorial
                </div>
                <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  Age {Math.floor(dossier?.age ?? e.age ?? 0)} · Cause: {dossier?.deathCause || e.deathCause || 'Natural'}
                  {dossier?.deathTick != null ? ` · Tick ${dossier.deathTick}` : ''}
                </div>
                <div style={{ fontSize: '10px', color: '#fca5a5', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                  Legacy: {dossier?.kills ?? e.kills ?? 0} Kills · {dossier?.battlesFought ?? e.battlesFought ?? 0} Battles · {dossier?.buildingsBuilt ?? e.buildingsBuilt ?? 0} Built · {dossier?.settlementName || 'Wilds'}
                </div>
                {dossier?.biography && (
                  <div style={{ fontSize: '10px', color: '#f1f5f9', marginTop: '5px', fontStyle: 'italic', lineHeight: 1.45, borderTop: '1px solid rgba(248, 113, 113, 0.2)', paddingTop: '4px' }}>
                    “{dossier.biography}”
                  </div>
                )}
              </div>
            )}

            {agentTab === 'overview' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ color: isAlive ? '#86efac' : '#fca5a5', fontSize: '11px', fontWeight: 700 }}>
                    {isAlive ? `${e.lifeStage || 'adult'} · Age ${Math.floor(e.age || 0)}` : 'Deceased'}
                    {dossier?.settlementName ? ` · ${dossier.settlementName}` : ''}
                  </span>
                  <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '11px' }}>
                    {dossier?.jobTitle || e.job || 'Civilian'}
                  </span>
                </div>

                {isAlive && dossier?.biography && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#cbd5e1',
                      background: 'rgba(30, 41, 59, 0.5)',
                      borderLeft: '2px solid rgba(56, 189, 248, 0.5)',
                      padding: '5px 7px',
                      borderRadius: '0 5px 5px 0',
                      marginBottom: '8px',
                      lineHeight: 1.45,
                    }}
                  >
                    {dossier.biography}
                  </div>
                )}

                {isAlive && e.needs && (
                  <>
                    {renderNeedBar('Food', e.needs.food)}
                    {renderNeedBar('Water', e.needs.water)}
                    {renderNeedBar('Rest', e.needs.rest)}
                    {renderNeedBar('Social', e.needs.social)}
                  </>
                )}

                {traitEntries.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Traits: </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {traitEntries.map(([k, v]) => `${k} ${Math.round(Number(v) * 100)}%`).join(' · ')}
                    </span>
                  </div>
                )}

                {skillEntries.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#cbd5e1' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Skills: </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {skillEntries.map(([k, v]) => `${k} ${Math.round(Number(v))}`).join(' · ')}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '6px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {typeof e.x === 'number' && typeof e.y === 'number' && (
                    <div>
                      📍 Position: ({e.x.toFixed(1)}, {e.y.toFixed(1)}) · Gen {dossier?.generation ?? e.generation ?? 1}
                    </div>
                  )}
                  <div>
                    👶 Children: {dossier?.children?.length ?? e.children ?? 0}
                    {(dossier?.buildingsBuilt ?? e.buildingsBuilt ?? 0) > 0
                      ? ` · 🔨 Built: ${dossier?.buildingsBuilt ?? e.buildingsBuilt}`
                      : ''}
                    {dossier?.faith ? ` · 🙏 Faith ${dossier.faith}%${dossier.beliefId ? ` (${dossier.beliefId})` : ''}` : ''}
                  </div>
                  {(dossier?.heirloom || e.heirloom) && (() => {
                    const hl = dossier?.heirloom || e.heirloom;
                    return (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ color: '#fbbf24', fontWeight: 600 }}>
                          💍 Heirloom: {hl.name}
                          {hl.inheritedFrom ? ` · From ${hl.inheritedFrom}` : ''}
                        </div>
                        {(hl.originName || hl.originYear || (hl.generationsHeld && hl.generationsHeld > 1)) && (
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {hl.originName ? `Forged by ${hl.originName}` : 'Ancestral Relic'}
                            {hl.originYear ? ` (Year ${hl.originYear})` : ''}
                            {hl.generationsHeld ? ` · Held ${hl.generationsHeld} gen` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {Array.isArray(dossier?.builtStructures) && dossier.builtStructures.length > 0 && (
                    <div
                      style={{
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Architectural Works ({dossier.builtStructures.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dossier.builtStructures.slice(0, 6).map((b) => {
                          const bMeta = BUILDING_META_MAP[b.buildingType];
                          return (
                            <div
                              key={`built_${b.id}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 6px',
                                borderRadius: '5px',
                                background: 'rgba(30, 41, 59, 0.55)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px' }}>
                                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                                  {bMeta?.icon || '🏛️'} {b.name}
                                </span>
                                <span style={{ color: '#94a3b8' }}>
                                  {' '}· Lv {b.level}/{b.maxLevel}
                                  {b.builtYear ? ` · Y${b.builtYear}` : ''}
                                  {b.isRuined ? ' · Ruined' : ''}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                {onSelectBuilding && (
                                  <button
                                    onClick={() => onSelectBuilding(b.id)}
                                    style={{
                                      background: 'rgba(56, 189, 248, 0.14)',
                                      border: '1px solid rgba(56, 189, 248, 0.35)',
                                      borderRadius: '4px',
                                      color: '#38bdf8',
                                      fontSize: '9px',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Inspect
                                  </button>
                                )}
                                {!onSelectBuilding && onPanTo && (
                                  <button
                                    onClick={() => onPanTo(b.x, b.y)}
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.14)',
                                      border: '1px solid rgba(245, 158, 11, 0.35)',
                                      borderRadius: '4px',
                                      color: '#fbbf24',
                                      fontSize: '9px',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Locate
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {isAlive && e.inventory && (
                    <div style={{ marginTop: '4px' }}>
                      🎒 Stock: 🌲 {e.inventory?.wood_log || 0} · ⛏️ {e.inventory?.ore_iron || 0} · 🌾 {e.inventory?.wheat || 0} · 🥩 {e.inventory?.meat || 0}
                    </div>
                  )}
                  {isAlive && (
                    <div style={{ marginTop: '4px', fontWeight: 600, color: '#38bdf8' }}>
                      🧠{' '}
                      {actionDescriptions[e.currentAction?.type] ||
                        (e.currentAction?.type
                          ? String(e.currentAction.type).replace(/_/g, ' ')
                          : 'Observing community')}
                    </div>
                  )}
                </div>
              </>
            )}

            {agentTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lifeEvents.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>No recorded life milestones yet.</div>
                ) : (
                  lifeEvents.map((ev, idx) => (
                    <div
                      key={`${ev.tick}_${ev.kind}_${idx}`}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: ev.milestone ? 'rgba(56, 189, 248, 0.08)' : 'rgba(30, 41, 59, 0.55)',
                        border: `1px solid ${ev.milestone ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                        <span>{ev.icon || '📜'} {ev.kind}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {ev.eraName && (
                            <span style={{ padding: '1px 4px', borderRadius: '3px', background: 'rgba(148, 163, 184, 0.14)', color: '#cbd5e1', fontSize: '9px' }}>
                              {ev.eraIcon ? `${ev.eraIcon} ` : ''}{ev.eraName}
                            </span>
                          )}
                          <span>Year {ev.year} · T{ev.tick}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#f1f5f9', marginTop: '2px' }}>{ev.text}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {agentTab === 'combat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div style={{ padding: '7px', borderRadius: '6px', background: 'rgba(30, 41, 59, 0.6)' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>KILLS</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>{dossier?.kills ?? e.kills ?? 0}</div>
                  </div>
                  <div style={{ padding: '7px', borderRadius: '6px', background: 'rgba(30, 41, 59, 0.6)' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>BATTLES FOUGHT</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>{dossier?.battlesFought ?? e.battlesFought ?? 0}</div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.6 }}>
                  {(() => {
                    const rawRole = dossier?.combatRole || e.combatRole || 'Militia';
                    const roleMap: Record<string, string> = {
                      tank: 'Battle Tank',
                      plane: 'Strike Aircraft',
                      artillery: 'Rocket Artillery',
                      rifle: 'Rifleman',
                      musket: 'Musketeer',
                      halberdier: 'Halberdier',
                      crossbow: 'Crossbowman',
                      knight: 'Heavy Knight',
                      catapult: 'Siege Catapult',
                      cavalry: 'Cavalry',
                      archer: 'Archer',
                      vanguard: 'Vanguard',
                    };
                    const roleLabel = roleMap[String(rawRole)] || String(rawRole);
                    return (
                      <div>
                        🎖️ Campaigns: {dossier?.veteranCampaigns ?? e.veteranCampaigns ?? 0} · Role: <b>{roleLabel}</b>
                      </div>
                    );
                  })()}
                  {e.combat && isAlive && (
                    <div>
                      ⚔️ Stats: DMG {Math.round(e.combat.damage || 10)} · Range {Number(e.combat.range || e.combat.attackRange || 1.5).toFixed(1)} · Speed {Number(e.combat.speedMultiplier || e.combat.speedMult || 1).toFixed(2)}x
                      {e.combat.isFlying ? ' · ✈️ Air Overflight' : e.combat.weaponType === 'tank' ? ' · 🛡️ Heavy Armor' : ''}
                    </div>
                  )}
                  <div>⭐ Reputation: {dossier?.reputation ?? Math.round(e.reputation || 0)}</div>
                  {(dossier?.legendaryWeapon || e.legendaryWeapon) && (
                    <div style={{ color: '#fbbf24', fontWeight: 600 }}>
                      🗡️ Relic Blade: {dossier?.legendaryWeapon || e.legendaryWeapon}
                    </div>
                  )}
                  {(dossier?.isMonarch || e.isMonarch) && <div style={{ color: '#fbbf24' }}>👑 Reigning Monarch</div>}
                  {(dossier?.isRebel || e.isRebel) && <div style={{ color: '#f87171' }}>🔥 Rebel Insurgent</div>}
                  {(dossier?.captive || e.captive) && <div style={{ color: '#fca5a5' }}>⛓️ Prisoner of War</div>}
                  {e.wounded && <div style={{ color: '#f87171' }}>🩸 Wounded in Combat</div>}
                </div>
              </div>
            )}

            {agentTab === 'bonds' && (
              <div>
                {(dossier?.surname || e.surname) && (
                  <div
                    style={{
                      marginBottom: '8px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      background: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(56, 189, 248, 0.22)',
                      fontSize: '11px',
                      color: '#bae6fd',
                      fontWeight: 600,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>🛡️ House {dossier?.surname || e.surname}</span>
                    <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                      Generation {dossier?.generation ?? e.generation ?? 1}
                    </span>
                  </div>
                )}
                {dossier?.spouse && renderRelChipList('Spouse', [dossier.spouse])}
                {dossier?.parents && renderRelChipList('Parents', dossier.parents)}
                {dossier?.children && renderRelChipList('Children', dossier.children)}
                {dossier?.siblings && renderRelChipList('Siblings', dossier.siblings)}
                {dossier?.friends && renderRelChipList('Friends & Allies', dossier.friends)}
                {dossier?.rivals && renderRelChipList('Rivals', dossier.rivals)}
                {!dossier?.spouse &&
                  !dossier?.parents?.length &&
                  !dossier?.children?.length &&
                  !dossier?.siblings?.length &&
                  !dossier?.friends?.length &&
                  !dossier?.rivals?.length && (
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>No close blood ties or rivalries recorded yet.</div>
                  )}
              </div>
            )}
          </div>
        )}

        {data.kind === 'settlement' && (
          <div>
            {e.ruined && (
              <div
                style={{
                  background: 'rgba(127, 29, 29, 0.28)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  borderRadius: '6px',
                  padding: '7px 8px',
                  marginBottom: '8px',
                  fontSize: '11px',
                  color: '#fecaca',
                }}
              >
                🏚️ Settlement Collapsed ({e.collapseReason || 'Total destruction'})
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                gap: '6px',
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  border: `1px solid ${e.bannerColor || '#38bdf8'}`,
                  background: `${e.bannerColor || '#38bdf8'}22`,
                  color: '#f8fafc',
                }}
              >
                {e.culture?.symbol || '⭐'} {e.culture?.ethos || 'Emergent Clan'}
              </span>
              <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '11px' }}>
                👑 {e.leadershipTitle || 'Leader'}: {e.leadership || 'Council'}
              </span>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '8px',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
                COMMUNAL STOCKPILE & GRANARY
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                <div>
                  🌾 Food: <b style={{ color: '#22c55e' }}>{e.stockpile?.food || 0}</b>
                </div>
                <div>
                  🌲 Wood: <b style={{ color: '#f59e0b' }}>{e.stockpile?.wood || 0}</b>
                </div>
                <div>
                  ⛏️ Ore: <b style={{ color: '#94a3b8' }}>{e.stockpile?.ore || 0}</b>
                </div>
                <div>
                  🪨 Stone: <b style={{ color: '#cbd5e1' }}>{e.stockpile?.stone || 0}</b>
                </div>
              </div>
            </div>

            {e.age && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${e.age.color || '#eab308'}44`,
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: e.age.color || '#eab308', fontSize: '11px' }}>
                    {e.age.icon} {e.age.name}
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>Era {e.age.id}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '6px' }}>
                  {e.age.description}
                </div>
                {e.age.wonder ? (
                  <div style={{ marginTop: '4px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '10px', color: '#38bdf8', display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                      <span>{e.age.wonder.icon} {e.age.wonder.name}</span>
                      <span style={{ fontWeight: 600 }}>
                        {e.age.wonder.complete ? 'Completed' : `Stage ${e.age.wonder.stage}/${e.age.wonder.maxStage} (${Math.round(e.age.wonder.progress || 0)}%)`}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#86efac', marginTop: '2px' }}>
                      Buff: {e.age.wonder.buffLabel}
                    </div>
                    {!e.age.wonder.complete && onAdvanceWonder && (
                      <button
                        onClick={() => onAdvanceWonder(e.id)}
                        style={{
                          marginTop: '5px',
                          background: 'rgba(56, 189, 248, 0.14)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: '4px',
                          color: '#38bdf8',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '3px 7px',
                          cursor: 'pointer',
                        }}
                      >
                        Fund Wonder Construction
                      </button>
                    )}
                  </div>
                ) : (
                  e.age.monumentName && (
                    <div style={{ fontSize: '10px', color: '#38bdf8', display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
                      <span>Wonder: {e.age.monumentName}</span>
                      <span style={{ fontWeight: 600 }}>{e.age.hasMonument ? 'Complete' : `${e.age.monumentProgress || 0}%`}</span>
                    </div>
                  )
                )}
                {Array.isArray(e.age.heritageMonuments) && e.age.heritageMonuments.length > 0 && (
                  <div style={{ marginTop: '6px', paddingTop: '5px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#fde047', marginBottom: '3px' }}>
                      🏛️ Grand Landmarks & Heritage ({e.age.heritageMonuments.filter((m: any) => m.intact).length}/{e.age.heritageMonuments.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                      {e.age.heritageMonuments.map((m: any) => (
                        <div key={m.buildingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            {m.icon} {m.name} <span style={{ color: '#94a3b8' }}>(Era {m.eraId})</span>
                          </span>
                          <span style={{ color: m.intact ? (m.survivedToModern ? '#fde047' : '#86efac') : '#f87171', fontWeight: 600 }}>
                            {m.intact ? (m.survivedToModern ? 'Ancient Heritage' : 'Intact') : 'Ruined'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {e.guilds && (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '10px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                  Guild Factions & Intelligence
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>
                    ⚖️ Merchant Guild: {e.guilds.unlocked?.merchant ? 'Active (+25% Trade)' : 'Locked'}
                  </div>
                  <div>
                    📐 Masons Guild: {e.guilds.unlocked?.masons ? 'Active (+25% Wonders)' : 'Locked'}
                  </div>
                  <div>
                    🗡️ Shadow Syndicate: {e.guilds.unlocked?.shadows ? `Active · ${e.guilds.opsSuccess || 0} Ops` : 'Locked'}
                  </div>
                </div>
              </div>
            )}

            {e.fortifications && !e.ruined && (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid ${e.fortifications.breaches > 0 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(148, 163, 184, 0.25)'}`,
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '10px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  <span>🧱 {e.fortifications.hasWalls ? e.fortifications.tierName : 'Unfortified Perimeter'}</span>
                  <span style={{ color: e.fortifications.breaches > 0 ? '#fca5a5' : '#94a3b8' }}>
                    {e.fortifications.breaches > 0 ? `${e.fortifications.breaches} Breached` : `${e.fortifications.intactWalls} Walls`}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>🚪 {e.fortifications.intactGates} Gates · 🗼 {e.fortifications.towers} Watchtowers</span>
                  {e.fortifications.defenseMultiplier > 1 && (
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>+{Math.round((e.fortifications.defenseMultiplier - 1) * 100)}% Citadel</span>
                  )}
                </div>
                {onFortifySettlement && (
                  <button
                    onClick={() => onFortifySettlement(e.id)}
                    style={{
                      background: e.fortifications.breaches > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.25)',
                      border: `1px solid ${e.fortifications.breaches > 0 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(148, 163, 184, 0.4)'}`,
                      color: e.fortifications.breaches > 0 ? '#fde68a' : '#e2e8f0',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {e.fortifications.breaches > 0 ? '🔧 Repair Breaches & Fortify' : e.fortifications.hasWalls ? '🧱 Reinforce Perimeter' : '🧱 Fortify Perimeter'}
                  </button>
                )}
              </div>
            )}

            {e.tributeTo && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  marginBottom: '10px',
                  fontSize: '10px',
                  color: '#fde68a',
                  fontWeight: 600,
                }}
              >
                👑 Tributary Vassal · Remitting {Math.round((e.tributeRate || 0.15) * 100)}% seasonal tribute to Overlord #{e.tributeTo}
              </div>
            )}

            {e.nuclearProgram && (e.age?.id >= 5 || e.nuclearProgram.unlocked || e.nuclearProgram.warheads > 0) && (() => {
              const infra = e.age?.nuclearInfra || e.nuclearProgram.infra;
              const checkItem = (ok: boolean | undefined, label: string) => (
                <span style={{ color: ok ? '#86efac' : '#f59e0b' }}>
                  {ok ? '✓' : '○'} {label}
                </span>
              );
              return (
                <div
                  style={{
                    background: 'rgba(132, 204, 22, 0.08)',
                    border: '1px solid rgba(132, 204, 22, 0.35)',
                    borderRadius: '6px',
                    padding: '8px',
                    marginBottom: '10px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#bef264' }}>
                    <span>☢️ Atomic Program</span>
                    <span>{e.nuclearProgram.warheads || 0} Warheads</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px' }}>
                    {e.nuclearProgram.unlocked
                      ? infra && !infra.canEnrich
                        ? `Enrichment Stalled (Requires Factory + Nuclear Plant) · Strikes: ${e.nuclearProgram.totalStrikes || 0}`
                        : `Enrichment: ${Math.round(e.nuclearProgram.progress || 0)}% · Strikes Launched: ${e.nuclearProgram.totalStrikes || 0}`
                      : 'Unlocks in Era 6 (Modern Era)'}
                  </div>
                  {infra && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: '10px', marginTop: '5px', paddingTop: '4px', borderTop: '1px solid rgba(132, 204, 22, 0.2)' }}>
                      {checkItem(infra.hasFactory, '🏭 Factory')}
                      {checkItem(infra.hasNuclearPlant, '☢️ Nuclear Plant')}
                      {checkItem(infra.hasResearchLab, '🔬 Research Lab')}
                      {checkItem(infra.hasMissileSilo, '🚀 Missile Silo')}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                CULTURAL DIMENSIONS
              </div>
              {renderNeedBar('Industriousness', (e.culture?.values?.industriousness || 0.5) * 100)}
              {renderNeedBar('Cooperation', (e.culture?.values?.cooperation || 0.5) * 100)}
              {renderNeedBar('Spirituality', (e.culture?.values?.spirituality || 0.5) * 100)}
              {renderNeedBar('Belligerence', (e.culture?.values?.belligerence || 0.5) * 100)}
            </div>

            {e.culture?.traditions && e.culture.traditions.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  ACTIVE TRADITIONS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {e.culture.traditions.map((t: string, idx: number) => (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 6px',
                        background: '#15803d',
                        color: '#bbf7d0',
                        borderRadius: '4px',
                        fontSize: '10px',
                      }}
                    >
                      📜 {String(t).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(onRallyWarband || onSpawnCitizens) && !e.ruined && (
              <div
                style={{
                  marginBottom: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  CIVIC &amp; MILITARY COMMAND
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {onRallyWarband && (
                    <button
                      onClick={() => onRallyWarband(e.id)}
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🛡️ Rally Warband
                    </button>
                  )}
                  {onSpawnCitizens && (
                    <>
                      <button
                        onClick={() => onSpawnCitizens(e.id, 1)}
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '10px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        👤 +1 Citizen
                      </button>
                      <button
                        onClick={() => onSpawnCitizens(e.id, 5)}
                        style={{
                          background: '#0f766e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '10px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        👥 +5 Citizens
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {onCommissionBuilding && !e.ruined && (() => {
              const curEra = e.age?.id || 1;
              const catalogKeys = [
                'granary', 'windmill', 'inn', 'library',
                'apothecary', 'castle', 'bank', 'factory',
                'research_lab', 'radar_station', 'nuclear_plant', 'missile_silo'
              ];
              return (
                <div
                  style={{
                    marginBottom: '8px',
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: '6px',
                    padding: '7px 8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#38bdf8', marginBottom: '5px' }}>
                    <span>🏗️ Commission Era Structures</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Era {curEra}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    {catalogKeys.map((bKey) => {
                      const m = BUILDING_META_MAP[bKey];
                      if (!m) return null;
                      const unlocked = curEra >= (m.minEra || 1);
                      return (
                        <button
                          key={bKey}
                          disabled={!unlocked}
                          title={unlocked ? `${m.name}: ${m.roleSummary}` : `Unlocks in Era ${m.minEra}`}
                          onClick={() => unlocked && onCommissionBuilding(e.id, bKey)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${unlocked ? 'rgba(56, 189, 248, 0.3)' : 'rgba(148, 163, 184, 0.14)'}`,
                            background: unlocked ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.4)',
                            color: unlocked ? '#e2e8f0' : '#64748b',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: unlocked ? 'pointer' : 'not-allowed',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.icon} {m.name}
                          </span>
                          <span style={{ fontSize: '9px', color: unlocked ? '#38bdf8' : '#64748b', flexShrink: 0 }}>
                            {unlocked ? `E${m.minEra}` : `🔒E${m.minEra}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#cbd5e1',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '6px',
                lineHeight: 1.6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div>
                👥 Population: <b>{e.population || (e.agentIds ? e.agentIds.size : 0)}</b> citizens ({e.growthTrend || 'stable'})
              </div>
              <div>
                🏛️ Buildings: <b>{e.buildings ? e.buildings.length : 0}</b> structures
                {e.urbanRadius ? ` · 🌆 Radius ${e.urbanRadius}t` : ''}
                {(() => {
                  const docks = e.docksCount ?? (Array.isArray(e.buildings) ? e.buildings.filter((b: any) => (b.buildingType || b.type) === 'dock' && !b.isRuined).length : 0);
                  const fleet = e.vesselsCount ?? 0;
                  if (docks === 0 && fleet === 0) return null;
                  return <span style={{ color: '#38bdf8' }}> · ⚓ {docks} docks · ⛵ {fleet} vessels</span>;
                })()}
              </div>
              <div>
                📍 Center: ({Math.floor(e.center?.x || 0)}, {Math.floor(e.center?.y || 0)})
              </div>
            </div>
          </div>
        )}

        {data.kind === 'building' && (() => {
          const bType = e.buildingType || e.type;
          const bMeta = BUILDING_META_MAP[bType];
          const lvl = e.level || 1;
          const maxLvl = e.maxLevel || bMeta?.maxLevel || 3;
          const tierName = bMeta?.levelNames?.[lvl - 1] || bMeta?.name || bType;
          const currentBonus = bMeta?.levelBonuses?.[lvl - 1];
          const upgradeReq = data.upgradeReq || null;
          const hp = Math.round(e.health ?? 100);
          const maxHp = Math.round(e.maxHealth ?? 100);

          return (
            <div>
              <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: e.isRuined ? '#7f1d1d' : e.complete ? '#15803d' : '#0369a1',
                    color: e.isRuined ? '#fecaca' : e.complete ? '#bbf7d0' : '#bae6fd',
                  }}
                >
                  {e.isRuined ? 'RUINED' : e.complete ? 'COMPLETED' : 'UNDER CONSTRUCTION'}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: lvl >= 3 ? 'rgba(251, 191, 36, 0.2)' : lvl === 2 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(100, 116, 139, 0.25)',
                    color: lvl >= 3 ? '#fbbf24' : lvl === 2 ? '#38bdf8' : '#cbd5e1',
                    border: `1px solid ${lvl >= 3 ? 'rgba(251, 191, 36, 0.45)' : lvl === 2 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                  }}
                >
                  Lv {lvl}/{maxLvl} · {tierName}
                </span>
                {bMeta?.minEra && (
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Era {bMeta.minEra}+</span>
                )}
                {(e.isHeritage || bMeta?.isMonument || String(bType || '').startsWith('monument_')) && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#fde047' }}>
                    · 🏛️ Heritage ({e.builtEraName || `Era ${e.builtInEra || bMeta?.minEra || 1}`})
                  </span>
                )}
              </div>

              {!e.complete && renderNeedBar('Construction', e.constructionProgress || 0)}
              {renderNeedBar(`Integrity (${hp} / ${maxHp} HP)`, (hp / Math.max(1, maxHp)) * 100)}

              <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.55, fontVariantNumeric: 'tabular-nums' }}>
                <div>
                  📍 Position: ({Math.floor(e.x)}, {Math.floor(e.y)})
                  {e.settlementName ? ` · ${e.settlementName}` : ''}
                  {e.capacity > 0 ? ` · 📦 Storage ${e.capacity}` : ''}
                </div>
                {e.dedication && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.25)',
                      color: '#fef08a',
                      fontSize: '10px',
                      fontStyle: 'italic',
                    }}
                  >
                    🏛️ Plaque: “{e.dedication}”
                  </div>
                )}
                {bMeta?.roleSummary && (
                  <div style={{ color: '#e2e8f0', marginTop: '4px' }}>
                    {bMeta.icon} <b>Society Role:</b> {bMeta.roleSummary}
                  </div>
                )}
                {currentBonus && (
                  <div style={{ color: '#86efac', marginTop: '3px', fontSize: '10px' }}>
                    ✦ Active Lv {lvl} Effect: {currentBonus}
                  </div>
                )}
                {(e.builtByName || e.upgradedByName || (Array.isArray(e.contributors) && e.contributors.length > 0) || (Array.isArray(e.upgradeHistory) && e.upgradeHistory.length > 0)) && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(30, 41, 59, 0.55)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      fontSize: '10px',
                      color: '#cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {e.builtByName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span>
                          🔨 Built by <b style={{ color: '#f8fafc' }}>{e.builtByName}</b>
                          {e.builtYear ? ` · Year ${e.builtYear}` : ''}
                          {e.builtEraName ? ` · ${e.builtEraName}` : ''}
                        </span>
                        {e.builtByAgentId != null && onSelectAgent && (
                          <button
                            onClick={() => onSelectAgent(e.builtByAgentId)}
                            style={{
                              background: 'rgba(56, 189, 248, 0.14)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              borderRadius: '4px',
                              color: '#38bdf8',
                              fontSize: '9px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            Inspect Builder
                          </button>
                        )}
                      </div>
                    )}
                    {Array.isArray(e.contributors) && e.contributors.length > 1 && (
                      <div style={{ color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                        <span>👥 Builders:</span>
                        {e.contributors.map((c: any, idx: number) =>
                          c?.id != null && onSelectAgent ? (
                            <button
                              key={`contrib_${c.id}_${idx}`}
                              onClick={() => onSelectAgent(c.id)}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(148, 163, 184, 0.28)',
                                borderRadius: '4px',
                                color: '#cbd5e1',
                                fontSize: '9px',
                                padding: '1px 5px',
                                cursor: 'pointer',
                              }}
                            >
                              {c.name}
                            </button>
                          ) : (
                            <span key={`contrib_${idx}`}>{c?.name}</span>
                          )
                        )}
                      </div>
                    )}
                    {e.upgradedByName && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
                        <span>⬆ Renovated under {e.upgradedByName}</span>
                        {e.upgradedByAgentId != null && onSelectAgent && (
                          <button
                            onClick={() => onSelectAgent(e.upgradedByAgentId)}
                            style={{
                              background: 'rgba(245, 158, 11, 0.14)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              borderRadius: '4px',
                              color: '#fbbf24',
                              fontSize: '9px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    )}
                    {Array.isArray(e.upgradeHistory) && e.upgradeHistory.length > 0 && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                          Renovation Ledger
                        </div>
                        {e.upgradeHistory.map((u: any, idx: number) => (
                          <div key={`up_${u.level}_${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                            <span>
                              Lv {u.level} · Year {u.year} · {u.eraName} · {u.byName}
                            </span>
                            {u.byAgentId != null && onSelectAgent && (
                              <button
                                onClick={() => onSelectAgent(u.byAgentId)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#38bdf8',
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Inspect
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {e.complete && !e.isRuined && lvl < maxLvl && upgradeReq && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px',
                    borderRadius: '6px',
                    background: 'rgba(30, 41, 59, 0.72)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
                    <span>⬆ Next: Lv {upgradeReq.nextLevel} ({upgradeReq.nextName})</span>
                    <span style={{ fontSize: '10px', color: upgradeReq.eraMet ? '#86efac' : '#f59e0b' }}>
                      Era {upgradeReq.requiredEra}+
                    </span>
                  </div>
                  {upgradeReq.nextBonus && (
                    <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '3px' }}>
                      {upgradeReq.nextBonus}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    Cost: 🌲 {upgradeReq.costs?.wood || 0} Wood · ⛏️ {upgradeReq.costs?.ore || 0} Ore
                  </div>
                  {onUpgradeBuilding && (
                    <button
                      disabled={!upgradeReq.eraMet}
                      onClick={() => onUpgradeBuilding(e.id)}
                      style={{
                        marginTop: '6px',
                        width: '100%',
                        padding: '5px 8px',
                        borderRadius: '5px',
                        border: 'none',
                        background: upgradeReq.eraMet ? '#0284c7' : '#334155',
                        color: upgradeReq.eraMet ? '#ffffff' : '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: upgradeReq.eraMet ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {upgradeReq.eraMet
                        ? `⬆ Upgrade to Lv ${upgradeReq.nextLevel}`
                        : `🔒 Requires Era ${upgradeReq.requiredEra} (Currently Era ${upgradeReq.currentEra})`}
                    </button>
                  )}
                </div>
              )}

              {e.complete && !e.isRuined && lvl >= maxLvl && (
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#fbbf24', fontWeight: 700 }}>
                  ★ Maximum Architectural Tier Reached (Lv {lvl}/{maxLvl})
                </div>
              )}
            </div>
          );
        })()}

        {data.kind === 'resource' && (
          <div>
            <div style={{ marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: e.exhausted ? '#451a03' : (e.depleted || (e.amount || 0) <= 0) ? '#7f1d1d' : '#15803d',
                  color: e.exhausted ? '#fdba74' : (e.depleted || (e.amount || 0) <= 0) ? '#fecaca' : '#bbf7d0',
                }}
              >
                {e.exhausted ? 'EXHAUSTED MINE' : (e.depleted || (e.amount || 0) <= 0) ? 'DEPLETED' : `${e.resourceType?.toUpperCase()} DEPOSIT`}
              </span>
              {e.label && (
                <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                  {e.label}
                </span>
              )}
            </div>
            {renderNeedBar(
              `Harvestable Reserve (${Math.round(e.amount || 0)} / ${e.maxAmount || 40})`,
              ((e.amount || 0) / (e.maxAmount || 40)) * 100
            )}
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.6, fontVariantNumeric: 'tabular-nums' }}>
              <div>📍 Location: ({Math.floor(e.x)}, {Math.floor(e.y)})</div>
              {e.resourceType === 'wood' && e.growthStage && (
                <div style={{ color: '#86efac' }}>
                  🌳 Growth Stage: <b style={{ textTransform: 'capitalize' }}>{e.growthStage}</b>
                </div>
              )}
              {e.exhausted ? (
                <div style={{ color: '#fb923c', fontWeight: 600 }}>
                  ⛏️ Vein Permanently Exhausted: mineral seam depleted
                </div>
              ) : (e.depleted || (e.amount || 0) <= 0) ? (
                <div style={{ color: '#f59e0b', fontWeight: 500 }}>
                  ⏳ Ecological Recovery: Regrowing in {e.recoveryTicks || 0} ticks
                </div>
              ) : (
                <div>
                  {e.resourceType === 'ore' || e.resourceType === 'gem'
                    ? '⛏️ Finite Vein: depletes permanently after extraction'
                    : '🌱 Regrowth: Natural ecological growth'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
