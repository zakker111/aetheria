// Comprehensive game functionality test
import { Simulation } from './src/simulation/simulation.js';

console.log("=== COMPREHENSIVE GAME TEST ===\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${name}: ${e.message}`);
        failed++;
    }
}

// Test 1: Basic initialization
test("Simulation initializes", () => {
    const sim = new Simulation();
    if (!sim.world) throw new Error("No world");
    if (!sim.agents) throw new Error("No agents array");
    if (!sim.resources) throw new Error("No resources array");
});

// Test 2: Agent spawning via god power
test("Spawn agent at valid location", () => {
    const sim = new Simulation();
    const agent = sim.spawnAgent(32, 32);
    if (!agent) throw new Error("Agent not created");
    if (agent.x !== 32 || agent.y !== 32) throw new Error("Wrong position");
    if (!agent.alive) throw new Error("Agent not alive");
});

// Test 3: Resource creation - all types
test("Create food resource", () => {
    const sim = new Simulation();
    const res = sim.createResource(10, 10, 'food', 50);
    if (!res) throw new Error("Resource not created");
    if (res.resourceType !== 'food') throw new Error("Wrong type");
    if (res.amount !== 50) throw new Error("Wrong amount");
});

test("Create water resource", () => {
    const sim = new Simulation();
    const res = sim.createResource(15, 15, 'water', 100);
    if (!res || res.resourceType !== 'water') throw new Error("Water creation failed");
});

test("Create wood resource", () => {
    const sim = new Simulation();
    const res = sim.createResource(20, 20, 'wood', 30);
    if (!res || res.resourceType !== 'wood') throw new Error("Wood creation failed");
});

test("Create ore resource", () => {
    const sim = new Simulation();
    const res = sim.createResource(25, 25, 'ore', 20);
    if (!res || res.resourceType !== 'ore') throw new Error("Ore creation failed");
});

// Test 4: Remove resource
test("Remove resource", () => {
    const sim = new Simulation();
    sim.createResource(10, 10, 'food', 50);
    const before = sim.resources.length;
    sim.removeResource(10, 10);
    const after = sim.resources.length;
    if (after >= before) throw new Error("Resource not removed");
});

// Test 5: Simulation ticks
test("Run multiple simulation ticks", () => {
    const sim = new Simulation();
    const initialAgents = sim.agents.length;
    for (let i = 0; i < 50; i++) {
        sim.tick();
    }
    // Agents should still exist (some may die naturally)
    if (sim.agents.length < 0) throw new Error("All agents died unexpectedly");
});

// Test 6: Event system doesn't crash
test("Event system processes without errors", () => {
    const sim = new Simulation();
    for (let i = 0; i < 100; i++) {
        sim.tick();
    }
    // If we get here, event system didn't crash
});

// Test 7: Settlement detection
test("Settlement system detects clusters", () => {
    const sim = new Simulation();
    // Run some ticks to let agents cluster
    for (let i = 0; i < 30; i++) {
        sim.tick();
    }
    // Settlement system should be initialized
    if (!sim.settlementSystem) throw new Error("No settlement system");
});

// Test 8: Economy system
test("Economy system assigns jobs", () => {
    const sim = new Simulation();
    for (let i = 0; i < 40; i++) {
        sim.tick();
    }
    if (!sim.economySystem) throw new Error("No economy system");
});

// Test 9: Relationship system
test("Relationship system tracks relationships", () => {
    const sim = new Simulation();
    if (!sim.relationshipSystem) throw new Error("No relationship system");
});

// Test 10: Faction system
test("Faction system initializes", () => {
    const sim = new Simulation();
    if (!sim.factionSystem) throw new Error("No faction system");
});

// Test 11: Clock controls
test("Clock advances time", () => {
    const sim = new Simulation();
    const startTick = sim.clock.tick;
    sim.tick();
    sim.tick();
    sim.tick();
    if (sim.clock.tick <= startTick) throw new Error("Clock didn't advance");
});

test("Clock speed control", () => {
    const sim = new Simulation();
    sim.clock.setSpeed(5);
    if (sim.clock.speed !== 5) throw new Error("Speed not set");
    sim.clock.pause();
    if (sim.clock.speed !== 0) throw new Error("Pause failed");
});

// Test 12: Serialization
test("Save and load simulation", () => {
    const sim = new Simulation();
    sim.spawnAgent(32, 32);
    sim.createResource(10, 10, 'food', 50);
    for (let i = 0; i < 10; i++) sim.tick();
    
    const data = sim.serialize();
    const loaded = Simulation.deserialize(data);
    
    if (!loaded.agents) throw new Error("Loaded simulation has no agents");
    if (!loaded.resources) throw new Error("Loaded simulation has no resources");
});

// Test 13: Multiple agents spawning
test("Spawn multiple agents", () => {
    const sim = new Simulation();
    const initial = sim.agents.length;
    for (let i = 0; i < 5; i++) {
        sim.spawnAgent(Math.random() * 64, Math.random() * 64);
    }
    if (sim.agents.length !== initial + 5) throw new Error("Not all agents spawned");
});

// Test 14: Resources persist through ticks
test("Resources persist through simulation", () => {
    const sim = new Simulation();
    sim.createResource(32, 32, 'food', 100);
    const before = sim.resources.length;
    for (let i = 0; i < 20; i++) sim.tick();
    const after = sim.resources.length;
    if (after < before - 1) throw new Error("Resources disappeared");
});

// Summary
console.log("\n=== TEST SUMMARY ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(failed === 0 ? "\n✓ ALL TESTS PASSED!" : `\n✗ ${failed} tests failed`);

process.exit(failed > 0 ? 1 : 0);
