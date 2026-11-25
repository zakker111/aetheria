// Terrain, Sky, Water, Rivers, Roads, Bridges & Hazard Tile Rendering Pass (2.5D Isometric).

export function lerpColor(c1, c2, t) {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function renderSkyAndBackdrop(r) {
  const time = r.simulation?.clock?.getTime() || { hours: 12 };
  const h = time.hours;

  // Four sky keyframe palettes across 24 hours (Midnight, Dawn, Noon, Dusk)
  const palettes = [
    { h: 0,  top: [2, 6, 23],    btm: [15, 23, 42] },   // Deep Midnight
    { h: 6,  top: [49, 16, 63],  btm: [120, 53, 15] },  // Dawn Amber-Rose
    { h: 12, top: [2, 132, 199], btm: [56, 189, 248] }, // Midday Cerulean
    { h: 18, top: [30, 27, 75],  btm: [154, 52, 18] },  // Sunset Flame-Violet
    { h: 24, top: [2, 6, 23],    btm: [15, 23, 42] }    // Midnight Wrap
  ];

  let k = 0;
  while (k < palettes.length - 1 && h >= palettes[k + 1].h) {
    k++;
  }
  const p1 = palettes[k];
  const p2 = palettes[k + 1] || palettes[k];
  const span = p2.h - p1.h;
  const rawT = span > 0 ? (h - p1.h) / span : 0;
  const t = rawT * rawT * (3 - 2 * rawT); // Smoothstep curve

  const topColor = lerpColor(p1.top, p2.top, t);
  const btmColor = lerpColor(p1.btm, p2.btm, t);

  const grad = r.ctx.createLinearGradient(0, 0, 0, r.canvas.height);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, btmColor);
  r.ctx.fillStyle = grad;
  r.ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);
}

/**
 * Biome Palette with elevation tinting and slope sunlight.
 */
export function getBiomeColor(r, biome, elevation, sunFactor) {
  const qSun = (sunFactor * 10) | 0;
  const qElev = ((elevation / 10) | 0) * 10;
  const key = `${biome}_${qElev}_${qSun}`;
  let cached = r._biomeColorCache[key];
  if (cached) return cached;

  let base = [22, 163, 74]; // grassland

  switch (biome) {
    case "water":
      base = [30, 58, 138];
      break;
    case "beach":
      base = [254, 243, 199];
      break;
    case "grassland":
      base = [34, 197, 94];
      break;
    case "forest":
      base = [21, 128, 61];
      break;
    case "mountain":
      base = elevation > 85 ? [240, 249, 255] : elevation > 70 ? [214, 211, 209] : [120, 113, 108];
      break;
    case "snow":
      base = [240, 249, 255];
      break;
    case "desert":
      base = [251, 191, 36];
      break;
    case "tundra":
      base = [168, 162, 158];
      break;
    case "savanna":
      base = [132, 204, 22];
      break;
    case "jungle":
      base = [6, 95, 70];
      break;
  }

  const factor = qSun / 10;
  const cr = Math.min(255, (base[0] * factor) | 0);
  const cg = Math.min(255, (base[1] * factor) | 0);
  const cb = Math.min(255, (base[2] * factor) | 0);
  cached = `rgb(${cr},${cg},${cb})`;
  r._biomeColorCache[key] = cached;
  return cached;
}

export function getCliffColor(r, biome, factor) {
  const qFactor = (factor * 10) | 0;
  const key = `cliff_${qFactor}`;
  let cached = r._biomeColorCache[key];
  if (cached) return cached;

  const f = qFactor / 10;
  const cr = (80 * f) | 0;
  const cg = (75 * f) | 0;
  const cb = (71 * f) | 0;
  cached = `rgb(${cr},${cg},${cb})`;
  r._biomeColorCache[key] = cached;
  return cached;
}

/**
 * Renders 2.5D elevated terrain tiles, facets, slope shading, and 3D vertical drop cliffs.
 */
