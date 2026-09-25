/**
 * UI Manager
 * Handles inspectors, tooltips, building previews, and god tool UI.
 */

import { ENTITY_TYPES, BUILDING_TYPES } from '../core/constants.js';
import { distance } from '../utils/math.js';

export class UIManager {
    constructor(worldState, canvas, renderer) {
        this.worldState = worldState;
        this.canvas = canvas;
        this.renderer = renderer;
        
        // UI State
        this.activeInspector = null;
        this.buildingPreview = null;
        this.selectedTool = null;
        this.tooltipData = null;
        this.uiVisible = true;
        
        // DOM Elements (created dynamically)
        this.inspectorPanel = null;
        this.toolbar = null;
        this.tooltip = null;
        
        this.initDOM();
        this.bindEvents();
    }

    /**
     * Initialize UI DOM elements
     */
    initDOM() {
        // Inspector Panel
        this.inspectorPanel = document.createElement('div');
        this.inspectorPanel.id = 'inspector-panel';
        this.inspectorPanel.className = 'ui-panel inspector';
        this.inspectorPanel.style.cssText = `
            position: absolute;
            right: 10px;
            top: 10px;
            width: 280px;
            background: rgba(20, 30, 50, 0.95);
            border: 2px solid #4a6fa5;
            border-radius: 8px;
            padding: 15px;
            color: #e0e0e0;
            font-family: 'Segoe UI', sans-serif;
            font-size: 13px;
            display: none;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 1000;
        `;
        
        // Toolbar
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'game-toolbar';
        this.toolbar.className = 'ui-panel toolbar';
        this.toolbar.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 30, 50, 0.95);
            border: 2px solid #4a6fa5;
            border-radius: 8px;
            padding: 10px;
            display: flex;
            gap: 8px;
            z-index: 1000;
        `;
        
        // Tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'game-tooltip';
        this.tooltip.className = 'ui-tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(10, 15, 25, 0.98);
            border: 1px solid #6a8fc5;
            border-radius: 4px;
            padding: 8px 12px;
            color: #fff;
            font-family: 'Segoe UI', sans-serif;
            font-size: 12px;
            pointer-events: none;
            display: none;
            z-index: 2000;
            max-width: 250px;
        `;
        
        document.body.appendChild(this.inspectorPanel);
        document.body.appendChild(this.toolbar);
        document.body.appendChild(this.tooltip);
        
