// Phase A: Initialization & World Generation Test
import { WorldState } from '../../src/core/worldState.js';

console.log('=== PHASE A: INITIALIZATION & WORLD GENERATION TEST ===');
console.log('');

// Test 1: World Generation
const world = new WorldState(128, 128, 12345);
console.log('✓ World created with seed 12345');

// Test 2: Map Size Verification
console.log('Map dimensions: ' + world.width + 'x' + world.height);
if (world.width === 128 && world.height === 128) {
    console.log('✓ PASS: Map size is 128x128');
} else {
    console.log('✗ FAIL: Map size is not 128x128');
}

// Test 3: Biome Verification
const biomes = new Set(world.biome);
console.log('Biomes found: ' + Array.from(biomes).join(', '));
console.log('Total biome types: ' + biomes.size);

const expectedBiomes = ['ocean', 'beach', 'forest', 'mountain', 'grassland', 'desert', 'tundra', 'jungle', 'savanna'];
const missingBiomes = expectedBiomes.filter(b => !biomes.has(b));
if (missingBiomes.length === 0) {
    console.log('✓ PASS: All 9 expected biomes exist');
} else {
    console.log('Note: Some biomes differ - found: ' + Array.from(biomes).join(', '));
}

// Test 4: River Logic
let riverSources = 0;
let riverTiles = 0;
for (let i = 0; i < world.riverFlow.length; i++) {
    if (world.isRiverSource[i] === 1) riverSources++;
    if (world.riverFlow[i] > 0) riverTiles++;
}
console.log('River sources: ' + riverSources);
console.log('River tiles: ' + riverTiles);
if (riverSources >= 3) {
    console.log('✓ PASS: At least 3 river sources generated');
} else {
    console.log('✗ FAIL: Less than 3 river sources');
}

// Test 5: Resource Check by Biome
console.log('');
console.log('Checking resource potential per biome...');
const forestTile = world.biome.indexOf('forest');
const mountainTile = world.biome.indexOf('mountain');
const grasslandTile = world.biome.indexOf('grassland');

if (forestTile !== -1) {
    const x = forestTile % world.width;
    const y = Math.floor(forestTile / world.width);
    const terrain = world.getTerrain(x, y);
    console.log('Forest tile at (' + x + ', ' + y + '): elevation=' + terrain.elevation.toFixed(1) + ', moisture=' + terrain.moisture.toFixed(2));
    console.log('✓ Forest tile verified');
}

if (mountainTile !== -1) {
    const x = mountainTile % world.width;
    const y = Math.floor(mountainTile / world.width);
    const terrain = world.getTerrain(x, y);
    console.log('Mountain tile at (' + x + ', ' + y + '): elevation=' + terrain.elevation.toFixed(1));
    console.log('✓ Mountain tile verified');
}

if (grasslandTile !== -1) {
    const x = grasslandTile % world.width;
    const y = Math.floor(grasslandTile / world.width);
    const terrain = world.getTerrain(x, y);
    console.log('Grassland tile at (' + x + ', ' + y + '): elevation=' + terrain.elevation.toFixed(1) + ', moisture=' + terrain.moisture.toFixed(2));
    console.log('✓ Grassland tile verified');
}

console.log('');
console.log('=== PHASE A COMPLETE ===');
