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
      e.preventDefault();
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    
    this.canvas.addEventListener("mousemove", (e) => {
      if (isDragging) {
        e.preventDefault();
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
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
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoom *= zoomFactor;
      this.camera.zoom = Math.max(2, Math.min(20, this.camera.zoom));
    }, { passive: false });
    
    // Click to use god powers
    this.canvas.addEventListener("click", (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPos = this.screenToWorld(screenX, screenY);
      
      // Dispatch custom event on window to ensure it's caught
      window.dispatchEvent(new CustomEvent("worldclick", {
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
    this.renderInfrastructure(); // Roads, bridges, irrigation
    this.renderBuildings();
    this.renderAgents();
    this.renderParticles(); // Ritual effects, combat effects
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

  renderInfrastructure() {
    // Check if infrastructure system exists
    if (!this.simulation.infrastructureSystem) return;
    
    const infrastructures = this.simulation.infrastructureSystem.infrastructures;
    if (!infrastructures) return;
    
    for (const infra of infrastructures) {
      const screen = this.worldToScreen(infra.x, infra.y);
      
      if (infra.type === "road") {
        // Render road segment
        this.ctx.fillStyle = "#d6d3d1"; // Light gray
        this.ctx.strokeStyle = "#a8a29e"; // Darker gray border
        this.ctx.lineWidth = Math.max(2, this.camera.zoom * 0.3);
        
        // Draw line in direction of road
        const length = this.camera.zoom * 0.8;
        const angle = infra.direction || 0;
        const dx = Math.cos(angle) * length / 2;
        const dy = Math.sin(angle) * length / 2;
        
        this.ctx.beginPath();
        this.ctx.moveTo(screen.x - dx, screen.y - dy);
        this.ctx.lineTo(screen.x + dx, screen.y + dy);
        this.ctx.stroke();
        
        // Road health indicator if damaged
        if (infra.health !== undefined && infra.maxHealth !== undefined) {
          const healthPercent = infra.health / infra.maxHealth;
          if (healthPercent < 0.8) {
            this.ctx.fillStyle = healthPercent > 0.4 ? "#f59e0b" : "#dc2626";
            this.ctx.fillRect(screen.x - 3, screen.y - 3, 6, 6);
          }
        }
      } 
      else if (infra.type === "bridge") {
        // Render bridge
        this.ctx.fillStyle = "#78350f"; // Brown wood
        const bridgeSize = this.camera.zoom * 0.6;
        this.ctx.fillRect(
          screen.x - bridgeSize,
          screen.y - bridgeSize / 2,
          bridgeSize * 2,
          bridgeSize
        );
        
        // Bridge health bar
        if (infra.health !== undefined && infra.maxHealth !== undefined) {
          const healthPercent = infra.health / infra.maxHealth;
          const barWidth = bridgeSize * 2;
          const barHeight = 3;
          
          this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          this.ctx.fillRect(screen.x - barWidth/2, screen.y - bridgeSize - 5, barWidth, barHeight);
          
          this.ctx.fillStyle = healthPercent > 0.5 ? "#22c55e" : "#dc2626";
          this.ctx.fillRect(screen.x - barWidth/2, screen.y - bridgeSize - 5, barWidth * healthPercent, barHeight);
        }
      }
      else if (infra.type === "irrigation") {
        // Render irrigation channel
        this.ctx.fillStyle = "#3b82f6"; // Blue water
        this.ctx.strokeStyle = "#1e40af";
        this.ctx.lineWidth = Math.max(1, this.camera.zoom * 0.2);
        
        const irrigSize = this.camera.zoom * 0.4;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, irrigSize, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Active effect (pulsing)
        if (infra.active) {
          this.ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, irrigSize + 2, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }
    }
  }

  renderParticles() {
    // Render ritual effects from religion system
    if (this.simulation.religionSystem && this.simulation.religionSystem.activeRituals) {
      for (const ritual of this.simulation.religionSystem.activeRituals) {
        const screen = this.worldToScreen(ritual.x, ritual.y);
        const baseRadius = this.camera.zoom * 0.8;
        
        // Golden glow effect
        const gradient = this.ctx.createRadialGradient(
          screen.x, screen.y, 0,
          screen.x, screen.y, baseRadius * 2
        );
        gradient.addColorStop(0, "rgba(251, 191, 36, 0.8)");
        gradient.addColorStop(0.5, "rgba(251, 191, 36, 0.3)");
        gradient.addColorStop(1, "rgba(251, 191, 36, 0)");
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, baseRadius * 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Sparkle particles
        this.ctx.fillStyle = "#fff";
        for (let i = 0; i < 5; i++) {
          const angle = (Date.now() / 500 + i * 0.5) % (Math.PI * 2);
          const radius = baseRadius * (0.5 + Math.sin(Date.now() / 200 + i) * 0.3);
          const px = screen.x + Math.cos(angle) * radius;
          const py = screen.y + Math.sin(angle) * radius;
          this.ctx.beginPath();
          this.ctx.arc(px, py, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
    
    // Render combat effects
    if (this.simulation.combatSystem && this.simulation.combatSystem.activeBattles) {
      for (const battle of this.simulation.combatSystem.activeBattles) {
        const screen = this.worldToScreen(battle.x, battle.y);
        const battleRadius = this.camera.zoom * 1.5;
        
        // Red danger zone
        this.ctx.strokeStyle = "rgba(220, 38, 38, 0.3)";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, battleRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Clash indicators
        if (battle.attackers && battle.defenders) {
          const totalFighters = battle.attackers.length + battle.defenders.length;
          this.ctx.fillStyle = "#dc2626";
          this.ctx.font = `${Math.max(10, this.camera.zoom)}px Arial`;
          this.ctx.textAlign = "center";
          this.ctx.fillText(`⚔ ${totalFighters}`, screen.x, screen.y - battleRadius - 5);
        }
      }
    }
  }

  renderBuildings() {
    for (const building of this.simulation.buildings) {
      const screen = this.worldToScreen(building.x, building.y);
      
      // Base building color based on type
      let buildingColor = "#8b5cf6"; // default purple
      if (building.type === "house") buildingColor = "#f59e0b";
      else if (building.type === "workshop") buildingColor = "#78350f";
      else if (building.type === "farm") buildingColor = "#22c55e";
      else if (building.type === "mine") buildingColor = "#6b7280";
      else if (building.type === "temple") buildingColor = "#fbbf24";
      else if (building.type === "wall") buildingColor = "#4b5563";
      else if (building.type === "tower") buildingColor = "#dc2626";
      
      this.ctx.fillStyle = buildingColor;
      this.ctx.fillRect(
        screen.x - this.camera.zoom * 0.4,
        screen.y - this.camera.zoom * 0.4,
        this.camera.zoom * 0.8,
        this.camera.zoom * 0.8
      );
      
      // Construction progress overlay
      if (building.constructionProgress !== undefined && building.constructionProgress < 100) {
        const progress = building.constructionProgress / 100;
        const barWidth = this.camera.zoom * 0.8;
        const barHeight = 4;
        
        // Background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(
          screen.x - barWidth / 2,
          screen.y - this.camera.zoom * 0.5,
          barWidth,
          barHeight
        );
        
        // Progress fill
        this.ctx.fillStyle = "#22c55e";
        this.ctx.fillRect(
          screen.x - barWidth / 2,
          screen.y - this.camera.zoom * 0.5,
          barWidth * progress,
          barHeight
        );
        
        // Percentage text
        if (this.camera.zoom > 4) {
          this.ctx.fillStyle = "#fff";
          this.ctx.font = `${Math.max(8, this.camera.zoom * 0.8)}px monospace`;
          this.ctx.textAlign = "center";
          this.ctx.fillText(`${Math.round(progress * 100)}%`, screen.x, screen.y - this.camera.zoom * 0.6);
        }
      }
      
      // Building health bar (for walls, towers, etc.)
      if (building.health !== undefined && building.maxHealth !== undefined) {
        const healthPercent = building.health / building.maxHealth;
        const barWidth = this.camera.zoom * 0.8;
        const barHeight = 3;
        
        // Background
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        this.ctx.fillRect(
          screen.x - barWidth / 2,
          screen.y + this.camera.zoom * 0.5,
          barWidth,
          barHeight
        );
        
        // Health fill (green to red gradient)
        const healthColor = healthPercent > 0.6 ? "#22c55e" : 
                           healthPercent > 0.3 ? "#f59e0b" : "#dc2626";
        this.ctx.fillStyle = healthColor;
        this.ctx.fillRect(
          screen.x - barWidth / 2,
          screen.y + this.camera.zoom * 0.5,
          barWidth * healthPercent,
          barHeight
        );
      }
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
          case "build": bodyColor = "#78350f"; break;
          case "craft": bodyColor = "#6b7280"; break;
          case "trade": bodyColor = "#f59e0b"; break;
          case "combat": bodyColor = "#dc2626"; break;
          case "flee": bodyColor = "#ef4444"; break;
        }
      }
      
      // Override color for special roles
      if (agent.role === "priest") bodyColor = "#fbbf24"; // Golden for priests
      else if (agent.role === "builder") bodyColor = "#78350f"; // Brown for builders
      else if (agent.role === "soldier") bodyColor = "#dc2626"; // Red for soldiers
      else if (agent.role === "merchant") bodyColor = "#10b981"; // Green for merchants
      
      this.ctx.fillStyle = bodyColor;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Health bar for agents in combat or low health
      if (agent.health !== undefined && agent.maxHealth !== undefined) {
        const healthPercent = agent.health / agent.maxHealth;
        
        // Only show health bar if damaged or in combat
        if (healthPercent < 1.0 || agent.currentAction?.type === "combat") {
          const barWidth = size * 2.5;
          const barHeight = 3;
          
          // Background
          this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          this.ctx.fillRect(
            screen.x - barWidth / 2,
            screen.y - size - 8,
            barWidth,
            barHeight
          );
          
          // Health fill (green to red gradient)
          const healthColor = healthPercent > 0.6 ? "#22c55e" : 
                             healthPercent > 0.3 ? "#f59e0b" : "#dc2626";
          this.ctx.fillStyle = healthColor;
          this.ctx.fillRect(
            screen.x - barWidth / 2,
            screen.y - size - 8,
            barWidth * healthPercent,
            barHeight
          );
        }
      }
      
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
        this.ctx.fillText(actionText, screen.x, screen.y - size - 12);
      }
      
      // Age indicator for old agents
      if (agent.age > agent.maxAge * 0.8) {
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, size + 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      
      // Combat indicator (sword icon)
      if (agent.currentAction?.type === "combat" || agent.currentAction?.type === "flee") {
        this.ctx.fillStyle = "#dc2626";
        this.ctx.font = `${Math.max(10, this.camera.zoom * 1.2)}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.fillText("⚔", screen.x + size, screen.y - size);
      }
      
      // Priest ritual indicator
      if (agent.role === "priest" && agent.currentAction?.type === "ritual") {
        this.ctx.fillStyle = "#fbbf24";
        this.ctx.font = `${Math.max(10, this.camera.zoom * 1.2)}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.fillText("✨", screen.x, screen.y - size - 12);
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
