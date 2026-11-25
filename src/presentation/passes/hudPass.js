// Canvas HUD, Wars Banner Overlay & Selected Entity Reticle Pass.

export function buildWarsPanelRows(sim) {
  const diplo = sim.diplomacySystem;
  if (!diplo) return [];
  const out = [];
  const tick = sim.clock?.tick ?? 0;
  const fmtAge = (startTick) => {
    const days = Math.max(0, Math.floor((tick - startTick) / 12));
    return `day ${days}`;
  };
  for (const w of diplo.activeWars) {
    const cas = Object.values(w.casualties || {}).reduce((a, b) => a + (b || 0), 0);
    out.push({ text: `⚔️ ${w.attackerName} vs ${w.defenderName}`, color: "#fecaca", jump: w.frontLine || null });
    out.push({ text: `   ${w.casusBelli || "War"} · ${fmtAge(w.startTick)} · ${cas} lost · ${(w.battles || []).length} battles`, color: "#fca5a5" });
  }
  for (const w of (diplo.warHistory || []).slice(0, 4)) {
    const winner = w.winnerId ? sim.settlementSystem?.settlements?.get(w.winnerId)?.name || w.winnerId : null;
    const cas = Object.values(w.casualties || {}).reduce((a, b) => a + (b || 0), 0);
    out.push({ text: `🕊️ ${w.attackerName}–${w.defenderName}: peace${winner ? `, ${winner} won` : ""} (${cas} lost)`, color: "#86efac", jump: w.frontLine || (w.battles || []).slice(-1)[0] || null });
  }
  if (!out.length) out.push({ text: "   No wars recorded. The realm is at peace.", color: "#64748b" });
  return out;
}

export function renderHUD(r) {
  const sim = r.simulation;
  if (!sim) return;
  const ctx = r.ctx;
  const fires = r.world?.fireTiles ? r.world.countFires?.() || 0 : 0;
  let pop = 0;
  if (sim.agents) {
    for (let i = 0; i < sim.agents.length; i++) {
      if (sim.agents[i].alive) pop++;
    }
  }
  const settlements = sim.settlementSystem ? sim.settlementSystem.settlements.size : 0;
  const era = sim.clock ? `Day ${Math.floor((sim.clock.tick || 0) / 100) + 1}` : "";
  const wars = sim.diplomacySystem?.wars ? sim.diplomacySystem.wars.length : 0;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.lineWidth = 1;

  const lines = [
    `${era} · Pop ${pop} · Realms ${settlements}`,
    `Wars ${wars} · Mode: ${r.camera.is25D ? "2.5D Isometric 3D" : "2D Top-Down"}${fires > 0 ? ` · 🔥 Fires ${fires}` : ""}`
  ];

  if (r._warsPanel == null) r._warsPanel = false;
  r._warBannerRect = null;
  let activeWar = null;
  if (sim.diplomacySystem?.activeWars) {
    for (let i = 0; i < sim.diplomacySystem.activeWars.length; i++) {
      const w = sim.diplomacySystem.activeWars[i];
      if (w.active && w.frontLine) { activeWar = w; break; }
    }
  }
  if (activeWar) {
    const fl = activeWar.frontLine;
    lines.push(`⚔️ ${activeWar.attackerName} vs ${activeWar.defenderName} — Front @ (${Math.round(fl.x)},${Math.round(fl.y)}) ▸click`);
  }
  const totalWars = (sim.diplomacySystem?.activeWars?.length || 0) + (sim.diplomacySystem?.warHistory?.length || 0);
  lines.push(`${r._warsPanel ? "▼" : "▶"} [W]ars — ${sim.diplomacySystem?.activeWars?.length || 0} active · ${totalWars} recorded`);

  if (sim.chronicleSystem?.entries?.length > 0) {
    const entries = sim.chronicleSystem.entries;
    const count = entries.length;
    let notable = null;
    for (let i = count - 1; i >= Math.max(0, count - 8); i--) {
      const e = entries[i];
      if (e.icon === "⚔️" || e.icon === "🕊️") {
        notable = e;
        break;
      }
    }
    if (!notable) notable = entries[count - 1];
    if (notable) {
      let txt = `${notable.date}: ${notable.text}`;
      if (txt.length > 44) txt = txt.slice(0, 43) + "…";
      lines.push(txt);
    }
  }

  const canvasW = r.canvas?.width || 1280;
  const isNarrow = canvasW < 960;
  const boxW = isNarrow ? Math.min(248, Math.max(196, canvasW - 24)) : 280;
  const topOffset = Number.isFinite(r.hudTopOffset) ? r.hudTopOffset : 12;
  const panelLines = r._warsPanel ? buildWarsPanelRows(sim) : [];
  const boxH = (lines.length + panelLines.length) * 18 + 14;
  ctx.beginPath();
  ctx.roundRect(12, topOffset, boxW, boxH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.font = isNarrow ? "11px monospace" : "12px monospace";
  ctx.textAlign = "left";
  const warsToggleIdx = activeWar ? 3 : 2;
  let screenYCursor = topOffset + 18;
  lines.forEach((line, i) => {
    const isWarBanner = activeWar && i === 2;
    ctx.fillStyle = isWarBanner ? "#fecaca" : (i === 1 && wars > 0 ? "#fca5a5" : "#e2e8f0");
    const clipped = isNarrow && line.length > 34 ? line.slice(0, 33) + "…" : line;
    ctx.fillText(clipped, 20, screenYCursor);
    if (isWarBanner) {
      r._warBannerRect = { x: 12, y: screenYCursor - 18 + 6, w: boxW, h: 18, frontLine: activeWar.frontLine };
    }
    if (i === warsToggleIdx) {
      r._warsToggleRect = { x: 12, y: screenYCursor - 18 + 6, w: boxW, h: 18 };
    }
    screenYCursor += 18;
  });

  r._warsPanelRows = [];
  for (const pl of panelLines) {
    ctx.fillStyle = pl.color || "#94a3b8";
    const clipped = isNarrow && pl.text.length > 34 ? pl.text.slice(0, 33) + "…" : pl.text;
    ctx.fillText(clipped, 20, screenYCursor);
    if (pl.jump) {
      r._warsPanelRows.push({ x: 12, y: screenYCursor - 18 + 6, w: boxW, h: 18, frontLine: pl.jump });
    }
    screenYCursor += 18;
  }
  ctx.restore();
}

export function renderSelectionReticle(r) {
  if (!r.selectedEntity) return;
  const e = r.selectedEntity.entity || r.selectedEntity;
  if (r.selectedEntity.kind === "agent" && e?.alive === false) return;
  if (e && (e.x !== undefined || e.centroidX !== undefined)) {
    const coords = r.getEntityRenderCoords(e);
    const elev = r.getInterpolatedElevation(coords.x, coords.y);
    const screen = r.worldToScreen(coords.x, coords.y, elev);
    r.ctx.save();
    r.ctx.strokeStyle = "#38bdf8";
    r.ctx.lineWidth = 2;
    r.ctx.setLineDash([4, 4]);
    r.ctx.beginPath();
    r.ctx.arc(screen.x, screen.y, Math.max(16, r.camera.zoom * 1.4), 0, Math.PI * 2);
    r.ctx.stroke();
    if (e.name) {
      r.ctx.fillStyle = "#38bdf8";
      r.ctx.font = "bold 12px sans-serif";
      r.ctx.textAlign = "center";
      r.ctx.fillText(e.name, screen.x, screen.y - 24);
    }
    r.ctx.restore();
  }
}
