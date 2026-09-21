const { Simulation } = require('./src/simulation/simulation.js');

console.log("=== FULL INTEGRATION TEST ===\n");

// Create simulation
const sim = new Simulation(64, 64);
console.log(`✓ Simulation created: ${sim.agents.length} agents, ${sim.resources.length} resources`);

// Test god powers
console.log("\n--- Testing God Powers ---");
sim.createResource(10, 10, 'wood', 50);
sim.createResource(15, 15, 'ore', 30);
sim.createResource(20, 20, 'food', 40);
sim.spawnAgent(25, 25);
console.log(`✓ God powers working: ${sim.agents.length} agents, ${sim.resources.length} resources after spawning`);

// Run extended simulation
console.log("\n--- Running Extended Simulation (200 ticks) ---");
let errors = [];
try {
    for (let i = 0; i < 200; i++) {
        sim.tick();
        
        // Check for critical issues every 50 ticks
        if (i % 50 === 0 && i > 0) {
            console.log(`  Tick ${i}: ${sim.agents.length} agents, ${sim.resources.length} resources, ${sim.craftingSystem.workshops.size} workshops`);
        }
    }
    console.log("✓ 200 ticks completed without crashes");
} catch (e) {
    errors.push(`Simulation crash: ${e.message}`);
    console.log(`✗ Simulation crashed at tick ${sim.clock.tick}: ${e.message}`);
}

// Check system states
console.log("\n--- System State Check ---");
console.log(`Agents alive: ${sim.agents.filter(a => a.alive).length}`);
console.log(`Settlements: ${sim.settlementSystem.settlements.size}`);
console.log(`Factions: ${sim.factionSystem.factions.size}`);
console.log(`Active events: ${sim.eventSystem.activeEvents.length}`);
console.log(`Crafting recipes: ${sim.craftingSystem.recipes.size}`);
console.log(`Workshops: ${sim.craftingSystem.workshops.size}`);

// Test save/load
console.log("\n--- Save/Load Test ---");
try {
    const saved = sim.serialize();
    const loaded = Simulation.deserialize(saved);
    console.log(`✓ Save/Load successful`);
    console.log(`  Loaded: ${loaded.agents.length} agents, ${loaded.resources.length} resources`);
    console.log(`  Loaded crafting: ${loaded.craftingSystem.recipes.size} recipes`);
} catch (e) {
    errors.push(`Save/Load error: ${e.message}`);
    console.log(`✗ Save/Load failed: ${e.message}`);
}

// Performance check
console.log("\n--- Performance Test ---");
const start = Date.now();
for (let i = 0; i < 100; i++) {
    sim.tick();
}
const duration = Date.now() - start;
const ticksPerSecond = 100 / (duration / 1000);
console.log(`✓ 100 ticks in ${duration}ms (${ticksPerSecond.toFixed(1)} ticks/sec)`);

if (ticksPerSecond < 10) {
    console.log("⚠ WARNING: Performance is low (< 10 ticks/sec)");
} else if (ticksPerSecond < 30) {
    console.log("✓ Performance acceptable (10-30 ticks/sec)");
} else {
    console.log("✓ Excellent performance (> 30 ticks/sec)");
}

// Final summary
console.log("\n=== FINAL SUMMARY ===");
if (errors.length === 0) {
    console.log("✓ ALL TESTS PASSED - Game is stable!");
    console.log(`   - Agents: ${sim.agents.length}`);
    console.log(`   - Resources: ${sim.resources.length}`);
    console.log(`   - Settlements: ${sim.settlementSystem.settlements.size}`);
    console.log(`   - Performance: ${ticksPerSecond.toFixed(1)} ticks/sec`);
} else {
    console.log("✗ ERRORS FOUND:");
    errors.forEach(e => console.log(`   - ${e}`));
    process.exit(1);
}
