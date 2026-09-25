// Core constants for Aetheria simulation

export const ENTITY_TYPES = {
  AGENT: 'agent',
  RESOURCE: 'resource',
  BUILDING: 'building',
  ANIMAL: 'animal'
};

export const JOB_TYPES = {
  IDLE: 'idle',
  GATHERER: 'gatherer',
  BUILDER: 'builder',
  FARMER: 'farmer',
  MERCHANT: 'merchant',
  GUARD: 'guard',
  PRIEST: 'priest',
  CRAFTER: 'crafter',
  HUNTER: 'hunter',
  EXPLORER: 'explorer'
};

export const BUILDING_TYPES = {
  HOUSE: 'house',
  WORKSHOP: 'workshop',
  TEMPLE: 'temple',
  BARRACKS: 'barracks',
  MARKET: 'market',
  FARM: 'farm',
  TOWER: 'tower',
  WALL: 'wall',
  WAREHOUSE: 'warehouse'
};

// Storage capacity per building type (units of food/wood/stone/ore/water).
// Settlements need warehouses to stockpile surplus — limited space is the
// survival constraint that drives them to build more.
export const STORAGE_CAPACITY = {
  house: 10,
  farm: 40,
  workshop: 30,
  market: 60,
  warehouse: 250,
  temple: 20,
  barracks: 30,
  castle: 120,
  tower: 20,
  windmill: 50
};

export const RESOURCE_TYPES = {
  FOOD: 'food',
  WOOD: 'wood',
  STONE: 'stone',
  ORE: 'ore',
  WATER: 'water'
};

export const BIOME_TYPES = {
  OCEAN: 'ocean',
  BEACH: 'beach',
  PLAINS: 'plains',
  FOREST: 'forest',
  MOUNTAIN: 'mountain',
  DESERT: 'desert',
  TUNDRA: 'tundra',
  JUNGLE: 'jungle',
  SAVANNA: 'savanna',
  HIGHLAND: 'highland'
};

export const BELIEF_TYPES = {
  NATURE: 'nature',
  WAR: 'war',
  KNOWLEDGE: 'knowledge',
  TRADE: 'trade',
  COMMUNITY: 'community',
  TRADITION: 'tradition',
  PROGRESS: 'progress',
  BALANCE: 'balance'
};

export const SEASON_TYPES = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter'
};

export const NEED_TYPES = {
  HUNGER: 'hunger',
  THIRST: 'thirst',
  ENERGY: 'energy',
  SOCIAL: 'social',
  SAFETY: 'safety'
};

export const COMBAT_STATES = {
  IDLE: 'idle',
  ALERT: 'alert',
  COMBAT: 'combat',
  FLEEING: 'fleeing'
};

export const FORMATION_TYPES = {
  LINE: 'line',
  WEDGE: 'wedge',
  SHIELD: 'shield',
  SCATTER: 'scatter'
};
