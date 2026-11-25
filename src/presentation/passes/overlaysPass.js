// Map Overlays, Territories, Diplomacy Lines, Warbands, Monuments, Combat FX & Atmosphere Pass.

export function hexToRgba(hex, alpha) {
  if (typeof hex !== "string" || !hex.startsWith("#")) return `rgba(239, 68, 68, ${alpha})`;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const cr = parseInt(h.slice(0, 2), 16) || 239;
  const cg = parseInt(h.slice(2, 4), 16) || 68;
  const cb = parseInt(h.slice(4, 6), 16) || 68;
  return `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;
}

export function renderSettlementTerritories(r) {
  if (!r.simulation?.settlementSystem?.settlements) return;
  const ctx = r.ctx;
  for (const s of r.simulation.settlementSystem.settlements.values()) {
    if (!s.center) continue;
    const screen = r.worldToScreen(s.center.x, s.center.y);
    const rad = (s.radius || 8) * (r.camera.is25D ? r.camera.zoom * 1.4 : r.camera.zoom);

    ctx.save();
    const isRuined = Boolean(s.ruined || s.tier === "Ruins" || s.status === "ruined");
    ctx.strokeStyle = isRuined ? "rgba(148, 163, 184, 0.45)" : (s.factionColor || "rgba(251, 191, 36, 0.45)");
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = isRuined ? "rgba(30, 25, 25, 0.9)" : "rgba(15, 23, 42, 0.85)";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const popCount = s.population ?? (s.agentIds ? s.agentIds.size : (s.agents?.length || 0));
    const tierIcon = s.tierIcon || "🏰";
    const txt = isRuined
      ? `🏚️ ${s.name || "Ruins"} (Abandoned)`
      : `${tierIcon} ${s.name || "Settlement"} (Pop ${popCount})`;
    const w = ctx.measureText(txt).width + 16;
    const plaqueY = r.camera.is25D ? screen.y - rad - 20 : screen.y - Math.min(rad, 42) - 22;
    ctx.fillRect(screen.x - w / 2, plaqueY, w, 22);
    ctx.strokeStyle = isRuined ? "#64748b" : (s.factionColor || "#f59e0b");
    ctx.strokeRect(screen.x - w / 2, plaqueY, w, 22);
    ctx.fillStyle = isRuined ? "#cbd5e1" : "#f8fafc";
    ctx.fillText(txt, screen.x, plaqueY + 14);
    ctx.restore();
  }
}

export function renderDiplomacyLines(r) {
  if (!r.simulation?.diplomacySystem || !r.simulation?.settlementSystem) return;
  const relations = r.simulation.diplomacySystem.relations;
  const settlements = r.simulation.settlementSystem.settlements;
  if (!relations) return;

  for (const rel of relations.values()) {
    if (rel.status === "peace" && rel.score < 80) continue;
    const s1 = settlements.get(rel.settlementA);
    const s2 = settlements.get(rel.settlementB);
    if (!s1?.center || !s2?.center) continue;

    const p1 = r.worldToScreen(s1.center.x, s1.center.y);
    const p2 = r.worldToScreen(s2.center.x, s2.center.y);

    r.ctx.save();
    r.ctx.strokeStyle = rel.status === "war" ? "#ef4444" : "#22c55e";
    r.ctx.lineWidth = rel.status === "war" ? 2.5 : 1.5;
    r.ctx.setLineDash([8, 6]);
    r.ctx.beginPath();
    r.ctx.moveTo(p1.x, p1.y);
    r.ctx.lineTo(p2.x, p2.y);
    r.ctx.stroke();
    r.ctx.restore();
  }
}

export function renderWarbandMarkers(r) {
  const wf = r.simulation?.warfareSystem;
  if (!wf || !wf.warbands || wf.warbands.size === 0) return;
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const tick = r.simulation.clock?.tick ?? 0;

  for (const wb of wf.warbands.values()) {
    if (!wb.active || wb.state === "destroyed") continue;
    const coords = r.getEntityRenderCoords(wb);
    const cx = coords.x, cy = coords.y;
    if (cx === undefined || cy === undefined) continue;
    if (cx < -4 || cy < -4 || cx > (r.world?.width || 1e9) + 4 || cy > (r.world?.height || 1e9) + 4) {
      const sc0 = r.worldToScreen(cx, cy);
      if (sc0.x < -80 || sc0.y < -80 || sc0.x > r.canvas.width + 80 || sc0.y > r.canvas.height + 80) continue;
    }
    const screen = r.worldToScreen(cx, cy);
    const size = wb.markerSize || wb.soldiers.length || 1;
    const rx = Math.max(10, Math.min(46, size * 2.4)) * (zoom / 20);
    const ry = rx * 0.55;
    const breaching = wb.state === "breaching";
    const engaging = wb.state === "engaging" || wb.state === "sieging" || wb.state === "clashing" || breaching;
    const routing = wb.state === "retreating" || (wb.markerMorale !== undefined && wb.markerMorale <= 25);
    const banner = wb.bannerColor || "#ef4444";

    ctx.save();

    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = routing ? "rgba(148, 163, 184, 0.28)" : hexToRgba(banner, 0.30);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = routing ? "rgba(148, 163, 184, 0.75)" : banner;
    if (routing) ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const pipCount = Math.min(size, 24);
    for (let i = 0; i < pipCount; i++) {
      const ang = (i / pipCount) * Math.PI * 2 + tick * 0.002;
      const px = screen.x + Math.cos(ang) * (rx - 3);
      const py = screen.y + Math.sin(ang) * (ry - 2);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.2, zoom * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = routing ? "#94a3b8" : banner;
      ctx.fill();
    }

    const barW = rx * 1.6;
    const morale = Math.max(0, Math.min(100, wb.markerMorale ?? wb.morale ?? 100));
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.fillRect(screen.x - barW / 2, screen.y - ry - 12, barW, 4);
    ctx.fillStyle = morale > 60 ? "#22c55e" : morale > 30 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(screen.x - barW / 2, screen.y - ry - 12, barW * (morale / 100), 4);

    ctx.font = `bold ${Math.max(9, zoom * 0.45)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
    const eraTag = (wb.eraId || 1) >= 6 ? " 🚀" : (wb.eraId || 1) === 5 ? " ⚙️" : "";
    const cargo = wb.plunderCargo ? ((wb.plunderCargo.food || 0) + (wb.plunderCargo.wood || 0) + (wb.plunderCargo.ore || 0)) : 0;
    const lootTag = cargo > 0 ? ` 💰${cargo}` : "";
    const raidPrefix = wb.isExternalRaid ? "🏴 " : "";
    ctx.fillText(`${raidPrefix}${wb.settlementName || "Warband"}${eraTag} (${size})${lootTag}`, screen.x, screen.y - ry - 16);

    if (engaging) {
      const pulse = 1 + 0.15 * Math.sin(tick * 0.35);
      ctx.font = `${Math.max(14, zoom * 0.8) * pulse}px sans-serif`;
      ctx.fillText(breaching ? "🧱" : "⚔️", screen.x, screen.y + 4);

      for (let s = 0; s < 3; s++) {
        const phase = ((tick * 0.05) + s * 0.33 + wb.id * 0.17) % 1;
        const wobble = Math.sin((tick * 0.1) + s * 2.1 + wb.id) * 4;
        const smX = screen.x + wobble + (s - 1) * rx * 0.4;
        const smY = screen.y - ry - phase * 26;
        ctx.beginPath();
        ctx.arc(smX, smY, 3 + phase * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 120, 128, ${0.45 * (1 - phase)})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rx + 3, ry + 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = breaching
        ? `rgba(249, 115, 22, ${0.40 + 0.25 * Math.sin(tick * 0.3)})`
        : `rgba(239, 68, 68, ${0.35 + 0.25 * Math.sin(tick * 0.3)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (routing) {
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 116, 139, 0.18)";
      ctx.fill();
      ctx.font = `${Math.max(12, zoom * 0.6)}px sans-serif`;
      ctx.fillText("🏳️", screen.x, screen.y + 4);
    }

    ctx.restore();
  }
}

export function renderSkullMonuments(r, minX = 0, maxX = Infinity, minY = 0, maxY = Infinity) {
  const monuments = r.world?.skullMonuments;
  if (!monuments || monuments.length === 0) return;
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  ctx.save();
  for (let i = 0; i < monuments.length; i++) {
    const m = monuments[i];
    if (m.x < minX - 2 || m.x > maxX + 2 || m.y < minY - 2 || m.y > maxY + 2) continue;
    const elev = r.getInterpolatedElevation(m.x, m.y);
    const screen = r.worldToScreen(m.x, m.y, elev);

    const baseR = Math.max(3, zoom * 0.36);
    ctx.fillStyle = m.kind === "nuke" ? "rgba(132, 204, 22, 0.35)" : "rgba(28, 25, 23, 0.72)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 1, baseR * 1.15, baseR * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    const glyph = m.kind === "nuke" ? "☢️" : m.kind === "city_ruin" ? "🏚️" : "💀";
    ctx.font = `${Math.max(10, zoom * 0.75)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(glyph, screen.x, screen.y - 2);

    if (zoom >= 11 && m.label) {
      ctx.font = "600 10px sans-serif";
      ctx.fillStyle = "rgba(241, 245, 249, 0.88)";
      const text = m.casualties > 0 ? `${m.label} (${m.casualties})` : m.label;
      ctx.fillText(text, screen.x, screen.y + Math.max(10, zoom * 0.5));
    }
  }
  ctx.restore();
}

export function renderCombatEffects(r) {
  if (!r.simulation?.warfareSystem?.combatEffects) return;
  const effects = r.simulation.warfareSystem.combatEffects;
  if (effects.length === 0) return;
  const ctx = r.ctx;
  ctx.save();
  for (const eff of effects) {
    const screen = r.worldToScreen(eff.x, eff.y);
    const maxDur = eff.type === "nuke" ? 55 : eff.type === "spirit" ? 36 : eff.type === "loot" ? 32 : eff.type === "resource_gain" ? 22 : eff.type === "bomb_blast" ? 26 : eff.type === "casualty" ? 25 : eff.type === "wall_breach" ? 24 : eff.type === "catapult_boulder" ? 18 : eff.type === "tank_shell" || eff.type === "air_strafing" ? 16 : 15;
    const progress = Math.max(0, Math.min(1, 1 - (eff.duration / maxDur)));
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (eff.type === "nuke") {
      if (progress < 0.14) {
        ctx.fillStyle = `rgba(255, 255, 240, ${(1 - progress / 0.14) * 0.38})`;
        ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);
      }
      const shockR = 14 + progress * Math.max(95, r.camera.zoom * 11);
      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
      ctx.lineWidth = Math.max(2, (1 - progress) * 7);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, shockR, 0, Math.PI * 2);
      ctx.stroke();

      const stemH = Math.min(1, progress * 1.6) * Math.max(32, r.camera.zoom * 3.4);
      const capR = Math.max(14, r.camera.zoom * 1.6 * (0.5 + progress * 0.85));
      ctx.fillStyle = `rgba(234, 88, 12, ${alpha * 0.55})`;
      ctx.fillRect(screen.x - capR * 0.2, screen.y - stemH, capR * 0.4, stemH);

      const capGrad = ctx.createRadialGradient(screen.x, screen.y - stemH, capR * 0.1, screen.x, screen.y - stemH, capR);
      capGrad.addColorStop(0, "rgba(254, 249, 195, 0.95)");
      capGrad.addColorStop(0.5, "rgba(249, 115, 22, 0.85)");
      capGrad.addColorStop(1, "rgba(87, 83, 78, 0.25)");
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - stemH, capR, capR * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (eff.type === "catapult_boulder") {
      const pFrom = (eff.fromX !== undefined && eff.fromY !== undefined) ? r.worldToScreen(eff.fromX, eff.fromY) : screen;
      const pTo = (eff.toX !== undefined && eff.toY !== undefined) ? r.worldToScreen(eff.toX, eff.toY) : screen;
      const arcH = Math.max(18, Math.hypot(pTo.x - pFrom.x, pTo.y - pFrom.y) * 0.35);
      const bx = pFrom.x + (pTo.x - pFrom.x) * progress;
      const by = pFrom.y + (pTo.y - pFrom.y) * progress - Math.sin(progress * Math.PI) * arcH;
      ctx.strokeStyle = "rgba(249, 115, 22, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pFrom.x, pFrom.y - 4);
      ctx.quadraticCurveTo((pFrom.x + pTo.x) * 0.5, Math.min(pFrom.y, pTo.y) - arcH, pTo.x, pTo.y);
      ctx.stroke();

      ctx.fillStyle = "#57534e";
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(3, r.camera.zoom * 0.25), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(bx, by - 1, Math.max(1.8, r.camera.zoom * 0.14), 0, Math.PI * 2);
      ctx.fill();
    } else if (eff.type === "shield_block") {
      const rad = 4 + progress * 14;
      ctx.strokeStyle = "rgba(147, 197, 253, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 6, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `${Math.max(11, r.camera.zoom * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("🛡️", screen.x, screen.y - 12 - progress * 8);
    } else if (eff.type === "casualty") {
      ctx.fillStyle = `rgba(185, 28, 28, ${(0.4 * alpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 1, 8 + progress * 6, 4 + progress * 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `${Math.max(14, r.camera.zoom * 1.3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("💀", screen.x, screen.y - 10 - progress * 16);
    } else if (eff.type === "explosion" || eff.type === "bomb_blast") {
      const isBomb = eff.type === "bomb_blast";
      const blastR = (isBomb ? 14 : 10) + progress * (isBomb ? 34 : 26);
      const grad = ctx.createRadialGradient(screen.x, screen.y - 4, 0, screen.x, screen.y - 4, blastR);
      grad.addColorStop(0, "rgba(255, 251, 235, 0.95)");
      grad.addColorStop(0.4, isBomb ? "rgba(239, 68, 68, 0.85)" : "rgba(249, 115, 22, 0.78)");
      grad.addColorStop(1, "rgba(127, 29, 29, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 4, blastR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isBomb ? "rgba(248, 113, 113, 0.7)" : "rgba(251, 146, 60, 0.6)";
      ctx.lineWidth = isBomb ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 4, blastR * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    } else if (eff.type === "air_strafing") {
      const pFrom = (eff.fromX !== undefined && eff.fromY !== undefined) ? r.worldToScreen(eff.fromX, eff.fromY) : screen;
      const pTo = (eff.toX !== undefined && eff.toY !== undefined) ? r.worldToScreen(eff.toX, eff.toY) : screen;
      const lift = Math.max(22, r.camera.zoom * 2.15);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pFrom.x - 4, pFrom.y - lift);
      ctx.lineTo(pTo.x - 2, pTo.y - 4);
      ctx.moveTo(pFrom.x + 4, pFrom.y - lift);
      ctx.lineTo(pTo.x + 2, pTo.y - 4);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (eff.type === "musket_shot" || eff.type === "tracer_fire" || eff.type === "artillery_shell" || eff.type === "tank_shell") {
      const pFrom = (eff.fromX !== undefined && eff.fromY !== undefined) ? r.worldToScreen(eff.fromX, eff.fromY) : screen;
      const pTo = (eff.toX !== undefined && eff.toY !== undefined) ? r.worldToScreen(eff.toX, eff.toY) : screen;
      ctx.strokeStyle = eff.type === "tracer_fire" ? "#38bdf8" : eff.type === "tank_shell" ? "#facc15" : eff.type === "artillery_shell" ? "#f97316" : "#fbbf24";
      ctx.lineWidth = eff.type === "artillery_shell" || eff.type === "tank_shell" ? 3.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(pFrom.x, pFrom.y - 8);
      ctx.lineTo(pTo.x, pTo.y - 8);
      ctx.stroke();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(pFrom.x, pFrom.y - 8, eff.type === "tank_shell" ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(148, 163, 184, ${(0.45 * alpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(pFrom.x, pFrom.y - 10 - progress * 8, 3 + progress * 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (eff.type === "wall_hit" || eff.type === "wall_breach") {
      const isBreach = eff.type === "wall_breach";
      const spread = progress * (isBreach ? 22 : 13);
      ctx.fillStyle = isBreach ? "rgba(100, 116, 139, 0.72)" : "rgba(148, 163, 184, 0.7)";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 6 - progress * 8, 5 + progress * (isBreach ? 14 : 7), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.fillRect(screen.x + spread, screen.y - 6 - spread * 0.7, 3, 3);
      ctx.fillRect(screen.x - spread, screen.y - 8 - spread * 0.5, 3, 3);
      ctx.fillRect(screen.x + spread * 0.5, screen.y - 4 + spread * 0.4, 2.5, 2.5);
      if (isBreach) {
        ctx.font = `${Math.max(12, r.camera.zoom * 1.1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("🧱", screen.x, screen.y - 12 - progress * 12);
      }
    } else if (eff.type === "arrow") {
      if (eff.fromX !== undefined && eff.fromY !== undefined) {
        const pFrom = r.worldToScreen(eff.fromX, eff.fromY);
        const pTo = (eff.toX !== undefined && eff.toY !== undefined) ? r.worldToScreen(eff.toX, eff.toY) : screen;
        const ax = pFrom.x + (pTo.x - pFrom.x) * progress;
        const ay = pFrom.y - 10 + (pTo.y - pFrom.y) * progress - Math.sin(progress * Math.PI) * 14;
        ctx.strokeStyle = "#fde68a";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - (pTo.x - pFrom.x) * 0.12, ay - (pTo.y - pFrom.y) * 0.12 + 3);
        ctx.stroke();
      } else {
        ctx.font = `${Math.max(11, r.camera.zoom * 0.9)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("🏹", screen.x, screen.y - 8 - progress * 10);
      }
    } else if (eff.type === "loot") {
      const floatY = screen.y - 12 - progress * 22;
      ctx.font = `bold ${Math.max(11, r.camera.zoom * 0.72)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
      const label = eff.label || "💰 Loot!";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillRect(screen.x - tw / 2, floatY - 11, tw, 15);
      ctx.fillStyle = "#fde047";
      ctx.fillText(label, screen.x, floatY);
    } else if (eff.type === "resource_gain") {
      const floatY = screen.y - 10 - progress * 16;
      ctx.font = `bold ${Math.max(10, r.camera.zoom * 0.65)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = eff.color || "#bbf7d0";
      ctx.fillText(eff.label || "+1", screen.x, floatY);
    } else if (eff.type === "spirit") {
      const floatY = screen.y - 10 - progress * 24;
      const sway = Math.sin(progress * Math.PI * 3) * 4;
      ctx.fillStyle = `rgba(125, 211, 252, ${(0.35 * alpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(screen.x + sway, floatY - 4, 8 + progress * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${Math.max(13, r.camera.zoom * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#e0f2fe";
      ctx.fillText("👻", screen.x + sway, floatY);
      if (eff.label) {
        ctx.font = `600 ${Math.max(9, r.camera.zoom * 0.45)}px sans-serif`;
        ctx.fillText(eff.label, screen.x + sway, floatY - 12);
      }
    } else {
      const sparkDist = progress * 12;
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(screen.x + sparkDist, screen.y - 8 - sparkDist, 2.5, 2.5);
      ctx.fillRect(screen.x - sparkDist, screen.y - 8 - sparkDist, 2.5, 2.5);
      ctx.fillRect(screen.x + sparkDist * 0.75, screen.y - 8 + sparkDist * 0.75, 2.2, 2.2);
      ctx.fillRect(screen.x - sparkDist * 0.75, screen.y - 8 + sparkDist * 0.75, 2.2, 2.2);
      ctx.fillStyle = "#fb923c";
      ctx.fillRect(screen.x, screen.y - 10 - sparkDist * 1.15, 2, 2);

      ctx.font = `${Math.max(13, r.camera.zoom * 1.1)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("⚔️", screen.x, screen.y - 10 - progress * 10);
    }
    ctx.restore();
  }
  ctx.restore();
}

export function renderClouds(r) {
  const ctx = r.ctx;
  const dtFactor = Math.min(3, (r._frameDtSec || 0.01667) * 60);
  const screen = r._pN;
  const ground = r._pE;
  for (const c of r.clouds) {
    if (!r._isFrozen) {
      c.x += c.speed * dtFactor;
      if (c.x > r.world.width + 30) c.x = -30;
    }

    r.worldToScreenFast(c.x, c.y, 120, screen);
    r.worldToScreenFast(c.x, c.y, 25, ground);

    ctx.fillStyle = `rgba(0, 0, 0, ${c.opacity * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, c.size * r.camera.zoom * 0.35, c.size * r.camera.zoom * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, c.size * r.camera.zoom * 0.4);
    grad.addColorStop(0, `rgba(255, 255, 255, ${c.opacity})`);
    grad.addColorStop(0.7, `rgba(240, 245, 255, ${c.opacity * 0.8})`);
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, c.size * r.camera.zoom * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function renderWeather(r) {
  const ws = r.simulation?.weatherSystem;
  if (!ws) return;
  const ctx = r.ctx;
  const now = r._frameNow;
  const w = r.canvas.width;
  const h = r.canvas.height;
  const weather = ws.currentWeather;

  if (weather === "rain" || weather === "storm") {
    const dropCount = weather === "storm" ? 220 : 120;
    ctx.save();
    ctx.strokeStyle = weather === "storm" ? "rgba(186, 230, 253, 0.55)" : "rgba(224, 242, 254, 0.40)";
    ctx.lineWidth = weather === "storm" ? 1.5 : 1.0;

    const speed = weather === "storm" ? 0.8 : 0.5;
    const slant = weather === "storm" ? 8 : 4;
    const len = weather === "storm" ? 22 : 14;

    ctx.beginPath();
    for (let i = 0; i < dropCount; i++) {
      const px = (i * 37 + (now * speed * 0.4) * (1 + (i % 5) * 0.2)) % (w + 100) - 50;
      const py = (i * 97 + now * speed * 1.5) % (h + 50) - 30;
      ctx.moveTo(px, py);
      ctx.lineTo(px - slant, py + len);
    }
    ctx.stroke();

    ctx.fillStyle = weather === "storm" ? "rgba(15, 23, 42, 0.28)" : "rgba(30, 41, 59, 0.14)";
    ctx.fillRect(0, 0, w, h);

    if (ws.recentLightning && ws.recentLightning.expires > now) {
      const remaining = ws.recentLightning.expires - now;
      const alpha = Math.max(0, Math.min(0.65, remaining / 350));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, w, h);

      const screen = r.worldToScreen(ws.recentLightning.x, ws.recentLightning.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(screen.x + Math.sin(now * 0.1) * 20, 0);
      ctx.lineTo(screen.x - 15, screen.y * 0.35);
      ctx.lineTo(screen.x + 20, screen.y * 0.7);
      ctx.lineTo(screen.x, screen.y);
      ctx.stroke();
    }
    ctx.restore();
  } else if (weather === "drought") {
    ctx.save();
    const pulse = 0.05 + 0.03 * Math.sin(now * 0.002);
    ctx.fillStyle = `rgba(245, 158, 11, ${pulse})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export function renderDayNightLighting(r) {
  const time = r.simulation?.clock?.getTime() || { hours: 12 };
  const h = time.hours;
  const ctx = r.ctx;
  const w = r.canvas.width;
  const height = r.canvas.height;

  const angle = ((h - 1) / 24) * Math.PI * 2;
  const nightIntensity = Math.max(0, -Math.cos(angle));
  if (nightIntensity > 0.02) {
    const alpha = nightIntensity * 0.42;
    ctx.fillStyle = `rgba(10, 20, 50, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, w, height);
  }

  const duskDist = Math.abs(h - 18.5);
  if (duskDist < 2.5) {
    const duskAlpha = Math.max(0, (1 - duskDist / 2.5) * 0.16);
    ctx.fillStyle = `rgba(234, 88, 12, ${duskAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, w, height);
  }

  const dawnDist = Math.abs(h - 6.5);
  if (dawnDist < 2.5) {
    const dawnAlpha = Math.max(0, (1 - dawnDist / 2.5) * 0.14);
    ctx.fillStyle = `rgba(192, 132, 252, ${dawnAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, w, height);
  }
}

export function renderVisualEffects(r, visualRng) {
  const now = r._frameNow;
  const ctx = r.ctx;
  if (r.visualEffects.length > 0) {
    let writeIdx = 0;
    for (let i = 0; i < r.visualEffects.length; i++) {
      const fx = r.visualEffects[i];
      if (now - fx.start < fx.duration) {
        r.visualEffects[writeIdx++] = fx;
      }
    }
    r.visualEffects.length = writeIdx;
  }

  for (const fx of r.visualEffects) {
    const elapsed = now - fx.start;
    const progress = elapsed / fx.duration;
    const screen = r.worldToScreen(fx.x, fx.y);

    if (fx.type === "smite") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = Math.max(3, (1 - progress) * 8);
      ctx.beginPath();
      ctx.moveTo(screen.x - 30 + visualRng.next() * 20, 0);
      ctx.lineTo(screen.x + 10, screen.y * 0.4);
      ctx.lineTo(screen.x - 15, screen.y * 0.7);
      ctx.lineTo(screen.x, screen.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(239, 68, 68, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, progress * 60, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === "bless" || fx.type === "bounty") {
      const rayW = (1 - progress) * 40;
      const grad = ctx.createLinearGradient(screen.x, 0, screen.x, screen.y);
      grad.addColorStop(0, "rgba(251, 191, 36, 0.6)");
      grad.addColorStop(1, "rgba(251, 191, 36, 0.1)");
      ctx.fillStyle = grad;
      ctx.fillRect(screen.x - rayW / 2, 0, rayW, screen.y);

      ctx.strokeStyle = `rgba(251, 191, 36, ${1 - progress})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, progress * 45, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.type === "nuke") {
      if (progress < 0.16) {
        const flashAlpha = (1 - progress / 0.16) * 0.45;
        ctx.fillStyle = `rgba(255, 255, 240, ${flashAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);
      }
      const waveR = Math.max(12, progress * Math.max(110, r.camera.zoom * 14));
      ctx.strokeStyle = `rgba(251, 146, 60, ${Math.max(0, 1 - progress)})`;
      ctx.lineWidth = Math.max(2, (1 - progress) * 8);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, waveR, 0, Math.PI * 2);
      ctx.stroke();

      const cloudAlpha = Math.max(0, 1 - progress * 0.85);
      const rise = Math.min(1, progress * 1.7) * Math.max(36, r.camera.zoom * 3.8);
      const capR = Math.max(16, r.camera.zoom * 1.9 * (0.45 + progress * 0.9));
      ctx.fillStyle = `rgba(234, 88, 12, ${(cloudAlpha * 0.55).toFixed(3)})`;
      ctx.fillRect(screen.x - capR * 0.22, screen.y - rise, capR * 0.44, rise);
      const capGrad = ctx.createRadialGradient(
        screen.x, screen.y - rise, capR * 0.12,
        screen.x, screen.y - rise, capR
      );
      capGrad.addColorStop(0, `rgba(254, 249, 195, ${(cloudAlpha * 0.95).toFixed(3)})`);
      capGrad.addColorStop(0.45, `rgba(249, 115, 22, ${(cloudAlpha * 0.85).toFixed(3)})`);
      capGrad.addColorStop(1, `rgba(68, 64, 60, ${(cloudAlpha * 0.4).toFixed(3)})`);
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - rise, capR, capR * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
