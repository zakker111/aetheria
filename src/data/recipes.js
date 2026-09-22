/**
 * Crafting Recipes Database
 * Defines all crafting recipes, chains, and production rules.
 */

export const RECIPES = {
    // ==================== BASIC PROCESSING ====================
    
    // Wood Processing
    wood_log_to_plank: {
        id: 'wood_log_to_plank',
        name: 'Cut Planks',
        description: 'Process logs into usable planks',
        icon: '🪵→📐',
        inputs: { wood_log: 1 },
        outputs: { wood_plank: 4 },
        time: 30, // ticks
        skill: 'carpentry',
        requiredTool: 'stone_axe',
        workstation: ['workshop', 'sawmill']
    },
    
    // Stone Processing
    stone_to_block: {
        id: 'stone_to_block',
        name: 'Cut Stone Blocks',
        description: 'Shape raw stone into building blocks',
        icon: '🪨→🧱',
        inputs: { stone: 1 },
        outputs: { stone_block: 2 },
        time: 45,
        skill: 'masonry',
        requiredTool: 'stone_pickaxe',
        workstation: ['workshop', 'quarry']
    },
    
    // Fiber to Cloth
    fiber_to_cloth: {
        id: 'fiber_to_cloth',
        name: 'Weave Cloth',
        description: 'Weave plant fibers into cloth',
        icon: '🌾→🧵',
        inputs: { plant_fiber: 10 },
        outputs: { cloth: 1 },
        time: 60,
        skill: 'weaving',
        requiredTool: null,
        workstation: ['workshop', 'loom']
    },
    
    // ==================== TOOLS & WEAPONS ====================
    
    // Stone Axe
    craft_stone_axe: {
        id: 'craft_stone_axe',
        name: 'Stone Axe',
        description: 'Basic tool for chopping wood',
        icon: '🪓',
        inputs: { wood_plank: 2, stone: 3, plant_fiber: 5 },
        outputs: { stone_axe: 1 },
        time: 50,
        skill: 'toolmaking',
        requiredTool: null,
        workstation: ['workshop'],
        category: 'tool'
    },
    
    // Stone Pickaxe
    craft_stone_pickaxe: {
        id: 'craft_stone_pickaxe',
        name: 'Stone Pickaxe',
        description: 'Basic tool for mining stone',
        icon: '⛏️',
        inputs: { wood_plank: 2, stone: 5, plant_fiber: 5 },
        outputs: { stone_pickaxe: 1 },
        time: 50,
        skill: 'toolmaking',
        requiredTool: null,
        workstation: ['workshop'],
        category: 'tool'
    },
    
    // Iron Sword (advanced)
    craft_iron_sword: {
        id: 'craft_iron_sword',
        name: 'Iron Sword',
        description: 'Standard weapon for soldiers',
        icon: '🗡️',
        inputs: { iron_ingot: 3, wood_plank: 1, leather: 1 },
        outputs: { iron_sword: 1 },
        time: 120,
        skill: 'blacksmithing',
        requiredTool: 'hammer',
        workstation: ['forge', 'advanced_workshop'],
        category: 'weapon'
    },
    
    // Wooden Shield
    craft_wooden_shield: {
        id: 'craft_wooden_shield',
        name: 'Wooden Shield',
        description: 'Basic defense equipment',
        icon: '🛡️',
        inputs: { wood_plank: 6, leather: 2 },
        outputs: { wooden_shield: 1 },
        time: 80,
        skill: 'carpentry',
        requiredTool: 'stone_axe',
        workstation: ['workshop'],
        category: 'armor'
    },
    
    // ==================== BUILDING MATERIALS ====================
    
    // Bricks
    craft_brick: {
        id: 'craft_brick',
        name: 'Fired Brick',
        description: 'Durable building material',
        icon: '🧱',
        inputs: { clay: 2, fuel: 1 },
        outputs: { brick: 4 },
        time: 90,
        skill: 'masonry',
        requiredTool: null,
        workstation: ['kiln', 'forge'],
        category: 'material'
    },
    
    // Glass
    craft_glass: {
        id: 'craft_glass',
        name: 'Glass Pane',
        description: 'Transparent material for windows',
        icon: '🪟',
        inputs: { sand: 4, fuel: 2 },
        outputs: { glass: 2 },
        time: 100,
        skill: 'glassblowing',
        requiredTool: null,
        workstation: ['forge', 'glassworks'],
        category: 'material'
    },
    
    // Rope
    craft_rope: {
        id: 'craft_rope',
        name: 'Rope',
        description: 'Strong cordage for various uses',
        icon: '🪢',
        inputs: { plant_fiber: 15 },
        outputs: { rope: 3 },
        time: 40,
        skill: 'weaving',
        requiredTool: null,
        workstation: ['workshop'],
        category: 'material'
    },
    
    // ==================== ADVANCED ITEMS ====================
    
    // Tool Handle (intermediate component)
    craft_tool_handle: {
        id: 'craft_tool_handle',
        name: 'Tool Handle',
        description: 'Wooden handle for tools',
        icon: '🔨',
        inputs: { wood_plank: 1 },
        outputs: { tool_handle: 2 },
        time: 20,
        skill: 'carpentry',
        requiredTool: 'stone_axe',
        workstation: ['workshop'],
        category: 'component'
    },
    
    // Wheel
    craft_wheel: {
        id: 'craft_wheel',
        name: 'Wooden Wheel',
        description: 'Revolutionary invention for carts',
        icon: '🎡',
        inputs: { wood_plank: 8, iron_ingot: 1 },
        outputs: { wheel: 1 },
        time: 150,
        skill: 'carpentry',
        requiredTool: 'stone_axe',
        workstation: ['workshop'],
        category: 'component'
    },
    
    // Cart
    craft_cart: {
        id: 'craft_cart',
        name: 'Transport Cart',
        description: 'Increases carrying capacity',
        icon: '🛒',
        inputs: { wood_plank: 15, wheel: 2, rope: 3 },
        outputs: { cart: 1 },
        time: 200,
        skill: 'carpentry',
        requiredTool: 'stone_axe',
        workstation: ['workshop'],
        category: 'vehicle',
        effect: { carryCapacity: 5 }
    },
    
    // ==================== CONSUMABLES ====================
    
    // Basic Meal
    craft_meal: {
        id: 'craft_meal',
        name: 'Simple Meal',
        description: 'Restores hunger significantly',
        icon: '🍲',
        inputs: { grain: 2, vegetable: 1 },
        outputs: { meal: 1 },
        time: 30,
        skill: 'cooking',
        requiredTool: null,
        workstation: ['kitchen', 'campfire'],
        category: 'food',
        effect: { hunger: 40, health: 5 }
    },
    
    // Bread
    craft_bread: {
        id: 'craft_bread',
        name: 'Fresh Bread',
        description: 'Staple food item',
        icon: '🍞',
        inputs: { grain: 3, water: 1 },
        outputs: { bread: 2 },
        time: 60,
        skill: 'baking',
        requiredTool: null,
        workstation: ['oven', 'kitchen'],
        category: 'food',
        effect: { hunger: 30 }
    },
    
    // Medicine
    craft_medicine: {
        id: 'craft_medicine',
        name: 'Herbal Medicine',
        description: 'Treats minor injuries',
        icon: '🌿',
        inputs: { herb: 5, water: 1, cloth: 1 },
        outputs: { medicine: 2 },
        time: 45,
        skill: 'herbalism',
        requiredTool: null,
        workstation: ['workshop', 'temple'],
        category: 'medicine',
        effect: { health: 25 }
    },
    
    // ==================== LUXURY ITEMS ====================
    
    // Jewelry
    craft_jewelry: {
        id: 'craft_jewelry',
        name: 'Gold Jewelry',
        description: 'Decorative item for trade or status',
        icon: '💍',
        inputs: { gold_ingot: 2, gem: 1 },
        outputs: { jewelry: 1 },
        time: 180,
        skill: 'jewelry',
        requiredTool: 'hammer',
        workstation: ['forge', 'advanced_workshop'],
        category: 'luxury',
        tradeValue: 50
    },
    
    // Book
    craft_book: {
        id: 'craft_book',
        name: 'Written Book',
        description: 'Stores knowledge',
        icon: '📕',
        inputs: { paper: 10, ink: 1, leather: 1 },
        outputs: { book: 1 },
        time: 120,
        skill: 'scribing',
        requiredTool: null,
        workstation: ['library', 'temple'],
        category: 'knowledge',
        effect: { knowledge: 10 }
    }
};

