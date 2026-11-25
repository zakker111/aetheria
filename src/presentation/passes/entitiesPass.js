// 2.5D Moving Entities Pass: Wildlife, Naval Vessels, Agents, Tanks, Aircraft & Thought Bubbles.

/**
 * 2.5D Wildlife Graphics: Stags, Boars, and Wolves.
 */
export function render25DAnimal(r, a, screen, elev) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const s = Math.max(2, zoom * 0.42);

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 1, s * 0.8, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  const aFromX = a._fromX ?? a.x;
  const aFromY = a._fromY ?? a.y;
  const aMoveX = a.x - aFromX;
  const aMoveY = a.y - aFromY;
  const aMoveSq = aMoveX * aMoveX + aMoveY * aMoveY;
  const now = r._frameNow;

  if (aMoveSq > 0.0001) {
    a._movingHoldUntil = now + 140;
    const screenDx = aMoveX - aMoveY;
    if (Math.abs(screenDx) > 0.002) {
      a._facing = screenDx < 0 ? -1 : 1;
    }
  }
  const isAnimalMoving = r._simSpeed > 0 && now < (a._movingHoldUntil || 0);
  if (r._simSpeed > 0) {
    const rate = isAnimalMoving ? 9.5 * Math.min(2.2, Math.max(0.85, r._simSpeed)) : 2.0;
    a._animCycle = (a._animCycle || 0) + r._frameDtSec * rate;
  }
  const hop = isAnimalMoving ? Math.abs(Math.sin(a._animCycle || 0)) * -2.2 : Math.sin(a._animCycle || 0) * 0.5;

  if ((a._facing || 1) === -1) {
    ctx.translate(screen.x, screen.y);
    ctx.scale(-1, 1);
    ctx.translate(-screen.x, -screen.y);
  }

  if (a.species === "deer") {
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - s * 0.6 + hop, s * 0.85, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(screen.x + s * 0.6, screen.y - s * 1.1 + hop, s * 0.35, s * 0.45, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(screen.x + s * 0.6, screen.y - s * 1.3 + hop);
    ctx.lineTo(screen.x + s * 0.4, screen.y - s * 1.7 + hop);
    ctx.moveTo(screen.x + s * 0.7, screen.y - s * 1.3 + hop);
    ctx.lineTo(screen.x + s * 0.9, screen.y - s * 1.7 + hop);
    ctx.stroke();
  } else if (a.species === "boar") {
    ctx.fillStyle = "#57534e";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - s * 0.5 + hop, s * 0.9, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(screen.x + s * 0.7, screen.y - s * 0.6 + hop, 2, 3);
  } else {
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - s * 0.55 + hop, s * 0.9, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(screen.x + s * 0.75, screen.y - s * 0.6 + hop, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(screen.x + s * 0.8, screen.y - s * 0.75 + hop, 2, 2);
  }

  ctx.restore();
}

/**
 * 2.5D Naval Vessels: Fishing Boats, River Barges, and Amphibious Raid Longboats.
 */
export function render25DVessel(r, v, screen, elev) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const now = r._frameNow;
  const s = Math.max(4, zoom * 0.56);
  const bob = Math.sin(now * 0.006 + (v.id || 0) * 1.7) * 1.6;
  const facing = v.facing || 1;

  ctx.save();

  const wakePulse = 0.28 + 0.14 * Math.sin(now * 0.008 + (v.id || 0));
  ctx.strokeStyle = `rgba(186, 230, 253, ${wakePulse})`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 1, s * 1.15, s * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();

  if (facing === -1) {
    ctx.translate(screen.x, screen.y);
    ctx.scale(-1, 1);
    ctx.translate(-screen.x, -screen.y);
  }

  if (v.kind === "raid") {
    const vy = screen.y - s * 0.25 + bob;
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 1.1, vy - s * 0.1);
    ctx.lineTo(screen.x - s * 0.85, vy + s * 0.35);
    ctx.lineTo(screen.x + s * 0.85, vy + s * 0.35);
    ctx.lineTo(screen.x + s * 1.15, vy - s * 0.15);
    ctx.lineTo(screen.x + s * 0.95, vy - s * 0.35);
    ctx.lineTo(screen.x + s * 0.72, vy);
    ctx.lineTo(screen.x - s * 0.75, vy);
    ctx.closePath();
    ctx.fill();

    const shieldColors = ["#dc2626", "#f59e0b", "#cbd5e1", "#dc2626"];
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = shieldColors[k];
      ctx.beginPath();
      ctx.arc(screen.x - s * 0.55 + k * s * 0.36, vy + s * 0.08, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x, vy);
    ctx.lineTo(screen.x, vy - s * 1.45);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(screen.x, vy - s * 1.38);
    ctx.quadraticCurveTo(screen.x + s * 0.72, vy - s * 0.95, screen.x + s * 0.52, vy - s * 0.42);
    ctx.lineTo(screen.x, vy - s * 0.48);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fef2f2";
    ctx.fillRect(screen.x + s * 0.1, vy - s * 1.15, s * 0.18, s * 0.52);
  } else if (v.kind === "barge") {
    const vy = screen.y - s * 0.22 + bob;
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 1.0, vy - s * 0.1);
    ctx.lineTo(screen.x - s * 0.78, vy + s * 0.34);
    ctx.lineTo(screen.x + s * 0.78, vy + s * 0.34);
    ctx.lineTo(screen.x + s * 1.0, vy - s * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#d97706";
    ctx.fillRect(screen.x - s * 0.52, vy - s * 0.38, s * 0.42, s * 0.32);
    ctx.fillStyle = "#eab308";
    ctx.fillRect(screen.x + s * 0.02, vy - s * 0.32, s * 0.38, s * 0.26);

    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.05, vy - s * 0.1);
    ctx.lineTo(screen.x - s * 0.05, vy - s * 1.25);
    ctx.stroke();

    ctx.fillStyle = v.bannerColor || "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.05, vy - s * 1.22);
    ctx.lineTo(screen.x + s * 0.58, vy - s * 0.92);
    ctx.lineTo(screen.x - s * 0.05, vy - s * 0.58);
    ctx.closePath();
    ctx.fill();
  } else {
    const vy = screen.y - s * 0.2 + bob;
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.75, vy - s * 0.08);
    ctx.lineTo(screen.x - s * 0.52, vy + s * 0.26);
    ctx.lineTo(screen.x + s * 0.52, vy + s * 0.26);
    ctx.lineTo(screen.x + s * 0.78, vy - s * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#5c2c16";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(screen.x, vy);
    ctx.lineTo(screen.x, vy - s * 1.15);
    ctx.stroke();

    ctx.fillStyle = v.cargo?.amount > 0 ? "#fef08a" : "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(screen.x, vy - s * 1.12);
    ctx.lineTo(screen.x + s * 0.55, vy - s * 0.32);
    ctx.lineTo(screen.x, vy - s * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function drawThoughtIcon(r, x, y, icon, facing = 1) {
  const floatBob = Math.sin(r._frameNow * 0.005 + x) * 2.2;
  const ctx = r.ctx;
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (facing === -1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.fillText(icon, 0, floatBob);
    ctx.restore();
  } else {
    ctx.fillText(icon, x, y + floatBob);
  }
}

/**
 * 2.5D Humanoid Character, Tank & Strike Aircraft Graphics.
 */
export function render25DAgent(r, agent, screen, elev) {
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const now = r._frameNow;
  const s = Math.max(3, zoom * 0.48);

  ctx.save();

  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 1, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (r.selectedEntity && (r.selectedEntity.id === agent.id || r.selectedEntity.entity?.id === agent.id)) {
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - s * 0.9, s * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  const fromX = agent._fromX ?? agent.x;
  const fromY = agent._fromY ?? agent.y;
  const stepDx = agent.x - fromX;
  const stepDy = agent.y - fromY;
  const stepSq = stepDx * stepDx + stepDy * stepDy;
  const hasPath = Boolean(agent.path && agent.path.length > 0);
  const actType = typeof agent.currentAction === "string" ? agent.currentAction : agent.currentAction?.type;

  if (stepSq > 0.0001) {
    agent._movingHoldUntil = now + 150;
    const screenDx = stepDx - stepDy;
    if (Math.abs(screenDx) > 0.002) {
      agent._facing = screenDx < 0 ? -1 : 1;
    }
  } else if (hasPath) {
    agent._movingHoldUntil = now + 100;
  }

  const isMoving = r._simSpeed > 0 && (now < (agent._movingHoldUntil || 0) || hasPath);

  if (isMoving) {
    const walkRate = 9.5 * Math.min(2.4, Math.max(0.85, r._simSpeed || 1));
    agent._walkCycle = (agent._walkCycle || 0) + r._frameDtSec * walkRate;
  } else if (r._simSpeed > 0 && agent._walkCycle) {
    const mod = agent._walkCycle % (Math.PI * 2);
    if (mod > 0.18 && mod < Math.PI * 2 - 0.18) {
      agent._walkCycle += r._frameDtSec * 10;
    } else {
      agent._walkCycle = 0;
    }
  }

  const walk = Math.sin(agent._walkCycle || 0);
  const isWounded = Boolean(agent.wounded);
  const limpBob = isWounded ? Math.sin(now * 0.01 + (agent.id || 0)) * 2.2 : 0;
  const headBob = (isMoving ? Math.abs(walk) * -1.8 : 0) + limpBob;

  const facing = agent._facing || 1;
  const combatRole = agent.combatRole || agent.combat?.weaponType;
  const isFlying = combatRole === "plane" || Boolean(agent.combat?.isFlying);

  if (combatRole === "tank") {
    const ts = Math.max(5, s * 1.45);
    const bob = isMoving ? Math.sin(now * 0.03 + (agent.id || 0)) * 0.8 : 0;
    ctx.save();
    if (facing === -1) {
      ctx.translate(screen.x, screen.y);
      ctx.scale(-1, 1);
      ctx.translate(-screen.x, -screen.y);
    }

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(screen.x - ts * 0.85, screen.y - ts * 0.42 + bob, ts * 1.7, ts * 0.44, ts * 0.16);
    ctx.fill();
    ctx.fillStyle = "#475569";
    for (let w = -2; w <= 2; w++) {
      ctx.beginPath();
      ctx.arc(screen.x + w * ts * 0.3, screen.y - ts * 0.18 + bob, ts * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = agent.visuals?.flashRed > 0 ? "#f87171" : "#3f6212";
    if (agent.visuals?.flashRed > 0) agent.visuals.flashRed--;
    ctx.beginPath();
    ctx.moveTo(screen.x - ts * 0.78, screen.y - ts * 0.38 + bob);
    ctx.lineTo(screen.x - ts * 0.62, screen.y - ts * 0.78 + bob);
    ctx.lineTo(screen.x + ts * 0.72, screen.y - ts * 0.74 + bob);
    ctx.lineTo(screen.x + ts * 0.82, screen.y - ts * 0.38 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = agent.factionColor || "#dc2626";
    ctx.fillRect(screen.x - ts * 0.5, screen.y - ts * 0.62 + bob, ts * 0.9, ts * 0.12);

    ctx.fillStyle = "#4d7c0f";
    ctx.beginPath();
    ctx.roundRect(screen.x - ts * 0.36, screen.y - ts * 1.12 + bob, ts * 0.72, ts * 0.38, 3);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(screen.x + ts * 0.28, screen.y - ts * 0.97 + bob, ts * 0.92, Math.max(2.2, ts * 0.13));

    ctx.restore();

    const curHealth = agent.combat?.health ?? agent.health ?? 220;
    const maxHealth = agent.combat?.maxHealth ?? agent.maxHealth ?? 220;
    const barW = Math.max(16, ts * 1.4);
    const hpRatio = Math.max(0, Math.min(1, curHealth / maxHealth));
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(screen.x - barW / 2 - 1, screen.y - ts * 1.45 - 1, barW + 2, 4.5);
    ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(screen.x - barW / 2, screen.y - ts * 1.45, barW * hpRatio, 2.5);
    ctx.restore();
    return;
  }

  if (isFlying) {
    const ps = Math.max(5.5, s * 1.4);
    const airLift = Math.max(22, zoom * 2.15) + Math.sin(now * 0.008 + (agent.id || 0)) * 2.5;
    const airY = screen.y - airLift;

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(screen.x + ps * 0.2, screen.y + 2, ps * 0.85, ps * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (facing === -1) {
      ctx.translate(screen.x, airY);
      ctx.scale(-1, 1);
      ctx.translate(-screen.x, -airY);
    }

    const flame = 0.7 + 0.3 * Math.sin(now * 0.04 + (agent.id || 0));
    ctx.fillStyle = `rgba(249, 115, 22, ${(0.8 * flame).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(screen.x - ps * 0.75, airY - ps * 0.08);
    ctx.lineTo(screen.x - ps * (1.2 + flame * 0.35), airY);
    ctx.lineTo(screen.x - ps * 0.75, airY + ps * 0.08);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = agent.visuals?.flashRed > 0 ? "#f87171" : "#64748b";
    if (agent.visuals?.flashRed > 0) agent.visuals.flashRed--;
    ctx.beginPath();
    ctx.moveTo(screen.x + ps * 0.15, airY);
    ctx.lineTo(screen.x - ps * 0.55, airY - ps * 0.72);
    ctx.lineTo(screen.x - ps * 0.78, airY - ps * 0.62);
    ctx.lineTo(screen.x - ps * 0.35, airY);
    ctx.lineTo(screen.x - ps * 0.78, airY + ps * 0.62);
    ctx.lineTo(screen.x - ps * 0.55, airY + ps * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(screen.x + ps * 1.0, airY);
    ctx.lineTo(screen.x - ps * 0.78, airY - ps * 0.18);
    ctx.lineTo(screen.x - ps * 0.85, airY);
    ctx.lineTo(screen.x - ps * 0.78, airY + ps * 0.18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.ellipse(screen.x + ps * 0.38, airY, ps * 0.24, ps * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = agent.factionColor || "#dc2626";
    ctx.beginPath();
    ctx.arc(screen.x - ps * 0.45, airY - ps * 0.42, ps * 0.1, 0, Math.PI * 2);
    ctx.arc(screen.x - ps * 0.45, airY + ps * 0.42, ps * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const curHealth = agent.combat?.health ?? agent.health ?? 145;
    const maxHealth = agent.combat?.maxHealth ?? agent.maxHealth ?? 145;
    const barW = Math.max(15, ps * 1.3);
    const hpRatio = Math.max(0, Math.min(1, curHealth / maxHealth));
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(screen.x - barW / 2 - 1, airY - ps * 0.9 - 1, barW + 2, 4.5);
    ctx.fillStyle = hpRatio > 0.5 ? "#38bdf8" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(screen.x - barW / 2, airY - ps * 0.9, barW * hpRatio, 2.5);
    ctx.restore();
    return;
  }

  if (facing === -1) {
    ctx.translate(screen.x, screen.y);
    ctx.scale(-1, 1);
    ctx.translate(-screen.x, -screen.y);
  }

  if (!agent.embarked) {
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = Math.max(1.5, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.25, screen.y - s * 0.5);
    ctx.lineTo(screen.x - s * 0.25 + (isWounded ? walk * 1.5 : walk * 3), screen.y);
    ctx.moveTo(screen.x + s * 0.25, screen.y - s * 0.5);
    ctx.lineTo(screen.x + s * 0.25 - (isWounded ? walk * 0.5 : walk * 3), screen.y);
    ctx.stroke();
  }

  let tunicColor = "#fbbf24";
  if (agent.isExternalRaider) tunicColor = "#7f1d1d";
  else if (agent.militaryDuty || agent.job === "soldier") tunicColor = "#dc2626";
  else if (agent.role === "priest" || agent.job === "priest") tunicColor = "#f59e0b";
  else if (agent.role === "builder" || agent.job === "builder") tunicColor = "#b45309";
  else if (agent.role === "lumberjack" || agent.job === "lumberjack") tunicColor = "#15803d";
  else if (agent.role === "hunter" || agent.job === "hunter") tunicColor = "#047857";
  else if (agent.role === "miner" || agent.job === "miner") tunicColor = "#475569";
  else if (agent.role === "farmer" || agent.job === "farmer") tunicColor = "#84cc16";

  if (agent.visuals && agent.visuals.flashRed > 0) {
    agent.visuals.flashRed--;
    tunicColor = "#f87171";
  }

  ctx.fillStyle = tunicColor;
  ctx.beginPath();
  ctx.roundRect(screen.x - s * 0.35, screen.y - s * 1.25 + headBob, s * 0.7, s * 0.75, 3);
  ctx.fill();

  ctx.fillStyle = "#451a03";
  ctx.fillRect(screen.x - s * 0.35, screen.y - s * 0.75 + headBob, s * 0.7, 2);

  if (isWounded) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(screen.x + s * 0.1, screen.y - s * 1.05 + headBob, 4.5, 3.5);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(screen.x + s * 0.1 + 1.5, screen.y - s * 1.05, 1.5, 3.5);
    ctx.fillRect(screen.x + s * 0.1, screen.y - s * 1.05 + 1, 4.5, 1.5);
  }

  ctx.fillStyle = "#fed7aa";
  ctx.beginPath();
  ctx.arc(screen.x, screen.y - s * 1.5 + headBob, s * 0.32, 0, Math.PI * 2);
  ctx.fill();

  if (agent.isMonarch) {
    ctx.fillStyle = "#f59e0b";
    const cy = screen.y - s * 1.82 + headBob;
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.3, cy + 2);
    ctx.lineTo(screen.x - s * 0.25, cy - 4);
    ctx.lineTo(screen.x - s * 0.08, cy);
    ctx.lineTo(screen.x, cy - 5);
    ctx.lineTo(screen.x + s * 0.08, cy);
    ctx.lineTo(screen.x + s * 0.25, cy - 4);
    ctx.lineTo(screen.x + s * 0.3, cy + 2);
    ctx.closePath();
    ctx.fill();
  } else if (agent.militaryDuty || agent.job === "soldier") {
    const wt = agent.combat?.weaponType;
    const isModern = wt === "rifle" || wt === "artillery" || wt === "musket" || wt === "cannon";
    ctx.fillStyle = agent.isExternalRaider ? "#1e293b" : (wt === "rifle" || wt === "artillery" ? "#334155" : "#94a3b8");
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - s * 1.62 + headBob, s * 0.36, Math.PI, 0);
    ctx.fill();
    if (agent.isExternalRaider) {
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.32, screen.y - s * 1.68 + headBob);
      ctx.lineTo(screen.x - s * 0.45, screen.y - s * 2.02 + headBob);
      ctx.lineTo(screen.x - s * 0.16, screen.y - s * 1.80 + headBob);
      ctx.moveTo(screen.x + s * 0.32, screen.y - s * 1.68 + headBob);
      ctx.lineTo(screen.x + s * 0.45, screen.y - s * 2.02 + headBob);
      ctx.lineTo(screen.x + s * 0.16, screen.y - s * 1.80 + headBob);
      ctx.fill();
    } else if (!isModern) {
      ctx.fillStyle = agent.isRebel ? "#f59e0b" : "#ef4444";
      ctx.fillRect(screen.x - 1, screen.y - s * 2.05 + headBob, 3, 5);
    }
  } else if (agent.job === "farmer") {
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - s * 1.7 + headBob, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const curHealth = agent.combat?.health ?? agent.health ?? 100;
  const maxHealth = agent.combat?.maxHealth ?? agent.maxHealth ?? 100;
  if (curHealth < maxHealth || agent.militaryDuty) {
    const barW = Math.max(12, s * 1.3);
    const barH = 2.5;
    const hpRatio = Math.max(0, Math.min(1, curHealth / maxHealth));
    const barX = screen.x - barW / 2;
    const barY = screen.y - s * 2.15 + headBob;
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }

  if (actType === "chop_wood") {
    const swing = Math.sin(now * 0.016 + agent.id);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x + s * 0.35, screen.y - s * 0.8);
    ctx.lineTo(screen.x + s * 0.8 + swing * 4, screen.y - s * 1.4);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(screen.x + s * 0.75 + swing * 4, screen.y - s * 1.5, 4, 3);
  } else if (actType === "mine_ore") {
    const swing = Math.sin(now * 0.018 + agent.id);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x + s * 0.35, screen.y - s * 0.8);
    ctx.lineTo(screen.x + s * 0.85 + swing * 4, screen.y - s * 1.4);
    ctx.stroke();
  } else if (agent.militaryDuty || agent.job === "soldier") {
    const wt = agent.combat?.weaponType;
    if (wt === "cannon" || wt === "artillery") {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(screen.x + s * 0.25, screen.y - s * 1.0 + headBob, s * 0.75, 4);
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.arc(screen.x + s * 0.35, screen.y - s * 0.7 + headBob, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (wt === "rifle" || wt === "musket") {
      ctx.strokeStyle = wt === "rifle" ? "#334155" : "#78350f";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(screen.x + s * 0.15, screen.y - s * 0.85 + headBob);
      ctx.lineTo(screen.x + s * 0.95, screen.y - s * 1.05 + headBob);
      ctx.stroke();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(screen.x + s * 0.5, screen.y - s * 0.95 + headBob);
      ctx.lineTo(screen.x + s * 1.05, screen.y - s * 1.08 + headBob);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(screen.x + s * 0.35, screen.y - s * 0.7);
      ctx.lineTo(screen.x + s * 0.7, screen.y - s * 1.5);
      ctx.stroke();
      if (agent.hasShield) {
        ctx.fillStyle = "#1e3a8a";
        ctx.beginPath();
        ctx.ellipse(screen.x - s * 0.45, screen.y - s * 0.95, s * 0.22, s * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  } else if (agent.job === "hunter" || actType === "hunt") {
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(screen.x + s * 0.45, screen.y - s * 1.0, s * 0.42, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
  }

  const inv = agent.inventory;
  if (inv && !agent.militaryDuty) {
    const logs = (inv.wood_log || 0) + (inv.plank || 0);
    const ores = (inv.ore_iron || 0) + (inv.iron_ingot || 0) + (inv.uranium || 0);
    const foodCarry = (inv.wheat || 0) + (inv.bread || 0) + (inv.meat || 0);
    if (logs > 0) {
      ctx.fillStyle = "#78350f";
      ctx.fillRect(screen.x - s * 0.62, screen.y - s * 1.15, s * 0.34, s * 0.55);
      ctx.fillStyle = "#b45309";
      ctx.fillRect(screen.x - s * 0.58, screen.y - s * 1.1, s * 0.22, s * 0.45);
    } else if (ores > 0) {
      ctx.fillStyle = (inv.uranium || 0) > 0 ? "#84cc16" : "#64748b";
      ctx.beginPath();
      ctx.arc(screen.x - s * 0.48, screen.y - s * 0.92, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (foodCarry >= 2) {
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.ellipse(screen.x - s * 0.48, screen.y - s * 0.92, s * 0.2, s * 0.3, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (actType === "reproduce") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "❤️", facing);
  } else if (actType === "gather_at_hearth") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🔥", facing);
  } else if (actType === "visit_market") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🛍️", facing);
  } else if (actType === "pray_at_temple") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🙏", facing);
  } else if (actType === "conjure_fallen") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "👻", facing);
  } else if (actType === "watch_crafts") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🔨", facing);
  } else if (actType === "train_at_barracks" || actType === "patrol_settlement") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🛡️", facing);
  } else if (actType === "play_in_town") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🪁", facing);
  } else if (actType === "fetch_town_water") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🪣", facing);
  } else if (actType === "tend_town_farm" || actType === "farm" || actType === "gather_food") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🌾", facing);
  } else if (actType === "chop_wood") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🪵", facing);
  } else if (actType === "mine_ore") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "⛏️", facing);
  } else if (actType === "deposit_to_stockpile") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "📦", facing);
  } else if (actType === "eat_from_stockpile" || actType === "eat_from_inventory") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "🍞", facing);
  } else if (actType === "visit_neighbor" || actType === "wander_to_town" || actType === "socialize") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "💬", facing);
  } else if (actType === "combat") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "⚔️", facing);
  } else if (actType === "rest" || actType === "go_home_and_rest") {
    drawThoughtIcon(r, screen.x, screen.y - s * 2.2, "💤", facing);
  }

  ctx.restore();
}
