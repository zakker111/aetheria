import React, { useState } from 'react';
import { AgentDossier, AgentRelativeRef, InspectedEntityData } from '../types';

interface InspectorPanelProps {
  data: InspectedEntityData | null;
  isFollowing?: boolean;
  onFollowAgent?: (agentId: number | null) => void;
  onSelectAgent?: (agentId: number) => void;
  onRallyWarband?: (settlementId: number) => void;
  onSpawnCitizens?: (settlementId: number, count: number) => void;
  onAdvanceWonder?: (settlementId: number) => void;
  onFortifySettlement?: (settlementId: number) => void;
  onClose: () => void;
}

type AgentTab = 'overview' | 'history' | 'combat' | 'bonds';

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  data,
  isFollowing = false,
  onFollowAgent,
  onSelectAgent,
  onRallyWarband,
  onSpawnCitizens,
  onAdvanceWonder,
  onFortifySettlement,
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
          {data.kind === 'agent' && `${isAlive ? '👤' : '🕯️'} ${e.name}${e.epithet ? ` "${e.epithet}"` : ''}`}
          {data.kind === 'settlement' && `${e.tierIcon || '🏡'} ${e.name} (${e.ruined ? 'Collapsed Ruins' : (e.tier || 'Village')})`}
          {data.kind === 'building' && (e.buildingType === 'dock' ? '⚓ Harbor Dock' : `🏛️ Building: ${e.buildingType || e.type}`)}
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
                  Legacy: {dossier?.kills ?? e.kills ?? 0} Kills · {dossier?.battlesFought ?? e.battlesFought ?? 0} Battles · {dossier?.settlementName || 'Wilds'}
                </div>
              </div>
            )}

            {agentTab === 'overview' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
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
                    {dossier?.faith ? ` · 🙏 Faith ${dossier.faith}%${dossier.beliefId ? ` (${dossier.beliefId})` : ''}` : ''}
                  </div>
                  {isAlive && e.inventory && (
                    <div>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                        <span>{ev.icon || '📜'} {ev.kind}</span>
                        <span>Year {ev.year} · Tick {ev.tick}</span>
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

        {data.kind === 'building' && (
          <div>
            <div style={{ marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: e.complete ? '#15803d' : '#0369a1',
                  color: e.complete ? '#bbf7d0' : '#bae6fd',
                }}
              >
                {e.complete ? 'COMPLETED' : 'UNDER CONSTRUCTION'}
              </span>
            </div>
            {renderNeedBar('Construction', e.constructionProgress || (e.complete ? 100 : 0))}
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
              <div>📍 Position: ({e.x}, {e.y})</div>
              {(e.buildingType === 'tower' || e.buildingType === 'castle') && e.complete && !e.isRuined && (
                <div style={{ color: '#fbbf24', marginTop: '3px' }}>
                  🏹 Active Garrison Defense: fires at hostile invaders within {e.buildingType === 'castle' ? '11' : '8.5'} tiles
                </div>
              )}
              {e.buildingType === 'factory' && e.complete && !e.isRuined && (
                <div style={{ color: '#93c5fd', marginTop: '3px' }}>
                  🏭 Heavy Industry: supports mechanized warfare &amp; nuclear centrifuge fabrication
                </div>
              )}
              {e.buildingType === 'research_lab' && e.complete && !e.isRuined && (
                <div style={{ color: '#67e8f9', marginTop: '3px' }}>
                  🔬 Research Complex: accelerates Era advancement &amp; atomic enrichment speed
                </div>
              )}
              {e.buildingType === 'nuclear_plant' && e.complete && !e.isRuined && (
                <div style={{ color: '#bef264', marginTop: '3px' }}>
                  ☢️ Nuclear Power Plant: supplies fission enrichment required for warhead assembly
                </div>
              )}
              {e.buildingType === 'missile_silo' && e.complete && !e.isRuined && (
                <div style={{ color: '#fca5a5', marginTop: '3px' }}>
                  🚀 Strategic Missile Silo: expands warhead capacity (+2) &amp; enables ballistic launch
                </div>
              )}
              {e.buildingType === 'granary' && e.complete && !e.isRuined && (
                <div style={{ color: '#fde047', marginTop: '3px' }}>
                  🌾 Communal Granary: safeguards harvest reserves &amp; buffers winter famine
                </div>
              )}
            </div>
          </div>
        )}

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
