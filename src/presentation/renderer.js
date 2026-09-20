// Canvas-based 2D renderer (doc 00: renderer receives snapshots, not authoritative state)
export class CanvasRenderer {
  constructor(canvas, world, simulation) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.world = world;
    this.simulation = simulation;
    
    // Camera
    this.camera = {
      x: world.width / 2,
      y: world.height / 2,
      zoom: 8
    };
    
    this.setupInput();
  }

  setupInput() {
    // Pan with mouse drag
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    this.canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    
    this.canvas.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });
    
    this.canvas.addEventListener("mouseup", () => {
      isDragging = false;
    });
    
    // Zoom with wheel
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoom *= zoomFactor;
      this.camera.zoom = Math.max(2, Math.min(20, this.camera.zoom));
    });
    
    // Click to use god powers
    this.canvas.addEventListener("click", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(screenX, screenY);
      
      // Emit click event for interaction layer to handle
      this.canvas.dispatchEvent(new CustomEvent("worldclick", {
        detail: { x: worldPos.x, y: worldPos.y }
      }));
    });
  }

  screenToWorld(screenX, screenY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    return {
      x: this.camera.x + (screenX - centerX) / this.camera.zoom,
      y: this.camera.y + (screenY - centerY) / this.camera.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    return {
      x: centerX + (worldX - this.camera.x) * this.camera.zoom,
      y: centerY + (worldY - this.camera.y) * this.camera.zoom
    };
  }

  render() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.renderTerrain();
    this.renderResources();
    this.renderBuildings();
    this.renderAgents();
    this.renderUI();
  }

  renderTerrain() {
    const startX = Math.max(0, Math.floor(this.camera.x - this.canvas.width / 2 / this.camera.zoom));
    const startY = Math.max(0, Math.floor(this.camera.y - this.canvas.height / 2 / this.camera.zoom));
    const endX = Math.min(this.world.width, Math.ceil(this.camera.x + this.canvas.width / 2 / this.camera.zoom));
    const endY = Math.min(this.world.height, Math.ceil(this.camera.y + this.canvas.height / 2 / this.camera.zoom));
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const terrain = this.world.getTerrain(x, y);
        if (terrain) {
          const screen = this.worldToScreen(x, y);
          this.ctx.fillStyle = this.getTerrainColor(terrain.type);
          this.ctx.fillRect(screen.x, screen.y, this.camera.zoom, this.camera.zoom);
        }
      }
    }
  }

  getTerrainColor(type) {
    const colors = {
      water: "#1e3a8a",
      beach: "#fef3c7",
      grassland: "#16a34a",
      forest: "#15803d",
      desert: "#fbbf24",
      mountain: "#78716c"
    };
    return colors[type] || "#000";
  }

  renderResources() {
    for (const resource of this.simulation.resources) {
      const screen = this.worldToScreen(resource.x, resource.y);
      this.ctx.fillStyle = this.getResourceColor(resource.resourceType);
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, this.camera.zoom * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  getResourceColor(type) {
    const colors = {
      food: "#dc2626",
      water: "#3b82f6",
      wood: "#78350f",
      ore: "#6b7280"
    };
    return colors[type] || "#fff";
  }

  renderBuildings() {
    for (const building of this.simulation.buildings) {
      const screen = this.worldToScreen(building.x, building.y);
      this.ctx.fillStyle = "#8b5cf6";
      this.ctx.fillRect(
        screen.x - this.camera.zoom * 0.4,
        screen.y - this.camera.zoom * 0.4,
        this.camera.zoom * 0.8,
        this.camera.zoom * 0.8
      );
    }
  }

  renderAgents() {
    for (const agent of this.simulation.agents) {
      if (!agent.alive) continue;
      
      const screen = this.worldToScreen(agent.x, agent.y);
      
      // Agent body
      this.ctx.fillStyle = "#fbbf24";
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, this.camera.zoom * 0.4, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Needs indicator (food level as color intensity)
      const foodLevel = agent.needs.food / 100;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${foodLevel})`;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, this.camera.zoom * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  renderUI() {
    this.ctx.fillStyle = "#fff";
    this.ctx.font = "14px monospace";
    
    const time = this.simulation.clock.getTime();
    this.ctx.fillText(`Day ${time.days + 1}, Hour ${time.hours}`, 10, 20);
    this.ctx.fillText(`Agents: ${this.simulation.agents.length}`, 10, 40);
    this.ctx.fillText(`Resources: ${this.simulation.resources.length}`, 10, 60);
    this.ctx.fillText(`Zoom: ${this.camera.zoom.toFixed(1)}x`, 10, 80);
  }
}
