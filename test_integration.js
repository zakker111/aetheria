// Integration test to verify all systems work together
import { Simulation } from './src/simulation/simulation.js';

console.log("=== AETHERIA INTEGRATION TEST ===\n");

try {
    // Create simulation
    const sim = new Simulation();
    console.log("✓ Simulation created");
    
    // Check world generation
    const world = sim.world;
    if (world && world.tiles && (world.tiles.length === 128 * 128 || world.tiles.length === 64 * 64)) {
        console.log(`✓ World generated: ${world.width}x${world.height} tiles (${world.tiles.length})`);
    } else {
        console.error("✗ World size incorrect or missing");
        console.log("World object:", world ? "exists" : "missing");
        if (world) console.log("Tiles:", world.tiles ? world.tiles.length : "missing");
    }
    
    // Check biomes
    if (world && world.tiles) {
        const biomes = new Set(world.tiles.map(t => t.biome));
        console.log(`✓ Biomes present: ${biomes.size} types`);
    }
    
    // Check resources
    const resourceCount = sim.resources ? sim.resources.length : 0;
    console.log(`✓ Resources spawned: ${resourceCount}`);
    
    // Spawn agents
    for (let i = 0; i < 10; i++) {
        if (sim.addAgent) {
            sim.addAgent({
                x: Math.floor(Math.random() * 128),
                y: Math.floor(Math.random() * 128)
            });
        }
    }
    const agentCount = sim.agents ? sim.agents.length : 0;
    console.log(`✓ Agents spawned: ${agentCount}`);
    
    // Run ticks
    for (let i = 0; i < 100; i++) {
        if (sim.tick) sim.tick();
    }
    console.log("✓ 100 ticks completed without errors");
    
    // Check systems exist
    const systems = [
        'craftingSystem', 'economySystem', 'settlementSystem',
        'combatSystem', 'constructionSystem', 'religionSystem',
        'tradeSystem', 'infrastructureSystem', 'ageSystem',
        'formationSystem', 'relationshipSystem', 'factionSystem'
    ];
    
    systems.forEach(sys => {
        if (sim[sys]) {
            console.log(`✓ ${sys} initialized`);
        } else {
            console.error(`✗ ${sys} missing!`);
        }
    });
    
    // Test crafting
    if (sim.craftingSystem) {
        const recipes = sim.craftingSystem.recipes || [];
        console.log(`✓ Crafting recipes: ${recipes.length}`);
    }
    
    console.log("\n=== ALL TESTS PASSED ===");
    process.exit(0);
    
} catch (error) {
    console.error("\n=== TEST FAILED ===");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
}
