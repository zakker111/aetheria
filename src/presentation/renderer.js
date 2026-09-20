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
      mountain: "#78716c",
      snow: "#f0f9ff",
      tundra: "#a8a29e",
      savanna: "#84cc16",
      jungle: "#065f46"
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
      const size = this.camera.zoom * 0.4;
      
      // Agent body - color based on current action
      let bodyColor = "#fbbf24"; // default yellow
      if (agent.currentAction) {
        switch(agent.currentAction.type) {
          case "gather_food": bodyColor = "#22c55e"; break;
          case "drink_water": bodyColor = "#3b82f6"; break;
          case "rest": bodyColor = "#a855f7"; break;
          case "socialize": bodyColor = "#ec4899"; break;
          case "reproduce": bodyColor = "#f472b6"; break;
        }
      }
      
      this.ctx.fillStyle = bodyColor;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Needs indicator (food level as inner circle opacity)
      const foodLevel = agent.needs.food / 100;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${foodLevel * 0.8})`;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, size * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Show action text above agent (when zoomed in)
      if (this.camera.zoom > 5 && agent.currentAction) {
        this.ctx.fillStyle = "#fff";
        this.ctx.font = `${Math.max(8, this.camera.zoom)}px monospace`;
        const actionText = agent.currentAction.type.replace('_', ' ');
        this.ctx.textAlign = "center";
        this.ctx.fillText(actionText, screen.x, screen.y - size - 2);
      }
      
      // Age indicator for old agents
      if (agent.age > agent.maxAge * 0.8) {
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, size + 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }
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
    
    // Show births/deaths counter if available
    if (this.simulation.birthsThisSession) {
      this.ctx.fillText(`Births: ${this.simulation.birthsThisSession}`, 10, 100);
    }
    if (this.simulation.deathsThisSession) {
      this.ctx.fillText(`Deaths: ${this.simulation.deathsThisSession}`, 10, 120);
    }
    
    // Phase 2: Show settlements
    let yOffset = 150;
    for (const settlement of this.simulation.settlementSystem.settlements.values()) {
      this.ctx.fillStyle = "#fbbf24";
      this.ctx.fillText(`${settlement.name} (${settlement.population})`, 10, yOffset);
      yOffset += 20;
      
      // Show growth trend
      this.ctx.fillStyle = settlement.growthTrend === 'growing' ? '#22c55e' : 
                           settlement.growthTrend === 'declining' ? '#dc2626' : '#fff';
      this.ctx.fillText(`  ${settlement.growthTrend}`, 20, yOffset);
      yOffset += 25;
    }
    
    // Show job statistics if agents have jobs
    const jobStats = {};
    for (const agentId of this.simulation.agents.map(a => a.id)) {
      const jobData = this.simulation.economySystem.getAgentJob(agentId);
      if (jobData && jobData.job !== 'unemployed') {
        jobStats[jobData.job] = (jobStats[jobData.job] || 0) + 1;
      }
    }
    
    if (Object.keys(jobStats).length > 0) {
      this.ctx.fillStyle = "#fff";
      this.ctx.fillText("Jobs:", 10, yOffset + 10);
      yOffset += 30;
      for (const [job, count] of Object.entries(jobStats)) {
        this.ctx.fillText(`  ${job}: ${count}`, 20, yOffset);
        yOffset += 18;
      }
    }
  }
}
