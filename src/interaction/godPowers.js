// God powers and player interaction (doc 01: god as influence, not RTS cursor)
import { Building } from "../simulation/building.js";
import { soundManager } from "../systems/audio";
import {
  emitGodEffect,
  emitInspectEntity,
  emitNotification,
  subscribeWorldClick,
} from "../state/worldUiStore";

export class Interaction {
  constructor(simulation, renderer) {
    this.simulation = simulation;
    this.renderer = renderer;
    this.currentTool = "inspect";
    this.selectedEntity = null;
    
    this.setupTools();
  }

  notify(msg) {
    emitNotification(msg);
  }
  
  setupTools() {
    this._unsubWorldClick = subscribeWorldClick(({ x, y }) => {
      this.useTool(x, y);
    });
  }

  destroy() {
    if (this._unsubWorldClick) {
      this._unsubWorldClick();
      this._unsubWorldClick = null;
    }
  }
  
  updateUI() {
    if (typeof document === "undefined") return;
    // Update active button state in DOM
    document.querySelectorAll(".tool-button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tool === this.currentTool);
    });
  }

  useTool(x, y) {
    if (!this.simulation || !this.simulation.world) return;
    const w = this.simulation.world.width || 128;
    const h = this.simulation.world.height || 128;

    // Bounds check to avoid out-of-world exceptions
    if (x < 0 || x >= w || y < 0 || y >= h) return;

    const tx = Math.floor(x);
    const ty = Math.floor(y);
    
    switch(this.currentTool) {
      case "inspect": {
        soundManager.playClick();
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
        emitInspectEntity(closest);
        break;
      }

      case "spawn_agent": {
        const agent = this.simulation.spawnCitizenAt
          ? this.simulation.spawnCitizenAt(x, y)
          : (this.simulation.world.isWalkable(tx, ty) ? this.simulation.spawnAgent(x, y) : null);

        if (agent) {
          soundManager.playBless();
          emitGodEffect({ type: "bless", x: agent.x, y: agent.y, duration: 700 });
          this.notify(`👤 Spawned ${agent.name} (${this.simulation.agents.length} citizens)!`);
        } else {
          this.notify("Cannot spawn on water, walls, or impassable terrain!");
        }
        break;
      }

      case "create_food": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "food", 4, 2.5) : 
            [this.simulation.createResource(x, y, "food", 45)];
          soundManager.playBless();
          this.notify(`🌾 Blessed with fertile crop cluster (${list.length} nodes)!`);
        }
        break;
      }

      case "create_water": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "water", 3, 2.0) : 
            [this.simulation.createResource(x, y, "water", 100)];
          soundManager.playRain();
          this.notify(`💧 Pure crystal springs emerged (${list.length} pools)!`);
        }
        break;
      }

      case "create_wood": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "wood", 4, 2.5) : 
            [this.simulation.createResource(x, y, "wood", 50)];
          soundManager.playBless();
          this.notify(`🌲 Lush timber grove sprouted (${list.length} trees)!`);
        }
        break;
      }

      case "create_ore": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnResourceCluster ? 
            this.simulation.spawnResourceCluster(x, y, "ore", 4, 2.5) : 
            [this.simulation.createResource(x, y, "ore", 60)];
          soundManager.playBuild();
          this.notify(`⛏️ Rich mineral outcrop formed (${list.length} veins)!`);
        }
        break;
      }

      case "create_iron_mountain": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          this.simulation.createMountainDeposit?.(x, y, "iron_mountain");
          soundManager.playBuild();
          emitGodEffect({ type: "bounty", x, y });
          this.notify("⛰️ Massive Iron Mountain Lode raised! (Unlocked for Era 2+ miners, 420 reserve)");
        } else {
          this.notify("Mountain deposits must be raised on walkable terrain!");
        }
        break;
      }

      case "create_uranium_mountain": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          this.simulation.createMountainDeposit?.(x, y, "uranium_mountain");
          soundManager.playBuild();
          emitGodEffect({ type: "bounty", x, y });
          this.notify("☢️ Glowing Uranium Mountain Vein surfaced! (Unlocked for Era 6+ miners, 280 reserve)");
        } else {
          this.notify("Uranium veins must be surfaced on walkable terrain!");
        }
        break;
      }

      case "create_bounty": {
        if (this.simulation.world.isWalkable(tx, ty)) {
          const list = this.simulation.spawnAbundantBounty ? 
            this.simulation.spawnAbundantBounty(x, y) : 
            [this.simulation.createResource(x, y, "wood", 50), this.simulation.createResource(x, y, "water", 100), this.simulation.createResource(x, y, "ore", 60)];
          soundManager.playBless();
          emitGodEffect({ type: "bounty", x, y });
          this.notify(`✨ Divine Bounty! Spawned ${list.length} nodes of wood, water, ore & food!`);
        }
        break;
      }

      case "build_dock": {
        const res = this.simulation.navalSystem?.placeDockBlueprint(x, y);
        if (res?.success) {
          soundManager.playBuild();
          this.notify(`⚓ Planned harbor dock blueprint${res.settlement ? ` for ${res.settlement.name}` : ''} at (${res.dock.x}, ${res.dock.y})!`);
        } else {
          this.notify(res?.reason || "Docks must be placed along a shoreline next to water!");
        }
        break;
      }

      case "build_bridge": {
        const res = this.simulation.infrastructureSystem?.placeBridgeAt(x, y, 10);
        if (res?.success) {
          soundManager.playBuild();
          this.notify(`🌉 Built ${res.span}-tile timber bridge across the waters!`);
        } else {
          this.notify(res?.message || res?.reason || "Click on a river or narrow strait (1–10 tiles wide) to span a bridge!");
        }
        break;
      }

      case "build_wall": {
        const res = this.simulation.fortificationSystem?.placeWallAt(x, y);
        if (res?.success) {
          soundManager.playBuild();
          if (res.action === "repaired") {
            this.notify(`🔧 Repaired breached ${res.segment?.kind || "wall"} at (${res.segment?.x}, ${res.segment?.y})!`);
          } else if (res.action === "toggled") {
            this.notify(`🚪 Converted segment at (${res.segment?.x}, ${res.segment?.y}) to a ${res.segment?.kind}!`);
          } else {
            this.notify(`🧱 Built ${res.segment?.kind || "wall"}${res.settlement ? ` for ${res.settlement.name}` : ""} at (${tx}, ${ty})!`);
          }
        } else {
          this.notify(res?.reason || "Click on walkable terrain to build a fortified wall or gate!");
        }
        break;
      }

      case "build_tower": {
        const res = this.simulation.fortificationSystem?.placeTowerAt(x, y);
        if (res?.success) {
          soundManager.playBuild();
          this.notify(`🗼 Raised defensive Watchtower${res.settlement ? ` for ${res.settlement.name}` : ""} at (${tx}, ${ty})!`);
        } else {
          this.notify(res?.reason || "Click on clear walkable terrain to raise a Watchtower!");
        }
        break;
      }

      case "build_house":
      case "build_workshop":
      case "build_farm":
      case "build_temple": {
        const type = String(this.currentTool ?? '').replace("build_", "");
        if (this.simulation.world.isWalkable(tx, ty)) {
          // Identify nearest settlement to associate building with
          let nearestS = null;
          let minSDist = 24.0;
          if (this.simulation.settlementSystem) {
            for (const s of this.simulation.settlementSystem.settlements.values()) {
              if (!s.center) continue;
              const d = Math.hypot(s.center.x - tx, s.center.y - ty);
              if (d < minSDist) {
                minSDist = d;
                nearestS = s;
              }
            }
          }
          const sid = nearestS ? nearestS.id : null;
          const fid = nearestS ? nearestS.factionId : null;
          const b = new Building(tx, ty, type, this.simulation.idGen, sid, fid);
          b.constructionProgress = 0;
          b.complete = false;
          this.simulation.buildings.push(b);
          this.simulation.world.addToSpatialIndex(tx, ty, b);
          if (nearestS) {
            if (!nearestS.buildings) nearestS.buildings = [];
            nearestS.buildings.push(b);
          }
          soundManager.playBuild();
          this.notify(`Planned ${type} blueprint${nearestS ? ` for ${nearestS.name}` : ''} at (${tx}, ${ty})!`);
        } else {
          this.notify("Invalid terrain for building blueprint!");
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
            agent.needs.health = 100;
            agent.health = agent.maxHealth ?? 100;
            agent.wounded = false;
            agent.woundRecovery = 0;
            if (agent.combat) agent.combat.health = agent.health;
            if (agent.religion) {
              agent.religion.faith = Math.min(100, (agent.religion.faith ?? 50) + 15);
            }
            blessedCount++;
          }
        }
        soundManager.playBless();
        emitGodEffect({ type: "bless", x, y });
        this.notify(`Divine blessing healed & restored ${blessedCount} citizens!`);
        break;
      }

      case "inspire_faith": {
        let nearestCreed = null;
        let minDist = 26;
        if (this.simulation.settlementSystem?.settlements) {
          for (const s of this.simulation.settlementSystem.settlements.values()) {
            if (!s || s.ruined || !s.center) continue;
            const d = Math.hypot(s.center.x - x, s.center.y - y);
            if (d < minDist) {
              minDist = d;
              nearestCreed = s.culture?.beliefId || null;
            }
          }
        }
        const res = this.simulation.religionSystem?.inspireArea?.(x, y, 9, nearestCreed) || { inspired: 0, converted: 0 };
        soundManager.playBless();
        emitGodEffect({ type: "bless", x, y, duration: 1000 });
        this.notify(`🙏 Sacred revelation inspired ${res.inspired} citizens${res.converted > 0 ? ` (${res.converted} converted)` : ''}!`);
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
            soundManager.playWarHorn();
            this.notify(`⚔️ War ignited between ${closestS.name} and ${rival.name}!`);
          }
        } else {
          this.notify("Click closer to a settlement to declare war!");
        }
        break;
      }

      case "enforce_peace": {
        if (this.simulation.diplomacySystem) {
          const active = [...this.simulation.diplomacySystem.activeWars];
          if (active.length > 0) {
            for (const war of active) {
              this.simulation.diplomacySystem.signPeace(war.attackerId, war.defenderId, null);
            }
            soundManager.playPeaceBell();
            this.notify("🕊️ Divine Peace enforced! All wars quelled.");
          } else {
            soundManager.playPeaceBell();
            this.notify("🕊️ The world is already at peace.");
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
            soundManager.playWarHorn();
            this.notify(`🛡️ ${closestS.name} mustered a warband of ${wb.soldiers.length} warriors!`);
          } else {
            this.notify(`Not enough healthy adults in ${closestS.name} to muster.`);
          }
        } else {
          this.notify("Click on a settlement to rally its army!");
        }
        break;
      }

      case "rain": {
        if (this.simulation.weatherSystem) {
          this.simulation.weatherSystem.setWeather('rain', 600);
          const doused = this.simulation.weatherSystem.douseFireArea(x, y, 12);
          soundManager.playRain();
          this.notify(`🌧️ Divine rains summoned over the realm! Extinguished ${doused} fires.`);
        }
        break;
      }

      case "lightning": {
        if (this.simulation.weatherSystem) {
          this.simulation.weatherSystem.strikeLightning(x, y, true);
        }
        soundManager.playThunder();
        emitGodEffect({ type: "smite", x, y });
        this.notify(`⚡ Lightning summoned at (${tx}, ${ty})!`);
        break;
      }

      case "douse": {
        if (this.simulation.weatherSystem) {
          const doused = this.simulation.weatherSystem.douseFireArea(x, y, 14);
          soundManager.playRain();
          this.notify(`💧 Torrential downpour extinguished ${doused} burning tiles!`);
        }
        break;
      }

      case "nuke": {
        const res = this.simulation.detonateNuclearStrike
          ? this.simulation.detonateNuclearStrike({
              x,
              y,
              isGodPower: true,
              reason: "Divine Atomic Strike"
            })
          : null;
        soundManager.playThunder();
        emitGodEffect({ type: "nuke", x, y, duration: 2400 });
        const dead = res?.deaths ?? 0;
        const ruins = res?.buildingsRuined ?? 0;
        this.notify(`☢️ Atomic blast at (${tx}, ${ty})! ${dead} casualties, ${ruins} structures shattered.`);
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
        soundManager.playThunder();
        emitGodEffect({ type: "smite", x, y });
        this.notify(`⚡ Divine lightning struck (${tx}, ${ty})! ${smittenCount} fallen.`);
        break;
      }

      case "remove": {
        const bIdx = this.simulation.buildings.findIndex(b => Math.hypot(b.x - x, b.y - y) < 1.5);
        if (bIdx !== -1) {
          const b = this.simulation.buildings[bIdx];
          this.simulation.world.removeFromSpatialIndex(Math.floor(b.x), Math.floor(b.y), b);
          this.simulation.world.entityRegistry?.delete(b.id);
          this.simulation.buildings.splice(bIdx, 1);
          if (b.settlementId != null) {
            const ownerSettlement = this.simulation.settlementSystem?.settlements?.get(b.settlementId);
            if (ownerSettlement && Array.isArray(ownerSettlement.buildings)) {
              ownerSettlement.buildings = ownerSettlement.buildings.filter(item => item && item.id !== b.id);
            }
          }
          if (b.buildingType === "workshop" && this.simulation.craftingSystem?.workshops) {
            this.simulation.craftingSystem.workshops.delete(b.id);
          }
          if (this.selectedEntity?.kind === "building" && this.selectedEntity.entity?.id === b.id) {
            this.selectedEntity = null;
            if (this.renderer) this.renderer.selectedEntity = null;
          }
          soundManager.playBuild();
          this.notify("Building removed!");
          break;
        }

        const removedRes = this.simulation.removeResource(x, y);
        if (removedRes) {
          soundManager.playClick();
          this.notify("Resource removed!");
          break;
        }

        const fort = this.simulation.fortificationSystem;
        const seg = fort?.getSegmentAt?.(tx, ty);
        if (seg && fort) {
          fort.segments.delete(seg.tileIdx);
          const sList = fort.segmentsBySettlement?.get(seg.settlementId);
          if (Array.isArray(sList)) {
            fort.segmentsBySettlement.set(seg.settlementId, sList.filter(item => item.id !== seg.id));
          }
          if (fort._wallGrid && seg.tileIdx >= 0 && seg.tileIdx < fort._wallGrid.length) {
            fort._wallGrid[seg.tileIdx] = 0;
          }
          soundManager.playBuild();
          this.notify("Fortification segment removed!");
          break;
        }

        if (this.simulation.world.isBridge?.(tx, ty)) {
          this.simulation.world.setBridge(tx, ty, false);
          if (Array.isArray(this.simulation.infrastructureSystem?.bridges)) {
            this.simulation.infrastructureSystem.bridges = this.simulation.infrastructureSystem.bridges.filter(br => {
              if (!Array.isArray(br.tiles)) return true;
              br.tiles = br.tiles.filter(t => !(t.x === tx && t.y === ty));
              return br.tiles.length > 0;
            });
          }
          soundManager.playBuild();
          this.notify("Bridge deck removed!");
          break;
        }

        this.notify("Nothing to remove here.");
        break;
      }
    }
  }

  setTool(toolName) {
    this.currentTool = toolName;
    soundManager.playClick();
    this.updateUI();
  }
}


