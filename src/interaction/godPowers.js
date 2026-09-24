// God powers and player interaction (doc 01: god as influence, not RTS cursor)
import { Building } from "../simulation/building.js";

export class Interaction {
  constructor(simulation, renderer) {
    this.simulation = simulation;
    this.renderer = renderer;
    this.currentTool = "inspect";
    this.selectedEntity = null;
    
    this.setupTools();
  }

  notify(msg) {
    if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(new CustomEvent("show_notification", { detail: msg }));
    }
  }
  
  setupTools() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Listen on window for world clicks dispatched by renderer
    window.addEventListener("worldclick", (e) => {
      const { x, y } = e.detail;
      this.useTool(x, y);
    });
    
    // Keyboard shortcuts for tools
    document.addEventListener("keydown", (e) => {
      switch(e.key) {
        case "1":
          this.setTool("inspect");
          break;
        case "2":
          this.setTool("spawn_agent");
          break;
        case "3":
          this.setTool("create_food");
          break;
        case "4":
          this.setTool("create_water");
          break;
        case "5":
          this.setTool("create_wood");
          break;
        case "6":
          this.setTool("create_ore");
          break;
        case "7":
          this.setTool("build_house");
          break;
        case "8":
          this.setTool("build_workshop");
          break;
        case "9":
          this.setTool("build_farm");
          break;
        case "0":
          this.setTool("bless");
          break;
      }
    });
  }
  
  updateUI() {
    if (typeof document === "undefined") return;
    // Update active button state in DOM
    document.querySelectorAll(".tool-button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tool === this.currentTool);
    });
  }

  useTool(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    
    switch(this.currentTool) {
      case "inspect": {
        // Find nearest agent first, then building, then resource
        let closest = null;
        let minDist = 4.0;
        
        for (const agent of this.simulation.agents) {
          if (!agent.alive) continue;
          const d = Math.hypot(agent.x - x, agent.y - y);
          if (d < minDist) {
            minDist = d;
            closest = { entity: agent, kind: "agent" };
          }
        }
        
        if (!closest) {
          for (const b of this.simulation.buildings) {
            const d = Math.hypot(b.x - x, b.y - y);
            if (d < minDist) {
              minDist = d;
              closest = { entity: b, kind: "building" };
            }
          }
        }

        if (!closest) {
          for (const r of this.simulation.resources) {
            const d = Math.hypot(r.x - x, r.y - y);
            if (d < minDist) {
              minDist = d;
              closest = { entity: r, kind: "resource" };
            }
          }
        }

        if (!closest && this.simulation.settlementSystem) {
          for (const s of this.simulation.settlementSystem.settlements.values()) {
            if (!s.center) continue;
            const d = Math.hypot(s.center.x - x, s.center.y - y);
            const tierRadius = s.tier === "City" ? 25 : s.tier === "Town" ? 20 : s.tier === "Village" ? 16 : 12;
            if (d < 6.0 || d < tierRadius * 0.6) {
              if (d < minDist || !closest) {
                minDist = d;
                closest = { 
                  entity: {
                    ...s,
                    x: s.center.x,
                    y: s.center.y
                  }, 
                  kind: "settlement" 
                };
              }
            }
          }
        }

        this.selectedEntity = closest;
        if (this.renderer) {
          this.renderer.selectedEntity = closest;
        }
        if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
          window.dispatchEvent(new CustomEvent("entity_inspected", { detail: closest }));
        }
        break;
      }

      case "spawn_agent": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const agent = this.simulation.spawnAgent(x, y);
          this.notify(`Spawned ${agent.name}!`);
        } else {
          this.notify("Cannot spawn on water or impassable terrain!");
        }
        break;
      }

      case "create_food": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "food", 4, 2.5) : 
            [this.simulation.createResource(x, y, "food", 45)];
          this.notify(`🌾 Blessed with fertile crop cluster (${list.length} nodes)!`);
        }
        break;
      }

      case "create_water": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "water", 3, 2.0) : 
            [this.simulation.createResource(x, y, "water", 100)];
          this.notify(`💧 Pure crystal springs emerged (${list.length} pools)!`);
        }
        break;
      }

      case "create_wood": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "wood", 4, 2.5) : 
            [this.simulation.createResource(x, y, "wood", 50)];
          this.notify(`🌲 Lush timber grove sprouted (${list.length} trees)!`);
        }
        break;
      }

      case "create_ore": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "ore", 4, 2.5) : 
            [this.simulation.createResource(x, y, "ore", 60)];
          this.notify(`⛏️ Rich mineral outcrop formed (${list.length} veins)!`);
        }
        break;
      }

      case "create_bounty": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnAbundantBounty ? 
            this.simulation.spawnAbundantBounty(x, y) : 
            [this.simulation.createResource(x, y, "wood", 50), this.simulation.createResource(x, y, "water", 100), this.simulation.createResource(x, y, "ore", 60)];
          this.notify(`✨ Divine Bounty! Spawned ${list.length} nodes of wood, water, ore & food!`);
        }
        break;
      }

      case "build_house":
      case "build_workshop":
      case "build_farm":
      case "build_temple": {
        const type = this.currentTool.replace("build_", "");
        if (this.simulation.world.isWalkable(tx, ty)) {
          const b = new Building(tx, ty, type, this.simulation.idGen);
          b.constructionProgress = 0;
          b.complete = false;
          this.simulation.buildings.push(b);
          this.simulation.world.addToSpatialIndex(tx, ty, b);
          window.dispatchEvent(new CustomEvent("show_notification", { detail: `Planned ${type} blueprint at (${tx}, ${ty})!` }));
        } else {
          window.dispatchEvent(new CustomEvent("show_notification", { detail: "Invalid terrain for building blueprint!" }));
        }
        break;
      }

      case "bless": {
        let blessedCount = 0;
        for (const agent of this.simulation.agents) {
          if (!agent.alive) continue;
          if (Math.hypot(agent.x - x, agent.y - y) <= 8) {
            agent.needs.food = 100;
            agent.needs.water = 100;
            agent.needs.rest = 100;
            agent.needs.social = 100;
            if (agent.needs.health) agent.needs.health = 100;
            blessedCount++;
          }
        }
        window.dispatchEvent(new CustomEvent("show_notification", { detail: `Divine blessing restored ${blessedCount} citizens!` }));
        break;
      }

      case "declare_war": {
        // Find nearest settlement
        let closestS = null;
        let minDist = 30.0;
        for (const s of this.simulation.settlementSystem.settlements.values()) {
          const d = Math.hypot(s.center.x - x, s.center.y - y);
          if (d < minDist) {
            minDist = d;
            closestS = s;
          }
        }
        if (closestS) {
          // Find closest rival settlement
          let rival = null;
          let rivalDist = Infinity;
          for (const other of this.simulation.settlementSystem.settlements.values()) {
            if (other.id === closestS.id) continue;
            const d = Math.hypot(other.center.x - closestS.center.x, other.center.y - closestS.center.y);
            if (d < rivalDist) {
              rivalDist = d;
              rival = other;
            }
          }
          if (rival && this.simulation.diplomacySystem) {
            this.simulation.diplomacySystem.declareWar(closestS.id, rival.id, "Divine Incitement (God Power)");
            window.dispatchEvent(new CustomEvent("show_notification", { detail: `⚔️ War ignited between ${closestS.name} and ${rival.name}!` }));
          }
        } else {
          window.dispatchEvent(new CustomEvent("show_notification", { detail: "Click closer to a settlement to declare war!" }));
        }
        break;
      }

      case "enforce_peace": {
        // Find nearest settlement or enforce peace on all active wars
        if (this.simulation.diplomacySystem) {
          const active = [...this.simulation.diplomacySystem.activeWars];
          if (active.length > 0) {
            for (const war of active) {
              this.simulation.diplomacySystem.signPeace(war.attackerId, war.defenderId, null);
            }
            window.dispatchEvent(new CustomEvent("show_notification", { detail: "🕊️ Divine Peace enforced! All wars quelled." }));
          } else {
            window.dispatchEvent(new CustomEvent("show_notification", { detail: "🕊️ The world is already at peace." }));
          }
        }
        break;
      }

      case "rally_army": {
        let closestS = null;
        let minDist = 30.0;
        for (const s of this.simulation.settlementSystem.settlements.values()) {
          const d = Math.hypot(s.center.x - x, s.center.y - y);
          if (d < minDist) {
            minDist = d;
            closestS = s;
          }
        }
        if (closestS && this.simulation.warfareSystem) {
          const enemies = this.simulation.diplomacySystem ? this.simulation.diplomacySystem.getEnemies(closestS.id) : [];
          const targetId = enemies.length > 0 ? enemies[0] : null;
          const wb = this.simulation.warfareSystem.mobilizeWarband(closestS.id, targetId, targetId ? "assault" : "defense");
          if (wb) {
            window.dispatchEvent(new CustomEvent("show_notification", { detail: `🛡️ ${closestS.name} mustered a warband of ${wb.soldiers.length} warriors!` }));
          } else {
            window.dispatchEvent(new CustomEvent("show_notification", { detail: `Not enough healthy adults in ${closestS.name} to muster.` }));
          }
        } else {
          window.dispatchEvent(new CustomEvent("show_notification", { detail: "Click on a settlement to rally its army!" }));
        }
        break;
      }

      case "smite": {
        let smittenCount = 0;
        const toSmite = [];
        for (const agent of this.simulation.agents) {
          if (!agent.alive) continue;
          if (Math.hypot(agent.x - x, agent.y - y) <= 4) {
            toSmite.push(agent);
          }
        }
        for (const agent of toSmite) {
          agent.deathCause = "divine wrath";
          this.simulation.removeAgent(agent.id);
          smittenCount++;
        }
        window.dispatchEvent(new CustomEvent("show_notification", { detail: `Divine lightning struck (${tx}, ${ty})! ${smittenCount} fallen.` }));
        break;
      }

      case "remove": {
        this.simulation.removeResource(x, y);
        // Also check if any building at tile
        const bIdx = this.simulation.buildings.findIndex(b => Math.hypot(b.x - x, b.y - y) < 1.5);
        if (bIdx !== -1) {
          const b = this.simulation.buildings[bIdx];
          this.simulation.world.removeFromSpatialIndex(Math.floor(b.x), Math.floor(b.y), b);
          this.simulation.buildings.splice(bIdx, 1);
          window.dispatchEvent(new CustomEvent("show_notification", { detail: "Building removed!" }));
        } else {
          window.dispatchEvent(new CustomEvent("show_notification", { detail: "Resource removed!" }));
        }
        break;
      }
    }
  }

  setTool(toolName) {
    this.currentTool = toolName;
    this.updateUI();
  }
}