/**
 * Get recipe by ID
 */
export function getRecipe(id) {
    return RECIPES[id] || null;
}

/**
 * Get all recipes for a workstation
 */
export function getRecipesForWorkstation(workstationType) {
    return Object.values(RECIPES).filter(r => 
        r.workstation && r.workstation.includes(workstationType)
    );
}

/**
 * Get recipes by category
 */
export function getRecipesByCategory(category) {
    return Object.values(RECIPES).filter(r => r.category === category);
}

/**
 * Check if agent can craft a recipe
 */
export function canCraft(agent, recipe) {
    if (!agent || !recipe) return false;
    
    // Check workstation
    if (recipe.workstation && !agent.nearWorkstation(recipe.workstation)) {
        return false;
    }
    
    // Check tool requirement
    if (recipe.requiredTool && !agent.hasTool(recipe.requiredTool)) {
        return false;
    }
    
    // Check ingredients
    if (!agent.inventory) return false;
    for (const [item, amount] of Object.entries(recipe.inputs)) {
        if ((agent.inventory[item] || 0) < amount) {
            return false;
        }
    }
    
    return true;
}

/**
 * Execute a crafting recipe
 */
export function craft(agent, recipeId) {
    const recipe = RECIPES[recipeId];
    if (!recipe || !canCraft(agent, recipe)) return null;
    
    // Consume inputs
    for (const [item, amount] of Object.entries(recipe.inputs)) {
        agent.inventory[item] -= amount;
        if (agent.inventory[item] <= 0) delete agent.inventory[item];
    }
    
    // Produce outputs
    for (const [item, amount] of Object.entries(recipe.outputs)) {
        agent.inventory[item] = (agent.inventory[item] || 0) + amount;
    }
    
    return {
        success: true,
        outputs: recipe.outputs,
        effects: recipe.effect
    };
}
