/**
 * CraftingSystem - Handles resource transformation and production chains
 * Manages recipes, workshops, and agent crafting tasks
 */

class CraftingSystem {
    constructor(simulation) {
        this.simulation = simulation;
        this.recipes = new Map();
        this.workshops = new Map(); // Map<id, Workshop>
        this.initRecipes();
    }

    initRecipes() {
        // Tier 1: Basic Processing
        this.addRecipe('log_to_plank', {
            id: 'log_to_plank',
            name: 'Saw Log',
            input: { type: 'wood_log', amount: 1 },
            // Output key must match what the distribution loop and trade
            // system look for ('plank'); previously 'wood_plank' meant planks
            // were crafted but could never be collected or exported.
            output: { type: 'plank', amount: 4 },
            time: 50, // ticks
            skill: 'carpentry',
            tool: 'saw'
        });

        this.addRecipe('ore_to_ingot', {
            id: 'ore_to_ingot',
            name: 'Smelt Ore',
            input: { type: 'ore_iron', amount: 2 },
            output: { type: 'iron_ingot', amount: 1 },
            time: 80,
            skill: 'smithing',
            tool: 'hammer',
            requires: 'fire' // Needs a forge
        });

        this.addRecipe('wheat_to_flour', {
            id: 'wheat_to_flour',
            name: 'Grind Wheat',
            input: { type: 'wheat', amount: 3 },
            output: { type: 'flour', amount: 2 },
            time: 40,
            skill: 'milling',
            tool: 'millstone'
        });

        // Tier 2: Advanced Crafting
        this.addRecipe('plank_to_tool_handle', {
            id: 'plank_to_tool_handle',
            name: 'Carve Handle',
            input: { type: 'wood_plank', amount: 1 },
            output: { type: 'tool_handle', amount: 2 },
            time: 30,
            skill: 'carpentry',
            tool: 'knife'
        });

        this.addRecipe('ingot_plus_handle_to_pickaxe', {
            id: 'ingot_plus_handle_to_pickaxe',
            name: 'Forge Pickaxe',
            input: [
                { type: 'iron_ingot', amount: 2 },
                { type: 'tool_handle', amount: 1 }
            ],
            output: { type: 'pickaxe', amount: 1 },
            time: 100,
            skill: 'smithing',
            tool: 'anvil',
            // Phase 2 (skill-gated unlocks): advanced tier-2 recipes only
            // become available once the workshop's crafter pool has reached
            // the required skill level. Checked against max worker skill in
            // canCraft via simulation; default 0 keeps tier-1 open.
            requiresSkill: { smithing: 2 }
        });

        this.addRecipe('flour_plus_water_to_bread', {
            id: 'flour_plus_water_to_bread',
            name: 'Bake Bread',
            input: { type: 'flour', amount: 1 }, // Water is ambient at any
            // settlement bakery — requiring a 'water' item in workshop storage
            // meant bread could never be crafted (nothing hauls water).
            output: { type: 'bread', amount: 4 },
            time: 60,
            skill: 'cooking',
            tool: 'oven'
            // No 'fire' requirement: general village workshops bake fine.
            // Smeltery-style recipes still demand a specialized subtype.
        });
    }

    addRecipe(id, recipe) {
        this.recipes.set(id, recipe);
    }

    getRecipe(id) {
        return this.recipes.get(id);
    }

    getAllRecipes() {
        return Array.from(this.recipes.values());
    }

    // Deterministic monotonic key for workshops tied to a completed
    // Building. Reused on load so activeTask references stay valid and
    // no RNG/id-stream is consumed.
    static buildingKey(building) {
        return `b${building.id}`;
    }

    /**
     * Create a workshop entity in the world
     */
    createWorkshop(x, y, type, name) {
        const id = `workshop_${this.simulation?.clock?.tick ?? 0}_${(this.workshopSeq = (this.workshopSeq || 0) + 1)}`;
        const workshop = {
            id,
            type: 'workshop',
            subtype: type, // 'lumber_mill', 'smeltery', 'bakery', etc.
            name: name || `${type} ${this.simulation.settlements.size + 1}`,
            x,
            y,
            queue: [], // Array of crafting tasks
            activeTask: null,
            progress: 0,
            storage: new Map(), // Input/Output storage
            maxStorage: 50,
            assignedWorkers: [] // Agent IDs working here
        };

        this.workshops.set(id, workshop);
        
        // Add to simulation entities if needed for rendering
        if (this.simulation.entities) {
            this.simulation.entities.push({
                id,
                type: 'building',
                subtype: type,
                x,
                y,
                width: 2,
                height: 2,
                color: '#8B4513',
                data: workshop
            });
        }

        return workshop;
    }

