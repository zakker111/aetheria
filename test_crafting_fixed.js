const { Simulation } = require('./src/simulation/simulation.js');

console.log("=== CRAFTING SYSTEM DEEP TEST ===\n");

// Test 1: Basic crafting system initialization
console.log("Test 1: Crafting system initialization...");
const sim = new Simulation(64, 64);
if (sim.craftingSystem) {
    console.log("✓ Crafting system initialized");
    const recipeKeys = Array.from(sim.craftingSystem.recipes.keys());
    console.log(`  - Recipes loaded: ${recipeKeys.length}`);
    console.log(`  - Recipe IDs: ${recipeKeys.join(', ')}`);
    console.log(`  - Workshops: ${sim.craftingSystem.workshops.size}`);
} else {
    console.log("✗ Crafting system NOT initialized");
    process.exit(1);
}

// Test 2: Check recipes exist with correct keys
console.log("\nTest 2: Recipe validation...");
const requiredRecipes = ['log_to_plank', 'ore_to_ingot', 'wheat_to_flour', 'plank_to_tool_handle', 'ingot_plus_handle_to_pickaxe', 'flour_plus_water_to_bread'];
let allRecipesOk = true;
for (const recipeKey of requiredRecipes) {
    if (sim.craftingSystem.recipes.has(recipeKey)) {
        console.log(`✓ Recipe '${recipeKey}' exists`);
    } else {
        console.log(`✗ Recipe '${recipeKey}' MISSING`);
        allRecipesOk = false;
    }
}
if (!allRecipesOk) process.exit(1);

// Test 3: Agent inventory system
console.log("\nTest 3: Agent inventory system...");
const agents = sim.agents;
if (agents.length > 0) {
    const agent = agents[0];
    if (agent.inventory !== undefined) {
        console.log("✓ Agent has inventory property");
        console.log(`  - Inventory capacity: ${agent.inventoryCapacity || 10}`);
        console.log(`  - Current items: ${agent.inventory ? agent.inventory.length : 0}`);
    } else {
        console.log("⚠ Agent missing inventory (will check after spawn)");
    }
}

// Test 4: Spawn agent and check inventory
console.log("\nTest 4: Spawning agent with inventory...");
sim.spawnAgent(32, 32);
const newAgent = sim.agents[sim.agents.length - 1];
if (newAgent && newAgent.inventory !== undefined) {
    console.log("✓ Newly spawned agent has inventory");
    console.log(`  - Inventory: ${JSON.stringify(newAgent.inventory)}`);
} else if (newAgent) {
    console.log("⚠ New agent exists but no inventory property");
    console.log(`  - Agent keys: ${Object.keys(newAgent).join(', ')}`);
} else {
    console.log("✗ Failed to spawn agent");
    process.exit(1);
}

// Test 5: Run simulation with crafting
console.log("\nTest 5: Running simulation with crafting system...");
try {
    for (let i = 0; i < 50; i++) {
        sim.tick();
    }
    console.log("✓ Simulation ran 50 ticks without errors");
    console.log(`  - Final tick: ${sim.clock.tick}`);
    console.log(`  - Agents: ${sim.agents.length}`);
    console.log(`  - Resources: ${sim.resources.length}`);
    console.log(`  - Workshops active: ${sim.craftingSystem.workshops.size}`);
} catch (error) {
    console.log(`✗ Simulation crashed: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
}

// Test 6: Save/Load with crafting data
console.log("\nTest 6: Save/Load with crafting data...");
try {
    const saved = sim.serialize();
    const loadedSim = Simulation.deserialize(saved);
    if (loadedSim.craftingSystem && loadedSim.craftingSystem.recipes) {
        const loadedRecipeCount = loadedSim.craftingSystem.recipes.size;
        console.log("✓ Crafting data preserved through save/load");
        console.log(`  - Recipes after load: ${loadedRecipeCount}`);
        if (loadedRecipeCount !== 6) {
            console.log(`⚠ Expected 6 recipes, got ${loadedRecipeCount}`);
        }
    } else {
        console.log("✗ Crafting data lost in save/load");
        process.exit(1);
    }
} catch (error) {
    console.log(`✗ Save/Load failed: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
}

console.log("\n=== ALL CRAFTING TESTS PASSED! ===");
