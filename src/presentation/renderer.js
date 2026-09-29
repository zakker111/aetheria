// 2.5D Isometric & Top-Down Canvas Renderer with Procedural 3D Terrain Heights,
// Full Visual Graphics for Biomes, Buildings, Resources, Agents, Animals & Atmosphere.
// Conforms to Aetheria architecture (renderer receives state snapshots, zero side-effects).
import { RNG } from "../core/rng.js";

// Decorative-only visual randomness. Uses a fixed-seed stream instead of
// Math.random so cloud shapes and lightning jitter are reproducible across
// reloads and test runs (determinism guard: never Math.random).
const _visualRng = new RNG(0xAE712);

export class CanvasRenderer {
  constructor(canvas, world, simulation) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.world = world;
    this.simulation = simulation;
    
    // Camera state
    this.camera = {
      x: world ? world.width / 2 : 64,
      y: world ? world.height / 2 : 64,
      zoom: 12,
      is25D: true,        // 2.5D Isometric Mode enabled by default!
      heightScale: 0.38,  // Vertical terrain elevation accentuation factor
      tilt: 0.52          // Isometric tilt ratio (y compression)
    };

    this.selectedEntity = null;
    
    // Clouds drifting across the sky
    this.clouds = [];
    this.initClouds();

    // God power FX animations
    this.visualEffects = [];

    // Precomputed color lookups & sine tables for 60fps rendering
    this._biomeColorCache = {};

    // Memory pools for garbage-collection-free 60fps rendering
    this._renderList = [];
    this._renderItemPool = [];
    this._poolIndex = 0;
    this._seenBuildingIds = new Set();
    
