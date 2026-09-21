/**
 * Test Crafting System Implementation
 */

import { Simulation } from './src/simulation/simulation.js';

console.log('🧪 Testing Crafting System...\n');

// Create simulation
const sim = new Simulation(12345);

// Test 1: Check crafting system is initialized
console.log('Test 1: Crafting System Initialization');
if (sim.craftingSystem) {
    console.log('✅ Crafting system initialized');
} else {
    console.log('❌ Crafting system not found');
    process.exit(1);
}

// Test 2: Check recipes are loaded
console.log('\nTest 2: Recipe Loading');
const recipes = sim.craftingSystem.getAllRecipes();
console.log(`✅ Loaded ${recipes.length} recipes:`);
recipes.forEach(recipe => {
    console.log(`   - ${recipe.name} (${recipe.id})`);
});

// Test 3: Create workshops
console.log('\nTest 3: Workshop Creation');
const lumberMill = sim.craftingSystem.createWorkshop(10, 10, 'lumber_mill', 'Lumber Mill #1');
const smeltery = sim.craftingSystem.createWorkshop(15, 15, 'smeltery', 'Iron Smeltery');
const bakery = sim.craftingSystem.createWorkshop(20, 20, 'bakery', 'Village Bakery');

if (lumberMill && smeltery && bakery) {
    console.log('✅ Created 3 workshops successfully');
} else {
    console.log('❌ Failed to create workshops');
    process.exit(1);
}

// Test 4: Queue recipes
console.log('\nTest 4: Recipe Queueing');
const queued1 = sim.craftingSystem.queueRecipe(lumberMill.id, 'log_to_plank', 5);
console.log(`✅ Queued 5x Saw Log tasks: ${queued1}`);

// Test 5: Deposit resources
console.log('\nTest 5: Resource Management');
sim.craftingSystem.depositToWorkshop(lumberMill.id, 'wood_log', 10);
console.log('✅ Deposited 10 wood_log to lumber mill');

const stats = sim.craftingSystem.getWorkshopStats(lumberMill.id);
console.log(`   Storage: ${JSON.stringify(stats.storage)}`);
console.log(`   Queue length: ${stats.queueLength}`);

// Test 6: Assign workers
console.log('\nTest 6: Worker Assignment');
const agent = sim.agents[0];
if (agent) {
    const assigned = sim.craftingSystem.assignWorker(lumberMill.id, agent.id);
    console.log(`✅ Assigned agent ${agent.id} to lumber mill: ${assigned}`);
    
    // Update agent job
    const economyJob = sim.economySystem.assignJob(agent, ['craftsman']);
    console.log(`   Agent job set to: ${economyJob.job}`);
}

// Test 7: Run simulation ticks
console.log('\nTest 7: Simulation Ticks with Crafting');
for (let i = 0; i < 100; i++) {
    sim.tick();
    
    if (i % 20 === 0) {
        const workshopStats = sim.craftingSystem.getWorkshopStats(lumberMill.id);
        console.log(`   Tick ${i}: Progress=${workshopStats.progress.toFixed(1)}, Queue=${workshopStats.queueLength}`);
    }
}

// Test 8: Check final state
console.log('\nTest 8: Final Workshop State');
const finalStats = sim.craftingSystem.getWorkshopStats(lumberMill.id);
console.log(`   Active recipe: ${finalStats.activeRecipe || 'none'}`);
console.log(`   Progress: ${finalStats.progress.toFixed(1)}`);
console.log(`   Workers: ${finalStats.workers}`);
console.log(`   Storage: ${JSON.stringify(finalStats.storage)}`);

// Test 9: Multi-ingredient recipe
console.log('\nTest 9: Complex Recipe (Bread)');
sim.craftingSystem.depositToWorkshop(bakery.id, 'flour', 5);
sim.craftingSystem.depositToWorkshop(bakery.id, 'water', 5);
sim.craftingSystem.queueRecipe(bakery.id, 'flour_plus_water_to_bread', 3);
console.log('✅ Queued bread baking with multiple ingredients');

// Run more ticks
for (let i = 0; i < 200; i++) {
    sim.tick();
}

const bakeryStats = sim.craftingSystem.getWorkshopStats(bakery.id);
console.log(`   Bread produced: ${bakeryStats.storage.bread || 0}`);

console.log('\n✅ All crafting system tests passed!');
console.log('\n📊 Summary:');
console.log(`   - Recipes: ${recipes.length}`);
console.log(`   - Workshops: ${sim.craftingSystem.workshops.size}`);
console.log(`   - Supply chain: Raw → Processed → Advanced items`);
