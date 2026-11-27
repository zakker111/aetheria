// 2.5D Isometric & Top-Down Canvas Renderer Orchestrator.
// Coordinates camera, input, coordinate projection, Spatial LOD bounds, and delegates
// rendering passes to focused modules under ./passes/.
// Conforms to Aetheria architecture (renderer receives state snapshots, zero side-effects).
import { RNG } from "../core/rng.js";
import {
  lerpColor,
  renderSkyAndBackdrop,
  getBiomeColor,
  getCliffColor,
  render25DTerrain,
  render25DWaterAndRivers,
  render25DRoadsAndBridges
} from "./passes/terrainPass.js";
import {
  render25DFortification,
  render25DGroundItem,
  render25DResource,
  render25DBuilding,
  render25DSettlementCenter
} from "./passes/structuresPass.js";
import {
  render25DAnimal,
  render25DVessel,
  render25DAgent,
  drawThoughtIcon
} from "./passes/entitiesPass.js";
import {
  hexToRgba,
  renderSettlementTerritories,
  renderDiplomacyLines,
  renderWarbandMarkers,
  renderSkullMonuments,
  renderCombatEffects,
  renderClouds,
  renderWeather,
  renderDayNightLighting,
  renderVisualEffects,
  renderSpectralSpirits
} from "./passes/overlaysPass.js";
import { render2DScene } from "./passes/topDownPass.js";
import { buildWarsPanelRows, renderHUD, renderSelectionReticle } from "./passes/hudPass.js";
import { emitNotification, emitWorldClick, subscribeGodEffects } from "../state/worldUiStore";

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
    const initX = world ? world.width / 2 : 80;
    const initY = world ? world.height / 2 : 80;
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
    this.followAgentId = null;
    this.hudTopOffset = 12;
    this._battleCycleIdx = 0;

    // Clouds drifting across the sky
    this.clouds = [];
    this.initClouds();

    // God power FX animations
    this.visualEffects = [];

    // Precomputed color lookups for 60fps rendering
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
    this._isFrozen = false;

    this.setupInput();
    this.setupEventListeners();
  }

  setFrameTiming(tickAlpha, frameDtMs, speed) {
    const clampedAlpha = tickAlpha < 0 ? 0 : tickAlpha > 1 ? 1 : tickAlpha;
    this._tickAlpha = clampedAlpha;
    if (speed > 0) this._lastActiveAlpha = clampedAlpha;
    this._isFrozen = frameDtMs <= 0 && (speed ?? 0) === 0;
    const dt = this._isFrozen ? 0 : (frameDtMs > 0 ? Math.min(100, frameDtMs) : 16.67);
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
    this._unsubGodEffects = subscribeGodEffects((effect) => {
      if (effect) {
        this.addVisualEffect(effect.type, effect.x, effect.y, effect);
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
    emitNotification(`Camera: switched to ${modeName}`);
    return this.camera.is25D;
  }

  cycleHeightScale() {
    const scales = [0.22, 0.38, 0.58, 0.08];
    const currIdx = scales.indexOf(this.camera.heightScale);
    this.camera.heightScale = scales[(currIdx + 1) % scales.length];
    const label = this.camera.heightScale === 0.08 ? "Low Relief" :
                  this.camera.heightScale === 0.22 ? "Gentle Hills" :
                  this.camera.heightScale === 0.38 ? "Standard 3D Heights" : "Dramatic Peaks";
    emitNotification(`Terrain: ${label}`);
  }

  setupInput() {
    if (!this.canvas) return;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let dragDistance = 0;
    let touchDistance = 0;
    let lastTouchClickAt = 0;

    this._onMouseDown = (e) => {
      e.preventDefault();
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      dragDistance = 0;
    };

    this._onMouseMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        dragDistance += Math.hypot(dx, dy);

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
        this.followAgentId = null;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };

    this._onMouseUp = (e) => {
      e.preventDefault();
      isDragging = false;
    };

    this._onMouseLeave = () => {
      isDragging = false;
    };

    this._onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
      const baseZoom = this.camera.targetZoom ?? this.camera.zoom;
      this.camera.targetZoom = Math.max(3.5, Math.min(36, baseZoom * zoomFactor));
    };

    this._onClick = (e) => {
      e.preventDefault();
      if (Date.now() - lastTouchClickAt < 450) {
        return;
      }
      if (dragDistance > 6) {
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const banner = this._warBannerRect;
      if (banner && screenX >= banner.x && screenX <= banner.x + banner.w &&
          screenY >= banner.y && screenY <= banner.y + banner.h && banner.frontLine) {
        this.centerOn(banner.frontLine.x, banner.frontLine.y, Math.max(this.camera.zoom, 14));
        return;
      }

      const tog = this._warsToggleRect;
      if (tog && screenX >= tog.x && screenX <= tog.x + tog.w &&
          screenY >= tog.y && screenY <= tog.y + tog.h) {
        this._warsPanel = !this._warsPanel;
        return;
      }

      for (const row of (this._warsPanelRows || [])) {
        if (screenX >= row.x && screenX <= row.x + row.w &&
            screenY >= row.y && screenY <= row.y + row.h && row.frontLine) {
          this.centerOn(row.frontLine.x, row.frontLine.y, Math.max(this.camera.zoom, 14));
          return;
        }
      }

      const worldPos = this.screenToWorld(screenX, screenY);

      emitWorldClick({ x: worldPos.x, y: worldPos.y });
    };

    this._onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        touchDistance = 0;
      }
    };

    this._onTouchMove = (e) => {
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
        this.followAgentId = null;
        lastX = cx;
        lastY = cy;
      }
    };

    this._onTouchEnd = (e) => {
      isDragging = false;
      if (touchDistance < 8 && e.changedTouches.length === 1) {
        lastTouchClickAt = Date.now();
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.changedTouches[0].clientX - rect.left;
        const screenY = e.changedTouches[0].clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        emitWorldClick({ x: worldPos.x, y: worldPos.y });
      }
    };

    this.canvas.addEventListener("mousedown", this._onMouseDown);
    this.canvas.addEventListener("mousemove", this._onMouseMove);
    this.canvas.addEventListener("mouseup", this._onMouseUp);
    this.canvas.addEventListener("mouseleave", this._onMouseLeave);
    this.canvas.addEventListener("wheel", this._onWheel, { passive: false });
    this.canvas.addEventListener("click", this._onClick);
    this.canvas.addEventListener("touchstart", this._onTouchStart, { passive: true });
    this.canvas.addEventListener("touchmove", this._onTouchMove, { passive: true });
    this.canvas.addEventListener("touchend", this._onTouchEnd, { passive: true });
  }

  destroy() {
    if (this._unsubGodEffects) {
      this._unsubGodEffects();
      this._unsubGodEffects = null;
    }
    if (this.canvas) {
      if (this._onMouseDown) this.canvas.removeEventListener("mousedown", this._onMouseDown);
      if (this._onMouseMove) this.canvas.removeEventListener("mousemove", this._onMouseMove);
      if (this._onMouseUp) this.canvas.removeEventListener("mouseup", this._onMouseUp);
      if (this._onMouseLeave) this.canvas.removeEventListener("mouseleave", this._onMouseLeave);
      if (this._onWheel) this.canvas.removeEventListener("wheel", this._onWheel);
      if (this._onClick) this.canvas.removeEventListener("click", this._onClick);
      if (this._onTouchStart) this.canvas.removeEventListener("touchstart", this._onTouchStart);
      if (this._onTouchMove) this.canvas.removeEventListener("touchmove", this._onTouchMove);
      if (this._onTouchEnd) this.canvas.removeEventListener("touchend", this._onTouchEnd);
    }
  }

  getTileElevation(x, y) {
    if (!this.world || !this.world.elevation) return 30;
    const w = this.world.width;
    const h = this.world.height;
    const cx = x < 0 ? 0 : x >= w ? w - 1 : (x | 0);
    const cy = y < 0 ? 0 : y >= h ? h - 1 : (y | 0);
    const idx = cy * w + cx;

    if (this.world.biome && this.world.biome[idx] === "water") {
      return 14;
    }
    return this.world.elevation[idx];
  }

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
    const isWater0 = this.world.biome && this.world.biome[idx0 + x0] === "water";
    const isWater1 = this.world.biome && this.world.biome[idx0 + x1] === "water";
    const isWater2 = this.world.biome && this.world.biome[idx1 + x0] === "water";
    const isWater3 = this.world.biome && this.world.biome[idx1 + x1] === "water";
    const elev = this.world.elevation;

    const e00 = isWater0 ? 14 : elev[idx0 + x0];
    const e10 = isWater1 ? 14 : elev[idx0 + x1];
    const e01 = isWater2 ? 14 : elev[idx1 + x0];
    const e11 = isWater3 ? 14 : elev[idx1 + x1];

    const top = e00 + (e10 - e00) * fx;
    const btm = e01 + (e11 - e01) * fx;
    return top + (btm - top) * fy;
  }

  worldToScreen(worldX, worldY, worldZ = null) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    if (!this.camera.is25D) {
      return {
        x: centerX + (worldX - this.camera.x) * this.camera.zoom,
        y: centerY + (worldY - this.camera.y) * this.camera.zoom
      };
    }

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

  screenToWorld(screenX, screenY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    if (!this.camera.is25D) {
      return {
        x: this.camera.x + (screenX - centerX) / this.camera.zoom,
        y: this.camera.y + (screenY - centerY) / this.camera.zoom
      };
    }

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
    if (!this._isFrozen) {
      this._frameNow = Date.now();
    }
    this._currentSimTick = this.simulation?.clock?.tick ?? 0;

    if (this.followAgentId != null && this.simulation) {
      const ag = this.simulation._agentById
        ? this.simulation._agentById(this.followAgentId)
        : this.simulation.agents?.find(a => a.id === this.followAgentId);
      if (ag && ag.alive) {
        const coords = this.getEntityRenderCoords(ag);
        this.camera.targetX = coords.x;
        this.camera.targetY = coords.y;
      } else {
        this.followAgentId = null;
      }
    }
    this.updateCameraSmoothly();

    renderSkyAndBackdrop(this);

    if (this.camera.is25D) {
      this.render25DScene();
    } else {
      render2DScene(this);
    }

    renderClouds(this);
    renderWeather(this);
    renderDayNightLighting(this);
    renderVisualEffects(this, _visualRng);
    renderSelectionReticle(this);
  }

  render25DScene() {
    const world = this.world;
    if (!world) return;

    const margin = 4;
    const minScreen = this.screenToWorld(0, 0);
    const maxScreen = this.screenToWorld(this.canvas.width, this.canvas.height);
    const cornerTR = this.screenToWorld(this.canvas.width, 0);
    const cornerBL = this.screenToWorld(0, this.canvas.height);

    const minX = Math.max(0, Math.floor(Math.min(minScreen.x, maxScreen.x, cornerTR.x, cornerBL.x) - margin));
    const maxX = Math.min(world.width - 1, Math.ceil(Math.max(minScreen.x, maxScreen.x, cornerTR.x, cornerBL.x) + margin));
    const minY = Math.max(0, Math.floor(Math.min(minScreen.y, maxScreen.y, cornerTR.y, cornerBL.y) - margin));
    const maxY = Math.min(world.height - 1, Math.ceil(Math.max(minScreen.y, maxScreen.y, cornerTR.y, cornerBL.y) + margin));

    if (this.simulation) {
      if (typeof this.simulation.setViewportBounds === "function") {
        this.simulation.setViewportBounds({ minX, maxX, minY, maxY, zoom: this.camera.zoom });
      }
      this.simulation.selectedEntityId = this.selectedEntity ? this.selectedEntity.id : null;
    }

    render25DTerrain(this, minX, maxX, minY, maxY);
    render25DWaterAndRivers(this, minX, maxX, minY, maxY);
    render25DRoadsAndBridges(this, minX, maxX, minY, maxY);
    renderSettlementTerritories(this);
    renderDiplomacyLines(this);
    this.render25DDepthSortedEntities(minX, maxX, minY, maxY);
  }

  render25DDepthSortedEntities(minX, maxX, minY, maxY) {
    this._poolIndex = 0;
    this._renderList.length = 0;
    const list = this._renderList;

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

    const fortSegments = this.simulation.fortificationSystem?.segments;
    if (fortSegments && fortSegments.size > 0) {
      for (const seg of fortSegments.values()) {
        if (seg.x >= minX - 1 && seg.x <= maxX + 1 && seg.y >= minY - 1 && seg.y <= maxY + 1) {
          list.push(this.getRenderItem("wall_segment", seg, seg.x + 0.5, seg.y + 0.5, seg.x + seg.y + 0.15));
        }
      }
    }

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
          const isFlying = ag.combatRole === "plane" || ag.combat?.isFlying;
          list.push(this.getRenderItem("agent", ag, coords.x, coords.y, coords.x + coords.y + (isFlying ? 4.5 : 0.3)));
        }
      }
    }

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

    list.sort((a, b) => a.depth - b.depth);

    const len = list.length;
    const screen = this._renderScreenBuf || (this._renderScreenBuf = { x: 0, y: 0 });
    for (let i = 0; i < len; i++) {
      const item = list[i];
      const elev = this.getInterpolatedElevation(item.x, item.y);
      this.worldToScreenFast(item.x, item.y, elev, screen);

      switch (item.kind) {
        case "resource":
          render25DResource(this, item.entity, screen, elev);
          break;
        case "ground_item":
          render25DGroundItem(this, item.entity, screen);
          break;
        case "building":
          render25DBuilding(this, item.entity, screen, elev);
          break;
        case "wall_segment":
          render25DFortification(this, item.entity, screen);
          break;
        case "settlement_center":
          render25DSettlementCenter(this, item.entity, screen, elev);
          break;
        case "animal":
          render25DAnimal(this, item.entity, screen, elev);
          break;
        case "vessel":
          render25DVessel(this, item.entity, screen, elev);
          break;
        case "agent":
          render25DAgent(this, item.entity, screen, elev);
          break;
      }
    }

    renderSpectralSpirits(this);
    renderSkullMonuments(this, minX, maxX, minY, maxY);
    renderWarbandMarkers(this);
    renderCombatEffects(this);
  }

  focusNextBattle() {
    const sim = this.simulation;
    if (!sim) return null;
    const targets = [];
    const warbands = sim.warfareSystem?.warbands ? [...sim.warfareSystem.warbands.values()] : [];
    for (const wb of warbands) {
      if (!wb.active) continue;
      if (wb.state === "engaging" || wb.state === "sieging" || wb.state === "clashing") {
        targets.push({ x: wb.x, y: wb.y, label: `${wb.settlementName || "Warband"} (${wb.state})` });
      }
    }
    if (targets.length === 0 && sim.diplomacySystem?.activeWars) {
      for (const w of sim.diplomacySystem.activeWars) {
        if (w.active && w.frontLine) {
          targets.push({ x: w.frontLine.x, y: w.frontLine.y, label: `${w.attackerName} vs ${w.defenderName}` });
        }
      }
    }
    if (targets.length === 0 && sim.warfareSystem?.combatEffects) {
      for (const eff of sim.warfareSystem.combatEffects) {
        if (eff.type === "nuke" || eff.type === "explosion") {
          targets.push({ x: eff.x, y: eff.y, label: eff.type === "nuke" ? "Atomic Blast" : "Artillery Clash" });
        }
      }
    }
    if (targets.length === 0 && this.world?.skullMonuments?.length > 0) {
      const mons = this.world.skullMonuments;
      for (let i = mons.length - 1; i >= Math.max(0, mons.length - 6); i--) {
        const m = mons[i];
        targets.push({ x: m.x, y: m.y, label: m.label || "Battlefield Scar" });
      }
    }
    if (targets.length === 0) return null;
    const idx = this._battleCycleIdx % targets.length;
    this._battleCycleIdx = (this._battleCycleIdx + 1) % targets.length;
    const pt = targets[idx];
    this.centerOn(pt.x, pt.y, Math.max(this.camera.zoom, 15));
    return pt;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number | null} [zoom]
   * @param {boolean} [immediate]
   * @param {boolean} [keepFollow]
   */
  centerOn(x, y, zoom = null, immediate = false, keepFollow = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!keepFollow) this.followAgentId = null;
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

  // Backward-compatible method wrappers delegating to modular passes
  _lerpColor(c1, c2, t) { return lerpColor(c1, c2, t); }
  renderSkyAndBackdrop() { renderSkyAndBackdrop(this); }
  render25DTerrain(minX, maxX, minY, maxY) { render25DTerrain(this, minX, maxX, minY, maxY); }
  render25DWaterAndRivers(minX, maxX, minY, maxY) { render25DWaterAndRivers(this, minX, maxX, minY, maxY); }
  render25DRoadsAndBridges(minX, maxX, minY, maxY) { render25DRoadsAndBridges(this, minX, maxX, minY, maxY); }
  render25DFortification(seg, screen) { render25DFortification(this, seg, screen); }
  render25DGroundItem(item, screen) { render25DGroundItem(this, item, screen); }
  render25DResource(res, screen, elev) { render25DResource(this, res, screen, elev); }
  render25DBuilding(b, screen, elev) { render25DBuilding(this, b, screen, elev); }
  render25DSettlementCenter(s, screen, elev) { render25DSettlementCenter(this, s, screen, elev); }
  render25DAnimal(a, screen, elev) { render25DAnimal(this, a, screen, elev); }
  render25DVessel(v, screen, elev) { render25DVessel(this, v, screen, elev); }
  render25DAgent(agent, screen, elev) { render25DAgent(this, agent, screen, elev); }
  drawThoughtIcon(x, y, icon, facing = 1) { drawThoughtIcon(this, x, y, icon, facing); }
  getBiomeColor(biome, elevation, sunFactor) { return getBiomeColor(this, biome, elevation, sunFactor); }
  getCliffColor(biome, factor) { return getCliffColor(this, biome, factor); }
  renderClouds() { renderClouds(this); }
  renderWeather() { renderWeather(this); }
  renderDayNightLighting() { renderDayNightLighting(this); }
  renderVisualEffects() { renderVisualEffects(this, _visualRng); }
  render2DScene() { render2DScene(this); }
  renderSettlementTerritories() { renderSettlementTerritories(this); }
  renderDiplomacyLines() { renderDiplomacyLines(this); }
  renderWarbandMarkers() { renderWarbandMarkers(this); }
  hexToRgba(hex, alpha) { return hexToRgba(hex, alpha); }
  renderSkullMonuments(minX = 0, maxX = Infinity, minY = 0, maxY = Infinity) { renderSkullMonuments(this, minX, maxX, minY, maxY); }
  renderCombatEffects() { renderCombatEffects(this); }
  renderHUD() { renderHUD(this); }
  _buildWarsPanel(sim) { return buildWarsPanelRows(sim); }
  renderUI() { renderSelectionReticle(this); }
}
