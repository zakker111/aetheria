// 2D Top-Down Fallback Rendering Pass.
import { getBiomeColor } from "./terrainPass.js";
import { render25DResource, render25DBuilding, render25DGroundItem } from "./structuresPass.js";
import { render25DAnimal, render25DVessel, render25DAgent } from "./entitiesPass.js";
import { renderSkullMonuments, renderWarbandMarkers, renderCombatEffects, renderSettlementTerritories, renderDiplomacyLines } from "./overlaysPass.js";

export function render2DScene(r) {
  const ctx = r.ctx;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);

  const world = r.world;
  if (!world) return;
  const zoom = r.camera.zoom;
  const startX = Math.max(0, Math.floor(r.camera.x - r.canvas.width / 2 / zoom));
  const startY = Math.max(0, Math.floor(r.camera.y - r.canvas.height / 2 / zoom));
  const endX = Math.min(world.width, Math.ceil(r.camera.x + r.canvas.width / 2 / zoom));
  const endY = Math.min(world.height, Math.ceil(r.camera.y + r.canvas.height / 2 / zoom));

  if (r.simulation) {
    if (typeof r.simulation.setViewportBounds === "function") {
      r.simulation.setViewportBounds({ minX: startX, maxX: endX, minY: startY, maxY: endY, zoom });
    }
    r.simulation.selectedEntityId = r.selectedEntity ? r.selectedEntity.id : null;
  }

  const now = r._frameNow;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = y * world.width + x;
      const biome = world.biome ? world.biome[idx] : "grassland";
      const elev = world.elevation ? world.elevation[idx] : 50;
      const screen = r.worldToScreen(x, y);

      ctx.fillStyle = getBiomeColor(r, biome, elev, 1.0);
      ctx.fillRect(screen.x, screen.y, zoom + 0.5, zoom + 0.5);

      if (world.bridgeTiles && world.bridgeTiles[idx]) {
        ctx.fillStyle = "#854d0e";
        ctx.fillRect(screen.x, screen.y, zoom, zoom);
      } else if (world.roadTiles && world.roadTiles[idx]) {
        ctx.fillStyle = "rgba(195, 180, 155, 0.7)";
        ctx.fillRect(screen.x, screen.y, zoom, zoom);
      }

      if (world.scorchedTiles && world.scorchedTiles[idx] > 0) {
        const scorchAlpha = Math.min(0.88, (world.scorchedTiles[idx] / 255) * 0.8 + 0.18);
        ctx.fillStyle = `rgba(24, 20, 18, ${scorchAlpha})`;
        ctx.fillRect(screen.x, screen.y, zoom + 0.5, zoom + 0.5);
      }
      if (world.craterTiles && world.craterTiles[idx] > 0) {
        ctx.fillStyle = "rgba(15, 13, 12, 0.85)";
        ctx.beginPath();
        ctx.arc(screen.x + zoom * 0.5, screen.y + zoom * 0.5, Math.max(2, zoom * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
      if (world.radiationTiles && world.radiationTiles[idx] > 0) {
        const radPulse = 0.75 + 0.25 * Math.sin(now * 0.006 + x + y);
        const radAlpha = Math.min(0.6, (world.radiationTiles[idx] / 255) * 0.5 * radPulse + 0.08);
        ctx.fillStyle = `rgba(132, 204, 22, ${radAlpha.toFixed(3)})`;
        ctx.fillRect(screen.x, screen.y, zoom + 0.5, zoom + 0.5);
      }

      if (world.fireTiles && world.fireTiles[idx] > 0) {
        const flicker = 0.7 + 0.3 * Math.sin(now * 0.018 + x * 4.3 + y * 6.7);
        const fs = Math.max(3, zoom * 0.85 * flicker);
        const cx = screen.x + zoom * 0.5;
        const cy = screen.y + zoom * 0.5;

        const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, fs * 1.6);
        glowGrad.addColorStop(0, "rgba(249, 115, 22, 0.65)");
        glowGrad.addColorStop(0.5, "rgba(239, 68, 68, 0.35)");
        glowGrad.addColorStop(1, "rgba(220, 38, 38, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, fs * 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(30, 10, 5, 0.8)";
        ctx.beginPath();
        ctx.arc(cx, cy, fs * 0.45, 0, Math.PI * 2);
        ctx.fill();

        const flameGrad = ctx.createRadialGradient(cx, cy - fs * 0.25, 0, cx, cy, fs);
        flameGrad.addColorStop(0, "#fffbeb");
        flameGrad.addColorStop(0.3, "#f59e0b");
        flameGrad.addColorStop(0.7, "#ea580c");
        flameGrad.addColorStop(1, "rgba(220, 38, 38, 0.15)");
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(cx, cy - fs * 0.25, fs * 0.7, 0, Math.PI * 2);
        ctx.fill();

        const smokePhase = ((now * 0.003 + x * 0.7 + y * 1.3) % 1);
        ctx.fillStyle = `rgba(50, 45, 45, ${0.45 * (1 - smokePhase)})`;
        ctx.beginPath();
        ctx.arc(cx + Math.sin(now * 0.005 + x) * 2, cy - fs * 0.7 - smokePhase * 10, 2 + smokePhase * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (r.simulation.resources) {
    for (const res of r.simulation.resources) {
      if (res.destroyed) continue;
      const screen = r.worldToScreen(res.x, res.y);
      render25DResource(r, res, screen, 20);
    }
  }
  if (r.simulation.groundItems) {
    for (const it of r.simulation.groundItems) {
      if (it.destroyed || (typeof it.total === "function" && it.total() <= 0)) continue;
      if (it.x < startX - 2 || it.x > endX + 2 || it.y < startY - 2 || it.y > endY + 2) continue;
      const screen = r.worldToScreen(it.x, it.y);
      render25DGroundItem(r, it, screen);
    }
  }
  if (r.simulation.buildings) {
    for (const b of r.simulation.buildings) {
      const screen = r.worldToScreen(b.x, b.y);
      if (b.isRuined || (b.health !== undefined && b.health <= 0)) {
        const rSize = Math.max(8, zoom * 0.9);
        ctx.fillStyle = "#1c1917";
        ctx.fillRect(screen.x - rSize * 0.5, screen.y - rSize * 0.5, rSize, rSize);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screen.x - rSize * 0.5, screen.y - rSize * 0.5, rSize, rSize);
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x - rSize * 0.4, screen.y - rSize * 0.35);
        ctx.lineTo(screen.x + rSize * 0.35, screen.y + rSize * 0.25);
        ctx.moveTo(screen.x + rSize * 0.3, screen.y - rSize * 0.3);
        ctx.lineTo(screen.x - rSize * 0.25, screen.y + rSize * 0.35);
        ctx.stroke();
        ctx.fillStyle = "#f97316";
        ctx.fillRect(screen.x - 1, screen.y - 1, 3, 3);
      } else {
        render25DBuilding(r, b, screen, 20);
      }
    }
  }
  if (r.simulation.fortificationSystem?.segments) {
    for (const seg of r.simulation.fortificationSystem.segments.values()) {
      if (seg.x < startX - 1 || seg.x > endX + 1 || seg.y < startY - 1 || seg.y > endY + 1) continue;
      const screen = r.worldToScreen(seg.x, seg.y);
      if (seg.state === "breach" || seg.hp <= 0) {
        ctx.fillStyle = "rgba(71, 85, 105, 0.6)";
        ctx.fillRect(screen.x + zoom * 0.15, screen.y + zoom * 0.15, zoom * 0.3, zoom * 0.3);
        ctx.fillRect(screen.x + zoom * 0.55, screen.y + zoom * 0.5, zoom * 0.25, zoom * 0.25);
      } else if (seg.kind === "gate") {
        ctx.fillStyle = "#b45309";
        ctx.fillRect(screen.x + 1, screen.y + 1, Math.max(3, zoom - 2), Math.max(3, zoom - 2));
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(screen.x + zoom * 0.35, screen.y + zoom * 0.35, Math.max(2, zoom * 0.3), Math.max(2, zoom * 0.3));
      } else {
        ctx.fillStyle = seg.tierKey === "palisade" ? "#78350f" : seg.tierKey === "bastion" ? "#334155" : "#64748b";
        ctx.fillRect(screen.x, screen.y, zoom, zoom);
      }
    }
  }
  if (r.simulation.animalSystem?.animals) {
    for (const an of r.simulation.animalSystem.animals) {
      if (an.alive === false) continue;
      if (an.x < startX - 2 || an.x > endX + 2 || an.y < startY - 2 || an.y > endY + 2) continue;
      const coords = r.getEntityRenderCoords(an);
      const screen = r.worldToScreen(coords.x, coords.y);
      render25DAnimal(r, an, screen, 20);
    }
  }
  if (r.simulation.navalSystem?.vessels) {
    for (const v of r.simulation.navalSystem.vessels) {
      if (v.x < startX - 2 || v.x > endX + 2 || v.y < startY - 2 || v.y > endY + 2) continue;
      const coords = r.getEntityRenderCoords(v);
      const screen = r.worldToScreen(coords.x, coords.y);
      render25DVessel(r, v, screen, 20);
    }
  }
  if (r.simulation.agents) {
    for (const a of r.simulation.agents) {
      if (!a.alive) continue;
      if (a.x < startX - 2 || a.x > endX + 2 || a.y < startY - 2 || a.y > endY + 2) continue;
      const coords = r.getEntityRenderCoords(a);
      const screen = r.worldToScreen(coords.x, coords.y);
      render25DAgent(r, a, screen, 20);
    }
  }

  renderDiplomacyLines(r);
  renderSettlementTerritories(r);
  renderSkullMonuments(r, startX, endX, startY, endY);
  renderWarbandMarkers(r);
  renderCombatEffects(r);
}
