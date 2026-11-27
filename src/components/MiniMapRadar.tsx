import React, { useRef, useEffect, useState, useCallback } from 'react';

export type RadarMode = 'territory' | 'density' | 'wealth' | 'conflict';

interface MiniMapRadarProps {
  simulation: any;
  renderer: any;
  onPanTo: (x: number, y: number) => void;
}

const RADAR_SIZE = 140;

const MiniMapRadarComponent: React.FC<MiniMapRadarProps> = ({
  simulation,
  renderer,
  onPanTo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastWorldRef = useRef<any>(null);
  const [mode, setMode] = useState<RadarMode>('territory');
  const [isMinimized, setIsMinimized] = useState(false);
  const isDraggingRef = useRef(false);

  const handlePointerAction = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !simulation?.world) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const normX = Math.max(0, Math.min(1, clickX / (rect.width || RADAR_SIZE)));
      const normY = Math.max(0, Math.min(1, clickY / (rect.height || RADAR_SIZE)));

      const worldW = simulation.world.width || 160;
      const worldH = simulation.world.height || 160;

      onPanTo(normX * worldW, normY * worldH);
    },
    [simulation, onPanTo]
  );

  useEffect(() => {
    if (isMinimized) return;
    let animId: number;
    let lastRenderTime = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!terrainCanvasRef.current) {
      terrainCanvasRef.current = document.createElement('canvas');
      terrainCanvasRef.current.width = RADAR_SIZE;
      terrainCanvasRef.current.height = RADAR_SIZE;
    }

    const tCanvas = terrainCanvasRef.current;
    const tCtx = tCanvas.getContext('2d');

    const updateTerrainBuffer = () => {
      const world = simulation?.world;
      if (!world || !tCtx) return;
      const W = world.width || 160;
      const H = world.height || 160;
      const scaleX = RADAR_SIZE / W;
      const scaleY = RADAR_SIZE / H;

      const biomeColors: { [key: string]: string } = {
        water: '#1e3a8a',
        beach: '#fde047',
        grassland: '#16a34a',
        plains: '#65a30d',
        forest: '#15803d',
        jungle: '#047857',
        mountain: '#64748b',
        snow: '#e2e8f0',
        desert: '#d97706',
        swamp: '#3f6212',
      };

      tCtx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const idx = y * W + x;
          const b = world.biome ? world.biome[idx] : 'grassland';
          tCtx.fillStyle = biomeColors[b] || '#15803d';
          tCtx.fillRect(x * scaleX, y * scaleY, scaleX * 2 + 0.5, scaleY * 2 + 0.5);
        }
      }
      lastWorldRef.current = world;
    };

    if (simulation?.world && lastWorldRef.current !== simulation.world) {
      updateTerrainBuffer();
    }

    const renderRadar = (timestamp: number) => {
      animId = requestAnimationFrame(renderRadar);

      if (timestamp - lastRenderTime < 40) return;
      lastRenderTime = timestamp;

      const world = simulation?.world;
      if (!world) return;

      const W = world.width || 160;
      const H = world.height || 160;
      const scaleX = RADAR_SIZE / W;
      const scaleY = RADAR_SIZE / H;

      ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      if (tCanvas) {
        ctx.drawImage(tCanvas, 0, 0);
      }

      if (world.scorchedTiles) {
        ctx.fillStyle = 'rgba(28, 25, 23, 0.75)';
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            const idx = y * W + x;
            if (world.scorchedTiles[idx] > 0) {
              ctx.fillRect(x * scaleX, y * scaleY, scaleX * 2, scaleY * 2);
            }
          }
        }
      }

      if (world.fireTiles) {
        ctx.fillStyle = '#f97316';
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            const idx = y * W + x;
            if (world.fireTiles[idx] > 0) {
              ctx.fillRect(x * scaleX, y * scaleY, scaleX * 2, scaleY * 2);
            }
          }
        }
      }

      if (world.radiationTiles) {
        ctx.fillStyle = 'rgba(132, 204, 22, 0.65)';
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            const idx = y * W + x;
            if (world.radiationTiles[idx] > 0) {
              ctx.fillRect(x * scaleX, y * scaleY, scaleX * 2, scaleY * 2);
            }
          }
        }
      }

      if (Array.isArray(world.skullMonuments) && world.skullMonuments.length > 0) {
        for (const m of world.skullMonuments) {
          ctx.fillStyle = m.kind === 'nuke' ? '#bef264' : m.kind === 'city_ruin' ? '#f87171' : '#e2e8f0';
          ctx.fillRect(m.x * scaleX - 1.5, m.y * scaleY - 1.5, 3, 3);
        }
      }

      if (mode === 'density') {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.4)';
        if (simulation.agents) {
          for (const a of simulation.agents) {
            if (!a.alive) continue;
            ctx.beginPath();
            ctx.arc(a.x * scaleX, a.y * scaleY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (mode === 'wealth') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
        if (simulation.resources) {
          for (const r of simulation.resources) {
            if (r.destroyed) continue;
            ctx.fillRect(r.x * scaleX - 1, r.y * scaleY - 1, 2, 2);
          }
        }
      } else if (mode === 'conflict') {
        const wf = simulation.warfareSystem;
        if (wf && wf.warbands) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
          for (const wb of wf.warbands.values()) {
            if (!wb.active || wb.state === 'destroyed') continue;
            const cx = wb.centroidX || 0;
            const cy = wb.centroidY || 0;
            ctx.beginPath();
            ctx.arc(cx * scaleX, cy * scaleY, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const settlements = simulation.settlementSystem?.settlements;
      if (settlements) {
        for (const s of settlements.values()) {
          if (!s.center) continue;
          const scx = s.center.x * scaleX;
          const scy = s.center.y * scaleY;
          const srad = (s.radius || 8) * scaleX;

          ctx.strokeStyle = s.factionColor || '#f59e0b';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(scx, scy, srad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(scx - 2, scy - 2, 4, 4);
        }
      }

      const warfare = simulation.warfareSystem;
      if (warfare && warfare.warbands) {
        ctx.fillStyle = '#ef4444';
        for (const wb of warfare.warbands.values()) {
          if (!wb.active || wb.state === 'destroyed') continue;
          const wx = (wb.centroidX || 0) * scaleX;
          const wy = (wb.centroidY || 0) * scaleY;
          ctx.fillRect(wx - 1.5, wy - 1.5, 3, 3);
        }
      }

      if (renderer?.camera) {
        const cam = renderer.camera;
        const zoom = cam.zoom || 12;
        const viewW = (window.innerWidth / zoom) * scaleX;
        const viewH = (window.innerHeight / zoom) * scaleY;
        const cx = cam.x * scaleX;
        const cy = cam.y * scaleY;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(cx - viewW / 2, cy - viewH / 2, viewW, viewH);
      }
    };

    const handleGlobalRelease = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);

    animId = requestAnimationFrame(renderRadar);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
    };
  }, [simulation, renderer, mode, isMinimized]);

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => setIsMinimized(false)}
        className="absolute bottom-[74px] left-3 z-[18] bg-slate-900/90 border border-white/15 text-sky-400 hover:bg-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer shadow-lg whitespace-nowrap"
      >
        🗺️ Radar
      </button>
    );
  }

  const modeBtnClass = (m: RadarMode) =>
    `border-0 rounded px-1.5 py-0.5 text-[9px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
      mode === m ? 'bg-sky-400 text-slate-900' : 'bg-transparent text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div className="hidden sm:flex absolute bottom-[74px] left-3 z-[18] bg-slate-900/92 backdrop-blur-md border border-white/15 rounded-xl p-1.5 shadow-2xl flex-col gap-1">
      <div className="flex justify-between items-center text-[10px] text-slate-300 px-0.5 gap-2">
        <span className="font-semibold text-sky-400 whitespace-nowrap">🗺️ Radar</span>
        <div className="flex gap-0.5 items-center">
          <button type="button" className={modeBtnClass('territory')} onClick={() => setMode('territory')}>
            Borders
          </button>
          <button type="button" className={modeBtnClass('density')} onClick={() => setMode('density')}>
            People
          </button>
          <button type="button" className={modeBtnClass('wealth')} onClick={() => setMode('wealth')}>
            Wealth
          </button>
          <button type="button" className={modeBtnClass('conflict')} onClick={() => setMode('conflict')}>
            War
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize tactical radar"
            className="bg-transparent border-0 text-slate-400 hover:text-slate-200 cursor-pointer text-xs ml-1 px-1"
          >
            ✕
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={RADAR_SIZE}
        height={RADAR_SIZE}
        className="w-[116px] h-[116px] md:w-[140px] md:h-[140px] rounded-md cursor-crosshair border border-white/10"
        onMouseDown={(e) => {
          isDraggingRef.current = true;
          handlePointerAction(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (isDraggingRef.current) handlePointerAction(e.clientX, e.clientY);
        }}
        onMouseUp={() => {
          isDraggingRef.current = false;
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            isDraggingRef.current = true;
            handlePointerAction(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (isDraggingRef.current && e.touches.length === 1) {
            handlePointerAction(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={() => {
          isDraggingRef.current = false;
        }}
      />
    </div>
  );
};

export const MiniMapRadar = React.memo(MiniMapRadarComponent);
