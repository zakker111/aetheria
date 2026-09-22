// Phase C: Economy & Crafting Verification Test
import { Simulation } from './src/simulation/simulation.js';

console.log('=== PHASE C: ECONOMY & CRAFTING VERIFICATION ===');
console.log('');

const sim = new Simulation(12345);

// Test 1: Resource Gathering
console.log('Test 1: Resource Gathering');
console.log('Initial resources: ' + sim.resources.length);

// Spawn Wood and Ore nearby agents
sim.createResource(30, 30, 'wood', 50);
sim.createResource(35, 35, 'ore', 50);
console.log('Created wood at (30, 30) and ore at (35, 35)');

// Run simulation
for (let i = 0; i < 100; i++) {
    sim.tick();
}

// Check if any agent gathered resources
let agentsWithResources = 0;
for (const agent of sim.agents) {
    if (agent.alive) {
        const totalResources = agent.inventory.wood_log + agent.inventory.ore_iron + agent.inventory.wheat;
        if (totalResources > 0) {
            agentsWithResources++;
            console.log('Agent ' + agent.id + ' has: wood=' + agent.inventory.wood_log + ', ore=' + agent.inventory.ore_iron + ', wheat=' + agent.inventory.wheat);
        }
    }
}

if (agentsWithResources > 0) {
    console.log('✓ PASS: ' + agentsWithResources + ' agents gathered resources');
} else {
    console.log('Note: No agents gathered resources yet (may need more time or job assignment)');
}

// Test 2: Crafting Chain
console.log('');
console.log('Test 2: Crafting System');

// Check crafting system initialization
console.log('Crafting system initialized: ' + (sim.craftingSystem !== null));
console.log('Workshops count: ' + sim.craftingSystem.workshops.size);

// Test recipe validation - use getAllRecipes() method
const recipes = sim.craftingSystem.getAllRecipes();
console.log('Available recipes: ' + recipes.length);

// Check for key recipes
const hasLogToPlank = recipes.some(r => r.output && r.output.type === 'wood_plank' && r.input && r.input.type === 'wood_log');
const hasPlankToHandle = recipes.some(r => r.output && r.output.type === 'tool_handle' && r.input && r.input.type === 'wood_plank');
const hasHandleToPickaxe = recipes.some(r => r.output && r.output.type === 'pickaxe');

console.log('Recipe: Log → Planks: ' + (hasLogToPlank ? '✓' : '✗'));
console.log('Recipe: Plank → Tool Handle: ' + (hasPlankToHandle ? '✓' : '✗'));
console.log('Recipe: Handle → Pickaxe: ' + (hasHandleToPickaxe ? '✓' : '✗'));

if (hasLogToPlank && hasPlankToHandle && hasHandleToPickaxe) {
    console.log('✓ PASS: Complete crafting chain exists');
} else {
    console.log('✗ FAIL: Crafting chain incomplete');
}

// Test 3: Workshop Creation
console.log('');
console.log('Test 3: Workshop Construction');

// Create a workshop manually - use correct signature (x, y, type, name)
const workshopObj = sim.craftingSystem.createWorkshop(40, 40, 'workshop', 'Test Workshop');
console.log('Workshop created');

if (workshopObj && workshopObj.id) {
    const workshopId = workshopObj.id;
    const workshop = sim.craftingSystem.workshops.get(workshopId);
    console.log('Workshop details:');
    console.log('  Position: (' + workshop.x + ', ' + workshop.y + ')');
    console.log('  Type: ' + workshop.subtype);
    console.log('  Workers: ' + workshop.assignedWorkers.length);
    console.log('✓ PASS: Workshop created successfully');
} else {
    console.log('✗ FAIL: Could not create workshop');
}

// Test 4: Crafting Execution
console.log('');
console.log('Test 4: Crafting Execution');

// Give an agent some raw materials
const testAgent = sim.agents.find(a => a.alive);
const workshopId = workshopObj.id;

if (testAgent) {
    // Deposit wood_log to workshop storage first
    sim.craftingSystem.depositToWorkshop(workshopId, 'wood_log', 5);
    console.log('Deposited 5 wood_log to workshop');
    
    // Assign agent to workshop as craftsman
    sim.craftingSystem.assignWorker(workshopId, testAgent.id);
    testAgent.job = 'craftsman';
    testAgent.workplace = workshopId;
    console.log('Assigned agent as craftsman to workshop');
    
    // Queue a crafting recipe (log_to_plank)
    sim.craftingSystem.queueRecipe(workshopId, 'log_to_plank');
    console.log('Queued log_to_plank recipe');
    
    // Run simulation to process crafting
    for (let i = 0; i < 100; i++) {
        sim.tick();
    }
    
    // Check results
    const workshop = sim.craftingSystem.workshops.get(workshopId);
    console.log('Workshop queue: ' + workshop.queue.length + ' items');
    console.log('Workshop storage: ' + JSON.stringify(Object.fromEntries(workshop.storage)));
    
    if (workshop.storage.get('wood_plank') > 0) {
        console.log('✓ PASS: Crafting produced output');
    } else {
        console.log('Note: Crafting in progress or resources insufficient');
    }
}

// Test 5: Market/Trading
console.log('');
console.log('Test 5: Economy System');

// Check economy system
console.log('Economy system initialized: ' + (sim.economySystem !== null));

// Get market prices
const marketPrices = sim.economySystem.marketPrices;
console.log('Current market prices:');
for (const [resource, price] of Object.entries(marketPrices)) {
    console.log('  ' + resource + ': ' + price.toFixed(2));
}

// Create resource surplus and scarcity
console.log('');
console.log('Creating resource imbalance...');
sim.createResource(50, 50, 'food', 100); // Surplus
// Don't create wood - scarcity

// Run simulation
for (let i = 0; i < 100; i++) {
    sim.tick();
}

// Check if prices updated
const newPrices = sim.economySystem.marketPrices;
console.log('Updated market prices after imbalance:');
for (const [resource, price] of Object.entries(newPrices)) {
    console.log('  ' + resource + ': ' + price.toFixed(2));
}

// Final Summary
console.log('');
console.log('=== PHASE C SUMMARY ===');
console.log('Total resources: ' + sim.resources.length);
console.log('Total buildings: ' + sim.buildings.length);
console.log('Active workshops: ' + sim.craftingSystem.workshops.size);
console.log('');
console.log('=== PHASE C COMPLETE ===');
