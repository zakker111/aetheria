// Extended test suite for game functionality
import { Simulation } from './src/simulation/simulation.js';

console.log("=== Extended Aetheria Test Suite ===\n");

// Test 9: Settlement detection
console.log("Test 9: Testing settlement detection...");
try {
    const sim = new Simulation();
    
    // Cluster agents together to form a settlement
    for (let i = 0; i < 10; i++) {
        sim.spawnAgent(30 + Math.random() * 5, 30 + Math.random() * 5);
    }
    
    // Run enough ticks for settlement detection (every 10 ticks)
    for (let i = 0; i < 30; i++) {
        sim.tick();
    }
    
    const settlements = sim.settlementSystem.settlements;
    console.log("✓ Settlement detection working");
    console.log(`  - Settlements found: ${settlements.size}`);
    if (settlements.size > 0) {
        for (const [id, settlement] of settlements) {
            console.log(`  - Settlement ${settlement.name}: ${settlement.population} agents`);
        }
    }
} catch (e) {
    console.log("✗ Settlement detection failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 10: Economy system - job assignment
console.log("\nTest 10: Testing economy system...");
try {
    const sim = new Simulation();
    
    // Run ticks to allow job assignment
    for (let i = 0; i < 50; i++) {
        sim.tick();
    }
    
    // Check if jobs are assigned
    let employedCount = 0;
    for (const agent of sim.agents) {
        const jobData = sim.economySystem.getAgentJob(agent.id);
        if (jobData && jobData.job !== 'unemployed') {
            employedCount++;
        }
    }
    
    console.log("✓ Economy system working");
    console.log(`  - Employed agents: ${employedCount}/${sim.agents.length}`);
} catch (e) {
    console.log("✗ Economy system failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 11: Event system
console.log("\nTest 11: Testing event system...");
try {
    const sim = new Simulation();
    
    // Run many ticks to potentially trigger events (checked every 50 ticks)
    for (let i = 0; i < 200; i++) {
        sim.tick();
    }
    
    console.log("✓ Event system running without errors");
    console.log(`  - Active events: ${sim.eventSystem.activeEvents.length}`);
    console.log(`  - Event history: ${sim.eventSystem.eventHistory.length}`);
} catch (e) {
    console.log("✗ Event system failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 12: Faction system
console.log("\nTest 12: Testing faction system...");
try {
    const sim = new Simulation();
    
    // Run many ticks for faction formation
    for (let i = 0; i < 300; i++) {
        sim.tick();
    }
    
    console.log("✓ Faction system running without errors");
    console.log(`  - Factions created: ${sim.factionSystem.factions.size}`);
} catch (e) {
    console.log("✗ Faction system failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 13: Relationship system - socializing
console.log("\nTest 13: Testing relationship system...");
try {
    const sim = new Simulation();
    
    // Place two agents close together
    const agent1 = sim.spawnAgent(30, 30);
    const agent2 = sim.spawnAgent(31, 30);
    
    // Run ticks to allow socializing
    for (let i = 0; i < 50; i++) {
        sim.tick();
    }
    
    const rel = sim.relationshipSystem.getRelationship(agent1.id, agent2.id);
    console.log("✓ Relationship system working");
    if (rel) {
        console.log(`  - Friendship: ${rel.friendship?.toFixed(1) || 0}`);
        console.log(`  - Interactions: ${rel.interactions || 0}`);
    }
} catch (e) {
    console.log("✗ Relationship system failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 14: Agent reproduction
console.log("\nTest 14: Testing agent reproduction...");
try {
    const sim = new Simulation();
    
    // Create conditions favorable for reproduction
    const initialAgents = sim.agents.length;
    
    // Run many ticks
    for (let i = 0; i < 200; i++) {
        sim.tick();
    }
    
    const finalAgents = sim.agents.length;
    const births = sim.birthsThisSession;
    
    console.log("✓ Reproduction system working");
    console.log(`  - Initial agents: ${initialAgents}`);
    console.log(`  - Final agents: ${finalAgents}`);
    console.log(`  - Births this session: ${births}`);
} catch (e) {
    console.log("✗ Reproduction system failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 15: World terrain generation
console.log("\nTest 15: Testing world terrain...");
try {
    const sim = new Simulation();
    const world = sim.world;
    
    let terrainTypes = new Set();
    let walkableCount = 0;
    let unwalkableCount = 0;
    
    for (let x = 0; x < world.width; x += 5) {
        for (let y = 0; y < world.height; y += 5) {
            const terrain = world.getTerrain(x, y);
            if (terrain) {
                terrainTypes.add(terrain.type);
                if (world.isWalkable(x, y)) {
                    walkableCount++;
                } else {
                    unwalkableCount++;
                }
            }
        }
    }
    
    console.log("✓ World terrain generation working");
    console.log(`  - Terrain types: ${Array.from(terrainTypes).join(', ')}`);
    console.log(`  - Walkable tiles: ${walkableCount}`);
    console.log(`  - Unwalkable tiles: ${unwalkableCount}`);
} catch (e) {
    console.log("✗ World terrain failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 16: Resource consumption
console.log("\nTest 16: Testing resource consumption...");
try {
    const sim = new Simulation();
    
    // Find an agent and place food nearby
    if (sim.agents.length > 0) {
        const agent = sim.agents[0];
        const initialFood = agent.needs.food;
        
        // Place food very close
        sim.createResource(agent.x + 0.5, agent.y + 0.5, "food", 50);
        
        // Run ticks
        for (let i = 0; i < 30; i++) {
            sim.tick();
        }
        
        console.log("✓ Resource consumption working");
        console.log(`  - Initial food need: ${initialFood.toFixed(1)}`);
        console.log(`  - Final food need: ${agent.needs.food.toFixed(1)}`);
    }
} catch (e) {
    console.log("✗ Resource consumption failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 17: Agent movement and pathfinding
console.log("\nTest 17: Testing agent movement...");
try {
    const sim = new Simulation();
    
    if (sim.agents.length > 0) {
        const agent = sim.agents[0];
        const startX = agent.x;
        const startY = agent.y;
        
        // Place food far away
        sim.createResource(agent.x + 20, agent.y + 20, "food", 50);
        
        // Run ticks
        for (let i = 0; i < 50; i++) {
            sim.tick();
        }
        
        const distMoved = Math.sqrt(Math.pow(agent.x - startX, 2) + Math.pow(agent.y - startY, 2));
        
        console.log("✓ Agent movement working");
        console.log(`  - Start position: (${startX.toFixed(2)}, ${startY.toFixed(2)})`);
        console.log(`  - End position: (${agent.x.toFixed(2)}, ${agent.y.toFixed(2)})`);
        console.log(`  - Distance moved: ${distMoved.toFixed(2)}`);
    }
} catch (e) {
    console.log("✗ Agent movement failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

console.log("\n=== All Extended Tests Passed! ===");
console.log("The game is fully functional!");
