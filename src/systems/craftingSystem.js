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
            output: { type: 'wood_plank', amount: 4 },
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
            tool: 'anvil'
        });

        this.addRecipe('flour_plus_water_to_bread', {
            id: 'flour_plus_water_to_bread',
            name: 'Bake Bread',
            input: [
                { type: 'flour', amount: 1 },
                { type: 'water', amount: 1 } // Simplified water usage
            ],
            output: { type: 'bread', amount: 3 },
            time: 60,
            skill: 'cooking',
            tool: 'oven',
            requires: 'fire'
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

    /**
     * Process crafting logic for all workshops
     */
    update() {
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
        });
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
                maxStorage: 50,
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