    this.setupInput();
    this.setupEventListeners();
  }

  getRenderItem(kind, entity, x, y, depth) {
    let item = this._renderItemPool[this._poolIndex];
    if (!item) {
      item = { kind, entity, x, y, depth };
      this._renderItemPool.push(item);
    } else {
      item.kind = kind;
      item.entity = entity;
      item.x = x;
      item.y = y;
      item.depth = depth;
    }
    this._poolIndex++;
    return item;
  }

  get is25D() {
    return this.camera.is25D;
  }

  set is25D(val) {
    this.camera.is25D = Boolean(val);
  }

  initClouds() {
    this.clouds = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        x: _visualRng.next() * (this.world.width + 40) - 20,
        y: _visualRng.next() * (this.world.height + 40) - 20,
        speed: 0.02 + _visualRng.next() * 0.03,
        size: 8 + _visualRng.next() * 14,
        opacity: 0.22 + _visualRng.next() * 0.22,
        seed: _visualRng.next() * 100
      });
    }
  }

  setupEventListeners() {
    if (typeof window === "undefined") return;
    window.addEventListener("god_effect", (e) => {
      if (e.detail) {
        this.addVisualEffect(e.detail.type, e.detail.x, e.detail.y, e.detail);
      }
    });
  }

  addVisualEffect(type, x, y, data = {}) {
    this.visualEffects.push({
      type,
      x,
      y,
      data,
      start: Date.now(),
      duration: data.duration || 1200
    });
  }

  toggle25D() {
    this.camera.is25D = !this.camera.is25D;
    const modeName = this.camera.is25D ? "2.5D Isometric Mode" : "2D Top-Down Mode";
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("show_notification", { detail: `Camera: switched to ${modeName}` }));
    }
    return this.camera.is25D;
  }

  cycleHeightScale() {
    const scales = [0.22, 0.38, 0.58, 0.08];
    const currIdx = scales.indexOf(this.camera.heightScale);
    this.camera.heightScale = scales[(currIdx + 1) % scales.length];
    const label = this.camera.heightScale === 0.08 ? "Low Relief" :
                  this.camera.heightScale === 0.22 ? "Gentle Hills" :
                  this.camera.heightScale === 0.38 ? "Standard 3D Heights" : "Dramatic Peaks";
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("show_notification", { detail: `Terrain: ${label}` }));
    }
  }

  setupInput() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    
    this.canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      dragDistance = 0;
    });
    
    this.canvas.addEventListener("mousemove", (e) => {
      if (isDragging) {
        e.preventDefault();
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        dragDistance += Math.hypot(dx, dy);

        if (this.camera.is25D) {
          // In 2.5D isometric view, mouse drag needs to translate along isometric axes
          const tileW = this.camera.zoom * 2.8;
          const tileH = tileW * this.camera.tilt;
          const du = dx / (tileW * 0.5);
          const dv = dy / (tileH * 0.5);
          const worldDx = (du + dv) * 0.5;
          const worldDy = (dv - du) * 0.5;

          this.camera.x -= worldDx;
          this.camera.y -= worldDy;
        } else {
          this.camera.x -= dx / this.camera.zoom;
          this.camera.y -= dy / this.camera.zoom;
        }

        // Clamp camera center to world margins
        this.camera.x = Math.max(-5, Math.min(this.world.width + 5, this.camera.x));
        this.camera.y = Math.max(-5, Math.min(this.world.height + 5, this.camera.y));
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });
    
    this.canvas.addEventListener("mouseup", (e) => {
      e.preventDefault();
      isDragging = false;
    });
    
    this.canvas.addEventListener("mouseleave", () => {
      isDragging = false;
    });
    
    // Zoom with wheel
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
      this.camera.zoom *= zoomFactor;
      this.camera.zoom = Math.max(3.5, Math.min(36, this.camera.zoom));
    }, { passive: false });
    
    // Click to use god powers or inspect
    this.canvas.addEventListener("click", (e) => {
      e.preventDefault();
      if (dragDistance > 6) {
        // Was dragging the map, ignore click
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(screenX, screenY);
      
      // Dispatch custom event on window for god powers & tools
      window.dispatchEvent(new CustomEvent("worldclick", {
        detail: { x: worldPos.x, y: worldPos.y }
      }));
    });
  }

  /**
   * Get raw elevation at integer tile coordinates
   */
  getTileElevation(x, y) {
    if (!this.world || !this.world.elevation) return 30;
    const w = this.world.width;
    const h = this.world.height;
    const cx = x < 0 ? 0 : x >= w ? w - 1 : (x | 0);
    const cy = y < 0 ? 0 : y >= h ? h - 1 : (y | 0);
    const idx = cy * w + cx;
    
    // Water biome tiles sit at baseline sea level
    if (this.world.biome && this.world.biome[idx] === 'water') {
      return 14;
    }
    return this.world.elevation[idx];
  }

  /**
   * Fast bilinear continuous elevation interpolation for smooth movement across terrain slopes
   */
  getInterpolatedElevation(wx, wy) {
    if (!this.world || !this.world.elevation) return 30;
    const w = this.world.width;
    const h = this.world.height;
    
    let x0 = wx | 0;
    let y0 = wy | 0;
    if (x0 < 0) x0 = 0; else if (x0 >= w) x0 = w - 1;
    if (y0 < 0) y0 = 0; else if (y0 >= h) y0 = h - 1;
    const x1 = x0 + 1 < w ? x0 + 1 : x0;
    const y1 = y0 + 1 < h ? y0 + 1 : y0;
    
    const fx = wx - x0;
    const fy = wy - y0;
    
    const idx0 = y0 * w;
    const idx1 = y1 * w;
    const isWater0 = this.world.biome && this.world.biome[idx0 + x0] === 'water';
    const isWater1 = this.world.biome && this.world.biome[idx0 + x1] === 'water';
    const isWater2 = this.world.biome && this.world.biome[idx1 + x0] === 'water';
    const isWater3 = this.world.biome && this.world.biome[idx1 + x1] === 'water';
    const elev = this.world.elevation;
    
    const e00 = isWater0 ? 14 : elev[idx0 + x0];
    const e10 = isWater1 ? 14 : elev[idx0 + x1];
    const e01 = isWater2 ? 14 : elev[idx1 + x0];
    const e11 = isWater3 ? 14 : elev[idx1 + x1];
    
    const top = e00 + (e10 - e00) * fx;
    const btm = e01 + (e11 - e01) * fx;
    return top + (btm - top) * fy;
  }

  /**
   * Converts world coordinates (and optional elevation) to screen pixels
   */
  worldToScreen(worldX, worldY, worldZ = null) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    if (!this.camera.is25D) {
      return {
        x: centerX + (worldX - this.camera.x) * this.camera.zoom,
        y: centerY + (worldY - this.camera.y) * this.camera.zoom
      };
    }

    // 2.5D Isometric Projection with Terrain Height
    const zoom = this.camera.zoom;
    const tileW = zoom * 2.8;
    const tileH = tileW * this.camera.tilt;
    const hScale = this.camera.heightScale;

    const elev = worldZ !== null ? worldZ : this.getInterpolatedElevation(worldX, worldY);
    const dx = worldX - this.camera.x;
    const dy = worldY - this.camera.y;

    const screenX = centerX + (dx - dy) * (tileW * 0.5);
    const screenY = centerY + (dx + dy) * (tileH * 0.5) - (elev - 20) * zoom * hScale * 0.22;

    return { x: screenX, y: screenY };
  }

  /**
   * Converts screen pixel clicks into exact world coordinates by solving ray intersection with terrain heights
   */
  screenToWorld(screenX, screenY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    if (!this.camera.is25D) {
      return {
        x: this.camera.x + (screenX - centerX) / this.camera.zoom,
        y: this.camera.y + (screenY - centerY) / this.camera.zoom
      };
    }

    // Iterative convergence against 2.5D elevated terrain surface
    const zoom = this.camera.zoom;
    const tileW = zoom * 2.8;
    const tileH = tileW * this.camera.tilt;
    const hScale = this.camera.heightScale;

    let estElev = 30;
    let wx = this.camera.x;
    let wy = this.camera.y;

    for (let iter = 0; iter < 3; iter++) {
      const rx = screenX - centerX;
      const ry = screenY - centerY + (estElev - 20) * zoom * hScale * 0.22;
      const u = rx / (tileW * 0.5);
      const v = ry / (tileH * 0.5);

      wx = this.camera.x + (u + v) * 0.5;
      wy = this.camera.y + (v - u) * 0.5;
      wx = Math.max(0, Math.min(this.world.width - 0.01, wx));
      wy = Math.max(0, Math.min(this.world.height - 0.01, wy));
      estElev = this.getInterpolatedElevation(wx, wy);
    }

    return { x: wx, y: wy };
  }

  /**
   * Main Render Pipeline
   */
  render() {
    // 1. Sky & Atmospheric Backdrop
    this.renderSkyAndBackdrop();

    if (this.camera.is25D) {
      this.render25DScene();
    } else {
      this.render2DScene();
    }

    // 2. Weather & Floating High-Altitude Clouds
    this.renderClouds();

    // 3. Dynamic Day/Night Ambient Tint Overlay
    this.renderDayNightLighting();

    // 4. God Power Visual Particles & Combat Animations
    this.renderVisualEffects();

    // 5. HUD, Realm Chronicle & Selected Entity Overlays
    this.renderHUD();
    this.renderUI();
  }

  renderSkyAndBackdrop() {
    const time = this.simulation?.clock?.getTime() || { hours: 12 };
    const h = time.hours;
    
    // Ambient sky palette shifting through dawn, noon, dusk, and starry night
    let topColor = "#0f172a";
    let btmColor = "#1e293b";

    if (h >= 5 && h < 8) {
      // Dawn rose & amber
      topColor = "#31103f";
      btmColor = "#78350f";
    } else if (h >= 8 && h < 17) {
      // Daylight cerulean blue
      topColor = "#0284c7";
      btmColor = "#38bdf8";
    } else if (h >= 17 && h < 20) {
      // Twilight orange & purple
      topColor = "#1e1b4b";
      btmColor = "#9a3412";
    } else {
      // Night deep cosmic navy
      topColor = "#020617";
      btmColor = "#0f172a";
    }

    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, btmColor);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 2.5D Isometric Rendering Pipeline with 3D Heights and Depth Sorting
   */
  render25DScene() {
    const world = this.world;
    if (!world) return;

    // Viewport tile range estimation with tight margins (height displacement is at most ~4 tiles)
    const margin = 4;
    const minScreen = this.screenToWorld(0, 0);
    const maxScreen = this.screenToWorld(this.canvas.width, this.canvas.height);
    const cornerTR = this.screenToWorld(this.canvas.width, 0);
    const cornerBL = this.screenToWorld(0, this.canvas.height);

    const minX = Math.max(0, Math.floor(Math.min(minScreen.x, maxScreen.x, cornerTR.x, cornerBL.x) - margin));
    const maxX = Math.min(world.width - 1, Math.ceil(Math.max(minScreen.x, maxScreen.x, cornerTR.x, cornerBL.x) + margin));
    const minY = Math.max(0, Math.floor(Math.min(minScreen.y, maxScreen.y, cornerTR.y, cornerBL.y) - margin));
    const maxY = Math.min(world.height - 1, Math.ceil(Math.max(minScreen.y, maxScreen.y, cornerTR.y, cornerBL.y) + margin));

    // A. Render 2.5D Isometric Terrain Blocks with Heights & Cliffs
    this.render25DTerrain(minX, maxX, minY, maxY);

    // B. Render Water Surface, Rivers & Bridges
    this.render25DWaterAndRivers(minX, maxX, minY, maxY);
    this.render25DRoadsAndBridges(minX, maxX, minY, maxY);

    // C. Settlement Territory Borders & Diplomacy Lines
    this.renderSettlementTerritories();
    this.renderDiplomacyLines();

    // D. Depth-Sorted Scene Entities (Buildings, Resources, Animals, Agents)
    this.render25DDepthSortedEntities(minX, maxX, minY, maxY);
  }

  /**
   * Renders 2.5D elevated terrain tiles, facets, slope shading, and 3D vertical drop cliffs
   */
  render25DTerrain(minX, maxX, minY, maxY) {
    const world = this.world;
    const zoom = this.camera.zoom;
    const ctx = this.ctx;
    const w = world.width;
    const h = world.height;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const tileW = zoom * 2.8;
    const tileH = tileW * this.camera.tilt;
    const halfW = tileW * 0.5;
    const halfH = tileH * 0.5;
    const hFactor = zoom * this.camera.heightScale * 0.22;
    const camX = this.camera.x;
    const camY = this.camera.y;

    // Loop through diagonals (x + y = d) so tiles are drawn from back to front (Painter's algorithm)
    const minD = minX + minY;
    const maxD = maxX + maxY;

    for (let d = minD; d <= maxD; d++) {
      const startX = Math.max(minX, d - maxY);
      const endX = Math.min(maxX, d - minY);

      for (let x = startX; x <= endX; x++) {
        const y = d - x;
        if (y < minY || y > maxY) continue;

        const idx = y * w + x;
        const biome = world.biome ? world.biome[idx] : 'grassland';

        // 4 corner vertices in 3D: North, East, South, West
        const zN = this.getTileElevation(x, y);
        const zE = this.getTileElevation(x + 1, y);
        const zS = this.getTileElevation(x + 1, y + 1);
        const zW = this.getTileElevation(x, y + 1);

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

        // 1. South-West Vertical Cliff Face (if neighbor tile has noticeably lower elevation)
        const southZ = y + 1 < h ? this.getTileElevation(x, y + 1) : 0;
        const southZ2 = (y + 1 < h && x + 1 < w) ? this.getTileElevation(x + 1, y + 1) : 0;

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
          ctx.fillStyle = this.getCliffColor(biome, 0.65);
          ctx.fill();
        }

        // 2. South-East Vertical Cliff Face (if eastern neighbor has noticeably lower elevation)
        const eastZ = x + 1 < w ? this.getTileElevation(x + 1, y) : 0;
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
          ctx.fillStyle = this.getCliffColor(biome, 0.82);
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

        ctx.fillStyle = this.getBiomeColor(biome, zN, clampedSun);
        ctx.fill();
      }
    }
  }

  /**
   * Water bodies & glistening rivers in 2.5D
   */
  render25DWaterAndRivers(minX, maxX, minY, maxY) {
    const world = this.world;
    if (!world) return;
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = Date.now();
    const w = world.width;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * w + x;
        const biome = world.biome ? world.biome[idx] : null;
        const riverFlow = world.riverFlow ? world.riverFlow[idx] : 0;
        const isOceanLake = biome === 'water';
        const hasRiver = riverFlow > 0.28 && !isOceanLake;

        if (!isOceanLake && !hasRiver) continue;

        const elev = isOceanLake ? 14 : this.getTileElevation(x, y);
        const pN = this.worldToScreen(x, y, elev);
        const pE = this.worldToScreen(x + 1, y, elev);
        const pS = this.worldToScreen(x + 1, y + 1, elev);
        const pW = this.worldToScreen(x, y + 1, elev);

        ctx.beginPath();
        ctx.moveTo(pN.x, pN.y);
        ctx.lineTo(pE.x, pE.y);
        ctx.lineTo(pS.x, pS.y);
        ctx.lineTo(pW.x, pW.y);
        ctx.closePath();

        // Shimmering animated water surface
        const shimmer = 0.5 + 0.3 * Math.sin(now * 0.003 + x * 1.5 + y * 2.1);
        if (isOceanLake) {
          ctx.fillStyle = `rgba(14, 116, 184, ${0.72 + 0.1 * shimmer})`;
          ctx.fill();

          // Gentle white water foam crest at zoom
          if (zoom >= 6 && shimmer > 0.65) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 * shimmer})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo((pN.x + pW.x) * 0.5, (pN.y + pW.y) * 0.5);
            ctx.lineTo((pE.x + pS.x) * 0.5, (pE.y + pS.y) * 0.5);
            ctx.stroke();
          }
        } else if (hasRiver) {
          // Flowing mountain river / valley stream
          ctx.fillStyle = `rgba(56, 189, 248, ${0.65 + 0.2 * shimmer})`;
          ctx.fill();

          if (zoom >= 5) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = Math.max(1, zoom * 0.12);
            ctx.beginPath();
            ctx.moveTo((pN.x + pS.x) * 0.5 - 2, (pN.y + pS.y) * 0.5);
            ctx.lineTo((pN.x + pS.x) * 0.5 + 2, (pN.y + pS.y) * 0.5);
            ctx.stroke();
          }
        }
      }
    }
  }

  /**
   * 2.5D Roads, desire-paths, bridges, and burning ground
   */
  render25DRoadsAndBridges(minX, maxX, minY, maxY) {
    const world = this.world;
    if (!world) return;
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const w = world.width;
    const now = Date.now();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * w + x;
        const elev = this.getTileElevation(x, y);

        // Bridges spanning water
        if (world.bridgeTiles && world.bridgeTiles[idx]) {
          const pN = this.worldToScreen(x, y, elev + 2);
          const pE = this.worldToScreen(x + 1, y, elev + 2);
          const pS = this.worldToScreen(x + 1, y + 1, elev + 2);
          const pW = this.worldToScreen(x, y + 1, elev + 2);

          // Wood plank bridge deck
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

          // Bridge railings
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
        }
        // Cobblestone roads & foot traffic trails
        else if (world.roadTiles && world.roadTiles[idx]) {
          const pN = this.worldToScreen(x + 0.15, y + 0.15, elev);
          const pE = this.worldToScreen(x + 0.85, y + 0.15, elev);
          const pS = this.worldToScreen(x + 0.85, y + 0.85, elev);
          const pW = this.worldToScreen(x + 0.15, y + 0.85, elev);

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

        // Active wildfire burning tiles
        if (world.fireTiles && world.fireTiles[idx] > 0) {
          const screen = this.worldToScreen(x + 0.5, y + 0.5, elev);
          const flicker = 0.6 + 0.4 * Math.sin(now * 0.015 + x * 3.1 + y * 4.7);
          const fs = Math.max(4, zoom * 0.9 * flicker);

          // Charred base
          ctx.fillStyle = "rgba(40, 10, 0, 0.65)";
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, fs * 0.6, fs * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Core flame
          const flameGrad = ctx.createRadialGradient(screen.x, screen.y - fs * 0.5, 0, screen.x, screen.y - fs * 0.3, fs);
          flameGrad.addColorStop(0, "rgba(255, 240, 120, 0.95)");
          flameGrad.addColorStop(0.4, "rgba(249, 115, 22, 0.85)");
          flameGrad.addColorStop(1, "rgba(220, 38, 38, 0)");
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y - fs * 0.5, fs * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Depth-sorts and renders all upright 2.5D graphics:
   * Trees, Boulders, Berry Bushes, Buildings, Animals, Citizens & Clashes.
   */
  render25DDepthSortedEntities(minX, maxX, minY, maxY) {
    this._poolIndex = 0;
    this._renderList.length = 0;
    const list = this._renderList;

    // 1. Resources
    const resources = this.simulation.resources;
    if (resources) {
      const rLen = resources.length;
      for (let i = 0; i < rLen; i++) {
        const res = resources[i];
        if (res.destroyed) continue;
        if (res.x >= minX - 1 && res.x <= maxX + 1 && res.y >= minY - 1 && res.y <= maxY + 1) {
          list.push(this.getRenderItem("resource", res, res.x, res.y, res.x + res.y));
        }
      }
    }

    // 1b. Ground loot piles (Phase 1 — Deep Economy)
    const loot = this.simulation.groundItems;
    if (loot && loot.length > 0) {
      const lLen = loot.length;
      for (let i = 0; i < lLen; i++) {
        const it = loot[i];
        if (it.destroyed || it.total() <= 0) continue;
        if (it.x >= minX - 1 && it.x <= maxX + 1 && it.y >= minY - 1 && it.y <= maxY + 1) {
          list.push(this.getRenderItem("ground_item", it, it.x, it.y, it.x + it.y - 0.02));
        }
      }
    }

    // 2. Buildings (from simulation + settlements + workshops)
    this._seenBuildingIds.clear();
    const buildings = this.simulation.buildings;
    if (buildings) {
      const bLen = buildings.length;
      for (let i = 0; i < bLen; i++) {
        const b = buildings[i];
        const bid = b.id !== undefined ? b.id : ((b.x * 1000) + b.y);
        this._seenBuildingIds.add(bid);
        if (b.x >= minX - 1 && b.x <= maxX + 1 && b.y >= minY - 1 && b.y <= maxY + 1) {
          list.push(this.getRenderItem("building", b, b.x, b.y, b.x + b.y + 0.1));
        }
      }
    }
    if (this.simulation.settlementSystem) {
      for (const set of this.simulation.settlementSystem.settlements.values()) {
        if (set.center && set.center.x >= minX - 2 && set.center.x <= maxX + 2 && set.center.y >= minY - 2 && set.center.y <= maxY + 2) {
          const cid = `sc_${set.id}`;
          if (!this._seenBuildingIds.has(cid)) {
            this._seenBuildingIds.add(cid);
            list.push(this.getRenderItem("settlement_center", set, set.center.x, set.center.y, set.center.x + set.center.y - 0.05));
          }
        }
        if (set.buildings) {
          const sBLen = set.buildings.length;
          for (let i = 0; i < sBLen; i++) {
            const b = set.buildings[i];
            const bid = b.id !== undefined ? b.id : ((b.x * 1000) + b.y);
            if (!this._seenBuildingIds.has(bid)) {
              this._seenBuildingIds.add(bid);
              if (b.x >= minX - 1 && b.x <= maxX + 1 && b.y >= minY - 1 && b.y <= maxY + 1) {
                list.push(this.getRenderItem("building", b, b.x, b.y, b.x + b.y + 0.1));
              }
            }
          }
        }
      }
    }
    if (this.simulation.craftingSystem?.workshops) {
      for (const ws of this.simulation.craftingSystem.workshops.values()) {
        const bid = ws.id !== undefined ? ws.id : ((ws.x * 1000) + ws.y);
        if (!this._seenBuildingIds.has(bid)) {
          this._seenBuildingIds.add(bid);
          if (ws.x >= minX - 1 && ws.x <= maxX + 1 && ws.y >= minY - 1 && ws.y <= maxY + 1) {
            list.push(this.getRenderItem("building", ws, ws.x, ws.y, ws.x + ws.y + 0.1));
          }
        }
      }
    }

    // 3. Wildlife / Animals
    const animals = this.simulation.animalSystem?.animals;
    if (animals) {
      const aLen = animals.length;
      for (let i = 0; i < aLen; i++) {
        const a = animals[i];
        if (a.alive === false) continue;
        if (a.x >= minX - 1 && a.x <= maxX + 1 && a.y >= minY - 1 && a.y <= maxY + 1) {
          list.push(this.getRenderItem("animal", a, a.x, a.y, a.x + a.y + 0.2));
        }
      }
    }

    // 4. Autonomous Agents / Citizens
    const agents = this.simulation.agents;
    if (agents) {
      const agLen = agents.length;
      for (let i = 0; i < agLen; i++) {
        const ag = agents[i];
        if (!ag.alive) continue;
        if (ag.x >= minX - 1 && ag.x <= maxX + 1 && ag.y >= minY - 1 && ag.y <= maxY + 1) {
          list.push(this.getRenderItem("agent", ag, ag.x, ag.y, ag.x + ag.y + 0.3));
        }
      }
    }

    // Sort by depth (x + y) so back objects draw first and front objects occlude them
    list.sort((a, b) => a.depth - b.depth);

    // Render sorted list
    const len = list.length;
    for (let i = 0; i < len; i++) {
      const item = list[i];
      const elev = this.getInterpolatedElevation(item.x, item.y);
      const screen = this.worldToScreen(item.x, item.y, elev);

      switch (item.kind) {
        case "resource":
          this.render25DResource(item.entity, screen, elev);
          break;
        case "ground_item":
          this.render25DGroundItem(item.entity, screen);
          break;
        case "building":
          this.render25DBuilding(item.entity, screen, elev);
          break;
        case "settlement_center":
          this.render25DSettlementCenter(item.entity, screen, elev);
          break;
        case "animal":
          this.render25DAnimal(item.entity, screen, elev);
          break;
        case "agent":
          this.render25DAgent(item.entity, screen, elev);
          break;
      }
    }

    // Active Combat Clashes on top
    this.renderCombatEffects();
  }

  /**
   * 2.5D Detailed Graphic for Trees, Berry Bushes, Ore Veins & Water Springs
   */
  /**
   * 2.5D Loot Sack: small brown bundle with a tie, sized by contents.
   */
  render25DGroundItem(item, screen) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const s = Math.max(2.5, zoom * 0.38);

    ctx.save();
    // shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 1.5, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // sack body
    ctx.fillStyle = "#8a6a3b";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y - s * 0.45, s * 0.62, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = "rgba(255, 235, 190, 0.35)";
    ctx.beginPath();
    ctx.ellipse(screen.x - s * 0.2, screen.y - s * 0.6, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // tie
    ctx.strokeStyle = "#5c4322";
    ctx.lineWidth = Math.max(1, zoom * 0.06);
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.3, screen.y - s * 0.9);
    ctx.lineTo(screen.x + s * 0.3, screen.y - s * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  render25DResource(res, screen, elev) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const type = res.resourceType;
    const isDepleted = res.amount <= 0;
    const s = Math.max(3, zoom * 0.7);

    ctx.save();

    // Soft drop shadow at ground height
    ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 2, s * 0.65, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (type === "wood") {
      // 2.5D Tree with 3D Trunk & Volumetric Foliage Canopy
      if (isDepleted) {
        // Cut stump
        ctx.fillStyle = "#5c2c16";
        ctx.fillRect(screen.x - s * 0.2, screen.y - s * 0.3, s * 0.4, s * 0.3);
        ctx.fillStyle = "#854d0e";
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - s * 0.3, s * 0.22, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Wooden Trunk with bark shading
        ctx.fillStyle = "#5c2c16";
        ctx.fillRect(screen.x - s * 0.15, screen.y - s * 0.6, s * 0.3, s * 0.65);

        // Lower Canopy Shadow
        ctx.fillStyle = "#14532d";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 0.8, s * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Upper Canopy Lush Green
        ctx.fillStyle = "#16a34a";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 1.15, s * 0.58, 0, Math.PI * 2);
        ctx.fill();

        // Sunlit Leaf Highlight
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.arc(screen.x - s * 0.2, screen.y - s * 1.3, s * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "food") {
      // 2.5D Berry Bush / Fruit Orchard
      ctx.fillStyle = "#3f6212";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - s * 0.35, s * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#65a30d";
      ctx.beginPath();
      ctx.arc(screen.x - s * 0.12, screen.y - s * 0.45, s * 0.38, 0, Math.PI * 2);
      ctx.fill();

      if (!isDepleted) {
        // Red Berries
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(screen.x - s * 0.2, screen.y - s * 0.3, s * 0.12, 0, Math.PI * 2);
        ctx.arc(screen.x + s * 0.18, screen.y - s * 0.22, s * 0.12, 0, Math.PI * 2);
        ctx.arc(screen.x, screen.y - s * 0.45, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "ore") {
      // 2.5D Craggy Mountain Boulder with Gold/Silver Ore Veins
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.5, screen.y);
      ctx.lineTo(screen.x - s * 0.35, screen.y - s * 0.6);
      ctx.lineTo(screen.x + s * 0.15, screen.y - s * 0.7);
      ctx.lineTo(screen.x + s * 0.55, screen.y - s * 0.2);
      ctx.lineTo(screen.x + s * 0.3, screen.y + s * 0.1);
      ctx.closePath();
      ctx.fill();

      // Rock facet light catch
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.35, screen.y - s * 0.6);
      ctx.lineTo(screen.x + s * 0.15, screen.y - s * 0.7);
      ctx.lineTo(screen.x + s * 0.05, screen.y - s * 0.25);
      ctx.lineTo(screen.x - s * 0.25, screen.y - s * 0.15);
      ctx.closePath();
      ctx.fill();

      if (!isDepleted) {
        // Gold ore glints
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(screen.x - s * 0.15, screen.y - s * 0.4, s * 0.15, s * 0.15);
        ctx.fillRect(screen.x + s * 0.15, screen.y - s * 0.5, s * 0.15, s * 0.15);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(screen.x - s * 0.1, screen.y - s * 0.4, s * 0.06, s * 0.06);
      }
    } else {
      // Water Spring Font
      ctx.fillStyle = "#0284c7";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.1, s * 0.5, s * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 2.5D Isometric Architectural Graphics for All Building Types:
   * Houses, Workshops, Farms, Mines, Temples, Walls, Towers, Castles.
   */
  render25DBuilding(b, screen, elev) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const type = b.buildingType || b.type || "house";
    const bs = Math.max(6, zoom * (type === "castle" ? 1.4 : type === "tower" ? 1.0 : 0.9));
    const now = Date.now();

    ctx.save();

    // 1. Soft Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + bs * 0.15, bs * 0.8, bs * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Specialized 2.5D Architectural Model Rendering
    if (type === "house") {
      // 2.5D Stone-and-Timber Cottage with Pitched Tiled Roof & Chimney
      const wallH = bs * 0.75;
      const roofH = bs * 0.65;

      // South-West Wall (Shaded)
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.5, screen.y);
      ctx.lineTo(screen.x, screen.y + bs * 0.25);
      ctx.lineTo(screen.x, screen.y + bs * 0.25 - wallH);
      ctx.lineTo(screen.x - bs * 0.5, screen.y - wallH);
      ctx.closePath();
      ctx.fill();

      // South-East Wall (Sunlit)
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y + bs * 0.25);
      ctx.lineTo(screen.x + bs * 0.5, screen.y);
      ctx.lineTo(screen.x + bs * 0.5, screen.y - wallH);
      ctx.lineTo(screen.x, screen.y + bs * 0.25 - wallH);
      ctx.closePath();
      ctx.fill();

      // Pitched Terracotta Roof
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

      // Chimney & Rising Smoke
      ctx.fillStyle = "#78350f";
      ctx.fillRect(screen.x + bs * 0.15, screen.y - wallH - roofH * 0.7, bs * 0.18, bs * 0.4);
      // Smoke puff
      const smokeOffset = (now * 0.003) % 1;
      ctx.fillStyle = `rgba(200, 200, 200, ${0.45 * (1 - smokeOffset)})`;
      ctx.beginPath();
      ctx.arc(screen.x + bs * 0.24, screen.y - wallH - roofH - smokeOffset * 10, 3 + smokeOffset * 3, 0, Math.PI * 2);
      ctx.fill();

      // Wooden Door & Lit Window
      ctx.fillStyle = "#78350f";
      ctx.fillRect(screen.x + bs * 0.12, screen.y - wallH * 0.4, bs * 0.16, wallH * 0.45);
      ctx.fillStyle = "#fbbf24"; // warm glowing window
      ctx.fillRect(screen.x - bs * 0.35, screen.y - wallH * 0.6, bs * 0.16, bs * 0.16);

    } else if (type === "workshop") {
      // 2.5D Artisan Blacksmith Forge with Stone Hearth & Anvil
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

      // Dark Iron/Slate Roof
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - wallH - bs * 0.4);
      ctx.lineTo(screen.x - bs * 0.6, screen.y - wallH);
      ctx.lineTo(screen.x, screen.y + bs * 0.28 - wallH);
      ctx.lineTo(screen.x + bs * 0.6, screen.y - wallH);
      ctx.closePath();
      ctx.fill();

      // Blazing forge glow
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - wallH * 0.25, bs * 0.2, 0, Math.PI * 2);
      ctx.fill();

    } else if (type === "farm") {
      // 2.5D Rustic Red Barn & Tilled Golden Furrow Patch
      ctx.fillStyle = "#b45309";
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.7, screen.y);
      ctx.lineTo(screen.x, screen.y + bs * 0.35);
      ctx.lineTo(screen.x + bs * 0.7, screen.y);
      ctx.lineTo(screen.x, screen.y - bs * 0.35);
      ctx.closePath();
      ctx.fill();

      // Golden wheat field furrows
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(screen.x + i * bs * 0.12 - bs * 0.3, screen.y + i * bs * 0.06);
        ctx.lineTo(screen.x + i * bs * 0.12 + bs * 0.3, screen.y + i * bs * 0.06);
        ctx.stroke();
      }

      // Small Barn structure at corner
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
      // 2.5D Grand Citadel with Four Corner Bastions, Central Keep & Heraldic Banner
      const keepH = bs * 1.2;
      const bH = bs * 0.9;
      const bW = bs * 0.26;

      // Central Stone Keep
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.45, screen.y);
      ctx.lineTo(screen.x, screen.y + bs * 0.25);
      ctx.lineTo(screen.x + bs * 0.45, screen.y);
      ctx.lineTo(screen.x + bs * 0.45, screen.y - keepH);
      ctx.lineTo(screen.x - bs * 0.45, screen.y - keepH);
      ctx.closePath();
      ctx.fill();

      // Corner Bastions
      ctx.fillStyle = "#475569";
      ctx.fillRect(screen.x - bs * 0.55, screen.y - bH, bW, bH);
      ctx.fillRect(screen.x + bs * 0.55 - bW, screen.y - bH, bW, bH);

      // Conical Blue Tower Roofs
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

      // Waving Crest Banner
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
      // 2.5D Round Defensive Watchtower
      const tH = bs * 1.35;
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, bs * 0.35, bs * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#64748b";
      ctx.fillRect(screen.x - bs * 0.35, screen.y - tH, bs * 0.7, tH);

      // Conical Spire
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - tH - bs * 0.55);
      ctx.lineTo(screen.x - bs * 0.42, screen.y - tH);
      ctx.lineTo(screen.x + bs * 0.42, screen.y - tH);
      ctx.closePath();
      ctx.fill();

    } else if (type === "temple") {
      // 2.5D Majestic Sacred Sanctuary with Marble Pillars, Golden Dome & Eternal Altar Flame
      const wallH = bs * 0.95;
      const colW = bs * 0.12;

      // Marble Foundation Platform
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(screen.x - bs * 0.55, screen.y - bs * 0.15, bs * 1.1, bs * 0.25);

      // Fluted Marble Pillars
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(screen.x - bs * 0.48, screen.y - wallH, colW, wallH);
      ctx.fillRect(screen.x - bs * 0.2, screen.y - wallH, colW, wallH);
      ctx.fillRect(screen.x + bs * 0.08, screen.y - wallH, colW, wallH);
      ctx.fillRect(screen.x + bs * 0.36, screen.y - wallH, colW, wallH);

      // Golden Architrave & Pediment Roof
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - wallH - bs * 0.45);
      ctx.lineTo(screen.x - bs * 0.55, screen.y - wallH);
      ctx.lineTo(screen.x + bs * 0.55, screen.y - wallH);
      ctx.closePath();
      ctx.fill();

      // Golden Temple Sun Spire
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - wallH - bs * 0.5, 4, 0, Math.PI * 2);
      ctx.fill();

      // Sacred Eternal Altar Brazier (glowing cyan / holy light)
      const bGlow = Math.sin(now * 0.01) * 2;
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - wallH * 0.35, bs * 0.18 + bGlow * 0.5, 0, Math.PI * 2);
      ctx.fill();

    } else if (type === "market") {
      // 2.5D Colorful Merchant Bazaar Stalls with Striped Canvas Canopy & Wares
      const stallH = bs * 0.7;

      // Wooden Table & Crates
      ctx.fillStyle = "#92400e";
      ctx.fillRect(screen.x - bs * 0.45, screen.y - stallH * 0.5, bs * 0.9, stallH * 0.5);

      // Striped Red & White Canvas Canopy
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

      // Produce Crates: Golden Bread & Red Apples
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(screen.x - bs * 0.35, screen.y - stallH * 0.5 - 4, 6, 5);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(screen.x + bs * 0.15, screen.y - stallH * 0.5 - 4, 6, 5);

    } else if (type === "barracks") {
      // 2.5D Sturdy Timber Palisade Barracks & Archery Target
      const wallH = bs * 0.85;
      ctx.fillStyle = "#451a03";
      ctx.fillRect(screen.x - bs * 0.5, screen.y - wallH, bs * 1.0, wallH);

      // Slate Roof
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - wallH - bs * 0.35);
      ctx.lineTo(screen.x - bs * 0.55, screen.y - wallH);
      ctx.lineTo(screen.x + bs * 0.55, screen.y - wallH);
      ctx.closePath();
      ctx.fill();

      // Archery Target
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(screen.x + bs * 0.32, screen.y - wallH * 0.45, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(screen.x + bs * 0.32, screen.y - wallH * 0.45, 3, 0, Math.PI * 2);
      ctx.fill();

    } else if (type === "warehouse" || type === "stockpile") {
      // 2.5D Broad Storage Granary & Supply Cargo Porch
      const wallH = bs * 0.75;
      ctx.fillStyle = "#78350f";
      ctx.fillRect(screen.x - bs * 0.55, screen.y - wallH, bs * 1.1, wallH);

      // Thatch Roof
      ctx.fillStyle = "#ca8a04";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - wallH - bs * 0.4);
      ctx.lineTo(screen.x - bs * 0.6, screen.y - wallH);
      ctx.lineTo(screen.x + bs * 0.6, screen.y - wallH);
      ctx.closePath();
      ctx.fill();

      // Large Double Doors
      ctx.fillStyle = "#292524";
      ctx.fillRect(screen.x - bs * 0.2, screen.y - wallH * 0.6, bs * 0.4, wallH * 0.65);

    } else {
      // Generic Fortification / Mine / Structure
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

    // Construction progress bar if under construction
    if (b.constructionProgress !== undefined && b.constructionProgress < 100) {
      const p = b.constructionProgress / 100;
      const barW = bs * 1.1;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(screen.x - barW / 2, screen.y - bs * 1.5, barW, 4);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(screen.x - barW / 2, screen.y - bs * 1.5, barW * p, 4);
    }

    ctx.restore();
  }

  /**
   * 2.5D Communal Settlement Center / Town Square / Hearth:
   * Cobblestone circular plaza, crackling stone-rimmed campfire with radial warmth glow,
   * rustic wooden benches, stone town well, and waving heraldic village banner!
   */
  render25DSettlementCenter(s, screen, elev) {
    if (!s) return;
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = Date.now();
    const r = Math.max(8, zoom * 1.3);

    ctx.save();

    // 1. Cobblestone Paved Plaza / Circular Courtyard
    ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + r * 0.1, r * 1.4, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Concentric stone pavers ring
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Communal Stone Hearth & Firepit
    const fireRadius = r * 0.35;
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, fireRadius * 1.2, fireRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crackling Charcoal & Embers
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y, fireRadius * 0.85, fireRadius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Warm ambient fire glow on ground
    const glowGrad = ctx.createRadialGradient(screen.x, screen.y, 2, screen.x, screen.y, r * 1.8);
    glowGrad.addColorStop(0, "rgba(251, 146, 60, 0.42)");
    glowGrad.addColorStop(0.5, "rgba(234, 88, 12, 0.18)");
    glowGrad.addColorStop(1, "rgba(234, 88, 12, 0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Animated Flickering Fire Flames
    const flicker1 = Math.sin(now * 0.012 + (s.id || 0)) * (fireRadius * 0.15);
    const flicker2 = Math.cos(now * 0.016 + (s.id || 0)) * (fireRadius * 0.12);
    const fireH = fireRadius * 1.4;

    // Outer flame (orange)
    ctx.fillStyle = "#ea580c";
    ctx.beginPath();
    ctx.moveTo(screen.x - fireRadius * 0.6, screen.y);
    ctx.quadraticCurveTo(screen.x - fireRadius * 0.4, screen.y - fireH * 0.6, screen.x + flicker1, screen.y - fireH - flicker2);
    ctx.quadraticCurveTo(screen.x + fireRadius * 0.4, screen.y - fireH * 0.6, screen.x + fireRadius * 0.6, screen.y);
    ctx.closePath();
    ctx.fill();

    // Inner bright core flame (yellow / white-hot)
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.moveTo(screen.x - fireRadius * 0.35, screen.y);
    ctx.quadraticCurveTo(screen.x - fireRadius * 0.2, screen.y - fireH * 0.4, screen.x - flicker2, screen.y - fireH * 0.75);
    ctx.quadraticCurveTo(screen.x + fireRadius * 0.2, screen.y - fireH * 0.4, screen.x + fireRadius * 0.35, screen.y);
    ctx.closePath();
    ctx.fill();

    // Soft rising sparks
    const sparkOffset = (now * 0.002 + (s.id || 0)) % 1;
    ctx.fillStyle = `rgba(254, 215, 170, ${0.8 * (1 - sparkOffset)})`;
    ctx.beginPath();
    ctx.arc(screen.x + Math.sin(sparkOffset * 6) * 4, screen.y - fireH - sparkOffset * 18, 2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Wooden Timber Benches on sides where citizens sit
    ctx.fillStyle = "#78350f";
    ctx.fillRect(screen.x - r * 0.95, screen.y - r * 0.18, r * 0.28, r * 0.16);
    ctx.fillRect(screen.x + r * 0.68, screen.y - r * 0.18, r * 0.28, r * 0.16);

    // 4. Village Banner Pole & Faction Standard
    const poleH = r * 1.5;
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x - r * 0.7, screen.y + r * 0.2);
    ctx.lineTo(screen.x - r * 0.7, screen.y - poleH);
    ctx.stroke();

    const bWave = Math.sin(now * 0.005 + (s.id || 0)) * 2;
    ctx.fillStyle = s.factionColor || "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(screen.x - r * 0.7, screen.y - poleH);
    ctx.lineTo(screen.x - r * 0.7 + r * 0.5 + bWave, screen.y - poleH + r * 0.15);
    ctx.lineTo(screen.x - r * 0.7, screen.y - poleH + r * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * 2.5D Wildlife Graphics:
   * Stags with branching antlers, tusky boars, stalking timber wolves.
   */
  render25DAnimal(a, screen, elev) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = Date.now();
    const s = Math.max(2, zoom * 0.42);

    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 1, s * 0.8, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    const hop = Math.sin(now * 0.008 + (a.id || 0)) * 1.5;

    if (a.species === "deer") {
      // 2.5D Graceful Stag
      ctx.fillStyle = "#b45309";
      // Body
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.6 + hop, s * 0.85, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head & Neck
      ctx.beginPath();
      ctx.ellipse(screen.x + s * 0.6, screen.y - s * 1.1 + hop, s * 0.35, s * 0.45, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Branching Antlers
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(screen.x + s * 0.6, screen.y - s * 1.3 + hop);
      ctx.lineTo(screen.x + s * 0.4, screen.y - s * 1.7 + hop);
      ctx.moveTo(screen.x + s * 0.7, screen.y - s * 1.3 + hop);
      ctx.lineTo(screen.x + s * 0.9, screen.y - s * 1.7 + hop);
      ctx.stroke();

    } else if (a.species === "boar") {
      // 2.5D Stout Wild Boar
      ctx.fillStyle = "#57534e";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.5 + hop, s * 0.9, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // White Tusk
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(screen.x + s * 0.7, screen.y - s * 0.6 + hop, 2, 3);

    } else {
      // 2.5D Timber Wolf
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 0.55 + hop, s * 0.9, s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      // Snout
      ctx.beginPath();
      ctx.arc(screen.x + s * 0.75, screen.y - s * 0.6 + hop, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Wolf Eye
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(screen.x + s * 0.8, screen.y - s * 0.75 + hop, 2, 2);
    }

    ctx.restore();
  }

  /**
   * 2.5D Humanoid Character Graphics:
   * Citizens, Warriors, Builders, Priests with custom outfits, animated walking legs,
   * swinging tools (axes, pickaxes, hammers), shields, and action thought bubbles!
   */
  render25DAgent(agent, screen, elev) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = Date.now();
    const s = Math.max(3, zoom * 0.48);

    ctx.save();

    // 1. Soft Terrain Shadow at exact elevation
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 1, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Selection Ring if entity is selected
    if (this.selectedEntity && (this.selectedEntity.id === agent.id || this.selectedEntity.entity?.id === agent.id)) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - s * 0.9, s * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const isMoving = Boolean(agent.path && agent.path.length > 0);
    const walk = isMoving ? Math.sin(now * 0.015 + agent.id * 2.1) : 0;
    const headBob = isMoving ? Math.abs(walk) * -2 : 0;

    // 3. Legs
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = Math.max(1.5, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(screen.x - s * 0.25, screen.y - s * 0.5);
    ctx.lineTo(screen.x - s * 0.25 + walk * 3, screen.y);
    ctx.moveTo(screen.x + s * 0.25, screen.y - s * 0.5);
    ctx.lineTo(screen.x + s * 0.25 - walk * 3, screen.y);
    ctx.stroke();

    // 4. Role Tunic Body
    let tunicColor = "#fbbf24";
    if (agent.militaryDuty || agent.job === "soldier") tunicColor = "#dc2626";
    else if (agent.role === "priest" || agent.job === "priest") tunicColor = "#f59e0b";
    else if (agent.role === "builder" || agent.job === "builder") tunicColor = "#b45309";
    else if (agent.role === "lumberjack" || agent.job === "lumberjack") tunicColor = "#15803d";
    else if (agent.role === "miner" || agent.job === "miner") tunicColor = "#475569";
    else if (agent.role === "farmer" || agent.job === "farmer") tunicColor = "#84cc16";

    ctx.fillStyle = tunicColor;
    ctx.beginPath();
    ctx.roundRect(screen.x - s * 0.35, screen.y - s * 1.25 + headBob, s * 0.7, s * 0.75, 3);
    ctx.fill();

    // Belt
    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - s * 0.35, screen.y - s * 0.75 + headBob, s * 0.7, 2);

    // 5. Head
    ctx.fillStyle = "#fed7aa"; // skin tone
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - s * 1.5 + headBob, s * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Hat / Helmet
    if (agent.militaryDuty || agent.job === "soldier") {
      // Iron Helmet with red plume
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - s * 1.62 + headBob, s * 0.36, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(screen.x - 1, screen.y - s * 2.05 + headBob, 3, 5);
    } else if (agent.job === "farmer") {
      // Straw Hat
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 1.7 + headBob, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Tools & Weapons in Hand
    const actType = typeof agent.currentAction === 'string' ? agent.currentAction : agent.currentAction?.type;
    if (actType === "chop_wood") {
      // Swinging Axe
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
      // Pickaxe
      const swing = Math.sin(now * 0.018 + agent.id);
      ctx.strokeStyle = "#52525b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screen.x + s * 0.35, screen.y - s * 0.8);
      ctx.lineTo(screen.x + s * 0.85 + swing * 4, screen.y - s * 1.4);
      ctx.stroke();
    } else if (agent.militaryDuty || agent.job === "soldier") {
      // Sword & Shield
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(screen.x + s * 0.35, screen.y - s * 0.7);
      ctx.lineTo(screen.x + s * 0.7, screen.y - s * 1.5);
      ctx.stroke();
      // Shield
      ctx.fillStyle = "#1e3a8a";
      ctx.beginPath();
      ctx.ellipse(screen.x - s * 0.45, screen.y - s * 0.95, s * 0.22, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 7. Thought / Emotion Bubble
    if (actType === "reproduce") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "❤️");
    } else if (actType === "gather_at_hearth") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🔥");
    } else if (actType === "visit_market") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🛍️");
    } else if (actType === "pray_at_temple") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🙏");
    } else if (actType === "watch_crafts") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🔨");
    } else if (actType === "train_at_barracks" || actType === "patrol_settlement") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🛡️");
    } else if (actType === "play_in_town") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🪁");
    } else if (actType === "fetch_town_water") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🪣");
    } else if (actType === "tend_town_farm" || actType === "farm" || actType === "gather_food") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🌾");
    } else if (actType === "deposit_to_stockpile") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "📦");
    } else if (actType === "eat_from_stockpile" || actType === "eat_from_inventory") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🍞");
    } else if (actType === "visit_neighbor" || actType === "socialize") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "💬");
    } else if (actType === "combat") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "⚔️");
    } else if (actType === "rest" || actType === "go_home_and_rest") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "💤");
    }

    ctx.restore();
  }

  drawThoughtIcon(x, y, icon) {
    this.ctx.font = "12px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(icon, x, y);
  }

  /**
   * Biome Palette with elevation tinting and slope sunlight
   */
  getBiomeColor(biome, elevation, sunFactor) {
    const qSun = (sunFactor * 10) | 0;
    const qElev = ((elevation / 10) | 0) * 10;
    const key = `${biome}_${qElev}_${qSun}`;
    let cached = this._biomeColorCache[key];
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
    const r = Math.min(255, (base[0] * factor) | 0);
    const g = Math.min(255, (base[1] * factor) | 0);
    const b = Math.min(255, (base[2] * factor) | 0);
    cached = `rgb(${r},${g},${b})`;
    this._biomeColorCache[key] = cached;
    return cached;
  }

  getCliffColor(biome, factor) {
    const qFactor = (factor * 10) | 0;
    const key = `cliff_${qFactor}`;
    let cached = this._biomeColorCache[key];
    if (cached) return cached;

    const f = qFactor / 10;
    const r = (80 * f) | 0;
    const g = (75 * f) | 0;
    const b = (71 * f) | 0;
    cached = `rgb(${r},${g},${b})`;
    this._biomeColorCache[key] = cached;
    return cached;
  }

  /**
   * Weather & Floating Volumetric Clouds at High Altitude
   */
  renderClouds() {
    const ctx = this.ctx;
    for (const c of this.clouds) {
      c.x += c.speed;
      if (c.x > this.world.width + 30) c.x = -30;

      const elev = 120; // high above mountains
      const screen = this.worldToScreen(c.x, c.y, elev);
      const ground = this.worldToScreen(c.x, c.y, 25);

      // Cloud shadow cast on terrain
      ctx.fillStyle = `rgba(0, 0, 0, ${c.opacity * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(ground.x, ground.y, c.size * this.camera.zoom * 0.35, c.size * this.camera.zoom * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cloud white body in sky
      const grad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, c.size * this.camera.zoom * 0.4);
      grad.addColorStop(0, `rgba(255, 255, 255, ${c.opacity})`);
      grad.addColorStop(0.7, `rgba(240, 245, 255, ${c.opacity * 0.8})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, c.size * this.camera.zoom * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Ambient Day/Night Lighting Filter (Morning, Noon, Sunset, Night)
   */
  renderDayNightLighting() {
    const time = this.simulation?.clock?.getTime() || { hours: 12 };
    const h = time.hours;
    let overlayColor = null;

    if (h >= 20 || h < 5) {
      // Deep moonlit night tint
      overlayColor = "rgba(10, 20, 50, 0.42)";
    } else if (h >= 17 && h < 20) {
      // Golden hour sunset glow
      overlayColor = "rgba(234, 88, 12, 0.14)";
    } else if (h >= 5 && h < 8) {
      // Dawn rose tint
      overlayColor = "rgba(192, 132, 252, 0.12)";
    }

    if (overlayColor) {
      this.ctx.fillStyle = overlayColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * God Power Visual FX (Lightning, Divine Ray, Sparks)
   */
  renderVisualEffects() {
    const now = Date.now();
    const ctx = this.ctx;
    this.visualEffects = this.visualEffects.filter(fx => (now - fx.start) < fx.duration);

    for (const fx of this.visualEffects) {
      const elapsed = now - fx.start;
      const progress = elapsed / fx.duration;
      const screen = this.worldToScreen(fx.x, fx.y);

      if (fx.type === "smite") {
        // Blinding Forked Lightning Bolt from Sky to Ground
        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
        ctx.lineWidth = Math.max(3, (1 - progress) * 8);
        ctx.beginPath();
        ctx.moveTo(screen.x - 30 + _visualRng.next() * 20, 0);
        ctx.lineTo(screen.x + 10, screen.y * 0.4);
        ctx.lineTo(screen.x - 15, screen.y * 0.7);
        ctx.lineTo(screen.x, screen.y);
        ctx.stroke();

        // Expanding blast shockwave
        ctx.strokeStyle = `rgba(239, 68, 68, ${1 - progress})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, progress * 60, 0, Math.PI * 2);
        ctx.stroke();

      } else if (fx.type === "bless" || fx.type === "bounty") {
        // Divine Golden Light Column & Star Sparkles
        const rayW = (1 - progress) * 40;
        const grad = ctx.createLinearGradient(screen.x, 0, screen.x, screen.y);
        grad.addColorStop(0, "rgba(251, 191, 36, 0.6)");
        grad.addColorStop(1, "rgba(251, 191, 36, 0.1)");
        ctx.fillStyle = grad;
        ctx.fillRect(screen.x - rayW / 2, 0, rayW, screen.y);

        // Golden celestial ring
        ctx.strokeStyle = `rgba(251, 191, 36, ${1 - progress})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, progress * 45, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /**
   * Top-Down Fallback Rendering Mode
   */
  render2DScene() {
    this.ctx.fillStyle = "#0f172a";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const world = this.world;
    if (!world) return;
    const zoom = this.camera.zoom;
    const startX = Math.max(0, Math.floor(this.camera.x - this.canvas.width / 2 / zoom));
    const startY = Math.max(0, Math.floor(this.camera.y - this.canvas.height / 2 / zoom));
    const endX = Math.min(world.width, Math.ceil(this.camera.x + this.canvas.width / 2 / zoom));
    const endY = Math.min(world.height, Math.ceil(this.camera.y + this.canvas.height / 2 / zoom));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = y * world.width + x;
        const biome = world.biome ? world.biome[idx] : 'grassland';
        const elev = world.elevation ? world.elevation[idx] : 50;
        const screen = this.worldToScreen(x, y);
        this.ctx.fillStyle = this.getBiomeColor(biome, elev, 1.0);
        this.ctx.fillRect(screen.x, screen.y, zoom + 0.5, zoom + 0.5);
      }
    }

    // Render 2D entities
    if (this.simulation.resources) {
      for (const res of this.simulation.resources) {
        if (res.destroyed) continue;
        const screen = this.worldToScreen(res.x, res.y);
        this.render25DResource(res, screen, 20);
      }
    }
    if (this.simulation.buildings) {
      for (const b of this.simulation.buildings) {
        const screen = this.worldToScreen(b.x, b.y);
        this.render25DBuilding(b, screen, 20);
      }
    }
    if (this.simulation.agents) {
      for (const a of this.simulation.agents) {
        if (!a.alive) continue;
        const screen = this.worldToScreen(a.x, a.y);
        this.render25DAgent(a, screen, 20);
      }
    }
  }

  renderSettlementTerritories() {
    if (!this.simulation?.settlementSystem?.settlements) return;
    const ctx = this.ctx;
    for (const s of this.simulation.settlementSystem.settlements.values()) {
      if (!s.center) continue;
      const screen = this.worldToScreen(s.center.x, s.center.y);
      const rad = (s.radius || 8) * (this.camera.is25D ? this.camera.zoom * 1.4 : this.camera.zoom);

      ctx.save();
      ctx.strokeStyle = s.factionColor || "rgba(251, 191, 36, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
      ctx.stroke();

      // Settlement Name Crest
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      const txt = `🏰 ${s.name || "Settlement"} (Pop ${s.population || s.agents?.length || 0})`;
      const w = ctx.measureText(txt).width + 16;
      ctx.fillRect(screen.x - w / 2, screen.y - rad - 20, w, 22);
      ctx.strokeStyle = s.factionColor || "#f59e0b";
      ctx.strokeRect(screen.x - w / 2, screen.y - rad - 20, w, 22);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(txt, screen.x, screen.y - rad - 6);
      ctx.restore();
    }
  }

  renderDiplomacyLines() {
    if (!this.simulation?.diplomacySystem || !this.simulation?.settlementSystem) return;
    const relations = this.simulation.diplomacySystem.relations;
    const settlements = this.simulation.settlementSystem.settlements;
    if (!relations) return;

    for (const rel of relations.values()) {
      if (rel.status === "peace" && rel.score < 80) continue;
      const s1 = settlements.get(rel.settlementA);
      const s2 = settlements.get(rel.settlementB);
      if (!s1?.center || !s2?.center) continue;

      const p1 = this.worldToScreen(s1.center.x, s1.center.y);
      const p2 = this.worldToScreen(s2.center.x, s2.center.y);

      this.ctx.save();
      this.ctx.strokeStyle = rel.status === "war" ? "#ef4444" : "#22c55e";
      this.ctx.lineWidth = rel.status === "war" ? 2.5 : 1.5;
      this.ctx.setLineDash([8, 6]);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  renderCombatEffects() {
    if (!this.simulation?.warfareSystem?.combatEffects) return;
    const effects = this.simulation.warfareSystem.combatEffects;
    this.ctx.save();
    for (const eff of effects) {
      const screen = this.worldToScreen(eff.x, eff.y);
      this.ctx.font = `${Math.max(12, this.camera.zoom * 1.2)}px sans-serif`;
      this.ctx.textAlign = "center";
      this.ctx.fillText(eff.type === "clash" ? "⚔️" : "💀", screen.x, screen.y - 10);
    }
    this.ctx.restore();
  }

  renderHUD() {
    const sim = this.simulation;
    if (!sim) return;
    const ctx = this.ctx;
    const fires = this.world?.fireTiles ? this.world.countFires?.() || 0 : 0;
    const pop = sim.agents ? sim.agents.filter(a => a.alive).length : 0;
    const settlements = sim.settlementSystem ? sim.settlementSystem.settlements.size : 0;
    const era = sim.clock ? `Day ${Math.floor((sim.clock.tick || 0) / 100) + 1}` : "";
    const wars = sim.diplomacySystem?.wars ? sim.diplomacySystem.wars.length : 0;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1;

    const lines = [
      `${era} · Pop ${pop} · Realms ${settlements}`,
      `Wars ${wars} · Mode: ${this.camera.is25D ? "2.5D Isometric 3D" : "2D Top-Down"}${fires > 0 ? ` · 🔥 Fires ${fires}` : ""}`
    ];

    if (sim.chronicleSystem?.entries?.length > 0) {
      const last = sim.chronicleSystem.entries[sim.chronicleSystem.entries.length - 1];
      let txt = `${last.date}: ${last.text}`;
      if (txt.length > 44) txt = txt.slice(0, 43) + "…";
      lines.push(`📜 ${txt}`);
    }

    const boxW = 280;
    const boxH = lines.length * 18 + 14;
    ctx.beginPath();
    ctx.roundRect(12, 12, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 1 && wars > 0 ? "#fca5a5" : "#e2e8f0";
      ctx.fillText(line, 20, 30 + i * 18);
    });

    ctx.restore();
  }

  renderUI() {
    if (!this.selectedEntity) return;
    const e = this.selectedEntity.entity || this.selectedEntity;
    if (e && e.x !== undefined && e.y !== undefined) {
      const screen = this.worldToScreen(e.x, e.y);
      this.ctx.save();
      this.ctx.strokeStyle = "#38bdf8";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, Math.max(16, this.camera.zoom * 1.4), 0, Math.PI * 2);
      this.ctx.stroke();
      if (e.name) {
        this.ctx.fillStyle = "#38bdf8";
        this.ctx.font = "bold 12px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText(e.name, screen.x, screen.y - 24);
      }
      this.ctx.restore();
    }
  }
}
