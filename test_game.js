// Test script to verify game functionality
import { Simulation } from './src/simulation/simulation.js';

console.log("=== Aetheria Game Test Suite ===\n");

// Test 1: Simulation initialization
console.log("Test 1: Creating simulation...");
try {
    const sim = new Simulation();
    console.log("✓ Simulation created successfully");
    console.log(`  - World size: ${sim.world.width}x${sim.world.height}`);
    console.log(`  - Initial agents: ${sim.agents.length}`);
    console.log(`  - Initial resources: ${sim.resources.length}`);
} catch (e) {
    console.log("✗ Failed to create simulation:", e.message);
    process.exit(1);
}

// Test 2: Agent spawning
console.log("\nTest 2: Testing agent spawning...");
try {
    const sim = new Simulation();
    const initialCount = sim.agents.length;
    const agent = sim.spawnAgent(32, 32);
    if (agent && agent.id && agent.x === 32 && agent.y === 32) {
        console.log("✓ Agent spawned successfully at (32, 32)");
        console.log(`  - Agent ID: ${agent.id}`);
        console.log(`  - Total agents now: ${sim.agents.length}`);
    } else {
        throw new Error("Agent not properly initialized");
    }
} catch (e) {
    console.log("✗ Failed to spawn agent:", e.message);
    process.exit(1);
}

// Test 3: Resource creation
console.log("\nTest 3: Testing resource creation...");
try {
    const sim = new Simulation();
    const food = sim.createResource(10, 10, "food", 50);
    const water = sim.createResource(15, 15, "water", 100);
    const wood = sim.createResource(20, 20, "wood", 30);
    const ore = sim.createResource(25, 25, "ore", 20);
    
    if (food && water && wood && ore) {
        console.log("✓ All resource types created successfully");
        console.log(`  - Food: ${food.amount}, Water: ${water.amount}, Wood: ${wood.amount}, Ore: ${ore.amount}`);
        console.log(`  - Total resources: ${sim.resources.length}`);
    } else {
        throw new Error("Resource not properly created");
    }
} catch (e) {
    console.log("✗ Failed to create resources:", e.message);
    process.exit(1);
}

// Test 4: Simulation tick
console.log("\nTest 4: Testing simulation tick...");
try {
    const sim = new Simulation();
    const initialAgents = sim.agents.length;
    const initialResources = sim.resources.length;
    
    // Run 10 ticks
    for (let i = 0; i < 10; i++) {
        sim.tick();
    }
    
    console.log("✓ Simulation ran 10 ticks successfully");
    console.log(`  - Agents: ${initialAgents} -> ${sim.agents.length}`);
    console.log(`  - Resources: ${initialResources} -> ${sim.resources.length}`);
    console.log(`  - Current time: Day ${sim.clock.getTime().days + 1}, Hour ${sim.clock.getTime().hours}`);
} catch (e) {
    console.log("✗ Simulation tick failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 5: Agent behavior
console.log("\nTest 5: Testing agent behavior...");
try {
    const sim = new Simulation();
    
    // Add some food near an agent
    if (sim.agents.length > 0) {
        const agent = sim.agents[0];
        sim.createResource(agent.x + 2, agent.y + 2, "food", 50);
        
        // Run a few ticks to let agent find food
        for (let i = 0; i < 20; i++) {
            sim.tick();
        }
        
        console.log("✓ Agent behavior test completed");
        console.log(`  - Agent at: (${agent.x.toFixed(2)}, ${agent.y.toFixed(2)})`);
        console.log(`  - Agent needs - Food: ${agent.needs.food.toFixed(1)}, Water: ${agent.needs.water.toFixed(1)}`);
        console.log(`  - Agent alive: ${agent.alive}`);
    } else {
        throw new Error("No agents available for testing");
    }
} catch (e) {
    console.log("✗ Agent behavior test failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 6: Serialization/Deserialization
console.log("\nTest 6: Testing save/load system...");
try {
    const sim1 = new Simulation();
    
    // Run a few ticks
    for (let i = 0; i < 5; i++) {
        sim1.tick();
    }
    
    // Serialize
    const data = sim1.serialize();
    
    // Deserialize
    const sim2 = Simulation.deserialize(data);
    
    if (sim2.agents.length === sim1.agents.length &&
        sim2.resources.length === sim1.resources.length &&
        sim2.clock.tick === sim1.clock.tick) {
        console.log("✓ Save/Load system working correctly");
        console.log(`  - Agents preserved: ${sim2.agents.length}`);
        console.log(`  - Resources preserved: ${sim2.resources.length}`);
        console.log(`  - Tick preserved: ${sim2.clock.tick}`);
    } else {
        throw new Error("Save/Load mismatch");
    }
} catch (e) {
    console.log("✗ Save/Load test failed:", e.message);
    console.log(e.stack);
    process.exit(1);
}

// Test 7: Systems initialization
console.log("\nTest 7: Testing game systems...");
try {
    const sim = new Simulation();
    
    const systems = {
        'RelationshipSystem': sim.relationshipSystem,
        'SettlementSystem': sim.settlementSystem,
        'EconomySystem': sim.economySystem,
        'EventSystem': sim.eventSystem,
        'FactionSystem': sim.factionSystem
    };
    
    for (const [name, system] of Object.entries(systems)) {
        if (!system) {
            throw new Error(`${name} not initialized`);
        }
    }
    
    console.log("✓ All game systems initialized correctly");
    Object.keys(systems).forEach(name => console.log(`  - ${name}: OK`));
} catch (e) {
    console.log("✗ System initialization failed:", e.message);
    process.exit(1);
}

// Test 8: Clock and speed control
console.log("\nTest 8: Testing clock controls...");
try {
    const sim = new Simulation();
    const startTick = sim.clock.tick;
    
    // Normal speed
    sim.clock.setSpeed(1);
    sim.tick();
    if (sim.clock.tick !== startTick + 1) throw new Error("Speed 1 failed");
    
    // Fast speed
    sim.clock.setSpeed(5);
    sim.tick();
    if (sim.clock.tick !== startTick + 2) throw new Error("Speed 5 failed");
    
    // Pause
    sim.clock.pause();
    sim.tick();
    if (sim.clock.tick !== startTick + 2) throw new Error("Pause failed");
    
    // Resume
    sim.clock.setSpeed(1);
    sim.tick();
    
    console.log("✓ Clock controls working correctly");
    console.log(`  - Start tick: ${startTick}, Current tick: ${sim.clock.tick}`);
    console.log(`  - Speed: ${sim.clock.speed}x`);
} catch (e) {
    console.log("✗ Clock control test failed:", e.message);
    process.exit(1);
}

console.log("\n=== All Tests Passed! ===");
console.log("The game is functioning correctly.");
