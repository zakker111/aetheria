import React, { useRef, useEffect, useState, useCallback } from 'react';

export type RadarMode = 'territory' | 'density' | 'wealth' | 'conflict';

interface MiniMapRadarProps {
  simulation: any;
  renderer: any;
  onPanTo: (x: number, y: number) => void;
}

const MiniMapRadarComponent: React.FC<MiniMapRadarProps> = ({
  simulation,
  renderer,
  onPanTo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainDrawnRef = useRef(false);
  const [mode, setMode] = useState<RadarMode>('territory');
  const [isMinimized, setIsMinimized] = useState(false);
  const isDraggingRef = useRef(false);

  const RADAR_SIZE = 140;

  const handlePointerAction = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !simulation?.world) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const normX = Math.max(0, Math.min(1, clickX / RADAR_SIZE));
      const normY = Math.max(0, Math.min(1, clickY / RADAR_SIZE));

      const worldW = simulation.world.width || 128;
      const worldH = simulation.world.height || 128;

      const targetX = normX * worldW;
      const targetY = normY * worldH;

      onPanTo(targetX, targetY);
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

    // Build or update offscreen terrain canvas once
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
      const W = world.width || 128;
      const H = world.height || 128;
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
      terrainDrawnRef.current = true;
    };

    if (!terrainDrawnRef.current) {
      updateTerrainBuffer();
    }

    const renderRadar = (timestamp: number) => {
      animId = requestAnimationFrame(renderRadar);

      // Throttle radar updates to ~25 FPS to conserve GPU/CPU cycles
      if (timestamp - lastRenderTime < 40) return;
      lastRenderTime = timestamp;

      const world = simulation?.world;
      if (!world) return;

      const W = world.width || 128;
      const H = world.height || 128;
      const scaleX = RADAR_SIZE / W;
      const scaleY = RADAR_SIZE / H;

      ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      // 1. Draw pre-rendered Biome Base via single blit
      if (tCanvas) {
        ctx.drawImage(tCanvas, 0, 0);
      }

      // 2. Burning Fires overlay
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

      // 3. Heatmap Overlays
      if (mode === 'density') {
        // Density Heatmap: agents
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
        // Wealth Heatmap: resource nodes & town granaries
        ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
        if (simulation.resources) {
          for (const r of simulation.resources) {
            if (r.destroyed) continue;
            ctx.fillRect(r.x * scaleX - 1, r.y * scaleY - 1, 2, 2);
          }
        }
      } else if (mode === 'conflict') {
        // Conflict Heatmap: active warbands & frontlines
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

      // 4. Settlements and Territory Boundaries
      const settlements = simulation.settlementSystem?.settlements;
      if (settlements) {
        for (const s of settlements.values()) {
          if (!s.center) continue;
          const scx = s.center.x * scaleX;
          const scy = s.center.y * scaleY;
          const srad = (s.radius || 8) * scaleX;

          // Territory circle
          ctx.strokeStyle = s.factionColor || '#f59e0b';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(scx, scy, srad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Settlement hub icon
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(scx - 2, scy - 2, 4, 4);
        }
      }

      // 5. Active Warbands blips
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

      // 6. Camera Viewport Bounding Box
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
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'absolute',
          bottom: '74px',
          left: '12px',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#38bdf8',
          borderRadius: '8px',
          padding: '6px 10px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          zIndex: 18,
        }}
      >
        🗺️ Radar
      </button>
    );
  }

  const modeBtnStyle = (m: RadarMode): React.CSSProperties => ({
    background: mode === m ? '#38bdf8' : 'transparent',
    color: mode === m ? '#0f172a' : '#94a3b8',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 5px',
    fontSize: '9px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '74px',
        left: '12px',
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '10px',
        padding: '6px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        zIndex: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: '#cbd5e1',
          padding: '0 2px',
        }}
      >
        <span style={{ fontWeight: 600, color: '#38bdf8' }}>🗺️ Tactical Radar</span>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          <button style={modeBtnStyle('territory')} onClick={() => setMode('territory')}>
            Borders
          </button>
          <button style={modeBtnStyle('density')} onClick={() => setMode('density')}>
            People
          </button>
          <button style={modeBtnStyle('wealth')} onClick={() => setMode('wealth')}>
            Wealth
          </button>
          <button style={modeBtnStyle('conflict')} onClick={() => setMode('conflict')}>
            War
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '12px',
              marginLeft: '4px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={RADAR_SIZE}
        height={RADAR_SIZE}
        style={{
          borderRadius: '6px',
          cursor: 'crosshair',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
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
