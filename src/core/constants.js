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
  CASTLE: 'castle',
  WALL: 'wall',
  WAREHOUSE: 'warehouse',
  GRANARY: 'granary',
  DOCK: 'dock',
  WINDMILL: 'windmill',
  INN: 'inn',
  LIBRARY: 'library',
  APOTHECARY: 'apothecary',
  BANK: 'bank',
  FACTORY: 'factory',
  RESEARCH_LAB: 'research_lab',
  RADAR_STATION: 'radar_station',
  NUCLEAR_PLANT: 'nuclear_plant',
  MISSILE_SILO: 'missile_silo',
  MONUMENT_CAIRN: 'monument_cairn',
  MONUMENT_PYRAMID: 'monument_pyramid',
  MONUMENT_COLOSSEUM: 'monument_colosseum',
  MONUMENT_CITADEL: 'monument_citadel',
  MONUMENT_FOUNDRY: 'monument_foundry',
  MONUMENT_MONOLITH: 'monument_monolith',
  MONUMENT_ATOMIC_DOME: 'monument_atomic_dome'
};

export function isMonumentBuildingType(buildingType) {
  return typeof buildingType === 'string' && buildingType.startsWith('monument_');
}

// Storage capacity per building type (units of food/wood/stone/ore/water).
// Settlements need warehouses to stockpile surplus — limited space is the
// survival constraint that drives them to build more.
export const STORAGE_CAPACITY = {
  house: 10,
  farm: 40,
  granary: 140,
  workshop: 30,
  market: 60,
  warehouse: 250,
  dock: 80,
  temple: 20,
  barracks: 30,
  castle: 120,
  tower: 20,
  windmill: 50,
  inn: 40,
  library: 40,
  apothecary: 40,
  bank: 120,
  factory: 90,
  research_lab: 40,
  radar_station: 30,
  nuclear_plant: 80,
  missile_silo: 30,
  monument_cairn: 30,
  monument_pyramid: 60,
  monument_colosseum: 40,
  monument_citadel: 100,
  monument_foundry: 100,
  monument_monolith: 60,
  monument_atomic_dome: 80
};

// Building material costs (units of plank / iron_ingot / gem). Construction
// consumes real goods from the town stockpile: a site without materials is
// stalled until craftsmen produce more. Planks come from sawmills (log ->
// plank) and gems only from rare crystal veins — so grand civic projects
// genuinely depend on the mining -> crafting pipeline.
export const BUILD_COSTS = {
  house:         { plank: 2 },
  farm:          { plank: 2 },
  granary:       { plank: 4 },
  dock:          { plank: 4 },
  windmill:      { plank: 4 },
  workshop:      { plank: 4 },
  temple:        { plank: 4, iron_ingot: 2 },
  tower:         { plank: 4, iron_ingot: 2 },
  barracks:      { plank: 4, iron_ingot: 2 },
  inn:           { plank: 4, iron_ingot: 1 },
  market:        { plank: 4, iron_ingot: 1 },
  library:       { plank: 5, iron_ingot: 2 },
  apothecary:    { plank: 4, iron_ingot: 2 },
  warehouse:     { plank: 6 },
  castle:        { plank: 8, iron_ingot: 4, gem: 2 },
  bank:          { plank: 6, iron_ingot: 4 },
  factory:       { plank: 6, iron_ingot: 4 },
  research_lab:  { plank: 5, iron_ingot: 4 },
  radar_station: { plank: 4, iron_ingot: 5 },
  nuclear_plant: { plank: 6, iron_ingot: 6 },
  missile_silo:  { plank: 4, iron_ingot: 6 },
  monument_cairn:       { plank: 4 },
  monument_pyramid:     { plank: 8, iron_ingot: 2 },
  monument_colosseum:   { plank: 8, iron_ingot: 4 },
  monument_citadel:     { plank: 10, iron_ingot: 5 },
  monument_foundry:     { plank: 10, iron_ingot: 6 },
  monument_monolith:    { plank: 8, iron_ingot: 6 },
  monument_atomic_dome: { plank: 10, iron_ingot: 8 }
};