        this.createToolbarButtons();
    }

    /**
     * Create toolbar buttons for tools and buildings
     */
    createToolbarButtons() {
        const tools = [
            { id: 'select', icon: '👆', name: 'Select', key: '1' },
            { id: 'terraform', icon: '⛰️', name: 'Terrain', key: '2' },
            { id: 'spawn_agent', icon: '🧑', name: 'Spawn Agent', key: '3' },
            { id: 'spawn_animal', icon: '🐾', name: 'Spawn Animal', key: '4' },
            { id: 'build', icon: '🏗️', name: 'Build', key: '5' },
            { id: 'god_power', icon: '⚡', name: 'God Power', key: '6' }
        ];
        
        tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = 'toolbar-btn';
            btn.innerHTML = `${tool.icon}<span class="tooltip">${tool.name} (${tool.key})</span>`;
            btn.dataset.tool = tool.id;
            btn.style.cssText = `
                background: rgba(60, 80, 120, 0.8);
                border: 1px solid #5a7fa5;
                border-radius: 4px;
                padding: 8px 12px;
                color: #e0e0e0;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.2s;
                position: relative;
            `;
            
            btn.onmouseenter = () => {
                btn.style.background = 'rgba(80, 100, 140, 0.9)';
                btn.style.transform = 'translateY(-2px)';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(60, 80, 120, 0.8)';
                btn.style.transform = 'translateY(0)';
            };
            btn.onclick = () => this.selectTool(tool.id);
            
            this.toolbar.appendChild(btn);
        });
    }

    /**
     * Bind global events
     */
    bindEvents() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return; // Don't interfere with text input
            
            switch(e.key) {
                case '1': this.selectTool('select'); break;
                case '2': this.selectTool('terraform'); break;
                case '3': this.selectTool('spawn_agent'); break;
                case '4': this.selectTool('spawn_animal'); break;
                case '5': this.selectTool('build'); break;
                case '6': this.selectTool('god_power'); break;
                case 'Escape': this.closeInspector(); break;
                case '+': case '=': this.worldState.timeScale = Math.min(5, this.worldState.timeScale + 1); break;
                case '-': case '_': this.worldState.timeScale = Math.max(1, this.worldState.timeScale - 1); break;
                case ' ': 
                    e.preventDefault(); 
                    // Spacebar for camera pan override
                    break;
            }
        });
        
        // Canvas click for inspection
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Select a tool
     */
    selectTool(toolId) {
        this.selectedTool = toolId;
        
        // Update button states
        const buttons = this.toolbar.querySelectorAll('.toolbar-btn');
        buttons.forEach(btn => {
            if (btn.dataset.tool === toolId) {
                btn.style.background = 'rgba(100, 140, 200, 0.9)';
                btn.style.boxShadow = '0 0 10px rgba(100, 140, 200, 0.5)';
            } else {
                btn.style.background = 'rgba(60, 80, 120, 0.8)';
                btn.style.boxShadow = 'none';
            }
        });
        
        this.worldState.events.trigger('tool_selected', { tool: toolId });
    }

    /**
     * Handle canvas click for entity selection
     */
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convert to world coordinates
        const worldPos = this.renderer.screenToWorld(mouseX, mouseY);
        
        // Find entity at position
        const entity = this.worldState.getEntityAt(worldPos.x, worldPos.y);
        
        if (entity) {
            this.openInspector(entity);
        } else {
            // Clicked on empty ground
            if (this.selectedTool === 'build' && this.buildingPreview) {
                this.placeBuilding(worldPos.x, worldPos.y);
            }
        }
    }

    /**
     * Handle mouse move for tooltips
     */
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldPos = this.renderer.screenToWorld(mouseX, mouseY);
        const entity = this.worldState.getEntityAt(worldPos.x, worldPos.y);
        
        if (entity && !this.activeInspector) {
            this.showTooltip(entity, e.clientX, e.clientY);
        } else {
            this.hideTooltip();
        }
    }

    /**
     * Open inspector panel for an entity
     */
    openInspector(entity) {
        this.activeInspector = entity;
        this.inspectorPanel.style.display = 'block';
        this.renderInspectorContent(entity);
        
        this.worldState.events.trigger('inspector_opened', { entity: entity });
    }

    /**
     * Close inspector panel
     */
    closeInspector() {
        if (!this.activeInspector) return;
        
        this.inspectorPanel.style.display = 'none';
        this.inspectorPanel.innerHTML = '';
        this.activeInspector = null;
        
        this.worldState.events.trigger('inspector_closed');
    }

    /**
     * Render inspector content based on entity type
     */
    renderInspectorContent(entity) {
        let html = `
            <div style="border-bottom: 1px solid #4a6fa5; padding-bottom: 10px; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #6a9fc5; font-size: 16px;">
                    ${this.getEntityIcon(entity)} ${this.getEntityTypeName(entity)}
                </h3>
                <small style="color: #888;">ID: ${entity.id.substr(0, 12)}...</small>
            </div>
        `;
        
        // Common properties
        html += `<div style="margin-bottom: 15px;">`;
        html += `<div><strong>Position:</strong> ${entity.x.toFixed(1)}, ${entity.y.toFixed(1)}</div>`;
        
        if (entity.type === ENTITY_TYPES.AGENT) {
            html += this.renderAgentDetails(entity);
        } else if (entity.type === ENTITY_TYPES.BUILDING) {
            html += this.renderBuildingDetails(entity);
        } else if (entity.type === 'animal') {
            html += `<div><strong>Species:</strong> ${entity.species}</div>`;
            html += `<div><strong>Health:</strong> ${Math.round(entity.health || 0)}</div>`;
            html += `<div><strong>Age:</strong> ${Math.round((entity.age || 0) / 100)} seasons</div>`;
            html += `<div style="color:#888;margin-top:6px;">${entity.species === 'wolf' ? 'Hunts lone travelers and wounded prey. Keep citizens in groups.' : 'Flees from armed hunters; a good source of meat and hide.'}</div>`;
        } else if (entity.tile) {
            html += this.renderTileDetails(entity);
        }
        
        html += `</div>`;
        
        // Action buttons
        html += `<div style="border-top: 1px solid #4a6fa5; padding-top: 10px; display: flex; gap: 8px;">`;
        if (entity.type === ENTITY_TYPES.AGENT && !entity.dead) {
            html += `<button onclick="window.aetheriaUI.deleteEntity('${entity.id}')" 
                style="flex: 1; padding: 6px; background: #c0392b; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Remove
            </button>`;
        }
        html += `<button onclick="window.aetheriaUI.closeInspector()" 
            style="flex: 1; padding: 6px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Close
        </button>`;
        html += `</div>`;
        
        this.inspectorPanel.innerHTML = html;
    }

    /**
     * Render agent-specific details
     */
    renderAgentDetails(agent) {
        let html = `
            <div style="margin-top: 10px;"><strong>Job:</strong> ${agent.job || 'Unemployed'}</div>
            <div><strong>State:</strong> ${agent.state}</div>
            <div><strong>Faction:</strong> ${agent.factionId || 'None'}</div>
        `;
        
        // Needs
        if (agent.needs) {
            html += `<div style="margin-top: 10px;"><strong>Needs:</strong></div>`;
            for (const [need, value] of Object.entries(agent.needs)) {
                const pct = Math.round((value / 100) * 100);
                const color = pct > 60 ? '#27ae60' : pct > 30 ? '#f39c12' : '#c0392b';
                html += `
                    <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
                        <span style="width: 70px; text-transform: capitalize;">${need}:</span>
                        <div style="flex: 1; height: 8px; background: #333; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
                        </div>
                        <span>${pct}%</span>
                    </div>
                `;
            }
        }
        
        // Relationships
        if (agent.relationships && agent.relationships.size > 0) {
            html += `<div style="margin-top: 10px;"><strong>Relationships:</strong></div>`;
            const rels = Array.from(agent.relationships.entries()).slice(0, 5);
            rels.forEach(([id, data]) => {
                const relType = (data && typeof data === 'object') ? (data.type ?? 'acquaintance') : 'relationship';
                const relValue = (data && typeof data === 'object') ? data.value : (typeof data === 'number' ? data : 0);
                html += `<div style="font-size: 11px; color: #aaa;">• ${relType}: ${Math.round(relValue || 0)}</div>`;
            });
        }
        
        // Inventory
        if (agent.inventory && Object.keys(agent.inventory).length > 0) {
            html += `<div style="margin-top: 10px;"><strong>Inventory:</strong></div>`;
            for (const [item, count] of Object.entries(agent.inventory)) {
                const label = String(item ?? 'unknown').replace(/_/g, ' ');
                html += `<div style="font-size: 11px;">• ${label}: ${count}</div>`;
            }
        }
        
        // Combat
        if (agent.combat) {
            html += `<div style="margin-top: 10px;"><strong>Health:</strong> 
                <div style="height: 8px; background: #333; border-radius: 4px; margin-top: 4px;">
                    <div style="width: ${(agent.combat.health / agent.combat.maxHealth) * 100}%; height: 100%; background: #e74c3c; border-radius: 4px;"></div>
                </div>
                ${Math.round(agent.combat.health)}/${agent.combat.maxHealth}
            </div>`;
        }
        
        // Religion
        if (agent.religion) {
            html += `<div style="margin-top: 10px;"><strong>Faith:</strong> ${Math.round(agent.religion.faith)}/100</div>`;
            if (agent.religion.isPriest) {
                html += `<div style="color: #f1c40f;">✦ Priest</div>`;
            }
        }
        
        return html;
    }

    /**
     * Render building-specific details
     */
    renderBuildingDetails(building) {
        let html = `
            <div style="margin-top: 10px;"><strong>Type:</strong> ${building.buildingType}</div>
            <div><strong>Faction:</strong> ${building.factionId || 'None'}</div>
        `;
        
        if (!building.isComplete) {
            const pct = Math.round((building.constructionProgress / building.maxConstructionProgress) * 100);
            html += `
                <div style="margin-top: 10px;"><strong>Construction:</strong></div>
                <div style="height: 10px; background: #333; border-radius: 5px; margin-top: 4px;">
                    <div style="width: ${pct}%; height: 100%; background: #3498db; border-radius: 5px;"></div>
                </div>
                <div style="font-size: 11px; margin-top: 4px;">${pct}% complete</div>
            `;
        } else {
            html += `
                <div style="margin-top: 10px;"><strong>Health:</strong> 
                    ${Math.round(building.health)}/${building.maxHealth}
                </div>
            `;
            
            if (building.jobType) {
                html += `<div style="margin-top: 5px;"><strong>Job Site:</strong> ${building.jobType}</div>`;
            }
        }
        
        return html;
    }

    /**
     * Render tile details
     */
    renderTileDetails(tile) {
        return `
            <div style="margin-top: 10px;"><strong>Biome:</strong> ${tile.biome}</div>
            <div><strong>Elevation:</strong> ${tile.elevation.toFixed(2)}</div>
            <div><strong>Moisture:</strong> ${tile.moisture.toFixed(2)}</div>
            ${tile.resources ? `<div><strong>Resources:</strong> ${tile.resources.join(', ')}</div>` : ''}
        `;
    }

    /**
     * Show tooltip for entity
     */
    showTooltip(entity, screenX, screenY) {
        const name = this.getEntityTypeName(entity);
        this.tooltip.innerHTML = `<strong>${name}</strong>`;
        this.tooltip.style.left = (screenX + 15) + 'px';
        this.tooltip.style.top = (screenY + 15) + 'px';
        this.tooltip.style.display = 'block';
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    /**
     * Get entity icon based on type
     */
    getEntityIcon(entity) {
        if (entity.type === ENTITY_TYPES.AGENT) return '🧑';
        if (entity.type === ENTITY_TYPES.BUILDING) return '🏛️';
        if (entity.type === 'animal') return { deer: '🦌', boar: '🐗', wolf: '🐺' }[entity.species] || '🐾';
        if (entity.tile) return '🗺️';
        return '❓';
    }

    /**
     * Get entity type name
     */
    getEntityTypeName(entity) {
        if (entity.type === ENTITY_TYPES.AGENT) {
            return entity.job ? `${entity.job} Agent` : 'Agent';
        }
        if (entity.type === ENTITY_TYPES.BUILDING) {
            const bType = entity.buildingType || entity.type || 'building';
            return String(bType).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        if (entity.type === 'animal') {
            const label = String(entity.species || 'animal').replace(/^\w/, l => l.toUpperCase());
            return entity.species === 'wolf' ? `${label} (Predator)` : label;
        }
        if (entity.tile) return 'Terrain Tile';
        return 'Unknown';
    }

    /**
     * Set building preview for placement
     */
    setBuildingPreview(type) {
        this.buildingPreview = {
            type: type,
            valid: false,
            x: 0,
            y: 0
        };
    }

    /**
     * Place a building
     */
    placeBuilding(x, y) {
        if (!this.buildingPreview) return;
        
        this.worldState.events.trigger('place_building', {
            type: this.buildingPreview.type,
            x: x,
            y: y
        });
        
        this.buildingPreview = null;
    }

    /**
     * Delete an entity (for debug/god mode)
     */
    deleteEntity(entityId) {
        const entity = this.worldState.getEntityById(entityId);
        if (entity) {
            entity.dead = true;
            this.closeInspector();
        }
    }

    /**
     * Update UI each frame
     */
    update() {
        // Update inspector if open and entity still exists
        if (this.activeInspector) {
            const entity = this.worldState.getEntityById(this.activeInspector.id);
            if (!entity || entity.dead) {
                this.closeInspector();
            } else if (this.inspectorPanel.style.display !== 'none') {
                // Live update certain values
                this.renderInspectorContent(entity);
            }
        }
        
        // Update building preview position
        if (this.buildingPreview) {
            // Handled by renderer
        }
    }
}

// Expose globally for button callbacks
window.aetheriaUI = null;
