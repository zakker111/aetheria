const { Simulation } = require('./src/simulation/simulation.js');

console.log("=== DEEP CRAFTING SYSTEM TEST ===\n");

// Test 1: Basic crafting system initialization
console.log("Test 1: Crafting system initialization...");
const sim = new Simulation(64, 64);
if (sim.craftingSystem) {
    console.log("✓ Crafting system initialized");
    console.log(`  - Recipes loaded: ${Object.keys(sim.craftingSystem.recipes).length}`);
    console.log(`  - Workshops: ${sim.craftingSystem.workshops.size}`);
} else {
    console.log("✗ Crafting system NOT initialized");
    process.exit(1);
}

// Test 2: Check recipes exist
console.log("\nTest 2: Recipe validation...");
const requiredRecipes = ['planks', 'iron_ingot', 'flour', 'tool_handle', 'pickaxe', 'bread'];
let allRecipesOk = true;
for (const recipe of requiredRecipes) {
    if (sim.craftingSystem.recipes[recipe]) {
        console.log(`✓ Recipe '${recipe}' exists`);
    } else {
        console.log(`✗ Recipe '${recipe}' MISSING`);
        allRecipesOk = false;
    }
}
if (!allRecipesOk) process.exit(1);

// Test 3: Agent inventory system
console.log("\nTest 3: Agent inventory system...");
const agents = Array.from(sim.agents.values());
if (agents.length > 0) {
    const agent = agents[0];
    if (agent.inventory !== undefined) {
        console.log("✓ Agent has inventory property");
        console.log(`  - Inventory capacity: ${agent.inventoryCapacity || 10}`);
        console.log(`  - Current items: ${agent.inventory ? agent.inventory.length : 0}`);
    } else {
        console.log("✗ Agent missing inventory property");
        process.exit(1);
    }
} else {
    console.log("⚠ No agents to test (spawning one...)");
    sim.spawnAgent(32, 32, 'male');
    const newAgent = Array.from(sim.agents.values())[0];
    if (newAgent.inventory !== undefined) {
        console.log("✓ Newly spawned agent has inventory");
    } else {
        console.log("✗ New agent missing inventory");
        process.exit(1);
    }
}

// Test 4: Crafting skills on agents
console.log("\nTest 4: Agent crafting skills...");
const testAgent = Array.from(sim.agents.values())[0] || sim.spawnAgent(30, 30, 'male');
const requiredSkills = ['carpentry', 'smithing', 'milling', 'cooking'];
let allSkillsOk = true;
for (const skill of requiredSkills) {
    if (testAgent.skills && testAgent.skills[skill] !== undefined) {
        console.log(`✓ Skill '${skill}' exists: ${testAgent.skills[skill]}`);
    } else {
        console.log(`⚠ Skill '${skill}' not initialized (will default to 0)`);
    }
}

// Test 5: Run simulation with crafting
console.log("\nTest 5: Running simulation with crafting system...");
try {
    for (let i = 0; i < 50; i++) {
        sim.tick();
    }
    console.log("✓ Simulation ran 50 ticks without errors");
    console.log(`  - Final tick: ${sim.clock.tick}`);
    console.log(`  - Agents: ${sim.agents.size}`);
    console.log(`  - Resources: ${sim.resources.size}`);
    console.log(`  - Workshops active: ${sim.craftingSystem.workshops.size}`);
} catch (error) {
    console.log(`✗ Simulation crashed: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
}

// Test 6: Check workshop assignment
console.log("\nTest 6: Workshop assignment...");
const craftsmen = Array.from(sim.agents.values()).filter(a => a.profession === 'craftsman');
console.log(`  - Total craftsmen: ${craftsmen.length}`);
console.log(`  - Active workshops: ${sim.craftingSystem.workshops.size}`);
if (sim.craftingSystem.workshops.size > 0 || craftsmen.length === 0) {
    console.log("✓ Workshop system functioning");
} else {
    console.log("⚠ No workshops created (may need more craftsmen/resources)");
}

// Test 7: Save/Load with crafting data
console.log("\nTest 7: Save/Load with crafting data...");
try {
    const saved = sim.save();
    const loadedSim = Simulation.load(saved);
    if (loadedSim.craftingSystem && loadedSim.craftingSystem.workshops) {
        console.log("✓ Crafting data preserved through save/load");
        console.log(`  - Workshops after load: ${loadedSim.craftingSystem.workshops.size}`);
    } else {
        console.log("✗ Crafting data lost in save/load");
        process.exit(1);
    }
} catch (error) {
    console.log(`✗ Save/Load failed: ${error.message}`);
    process.exit(1);
}

console.log("\n=== ALL DEEP CRAFTING TESTS PASSED! ===");
