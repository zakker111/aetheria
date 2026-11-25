// 2.5D Structures, Fortifications, Resources, Ground Loot & Settlement Centers Pass.

/**
 * 2.5D Isometric Curtain Walls, Timber Palisades, Gatehouses & Siege Breaches.
 */
export function render25DFortification(r, seg, screen) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const bs = Math.max(5, zoom * 0.96);
  const now = r._frameNow;

  ctx.save();

  if (seg.state === "breach" || seg.hp <= 0) {
    ctx.fillStyle = "rgba(28, 25, 23, 0.72)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + bs * 0.08, bs * 0.58, bs * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - bs * 0.44, screen.y - bs * 0.28, bs * 0.18, bs * 0.28);
    ctx.fillRect(screen.x + bs * 0.24, screen.y - bs * 0.22, bs * 0.18, bs * 0.22);

    ctx.fillStyle = "#64748b";
    ctx.fillRect(screen.x - bs * 0.14, screen.y - bs * 0.08, bs * 0.16, bs * 0.12);
    ctx.fillRect(screen.x + bs * 0.05, screen.y + bs * 0.02, bs * 0.14, bs * 0.1);

    const dustPhase = (now * 0.002 + (seg.id || 0) * 0.37) % 1;
    ctx.fillStyle = `rgba(148, 163, 184, ${(0.35 * (1 - dustPhase)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - bs * 0.25 - dustPhase * 8, 2 + dustPhase * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + bs * 0.12, bs * 0.62, bs * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (seg.kind === "gate") {
    const pH = bs * 1.15;
    const pW = bs * 0.26;
    const wallCol = seg.tierKey === "palisade" ? "#78350f" : seg.tierKey === "bastion" ? "#334155" : "#475569";
    const topCol = seg.tierKey === "palisade" ? "#92400e" : "#94a3b8";

    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - bs * 0.24, screen.y - pH * 0.72, bs * 0.48, pH * 0.72);
    ctx.fillStyle = wallCol;
    ctx.fillRect(screen.x - bs * 0.48, screen.y - pH, pW, pH);
    ctx.fillRect(screen.x + bs * 0.48 - pW, screen.y - pH, pW, pH);
    ctx.fillStyle = topCol;
    ctx.fillRect(screen.x - bs * 0.5, screen.y - pH - bs * 0.14, bs * 1.0, bs * 0.18);

    const pulse = 0.75 + 0.25 * Math.sin(now * 0.012 + (seg.id || 0));
    ctx.fillStyle = `rgba(251, 191, 36, ${pulse.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(screen.x - bs * 0.26, screen.y - pH * 0.52, Math.max(1.5, bs * 0.09), 0, Math.PI * 2);
    ctx.arc(screen.x + bs * 0.26, screen.y - pH * 0.52, Math.max(1.5, bs * 0.09), 0, Math.PI * 2);
    ctx.fill();
  } else if (seg.tierKey === "palisade") {
    const sH = bs * 0.85;
    ctx.fillStyle = "#78350f";
    for (let k = -2; k <= 2; k++) {
      const sx = screen.x + k * bs * 0.18;
      ctx.fillRect(sx - bs * 0.07, screen.y - sH, bs * 0.14, sH);
      ctx.beginPath();
      ctx.moveTo(sx, screen.y - sH - bs * 0.18);
      ctx.lineTo(sx - bs * 0.07, screen.y - sH);
      ctx.lineTo(sx + bs * 0.07, screen.y - sH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - bs * 0.46, screen.y - sH * 0.55, bs * 0.92, bs * 0.12);
  } else {
    const wH = seg.tierKey === "bastion" ? bs * 1.08 : bs * 0.92;
    const faceMain = seg.tierKey === "bastion" ? "#334155" : "#475569";
    const faceLit = seg.tierKey === "bastion" ? "#64748b" : "#94a3b8";

    ctx.fillStyle = faceMain;
    ctx.fillRect(screen.x - bs * 0.48, screen.y - wH, bs * 0.96, wH);
    ctx.fillStyle = faceLit;
    ctx.fillRect(screen.x - bs * 0.48, screen.y - wH, bs * 0.96, bs * 0.16);

    ctx.fillRect(screen.x - bs * 0.46, screen.y - wH - bs * 0.16, bs * 0.22, bs * 0.16);
    ctx.fillRect(screen.x - bs * 0.11, screen.y - wH - bs * 0.16, bs * 0.22, bs * 0.16);
    ctx.fillRect(screen.x + bs * 0.24, screen.y - wH - bs * 0.16, bs * 0.22, bs * 0.16);
  }

  if (seg.maxHp > 0 && seg.hp < seg.maxHp) {
    const ratio = Math.max(0, Math.min(1, seg.hp / seg.maxHp));
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.18, screen.y - bs * 0.7);
    ctx.lineTo(screen.x + bs * 0.04, screen.y - bs * 0.35);
    ctx.lineTo(screen.x - bs * 0.08, screen.y - bs * 0.1);
    ctx.stroke();

    const barW = bs * 0.86;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(screen.x - barW * 0.5, screen.y - bs * 1.25, barW, 3);
    ctx.fillStyle = ratio > 0.5 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(screen.x - barW * 0.5, screen.y - bs * 1.25, barW * ratio, 3);
  }

  ctx.restore();
}

/**
 * 2.5D Loot Sack: small brown bundle with a tie, sized by contents.
 */
export function render25DGroundItem(r, item, screen) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const s = Math.max(2.5, zoom * 0.38);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 1.5, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8a6a3b";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - s * 0.45, s * 0.62, s * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 235, 190, 0.35)";
  ctx.beginPath();
  ctx.ellipse(screen.x - s * 0.2, screen.y - s * 0.6, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5c4322";
  ctx.lineWidth = Math.max(1, zoom * 0.06);
  ctx.beginPath();
  ctx.moveTo(screen.x - s * 0.3, screen.y - s * 0.9);
  ctx.lineTo(screen.x + s * 0.3, screen.y - s * 0.9);
  ctx.stroke();
  ctx.restore();
}

/**
 * 2.5D Detailed Graphic for Trees, Berry Bushes, Ore Veins & Water Springs.
 */
export function render25DResource(r, res, screen, elev) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const type = res.resourceType;
  const isDepleted = res.depleted || res.amount <= 0;
  const fullness = Math.max(0, Math.min(1, (res.amount || 0) / (res.maxAmount || 40)));
  const s = Math.max(3, zoom * 0.7);

  ctx.save();

  ctx.fillStyle = isDepleted ? "rgba(0, 0, 0, 0.16)" : "rgba(0, 0, 0, 0.26)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 2, s * 0.65, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === "wood") {
    if (isDepleted) {
      ctx.fillStyle = "#5c2c16";
      ctx.fillRect(screen.x - s * 0.22, screen.y - s * 0.3, s * 0.44, s * 0.3);
      ctx.fillStyle = "#a16207";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.3, s * 0.24, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#713f12";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.3, s * 0.14, s * 0.06, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ca8a04";
      ctx.fillRect(screen.x + s * 0.25, screen.y - s * 0.05, s * 0.08, s * 0.05);
      ctx.fillRect(screen.x - s * 0.32, screen.y + s * 0.05, s * 0.07, s * 0.04);
    } else {
      const stage = res.growthStage || (fullness < 0.25 ? "sapling" : fullness < 0.6 ? "young" : "mature");
      const stageScale = stage === "sapling" ? 0.38 : stage === "young" ? 0.68 : stage === "ancient" ? 1.18 : 1.0;
      const canopyScale = stageScale * (0.65 + 0.35 * fullness);

      if (stage === "sapling") {
        ctx.strokeStyle = "#713f12";
        ctx.lineWidth = Math.max(1.2, s * 0.12);
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(screen.x, screen.y - s * 0.55);
        ctx.stroke();

        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 0.65, s * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#86efac";
        ctx.beginPath();
        ctx.arc(screen.x - s * 0.08, screen.y - s * 0.72, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const trunkW = s * (stage === "ancient" ? 0.36 : 0.28) * Math.max(0.75, stageScale);
        const trunkH = s * 0.64 * Math.max(0.75, stageScale);
        ctx.fillStyle = "#5c2c16";
        ctx.fillRect(screen.x - trunkW * 0.5, screen.y - trunkH, trunkW, trunkH + s * 0.05);

        ctx.fillStyle = stage === "ancient" ? "#052e16" : "#14532d";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 0.8 * canopyScale, s * 0.7 * canopyScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = stage === "young" ? "#22c55e" : "#16a34a";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 1.15 * canopyScale, s * 0.58 * canopyScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.arc(screen.x - s * 0.2 * canopyScale, screen.y - s * 1.3 * canopyScale, s * 0.26 * canopyScale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === "food") {
    if (isDepleted) {
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.1, s * 0.4, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.25, screen.y);
      ctx.lineTo(screen.x - s * 0.1, screen.y - s * 0.25);
      ctx.moveTo(screen.x, screen.y + s * 0.05);
      ctx.lineTo(screen.x + s * 0.15, screen.y - s * 0.28);
      ctx.moveTo(screen.x - s * 0.05, screen.y);
      ctx.lineTo(screen.x + s * 0.05, screen.y - s * 0.35);
      ctx.stroke();
    } else {
      const bushScale = 0.5 + 0.5 * fullness;
      ctx.fillStyle = "#3f6212";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - s * 0.35 * bushScale, s * 0.55 * bushScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#65a30d";
      ctx.beginPath();
      ctx.arc(screen.x - s * 0.12 * bushScale, screen.y - s * 0.45 * bushScale, s * 0.38 * bushScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(screen.x - s * 0.2 * bushScale, screen.y - s * 0.3 * bushScale, s * 0.12 * bushScale, 0, Math.PI * 2);
      if (fullness > 0.3) {
        ctx.arc(screen.x + s * 0.18 * bushScale, screen.y - s * 0.22 * bushScale, s * 0.12 * bushScale, 0, Math.PI * 2);
      }
      if (fullness > 0.6) {
        ctx.arc(screen.x, screen.y - s * 0.45 * bushScale, s * 0.14 * bushScale, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  } else if (type === "ore" || type === "gem" || type === "uranium") {
    const isGem = type === "gem";
    const isUranium = type === "uranium" || res.depositTier === "uranium_mountain";
    const isIronMtn = res.depositTier === "iron_mountain";
    const mScale = (isUranium || isIronMtn) ? 1.45 : 1.0;
    if (isDepleted) {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.45 * mScale, screen.y);
      ctx.lineTo(screen.x - s * 0.3 * mScale, screen.y - s * 0.3 * mScale);
      ctx.lineTo(screen.x + s * 0.25 * mScale, screen.y - s * 0.32 * mScale);
      ctx.lineTo(screen.x + s * 0.45 * mScale, screen.y - s * 0.05 * mScale);
      ctx.lineTo(screen.x + s * 0.2 * mScale, screen.y + s * 0.08 * mScale);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.2, screen.y - s * 0.15);
      ctx.lineTo(screen.x + s * 0.1, screen.y - s * 0.1);
      ctx.lineTo(screen.x + s * 0.2, screen.y - s * 0.2);
      ctx.stroke();
    } else {
      ctx.fillStyle = isUranium ? "#14532d" : isGem ? "#2e1065" : isIronMtn ? "#1e293b" : "#334155";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.52 * mScale, screen.y);
      ctx.lineTo(screen.x - s * 0.35 * mScale, screen.y - s * 0.65 * mScale);
      ctx.lineTo(screen.x + s * 0.12 * mScale, screen.y - s * 0.78 * mScale);
      ctx.lineTo(screen.x + s * 0.56 * mScale, screen.y - s * 0.22 * mScale);
      ctx.lineTo(screen.x + s * 0.32 * mScale, screen.y + s * 0.1 * mScale);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isUranium ? "#166534" : isGem ? "#581c87" : isIronMtn ? "#475569" : "#64748b";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.35 * mScale, screen.y - s * 0.65 * mScale);
      ctx.lineTo(screen.x + s * 0.12 * mScale, screen.y - s * 0.78 * mScale);
      ctx.lineTo(screen.x + s * 0.05 * mScale, screen.y - s * 0.26 * mScale);
      ctx.lineTo(screen.x - s * 0.25 * mScale, screen.y - s * 0.15 * mScale);
      ctx.closePath();
      ctx.fill();

      if (isUranium) {
        ctx.fillStyle = "#84cc16";
        ctx.fillRect(screen.x - s * 0.18, screen.y - s * 0.65, s * 0.18, s * 0.22);
        ctx.fillStyle = "#bef264";
        ctx.fillRect(screen.x + s * 0.14, screen.y - s * 0.58, s * 0.16, s * 0.2);
        ctx.fillStyle = "#ecfccb";
        ctx.fillRect(screen.x - s * 0.1, screen.y - s * 0.6, s * 0.08, s * 0.08);
      } else if (isGem) {
        ctx.fillStyle = "#c084fc";
        ctx.fillRect(screen.x - s * 0.12, screen.y - s * 0.48, s * 0.16, s * 0.16);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(screen.x + s * 0.14, screen.y - s * 0.52, s * 0.14, s * 0.14);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(screen.x - s * 0.07, screen.y - s * 0.45, s * 0.06, s * 0.06);
      } else if (isIronMtn) {
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(screen.x - s * 0.22, screen.y - s * 0.62, s * 0.22, s * 0.18);
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(screen.x + s * 0.12, screen.y - s * 0.55, s * 0.18, s * 0.18);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(screen.x - s * 0.16, screen.y - s * 0.6, s * 0.08, s * 0.08);
      } else {
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(screen.x - s * 0.15, screen.y - s * 0.4, s * 0.15, s * 0.15);
        if (fullness > 0.4) {
          ctx.fillRect(screen.x + s * 0.15, screen.y - s * 0.5, s * 0.15, s * 0.15);
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(screen.x - s * 0.1, screen.y - s * 0.4, s * 0.06, s * 0.06);
      }
    }
  } else {
    if (isDepleted) {
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.1, s * 0.48, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = "#291305";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.2, screen.y - s * 0.1);
      ctx.lineTo(screen.x, screen.y - s * 0.15);
      ctx.lineTo(screen.x + s * 0.18, screen.y - s * 0.08);
      ctx.moveTo(screen.x - s * 0.05, screen.y - s * 0.05);
      ctx.lineTo(screen.x + s * 0.08, screen.y - s * 0.18);
      ctx.stroke();
    } else {
      const waterR = s * (0.32 + 0.18 * fullness);
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.1, waterR, waterR * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#e0f2fe";
      ctx.beginPath();
      ctx.ellipse(screen.x - waterR * 0.25, screen.y - s * 0.14, waterR * 0.25, waterR * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * 2.5D Isometric Architectural Graphics for All Building & Monument Types.
 */
export function render25DBuilding(r, b, screen, elev) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const type = b.buildingType || b.type || "house";
  const isMonument = Boolean(b.isHeritage || String(type).startsWith("monument_"));
  const bs = Math.max(6, zoom * (isMonument ? 1.55 : type === "castle" ? 1.4 : type === "tower" ? 1.0 : 0.9));
  const now = r._frameNow;

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + bs * 0.15, bs * 0.8, bs * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const isRuined = Boolean(b.isRuined || (b.health !== undefined && b.health <= 0) || type === "ruin");

  if (isRuined) {
    const wallH = bs * 0.45;

    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.55, screen.y);
    ctx.lineTo(screen.x, screen.y + bs * 0.28);
    ctx.lineTo(screen.x + bs * 0.55, screen.y);
    ctx.lineTo(screen.x, screen.y - bs * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - bs * 0.48, screen.y - wallH * 0.8, bs * 0.16, wallH * 0.8);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(screen.x + bs * 0.32, screen.y - wallH * 0.5, bs * 0.16, wallH * 0.5);

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = Math.max(2, bs * 0.12);
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.45, screen.y - wallH * 0.7);
    ctx.lineTo(screen.x + bs * 0.2, screen.y + bs * 0.1);
    ctx.stroke();

    ctx.strokeStyle = "#292524";
    ctx.lineWidth = Math.max(1.5, bs * 0.08);
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.1, screen.y - wallH * 0.5);
    ctx.lineTo(screen.x + bs * 0.4, screen.y - bs * 0.05);
    ctx.stroke();

    const emberFlicker = 0.5 + 0.5 * Math.sin(now * 0.01 + (b.id || 0));
    ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + emberFlicker * 0.5})`;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - wallH * 0.1, Math.max(2, bs * 0.15), 0, Math.PI * 2);
    ctx.fill();

    const smokeOffset = ((now * 0.002 + (b.id || 0) * 0.3) % 1);
    ctx.fillStyle = `rgba(100, 100, 100, ${0.35 * (1 - smokeOffset)})`;
    ctx.beginPath();
    ctx.arc(screen.x + Math.sin(now * 0.004) * 3, screen.y - wallH - smokeOffset * 14, 2 + smokeOffset * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (type === "house") {
    const wallH = bs * 0.75;
    const roofH = bs * 0.65;

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.5, screen.y);
    ctx.lineTo(screen.x, screen.y + bs * 0.25);
    ctx.lineTo(screen.x, screen.y + bs * 0.25 - wallH);
    ctx.lineTo(screen.x - bs * 0.5, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + bs * 0.25);
    ctx.lineTo(screen.x + bs * 0.5, screen.y);
    ctx.lineTo(screen.x + bs * 0.5, screen.y - wallH);
    ctx.lineTo(screen.x, screen.y + bs * 0.25 - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#c2410c";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + bs * 0.25 - wallH);
    ctx.lineTo(screen.x - bs * 0.55, screen.y - wallH);
    ctx.lineTo(screen.x, screen.y - wallH - roofH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ea580c";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + bs * 0.25 - wallH);
    ctx.lineTo(screen.x + bs * 0.55, screen.y - wallH);
    ctx.lineTo(screen.x, screen.y - wallH - roofH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#78350f";
    ctx.fillRect(screen.x + bs * 0.15, screen.y - wallH - roofH * 0.7, bs * 0.18, bs * 0.4);
    const smokeOffset = (now * 0.003) % 1;
    ctx.fillStyle = `rgba(200, 200, 200, ${0.45 * (1 - smokeOffset)})`;
    ctx.beginPath();
    ctx.arc(screen.x + bs * 0.24, screen.y - wallH - roofH - smokeOffset * 10, 3 + smokeOffset * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#78350f";
    ctx.fillRect(screen.x + bs * 0.12, screen.y - wallH * 0.4, bs * 0.16, wallH * 0.45);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(screen.x - bs * 0.35, screen.y - wallH * 0.6, bs * 0.16, bs * 0.16);
  } else if (type === "workshop") {
    const wallH = bs * 0.8;
    ctx.fillStyle = "#78716c";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.55, screen.y);
    ctx.lineTo(screen.x, screen.y + bs * 0.28);
    ctx.lineTo(screen.x + bs * 0.55, screen.y);
    ctx.lineTo(screen.x + bs * 0.55, screen.y - wallH);
    ctx.lineTo(screen.x - bs * 0.55, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.4);
    ctx.lineTo(screen.x - bs * 0.6, screen.y - wallH);
    ctx.lineTo(screen.x, screen.y + bs * 0.28 - wallH);
    ctx.lineTo(screen.x + bs * 0.6, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - wallH * 0.25, bs * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "farm") {
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.7, screen.y);
    ctx.lineTo(screen.x, screen.y + bs * 0.35);
    ctx.lineTo(screen.x + bs * 0.7, screen.y);
    ctx.lineTo(screen.x, screen.y - bs * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(screen.x + i * bs * 0.12 - bs * 0.3, screen.y + i * bs * 0.06);
      ctx.lineTo(screen.x + i * bs * 0.12 + bs * 0.3, screen.y + i * bs * 0.06);
      ctx.stroke();
    }

    ctx.fillStyle = "#dc2626";
    ctx.fillRect(screen.x - bs * 0.25, screen.y - bs * 0.6, bs * 0.5, bs * 0.45);
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - bs * 0.85);
    ctx.lineTo(screen.x - bs * 0.3, screen.y - bs * 0.6);
    ctx.lineTo(screen.x + bs * 0.3, screen.y - bs * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (type === "castle") {
    const keepH = bs * 1.2;
    const bH = bs * 0.9;
    const bW = bs * 0.26;

    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.45, screen.y);
    ctx.lineTo(screen.x, screen.y + bs * 0.25);
    ctx.lineTo(screen.x + bs * 0.45, screen.y);
    ctx.lineTo(screen.x + bs * 0.45, screen.y - keepH);
    ctx.lineTo(screen.x - bs * 0.45, screen.y - keepH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - bs * 0.55, screen.y - bH, bW, bH);
    ctx.fillRect(screen.x + bs * 0.55 - bW, screen.y - bH, bW, bH);

    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.55 + bW / 2, screen.y - bH - bs * 0.35);
    ctx.lineTo(screen.x - bs * 0.58, screen.y - bH);
    ctx.lineTo(screen.x - bs * 0.55 + bW + 2, screen.y - bH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(screen.x + bs * 0.55 - bW / 2, screen.y - bH - bs * 0.35);
    ctx.lineTo(screen.x + bs * 0.55 - bW - 2, screen.y - bH);
    ctx.lineTo(screen.x + bs * 0.58, screen.y - bH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - keepH);
    ctx.lineTo(screen.x, screen.y - keepH - bs * 0.5);
    ctx.stroke();

    const wave = Math.sin(now * 0.006) * 3;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - keepH - bs * 0.5);
    ctx.lineTo(screen.x + bs * 0.4 + wave, screen.y - keepH - bs * 0.38);
    ctx.lineTo(screen.x, screen.y - keepH - bs * 0.26);
    ctx.closePath();
    ctx.fill();
  } else if (type === "tower") {
    const tH = bs * 1.35;
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, bs * 0.35, bs * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.fillRect(screen.x - bs * 0.35, screen.y - tH, bs * 0.7, tH);

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - tH - bs * 0.55);
    ctx.lineTo(screen.x - bs * 0.42, screen.y - tH);
    ctx.lineTo(screen.x + bs * 0.42, screen.y - tH);
    ctx.closePath();
    ctx.fill();
  } else if (type === "temple") {
    const wallH = bs * 0.95;
    const colW = bs * 0.12;

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(screen.x - bs * 0.55, screen.y - bs * 0.15, bs * 1.1, bs * 0.25);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(screen.x - bs * 0.48, screen.y - wallH, colW, wallH);
    ctx.fillRect(screen.x - bs * 0.2, screen.y - wallH, colW, wallH);
    ctx.fillRect(screen.x + bs * 0.08, screen.y - wallH, colW, wallH);
    ctx.fillRect(screen.x + bs * 0.36, screen.y - wallH, colW, wallH);

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.45);
    ctx.lineTo(screen.x - bs * 0.55, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.55, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - wallH - bs * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();

    const bGlow = Math.sin(now * 0.01) * 2;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - wallH * 0.35, bs * 0.18 + bGlow * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "market") {
    const stallH = bs * 0.7;

    ctx.fillStyle = "#92400e";
    ctx.fillRect(screen.x - bs * 0.45, screen.y - stallH * 0.5, bs * 0.9, stallH * 0.5);

    const cW = bs * 0.52;
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - stallH - bs * 0.3);
    ctx.lineTo(screen.x - cW, screen.y - stallH);
    ctx.lineTo(screen.x + cW, screen.y - stallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - stallH - bs * 0.3);
    ctx.lineTo(screen.x - cW * 0.3, screen.y - stallH);
    ctx.lineTo(screen.x + cW * 0.3, screen.y - stallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fef08a";
    ctx.fillRect(screen.x - bs * 0.35, screen.y - stallH * 0.5 - 4, 6, 5);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(screen.x + bs * 0.15, screen.y - stallH * 0.5 - 4, 6, 5);
  } else if (type === "barracks") {
    const wallH = bs * 0.85;
    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - bs * 0.5, screen.y - wallH, bs * 1.0, wallH);

    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.35);
    ctx.lineTo(screen.x - bs * 0.55, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.55, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(screen.x + bs * 0.32, screen.y - wallH * 0.45, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(screen.x + bs * 0.32, screen.y - wallH * 0.45, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "dock") {
    const deckH = bs * 0.35;

    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - bs * 0.5, screen.y - deckH, bs * 0.14, deckH + bs * 0.25);
    ctx.fillRect(screen.x - bs * 0.08, screen.y - deckH + bs * 0.08, bs * 0.14, deckH + bs * 0.25);
    ctx.fillRect(screen.x + bs * 0.36, screen.y - deckH, bs * 0.14, deckH + bs * 0.25);

    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.62, screen.y - deckH);
    ctx.lineTo(screen.x, screen.y + bs * 0.3 - deckH);
    ctx.lineTo(screen.x + bs * 0.62, screen.y - deckH);
    ctx.lineTo(screen.x, screen.y - bs * 0.3 - deckH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.38, screen.y - deckH);
    ctx.lineTo(screen.x + bs * 0.24, screen.y - deckH + bs * 0.14);
    ctx.moveTo(screen.x - bs * 0.24, screen.y - deckH - bs * 0.14);
    ctx.lineTo(screen.x + bs * 0.38, screen.y - deckH);
    ctx.stroke();

    ctx.fillStyle = "#78350f";
    ctx.fillRect(screen.x + bs * 0.32, screen.y - deckH - bs * 0.45, bs * 0.12, bs * 0.48);
    const lanternPulse = 0.75 + 0.25 * Math.sin(now * 0.008 + (b.id || 0));
    ctx.fillStyle = `rgba(251, 191, 36, ${lanternPulse})`;
    ctx.beginPath();
    ctx.arc(screen.x + bs * 0.38, screen.y - deckH - bs * 0.48, Math.max(2.2, bs * 0.14), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#713f12";
    ctx.fillRect(screen.x - bs * 0.32, screen.y - deckH - bs * 0.22, bs * 0.2, bs * 0.24);
    ctx.fillStyle = "#d97706";
    ctx.fillRect(screen.x - bs * 0.32, screen.y - deckH - bs * 0.14, bs * 0.2, bs * 0.05);
  } else if (type === "warehouse" || type === "stockpile") {
    const wallH = bs * 0.75;
    ctx.fillStyle = "#78350f";
    ctx.fillRect(screen.x - bs * 0.55, screen.y - wallH, bs * 1.1, wallH);

    ctx.fillStyle = "#ca8a04";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.4);
    ctx.lineTo(screen.x - bs * 0.6, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.6, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#292524";
    ctx.fillRect(screen.x - bs * 0.2, screen.y - wallH * 0.6, bs * 0.4, wallH * 0.65);
  } else if (type === "granary") {
    const siloH = bs * 0.95;
    ctx.fillStyle = "#d6d3d1";
    ctx.fillRect(screen.x - bs * 0.4, screen.y - siloH, bs * 0.8, siloH);
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - siloH, bs * 0.42, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#eab308";
    ctx.fillRect(screen.x - bs * 0.52, screen.y - bs * 0.22, bs * 0.2, bs * 0.22);
    ctx.fillRect(screen.x + bs * 0.3, screen.y - bs * 0.18, bs * 0.2, bs * 0.18);
  } else if (type === "factory") {
    const wallH = bs * 0.9;
    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(screen.x - bs * 0.62, screen.y - wallH, bs * 1.24, wallH);

    ctx.fillStyle = "#334155";
    for (let i = -1; i <= 0; i++) {
      const bx = screen.x + i * bs * 0.58;
      ctx.beginPath();
      ctx.moveTo(bx, screen.y - wallH);
      ctx.lineTo(bx + bs * 0.3, screen.y - wallH - bs * 0.32);
      ctx.lineTo(bx + bs * 0.58, screen.y - wallH);
      ctx.closePath();
      ctx.fill();
    }

    for (const sx of [-bs * 0.38, bs * 0.28]) {
      ctx.fillStyle = "#475569";
      ctx.fillRect(screen.x + sx, screen.y - wallH - bs * 0.72, bs * 0.18, bs * 0.72);
      const sm = ((now * 0.0025 + Math.abs(sx)) % 1);
      ctx.fillStyle = `rgba(148, 163, 184, ${(0.55 * (1 - sm)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(screen.x + sx + bs * 0.09 + sm * 5, screen.y - wallH - bs * 0.78 - sm * 14, 3 + sm * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#f97316";
    ctx.fillRect(screen.x - bs * 0.42, screen.y - wallH * 0.55, bs * 0.24, bs * 0.22);
    ctx.fillRect(screen.x + bs * 0.12, screen.y - wallH * 0.55, bs * 0.24, bs * 0.22);
  } else if (type === "research_lab") {
    const wallH = bs * 0.85;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(screen.x - bs * 0.55, screen.y - wallH, bs * 1.1, wallH);
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(screen.x - bs * 0.48, screen.y - wallH * 0.7, bs * 0.96, wallH * 0.32);
    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - bs * 0.6, screen.y - wallH - bs * 0.12, bs * 1.2, bs * 0.14);
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(screen.x + bs * 0.18, screen.y - wallH - bs * 0.22, bs * 0.22, Math.PI, 0);
    ctx.fill();
  } else if (type === "nuclear_plant") {
    const tH = bs * 1.15;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(screen.x - bs * 0.6, screen.y - bs * 0.65, bs * 0.56, bs * 0.65);
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.arc(screen.x - bs * 0.32, screen.y - bs * 0.65, bs * 0.28, Math.PI, 0);
    ctx.fill();
    const cPulse = 0.55 + 0.45 * Math.sin(now * 0.01 + (b.id || 0));
    ctx.fillStyle = `rgba(34, 211, 238, ${cPulse.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(screen.x - bs * 0.32, screen.y - bs * 0.36, bs * 0.14, 0, Math.PI * 2);
    ctx.fill();

    for (const txOff of [bs * 0.08, bs * 0.44]) {
      const cxTower = screen.x + txOff;
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(cxTower - bs * 0.2, screen.y);
      ctx.lineTo(cxTower - bs * 0.13, screen.y - tH);
      ctx.lineTo(cxTower + bs * 0.13, screen.y - tH);
      ctx.lineTo(cxTower + bs * 0.2, screen.y);
      ctx.closePath();
      ctx.fill();
      const st = ((now * 0.002 + txOff) % 1);
      ctx.fillStyle = `rgba(241, 245, 249, ${(0.55 * (1 - st)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cxTower, screen.y - tH - 3 - st * 14, 3 + st * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === "missile_silo") {
    const padH = bs * 0.36;
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, bs * 0.62, bs * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - padH * 0.3, bs * 0.42, bs * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(screen.x - bs * 0.11, screen.y - bs * 0.72, bs * 0.22, bs * 0.56);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - bs * 0.98);
    ctx.lineTo(screen.x - bs * 0.12, screen.y - bs * 0.72);
    ctx.lineTo(screen.x + bs * 0.12, screen.y - bs * 0.72);
    ctx.closePath();
    ctx.fill();
    const beaconOn = Math.sin(now * 0.012 + (b.id || 0)) > 0;
    ctx.fillStyle = beaconOn ? "#a3e635" : "#4d7c0f";
    ctx.beginPath();
    ctx.arc(screen.x + bs * 0.36, screen.y - padH * 0.35, Math.max(2, bs * 0.08), 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "windmill") {
    const millH = bs * 1.15;
    ctx.fillStyle = "#e7e5e4";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.34, screen.y);
    ctx.lineTo(screen.x - bs * 0.22, screen.y - millH);
    ctx.lineTo(screen.x + bs * 0.22, screen.y - millH);
    ctx.lineTo(screen.x + bs * 0.34, screen.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - millH - bs * 0.34);
    ctx.lineTo(screen.x - bs * 0.28, screen.y - millH);
    ctx.lineTo(screen.x + bs * 0.28, screen.y - millH);
    ctx.closePath();
    ctx.fill();

    const hubX = screen.x;
    const hubY = screen.y - millH * 0.78;
    const sailLen = bs * 0.72;
    const rot = (now * 0.0022 + (b.id || 0)) % (Math.PI * 2);
    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = Math.max(2, bs * 0.11);
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const ang = rot + (sIdx * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(hubX, hubY);
      ctx.lineTo(hubX + Math.cos(ang) * sailLen, hubY + Math.sin(ang) * sailLen);
      ctx.stroke();
    }
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.arc(hubX, hubY, Math.max(2, bs * 0.1), 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "inn") {
    const wallH = bs * 0.85;
    ctx.fillStyle = "#d97706";
    ctx.fillRect(screen.x - bs * 0.54, screen.y - wallH, bs * 1.08, wallH);
    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - bs * 0.54, screen.y - wallH, bs * 0.1, wallH);
    ctx.fillRect(screen.x + bs * 0.44, screen.y - wallH, bs * 0.1, wallH);
    ctx.fillRect(screen.x - bs * 0.54, screen.y - wallH * 0.52, bs * 1.08, bs * 0.09);

    ctx.fillStyle = "#7c2d12";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.42);
    ctx.lineTo(screen.x - bs * 0.62, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.62, screen.y - wallH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fde047";
    ctx.fillRect(screen.x - bs * 0.34, screen.y - wallH * 0.4, bs * 0.2, bs * 0.2);
    ctx.fillRect(screen.x + bs * 0.14, screen.y - wallH * 0.4, bs * 0.2, bs * 0.2);
    const glow = 0.7 + 0.3 * Math.sin(now * 0.007 + (b.id || 0));
    ctx.fillStyle = `rgba(251, 191, 36, ${glow.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(screen.x - bs * 0.58, screen.y - wallH * 0.55, Math.max(2, bs * 0.12), 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "library") {
    const wallH = bs * 0.92;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(screen.x - bs * 0.58, screen.y - wallH, bs * 1.16, wallH);
    ctx.fillStyle = "#f8fafc";
    for (const cxOff of [-bs * 0.44, -bs * 0.16, bs * 0.12, bs * 0.38]) {
      ctx.fillRect(screen.x + cxOff, screen.y - wallH * 0.88, bs * 0.1, wallH * 0.88);
    }
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.38);
    ctx.lineTo(screen.x - bs * 0.64, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.64, screen.y - wallH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - wallH - bs * 0.26, bs * 0.22, Math.PI, 0);
    ctx.fill();
  } else if (type === "apothecary") {
    const wallH = bs * 0.82;
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(screen.x - bs * 0.5, screen.y - wallH, bs * 1.0, wallH);
    ctx.fillStyle = "#059669";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.4);
    ctx.lineTo(screen.x - bs * 0.56, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.56, screen.y - wallH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(screen.x - bs * 0.06, screen.y - wallH * 0.72, bs * 0.12, bs * 0.36);
    ctx.fillRect(screen.x - bs * 0.18, screen.y - wallH * 0.6, bs * 0.36, bs * 0.12);
  } else if (type === "bank") {
    const wallH = bs * 0.95;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(screen.x - bs * 0.58, screen.y - wallH, bs * 1.16, wallH);
    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - bs * 0.18, screen.y - wallH * 0.55, bs * 0.36, wallH * 0.55);
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.42);
    ctx.lineTo(screen.x - bs * 0.64, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.64, screen.y - wallH);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - wallH - bs * 0.14, Math.max(2.2, bs * 0.13), 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "radar_station") {
    const tH = bs * 1.05;
    ctx.fillStyle = "#334155";
    ctx.fillRect(screen.x - bs * 0.42, screen.y - bs * 0.35, bs * 0.84, bs * 0.35);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = Math.max(1.5, bs * 0.1);
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.24, screen.y - bs * 0.35);
    ctx.lineTo(screen.x, screen.y - tH);
    ctx.lineTo(screen.x + bs * 0.24, screen.y - bs * 0.35);
    ctx.stroke();

    const sweep = Math.sin(now * 0.004 + (b.id || 0)) * (bs * 0.18);
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.ellipse(screen.x + sweep * 0.25, screen.y - tH - bs * 0.12, bs * 0.34, bs * 0.18, -0.35 + sweep * 0.03, 0, Math.PI * 2);
    ctx.fill();
    const ping = ((now * 0.002 + (b.id || 0) * 0.2) % 1);
    ctx.strokeStyle = `rgba(56, 189, 248, ${(0.65 * (1 - ping)).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - tH - bs * 0.12, bs * (0.25 + ping * 0.8), 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "monument_cairn") {
    const radW = bs * 0.78;
    ctx.fillStyle = "#57534e";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - bs * 0.05, radW, radW * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8a29e";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const pillars = [-0.46, -0.22, 0.22, 0.46];
    for (const px of pillars) {
      const pH = Math.abs(px) < 0.3 ? bs * 0.72 : bs * 0.56;
      const pY = screen.y - Math.abs(px) * bs * 0.25;
      ctx.fillStyle = "#44403c";
      ctx.fillRect(screen.x + bs * px - bs * 0.07, pY - pH, bs * 0.14, pH);
      ctx.fillStyle = "#78716c";
      ctx.fillRect(screen.x + bs * px - bs * 0.05, pY - pH, bs * 0.06, pH);
    }
    ctx.fillStyle = "#a8a29e";
    ctx.fillRect(screen.x - bs * 0.52, screen.y - bs * 0.78, bs * 0.36, bs * 0.12);
    ctx.fillRect(screen.x + bs * 0.16, screen.y - bs * 0.78, bs * 0.36, bs * 0.12);

    const hearthGlow = 0.65 + 0.35 * Math.sin(now * 0.01 + (b.id || 0));
    ctx.fillStyle = `rgba(249, 115, 22, ${hearthGlow})`;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - bs * 0.18, bs * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - bs * 0.22, bs * 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "monument_pyramid") {
    const pW = bs * 1.5;
    const t1H = bs * 0.4;
    const t2H = bs * 0.35;
    const t3H = bs * 0.3;

    ctx.fillStyle = "#92400e";
    ctx.fillRect(screen.x - pW * 0.5, screen.y - t1H, pW, t1H);
    ctx.fillStyle = "#b45309";
    ctx.fillRect(screen.x - pW * 0.48, screen.y - t1H, pW * 0.96, t1H * 0.4);

    const t2W = pW * 0.72;
    const t2Y = screen.y - t1H;
    ctx.fillStyle = "#d97706";
    ctx.fillRect(screen.x - t2W * 0.5, t2Y - t2H, t2W, t2H);

    const t3W = pW * 0.45;
    const t3Y = t2Y - t2H;
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(screen.x - t3W * 0.5, t3Y - t3H, t3W, t3H);

    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.moveTo(screen.x - bs * 0.12, t3Y - t3H);
    ctx.lineTo(screen.x + bs * 0.12, t3Y - t3H);
    ctx.lineTo(screen.x + bs * 0.22, screen.y);
    ctx.lineTo(screen.x - bs * 0.22, screen.y);
    ctx.closePath();
    ctx.fill();

    const apexY = t3Y - t3H;
    const glow = Math.sin(now * 0.008) * 3;
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(screen.x, apexY - bs * 0.35);
    ctx.lineTo(screen.x - bs * 0.2, apexY);
    ctx.lineTo(screen.x + bs * 0.2, apexY);
    ctx.closePath();
    ctx.fill();

    const sunGrad = ctx.createRadialGradient(screen.x, apexY - bs * 0.2, 2, screen.x, apexY - bs * 0.2, bs * 0.7 + glow);
    sunGrad.addColorStop(0, "rgba(253, 224, 71, 0.7)");
    sunGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.3)");
    sunGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(screen.x, apexY - bs * 0.2, bs * 0.7 + glow, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "monument_colosseum") {
    const cW = bs * 1.5;
    const cH = bs * 0.95;

    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(screen.x - cW * 0.5, screen.y - cH, cW, cH);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(screen.x - cW * 0.53, screen.y - cH, cW * 1.06, bs * 0.12);

    const archCount = 5;
    const archSpacing = cW / (archCount + 1);
    ctx.fillStyle = "#1e293b";
    for (let i = 1; i <= archCount; i++) {
      const ax = screen.x - cW * 0.5 + i * archSpacing;
      ctx.beginPath();
      ctx.arc(ax, screen.y - cH * 0.45, bs * 0.09, Math.PI, 0);
      ctx.lineTo(ax + bs * 0.09, screen.y - cH * 0.1);
      ctx.lineTo(ax - bs * 0.09, screen.y - cH * 0.1);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - cH * 0.1, bs * 0.38, bs * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    const wave = Math.sin(now * 0.007) * 4;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x - cW * 0.42, screen.y - cH);
    ctx.lineTo(screen.x - cW * 0.42, screen.y - cH - bs * 0.45);
    ctx.moveTo(screen.x + cW * 0.42, screen.y - cH);
    ctx.lineTo(screen.x + cW * 0.42, screen.y - cH - bs * 0.45);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(screen.x - cW * 0.42, screen.y - cH - bs * 0.45);
    ctx.lineTo(screen.x - cW * 0.42 + bs * 0.28 + wave, screen.y - cH - bs * 0.35);
    ctx.lineTo(screen.x - cW * 0.42, screen.y - cH - bs * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (type === "monument_monolith") {
    const oW = bs * 0.55;
    const oH = bs * 1.8;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(screen.x - bs * 0.5, screen.y - bs * 0.2, bs * 1.0, bs * 0.2);
    ctx.fillStyle = "#334155";
    ctx.fillRect(screen.x - bs * 0.38, screen.y - bs * 0.32, bs * 0.76, bs * 0.12);

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(screen.x - oW * 0.5, screen.y - bs * 0.32);
    ctx.lineTo(screen.x - oW * 0.25, screen.y - oH);
    ctx.lineTo(screen.x + oW * 0.25, screen.y - oH);
    ctx.lineTo(screen.x + oW * 0.5, screen.y - bs * 0.32);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - bs * 0.32);
    ctx.lineTo(screen.x, screen.y - oH);
    ctx.stroke();

    const runePulse = 0.5 + 0.5 * Math.sin(now * 0.009);
    ctx.fillStyle = `rgba(56, 189, 248, ${0.4 + 0.5 * runePulse})`;
    for (let rY = screen.y - bs * 0.5; rY > screen.y - oH + bs * 0.2; rY -= bs * 0.25) {
      ctx.fillRect(screen.x - 2, rY, 4, bs * 0.12);
    }

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(screen.x - oW * 0.25, screen.y - oH);
    ctx.lineTo(screen.x, screen.y - oH - bs * 0.3);
    ctx.lineTo(screen.x + oW * 0.25, screen.y - oH);
    ctx.closePath();
    ctx.fill();

    const orbPulse = Math.sin(now * 0.008) * 3;
    const orbGrad = ctx.createRadialGradient(
      screen.x, screen.y - oH - bs * 0.45 + orbPulse, 2,
      screen.x, screen.y - oH - bs * 0.45 + orbPulse, bs * 0.4
    );
    orbGrad.addColorStop(0, "#ffffff");
    orbGrad.addColorStop(0.3, "#38bdf8");
    orbGrad.addColorStop(0.8, "rgba(56, 189, 248, 0.4)");
    orbGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - oH - bs * 0.45 + orbPulse, bs * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "monument_citadel") {
    const cW = bs * 1.48;
    const cH = bs * 0.92;
    ctx.fillStyle = "#64748b";
    ctx.fillRect(screen.x - cW * 0.5, screen.y - cH, cW, cH);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(screen.x - cW * 0.38, screen.y - cH * 1.32, cW * 0.76, cH * 0.34);
    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - cW * 0.52, screen.y - cH * 1.18, bs * 0.22, cH * 1.18);
    ctx.fillRect(screen.x + cW * 0.52 - bs * 0.22, screen.y - cH * 1.18, bs * 0.22, cH * 1.18);
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - cH * 1.32, bs * 0.36, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(screen.x - 1.5, screen.y - cH * 1.32 - bs * 0.52, 3, bs * 0.2);
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - bs * 0.28, bs * 0.16, Math.PI, 0);
    ctx.lineTo(screen.x + bs * 0.16, screen.y);
    ctx.lineTo(screen.x - bs * 0.16, screen.y);
    ctx.closePath();
    ctx.fill();
  } else if (type === "monument_foundry") {
    const fW = bs * 1.46;
    const fH = bs * 0.88;
    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(screen.x - fW * 0.5, screen.y - fH, fW, fH);
    ctx.fillStyle = "#475569";
    ctx.fillRect(screen.x - fW * 0.52, screen.y - fH - bs * 0.14, fW * 1.04, bs * 0.16);
    ctx.fillStyle = "#334155";
    ctx.fillRect(screen.x - bs * 0.2, screen.y - fH - bs * 0.72, bs * 0.4, bs * 0.72);
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - fH - bs * 0.44, bs * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(screen.x - fW * 0.4, screen.y - fH - bs * 0.58, bs * 0.14, bs * 0.58);
    ctx.fillRect(screen.x + fW * 0.4 - bs * 0.14, screen.y - fH - bs * 0.58, bs * 0.14, bs * 0.58);
    const steamP = ((now * 0.002 + (b.id || 0) * 0.3) % 1);
    ctx.fillStyle = `rgba(226, 232, 240, ${(0.5 * (1 - steamP)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(screen.x - fW * 0.33, screen.y - fH - bs * 0.62 - steamP * 14, 3 + steamP * 5, 0, Math.PI * 2);
    ctx.arc(screen.x + fW * 0.33, screen.y - fH - bs * 0.62 - steamP * 14, 3 + steamP * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f97316";
    ctx.fillRect(screen.x - bs * 0.22, screen.y - bs * 0.34, bs * 0.44, bs * 0.34);
  } else if (type === "monument_atomic_dome") {
    const dW = bs * 1.5;
    const dH = bs * 0.56;
    ctx.fillStyle = "#334155";
    ctx.fillRect(screen.x - dW * 0.5, screen.y - dH, dW, dH);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(screen.x - dW * 0.46, screen.y - bs * 0.95, bs * 0.24, bs * 0.95);
    ctx.fillRect(screen.x + dW * 0.46 - bs * 0.24, screen.y - bs * 0.95, bs * 0.24, bs * 0.95);
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - dH, bs * 0.46, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - dH - bs * 0.46);
    ctx.lineTo(screen.x, screen.y - dH - bs * 0.95);
    ctx.stroke();
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.01);
    ctx.fillStyle = `rgba(132, 204, 22, ${pulse})`;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - dH - bs * 0.98, bs * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const wallH = bs * 0.8;
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(screen.x - bs * 0.4, screen.y - wallH, bs * 0.8, wallH);
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - wallH - bs * 0.35);
    ctx.lineTo(screen.x - bs * 0.45, screen.y - wallH);
    ctx.lineTo(screen.x + bs * 0.45, screen.y - wallH);
    ctx.closePath();
    ctx.fill();
  }

  if (b.constructionProgress !== undefined && b.constructionProgress < 100) {
    const p = b.constructionProgress / 100;
    const barW = bs * 1.1;
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(screen.x - barW / 2, screen.y - bs * 1.5, barW, 4);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(screen.x - barW / 2, screen.y - bs * 1.5, barW * p, 4);
  } else if (isMonument && zoom >= 8) {
    const eraTag = `E${b.builtInEra || 1}`;
    const lvl = b.level || 1;
    const badgeLabel = lvl >= 3 ? `${eraTag} III` : lvl === 2 ? `${eraTag} II` : `${eraTag} ★`;
    const badgeY = screen.y - bs * 1.48;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(screen.x - 14, badgeY - 7, 28, 12);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(screen.x - 14, badgeY - 7, 28, 12);
    ctx.fillStyle = "#fde047";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeLabel, screen.x, badgeY - 1);
  } else if ((b.level || 1) >= 2 && zoom >= 9) {
    const lvl = b.level || 1;
    const badgeColor = lvl >= 3 ? "#fbbf24" : "#38bdf8";
    const label = lvl >= 3 ? "III" : "II";
    const badgeY = screen.y - bs * 1.28;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(screen.x - 10, badgeY - 7, 20, 11);
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(screen.x - 10, badgeY - 7, 20, 11);
    ctx.fillStyle = badgeColor;
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, screen.x, badgeY - 1);
  }

  ctx.restore();
}

/**
 * 2.5D Communal Settlement Center / Town Square / Hearth.
 */
export function render25DSettlementCenter(r, s, screen, elev) {
  if (!s) return;
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const now = r._frameNow;
  const rad = Math.max(8, zoom * 1.3);

  ctx.save();

  ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + rad * 0.1, rad * 1.4, rad * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const fireRadius = rad * 0.35;
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, fireRadius * 1.2, fireRadius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, fireRadius * 0.85, fireRadius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  const glowGrad = ctx.createRadialGradient(screen.x, screen.y, 2, screen.x, screen.y, rad * 1.8);
  glowGrad.addColorStop(0, "rgba(251, 146, 60, 0.42)");
  glowGrad.addColorStop(0.5, "rgba(234, 88, 12, 0.18)");
  glowGrad.addColorStop(1, "rgba(234, 88, 12, 0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, rad * 1.8, 0, Math.PI * 2);
  ctx.fill();

  const flicker1 = Math.sin(now * 0.012 + (s.id || 0)) * (fireRadius * 0.15);
  const flicker2 = Math.cos(now * 0.016 + (s.id || 0)) * (fireRadius * 0.12);
  const fireH = fireRadius * 1.4;

  ctx.fillStyle = "#ea580c";
  ctx.beginPath();
  ctx.moveTo(screen.x - fireRadius * 0.6, screen.y);
  ctx.quadraticCurveTo(screen.x - fireRadius * 0.4, screen.y - fireH * 0.6, screen.x + flicker1, screen.y - fireH - flicker2);
  ctx.quadraticCurveTo(screen.x + fireRadius * 0.4, screen.y - fireH * 0.6, screen.x + fireRadius * 0.6, screen.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.moveTo(screen.x - fireRadius * 0.35, screen.y);
  ctx.quadraticCurveTo(screen.x - fireRadius * 0.2, screen.y - fireH * 0.4, screen.x - flicker2, screen.y - fireH * 0.75);
  ctx.quadraticCurveTo(screen.x + fireRadius * 0.2, screen.y - fireH * 0.4, screen.x + fireRadius * 0.35, screen.y);
  ctx.closePath();
  ctx.fill();

  const sparkOffset = (now * 0.002 + (s.id || 0)) % 1;
  ctx.fillStyle = `rgba(254, 215, 170, ${0.8 * (1 - sparkOffset)})`;
  ctx.beginPath();
  ctx.arc(screen.x + Math.sin(sparkOffset * 6) * 4, screen.y - fireH - sparkOffset * 18, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#78350f";
  ctx.fillRect(screen.x - rad * 0.95, screen.y - rad * 0.18, rad * 0.28, rad * 0.16);
  ctx.fillRect(screen.x + rad * 0.68, screen.y - rad * 0.18, rad * 0.28, rad * 0.16);

  const poleH = rad * 1.5;
  ctx.strokeStyle = "#451a03";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(screen.x - rad * 0.7, screen.y + rad * 0.2);
  ctx.lineTo(screen.x - rad * 0.7, screen.y - poleH);
  ctx.stroke();

  const bWave = Math.sin(now * 0.005 + (s.id || 0)) * 2;
  ctx.fillStyle = s.factionColor || "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(screen.x - rad * 0.7, screen.y - poleH);
  ctx.lineTo(screen.x - rad * 0.7 + rad * 0.5 + bWave, screen.y - poleH + rad * 0.15);
  ctx.lineTo(screen.x - rad * 0.7, screen.y - poleH + rad * 0.35);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
