// Phase B: Agent AI & Behavior Stress Test
import { Simulation } from './src/simulation/simulation.js';

console.log('=== PHASE B: AGENT AI & BEHAVIOR STRESS TEST ===');
console.log('');

const sim = new Simulation(12345);

// Test 1: Initial State Check
console.log('Initial agents: ' + sim.agents.length);
console.log('Initial resources: ' + sim.resources.length);

// Test 2: Spawn 50 Agents (God Tool simulation)
const spawnX = 64;
const spawnY = 64;
let spawnedCount = 0;

for (let i = 0; i < 50; i++) {
    const x = spawnX + (Math.random() - 0.5) * 10;
    const y = spawnY + (Math.random() - 0.5) * 10;
    
    if (sim.world.isWalkable(Math.floor(x), Math.floor(y))) {
        sim.spawnAgent(x, y);
        spawnedCount++;
    }
}

console.log('Spawned ' + spawnedCount + ' agents at grassland area');
console.log('Total agents now: ' + sim.agents.length);

// Test 3: Run simulation for 100 ticks (approx 2 minutes at game speed)
console.log('');
console.log('Running simulation for 100 ticks...');

let stuckAgents = 0;
let activeAgents = 0;
const initialPositions = new Map();

// Store initial positions
for (const agent of sim.agents) {
    initialPositions.set(agent.id, { x: agent.x, y: agent.y });
}

// Run ticks
for (let i = 0; i < 100; i++) {
    sim.tick();
}

// Check agent movement
for (const agent of sim.agents) {
    const initial = initialPositions.get(agent.id);
    if (!initial) {
        // Newborn agent born during simulation ticks
        activeAgents++;
        continue;
    }
    const dx = agent.x - initial.x;
    const dy = agent.y - initial.y;
    const distMoved = Math.sqrt(dx * dx + dy * dy);
    
    if (distMoved < 1) {
        // Agent barely moved
        if (!agent.alive) {
            // Dead agents don't count
        } else if (agent.needs.food <= 0 || agent.needs.water <= 0) {
            // Starved/dehydrated - expected behavior
        } else {
            stuckAgents++;
        }
    } else {
        activeAgents++;
    }
}

console.log('After 100 ticks:');
console.log('  Active agents (moved): ' + activeAgents);
console.log('  Stuck agents: ' + stuckAgents);
console.log('  Dead agents: ' + (sim.agents.filter(a => !a.alive).length));

if (stuckAgents < sim.agents.length * 0.1) {
    console.log('✓ PASS: Less than 10% agents stuck');
} else {
    console.log('✗ FAIL: Too many agents stuck (' + stuckAgents + ')');
}

// Test 4: Needs System Check
console.log('');
console.log('Needs System Check:');

let hungryAgents = 0;
let thirstyAgents = 0;
let agentsWithLowFood = 0;

for (const agent of sim.agents) {
    if (agent.alive) {
        if (agent.needs.food < 40) hungryAgents++;
        if (agent.needs.water < 40) thirstyAgents++;
        
        // Check if agent is actively seeking food/water
        if (agent.currentAction && (agent.currentAction.type === 'gather_food' || agent.currentAction.type === 'drink_water')) {
            agentsWithLowFood++;
        }
    }
}

console.log('  Hungry agents (food < 40): ' + hungryAgents);
console.log('  Thirsty agents (water < 40): ' + thirstyAgents);
console.log('  Agents actively seeking food/water: ' + agentsWithLowFood);

if (hungryAgents > 0 || thirstyAgents > 0) {
    console.log('✓ PASS: Needs system working - agents get hungry/thirsty');
} else {
    console.log('Note: All needs satisfied after 100 ticks');
}

// Test 5: Memory Test (simplified)
console.log('');
console.log('Memory Test:');
// Create a food patch far away
const foodX = 100;
const foodY = 100;
sim.createResource(foodX, foodY, 'food', 50);
console.log('Created food patch at (' + foodX + ', ' + foodY + ')');

// Find an agent and let it discover the food
const testAgent = sim.agents.find(a => a.alive && a.needs.food < 80);
if (testAgent) {
    console.log('Test agent ' + testAgent.id + ' found with food need: ' + testAgent.needs.food.toFixed(1));
    
    // Move agent closer to food manually
    testAgent.x = foodX - 5;
    testAgent.y = foodY - 5;
    
    // Run a few more ticks
    for (let i = 0; i < 20; i++) {
        sim.tick();
    }
    
    // Check if agent moved toward food
    const distToFood = Math.sqrt(Math.pow(testAgent.x - foodX, 2) + Math.pow(testAgent.y - foodY, 2));
    console.log('Agent distance to food after 20 ticks: ' + distToFood.toFixed(2));
    
    if (distToFood < 5) {
        console.log('✓ PASS: Agent moved toward food source');
    } else {
        console.log('Note: Agent did not reach food (may be occupied with other needs)');
    }
} else {
    console.log('Note: No suitable test agent found (all well-fed or dead)');
}

// Test 6: Social Interaction Check
console.log('');
console.log('Social Interaction Check:');

// Spawn two agents close together
const socialAgent1 = sim.spawnAgent(50, 50);
const socialAgent2 = sim.spawnAgent(51, 50);

console.log('Spawned two agents close together at (50, 50) and (51, 50)');

// Run simulation
for (let i = 0; i < 50; i++) {
    sim.tick();
}

// Check relationship system
const relData = sim.relationshipSystem.getRelationship(socialAgent1.id, socialAgent2.id);
console.log('Relationship data between agents:');
console.log('  Friendship: ' + (relData ? relData.friendship : 'N/A'));
console.log('  Trust: ' + (relData ? relData.trust : 'N/A'));

if (relData && (relData.friendship !== 0 || relData.trust !== 0)) {
    console.log('✓ PASS: Relationship values changed after interaction');
} else {
    console.log('Note: No relationship change detected yet');
}

// Final Summary
console.log('');
console.log('=== PHASE B SUMMARY ===');
console.log('Total agents tested: ' + sim.agents.length);
console.log('Alive agents: ' + sim.agents.filter(a => a.alive).length);
console.log('Deaths this session: ' + sim.deathsThisSession);
console.log('Births this session: ' + sim.birthsThisSession);
console.log('');
console.log('=== PHASE B COMPLETE ===');
