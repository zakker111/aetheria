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
    const initX = world ? world.width / 2 : 64;
    const initY = world ? world.height / 2 : 64;
    this.camera = {
      x: initX,
      y: initY,
      targetX: initX,
      targetY: initY,
      zoom: 12,
      targetZoom: 12,
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
    this._pN = { x: 0, y: 0 };
    this._pE = { x: 0, y: 0 };
    this._pS = { x: 0, y: 0 };
    this._pW = { x: 0, y: 0 };
    this._pTmp = { x: 0, y: 0 };

    // Frame timing & sub-tick interpolation state
    this._tickAlpha = 1;
    this._lastActiveAlpha = 1;
    this._frameDtMs = 16.67;
    this._frameDtSec = 0.01667;
    this._simSpeed = 1;
    this._frameNow = Date.now();
    this._currentSimTick = 0;
    
    this.setupInput();
    this.setupEventListeners();
  }

  setFrameTiming(tickAlpha, frameDtMs, speed) {
    const clampedAlpha = tickAlpha < 0 ? 0 : tickAlpha > 1 ? 1 : tickAlpha;
    this._tickAlpha = clampedAlpha;
    if (speed > 0) this._lastActiveAlpha = clampedAlpha;
    const dt = frameDtMs > 0 ? Math.min(100, frameDtMs) : 16.67;
    this._frameDtMs = dt;
    this._frameDtSec = dt * 0.001;
    this._simSpeed = speed ?? 1;
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
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
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
    
    // Smooth zoom with wheel
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
      const baseZoom = this.camera.targetZoom ?? this.camera.zoom;
      this.camera.targetZoom = Math.max(3.5, Math.min(36, baseZoom * zoomFactor));
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

      // Step E: clicking the ⚔️ war banner jumps the camera to the front
      // line instead of inspecting/god-powering the tile underneath.
      const banner = this._warBannerRect;
      if (banner && screenX >= banner.x && screenX <= banner.x + banner.w &&
          screenY >= banner.y && screenY <= banner.y + banner.h && banner.frontLine) {
        this.centerOn(banner.frontLine.x, banner.frontLine.y, Math.max(this.camera.zoom, 14));
        return;
      }

      // Step F: clicking the [W]ars toggle row opens/closes the Wars panel…
      const tog = this._warsToggleRect;
      if (tog && screenX >= tog.x && screenX <= tog.x + tog.w &&
          screenY >= tog.y && screenY <= tog.y + tog.h) {
        this._warsPanel = !this._warsPanel;
        return;
      }
      // …and clicking a war row in the open panel jumps to its front line.
      for (const row of (this._warsPanelRows || [])) {
        if (screenX >= row.x && screenX <= row.x + row.w &&
            screenY >= row.y && screenY <= row.y + row.h && row.frontLine) {
          this.centerOn(row.frontLine.x, row.frontLine.y, Math.max(this.camera.zoom, 14));
          return;
        }
      }

      const worldPos = this.screenToWorld(screenX, screenY);
      
      // Dispatch custom event on window for god powers & tools
      window.dispatchEvent(new CustomEvent("worldclick", {
        detail: { x: worldPos.x, y: worldPos.y }
      }));
    });

    // Touch event handlers for tablets & mobile devices
    let touchDistance = 0;
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        touchDistance = 0;
      }
    }, { passive: true });

    this.canvas.addEventListener("touchmove", (e) => {
      if (isDragging && e.touches.length === 1) {
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dx = cx - lastX;
        const dy = cy - lastY;
        touchDistance += Math.hypot(dx, dy);

        if (this.camera.is25D) {
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

        this.camera.x = Math.max(-5, Math.min(this.world.width + 5, this.camera.x));
        this.camera.y = Math.max(-5, Math.min(this.world.height + 5, this.camera.y));
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
        lastX = cx;
        lastY = cy;
      }
    }, { passive: true });

    this.canvas.addEventListener("touchend", (e) => {
      isDragging = false;
      if (touchDistance < 8 && e.changedTouches.length === 1) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.changedTouches[0].clientX - rect.left;
        const screenY = e.changedTouches[0].clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        window.dispatchEvent(new CustomEvent("worldclick", {
          detail: { x: worldPos.x, y: worldPos.y }
        }));
      }
    }, { passive: true });
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
   * Fast, zero-allocation coordinate projection for high-frequency render loops.
   */
  worldToScreenFast(worldX, worldY, worldZ, out) {
    const centerX = this.canvas.width * 0.5;
    const centerY = this.canvas.height * 0.5;

    if (!this.camera.is25D) {
      out.x = centerX + (worldX - this.camera.x) * this.camera.zoom;
      out.y = centerY + (worldY - this.camera.y) * this.camera.zoom;
      return out;
    }

    const zoom = this.camera.zoom;
    const tileW = zoom * 2.8;
    const tileH = tileW * this.camera.tilt;
    const hScale = this.camera.heightScale;

    const elev = worldZ !== null ? worldZ : this.getInterpolatedElevation(worldX, worldY);
    const dx = worldX - this.camera.x;
    const dy = worldY - this.camera.y;

    out.x = centerX + (dx - dy) * (tileW * 0.5);
    out.y = centerY + (dx + dy) * (tileH * 0.5) - (elev - 20) * zoom * hScale * 0.22;
    return out;
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
   * Smooth 60 FPS Camera Damping
   * Smoothly eases camera position and zoom towards target coordinates
   */
  updateCameraSmoothly() {
    if (this.camera.targetX === undefined) this.camera.targetX = this.camera.x;
    if (this.camera.targetY === undefined) this.camera.targetY = this.camera.y;
    if (this.camera.targetZoom === undefined) this.camera.targetZoom = this.camera.zoom;

    const dtFactor = Math.min(3, (this._frameDtSec || 0.01667) * 60);
    const camEase = 1 - Math.pow(0.84, dtFactor);
    const zoomEase = 1 - Math.pow(0.82, dtFactor);

    const dx = this.camera.targetX - this.camera.x;
    const dy = this.camera.targetY - this.camera.y;
    const dz = this.camera.targetZoom - this.camera.zoom;

    if (Math.abs(dx) > 0.0005) this.camera.x += dx * camEase;
    else this.camera.x = this.camera.targetX;

    if (Math.abs(dy) > 0.0005) this.camera.y += dy * camEase;
    else this.camera.y = this.camera.targetY;

    if (Math.abs(dz) > 0.001) this.camera.zoom += dz * zoomEase;
    else this.camera.zoom = this.camera.targetZoom;
  }

  /**
   * Continuous Tick-to-Tick Linear Coordinate Interpolation (60/120 FPS visual smoothing)
   * Glides entities smoothly at constant velocity between simulation ticks without mutating state.
   */
  getEntityRenderCoords(entity) {
    if (!entity) return { x: 0, y: 0 };
    const tx = entity.x !== undefined ? entity.x : entity.centroidX;
    const ty = entity.y !== undefined ? entity.y : entity.centroidY;
    if (tx === undefined || ty === undefined) return { x: 0, y: 0 };

    let rc = entity._renderCoords;
    if (!rc) {
      rc = entity._renderCoords = { x: tx, y: ty };
    }

    const simTick = this._currentSimTick;
    if (entity._rx === undefined || entity._ry === undefined) {
      entity._rx = tx;
      entity._ry = ty;
      entity._fromX = tx;
      entity._fromY = ty;
      entity._animTick = simTick;
      rc.x = tx;
      rc.y = ty;
      return rc;
    }

    if (entity._animTick !== simTick) {
      const ddx = tx - entity._rx;
      const ddy = ty - entity._ry;
      if (ddx * ddx + ddy * ddy > 12.25) {
        // Snap for spawns or teleports (> 3.5 tiles)
        entity._fromX = tx;
        entity._fromY = ty;
        entity._rx = tx;
        entity._ry = ty;
      } else {
        entity._fromX = entity._rx;
        entity._fromY = entity._ry;
      }
      entity._animTick = simTick;
    } else if (this._simSpeed === 0) {
      const ddx = tx - entity._rx;
      const ddy = ty - entity._ry;
      if (ddx * ddx + ddy * ddy > 12.25) {
        entity._fromX = tx;
        entity._fromY = ty;
        entity._rx = tx;
        entity._ry = ty;
      }
    }

    const fx = entity._fromX;
    const fy = entity._fromY;
    if (fx !== tx || fy !== ty) {
      const alpha = this._simSpeed > 0 ? this._tickAlpha : this._lastActiveAlpha;
      entity._rx = fx + (tx - fx) * alpha;
      entity._ry = fy + (ty - fy) * alpha;
    } else {
      entity._rx = tx;
      entity._ry = ty;
    }

    rc.x = entity._rx;
    rc.y = entity._ry;
    return rc;
  }

  /**
   * Main Render Pipeline
   */
  render() {
    this._frameNow = Date.now();
    this._currentSimTick = this.simulation?.clock?.tick ?? 0;

    // 0. Smooth Camera Interpolation
    this.updateCameraSmoothly();

    // 1. Sky & Atmospheric Backdrop
    this.renderSkyAndBackdrop();

    if (this.camera.is25D) {
      this.render25DScene();
    } else {
      this.render2DScene();
    }

    // 2. Weather & Floating High-Altitude Clouds
    this.renderClouds();
    this.renderWeather();

    // 3. Dynamic Day/Night Ambient Tint Overlay
    this.renderDayNightLighting();

    // 4. God Power Visual Particles & Combat Animations
    this.renderVisualEffects();

    // 5. Selected Entity Focus Reticle
    this.renderUI();
  }

  _lerpColor(c1, c2, t) {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  renderSkyAndBackdrop() {
    const time = this.simulation?.clock?.getTime() || { hours: 12 };
    const h = time.hours;
    
    // Four sky keyframe palettes across 24 hours (Midnight, Dawn, Noon, Dusk)
    const palettes = [
      { h: 0,  top: [2, 6, 23],    btm: [15, 23, 42] },   // Deep Midnight
      { h: 6,  top: [49, 16, 63],   btm: [120, 53, 15] },  // Dawn Amber-Rose
      { h: 12, top: [2, 132, 199],  btm: [56, 189, 248] }, // Midday Cerulean
      { h: 18, top: [30, 27, 75],   btm: [154, 52, 18] },  // Sunset Flame-Violet
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

    const topColor = this._lerpColor(p1.top, p2.top, t);
    const btmColor = this._lerpColor(p1.btm, p2.btm, t);

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

    // Keep simulation informed of current camera viewport for Spatial LOD classification
    if (this.simulation) {
      if (typeof this.simulation.setViewportBounds === "function") {
        this.simulation.setViewportBounds({ minX, maxX, minY, maxY, zoom: this.camera.zoom });
      }
      this.simulation.selectedEntityId = this.selectedEntity ? this.selectedEntity.id : null;
    }

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
    const now = this._frameNow;
    const w = world.width;
    const centerX = this.canvas.width * 0.5;
    const centerY = this.canvas.height * 0.5;
    const tileW = zoom * 2.8;
    const halfW = tileW * 0.5;
    const halfH = halfW * this.camera.tilt;
    const hFactor = zoom * this.camera.heightScale * 0.22;
    const camX = this.camera.x;
    const camY = this.camera.y;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * w + x;
        const biome = world.biome ? world.biome[idx] : null;
        const riverFlow = world.riverFlow ? world.riverFlow[idx] : 0;
        const isOceanLake = biome === 'water';
        const hasRiver = riverFlow > 0.28 && !isOceanLake;

        if (!isOceanLake && !hasRiver) continue;

        const elev = isOceanLake ? 14 : this.getTileElevation(x, y);
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

        // Shimmering animated water surface
        const shimmer = 0.5 + 0.3 * Math.sin(now * 0.003 + x * 1.5 + y * 2.1);
        if (isOceanLake) {
          const isFlowingChannel = riverFlow >= 0.45;
          ctx.fillStyle = isFlowingChannel
            ? `rgba(24, 144, 210, ${0.72 + 0.12 * shimmer})`
            : `rgba(14, 116, 184, ${0.72 + 0.1 * shimmer})`;
          ctx.fill();

          // Gentle white water foam crest / flowing river ripple at zoom
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
          // Flowing mountain river / valley stream
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
   * 2.5D Roads, desire-paths, bridges, and burning ground
   */
  render25DRoadsAndBridges(minX, maxX, minY, maxY) {
    const world = this.world;
    if (!world) return;
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const w = world.width;
    const now = this._frameNow;
    const pN = this._pN, pE = this._pE, pS = this._pS, pW = this._pW, pTmp = this._pTmp;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * w + x;
        const isBridge = Boolean(world.bridgeTiles && world.bridgeTiles[idx]);
        const isRoad = Boolean(world.roadTiles && world.roadTiles[idx]);
        const isFire = Boolean(world.fireTiles && world.fireTiles[idx] > 0);
        const isScorched = Boolean(world.scorchedTiles && world.scorchedTiles[idx] > 0);
        if (!isBridge && !isRoad && !isFire && !isScorched) continue;

        const elev = this.getTileElevation(x, y);

        // Scorched Earth in 2.5D
        if (isScorched) {
          this.worldToScreenFast(x, y, elev, pN);
          this.worldToScreenFast(x + 1, y, elev, pE);
          this.worldToScreenFast(x + 1, y + 1, elev, pS);
          this.worldToScreenFast(x, y + 1, elev, pW);

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

        // Bridges spanning water
        if (isBridge) {
          this.worldToScreenFast(x, y, elev + 2, pN);
          this.worldToScreenFast(x + 1, y, elev + 2, pE);
          this.worldToScreenFast(x + 1, y + 1, elev + 2, pS);
          this.worldToScreenFast(x, y + 1, elev + 2, pW);

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
        else if (isRoad) {
          this.worldToScreenFast(x + 0.15, y + 0.15, elev, pN);
          this.worldToScreenFast(x + 0.85, y + 0.15, elev, pE);
          this.worldToScreenFast(x + 0.85, y + 0.85, elev, pS);
          this.worldToScreenFast(x + 0.15, y + 0.85, elev, pW);

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
        if (isFire) {
          this.worldToScreenFast(x + 0.5, y + 0.5, elev, pTmp);
          const flicker = 0.6 + 0.4 * Math.sin(now * 0.015 + x * 3.1 + y * 4.7);
          const fs = Math.max(4, zoom * 0.9 * flicker);

          // Charred base
          ctx.fillStyle = "rgba(40, 10, 0, 0.65)";
          ctx.beginPath();
          ctx.ellipse(pTmp.x, pTmp.y, fs * 0.6, fs * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Core flame
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

    // 3. Wildlife / Animals (Smooth 60 FPS interpolated motion with viewport culling)
    const animals = this.simulation.animalSystem?.animals;
    if (animals) {
      const aLen = animals.length;
      for (let i = 0; i < aLen; i++) {
        const a = animals[i];
        if (a.alive === false) continue;
        if (a.x < minX - 3 || a.x > maxX + 3 || a.y < minY - 3 || a.y > maxY + 3) {
          if (a._rx !== undefined) {
            a._rx = a.x; a._ry = a.y;
            a._fromX = a.x; a._fromY = a.y;
            a._animTick = this._currentSimTick;
          }
          continue;
        }
        const coords = this.getEntityRenderCoords(a);
        if (coords.x >= minX - 1 && coords.x <= maxX + 1 && coords.y >= minY - 1 && coords.y <= maxY + 1) {
          list.push(this.getRenderItem("animal", a, coords.x, coords.y, coords.x + coords.y + 0.2));
        }
      }
    }

    // 4. Autonomous Agents / Citizens (Smooth 60 FPS interpolated motion with viewport culling)
    const agents = this.simulation.agents;
    if (agents) {
      const agLen = agents.length;
      for (let i = 0; i < agLen; i++) {
        const ag = agents[i];
        if (!ag.alive) continue;
        if (ag.x < minX - 3 || ag.x > maxX + 3 || ag.y < minY - 3 || ag.y > maxY + 3) {
          if (ag._rx !== undefined) {
            ag._rx = ag.x; ag._ry = ag.y;
            ag._fromX = ag.x; ag._fromY = ag.y;
            ag._animTick = this._currentSimTick;
          }
          continue;
        }
        const coords = this.getEntityRenderCoords(ag);
        if (coords.x >= minX - 1 && coords.x <= maxX + 1 && coords.y >= minY - 1 && coords.y <= maxY + 1) {
          list.push(this.getRenderItem("agent", ag, coords.x, coords.y, coords.x + coords.y + 0.3));
        }
      }
    }

    // 4b. Coastal/River Vessels (Fishing Boats, River Barges, Raid Longboats)
    const vessels = this.simulation.navalSystem?.vessels;
    if (vessels && vessels.length > 0) {
      for (let i = 0; i < vessels.length; i++) {
        const v = vessels[i];
        if (v.x < minX - 3 || v.x > maxX + 3 || v.y < minY - 3 || v.y > maxY + 3) {
          if (v._rx !== undefined) {
            v._rx = v.x; v._ry = v.y;
            v._fromX = v.x; v._fromY = v.y;
            v._animTick = this._currentSimTick;
          }
          continue;
        }
        const coords = this.getEntityRenderCoords(v);
        if (coords.x >= minX - 1 && coords.x <= maxX + 1 && coords.y >= minY - 1 && coords.y <= maxY + 1) {
          list.push(this.getRenderItem("vessel", v, coords.x, coords.y, coords.x + coords.y + 0.25));
        }
      }
    }

    // Sort by depth (x + y) so back objects draw first and front objects occlude them
    list.sort((a, b) => a.depth - b.depth);

    // Render sorted list
    const len = list.length;
    const screen = this._renderScreenBuf || (this._renderScreenBuf = { x: 0, y: 0 });
    for (let i = 0; i < len; i++) {
      const item = list[i];
      const elev = this.getInterpolatedElevation(item.x, item.y);
      this.worldToScreenFast(item.x, item.y, elev, screen);

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
        case "vessel":
          this.render25DVessel(item.entity, screen, elev);
          break;
        case "agent":
          this.render25DAgent(item.entity, screen, elev);
          break;
      }
    }

    // Active Combat Clashes on top
    this.renderWarbandMarkers();
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
    const isDepleted = res.depleted || res.amount <= 0;
    const fullness = Math.max(0, Math.min(1, (res.amount || 0) / (res.maxAmount || 40)));
    const s = Math.max(3, zoom * 0.7);

    ctx.save();

    // Soft drop shadow at ground height
    ctx.fillStyle = isDepleted ? "rgba(0, 0, 0, 0.16)" : "rgba(0, 0, 0, 0.26)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 2, s * 0.65, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (type === "wood") {
      // 2.5D Tree with 3D Trunk & Volumetric Foliage Canopy / Stumps
      if (isDepleted) {
        // Cut timber stump with growth rings & fallen chips
        ctx.fillStyle = "#5c2c16";
        ctx.fillRect(screen.x - s * 0.22, screen.y - s * 0.3, s * 0.44, s * 0.3);
        ctx.fillStyle = "#a16207";
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - s * 0.3, s * 0.24, s * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner stump rings
        ctx.strokeStyle = "#713f12";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - s * 0.3, s * 0.14, s * 0.06, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Wood chips on ground
        ctx.fillStyle = "#ca8a04";
        ctx.fillRect(screen.x + s * 0.25, screen.y - s * 0.05, s * 0.08, s * 0.05);
        ctx.fillRect(screen.x - s * 0.32, screen.y + s * 0.05, s * 0.07, s * 0.04);
      } else {
        // Wooden Trunk with bark shading
        ctx.fillStyle = "#5c2c16";
        ctx.fillRect(screen.x - s * 0.15, screen.y - s * 0.6, s * 0.3, s * 0.65);

        // Scale canopy fullness with remaining harvestable wood (0.45 min to 1.0 full)
        const canopyScale = 0.45 + 0.55 * fullness;

        // Lower Canopy Shadow
        ctx.fillStyle = "#14532d";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 0.8 * canopyScale, s * 0.7 * canopyScale, 0, Math.PI * 2);
        ctx.fill();

        // Upper Canopy Lush Green
        ctx.fillStyle = "#16a34a";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - s * 1.15 * canopyScale, s * 0.58 * canopyScale, 0, Math.PI * 2);
        ctx.fill();

        // Sunlit Leaf Highlight
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.arc(screen.x - s * 0.2 * canopyScale, screen.y - s * 1.3 * canopyScale, s * 0.26 * canopyScale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "food") {
      // 2.5D Berry Bush / Fruit Orchard / Fallow Patch
      if (isDepleted) {
        // Fallow barren patch: dry brown twigs and withered stems
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

        // Red Berries proportional to fullness
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
    } else if (type === "ore" || type === "gem") {
      // 2.5D Craggy Boulder / Spent Seam / Crystal Vein
      const isGem = type === "gem";
      if (isDepleted) {
        // Spent excavated seam: fractured pit and dark tailings
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.moveTo(screen.x - s * 0.45, screen.y);
        ctx.lineTo(screen.x - s * 0.3, screen.y - s * 0.3);
        ctx.lineTo(screen.x + s * 0.25, screen.y - s * 0.32);
        ctx.lineTo(screen.x + s * 0.45, screen.y - s * 0.05);
        ctx.lineTo(screen.x + s * 0.2, screen.y + s * 0.08);
        ctx.closePath();
        ctx.fill();
        // Dark pit crack
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(screen.x - s * 0.2, screen.y - s * 0.15);
        ctx.lineTo(screen.x + s * 0.1, screen.y - s * 0.1);
        ctx.lineTo(screen.x + s * 0.2, screen.y - s * 0.2);
        ctx.stroke();
      } else {
        ctx.fillStyle = isGem ? "#2e1065" : "#334155";
        ctx.beginPath();
        ctx.moveTo(screen.x - s * 0.5, screen.y);
        ctx.lineTo(screen.x - s * 0.35, screen.y - s * 0.6);
        ctx.lineTo(screen.x + s * 0.15, screen.y - s * 0.7);
        ctx.lineTo(screen.x + s * 0.55, screen.y - s * 0.2);
        ctx.lineTo(screen.x + s * 0.3, screen.y + s * 0.1);
        ctx.closePath();
        ctx.fill();

        // Rock facet light catch
        ctx.fillStyle = isGem ? "#581c87" : "#64748b";
        ctx.beginPath();
        ctx.moveTo(screen.x - s * 0.35, screen.y - s * 0.6);
        ctx.lineTo(screen.x + s * 0.15, screen.y - s * 0.7);
        ctx.lineTo(screen.x + s * 0.05, screen.y - s * 0.25);
        ctx.lineTo(screen.x - s * 0.25, screen.y - s * 0.15);
        ctx.closePath();
        ctx.fill();

        if (isGem) {
          // Purple/cyan gem crystals
          ctx.fillStyle = "#c084fc";
          ctx.fillRect(screen.x - s * 0.12, screen.y - s * 0.48, s * 0.16, s * 0.16);
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(screen.x + s * 0.14, screen.y - s * 0.52, s * 0.14, s * 0.14);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(screen.x - s * 0.07, screen.y - s * 0.45, s * 0.06, s * 0.06);
        } else {
          // Gold / iron ore glints
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
      // Water Spring Font / Dried Spring Bed
      if (isDepleted) {
        // Cracked dry mud basin
        ctx.fillStyle = "#78350f";
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - s * 0.1, s * 0.48, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#451a03";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Cracked mud fissures
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
        // Deep blue water spring with concentric ripple rings
        const waterR = s * (0.32 + 0.18 * fullness);
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - s * 0.1, waterR, waterR * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Shimmer specular highlight
        ctx.fillStyle = "#e0f2fe";
        ctx.beginPath();
        ctx.ellipse(screen.x - waterR * 0.25, screen.y - s * 0.14, waterR * 0.25, waterR * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
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
    const now = this._frameNow;

    ctx.save();

    // 1. Soft Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + bs * 0.15, bs * 0.8, bs * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const isRuined = Boolean(b.isRuined || (b.health !== undefined && b.health <= 0) || type === "ruin");

    if (isRuined) {
      // 2.5D Smoldering Ruin: Broken stone foundations, collapsed charred rafters, glowing embers & smoke
      const wallH = bs * 0.45;

      // Scorched foundation floor
      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.55, screen.y);
      ctx.lineTo(screen.x, screen.y + bs * 0.28);
      ctx.lineTo(screen.x + bs * 0.55, screen.y);
      ctx.lineTo(screen.x, screen.y - bs * 0.28);
      ctx.closePath();
      ctx.fill();

      // Broken crumbling stone corner pillars
      ctx.fillStyle = "#475569";
      ctx.fillRect(screen.x - bs * 0.48, screen.y - wallH * 0.8, bs * 0.16, wallH * 0.8);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(screen.x + bs * 0.32, screen.y - wallH * 0.5, bs * 0.16, wallH * 0.5);

      // Collapsed, charred timber beam leaning across
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = Math.max(2, bs * 0.12);
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.45, screen.y - wallH * 0.7);
      ctx.lineTo(screen.x + bs * 0.2, screen.y + bs * 0.1);
      ctx.stroke();

      // Second charred diagonal rafter
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = Math.max(1.5, bs * 0.08);
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.1, screen.y - wallH * 0.5);
      ctx.lineTo(screen.x + bs * 0.4, screen.y - bs * 0.05);
      ctx.stroke();

      // Smoldering ember glow
      const emberFlicker = 0.5 + 0.5 * Math.sin(now * 0.01 + (b.id || 0));
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + emberFlicker * 0.5})`;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - wallH * 0.1, Math.max(2, bs * 0.15), 0, Math.PI * 2);
      ctx.fill();

      // Rising faint smoke puff
      const smokeOffset = ((now * 0.002 + (b.id || 0) * 0.3) % 1);
      ctx.fillStyle = `rgba(100, 100, 100, ${0.35 * (1 - smokeOffset)})`;
      ctx.beginPath();
      ctx.arc(screen.x + Math.sin(now * 0.004) * 3, screen.y - wallH - smokeOffset * 14, 2 + smokeOffset * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

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

    } else if (type === "dock") {
      // 2.5D Harbor Pier & Mooring Dock extending onto coastline/riverbank
      const deckH = bs * 0.35;

      // Timber support pilings submerged at water edge
      ctx.fillStyle = "#451a03";
      ctx.fillRect(screen.x - bs * 0.5, screen.y - deckH, bs * 0.14, deckH + bs * 0.25);
      ctx.fillRect(screen.x - bs * 0.08, screen.y - deckH + bs * 0.08, bs * 0.14, deckH + bs * 0.25);
      ctx.fillRect(screen.x + bs * 0.36, screen.y - deckH, bs * 0.14, deckH + bs * 0.25);

      // Isometric timber plank platform
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.62, screen.y - deckH);
      ctx.lineTo(screen.x, screen.y + bs * 0.3 - deckH);
      ctx.lineTo(screen.x + bs * 0.62, screen.y - deckH);
      ctx.lineTo(screen.x, screen.y - bs * 0.3 - deckH);
      ctx.closePath();
      ctx.fill();

      // Sunlit plank highlight seams
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.38, screen.y - deckH);
      ctx.lineTo(screen.x + bs * 0.24, screen.y - deckH + bs * 0.14);
      ctx.moveTo(screen.x - bs * 0.24, screen.y - deckH - bs * 0.14);
      ctx.lineTo(screen.x + bs * 0.38, screen.y - deckH);
      ctx.stroke();

      // Harbor mooring post + glowing lantern
      ctx.fillStyle = "#78350f";
      ctx.fillRect(screen.x + bs * 0.32, screen.y - deckH - bs * 0.45, bs * 0.12, bs * 0.48);
      const lanternPulse = 0.75 + 0.25 * Math.sin(now * 0.008 + (b.id || 0));
      ctx.fillStyle = `rgba(251, 191, 36, ${lanternPulse})`;
      ctx.beginPath();
      ctx.arc(screen.x + bs * 0.38, screen.y - deckH - bs * 0.48, Math.max(2.2, bs * 0.14), 0, Math.PI * 2);
      ctx.fill();

      // Trade barrel & rope coil
      ctx.fillStyle = "#713f12";
      ctx.fillRect(screen.x - bs * 0.32, screen.y - deckH - bs * 0.22, bs * 0.2, bs * 0.24);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(screen.x - bs * 0.32, screen.y - deckH - bs * 0.14, bs * 0.2, bs * 0.05);

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

    } else if (type === "monument_pyramid") {
      // 2.5D Majestic Step Pyramid / Great Sun Shrine
      const pW = bs * 1.5;
      const t1H = bs * 0.4;
      const t2H = bs * 0.35;
      const t3H = bs * 0.3;

      // Tier 1 Base
      ctx.fillStyle = "#92400e";
      ctx.fillRect(screen.x - pW * 0.5, screen.y - t1H, pW, t1H);
      ctx.fillStyle = "#b45309";
      ctx.fillRect(screen.x - pW * 0.48, screen.y - t1H, pW * 0.96, t1H * 0.4);

      // Tier 2 Middle
      const t2W = pW * 0.72;
      const t2Y = screen.y - t1H;
      ctx.fillStyle = "#d97706";
      ctx.fillRect(screen.x - t2W * 0.5, t2Y - t2H, t2W, t2H);

      // Tier 3 Top
      const t3W = pW * 0.45;
      const t3Y = t2Y - t2H;
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(screen.x - t3W * 0.5, t3Y - t3H, t3W, t3H);

      // Central Grand Stairway
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.moveTo(screen.x - bs * 0.12, t3Y - t3H);
      ctx.lineTo(screen.x + bs * 0.12, t3Y - t3H);
      ctx.lineTo(screen.x + bs * 0.22, screen.y);
      ctx.lineTo(screen.x - bs * 0.22, screen.y);
      ctx.closePath();
      ctx.fill();

      // Radiant Golden Sun Capstone
      const apexY = t3Y - t3H;
      const glow = Math.sin(now * 0.008) * 3;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.moveTo(screen.x, apexY - bs * 0.35);
      ctx.lineTo(screen.x - bs * 0.2, apexY);
      ctx.lineTo(screen.x + bs * 0.2, apexY);
      ctx.closePath();
      ctx.fill();

      // Sun halo aura
      const sunGrad = ctx.createRadialGradient(screen.x, apexY - bs * 0.2, 2, screen.x, apexY - bs * 0.2, bs * 0.7 + glow);
      sunGrad.addColorStop(0, "rgba(253, 224, 71, 0.7)");
      sunGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.3)");
      sunGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(screen.x, apexY - bs * 0.2, bs * 0.7 + glow, 0, Math.PI * 2);
      ctx.fill();

    } else if (type === "monument_colosseum") {
      // 2.5D Grand Roman Amphitheater / Colosseum of Champions
      const cW = bs * 1.5;
      const cH = bs * 0.95;

      // Outer Marble Elliptical Arena Wall
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(screen.x - cW * 0.5, screen.y - cH, cW, cH);

      // Travertine stone cornice
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(screen.x - cW * 0.53, screen.y - cH, cW * 1.06, bs * 0.12);

      // Roman Arches along the facade
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

      // Sandy Inner Arena Pit with Golden Glow
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - cH * 0.1, bs * 0.38, bs * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Flanking Crimson Imperial Standards
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
      // 2.5D Sky-Piercing Celestial Obelisk / Monolith
      const oW = bs * 0.55;
      const oH = bs * 1.8;

      // Tiered Obsidian Foundation
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(screen.x - bs * 0.5, screen.y - bs * 0.2, bs * 1.0, bs * 0.2);
      ctx.fillStyle = "#334155";
      ctx.fillRect(screen.x - bs * 0.38, screen.y - bs * 0.32, bs * 0.76, bs * 0.12);

      // Tapering Basalt Shaft
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(screen.x - oW * 0.5, screen.y - bs * 0.32);
      ctx.lineTo(screen.x - oW * 0.25, screen.y - oH);
      ctx.lineTo(screen.x + oW * 0.25, screen.y - oH);
      ctx.lineTo(screen.x + oW * 0.5, screen.y - bs * 0.32);
      ctx.closePath();
      ctx.fill();

      // Highlight bevel edge
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - bs * 0.32);
      ctx.lineTo(screen.x, screen.y - oH);
      ctx.stroke();

      // Glowing Cyan Celestial Runes
      const runePulse = 0.5 + 0.5 * Math.sin(now * 0.009);
      ctx.fillStyle = `rgba(56, 189, 248, ${0.4 + 0.5 * runePulse})`;
      for (let rY = screen.y - bs * 0.5; rY > screen.y - oH + bs * 0.2; rY -= bs * 0.25) {
        ctx.fillRect(screen.x - 2, rY, 4, bs * 0.12);
      }

      // Apex Pyramidion
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(screen.x - oW * 0.25, screen.y - oH);
      ctx.lineTo(screen.x, screen.y - oH - bs * 0.3);
      ctx.lineTo(screen.x + oW * 0.25, screen.y - oH);
      ctx.closePath();
      ctx.fill();

      // Levitating Pulsing Celestial Energy Orb
      const orbPulse = Math.sin(now * 0.008) * 3;
      const orbGrad = ctx.createRadialGradient(screen.x, screen.y - oH - bs * 0.45 + orbPulse, 2, screen.x, screen.y - oH - bs * 0.45 + orbPulse, bs * 0.4);
      orbGrad.addColorStop(0, "#ffffff");
      orbGrad.addColorStop(0.3, "#38bdf8");
      orbGrad.addColorStop(0.8, "rgba(56, 189, 248, 0.4)");
      orbGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - oH - bs * 0.45 + orbPulse, bs * 0.4, 0, Math.PI * 2);
      ctx.fill();

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
    const now = this._frameNow;
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
    const s = Math.max(2, zoom * 0.42);

    ctx.save();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 1, s * 0.8, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    const aFromX = a._fromX ?? a.x;
    const aFromY = a._fromY ?? a.y;
    const aMoveX = a.x - aFromX;
    const aMoveY = a.y - aFromY;
    const aMoveSq = aMoveX * aMoveX + aMoveY * aMoveY;
    const now = this._frameNow;

    if (aMoveSq > 0.0001) {
      a._movingHoldUntil = now + 140;
      const screenDx = aMoveX - aMoveY;
      if (Math.abs(screenDx) > 0.002) {
        a._facing = screenDx < 0 ? -1 : 1;
      }
    }
    const isAnimalMoving = this._simSpeed > 0 && now < (a._movingHoldUntil || 0);
    if (this._simSpeed > 0) {
      const rate = isAnimalMoving ? 9.5 * Math.min(2.2, Math.max(0.85, this._simSpeed)) : 2.0;
      a._animCycle = (a._animCycle || 0) + this._frameDtSec * rate;
    }
    const hop = isAnimalMoving ? Math.abs(Math.sin(a._animCycle || 0)) * -2.2 : Math.sin(a._animCycle || 0) * 0.5;

    if ((a._facing || 1) === -1) {
      ctx.translate(screen.x, screen.y);
      ctx.scale(-1, 1);
      ctx.translate(-screen.x, -screen.y);
    }

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
   * 2.5D Naval Vessels:
   * Fishing Boats (small sail + catch basket), River Barges (wide cargo hull + town banner),
   * and Amphibious Raid Longboats (shielded gunwales + crimson war sail).
   */
  render25DVessel(v, screen, elev) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = this._frameNow;
    const s = Math.max(4, zoom * 0.56);
    const bob = Math.sin(now * 0.006 + (v.id || 0) * 1.7) * 1.6;
    const facing = v.facing || 1;

    ctx.save();

    // Animated water wake ripple beneath hull
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
      // 2.5D Dragon-Prowed Raid Longboat with gunwale shields & crimson war sail
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

      // Row of round Viking/warband shields along side
      const shieldColors = ["#dc2626", "#f59e0b", "#cbd5e1", "#dc2626"];
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = shieldColors[k];
        ctx.beginPath();
        ctx.arc(screen.x - s * 0.55 + k * s * 0.36, vy + s * 0.08, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mast & Striped Crimson War Sail
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
      // 2.5D Heavy River Trade Barge with cargo hold & settlement pennant
      const vy = screen.y - s * 0.22 + bob;
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 1.0, vy - s * 0.1);
      ctx.lineTo(screen.x - s * 0.78, vy + s * 0.34);
      ctx.lineTo(screen.x + s * 0.78, vy + s * 0.34);
      ctx.lineTo(screen.x + s * 1.0, vy - s * 0.1);
      ctx.closePath();
      ctx.fill();

      // Cargo crates & grain sacks aboard deck
      ctx.fillStyle = "#d97706";
      ctx.fillRect(screen.x - s * 0.52, vy - s * 0.38, s * 0.42, s * 0.32);
      ctx.fillStyle = "#eab308";
      ctx.fillRect(screen.x + s * 0.02, vy - s * 0.32, s * 0.38, s * 0.26);

      // Mast & Trade Banner Sail
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
      // 2.5D Nimble Fishing Boat with off-white lateen sail & catch net
      const vy = screen.y - s * 0.2 + bob;
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.moveTo(screen.x - s * 0.75, vy - s * 0.08);
      ctx.lineTo(screen.x - s * 0.52, vy + s * 0.26);
      ctx.lineTo(screen.x + s * 0.52, vy + s * 0.26);
      ctx.lineTo(screen.x + s * 0.78, vy - s * 0.08);
      ctx.closePath();
      ctx.fill();

      // Mast & Triangular Sail
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

  /**
   * 2.5D Humanoid Character Graphics:
   * Citizens, Warriors, Builders, Priests with custom outfits, animated walking legs,
   * swinging tools (axes, pickaxes, hammers), shields, and action thought bubbles!
   */
  render25DAgent(agent, screen, elev) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = this._frameNow;
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

    const fromX = agent._fromX ?? agent.x;
    const fromY = agent._fromY ?? agent.y;
    const stepDx = agent.x - fromX;
    const stepDy = agent.y - fromY;
    const stepSq = stepDx * stepDx + stepDy * stepDy;
    const hasPath = Boolean(agent.path && agent.path.length > 0);
    const actType = typeof agent.currentAction === 'string' ? agent.currentAction : agent.currentAction?.type;

    if (stepSq > 0.0001) {
      agent._movingHoldUntil = now + 150;
      const screenDx = stepDx - stepDy;
      if (Math.abs(screenDx) > 0.002) {
        agent._facing = screenDx < 0 ? -1 : 1;
      }
    } else if (hasPath) {
      agent._movingHoldUntil = now + 100;
    }

    const isMoving = this._simSpeed > 0 && (now < (agent._movingHoldUntil || 0) || hasPath);

    if (isMoving) {
      const walkRate = 9.5 * Math.min(2.4, Math.max(0.85, this._simSpeed || 1));
      agent._walkCycle = (agent._walkCycle || 0) + this._frameDtSec * walkRate;
    } else if (this._simSpeed > 0 && agent._walkCycle) {
      const mod = agent._walkCycle % (Math.PI * 2);
      if (mod > 0.18 && mod < Math.PI * 2 - 0.18) {
        agent._walkCycle += this._frameDtSec * 10;
      } else {
        agent._walkCycle = 0;
      }
    }

    const walk = Math.sin(agent._walkCycle || 0);
    const isWounded = Boolean(agent.wounded);
    const limpBob = isWounded ? Math.sin(now * 0.01 + (agent.id || 0)) * 2.2 : 0;
    const headBob = (isMoving ? Math.abs(walk) * -1.8 : 0) + limpBob;

    const facing = agent._facing || 1;
    if (facing === -1) {
      ctx.translate(screen.x, screen.y);
      ctx.scale(-1, 1);
      ctx.translate(-screen.x, -screen.y);
    }

    // 3. Legs (hidden inside hull when embarked on a raid vessel)
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

    // 4. Role Tunic Body
    let tunicColor = "#fbbf24";
    if (agent.militaryDuty || agent.job === "soldier") tunicColor = "#dc2626";
    else if (agent.role === "priest" || agent.job === "priest") tunicColor = "#f59e0b";
    else if (agent.role === "builder" || agent.job === "builder") tunicColor = "#b45309";
    else if (agent.role === "lumberjack" || agent.job === "lumberjack") tunicColor = "#15803d";
    else if (agent.role === "miner" || agent.job === "miner") tunicColor = "#475569";
    else if (agent.role === "farmer" || agent.job === "farmer") tunicColor = "#84cc16";

    // Hit flash visual feedback
    if (agent.visuals && agent.visuals.flashRed > 0) {
      agent.visuals.flashRed--;
      tunicColor = "#f87171";
    }

    ctx.fillStyle = tunicColor;
    ctx.beginPath();
    ctx.roundRect(screen.x - s * 0.35, screen.y - s * 1.25 + headBob, s * 0.7, s * 0.75, 3);
    ctx.fill();

    // Belt
    ctx.fillStyle = "#451a03";
    ctx.fillRect(screen.x - s * 0.35, screen.y - s * 0.75 + headBob, s * 0.7, 2);

    // Wounded white bandage with red cross on arm
    if (isWounded) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(screen.x + s * 0.1, screen.y - s * 1.05 + headBob, 4.5, 3.5);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(screen.x + s * 0.1 + 1.5, screen.y - s * 1.05, 1.5, 3.5);
      ctx.fillRect(screen.x + s * 0.1, screen.y - s * 1.05 + 1, 4.5, 1.5);
    }

    // 5. Head
    ctx.fillStyle = "#fed7aa"; // skin tone
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - s * 1.5 + headBob, s * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Hat / Helmet / Royal Crown
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
      // Tactical Helmet (modern steel/olive for rifles/artillery, iron with plume for classic)
      const wt = agent.combat?.weaponType;
      const isModern = wt === "rifle" || wt === "artillery" || wt === "musket" || wt === "cannon";
      ctx.fillStyle = wt === "rifle" || wt === "artillery" ? "#334155" : "#94a3b8";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - s * 1.62 + headBob, s * 0.36, Math.PI, 0);
      ctx.fill();
      if (!isModern) {
        ctx.fillStyle = agent.isRebel ? "#f59e0b" : "#ef4444";
        ctx.fillRect(screen.x - 1, screen.y - s * 2.05 + headBob, 3, 5);
      }
    } else if (agent.job === "farmer") {
      // Straw Hat
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y - s * 1.7 + headBob, s * 0.55, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead Combat Health Bar (smoothly rendered when damaged or in warband)
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

    // 6. Tools & Weapons in Hand
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
      const wt = agent.combat?.weaponType;
      if (wt === "cannon" || wt === "artillery") {
        // Wheeled Field Artillery Barrel
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(screen.x + s * 0.25, screen.y - s * 1.0 + headBob, s * 0.75, 4);
        ctx.fillStyle = "#78350f";
        ctx.beginPath();
        ctx.arc(screen.x + s * 0.35, screen.y - s * 0.7 + headBob, s * 0.24, 0, Math.PI * 2);
        ctx.fill();
      } else if (wt === "rifle" || wt === "musket") {
        // Long Barrel Rifle / Musket
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
        // Sword & Shield
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
    }

    // 7. Thought / Emotion Bubble
    if (actType === "reproduce") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "❤️", facing);
    } else if (actType === "gather_at_hearth") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🔥", facing);
    } else if (actType === "visit_market") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🛍️", facing);
    } else if (actType === "pray_at_temple") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🙏", facing);
    } else if (actType === "watch_crafts") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🔨", facing);
    } else if (actType === "train_at_barracks" || actType === "patrol_settlement") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🛡️", facing);
    } else if (actType === "play_in_town") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🪁", facing);
    } else if (actType === "fetch_town_water") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🪣", facing);
    } else if (actType === "tend_town_farm" || actType === "farm" || actType === "gather_food") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🌾", facing);
    } else if (actType === "deposit_to_stockpile") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "📦", facing);
    } else if (actType === "eat_from_stockpile" || actType === "eat_from_inventory") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "🍞", facing);
    } else if (actType === "visit_neighbor" || actType === "socialize") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "💬", facing);
    } else if (actType === "combat") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "⚔️", facing);
    } else if (actType === "rest" || actType === "go_home_and_rest") {
      this.drawThoughtIcon(screen.x, screen.y - s * 2.2, "💤", facing);
    }

    ctx.restore();
  }

  drawThoughtIcon(x, y, icon, facing = 1) {
    const floatBob = Math.sin(this._frameNow * 0.005 + x) * 2.2;
    const ctx = this.ctx;
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
    const dtFactor = Math.min(3, (this._frameDtSec || 0.01667) * 60);
    const screen = this._pN;
    const ground = this._pE;
    for (const c of this.clouds) {
      c.x += c.speed * dtFactor;
      if (c.x > this.world.width + 30) c.x = -30;

      this.worldToScreenFast(c.x, c.y, 120, screen);
      this.worldToScreenFast(c.x, c.y, 25, ground);

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
   * Dynamic Weather FX: Rain streaks, thunder flashes, arid drought shimmer
   */
  renderWeather() {
    const ws = this.simulation?.weatherSystem;
    if (!ws) return;
    const ctx = this.ctx;
    const now = this._frameNow;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const weather = ws.currentWeather;

    if (weather === 'rain' || weather === 'storm') {
      const dropCount = weather === 'storm' ? 220 : 120;
      ctx.save();
      ctx.strokeStyle = weather === 'storm' ? "rgba(186, 230, 253, 0.55)" : "rgba(224, 242, 254, 0.40)";
      ctx.lineWidth = weather === 'storm' ? 1.5 : 1.0;

      const speed = weather === 'storm' ? 0.8 : 0.5;
      const slant = weather === 'storm' ? 8 : 4;
      const len = weather === 'storm' ? 22 : 14;

      ctx.beginPath();
      for (let i = 0; i < dropCount; i++) {
        const px = (i * 37 + (now * speed * 0.4) * (1 + (i % 5) * 0.2)) % (w + 100) - 50;
        const py = (i * 97 + now * speed * 1.5) % (h + 50) - 30;
        ctx.moveTo(px, py);
        ctx.lineTo(px - slant, py + len);
      }
      ctx.stroke();

      // Atmospheric overcast tint
      ctx.fillStyle = weather === 'storm' ? "rgba(15, 23, 42, 0.28)" : "rgba(30, 41, 59, 0.14)";
      ctx.fillRect(0, 0, w, h);

      // Lightning strike flash in storms
      if (ws.recentLightning && ws.recentLightning.expires > now) {
        const remaining = ws.recentLightning.expires - now;
        const alpha = Math.max(0, Math.min(0.65, remaining / 350));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, w, h);

        // Lightning bolt from sky to strike point
        const screen = this.worldToScreen(ws.recentLightning.x, ws.recentLightning.y);
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
    } else if (weather === 'drought') {
      // Arid golden haze
      ctx.save();
      const pulse = 0.05 + 0.03 * Math.sin(now * 0.002);
      ctx.fillStyle = `rgba(245, 158, 11, ${pulse})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  /**
   * Ambient Day/Night Lighting Filter (Morning, Noon, Sunset, Night)
   */
  renderDayNightLighting() {
    const time = this.simulation?.clock?.getTime() || { hours: 12 };
    const h = time.hours;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const height = this.canvas.height;

    // Continuous night intensity: peak at 1 AM, 0 from 8 AM to 17 PM
    const angle = ((h - 1) / 24) * Math.PI * 2;
    const nightIntensity = Math.max(0, -Math.cos(angle)); // 1 at 1am, 0 by 7am
    if (nightIntensity > 0.02) {
      const alpha = nightIntensity * 0.42;
      ctx.fillStyle = `rgba(10, 20, 50, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, height);
    }

    // Sunset / Dusk golden glow around 17-20
    const duskDist = Math.abs(h - 18.5);
    if (duskDist < 2.5) {
      const duskAlpha = Math.max(0, (1 - duskDist / 2.5) * 0.16);
      ctx.fillStyle = `rgba(234, 88, 12, ${duskAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, height);
    }

    // Dawn rose-violet tint around 5-8
    const dawnDist = Math.abs(h - 6.5);
    if (dawnDist < 2.5) {
      const dawnAlpha = Math.max(0, (1 - dawnDist / 2.5) * 0.14);
      ctx.fillStyle = `rgba(192, 132, 252, ${dawnAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, height);
    }
  }

  /**
   * God Power Visual FX (Lightning, Divine Ray, Sparks)
   */
  renderVisualEffects() {
    const now = this._frameNow;
    const ctx = this.ctx;
    if (this.visualEffects.length > 0) {
      let writeIdx = 0;
      for (let i = 0; i < this.visualEffects.length; i++) {
        const fx = this.visualEffects[i];
        if (now - fx.start < fx.duration) {
          this.visualEffects[writeIdx++] = fx;
        }
      }
      this.visualEffects.length = writeIdx;
    }

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

    if (this.simulation) {
      if (typeof this.simulation.setViewportBounds === "function") {
        this.simulation.setViewportBounds({ minX: startX, maxX: endX, minY: startY, maxY: endY, zoom });
      }
      this.simulation.selectedEntityId = this.selectedEntity ? this.selectedEntity.id : null;
    }

    const now = this._frameNow;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = y * world.width + x;
        const biome = world.biome ? world.biome[idx] : 'grassland';
        const elev = world.elevation ? world.elevation[idx] : 50;
        const screen = this.worldToScreen(x, y);

        // 1. Base Biome Terrain
        this.ctx.fillStyle = this.getBiomeColor(biome, elev, 1.0);
        this.ctx.fillRect(screen.x, screen.y, zoom + 0.5, zoom + 0.5);

        // 2. Bridges & Roads in 2D
        if (world.bridgeTiles && world.bridgeTiles[idx]) {
          this.ctx.fillStyle = "#854d0e";
          this.ctx.fillRect(screen.x, screen.y, zoom, zoom);
        } else if (world.roadTiles && world.roadTiles[idx]) {
          this.ctx.fillStyle = "rgba(195, 180, 155, 0.7)";
          this.ctx.fillRect(screen.x, screen.y, zoom, zoom);
        }

        // 3. Scorched Earth in 2D
        if (world.scorchedTiles && world.scorchedTiles[idx] > 0) {
          const scorchAlpha = Math.min(0.88, (world.scorchedTiles[idx] / 255) * 0.8 + 0.18);
          this.ctx.fillStyle = `rgba(24, 20, 18, ${scorchAlpha})`;
          this.ctx.fillRect(screen.x, screen.y, zoom + 0.5, zoom + 0.5);
        }

        // 4. Active Wildfire Flames in 2D
        if (world.fireTiles && world.fireTiles[idx] > 0) {
          const flicker = 0.7 + 0.3 * Math.sin(now * 0.018 + x * 4.3 + y * 6.7);
          const fs = Math.max(3, zoom * 0.85 * flicker);
          const cx = screen.x + zoom * 0.5;
          const cy = screen.y + zoom * 0.5;

          // Ambient heat aura
          const glowGrad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, fs * 1.6);
          glowGrad.addColorStop(0, "rgba(249, 115, 22, 0.65)");
          glowGrad.addColorStop(0.5, "rgba(239, 68, 68, 0.35)");
          glowGrad.addColorStop(1, "rgba(220, 38, 38, 0)");
          this.ctx.fillStyle = glowGrad;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, fs * 1.6, 0, Math.PI * 2);
          this.ctx.fill();

          // Charred base
          this.ctx.fillStyle = "rgba(30, 10, 5, 0.8)";
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, fs * 0.45, 0, Math.PI * 2);
          this.ctx.fill();

          // Blazing flame core
          const flameGrad = this.ctx.createRadialGradient(cx, cy - fs * 0.25, 0, cx, cy, fs);
          flameGrad.addColorStop(0, "#fffbeb");
          flameGrad.addColorStop(0.3, "#f59e0b");
          flameGrad.addColorStop(0.7, "#ea580c");
          flameGrad.addColorStop(1, "rgba(220, 38, 38, 0.15)");
          this.ctx.fillStyle = flameGrad;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy - fs * 0.25, fs * 0.7, 0, Math.PI * 2);
          this.ctx.fill();

          // Rising smoke plume
          const smokePhase = ((now * 0.003 + x * 0.7 + y * 1.3) % 1);
          this.ctx.fillStyle = `rgba(50, 45, 45, ${0.45 * (1 - smokePhase)})`;
          this.ctx.beginPath();
          this.ctx.arc(cx + Math.sin(now * 0.005 + x) * 2, cy - fs * 0.7 - smokePhase * 10, 2 + smokePhase * 4, 0, Math.PI * 2);
          this.ctx.fill();
        }
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
        if (b.isRuined || (b.health !== undefined && b.health <= 0)) {
          // 2D Ruin footprint: Charred stone foundation with collapsed timbers and smolder
          const rSize = Math.max(8, zoom * 0.9);
          this.ctx.fillStyle = "#1c1917";
          this.ctx.fillRect(screen.x - rSize * 0.5, screen.y - rSize * 0.5, rSize, rSize);
          this.ctx.strokeStyle = "#475569";
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(screen.x - rSize * 0.5, screen.y - rSize * 0.5, rSize, rSize);
          // Crossed fallen beams
          this.ctx.strokeStyle = "#0f172a";
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(screen.x - rSize * 0.4, screen.y - rSize * 0.35);
          this.ctx.lineTo(screen.x + rSize * 0.35, screen.y + rSize * 0.25);
          this.ctx.moveTo(screen.x + rSize * 0.3, screen.y - rSize * 0.3);
          this.ctx.lineTo(screen.x - rSize * 0.25, screen.y + rSize * 0.35);
          this.ctx.stroke();
          // Glowing smoldering ember
          this.ctx.fillStyle = "#f97316";
          this.ctx.fillRect(screen.x - 1, screen.y - 1, 3, 3);
        } else {
          this.render25DBuilding(b, screen, 20);
        }
      }
    }
    if (this.simulation.animalSystem?.animals) {
      for (const an of this.simulation.animalSystem.animals) {
        if (an.alive === false) continue;
        if (an.x < startX - 2 || an.x > endX + 2 || an.y < startY - 2 || an.y > endY + 2) continue;
        const coords = this.getEntityRenderCoords(an);
        const screen = this.worldToScreen(coords.x, coords.y);
        this.render25DAnimal(an, screen, 20);
      }
    }
    if (this.simulation.navalSystem?.vessels) {
      for (const v of this.simulation.navalSystem.vessels) {
        if (v.x < startX - 2 || v.x > endX + 2 || v.y < startY - 2 || v.y > endY + 2) continue;
        const coords = this.getEntityRenderCoords(v);
        const screen = this.worldToScreen(coords.x, coords.y);
        this.render25DVessel(v, screen, 20);
      }
    }
    if (this.simulation.agents) {
      for (const a of this.simulation.agents) {
        if (!a.alive) continue;
        if (a.x < startX - 2 || a.x > endX + 2 || a.y < startY - 2 || a.y > endY + 2) continue;
        const coords = this.getEntityRenderCoords(a);
        const screen = this.worldToScreen(coords.x, coords.y);
        this.render25DAgent(a, screen, 20);
      }
    }

    // Active Warband markers & combat clashes in 2D
    this.renderWarbandMarkers();
    this.renderCombatEffects();
  }

  renderSettlementTerritories() {
    if (!this.simulation?.settlementSystem?.settlements) return;
    const ctx = this.ctx;
    for (const s of this.simulation.settlementSystem.settlements.values()) {
      if (!s.center) continue;
      const screen = this.worldToScreen(s.center.x, s.center.y);
      const rad = (s.radius || 8) * (this.camera.is25D ? this.camera.zoom * 1.4 : this.camera.zoom);

      ctx.save();
      const isRuined = Boolean(s.ruined || s.tier === 'Ruins' || s.status === 'ruined');
      ctx.strokeStyle = isRuined ? "rgba(148, 163, 184, 0.45)" : (s.factionColor || "rgba(251, 191, 36, 0.45)");
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, rad, 0, Math.PI * 2);
      ctx.stroke();

      // Settlement Name Crest
      ctx.setLineDash([]);
      ctx.fillStyle = isRuined ? "rgba(30, 25, 25, 0.9)" : "rgba(15, 23, 42, 0.85)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      const popCount = s.population || s.agents?.length || 0;
      const tierIcon = s.tierIcon || "🏰";
      const txt = isRuined
        ? `🏚️ ${s.name || "Ruins"} (Abandoned)`
        : `${tierIcon} ${s.name || "Settlement"} (Pop ${popCount})`;
      const w = ctx.measureText(txt).width + 16;
      ctx.fillRect(screen.x - w / 2, screen.y - rad - 20, w, 22);
      ctx.strokeStyle = isRuined ? "#64748b" : (s.factionColor || "#f59e0b");
      ctx.strokeRect(screen.x - w / 2, screen.y - rad - 20, w, 22);
      ctx.fillStyle = isRuined ? "#cbd5e1" : "#f8fafc";
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

  /**
   * Phase 3c Step G — battle visuals (pure render layer, zero sim-state impact).
   * Draws clashing-army band markers over active warbands: a banner-colored
   * oval with soldier-count pips, a morale bar, routing tint, ⚔️ clash sparks
   * and rising smoke for bands currently engaged in combat.
   */
  renderWarbandMarkers() {
    const wf = this.simulation?.warfareSystem;
    if (!wf || !wf.warbands || wf.warbands.size === 0) return;
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const tick = this.simulation.clock?.tick ?? 0;

    for (const wb of wf.warbands.values()) {
      if (!wb.active || wb.state === "destroyed") continue;
      const coords = this.getEntityRenderCoords(wb);
      const cx = coords.x, cy = coords.y;
      if (cx === undefined || cy === undefined) continue;
      // Cull to visible area (world coords)
      if (cx < -4 || cy < -4 || cx > (this.world?.width || 1e9) + 4 || cy > (this.world?.height || 1e9) + 4) {
        const sc0 = this.worldToScreen(cx, cy);
        if (sc0.x < -80 || sc0.y < -80 || sc0.x > this.canvas.width + 80 || sc0.y > this.canvas.height + 80) continue;
      }
      const screen = this.worldToScreen(cx, cy);
      const size = wb.markerSize || wb.soldiers.length || 1;
      const rx = Math.max(10, Math.min(46, size * 2.4)) * (zoom / 20);
      const ry = rx * 0.55;
      const engaging = wb.state === "engaging" || wb.state === "sieging" || wb.state === "clashing";
      const routing = wb.state === "retreating" || (wb.markerMorale !== undefined && wb.markerMorale <= 25);
      const banner = wb.bannerColor || "#ef4444";

      ctx.save();

      // Army band oval (banner colored, semi-transparent)
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = routing ? "rgba(148, 163, 184, 0.28)" : this.hexToRgba(banner, 0.30);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = routing ? "rgba(148, 163, 184, 0.75)" : banner;
      if (routing) ctx.setLineDash([4, 4]); // dashed = routed band
      ctx.stroke();
      ctx.setLineDash([]);

      // Casualty/soldier pips: one dot per soldier around the band rim
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

      // Morale bar above the band
      const barW = rx * 1.6;
      const morale = Math.max(0, Math.min(100, wb.markerMorale ?? wb.morale ?? 100));
      ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
      ctx.fillRect(screen.x - barW / 2, screen.y - ry - 12, barW, 4);
      ctx.fillStyle = morale > 60 ? "#22c55e" : morale > 30 ? "#f59e0b" : "#ef4444";
      ctx.fillRect(screen.x - barW / 2, screen.y - ry - 12, barW * (morale / 100), 4);

      // Banner label: settlement name + size + era emblem
      ctx.font = `bold ${Math.max(9, zoom * 0.45)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(248, 250, 252, 0.9)";
      const eraTag = (wb.eraId || 1) >= 6 ? " 🚀" : (wb.eraId || 1) === 5 ? " ⚙️" : "";
      ctx.fillText(`${wb.settlementName || "Warband"}${eraTag} (${size})`, screen.x, screen.y - ry - 16);

      // Clash FX for engaged bands: pulsing ⚔️ + rising smoke particles
      if (engaging) {
        const pulse = 1 + 0.15 * Math.sin(tick * 0.35);
        ctx.font = `${Math.max(14, zoom * 0.8) * pulse}px sans-serif`;
        ctx.fillText("⚔️", screen.x, screen.y + 4);

        // Smoke: deterministic pseudo-random offsets from tick + warband id
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

        // Red combat glow ring
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, rx + 3, ry + 2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + 0.25 * Math.sin(tick * 0.3)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (routing) {
        // Routing tint: grey wash + 🏳 marker
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

  hexToRgba(hex, alpha) {
    if (typeof hex !== "string" || !hex.startsWith("#")) return `rgba(239, 68, 68, ${alpha})`;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) || 239;
    const g = parseInt(h.slice(2, 4), 16) || 68;
    const b = parseInt(h.slice(4, 6), 16) || 68;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  renderCombatEffects() {
    if (!this.simulation?.warfareSystem?.combatEffects) return;
    const effects = this.simulation.warfareSystem.combatEffects;
    if (effects.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    for (const eff of effects) {
      const screen = this.worldToScreen(eff.x, eff.y);
      const maxDur = eff.type === "casualty" ? 25 : 15;
      const progress = Math.max(0, Math.min(1, 1 - (eff.duration / maxDur)));
      const alpha = Math.max(0, 1 - progress);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (eff.type === "shield_block") {
        // Metallic block ring expanding outward
        const rad = 4 + progress * 14;
        ctx.strokeStyle = "rgba(147, 197, 253, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - 6, rad, 0, Math.PI * 2);
        ctx.stroke();
        // Mini shield icon
        ctx.font = `${Math.max(11, this.camera.zoom * 0.9)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("🛡️", screen.x, screen.y - 12 - progress * 8);
      } else if (eff.type === "casualty") {
        // Red death impact puddle + rising skull
        ctx.fillStyle = `rgba(185, 28, 28, ${(0.4 * alpha).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 1, 8 + progress * 6, 4 + progress * 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.max(14, this.camera.zoom * 1.3)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("💀", screen.x, screen.y - 10 - progress * 16);
      } else if (eff.type === "explosion") {
        // Artillery blast shockwave & fiery fireball
        const blastR = 8 + progress * 22;
        const grad = ctx.createRadialGradient(screen.x, screen.y - 4, 0, screen.x, screen.y - 4, blastR);
        grad.addColorStop(0, "rgba(255, 251, 235, 0.9)");
        grad.addColorStop(0.4, "rgba(249, 115, 22, 0.7)");
        grad.addColorStop(1, "rgba(127, 29, 29, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - 4, blastR, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === "musket_shot" || eff.type === "tracer_fire" || eff.type === "artillery_shell") {
        const pFrom = (eff.fromX !== undefined && eff.fromY !== undefined) ? this.worldToScreen(eff.fromX, eff.fromY) : screen;
        const pTo = (eff.toX !== undefined && eff.toY !== undefined) ? this.worldToScreen(eff.toX, eff.toY) : screen;
        ctx.strokeStyle = eff.type === "tracer_fire" ? "#38bdf8" : eff.type === "artillery_shell" ? "#f97316" : "#fbbf24";
        ctx.lineWidth = eff.type === "artillery_shell" ? 3 : 1.6;
        ctx.beginPath();
        ctx.moveTo(pFrom.x, pFrom.y - 8);
        ctx.lineTo(pTo.x, pTo.y - 8);
        ctx.stroke();
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(pFrom.x, pFrom.y - 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (eff.type === "arrow") {
        ctx.font = `${Math.max(11, this.camera.zoom * 0.9)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("🏹", screen.x, screen.y - 8 - progress * 10);
      } else {
        // Clashing steel sparks
        const sparkDist = progress * 10;
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(screen.x + sparkDist, screen.y - 8 - sparkDist, 2.5, 2.5);
        ctx.fillRect(screen.x - sparkDist, screen.y - 8 - sparkDist, 2.5, 2.5);
        ctx.fillRect(screen.x + sparkDist * 0.7, screen.y - 8 + sparkDist * 0.7, 2, 2);
        ctx.fillRect(screen.x - sparkDist * 0.7, screen.y - 8 + sparkDist * 0.7, 2, 2);

        ctx.font = `${Math.max(13, this.camera.zoom * 1.1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("⚔️", screen.x, screen.y - 10 - progress * 10);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  renderHUD() {
    const sim = this.simulation;
    if (!sim) return;
    const ctx = this.ctx;
    const fires = this.world?.fireTiles ? this.world.countFires?.() || 0 : 0;
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
      `Wars ${wars} · Mode: ${this.camera.is25D ? "2.5D Isometric 3D" : "2D Top-Down"}${fires > 0 ? ` · 🔥 Fires ${fires}` : ""}`
    ];

    // Step E: active-war banner — ⚔️ belligerents and a clickable front-line
    // marker. Clicking anywhere on the red line jumps the camera to where
    // the fighting last happened (Rule 16 discoverability).
    // Step F: W key toggles the Wars panel (active wars + peace history).
    if (this._warsPanel == null) this._warsPanel = false;
    this._warBannerRect = null;
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
    lines.push(`${this._warsPanel ? '▼' : '▶'} [W]ars — ${sim.diplomacySystem?.activeWars?.length || 0} active · ${totalWars} recorded`);

    if (sim.chronicleSystem?.entries?.length > 0) {
      const entries = sim.chronicleSystem.entries;
      const count = entries.length;
      let notable = null;
      for (let i = count - 1; i >= Math.max(0, count - 8); i--) {
        const e = entries[i];
        if (e.icon === '⚔️' || e.icon === '🕊️') {
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

    const boxW = 280;
    const panelLines = this._warsPanel ? this._buildWarsPanel(sim) : [];
    const boxH = (lines.length + panelLines.length) * 18 + 14;
    ctx.beginPath();
    ctx.roundRect(12, 12, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    const warsToggleIdx = activeWar ? 3 : 2; // index of the [W]ars line
    let screenYCursor = 30;
    lines.forEach((line, i) => {
      const isWarBanner = activeWar && i === 2;
      ctx.fillStyle = isWarBanner ? "#fecaca" : (i === 1 && wars > 0 ? "#fca5a5" : "#e2e8f0");
      ctx.fillText(line, 20, screenYCursor);
      if (isWarBanner) {
        // Record hit area for click-to-jump camera (world coords of front)
        this._warBannerRect = { x: 12, y: screenYCursor - 18 + 6, w: boxW, h: 18, frontLine: activeWar.frontLine };
      }
      if (i === warsToggleIdx) {
        // Clickable [W]ars toggle row
        this._warsToggleRect = { x: 12, y: screenYCursor - 18 + 6, w: boxW, h: 18 };
      }
      screenYCursor += 18;
    });

    // Step F: Wars panel body — one entry per war (active first, then history),
    // each clickable to jump the camera to its front line / last battlefield.
    this._warsPanelRows = [];
    for (const pl of panelLines) {
      ctx.fillStyle = pl.color || "#94a3b8";
      ctx.fillText(pl.text, 20, screenYCursor);
      if (pl.jump) {
        this._warsPanelRows.push({ x: 12, y: screenYCursor - 18 + 6, w: boxW, h: 18, frontLine: pl.jump });
      }
      screenYCursor += 18;
    }
    void warsToggleIdx;
    ctx.restore();
  }

  /**
   * Step F: build the Wars panel rows — active wars with casus belli, sides,
   * casualties and battles fought, followed by recent peace treaties.
   * Read-only over sim state (determinism-safe).
   */
  _buildWarsPanel(sim) {
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

  /**
   * Smoothly eases or jumps the camera to a world position (front lines, settlements, agents).
   */
  centerOn(x, y, zoom = null, immediate = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const targetX = Math.max(-5, Math.min(this.world.width + 5, x));
    const targetY = Math.max(-5, Math.min(this.world.height + 5, y));
    this.camera.targetX = targetX;
    this.camera.targetY = targetY;
    if (zoom != null) {
      this.camera.targetZoom = Math.max(3.5, Math.min(36, zoom));
    }
    if (immediate) {
      this.camera.x = targetX;
      this.camera.y = targetY;
      if (zoom != null) this.camera.zoom = this.camera.targetZoom;
    }
  }

  renderUI() {
    if (!this.selectedEntity) return;
    const e = this.selectedEntity.entity || this.selectedEntity;
    if (e && (e.x !== undefined || e.centroidX !== undefined)) {
      const coords = this.getEntityRenderCoords(e);
      const elev = this.getInterpolatedElevation(coords.x, coords.y);
      const screen = this.worldToScreen(coords.x, coords.y, elev);
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