export function render25DTerrain(r, minX, maxX, minY, maxY) {
  const world = r.world;
  const zoom = r.camera.zoom;
  const ctx = r.ctx;
  const w = world.width;
  const h = world.height;

  const centerX = r.canvas.width / 2;
  const centerY = r.canvas.height / 2;
  const canvasW = r.canvas.width;
  const canvasH = r.canvas.height;
  const tileW = zoom * 2.8;
  const tileH = tileW * r.camera.tilt;
  const halfW = tileW * 0.5;
  const halfH = tileH * 0.5;
  const hFactor = zoom * r.camera.heightScale * 0.22;
  const camX = r.camera.x;
  const camY = r.camera.y;

  // Loop through diagonals (x + y = d) so tiles are drawn back-to-front (Painter's algorithm)
  const minD = minX + minY;
  const maxD = maxX + maxY;

  for (let d = minD; d <= maxD; d++) {
    const startX = Math.max(minX, d - maxY);
    const endX = Math.min(maxX, d - minY);

    for (let x = startX; x <= endX; x++) {
      const y = d - x;
      if (y < minY || y > maxY) continue;

      const idx = y * w + x;
      const biome = world.biome ? world.biome[idx] : "grassland";

      // 4 corner vertices in 3D: North, East, South, West
      const zN = r.getTileElevation(x, y);
      const zE = r.getTileElevation(x + 1, y);
      const zS = r.getTileElevation(x + 1, y + 1);
      const zW = r.getTileElevation(x, y + 1);

      const dx0 = x - camX, dy0 = y - camY;
      const dx1 = dx0 + 1, dy1 = dy0 + 1;

      const pNx = centerX + (dx0 - dy0) * halfW;
      const pNy = centerY + (dx0 + dy0) * halfH - (zN - 20) * hFactor;

      const pEx = centerX + (dx1 - dy0) * halfW;
      const pEy = centerY + (dx1 + dy0) * halfH - (zE - 20) * hFactor;

      const pSx = centerX + (dx1 - dy1) * halfW;
      const pSy = centerY + (dx1 + dy1) * halfH - (zS - 20) * hFactor;

      const pWx = centerX + (dx0 - dy1) * halfW;
      const pWy = centerY + (dx0 + dy1) * halfH - (zW - 20) * hFactor;

      // Viewport bounding box culling
      const minTileX = Math.min(pNx, pEx, pSx, pWx);
      const maxTileX = Math.max(pNx, pEx, pSx, pWx);
      const minTileY = Math.min(pNy, pEy, pSy, pWy);
      const maxTileY = Math.max(pNy, pEy, pSy, pWy);

      if (maxTileX < -30 || minTileX > canvasW + 30 || maxTileY < -50 || minTileY > canvasH + 30) {
        continue;
      }

      // 1. South-West Vertical Cliff Face
      const southZ = y + 1 < h ? r.getTileElevation(x, y + 1) : 0;
      const southZ2 = (y + 1 < h && x + 1 < w) ? r.getTileElevation(x + 1, y + 1) : 0;

      if ((zW - southZ) >= 2 || (zS - southZ2) >= 2) {
        const dropZ_W = Math.max(0, southZ);
        const dropZ_S = Math.max(0, southZ2);
        const pW_dropY = centerY + (dx0 + dy1) * halfH - (dropZ_W - 20) * hFactor;
        const pS_dropY = centerY + (dx1 + dy1) * halfH - (dropZ_S - 20) * hFactor;

        ctx.beginPath();
        ctx.moveTo(pWx, pWy);
        ctx.lineTo(pSx, pSy);
        ctx.lineTo(pSx, pS_dropY);
        ctx.lineTo(pWx, pW_dropY);
        ctx.closePath();
        ctx.fillStyle = getCliffColor(r, biome, 0.65);
        ctx.fill();
      }

      // 2. South-East Vertical Cliff Face
      const eastZ = x + 1 < w ? r.getTileElevation(x + 1, y) : 0;
      if ((zE - eastZ) >= 2 || (zS - southZ2) >= 2) {
        const dropZ_E = Math.max(0, eastZ);
        const dropZ_S = Math.max(0, southZ2);
        const pE_dropY = centerY + (dx1 + dy0) * halfH - (dropZ_E - 20) * hFactor;
        const pS_dropY = centerY + (dx1 + dy1) * halfH - (dropZ_S - 20) * hFactor;

        ctx.beginPath();
        ctx.moveTo(pEx, pEy);
        ctx.lineTo(pSx, pSy);
        ctx.lineTo(pSx, pS_dropY);
        ctx.lineTo(pEx, pE_dropY);
        ctx.closePath();
        ctx.fillStyle = getCliffColor(r, biome, 0.82);
        ctx.fill();
      }

      // 3. Top Surface Diamond Facet
      ctx.beginPath();
      ctx.moveTo(pNx, pNy);
      ctx.lineTo(pEx, pEy);
      ctx.lineTo(pSx, pSy);
      ctx.lineTo(pWx, pWy);
      ctx.closePath();

      const slopeX = (zE + zS) - (zN + zW);
      const slopeY = (zW + zS) - (zN + zE);
      const sunFactor = 1.0 - (slopeX * 0.008) - (slopeY * 0.008);
      const clampedSun = Math.max(0.65, Math.min(1.35, sunFactor));

      ctx.fillStyle = getBiomeColor(r, biome, zN, clampedSun);
      ctx.fill();
    }
  }
}

