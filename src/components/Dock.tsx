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

  const getToolBtnClass = (tool: ToolType): string => {
    const isActive = currentTool === tool;
    return `px-2.5 py-1.5 rounded-lg cursor-pointer text-[11px] font-medium whitespace-nowrap shrink-0 transition-all flex items-center gap-1 border ${
      isActive
        ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
    }`;
  };

  return (
    <div className="absolute bottom-2 md:bottom-3 inset-x-0 flex justify-center pointer-events-none z-20 px-2">
      <div className="bg-slate-900/92 backdrop-blur-md border border-white/14 px-2 py-1.5 rounded-2xl flex gap-1 items-center shadow-2xl pointer-events-auto max-w-full">
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll tools left"
            onClick={() => scrollDock(-260)}
            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md py-1.5 px-2 text-[11px] cursor-pointer shrink-0 hover:bg-slate-700"
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
          className="flex gap-1.5 items-center overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          <button className={getToolBtnClass('inspect')} onClick={() => onSelectTool('inspect')}>
            🔍 Inspect (1)
          </button>
          <button className={getToolBtnClass('spawn_agent')} onClick={() => onSelectTool('spawn_agent')}>
            👤 Citizen (2)
          </button>

          <div className="w-px h-6 bg-white/12 mx-1 shrink-0" />

          <button className={getToolBtnClass('create_food')} onClick={() => onSelectTool('create_food')}>
            🌾 Food (3)
          </button>
          <button className={getToolBtnClass('create_water')} onClick={() => onSelectTool('create_water')}>
            💧 Water (4)
          </button>
          <button className={getToolBtnClass('create_wood')} onClick={() => onSelectTool('create_wood')}>
            🌲 Wood (5)
          </button>
          <button className={getToolBtnClass('create_ore')} onClick={() => onSelectTool('create_ore')}>
            ⛏️ Ore (6)
          </button>
          <button
            className={getToolBtnClass('create_iron_mountain')}
            onClick={() => onSelectTool('create_iron_mountain')}
            title="Spawn massive Iron Mountain deposit (unlocked at Era 2+)"
          >
            ⛰️ Iron Lode
          </button>
          <button
            className={getToolBtnClass('create_uranium_mountain')}
            onClick={() => onSelectTool('create_uranium_mountain')}
            title="Spawn massive Uranium Mountain vein (unlocked at Era 6+)"
          >
            ☢️ Uranium Vein
          </button>
          <button
            className={getToolBtnClass('create_bounty')}
            onClick={() => onSelectTool('create_bounty')}
            title="Spawn cluster of Wood, Water & Ore"
          >
            ✨ Bounty
          </button>

          <div className="w-px h-6 bg-white/12 mx-1 shrink-0" />

          <button className={getToolBtnClass('build_house')} onClick={() => onSelectTool('build_house')}>
            🏠 House (7)
          </button>
          <button className={getToolBtnClass('build_workshop')} onClick={() => onSelectTool('build_workshop')}>
            🔨 Workshop (8)
          </button>
          <button className={getToolBtnClass('build_farm')} onClick={() => onSelectTool('build_farm')}>
            🌾 Farm (9)
          </button>
          <button
            className={getToolBtnClass('build_temple')}
            onClick={() => onSelectTool('build_temple')}
            title="Plan a Sacred Temple blueprint to boost faith & train priests"
          >
            ⛩️ Temple
          </button>
          <button
            className={getToolBtnClass('build_shrine')}
            onClick={() => onSelectTool('build_shrine')}
            title="Place a Wayside Shrine to nurture local faith"
          >
            🪔 Shrine
          </button>
          <button
            className={getToolBtnClass('build_church')}
            onClick={() => onSelectTool('build_church')}
            title="Build a Parish Church for congregation sermons & priests"
          >
            ⛪ Church
          </button>
          <button
            className={getToolBtnClass('build_cemetery')}
            onClick={() => onSelectTool('build_cemetery')}
            title="Consecrate a Cemetery to inter fallen citizens & conjure ancestral spirits"
          >
            🪦 Cemetery
          </button>
          <button
            className={getToolBtnClass('build_dock')}
            onClick={() => onSelectTool('build_dock')}
            title="Place shoreline Dock for fishing boats & river barges"
          >
            ⚓ Dock
          </button>
          <button
            className={getToolBtnClass('build_bridge')}
            onClick={() => onSelectTool('build_bridge')}
            title="Build timber Bridge across a river or narrow strait (1–10 tiles)"
          >
            🌉 Bridge
          </button>
          <button
            className={getToolBtnClass('build_wall')}
            onClick={() => onSelectTool('build_wall')}
            title="Place fortified Wall/Gatehouse (click again to toggle Gate or repair Breach)"
          >
            🧱 Wall
          </button>
          <button
            className={getToolBtnClass('build_tower')}
            onClick={() => onSelectTool('build_tower')}
            title="Build active defensive Watchtower firing arrows/gunfire at raiders"
          >
            🗼 Tower
          </button>

          <div className="w-px h-6 bg-white/12 mx-1 shrink-0" />

          <button
            className={getToolBtnClass('declare_war')}
            onClick={() => onSelectTool('declare_war')}
            title="Provoke war between neighboring realms"
          >
            ⚔️ Provoke War
          </button>
          <button
            className={getToolBtnClass('rally_army')}
            onClick={() => onSelectTool('rally_army')}
            title="Muster a warband from a settlement"
          >
            🛡️ Muster Army
          </button>
          <button
            className={getToolBtnClass('enforce_peace')}
            onClick={() => onSelectTool('enforce_peace')}
            title="Enforce universal peace concordat"
          >
            🕊️ Enforce Peace
          </button>

          <div className="w-px h-6 bg-white/12 mx-1 shrink-0" />

          <button
            className={getToolBtnClass('rain')}
            onClick={() => onSelectTool('rain')}
            title="Summon rainclouds across the realm & quench fires"
          >
            🌧️ Rain
          </button>
          <button
            className={getToolBtnClass('lightning')}
            onClick={() => onSelectTool('lightning')}
            title="Call down targeted lightning bolt (ignites terrain)"
          >
            ⚡ Lightning
          </button>
          <button
            className={getToolBtnClass('douse')}
            onClick={() => onSelectTool('douse')}
            title="Extinguish all burning tiles in targeted area"
          >
            💧 Douse
          </button>

          <div className="w-px h-6 bg-white/12 mx-1 shrink-0" />

          <button className={getToolBtnClass('bless')} onClick={() => onSelectTool('bless')}>
            ✨ Bless (0)
          </button>
          <button
            className={getToolBtnClass('inspire_faith')}
            onClick={() => onSelectTool('inspire_faith')}
            title="Inspire faith & spread nearby settlement creed across citizens"
          >
            🙏 Inspire Faith
          </button>
          <button
            className={getToolBtnClass('nuke')}
            onClick={() => onSelectTool('nuke')}
            title="Detonate an atomic strike with crater, blast shockwave, and fallout"
          >
            ☢️ Nuke
          </button>
          <button className={getToolBtnClass('smite')} onClick={() => onSelectTool('smite')}>
            💥 Smite
          </button>
          <button className={getToolBtnClass('remove')} onClick={() => onSelectTool('remove')}>
            🗑️ Remove
          </button>
        </div>
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll tools right"
            onClick={() => scrollDock(260)}
            className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md py-1.5 px-2 text-[11px] cursor-pointer shrink-0 hover:bg-slate-700"
          >
            ▶
          </button>
        )}
      </div>
    </div>
  );
};
