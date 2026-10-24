import React from 'react';
import { InspectedEntityData } from '../types';

interface InspectorPanelProps {
  data: InspectedEntityData | null;
  onRallyWarband?: (settlementId: number) => void;
  onClose: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  data,
  onRallyWarband,
  onClose,
}) => {
  if (!data || !data.entity) return null;

  const e = data.entity;

  const actionDescriptions: { [key: string]: string } = {
    gather_at_hearth: '🔥 Gathering around village hearth',
    visit_market: '🛍️ Browsing market square',
    pray_at_temple: '🙏 Praying at the temple',
    watch_crafts: '🔨 Watching blacksmith forge',
    train_at_barracks: '🛡️ Practicing combat drills',
    patrol_settlement: '🛡️ Patrolling town perimeter',
    play_in_town: '🪁 Playing in town square',
    fetch_town_water: '🪣 Drawing fresh well water',
    tend_town_farm: '🌾 Tending communal crops',
    deposit_to_stockpile: '📦 Hauling goods to stockpile',
    eat_from_stockpile: '🍞 Dining from town granary',
    eat_from_inventory: '🍞 Eating meal',
    visit_neighbor: '💬 Visiting a neighbor',
    socialize: '💬 Socializing with townspeople',
    go_home_and_rest: '💤 Resting in cottage bed',
    rest: '💤 Taking a rest',
    chop_wood: '🪓 Chopping timber',
    mine_ore: '⛏️ Mining mineral deposit',
    gather_food: '🌾 Foraging supplies',
    hunt: '🏹 Stalking quarry',
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

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '12px 14px',
        pointerEvents: 'auto',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        fontSize: '12px',
        maxHeight: '360px',
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
          fontWeight: 600,
          color: '#38bdf8',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '4px',
          fontSize: '13px',
        }}
      >
        <span>
          {data.kind === 'agent' && `👤 Citizen: ${e.name}`}
          {data.kind === 'settlement' && `${e.tierIcon || '🏡'} ${e.name} (${e.tier || 'Village'})`}
          {data.kind === 'building' && `🏛️ Building: ${e.buildingType || e.type}`}
          {data.kind === 'resource' &&
            `${e.resourceType === 'food' ? '🌾' : e.resourceType === 'wood' ? '🌲' : e.resourceType === 'ore' ? '⛏️' : '💧'} ${e.label || e.resourceType?.toUpperCase()}`}
        </span>
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

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {data.kind === 'agent' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background:
                    e.lifeStage === 'elder'
                      ? '#7c2d12'
                      : e.lifeStage === 'child'
                        ? '#0369a1'
                        : '#15803d',
                  color:
                    e.lifeStage === 'elder'
                      ? '#fed7aa'
                      : e.lifeStage === 'child'
                        ? '#bae6fd'
                        : '#bbf7d0',
                }}
              >
                {e.lifeStage} (Age {Math.floor(e.age)})
              </span>
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>Job: {e.job || 'Civilian'}</span>
            </div>

            {e.needs && (
              <>
                {renderNeedBar('Food', e.needs.food)}
                {renderNeedBar('Water', e.needs.water)}
                {renderNeedBar('Rest', e.needs.rest)}
                {renderNeedBar('Social', e.needs.social)}
              </>
            )}

            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#cbd5e1',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: '6px',
              }}
            >
              <div>
                📍 Position: ({typeof e.x === 'number' ? e.x.toFixed(1) : e.x},{' '}
                {typeof e.y === 'number' ? e.y.toFixed(1) : e.y})
              </div>
              <div>👶 Children: {e.children || 0}</div>
              <div>
                🎒 Inventory: 🌲 {e.inventory?.wood_log || 0} | ⛏️ {e.inventory?.ore_iron || 0} | 🌾{' '}
                {e.inventory?.wheat || 0}
              </div>
              <div style={{ marginTop: '4px', fontWeight: 600, color: '#38bdf8' }}>
                🧠{' '}
                {actionDescriptions[e.currentAction?.type] ||
                  (e.currentAction?.type
                    ? String(e.currentAction.type).replace(/_/g, ' ')
                    : 'Observing community')}
              </div>
            </div>
          </div>
        )}

        {data.kind === 'settlement' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
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
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Era {e.age.id}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1', marginBottom: '6px' }}>
                  {e.age.description}
                </div>
                {e.age.monumentName && (
                  <div style={{ fontSize: '10px', color: '#38bdf8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Wonder: {e.age.monumentName}</span>
                    <span style={{ fontWeight: 600 }}>{e.age.hasMonument ? '✅ Complete' : `${e.age.monumentProgress || 0}%`}</span>
                  </div>
                )}
              </div>
            )}

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

            {onRallyWarband && (
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
                  WARBAND MOBILIZATION
                </div>
                <button
                  onClick={() => onRallyWarband(e.id)}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '10px',
                    padding: '3px 7px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  🛡️ Rally Warband
                </button>
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
              }}
            >
              <div>
                👥 Population: <b>{e.population || (e.agentIds ? e.agentIds.size : 0)}</b> citizens (
                {e.growthTrend || 'stable'})
              </div>
              <div>
                🏛️ Buildings: <b>{e.buildings ? e.buildings.length : 0}</b> structures
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
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1' }}>
              <div>
                📍 Position: ({e.x}, {e.y})
              </div>
            </div>
          </div>
        )}

        {data.kind === 'resource' && (
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
                  background: '#15803d',
                  color: '#bbf7d0',
                }}
              >
                {e.resourceType?.toUpperCase()} DEPOSIT
              </span>
            </div>
            {renderNeedBar('Harvestable Reserve', ((e.amount || 0) / (e.maxAmount || 40)) * 100)}
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.6 }}>
              <div>
                📍 Location: ({Math.floor(e.x)}, {Math.floor(e.y)})
              </div>
              <div>🌱 Regrowth: Natural ecological replenishment</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