/**
 * Water bodies & glistening rivers in 2.5D.
 */
export function render25DWaterAndRivers(r, minX, maxX, minY, maxY) {
  const world = r.world;
  if (!world) return;
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const now = r._frameNow;
  const w = world.width;
  const centerX = r.canvas.width * 0.5;
  const centerY = r.canvas.height * 0.5;
  const tileW = zoom * 2.8;
  const halfW = tileW * 0.5;
  const halfH = halfW * r.camera.tilt;
  const hFactor = zoom * r.camera.heightScale * 0.22;
  const camX = r.camera.x;
  const camY = r.camera.y;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * w + x;
      const biome = world.biome ? world.biome[idx] : null;
      const riverFlow = world.riverFlow ? world.riverFlow[idx] : 0;
      const isOceanLake = biome === "water";
      const hasRiver = riverFlow > 0.28 && !isOceanLake;

      if (!isOceanLake && !hasRiver) continue;

      const elev = isOceanLake ? 14 : r.getTileElevation(x, y);
      const dropElev = (elev - 20) * hFactor;
      const dx0 = x - camX, dy0 = y - camY;
      const dx1 = dx0 + 1, dy1 = dy0 + 1;

      const pNx = centerX + (dx0 - dy0) * halfW;
      const pNy = centerY + (dx0 + dy0) * halfH - dropElev;
      const pEx = centerX + (dx1 - dy0) * halfW;
      const pEy = centerY + (dx1 + dy0) * halfH - dropElev;
      const pSx = centerX + (dx1 - dy1) * halfW;
      const pSy = centerY + (dx1 + dy1) * halfH - dropElev;
      const pWx = centerX + (dx0 - dy1) * halfW;
      const pWy = centerY + (dx0 + dy1) * halfH - dropElev;

      ctx.beginPath();
      ctx.moveTo(pNx, pNy);
      ctx.lineTo(pEx, pEy);
      ctx.lineTo(pSx, pSy);
      ctx.lineTo(pWx, pWy);
      ctx.closePath();

      const shimmer = 0.5 + 0.3 * Math.sin(now * 0.003 + x * 1.5 + y * 2.1);
      if (isOceanLake) {
        const isFlowingChannel = riverFlow >= 0.45;
        ctx.fillStyle = isFlowingChannel
          ? `rgba(24, 144, 210, ${0.72 + 0.12 * shimmer})`
          : `rgba(14, 116, 184, ${0.72 + 0.1 * shimmer})`;
        ctx.fill();

        if (zoom >= 5 && (isFlowingChannel || (zoom >= 6 && shimmer > 0.65))) {
          ctx.strokeStyle = isFlowingChannel
            ? `rgba(224, 242, 254, ${0.22 + 0.2 * shimmer})`
            : `rgba(255, 255, 255, ${0.28 * shimmer})`;
          ctx.lineWidth = isFlowingChannel ? Math.max(1, zoom * 0.1) : 1;
          ctx.beginPath();
          ctx.moveTo((pNx + pWx) * 0.5, (pNy + pWy) * 0.5);
          ctx.lineTo((pEx + pSx) * 0.5, (pEy + pSy) * 0.5);
          ctx.stroke();
        }
      } else if (hasRiver) {
        ctx.fillStyle = `rgba(56, 189, 248, ${0.65 + 0.2 * shimmer})`;
        ctx.fill();

        if (zoom >= 5) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = Math.max(1, zoom * 0.12);
          ctx.beginPath();
          ctx.moveTo((pNx + pSx) * 0.5 - 2, (pNy + pSy) * 0.5);
          ctx.lineTo((pNx + pSx) * 0.5 + 2, (pNy + pSy) * 0.5);
          ctx.stroke();
        }
      }
    }
  }
}

