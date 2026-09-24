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
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        // Keep camera within map bounds
        this.camera.x = Math.max(0, Math.min(this.world.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.world.height, this.camera.y));
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
      this.camera.zoom = Math.max(1.5, Math.min(25, this.camera.zoom));
    }, { passive: false });
    
    // Click to use god powers
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
    this.renderSettlementTerritories();
    this.renderDiplomacyLines(); // Inter-realm alliances, wars & tension lines
    this.renderResources();
    this.renderInfrastructure(); // Roads, bridges, irrigation
    this.renderBuildings();
    this.renderSettlements();
    this.renderAgents();
    this.renderCombatEffects(); // Clashing weapons, sparks, damage & casualty markers
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
    const zoom = this.camera.zoom;
    const isDetailed = zoom >= 3.5;

    for (const resource of this.simulation.resources) {
      if (resource.destroyed) continue;
      const screen = this.worldToScreen(resource.x, resource.y);
      
      // Skip offscreen
      if (screen.x < -30 || screen.x > this.canvas.width + 30 || screen.y < -30 || screen.y > this.canvas.height + 30) {
        continue;
      }

      const type = resource.resourceType;
      const isDepleted = resource.amount <= 0;
      
      this.ctx.save();

      if (type === "wood") {
        // Timber / Trees
        if (isDetailed) {
          const r = Math.max(3, zoom * 0.45);
          if (isDepleted) {
            // Small tree stump with green sprout
            this.ctx.fillStyle = "#5c2c16";
            this.ctx.fillRect(screen.x - r * 0.35, screen.y - r * 0.2, r * 0.7, r * 0.5);
            this.ctx.fillStyle = "#22c55e";
            this.ctx.beginPath();
            this.ctx.arc(screen.x, screen.y - r * 0.3, r * 0.25, 0, Math.PI * 2);
            this.ctx.fill();
          } else {
            // Tree trunk
            this.ctx.fillStyle = "#5c2c16";
            this.ctx.fillRect(screen.x - r * 0.2, screen.y, r * 0.4, r * 0.6);
            // Lower canopy
            this.ctx.fillStyle = "#14532d";
            this.ctx.beginPath();
            this.ctx.arc(screen.x, screen.y - r * 0.1, r * 0.8, 0, Math.PI * 2);
            this.ctx.fill();
            // Upper canopy
            this.ctx.fillStyle = "#16a34a";
            this.ctx.beginPath();
            this.ctx.arc(screen.x, screen.y - r * 0.35, r * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            // Highlight
            this.ctx.fillStyle = "#4ade80";
            this.ctx.beginPath();
            this.ctx.arc(screen.x - r * 0.15, screen.y - r * 0.45, r * 0.25, 0, Math.PI * 2);
            this.ctx.fill();
          }
        } else {
          // Low-zoom tree
          this.ctx.fillStyle = "#15803d";
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, Math.max(2, zoom * 0.35), 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#052e16";
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      } else if (type === "food") {
        // Wild Food / Berry Bush / Wheat
        if (isDetailed) {
          const r = Math.max(3, zoom * 0.4);
          // Bush base
          this.ctx.fillStyle = "#4d7c0f";
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, r * 0.7, 0, Math.PI * 2);
          this.ctx.fill();
          
          if (!isDepleted) {
            // Ripe berries / wheat grains
            this.ctx.fillStyle = "#ef4444";
            this.ctx.beginPath();
            this.ctx.arc(screen.x - r * 0.25, screen.y - r * 0.2, r * 0.22, 0, Math.PI * 2);
            this.ctx.arc(screen.x + r * 0.25, screen.y - r * 0.1, r * 0.22, 0, Math.PI * 2);
            this.ctx.arc(screen.x, screen.y + r * 0.25, r * 0.22, 0, Math.PI * 2);
            this.ctx.fill();

            // Golden glint
            this.ctx.fillStyle = "#fbbf24";
            this.ctx.beginPath();
            this.ctx.arc(screen.x + r * 0.05, screen.y - r * 0.25, r * 0.14, 0, Math.PI * 2);
            this.ctx.fill();
          }
        } else {
          // Low-zoom food
          this.ctx.fillStyle = "#ef4444";
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, Math.max(2, zoom * 0.3), 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#991b1b";
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      } else if (type === "ore") {
        // Mineral Ore Deposits / Rock Vein
        if (isDetailed) {
          const r = Math.max(3, zoom * 0.42);
          // Stone boulder shape
          this.ctx.fillStyle = "#334155";
          this.ctx.beginPath();
          this.ctx.moveTo(screen.x - r * 0.7, screen.y + r * 0.4);
          this.ctx.lineTo(screen.x - r * 0.5, screen.y - r * 0.5);
          this.ctx.lineTo(screen.x + r * 0.3, screen.y - r * 0.6);
          this.ctx.lineTo(screen.x + r * 0.8, screen.y);
          this.ctx.lineTo(screen.x + r * 0.4, screen.y + r * 0.5);
          this.ctx.closePath();
          this.ctx.fill();

          // Stone body facet
          this.ctx.fillStyle = "#64748b";
          this.ctx.beginPath();
          this.ctx.moveTo(screen.x - r * 0.4, screen.y - r * 0.3);
          this.ctx.lineTo(screen.x + r * 0.2, screen.y - r * 0.4);
          this.ctx.lineTo(screen.x + r * 0.1, screen.y + r * 0.2);
          this.ctx.lineTo(screen.x - r * 0.3, screen.y + r * 0.1);
          this.ctx.closePath();
          this.ctx.fill();

          if (!isDepleted) {
            // Metallic mineral ore veins (gold & silver flecks)
            this.ctx.fillStyle = "#fbbf24"; // Gold ore glint
            this.ctx.fillRect(screen.x - r * 0.2, screen.y - r * 0.25, r * 0.2, r * 0.2);
            this.ctx.fillRect(screen.x + r * 0.15, screen.y - r * 0.1, r * 0.2, r * 0.2);
            this.ctx.fillStyle = "#f8fafc"; // Specular sparkle
            this.ctx.fillRect(screen.x - r * 0.1, screen.y + r * 0.05, r * 0.15, r * 0.15);
          }
        } else {
          // Low-zoom ore
          this.ctx.fillStyle = "#94a3b8";
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, Math.max(2, zoom * 0.3), 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = "#475569";
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      } else {
        // Water Spring
        const r = Math.max(2.5, zoom * 0.35);
        this.ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, r * 1.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = "#0284c7";
        this.ctx.beginPath();
        this.ctx.arc(screen.x, screen.y, r * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }

  getResourceColor(type) {
    const colors = {
      food: "#ef4444",
      water: "#38bdf8",
      wood: "#15803d",
      ore: "#94a3b8"
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
    const allBuildings = [...this.simulation.buildings];
    if (this.simulation.settlementSystem) {
      for (const settlement of this.simulation.settlementSystem.settlements.values()) {
        if (settlement.buildings) {
          for (const b of settlement.buildings) {
            if (!allBuildings.some(existing => existing.x === b.x && existing.y === b.y)) {
              allBuildings.push(b);
            }
          }
        }
      }
    }
    if (this.simulation.craftingSystem && this.simulation.craftingSystem.workshops) {
      for (const workshop of this.simulation.craftingSystem.workshops.values()) {
        if (!allBuildings.some(existing => existing.x === workshop.x && existing.y === workshop.y)) {
          allBuildings.push(workshop);
        }
      }
    }
    if (this.simulation.constructionSystem && this.simulation.constructionSystem.pendingBuildings) {
      for (const pending of this.simulation.constructionSystem.pendingBuildings) {
        if (!allBuildings.some(existing => existing.x === pending.x && existing.y === pending.y)) {
          allBuildings.push(pending);
        }
      }
    }

    for (const building of allBuildings) {
      const screen = this.worldToScreen(building.x, building.y);
      const bType = building.buildingType || building.type;
      
      // Base building color based on type
      let buildingColor = "#8b5cf6"; // default purple
      if (bType === "house") buildingColor = "#f59e0b";
      else if (bType === "workshop") buildingColor = "#78350f";
      else if (bType === "farm") buildingColor = "#22c55e";
      else if (bType === "mine") buildingColor = "#6b7280";
      else if (bType === "temple") buildingColor = "#fbbf24";
      else if (bType === "wall") buildingColor = "#4b5563";
      else if (bType === "tower") buildingColor = "#dc2626";
      
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
    const now = Date.now();
    for (const agent of this.simulation.agents) {
      if (!agent.alive) continue;
      
      const screen = this.worldToScreen(agent.x, agent.y);
      const zoom = this.camera.zoom;
      const size = zoom * 0.42;

      // Skip offscreen agents
      if (screen.x < -40 || screen.x > this.canvas.width + 40 || screen.y < -40 || screen.y > this.canvas.height + 40) {
        continue;
      }

      const isMoving = Boolean(agent.path && agent.path.length > 0);
      const walkCycle = isMoving ? Math.sin(now * 0.014 + agent.id * 2.2) : 0;
      const agentScreenY = screen.y + (isMoving ? Math.abs(walkCycle) * -size * 0.22 : 0);

      // 1. Soft Ground Shadow
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      this.ctx.beginPath();
      this.ctx.ellipse(screen.x, screen.y + size * 0.75, size * 0.75, size * 0.35, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. Selection Ring if active
      if (this.selectedEntity && this.selectedEntity.id === agent.id) {
        this.ctx.strokeStyle = "#38bdf8";
        this.ctx.lineWidth = Math.max(2, zoom * 0.12);
        this.ctx.beginPath();
        this.ctx.arc(screen.x, agentScreenY, size * 1.5, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(screen.x, agentScreenY, size * 1.8 + Math.sin(now * 0.008) * 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // 3. Agent Body - color based on role & activity
      let bodyColor = "#fbbf24"; // default warm citizen yellow
      if (agent.currentAction) {
        switch(typeof agent.currentAction === 'string' ? agent.currentAction : agent.currentAction.type) {
          case "chop_wood": bodyColor = "#16a34a"; break;
          case "mine_ore": bodyColor = "#94a3b8"; break;
          case "gather_food": 
          case "farm": bodyColor = "#eab308"; break;
          case "drink_water": bodyColor = "#38bdf8"; break;
          case "rest": bodyColor = "#a855f7"; break;
          case "socialize": bodyColor = "#ec4899"; break;
          case "reproduce": bodyColor = "#f43f5e"; break;
          case "build": bodyColor = "#d97706"; break;
          case "craft": bodyColor = "#64748b"; break;
          case "trade": bodyColor = "#f59e0b"; break;
          case "military_duty":
          case "combat": bodyColor = "#dc2626"; break;
          case "flee": bodyColor = "#ef4444"; break;
        }
      }
      
      // Override for prominent jobs
      if (agent.militaryDuty || agent.combatRole === "commander" || agent.job === "soldier") bodyColor = "#dc2626";
      else if (agent.role === "priest" || agent.job === "priest") bodyColor = "#f59e0b";
      else if (agent.role === "builder" || agent.job === "builder") bodyColor = "#b45309";
      else if (agent.role === "lumberjack" || agent.job === "lumberjack") bodyColor = "#15803d";
      else if (agent.role === "miner" || agent.job === "miner") bodyColor = "#475569";
      else if (agent.role === "farmer" || agent.job === "farmer") bodyColor = "#84cc16";

      // Draw Main Body Sphere
      this.ctx.fillStyle = bodyColor;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, agentScreenY, size, 0, Math.PI * 2);
      this.ctx.fill();

      // Outer outline
      this.ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
      this.ctx.lineWidth = Math.max(1, size * 0.16);
      this.ctx.stroke();

      // Inner face / lighting highlight
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      this.ctx.beginPath();
      this.ctx.arc(screen.x - size * 0.28, agentScreenY - size * 0.28, size * 0.35, 0, Math.PI * 2);
      this.ctx.fill();

      // 4. Animated Active Tools in hand
      const actType = agent.currentAction?.type;
      if (actType === "chop_wood") {
        // Swinging Woodcutter Axe
        const swing = Math.sin(now * 0.016 + agent.id);
        this.ctx.save();
        this.ctx.translate(screen.x + size * 0.7, agentScreenY);
        this.ctx.rotate(swing * 0.6);
        // Handle
        this.ctx.strokeStyle = "#78350f";
        this.ctx.lineWidth = Math.max(1.5, size * 0.22);
        this.ctx.beginPath();
        this.ctx.moveTo(0, size * 0.3);
        this.ctx.lineTo(0, -size * 0.9);
        this.ctx.stroke();
        // Axe Head
        this.ctx.fillStyle = "#94a3b8";
        this.ctx.fillRect(-size * 0.1, -size * 0.9, size * 0.5, size * 0.3);
        this.ctx.restore();
      } else if (actType === "mine_ore") {
        // Swinging Miner Pickaxe
        const swing = Math.sin(now * 0.018 + agent.id);
        this.ctx.save();
        this.ctx.translate(screen.x + size * 0.7, agentScreenY);
        this.ctx.rotate(swing * 0.7);
        this.ctx.strokeStyle = "#52525b";
        this.ctx.lineWidth = Math.max(1.5, size * 0.2);
        this.ctx.beginPath();
        this.ctx.moveTo(0, size * 0.3);
        this.ctx.lineTo(0, -size * 0.9);
        this.ctx.stroke();
        // Curved pick blade
        this.ctx.strokeStyle = "#cbd5e1";
        this.ctx.lineWidth = Math.max(2, size * 0.25);
        this.ctx.beginPath();
        this.ctx.arc(0, -size * 0.9, size * 0.45, Math.PI * 0.7, Math.PI * 1.5);
        this.ctx.stroke();
        this.ctx.restore();
      } else if (actType === "build") {
        // Swinging Builder Hammer
        const swing = Math.sin(now * 0.015 + agent.id);
        this.ctx.save();
        this.ctx.translate(screen.x + size * 0.7, agentScreenY);
        this.ctx.rotate(swing * 0.5);
        this.ctx.strokeStyle = "#78350f";
        this.ctx.lineWidth = Math.max(1.5, size * 0.2);
        this.ctx.beginPath();
        this.ctx.moveTo(0, size * 0.2);
        this.ctx.lineTo(0, -size * 0.7);
        this.ctx.stroke();
        this.ctx.fillStyle = "#475569";
        this.ctx.fillRect(-size * 0.25, -size * 0.85, size * 0.5, size * 0.28);
        this.ctx.restore();
      }

      // 5. Military Gear (helm, spear, shield)
      if (agent.militaryDuty || agent.job === "soldier" || agent.combatRole) {
        this.ctx.save();
        // Iron Helm
        this.ctx.fillStyle = "#94a3b8";
        this.ctx.beginPath();
        this.ctx.arc(screen.x, agentScreenY - size * 0.45, size * 0.65, Math.PI, 0);
        this.ctx.fill();

        // Spear or Sword
        this.ctx.strokeStyle = "#cbd5e1";
        this.ctx.lineWidth = Math.max(1.5, size * 0.25);
        this.ctx.beginPath();
        this.ctx.moveTo(screen.x + size * 0.5, agentScreenY + size * 0.5);
        this.ctx.lineTo(screen.x + size * 1.5, agentScreenY - size * 0.9);
        this.ctx.stroke();

        // Shield
        const sid = agent.settlementId || (this.simulation.settlementSystem?.agentSettlementMap.get(agent.id));
        const s = sid ? this.simulation.settlementSystem?.settlements.get(sid) : null;
        const shieldColor = s?.bannerColor || "#38bdf8";

        this.ctx.fillStyle = shieldColor;
        this.ctx.strokeStyle = "#1e293b";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(screen.x - size * 0.7, agentScreenY, size * 0.55, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      }
      
      // 6. Health Bar
      const curHp = agent.needs?.health ?? (agent.combat?.health ?? (agent.health ?? 100));
      if (curHp < 95 || agent.militaryDuty) {
        const healthPercent = Math.max(0, Math.min(1, curHp / 100));
        const barWidth = size * 2.8;
        const barHeight = Math.max(2.5, zoom * 0.18);
        
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        this.ctx.fillRect(screen.x - barWidth / 2, agentScreenY - size - 8, barWidth, barHeight);
        
        const healthColor = healthPercent > 0.6 ? "#22c55e" : healthPercent > 0.3 ? "#f59e0b" : "#dc2626";
        this.ctx.fillStyle = healthColor;
        this.ctx.fillRect(screen.x - barWidth / 2, agentScreenY - size - 8, barWidth * healthPercent, barHeight);
      }
      
      // 7. Expressive Floating Action Badge & Label (when zoomed in)
      if (zoom >= 8) {
        let actionEmoji = "🚶";
        let actionLabel = agent.jobTitle || "Exploring";
        
        if (agent.currentAction) {
          const actionType = typeof agent.currentAction === 'string' ? agent.currentAction : agent.currentAction?.type;
          switch(actionType) {
            case "chop_wood": actionEmoji = "🪓"; actionLabel = "Chopping Wood"; break;
            case "mine_ore": actionEmoji = "⛏️"; actionLabel = "Mining Ore"; break;
            case "gather_food": 
            case "farm": actionEmoji = "🌾"; actionLabel = "Harvesting"; break;
            case "drink_water": actionEmoji = "💧"; actionLabel = "Drinking"; break;
            case "build": actionEmoji = "🔨"; actionLabel = "Building"; break;
            case "craft": actionEmoji = "⚙️"; actionLabel = "Crafting"; break;
            case "socialize": actionEmoji = "💬"; actionLabel = "Chatting"; break;
            case "reproduce": actionEmoji = "❤️"; actionLabel = "Courting"; break;
            case "eat_from_inventory":
            case "eat_from_stockpile": actionEmoji = "🍞"; actionLabel = "Eating"; break;
            case "rest": actionEmoji = "💤"; actionLabel = "Resting"; break;
            case "military_duty":
            case "combat": actionEmoji = "⚔️"; actionLabel = "In Combat"; break;
            case "flee": actionEmoji = "🏃"; actionLabel = "Fleeing!"; break;
            case "wander": actionEmoji = "🚶"; actionLabel = "Exploring"; break;
            default: actionEmoji = "⚡"; actionLabel = String(actionType ?? 'Unknown').replace(/_/g, ' '); break;
          }
        } else if (isMoving) {
          actionEmoji = "🚶";
          actionLabel = agent.job ? `Heading to ${agent.job}` : "Walking";
        }

        const fontSize = Math.max(9, Math.min(13, zoom * 0.65));
        this.ctx.font = `600 ${fontSize}px sans-serif`;
        const fullText = `${actionEmoji} ${actionLabel}`;
        const textMetrics = this.ctx.measureText(fullText);
        const pillWidth = textMetrics.width + 12;
        const pillHeight = fontSize + 6;
        const pillY = agentScreenY - size - 14 - pillHeight / 2;

        // Frosted action pill background
        this.ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(screen.x - pillWidth / 2, pillY - pillHeight / 2, pillWidth, pillHeight, 6);
        this.ctx.fill();
        this.ctx.stroke();

        // Text
        this.ctx.fillStyle = "#f8fafc";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(fullText, screen.x, pillY);

        // Name tag right under agent if close-up
        if (zoom >= 14) {
          this.ctx.font = `500 ${Math.max(8, zoom * 0.45)}px sans-serif`;
          this.ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
          this.ctx.fillText(agent.name, screen.x, agentScreenY + size + 9);
        }
      }
    }
  }

  renderSettlementTerritories() {
    if (!this.simulation || !this.simulation.settlementSystem) return;
    
    for (const s of this.simulation.settlementSystem.settlements.values()) {
      if (!s.center) continue;
      const screen = this.worldToScreen(s.center.x, s.center.y);
      const tierInfo = this.simulation.settlementSystem.getTierInfo ? 
        this.simulation.settlementSystem.getTierInfo(s.population || (s.agentIds ? s.agentIds.size : 1)) : 
        { radius: 14 };
      const worldRadius = tierInfo.radius || 14;
      const screenRadius = worldRadius * this.camera.zoom;
      
      // Viewport culling
      if (screen.x + screenRadius < 0 || screen.x - screenRadius > this.canvas.width ||
          screen.y + screenRadius < 0 || screen.y - screenRadius > this.canvas.height) {
        continue;
      }
      
      const color = s.bannerColor || s.culture?.bannerColor || "#38bdf8";
      
      this.ctx.save();
      // Soft translucent territory glow
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.hexToRgba(color, 0.08);
      this.ctx.fill();
      
      // Dashed boundary
      this.ctx.strokeStyle = this.hexToRgba(color, 0.4);
      this.ctx.lineWidth = Math.max(1, Math.min(2.5, this.camera.zoom * 0.12));
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  renderSettlements() {
    if (!this.simulation || !this.simulation.settlementSystem) return;

    const time = Date.now() * 0.003;

    for (const s of this.simulation.settlementSystem.settlements.values()) {
      if (!s.center) continue;
      const screen = this.worldToScreen(s.center.x, s.center.y);
      if (screen.x < -180 || screen.x > this.canvas.width + 180 || screen.y < -180 || screen.y > this.canvas.height + 180) {
        continue;
      }

      const pop = s.population || (s.agentIds ? s.agentIds.size : 0);
      const tier = s.tier || "Village";
      const icon = s.tierIcon || "🏡";
      const bannerColor = s.bannerColor || s.culture?.bannerColor || "#38bdf8";
      const zoom = this.camera.zoom;

      this.ctx.save();

      // 1. Draw Town Center Hearth & Plinth
      const plinthR = Math.max(5, zoom * 0.65);
      
      // Stone foundation
      this.ctx.fillStyle = "#475569";
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, plinthR, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "#1e293b";
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Inner cobblestone
      this.ctx.fillStyle = "#64748b";
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, plinthR * 0.7, 0, Math.PI * 2);
      this.ctx.fill();

      // Communal Campfire / Hearth Flame
      const flameFlicker = Math.sin(time * 3 + s.id) * 0.2 + 0.8;
      this.ctx.fillStyle = "#f97316";
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y - plinthR * 0.1, Math.max(2, plinthR * 0.35 * flameFlicker), 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = "#fbbf24";
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y - plinthR * 0.2, Math.max(1.2, plinthR * 0.2 * flameFlicker), 0, Math.PI * 2);
      this.ctx.fill();

      // Banner Pole & Fluttering Flag
      const poleH = Math.max(12, zoom * 1.3);
      const poleX = screen.x + plinthR * 0.55;
      const poleBaseY = screen.y;
      
      // Pole
      this.ctx.strokeStyle = "#78350f";
      this.ctx.lineWidth = Math.max(1.5, zoom * 0.12);
      this.ctx.beginPath();
      this.ctx.moveTo(poleX, poleBaseY);
      this.ctx.lineTo(poleX, poleBaseY - poleH);
      this.ctx.stroke();

      // Flag fluttering wave
      const wave = Math.sin(time * 2 + s.id) * 2;
      const flagW = Math.max(8, zoom * 0.85);
      const flagH = Math.max(6, zoom * 0.55);

      this.ctx.fillStyle = bannerColor;
      this.ctx.beginPath();
      this.ctx.moveTo(poleX, poleBaseY - poleH);
      this.ctx.quadraticCurveTo(poleX + flagW * 0.5, poleBaseY - poleH + wave, poleX + flagW, poleBaseY - poleH + wave * 0.5);
      this.ctx.lineTo(poleX + flagW, poleBaseY - poleH + flagH + wave * 0.5);
      this.ctx.quadraticCurveTo(poleX + flagW * 0.5, poleBaseY - poleH + flagH, poleX, poleBaseY - poleH + flagH);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = "rgba(0,0,0,0.3)";
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

      // 2. Draw Floating Society Nameplate & Badge
      const isSelected = this.selectedEntity && this.selectedEntity.kind === "settlement" && this.selectedEntity.entity?.id === s.id;
      
      const badgeY = screen.y - plinthR - Math.max(18, poleH + 12);
      const titleText = `${icon} ${s.name}`;
      const subText = `${tier} • 👥 ${pop}${s.culture?.ethos ? ` • ${s.culture.symbol} ${s.culture.ethos}` : ''}`;
      
      this.ctx.font = "bold 12px sans-serif";
      const titleWidth = this.ctx.measureText(titleText).width;
      this.ctx.font = "10px sans-serif";
      const subWidth = this.ctx.measureText(subText).width;
      const badgeWidth = Math.max(titleWidth, subWidth) + 20;
      const badgeHeight = 32;

      // Drop shadow & background card
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      this.ctx.shadowBlur = 8;
      this.ctx.shadowOffsetY = 3;

      this.ctx.fillStyle = isSelected ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.85)";
      this.ctx.beginPath();
      this.ctx.roundRect(screen.x - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 6);
      this.ctx.fill();

      this.ctx.shadowColor = "transparent";
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetY = 0;

      // Border matching banner color
      this.ctx.strokeStyle = isSelected ? "#38bdf8" : bannerColor;
      this.ctx.lineWidth = isSelected ? 2.5 : 1.5;
      this.ctx.stroke();

      // Title Text
      this.ctx.fillStyle = "#f8fafc";
      this.ctx.font = "bold 11px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(titleText, screen.x, badgeY - 6);

      // Subtitle Text
      this.ctx.fillStyle = "#94a3b8";
      this.ctx.font = "9px sans-serif";
      this.ctx.fillText(subText, screen.x, badgeY + 7);

      this.ctx.restore();
    }
  }

  hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return `rgba(56, 189, 248, ${alpha})`;
    let c = hex.substring(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  renderDiplomacyLines() {
    if (!this.simulation || !this.simulation.diplomacySystem || !this.simulation.settlementSystem) return;

    const diplomacy = this.simulation.diplomacySystem;
    const settlements = this.simulation.settlementSystem.settlements;

    for (const [key, rel] of diplomacy.relations) {
      // Only draw relations if active war, alliance, or tension to maintain visual clarity
      if (rel.status === "peace" && rel.score < 80) continue;

      const s1 = settlements.get(rel.settlementA);
      const s2 = settlements.get(rel.settlementB);
      if (!s1 || !s2 || !s1.center || !s2.center) continue;

      const p1 = this.worldToScreen(s1.center.x, s1.center.y);
      const p2 = this.worldToScreen(s2.center.x, s2.center.y);

      this.ctx.save();

      let strokeColor = "#22c55e"; // Alliance green
      let icon = "🤝";
      let lineWidth = 2;
      let dash = [6, 4];

      if (rel.status === "war") {
        strokeColor = "#ef4444";
        icon = "⚔️";
        lineWidth = 2.5;
        const offset = (Date.now() * 0.02) % 16;
        this.ctx.lineDashOffset = -offset;
        dash = [8, 4];
      } else if (rel.status === "tension") {
        strokeColor = "#f59e0b";
        icon = "⚠️";
        lineWidth = 1.5;
        dash = [4, 6];
      }

      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.setLineDash(dash);

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();

      // Midpoint badge
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      this.ctx.setLineDash([]);
      this.ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      this.ctx.beginPath();
      this.ctx.arc(midX, midY, 11, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.font = "11px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(icon, midX, midY + 1);

      this.ctx.restore();
    }
  }

  renderCombatEffects() {
    if (!this.simulation || !this.simulation.warfareSystem) return;

    const effects = this.simulation.warfareSystem.combatEffects;
    if (!effects || effects.length === 0) return;

    this.ctx.save();
    for (const eff of effects) {
      const screen = this.worldToScreen(eff.x, eff.y);
      const alpha = Math.max(0.1, eff.duration / 25);

      if (eff.type === "clash") {
        this.ctx.font = `${Math.max(12, this.camera.zoom * 1.4)}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("⚔️", screen.x, screen.y - (25 - eff.duration) * 0.8);
      } else if (eff.type === "casualty") {
        this.ctx.font = `${Math.max(10, this.camera.zoom)}px sans-serif`;
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        this.ctx.fillText("💀", screen.x, screen.y - (25 - eff.duration) * 0.5);
      }
    }
    this.ctx.restore();
  }

  renderUI() {
    // Selected entity highlight
    if (this.selectedEntity) {
      const e = this.selectedEntity.entity || this.selectedEntity;
      if (e && e.x !== undefined && e.y !== undefined) {
        const screen = this.worldToScreen(e.x, e.y);
        this.ctx.save();
        this.ctx.strokeStyle = "#38bdf8";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        const radius = Math.max(14, this.camera.zoom * 1.5);
        this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        if (e.name) {
          this.ctx.fillStyle = "#38bdf8";
          this.ctx.font = "bold 11px sans-serif";
          this.ctx.textAlign = "center";
          this.ctx.fillText(e.name, screen.x, screen.y - radius - 6);
        }
        this.ctx.restore();
      }
    }
  }
}