    /**
     * Assign an agent to work at a workshop
     */
    assignWorker(workshopId, agentId) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop) return false;

        if (!workshop.assignedWorkers.includes(agentId)) {
            workshop.assignedWorkers.push(agentId);
            
            // Update agent state - agents is an array, not a Map
            const agent = this.simulation.agents.find(a => a.id === agentId);
            if (agent) {
                agent.job = 'craftsman';
                agent.workplace = workshopId;
            }
            return true;
        }
        return false;
    }

    /**
     * Remove worker from workshop
     */
    removeWorker(workshopId, agentId) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop) return false;

        workshop.assignedWorkers = workshop.assignedWorkers.filter(id => id !== agentId);
        
        const agent = this.simulation.agents.find(a => a.id === agentId);
        if (agent) {
            agent.job = 'unemployed';
            agent.workplace = null;
        }
        return true;
    }

    /**
     * Add a crafting task to a workshop queue
     */
    queueRecipe(workshopId, recipeId, amount = 1) {
        const workshop = this.workshops.get(workshopId);
        const recipe = this.recipes.get(recipeId);
        
        if (!workshop || !recipe) return false;

        // Check storage space for output
        const outputType = Array.isArray(recipe.output) ? recipe.output[0].type : recipe.output.type;
        const currentOutput = workshop.storage.get(outputType) || 0;
        if (currentOutput + amount > workshop.maxStorage) {
            return false; // Not enough storage
        }

        // Check if we have inputs (optional check, can be done during execution)
        // For now, we just queue it
        
        for (let i = 0; i < amount; i++) {
            workshop.queue.push({
                recipeId,
                status: 'pending',
                startedAt: null,
                workerId: null
            });
        }
        
        return true;
    }

    // Auto-discovery: when a settlement completes a workshop Building, the
    // CraftingSystem registers a matching workshop so craftsmen can be
    // assigned and supply chains can run. Deterministic (no RNG).
    syncFromBuildings(sim) {
        if (!sim || !Array.isArray(sim.buildings)) return;
        const seen = new Set();
        let opened = false;
        for (const b of sim.buildings) {
            if (b.buildingType !== 'workshop' || !b.complete) continue;
            const key = CraftingSystem.buildingKey(b);
            seen.add(key);
            if (this.workshops.has(key)) continue;
            const ws = {
                id: key,
                type: 'workshop',
                subtype: 'general',
                name: `Workshop #${b.id}`,
                buildingId: b.id,
                x: b.x,
                y: b.y,
                queue: [],
                activeTask: null,
                progress: 0,
                storage: new Map(),
                maxStorage: 50,
                assignedWorkers: []
            };
            this.workshops.set(key, ws);
            sim.eventBus?.emit('WORKSHOP_OPENED', { id: key, x: b.x, y: b.y });
            opened = true;
        }
        // Buildings burned/removed -> drop their orphaned workshops.
        let orphaned = false;
        for (const [id, ws] of this.workshops) {
            if (ws.buildingId != null && !seen.has(id)) {
                for (const aid of [...ws.assignedWorkers]) this.removeWorker(id, aid);
                this.workshops.delete(id);
                orphaned = true;
            }
        }
        // Phase 2 job unification: whenever the workshop roster changes,
        // reconcile assignedWorkers against agents whose economy record says
        // they are craftsmen. Previously nothing ever called assignWorker,
        // so assignedWorkers stayed empty forever and workshop progress was
        // permanently paused ("No workers, pause progress") — the whole
        // crafting → distribution → trade pipeline silently never ran.
        this.reconcileCraftsmen(sim);
    }

    // Deterministic roster reconciliation: every living craftsman gets a
    // workplace (their nearest workshop), and every workshop worker entry
    // points at a living craftsman. Zero RNG draws.
    reconcileCraftsmen(sim) {
        if (!sim || !Array.isArray(sim.agents)) return;
        const getJob = sim.economySystem?.getAgentJob?.bind(sim.economySystem);
        for (const agent of sim.agents) {
            if (!agent || !agent.alive) continue;
            const rec = getJob ? getJob(agent.id) : null;
            const isCraftsman = agent.job === 'craftsman' || (rec && rec.job === 'craftsman');
            if (!isCraftsman) continue;
            // Phase 2 life stages: children never hold workshop jobs — they
            // apprentice via watch_crafts instead. Release them from any
            // roster slot so adults fill the benches.
            if (agent.lifeStage === 'child') {
                if (agent.workplace && this.workshops.has(agent.workplace)) {
                    this.removeWorker(agent.workplace, agent.id);
                }
                continue;
            }
            // Validate existing workplace; re-find if orphaned.
            if (agent.workplace && !this.workshops.has(agent.workplace)) {
                agent.workplace = null;
            }
            if (!agent.workplace) {
                const ws = this.findNearestWorkshop(agent.x, agent.y, 32);
                if (ws) {
                    this.assignWorker(ws.id, agent.id);
                    if (sim.economySystem?.agentJobs) {
                        sim.economySystem.agentJobs.set(agent.id, {
                            job: 'craftsman', skillLevel: 1, experience: 0,
                            assignedAt: sim.clock?.tick ?? 0
                        });
                    }
                }
            } else {
                const ws = this.workshops.get(agent.workplace);
                if (ws && !ws.assignedWorkers.includes(agent.id)) {
                    ws.assignedWorkers.push(agent.id);
                }
            }
        }
        // Drop dead / relocated workers from rosters. Note: assignWorker
        // clears agent.job to 'unemployed', so we must collect first and
        // remove after — otherwise the filter would go stale mid-sweep.
        const removals = [];
        for (const [wsId, ws] of this.workshops) {
            if (ws.assignedWorkers.length === 0) continue;
            for (const aid of ws.assignedWorkers) {
                const a = sim.agents.find(x => x && x.id === aid);
                if (!a || !a.alive || a.workplace !== wsId) {
                    removals.push([wsId, aid]);
                }
            }
        }
        for (const [wsId, aid] of removals) this.removeWorker(wsId, aid);
    }

    // Workshop within `radius` tiles of (x,y), or null. Deterministic scan.
    findNearestWorkshop(x, y, radius = 24) {
        let best = null, bestD = Infinity;
        for (const ws of this.workshops.values()) {
            const d = Math.hypot(ws.x - x, ws.y - y);
            if (d <= radius && d < bestD) { bestD = d; best = ws; }
        }
        return best;
    }

    // Queue an automatic recipe from a small priority list, given what the
    // workshop storage already holds. Zero RNG draws. Returns true if queued.
    autoQueue(workshop) {
        if (workshop.queue.length > 0 || workshop.activeTask) return false;
        // Planks first: raw logs are the most common haul and sawmilling is
        // the backbone of the finished-goods trade loop.
        const order = ['log_to_plank', 'wheat_to_flour', 'flour_plus_water_to_bread', 'ore_to_ingot'];
        for (const rid of order) {
            const r = this.recipes.get(rid);
            if (r && this.canCraft(workshop, r)) {
                this.queueRecipe(workshop.id, rid, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Process crafting logic for all workshops
     */
    update() {
        // Keep workshops in sync with completed workshop buildings.
        this.syncFromBuildings(this.simulation);

        this.workshops.forEach((workshop, id) => {
            // If no active task, try to start one
            if (!workshop.activeTask && workshop.queue.length > 0) {
                const nextTask = workshop.queue.shift();
                const recipe = this.recipes.get(nextTask.recipeId);
                
                if (recipe && this.canCraft(workshop, recipe)) {
                    workshop.activeTask = nextTask;
                    workshop.progress = 0;
                    
                    // Consume inputs immediately
                    this.consumeInputs(workshop, recipe);
                } else {
                    // Put back in queue if can't craft yet
                    workshop.queue.unshift(nextTask);
                }
            }

            // Process active task
            if (workshop.activeTask) {
                const recipe = this.recipes.get(workshop.activeTask.recipeId);
                
                // Check if workers are present
                if (workshop.assignedWorkers.length === 0) {
                    return; // No workers, pause progress
                }

                // Calculate speed based on worker skills
                let totalSkill = 0;
                workshop.assignedWorkers.forEach(agentId => {
                    const agent = this.simulation.agents.find(a => a.id === agentId);
                    if (agent && agent.skills) {
                        totalSkill += (agent.skills[recipe.skill] || 0);
                    }
                });
                
                const baseSpeed = 1;
                const skillBonus = totalSkill > 0 ? (totalSkill / workshop.assignedWorkers.length) * 0.5 : 0;
                const progressRate = baseSpeed + skillBonus;

                workshop.progress += progressRate;

                if (workshop.progress >= recipe.time) {
                    this.completeTask(workshop, recipe);
                }
            }

            // Keep the queue fed: craft whatever raw materials are in stock.
            this.autoQueue(workshop);
        });
    }

    // ---- Supply-chain helpers (deterministic, zero RNG draws) ----

    // Raw inputs of a recipe as list of types.
    static recipeInputTypes(recipe) {
        const inputs = Array.isArray(recipe.input) ? recipe.input : [recipe.input];
        return inputs.map(i => i.type);
    }

    // Total units of any recipe input currently held by an inventory.
    haulUnits(inventory) {
        if (!inventory) return 0;
        const wanted = new Set();
        for (const r of this.recipes.values()) {
            for (const t of CraftingSystem.recipeInputTypes(r)) wanted.add(t);
        }
        let n = 0;
        for (const [k, v] of Object.entries(inventory)) {
            if (wanted.has(k) && typeof v === 'number' && v > 0) n += v;
        }
        return n;
    }

    // Move all matching raw-material units from an agent inventory into a
    // workshop storage (respecting maxStorage). Returns units delivered.
    deliverHaul(workshopId, agent) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop || !agent || !agent.inventory) return 0;
        const wanted = new Set();
        for (const r of this.recipes.values()) {
            for (const t of CraftingSystem.recipeInputTypes(r)) wanted.add(t);
        }
        let delivered = 0;
        for (const key of Object.keys(agent.inventory)) {
            if (!wanted.has(key)) continue;
            while (agent.inventory[key] > 0) {
                const cur = workshop.storage.get(key) || 0;
                if (cur >= workshop.maxStorage) return delivered;
                workshop.storage.set(key, cur + 1);
                agent.inventory[key] -= 1;
                delivered++;
            }
            delete agent.inventory[key];
        }
        return delivered;
    }

    // Take up to `amount` units of `type` from workshop storage into an
    // agent inventory (capacity-aware). Returns units actually taken.
    takeFromWorkshop(workshopId, agent, type, amount = 999) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop || !agent || !agent.inventory) return 0;
        const avail = workshop.storage.get(type) || 0;
        if (avail <= 0) return 0;
        const used = Object.values(agent.inventory)
            .reduce((a, b) => a + (typeof b === 'number' && b > 0 ? b : 0), 0);
        const free = Math.max(0, (agent.inventory.capacity || 15) - used);
        const take = Math.min(avail, amount, free);
        if (take <= 0) return 0;
        workshop.storage.set(type, avail - take);
        if (workshop.storage.get(type) <= 0) workshop.storage.delete(type);
        agent.inventory[type] = (agent.inventory[type] || 0) + take;
        return take;
    }

    canCraft(workshop, recipe) {
        // Check inputs available in storage
        const inputs = Array.isArray(recipe.input) ? recipe.input : [recipe.input];
        
        for (const input of inputs) {
            const available = workshop.storage.get(input.type) || 0;
            if (available < input.amount) {
                return false;
            }
        }
        
        // Check requirements (e.g., fire)
        if (recipe.requires === 'fire') {
            // Simplified: assume workshop has fire if it's a smeltery/bakery
            if (!['smeltery', 'bakery', 'forge'].includes(workshop.subtype)) {
                return false;
            }
        }

        // Phase 2 (skill-gated recipe unlocks): advanced recipes require the
        // workshop's crafter pool to contain at least one worker who has
        // reached the required skill level. Deterministic scan of assigned
        // workers — no RNG draws.
        if (recipe.requiresSkill) {
            const agents = this.simulation?.agents || [];
            let best = null;
            for (const wid of workshop.assignedWorkers) {
                const a = typeof agents.find === 'function'
                    ? agents.find(ag => ag && ag.id === wid)
                    : null;
                if (!a || !a.skills) continue;
                if (!best || a.id < best.id) best = a; // deterministic pick
            }
            const skills = best ? best.skills : {};
            for (const [skillName, minLevel] of Object.entries(recipe.requiresSkill)) {
                if ((skills[skillName] || 0) < minLevel) {
                    return false;
                }
            }
        }

        return true;
    }

    consumeInputs(workshop, recipe) {
        const inputs = Array.isArray(recipe.input) ? recipe.input : [recipe.input];
        
        inputs.forEach(input => {
            const current = workshop.storage.get(input.type) || 0;
            workshop.storage.set(input.type, current - input.amount);
            if (workshop.storage.get(input.type) <= 0) {
                workshop.storage.delete(input.type);
            }
        });
    }

    completeTask(workshop, recipe) {
        // Produce outputs
        const outputs = Array.isArray(recipe.output) ? recipe.output : [recipe.output];
        
        outputs.forEach(output => {
            const current = workshop.storage.get(output.type) || 0;
            workshop.storage.set(output.type, current + output.amount);
        });

        // Reset task
        workshop.activeTask = null;
        workshop.progress = 0;
        
        // Notify simulation
        if (this.simulation.eventBus) {
            this.simulation.eventBus.emit('crafting_complete', {
                workshopId: workshop.id,
                recipeId: recipe.id,
                outputs: outputs
            });
        }
    }

    /**
     * Transfer resources from world to workshop storage
     */
    depositToWorkshop(workshopId, resourceType, amount) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop) return false;

        const current = workshop.storage.get(resourceType) || 0;
        if (current + amount > workshop.maxStorage) {
            return false;
        }

        workshop.storage.set(resourceType, current + amount);
        return true;
    }

    /**
     * Withdraw resources from workshop
     */
    withdrawFromWorkshop(workshopId, resourceType, amount) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop) return null;

        const current = workshop.storage.get(resourceType) || 0;
        if (current < amount) {
            return null;
        }

        workshop.storage.set(resourceType, current - amount);
        if (workshop.storage.get(resourceType) <= 0) {
            workshop.storage.delete(resourceType);
        }

        return { type: resourceType, amount };
    }

    getWorkshopStats(workshopId) {
        const workshop = this.workshops.get(workshopId);
        if (!workshop) return null;

        return {
            id: workshop.id,
            name: workshop.name,
            type: workshop.subtype,
            workers: workshop.assignedWorkers.length,
            queueLength: workshop.queue.length,
            progress: workshop.activeTask ? workshop.progress : 0,
            activeRecipe: workshop.activeTask ? workshop.activeTask.recipeId : null,
            storage: Object.fromEntries(workshop.storage)
        };
    }
    
    serialize() {
        const workshopsData = [];
        this.workshops.forEach((workshop, id) => {
            workshopsData.push({
                id: workshop.id,
                subtype: workshop.subtype,
                name: workshop.name,
                x: workshop.x,
                y: workshop.y,
                queue: workshop.queue,
                activeTask: workshop.activeTask,
                progress: workshop.progress,
                storage: Array.from(workshop.storage.entries()),
                maxStorage: workshop.maxStorage,
                buildingId: workshop.buildingId ?? null,
                assignedWorkers: workshop.assignedWorkers
            });
        });
        
        return {
            recipes: Array.from(this.recipes.entries()),
            workshops: workshopsData
        };
    }
    
    static deserialize(data, simulation) {
        const craftingSystem = new CraftingSystem(simulation);
        craftingSystem.recipes = new Map(data.recipes);
        craftingSystem.workshops = new Map();
        
        data.workshops.forEach(workshopData => {
            const workshop = {
                id: workshopData.id,
                type: 'workshop',
                subtype: workshopData.subtype,
                name: workshopData.name,
                x: workshopData.x,
                y: workshopData.y,
                queue: workshopData.queue,
                activeTask: workshopData.activeTask,
                progress: workshopData.progress,
                storage: new Map(workshopData.storage),
                maxStorage: workshopData.maxStorage ?? 50,
                buildingId: workshopData.buildingId ?? null,
                assignedWorkers: workshopData.assignedWorkers
            };
            craftingSystem.workshops.set(workshop.id, workshop);
            
            // Re-add to simulation entities
            if (simulation.entities) {
                simulation.entities.push({
                    id: workshop.id,
                    type: 'building',
                    subtype: workshop.subtype,
                    x: workshop.x,
                    y: workshop.y,
                    width: 2,
                    height: 2,
                    color: '#8B4513',
                    data: workshop
                });
            }
        });
        
        return craftingSystem;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports.CraftingSystem = CraftingSystem;
}

export { CraftingSystem };