/**
 * 2.5D Roads, desire-paths, bridges, craters, radiation fallout, and burning ground.
 */
export function render25DRoadsAndBridges(r, minX, maxX, minY, maxY) {
  const world = r.world;
  if (!world) return;
  const ctx = r.ctx;
  const zoom = r.camera.zoom;
  const w = world.width;
  const now = r._frameNow;
  const pN = r._pN, pE = r._pE, pS = r._pS, pW = r._pW, pTmp = r._pTmp;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * w + x;
      const isBridge = Boolean(world.bridgeTiles && world.bridgeTiles[idx]);
      const isRoad = Boolean(world.roadTiles && world.roadTiles[idx]);
      const isFire = Boolean(world.fireTiles && world.fireTiles[idx] > 0);
      const isScorched = Boolean(world.scorchedTiles && world.scorchedTiles[idx] > 0);
      const isCrater = Boolean(world.craterTiles && world.craterTiles[idx] > 0);
      const isRad = Boolean(world.radiationTiles && world.radiationTiles[idx] > 0);
      if (!isBridge && !isRoad && !isFire && !isScorched && !isCrater && !isRad) continue;

      const elev = r.getTileElevation(x, y);

      if (isScorched) {
        r.worldToScreenFast(x, y, elev, pN);
        r.worldToScreenFast(x + 1, y, elev, pE);
        r.worldToScreenFast(x + 1, y + 1, elev, pS);
        r.worldToScreenFast(x, y + 1, elev, pW);

        const scorchAlpha = Math.min(0.85, (world.scorchedTiles[idx] / 255) * 0.75 + 0.15);
        ctx.fillStyle = `rgba(28, 25, 23, ${scorchAlpha})`;
        ctx.beginPath();
        ctx.moveTo(pN.x, pN.y);
        ctx.lineTo(pE.x, pE.y);
        ctx.lineTo(pS.x, pS.y);
        ctx.lineTo(pW.x, pW.y);
        ctx.closePath();
        ctx.fill();
      }

      if (isCrater) {
        r.worldToScreenFast(x + 0.5, y + 0.5, elev, pTmp);
        const intensity = Math.min(1, world.craterTiles[idx] / 220);
        const rx = Math.max(3, zoom * 0.72 * (0.65 + 0.35 * intensity));
        const ry = rx * 0.52;
        ctx.fillStyle = "rgba(15, 13, 12, 0.85)";
        ctx.beginPath();
        ctx.ellipse(pTmp.x, pTmp.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(87, 83, 78, 0.75)";
        ctx.lineWidth = Math.max(1, zoom * 0.08);
        ctx.beginPath();
        ctx.ellipse(pTmp.x, pTmp.y - 0.5, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isRad) {
        r.worldToScreenFast(x, y, elev, pN);
        r.worldToScreenFast(x + 1, y, elev, pE);
        r.worldToScreenFast(x + 1, y + 1, elev, pS);
        r.worldToScreenFast(x, y + 1, elev, pW);
        const radStrength = Math.min(1, world.radiationTiles[idx] / 255);
        const pulse = 0.75 + 0.25 * Math.sin(now * 0.006 + x * 0.9 + y * 1.1);
        const radAlpha = Math.min(0.62, radStrength * 0.52 * pulse + 0.08);
        ctx.fillStyle = `rgba(132, 204, 22, ${radAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(pN.x, pN.y);
        ctx.lineTo(pE.x, pE.y);
        ctx.lineTo(pS.x, pS.y);
        ctx.lineTo(pW.x, pW.y);
        ctx.closePath();
        ctx.fill();
      }

      if (isBridge) {
        r.worldToScreenFast(x, y, elev + 2, pN);
        r.worldToScreenFast(x + 1, y, elev + 2, pE);
        r.worldToScreenFast(x + 1, y + 1, elev + 2, pS);
        r.worldToScreenFast(x, y + 1, elev + 2, pW);

        ctx.fillStyle = "#854d0e";
        ctx.beginPath();
        ctx.moveTo(pN.x, pN.y);
        ctx.lineTo(pE.x, pE.y);
        ctx.lineTo(pS.x, pS.y);
        ctx.lineTo(pW.x, pW.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#451a03";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (zoom >= 6) {
          ctx.strokeStyle = "#a16207";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pW.x, pW.y - 3);
          ctx.lineTo(pS.x, pS.y - 3);
          ctx.moveTo(pN.x, pN.y - 3);
          ctx.lineTo(pE.x, pE.y - 3);
          ctx.stroke();
        }
      } else if (isRoad) {
        r.worldToScreenFast(x + 0.15, y + 0.15, elev, pN);
        r.worldToScreenFast(x + 0.85, y + 0.15, elev, pE);
        r.worldToScreenFast(x + 0.85, y + 0.85, elev, pS);
        r.worldToScreenFast(x + 0.15, y + 0.85, elev, pW);

        const traffic = world.footTraffic ? world.footTraffic[idx] : 0;
        ctx.fillStyle = traffic >= 15 ? "rgba(180, 160, 130, 0.82)" : "rgba(195, 180, 155, 0.65)";
        ctx.beginPath();
        ctx.moveTo(pN.x, pN.y);
        ctx.lineTo(pE.x, pE.y);
        ctx.lineTo(pS.x, pS.y);
        ctx.lineTo(pW.x, pW.y);
        ctx.closePath();
        ctx.fill();
      }

      if (isFire) {
        r.worldToScreenFast(x + 0.5, y + 0.5, elev, pTmp);
        const flicker = 0.6 + 0.4 * Math.sin(now * 0.015 + x * 3.1 + y * 4.7);
        const fs = Math.max(4, zoom * 0.9 * flicker);

        ctx.fillStyle = "rgba(40, 10, 0, 0.65)";
        ctx.beginPath();
        ctx.ellipse(pTmp.x, pTmp.y, fs * 0.6, fs * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        const flameGrad = ctx.createRadialGradient(pTmp.x, pTmp.y - fs * 0.5, 0, pTmp.x, pTmp.y - fs * 0.3, fs);
        flameGrad.addColorStop(0, "rgba(255, 240, 120, 0.95)");
        flameGrad.addColorStop(0.4, "rgba(249, 115, 22, 0.85)");
        flameGrad.addColorStop(1, "rgba(220, 38, 38, 0)");
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(pTmp.x, pTmp.y - fs * 0.5, fs * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
