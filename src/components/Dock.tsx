import React, { useEffect, useRef, useState } from 'react';
import { ToolType } from '../types';

interface DockProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

export const Dock: React.FC<DockProps> = ({ currentTool, onSelectTool }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, []);

  const scrollDock = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const getToolBtnStyle = (tool: ToolType): React.CSSProperties => {
    const isActive = currentTool === tool;
    return {
      padding: '5px 9px',
      background: isActive ? '#f43f5e' : '#1e293b',
      border: `1px solid ${isActive ? '#fb7185' : '#334155'}`,
      borderRadius: '8px',
      color: isActive ? '#fff' : '#cbd5e1',
      cursor: 'pointer',
      fontSize: '11px',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      boxShadow: isActive ? '0 0 12px rgba(244, 63, 94, 0.4)' : 'none',
    };
  };

  const dividerStyle: React.CSSProperties = {
    width: '1px',
    height: '24px',
    background: 'rgba(255, 255, 255, 0.12)',
    margin: '0 4px',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          padding: '6px 8px',
          borderRadius: '14px',
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'auto',
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll tools left"
            onClick={() => scrollDock(-260)}
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#e2e8f0',
              borderRadius: '7px',
              padding: '5px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ◀
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scrollRef.current) {
              scrollRef.current.scrollLeft += e.deltaY;
            }
          }}
          style={{
            display: 'flex',
            gap: '5px',
            alignItems: 'center',
            overflowX: 'auto',
            scrollbarWidth: 'thin',
            paddingBottom: '1px',
          }}
        >
        <button style={getToolBtnStyle('inspect')} onClick={() => onSelectTool('inspect')}>
          🔍 Inspect (1)
        </button>
        <button style={getToolBtnStyle('spawn_agent')} onClick={() => onSelectTool('spawn_agent')}>
          👤 Citizen (2)
        </button>

        <div style={dividerStyle} />

        <button style={getToolBtnStyle('create_food')} onClick={() => onSelectTool('create_food')}>
          🌾 Food (3)
        </button>
        <button style={getToolBtnStyle('create_water')} onClick={() => onSelectTool('create_water')}>
          💧 Water (4)
        </button>
        <button style={getToolBtnStyle('create_wood')} onClick={() => onSelectTool('create_wood')}>
          🌲 Wood (5)
        </button>
        <button style={getToolBtnStyle('create_ore')} onClick={() => onSelectTool('create_ore')}>
          ⛏️ Ore (6)
        </button>
        <button
          style={getToolBtnStyle('create_bounty')}
          onClick={() => onSelectTool('create_bounty')}
          title="Spawn cluster of Wood, Water & Ore"
        >
          ✨ Bounty
        </button>

        <div style={dividerStyle} />

        <button style={getToolBtnStyle('build_house')} onClick={() => onSelectTool('build_house')}>
          🏠 House (7)
        </button>
        <button style={getToolBtnStyle('build_workshop')} onClick={() => onSelectTool('build_workshop')}>
          🔨 Workshop (8)
        </button>
        <button style={getToolBtnStyle('build_farm')} onClick={() => onSelectTool('build_farm')}>
          🌾 Farm (9)
        </button>
        <button
          style={getToolBtnStyle('build_dock')}
          onClick={() => onSelectTool('build_dock')}
          title="Place shoreline Dock for fishing boats & river barges"
        >
          ⚓ Dock
        </button>
        <button
          style={getToolBtnStyle('build_bridge')}
          onClick={() => onSelectTool('build_bridge')}
          title="Build timber Bridge across a river or narrow strait (1–10 tiles)"
        >
          🌉 Bridge
        </button>
        <button
          style={getToolBtnStyle('build_wall')}
          onClick={() => onSelectTool('build_wall')}
          title="Place fortified Wall/Gatehouse (click again to toggle Gate or repair Breach)"
        >
          🧱 Wall
        </button>
        <button
          style={getToolBtnStyle('build_tower')}
          onClick={() => onSelectTool('build_tower')}
          title="Build active defensive Watchtower firing arrows/gunfire at raiders"
        >
          🗼 Tower
        </button>

        <div style={dividerStyle} />

        <button
          style={getToolBtnStyle('declare_war')}
          onClick={() => onSelectTool('declare_war')}
          title="Provoke war between neighboring realms"
        >
          ⚔️ Provoke War
        </button>
        <button
          style={getToolBtnStyle('rally_army')}
          onClick={() => onSelectTool('rally_army')}
          title="Muster a warband from a settlement"
        >
          🛡️ Muster Army
        </button>
        <button
          style={getToolBtnStyle('enforce_peace')}
          onClick={() => onSelectTool('enforce_peace')}
          title="Enforce universal peace concordat"
        >
          🕊️ Enforce Peace
        </button>

        <div style={dividerStyle} />

        <button
          style={getToolBtnStyle('rain')}
          onClick={() => onSelectTool('rain')}
          title="Summon rainclouds across the realm & quench fires"
        >
          🌧️ Rain
        </button>
        <button
          style={getToolBtnStyle('lightning')}
          onClick={() => onSelectTool('lightning')}
          title="Call down targeted lightning bolt (ignites terrain)"
        >
          ⚡ Lightning
        </button>
        <button
          style={getToolBtnStyle('douse')}
          onClick={() => onSelectTool('douse')}
          title="Extinguish all burning tiles in targeted area"
        >
          💧 Douse
        </button>

        <div style={dividerStyle} />

        <button style={getToolBtnStyle('bless')} onClick={() => onSelectTool('bless')}>
          ✨ Bless (0)
        </button>
        <button
          style={getToolBtnStyle('nuke')}
          onClick={() => onSelectTool('nuke')}
          title="Detonate an atomic strike with crater, blast shockwave, and fallout"
        >
          ☢️ Nuke
        </button>
        <button style={getToolBtnStyle('smite')} onClick={() => onSelectTool('smite')}>
          💥 Smite
        </button>
        <button style={getToolBtnStyle('remove')} onClick={() => onSelectTool('remove')}>
          🗑️ Remove
        </button>
        </div>
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll tools right"
            onClick={() => scrollDock(260)}
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#e2e8f0',
              borderRadius: '7px',
              padding: '5px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ▶
          </button>
        )}
      </div>
    </div>
  );
};