// Era unlock & multi-level upgrade specification for all civic buildings.
// Every building scales real society functions across Levels 1 -> 3.
export const BUILDING_METADATA = {
  house: {
    name: 'Dwelling',
    icon: '🏠',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 4 },
    upgradeCosts: { 2: { wood: 14, ore: 4 }, 3: { wood: 24, ore: 10 } },
    levelNames: ['Timber Cottage', 'Stone Manor', 'Brick Apartment'],
    roleSummary: 'Houses citizens & restores rest/health during town slumber.',
    levelBonuses: [
      'Capacity +10 · Rest +4 · Health +2',
      'Capacity +16 · Rest +6 · Health +3 (+45% durability)',
      'Capacity +22 · Rest +8 · Health +4 (+90% durability)'
    ]
  },
  farm: {
    name: 'Farmstead',
    icon: '🌾',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 4 },
    upgradeCosts: { 2: { wood: 14, ore: 5 }, 3: { wood: 22, ore: 12 } },
    levelNames: ['Tilled Plot', 'Irrigated Estate', 'Mechanized Agribusiness'],
    roleSummary: 'Cultivates seasonal food crops around the settlement.',
    levelBonuses: [
      'Cultivates every 50t (+30 base food)',
      'Faster 40t harvest (+45% crop yield)',
      'Rapid 30t harvest (+90% crop yield)'
    ]
  },
  workshop: {
    name: 'Workshop',
    icon: '🔨',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 4 },
    upgradeCosts: { 2: { wood: 18, ore: 8 }, 3: { wood: 28, ore: 16 } },
    levelNames: ['Artisan Workshop', 'Master Guildhall', 'Precision Forgeworks'],
    roleSummary: 'Transforms logs, wheat & ore into planks, bread, tools & arms.',
    levelBonuses: [
      'Standard craft speed · 50 storage',
      '+35% craft speed · 80 storage',
      '+70% craft speed · 120 storage'
    ]
  },
  granary: {
    name: 'Granary',
    icon: '🍞',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 4 },
    upgradeCosts: { 2: { wood: 16, ore: 6 }, 3: { wood: 26, ore: 14 } },
    levelNames: ['Stone Granary', 'Reinforced Silo', 'Bulk Grain Terminal'],
    roleSummary: 'Buffers harvest reserves & shields against winter famine.',
    levelBonuses: [
      'Storage 140 · Safeguards winter rations',
      'Storage 224 · Preserves +2 food/cycle',
      'Storage 308 · Preserves +4 food/cycle'
    ]
  },
  temple: {
    name: 'Temple',
    icon: '⛩️',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 3, 3: 5 },
    upgradeCosts: { 2: { wood: 18, ore: 10 }, 3: { wood: 28, ore: 18 } },
    levelNames: ['Sacred Shrine', 'High Temple', 'Grand Cathedral'],
    roleSummary: 'Anchors faith, rituals & spiritual cohesion across the realm.',
    levelBonuses: [
      'Supports town rituals & belief spread',
      '+45% sanctuary aura & faith cohesion',
      '+90% sanctuary aura & pilgrimage pull'
    ]
  },
  market: {
    name: 'Market Square',
    icon: '⚖️',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 4 },
    upgradeCosts: { 2: { wood: 16, ore: 8 }, 3: { wood: 26, ore: 16 } },
    levelNames: ['Bazaar Stalls', 'Merchant Exchange', 'Grand Emporium'],
    roleSummary: 'Coordinates caravans & local surplus distribution.',
    levelBonuses: [
      'Storage 60 · Enables caravan commerce',
      'Storage 96 · +15% market efficiency',
      'Storage 132 · +30% market efficiency'
    ]
  },
  barracks: {
    name: 'Barracks',
    icon: '🛡️',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 5 },
    upgradeCosts: { 2: { wood: 18, ore: 12 }, 3: { wood: 28, ore: 22 } },
    levelNames: ['Militia Barracks', 'Garrison Bastion', 'Military Academy'],
    roleSummary: 'Trains soldiers, stores armaments & bolsters garrison readiness.',
    levelBonuses: [
      'Drills town garrison & militia',
      'Faster soldier combat readiness & HP',
      'Elite combat training (+warband resilience)'
    ]
  },
  warehouse: {
    name: 'Warehouse',
    icon: '📦',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 3, 3: 5 },
    upgradeCosts: { 2: { wood: 22, ore: 10 }, 3: { wood: 34, ore: 18 } },
    levelNames: ['Timber Warehouse', 'Masonry Depot', 'Logistics Hub'],
    roleSummary: 'Expands municipal bulk stockpile capacity for growth & war.',
    levelBonuses: [
      'Storage 250 units',
      'Storage 400 units',
      'Storage 550 units'
    ]
  },
  dock: {
    name: 'Harbor Dock',
    icon: '⚓',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 3, 3: 5 },
    upgradeCosts: { 2: { wood: 20, ore: 8 }, 3: { wood: 32, ore: 16 } },
    levelNames: ['Timber Pier', 'Shipyard Quay', 'Deepwater Port'],
    roleSummary: 'Launches fishing boats, trade barges & amphibious expeditions.',
    levelBonuses: [
      'Storage 80 · Launches coastal boats',
      'Storage 128 · Sturdy hull repairs',
      'Storage 176 · High-capacity sea port'
    ]
  },
  tower: {
    name: 'Watchtower',
    icon: '🗼',
    minEra: 1,
    maxLevel: 3,
    upgradeEras: { 2: 2, 3: 5 },
    upgradeCosts: { 2: { wood: 14, ore: 12 }, 3: { wood: 24, ore: 22 } },
    levelNames: ['Timber Watchtower', 'Stone Bastion Tower', 'Bunker Turret'],
    roleSummary: 'Fires defensive volleys at hostile raiders approaching the town.',
    levelBonuses: [
      'Range 8.5 · Standard garrison fire',
      'Range 10.0 · +35% defensive volley damage',
      'Range 11.5 · +70% heavy defense fire'
    ]
  },
  windmill: {
    name: 'Windmill',
    icon: '🌬️',
    minEra: 2,
    maxLevel: 3,
    upgradeEras: { 2: 3, 3: 5 },
    upgradeCosts: { 2: { wood: 18, ore: 8 }, 3: { wood: 28, ore: 15 } },
    levelNames: ['Timber Windmill', 'Stone Flour Mill', 'Industrial Grain Mill'],
    roleSummary: 'Amplifies nearby farm yields & mills steady grain into food stockpiles.',
    levelBonuses: [
      '+30% nearby farm yield · +3 food / 60t',
      '+50% farm yield · +5 food / 60t',
      '+75% farm yield · +7 food / 60t'
    ]
  },
  inn: {
    name: 'Tavern & Inn',
    icon: '🍺',
    minEra: 2,
    maxLevel: 3,
    upgradeEras: { 2: 3, 3: 5 },
    upgradeCosts: { 2: { wood: 18, ore: 8 }, 3: { wood: 28, ore: 14 } },
    levelNames: ['Wayfarer Tavern', 'Grand Civic Inn', 'Grand Social Hall'],
    roleSummary: 'Restores citizen rest & social morale while dampening urban unrest.',
    levelBonuses: [
      'Rest +6 · Social +10 · -12 Rebellion Unrest',
      'Rest +9 · Social +15 · -18 Rebellion Unrest',
      'Rest +12 · Social +20 · -24 Rebellion Unrest'
    ]
  },
  library: {
    name: 'Library & Academy',
    icon: '📚',
    minEra: 3,
    maxLevel: 3,
    upgradeEras: { 2: 4, 3: 6 },
    upgradeCosts: { 2: { wood: 20, ore: 12 }, 3: { wood: 30, ore: 20 } },
    levelNames: ['Scroll Library', 'Classical Academy', 'National University'],
    roleSummary: 'Accelerates citizen skill XP, Era research & Wonder construction.',
    levelBonuses: [
      '+35% skill XP · +2 Wonder labor · -10% Era hurdle',
      '+55% skill XP · +4 Wonder labor · -16% Era hurdle',
      '+80% skill XP · +6 Wonder labor · -22% Era hurdle'
    ]
  },
  apothecary: {
    name: 'Apothecary & Clinic',
    icon: '⚕️',
    minEra: 3,
    maxLevel: 3,
    upgradeEras: { 2: 5, 3: 6 },
    upgradeCosts: { 2: { wood: 18, ore: 14 }, 3: { wood: 26, ore: 24 } },
    levelNames: ['Herbal Apothecary', 'Field Infirmary', 'Modern Hospital'],
    roleSummary: 'Treats wounded soldiers & heals sick/irradiated citizens in town.',
    levelBonuses: [
      'Heals +7 HP / 30t · Clears combat wounds',
      'Heals +12 HP / 30t · Stabilizes fallout',
      'Heals +18 HP / 30t · Intensive triage'
    ]
  },
  castle: {
    name: 'Citadel Keep',
    icon: '🏰',
    minEra: 4,
    maxLevel: 3,
    upgradeEras: { 2: 5, 3: 6 },
    upgradeCosts: { 2: { wood: 28, ore: 22 }, 3: { wood: 40, ore: 34 } },
    levelNames: ['Stone Keep', 'Imperial Fortress', 'Command Citadel'],
    roleSummary: 'Long-range fortress defense & sovereign seat of power.',
    levelBonuses: [
      'Range 11.0 · +20% citadel fire · 240 HP',
      'Range 12.5 · +60% citadel fire · 360 HP',
      'Range 14.0 · +100% citadel fire · 480 HP'
    ]
  },
  bank: {
    name: 'Treasury & Bank',
    icon: '🪙',
    minEra: 4,
    maxLevel: 3,
    upgradeEras: { 2: 5, 3: 6 },
    upgradeCosts: { 2: { wood: 22, ore: 18 }, 3: { wood: 32, ore: 28 } },
    levelNames: ['Royal Mint', 'Merchant Bank', 'Central Reserve Bank'],
    roleSummary: 'Multiplies caravan & barge trade yields and generates civic dividends.',
    levelBonuses: [
      '+25% caravan/barge trade · +2 dividend / 90t',
      '+40% caravan/barge trade · +3 dividend / 90t',
      '+60% caravan/barge trade · +5 dividend / 90t'
    ]
  },
  factory: {
    name: 'Industrial Factory',
    icon: '🏭',
    minEra: 5,
    maxLevel: 3,
    upgradeEras: { 2: 6, 3: 7 },
    upgradeCosts: { 2: { wood: 24, ore: 22 }, 3: { wood: 36, ore: 34 } },
    levelNames: ['Steam Factory', 'Assembly Plant', 'Automated Mega-Foundry'],
    roleSummary: 'Powers workshop production, mechanized warbands & nuclear fabrication.',
    levelBonuses: [
      '+25% town craft speed · Enables heavy industry',
      '+45% town craft speed · Faster war production',
      '+65% town craft speed · Peak industrial output'
    ]
  },
  research_lab: {
    name: 'Research Lab',
    icon: '🔬',
    minEra: 5,
    maxLevel: 3,
    upgradeEras: { 2: 6, 3: 7 },
    upgradeCosts: { 2: { wood: 20, ore: 22 }, 3: { wood: 30, ore: 34 } },
    levelNames: ['Science Lab', 'Applied Institute', 'Atomic Physics Center'],
    roleSummary: 'Drives Era research breakthroughs & accelerates warhead enrichment.',
    levelBonuses: [
      '+5 enrichment/cycle · +3 Wonder labor',
      '+9 enrichment/cycle · +5 Wonder labor',
      '+13 enrichment/cycle · +7 Wonder labor'
    ]
  },
  radar_station: {
    name: 'Air Defense Radar',
    icon: '📡',
    minEra: 6,
    maxLevel: 3,
    upgradeEras: { 2: 7, 3: 7 },
    upgradeCosts: { 2: { wood: 18, ore: 24 }, 3: { wood: 26, ore: 36 } },
    levelNames: ['Early-Warning Radar', 'SAM Air Defense Grid', 'Strategic Aegis Array'],
    roleSummary: 'Intercepts hostile strike aircraft & extends garrison watchtower range.',
    levelBonuses: [
      '16t Air Defense flak (42 DMG vs planes) · +2t tower range',
      '19t Air Defense flak (60 DMG vs planes) · +3t tower range',
      '22t Air Defense flak (82 DMG vs planes) · +4t tower range'
    ]
  },
  nuclear_plant: {
    name: 'Nuclear Power Plant',
    icon: '☢️',
    minEra: 6,
    maxLevel: 3,
    upgradeEras: { 2: 7, 3: 7 },
    upgradeCosts: { 2: { wood: 24, ore: 30 }, 3: { wood: 34, ore: 44 } },
    levelNames: ['Fission Reactor', 'Dual-Core Plant', 'Breeder Reactor Complex'],
    roleSummary: 'Supplies fissile power required to enrich atomic warheads.',
    levelBonuses: [
      'Enables uranium enrichment (+8 base)',
      'Boosts enrichment (+12 total) & containment HP',
      'High-yield enrichment (+16 total) & blast shielding'
    ]
  },
  missile_silo: {
    name: 'Missile Silo',
    icon: '🚀',
    minEra: 6,
    maxLevel: 3,
    upgradeEras: { 2: 7, 3: 7 },
    upgradeCosts: { 2: { wood: 20, ore: 28 }, 3: { wood: 30, ore: 42 } },
    levelNames: ['Launch Silo', 'Hardened ICBM Bunker', 'MIRV Strategic Complex'],
    roleSummary: 'Stores nuclear warheads (+2/+3/+4 cap) & enables strategic deterrence.',
    levelBonuses: [
      '+2 Max Warheads · +3 enrichment · 260 HP',
      '+3 Max Warheads · +5 enrichment · 390 HP',
      '+4 Max Warheads · +7 enrichment · 520 HP'
    ]
  },
  monument_cairn: {
    name: 'Stonehenge Hearth Circle',
    icon: '🪨',
    minEra: 1,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 3, 3: 5 },
    upgradeCosts: { 2: { wood: 16, ore: 10 }, 3: { wood: 24, ore: 18 } },
    levelNames: ['Standing Stones', 'Hallowed Megalith Ring', 'World Heritage Henge'],
    roleSummary: 'Tribal Era grand sanctuary that endures across ages to anchor harvest & civic resilience.',
    levelBonuses: [
      '+15% harvest & civic cohesion · 550 HP Stone Heritage',
      '+25% harvest aura · 795 HP Preserved Sanctuary',
      '+35% harvest aura · 1045 HP Immortal Landmark'
    ]
  },
  monument_pyramid: {
    name: 'Great Pyramidal Shrine',
    icon: '🔺',
    minEra: 2,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 4, 3: 6 },
    upgradeCosts: { 2: { wood: 20, ore: 14 }, 3: { wood: 30, ore: 22 } },
    levelNames: ['Step Pyramid', 'Gilded Sun Pyramid', 'Ancient World Wonder'],
    roleSummary: 'Bronze Age limestone monument built to endure for millennia into the modern era.',
    levelBonuses: [
      '+30% trade prestige & +10% city prosperity · 650 HP',
      '+45% trade prestige · 940 HP',
      '+60% World Heritage prestige · 1235 HP'
    ]
  },
  monument_colosseum: {
    name: 'Colosseum of Champions',
    icon: '🏟️',
    minEra: 3,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 5, 3: 6 },
    upgradeCosts: { 2: { wood: 22, ore: 18 }, 3: { wood: 32, ore: 28 } },
    levelNames: ['Marble Amphitheater', 'Grand Imperial Arena', 'Preserved Classical Colosseum'],
    roleSummary: 'Classical Era grand amphitheater inspiring warband morale & civic pride across centuries.',
    levelBonuses: [
      '+15 warband morale & swift recovery · 720 HP',
      '+22 warband morale · 1040 HP',
      '+30 warband morale · 1365 HP Heritage Wonder'
    ]
  },
  monument_citadel: {
    name: 'Grand Imperial Citadel',
    icon: '🏯',
    minEra: 4,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 5, 3: 7 },
    upgradeCosts: { 2: { wood: 26, ore: 22 }, 3: { wood: 38, ore: 34 } },
    levelNames: ['Imperial Domed Palace', 'Sovereign Grand Citadel', 'Historic Crown Fortress'],
    roleSummary: 'Imperial Age domed palace-fortress reinforcing city walls & sovereign permanence.',
    levelBonuses: [
      '+35% siege wall fortification · 800 HP',
      '+50% siege wall fortification · 1160 HP',
      '+70% siege wall fortification · 1520 HP'
    ]
  },
  monument_foundry: {
    name: 'Grand Iron Foundry Bastion',
    icon: '⚒️',
    minEra: 5,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 6, 3: 7 },
    upgradeCosts: { 2: { wood: 28, ore: 26 }, 3: { wood: 40, ore: 38 } },
    levelNames: ['Iron Clocktower Hall', 'Grand Steelworks Basilica', 'Industrial Heritage Works'],
    roleSummary: 'Industrial Era ironworks & clocktower super-hall driving armory & heavy engineering.',
    levelBonuses: [
      '+35% armory output & metallurgy · 850 HP',
      '+55% armory output & metallurgy · 1230 HP',
      '+75% armory output & metallurgy · 1615 HP'
    ]
  },
  monument_monolith: {
    name: 'Tactical Sky-Spire Monolith',
    icon: '🗼',
    minEra: 6,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 7, 3: 7 },
    upgradeCosts: { 2: { wood: 28, ore: 30 }, 3: { wood: 40, ore: 44 } },
    levelNames: ['Tactical Command Spire', 'Sky-Piercing Arcology', 'Sovereign Metro Pinnacle'],
    roleSummary: 'Modern Era monumental command spire anchoring communications, radar & atomic science.',
    levelBonuses: [
      '+60% nuclear enrichment · 900 HP',
      '+85% nuclear enrichment · 1305 HP',
      '+110% nuclear enrichment · 1710 HP'
    ]
  },
  monument_atomic_dome: {
    name: 'Orbital & Atomic Complex',
    icon: '⚛️',
    minEra: 7,
    maxLevel: 3,
    isMonument: true,
    heritageSurvivable: true,
    upgradeEras: { 2: 7, 3: 7 },
    upgradeCosts: { 2: { wood: 32, ore: 36 }, 3: { wood: 46, ore: 52 } },
    levelNames: ['Fusion Containment Dome', 'Orbital Deterrence Array', 'Apex Geodesic Arcology'],
    roleSummary: 'Nuclear Age megastructure housing orbital telemetry, warhead storage & fallout shielding.',
    levelBonuses: [
      '+2 Max Warheads · +20% flak intercept · 1000 HP',
      '+3 Max Warheads · +30% flak intercept · 1450 HP',
      '+4 Max Warheads · +40% flak intercept · 1900 HP'
    ]
  }
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
