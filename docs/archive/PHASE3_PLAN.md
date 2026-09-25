# 🎯 PHASE 3: Advanced Simulation - IMPLEMENTATION PLAN

## Overview
Phase 3 adds **political intrigue, cultural evolution, warfare, and divine interaction** to create deep emergent storytelling. This phase transforms your simulation from a peaceful society builder into a living world with conflict, belief systems, and memorable historical events.

**Estimated Time:** 3-4 weeks  
**Complexity:** High  
**Dependencies:** Phase 1 (lifecycle) ✅, Phase 2 (relationships/settlements/economy) ✅

---

## 📅 WEEK 5-6: FACTIONS & POLITICS

### Step 1: Faction System (`src/systems/factionSystem.js`)
**Goal:** Agents naturally form groups with shared identity and goals

#### Features to Implement:
```javascript
class Faction {
  constructor(id, name, founderId, beliefs) {
    this.id = id;
    this.name = name; // Dynamic naming based on beliefs/location
    this.founderId = founderId;
    this.beliefs = {
      tradition: 0.5,    // Respect for old ways
      prosperity: 0.5,   // Focus on wealth/growth
      piety: 0.5,        // Religious devotion
      conquest: 0.0,     // Militaristic expansion
      isolation: 0.0     // Avoid outsiders
    };
    this.members = new Set();
    this.leaderId = founderId;
    this.allies = new Set();
    this.enemies = new Set();
    this.diplomaticStatus = new Map(); // factionId -> 'peace' | 'war' | 'alliance'
    this.influence = 1.0; // Affects recruitment speed
    this.color = `hsl(${Math.random()*360}, 70%, 50%)`; // For rendering
  }
}
```

#### Key Mechanics:
1. **Faction Formation** (every 100 ticks):
   - Charismatic agents (high social + reputation > 75) can found factions
   - Nearby agents join based on belief compatibility
   - Default beliefs start neutral, shift based on member personalities

2. **Belief Propagation**:
   - Agents slowly adopt faction's beliefs through socialization
   - Beliefs affect job preferences (conquest → warrior, prosperity → trader)
   - Conflicting beliefs cause internal tension

3. **Leadership Hierarchy**:
   - Leader: Highest reputation/influence
   - Advisors: Top 3 members by skill relevance
   - Members: Regular participants
   - Succession: On leader death, most influential member takes over

4. **Diplomacy System**:
   - Factions evaluate relationships every 50 ticks
   - Alliance if belief similarity > 0.7 AND no territorial disputes
   - War if belief similarity < 0.3 OR resource competition
   - Trade agreements possible at peace

#### Files to Create:
- `src/systems/factionSystem.js` (~400 lines)
- `src/data/beliefs.js` (belief definitions, ~80 lines)

#### Integration Points:
- Modify `simulation.js` to call `factionSystem.update()` every 50 ticks
- Add faction UI panel showing active factions, beliefs, relations
- Renderer shows faction colors on agent markers (optional outline)

---

### Step 2: Culture System (`src/systems/cultureSystem.js`)
**Goal:** Cultural traits spread socially and create regional differences

#### Features:
```javascript
class Culture {
  constructor(name, traits) {
    this.name = name;
    this.traits = {
      workEthic: 0.5,      // Productivity modifier
      hospitality: 0.5,    // Treatment of outsiders
      conservatism: 0.5,   // Resistance to change
      spirituality: 0.5,   // Religious tendency
      aggression: 0.3      // Likelihood of conflict
    };
    this.traditions = [];  // List of practiced traditions
    this.language = '';    // Dynamic naming
    this.artStyle = '';    // Aesthetic preference
  }
}
```

#### Key Mechanics:
1. **Cultural Transmission**:
   - Children inherit 70% of parents' culture, 30% from environment
   - Social interactions spread cultural traits (1% per interaction)
   - High-reputation agents are cultural trendsetters (3x influence)

2. **Regional Cultures**:
   - Settlements develop unique cultures after 50 days
   - Geographic isolation accelerates cultural divergence
   - Trade routes increase cultural exchange

3. **Cultural Practices**:
   - Festivals (boost social need, cost food)
   - Rituals (affect spiritual need, build cohesion)
   - Taboos (restrict certain actions)

#### Files to Create:
- `src/systems/cultureSystem.js` (~300 lines)
- Extend `agent.js` with `culture` component

---

### Step 3: Political Influence System
**Goal:** Informal power structures emerge from reputation and relationships

#### Implementation in `relationshipSystem.js`:
Add these methods:
```javascript
// Calculate agent's political influence
getInfluence(agentId) {
  const rep = this.reputations.get(agentId) || 50;
  const relationships = this.relationships.get(agentId);
  const connectionCount = relationships ? relationships.size : 0;
  const factionBonus = this.getAgentFactionRank(agentId);
  
  return (rep / 100) * Math.sqrt(connectionCount) * factionBonus;
}

// Check if agent can make decisions for group
canLead(agentId, groupId) {
  const influence = this.getInfluence(agentId);
  const avgInfluence = this.getGroupAvgInfluence(groupId);
  return influence > avgInfluence * 1.5;
}
```

#### Decision-Making Scenarios:
- Resource allocation during scarcity
- Declaration of war/peace
- Settlement expansion direction
- Accepting refugees

---

## 📅 WEEK 7-8: CONFLICT & EVENTS

### Step 4: Combat System (`src/systems/combatSystem.js`)
**Goal:** Simple but meaningful warfare between factions

#### Features:
```javascript
class CombatSystem {
  constructor() {
    this.activeConflicts = []; // {faction1, faction2, battles: []}
    this.battleHistory = [];
  }
  
  resolveBattle(attacker, defender, terrain) {
    // Calculate odds based on:
    // - Number of participants
    // - Average bravery/skills
    // - Terrain bonuses (defender advantage in mountains)
    // - Equipment (from economy system)
    // - Surprise factor
    
    const attackerStrength = this.calculateStrength(attacker);
    const defenderStrength = this.calculateStrength(defender) * terrain.defenseBonus;
    
    const outcome = Math.random() * (attackerStrength + defenderStrength);
    const attackerWins = outcome < attackerStrength;
    
    return {
      winner: attackerWins ? attacker : defender,
      casualties: this.calculateCasualties(attackerWins, attackerStrength, defenderStrength),
      prisoners: Math.floor(Math.random() * 5),
      moraleImpact: attackerWins ? 10 : -15
    };
  }
}
```

#### Key Mechanics:
1. **War Declaration**:
   - Faction leaders decide based on diplomacy system
   - Requires casus belli (territorial dispute, ideological conflict, resource grab)
   - Population support matters (low support → rebellion risk)

2. **Battle Resolution**:
   - Abstract resolution (not individual combat simulation)
   - Factors: numbers, skills, terrain, equipment, morale
   - Casualties create trauma memories in survivors

3. **Post-War**:
   - Territory changes
   - Reparations (resource transfer)
   - Occupation (temporary control)
   - Grudges (long-term relationship penalty)

#### Files to Create:
- `src/systems/combatSystem.js` (~350 lines)

---

### Step 5: Random Events System (`src/systems/eventSystem.js`)
**Goal:** Unpredictable occurrences that test societies

#### Event Categories:

**Natural Disasters** (15% chance per 100 ticks):
```javascript
const disasters = [
  {
    name: "Earthquake",
    duration: 1,
    effects: {
      buildingDamage: 0.3,  // 30% buildings damaged
      casualties: 0.05,     // 5% population loss
      terrainChange: true   // May create/destroy resources
    }
  },
  {
    name: "Flood",
    duration: 5,
    effects: {
      cropLoss: 0.5,
      displacement: true,   // Agents flee to higher ground
      waterContamination: true
    }
  },
  {
    name: "Drought",
    duration: 30,
    effects: {
      waterScarcity: 0.7,
      cropFailure: 0.6,
      migrationPressure: true
    }
  },
  {
    name: "Forest Fire",
    duration: 3,
    effects: {
      forestLoss: 0.4,
      airQuality: -0.5,
      wildlifeDeath: 0.8
    }
  }
];
```

**Economic Events** (20% chance):
- Bountiful harvest (+50% food)
- Resource vein discovered
- Trade route established/lost
- Market crash (prices fluctuate wildly)

**Social Events** (25% chance):
- Plague outbreak (spreads through contact)
- Religious revival (piety increases)
- Cultural renaissance (skill learning +25%)
- Civil unrest (faction tension increases)

**Divine Omens** (10% chance):
- Mysterious occurrence (agents interpret based on beliefs)
- Natural phenomenon (comet, eclipse)
- Prophetic dreams (affects multiple agents)

#### Implementation:
```javascript
class EventSystem {
  constructor(simulation) {
    this.sim = simulation;
    this.activeEvents = [];
    this.eventHistory = [];
    this.probabilityModifiers = new Map();
  }
  
  checkForEvents() {
    if (Math.random() > 0.3) return; // 70% chance of some event
    
    const eventType = this.selectEventType();
    const event = this.createEvent(eventType);
    this.activeEvents.push(event);
    this.sim.eventBus.emit("EVENT_STARTED", event);
  }
  
  applyEventEffects(event) {
    // Apply to affected agents/settlements
    // Create memories in witnesses
    // Track long-term consequences
  }
}
```

#### Files to Create:
- `src/systems/eventSystem.js` (~450 lines)
- `src/data/events.js` (event definitions, ~200 lines)

---

### Step 6: Enhanced God Interaction (`src/interaction/divinePowers.js`)
**Goal:** Deepen player's role as deity with meaningful impact

#### New Divine Powers:

**Miracles** (cost divine favor):
```javascript
const miracles = {
  healPlague: {
    cost: 50,
    effect: "Cure all diseases in target area",
    cooldown: 100
  },
  bountifulHarvest: {
    cost: 30,
    effect: "Double food production for 20 days",
    cooldown: 50
  },
  earthquake: {
    cost: 40,
    effect: "Destroy buildings, reshape terrain",
    cooldown: 80
  },
  inspireLeader: {
    cost: 25,
    effect: "Target agent gains +20 influence temporarily",
    cooldown: 30
  },
  curse: {
    cost: 35,
    effect: "Target settlement suffers misfortune",
    cooldown: 60
  },
  protection: {
    cost: 20,
    effect: "Settlement immune to disasters for 15 days",
    cooldown: 40
  }
};
```

**Divine Favor System**:
- Agents pray based on piety belief
- Successful prayers increase favor
- Miracles consume favor
- Low favor → agents lose faith (piety decreases)
- High favor → religious festivals, temple construction

**Agent Reactions to Divine Acts**:
```javascript
handleDivineIntervention(agent, miracleType, beneficial) {
  const memory = {
    type: 'divine_encounter',
    miracle: miracleType,
    beneficial: beneficial,
    timestamp: this.sim.clock.getTime(),
    impact: beneficial ? 25 : -25
  };
  
  this.addMemory(agent.id, memory);
  
  if (beneficial) {
    agent.beliefs.piety = Math.min(1.0, agent.beliefs.piety + 0.1);
    this.modifyReputation(agent.id, 10);
  } else {
    agent.beliefs.piety = Math.max(0.0, agent.beliefs.piety - 0.15);
    this.modifyReputation(agent.id, -15);
    agent.needs.safety -= 20;
  }
}
```

#### Files to Modify:
- Extend `src/interaction/godPowers.js` → rename to `divinePowers.js`
- Add `src/data/miracles.js` (miracle definitions)
- Modify `agent.js` to track divine encounters in memory

---

### Step 7: Trauma & Long-Term Memory
**Goal:** Agents remember significant events and change behavior

#### Enhance `agent.js` memory system:
```javascript
this.memory = {
  significantEvents: [],  // Max 50 entries
  traumas: [],            // Lasting psychological impacts
  relationships: Map,     // Already exists
  achievements: [],       // Proud moments
  grudges: []             // Unresolved conflicts
};

addMemory(event) {
  this.memory.significantEvents.push({
    ...event,
    emotionalWeight: this.calculateEmotionalWeight(event),
    fadingRate: this.getFadingRate(event.type)
  });
  
  // Cap memory size
  if (this.memory.significantEvents.length > 50) {
    this.memory.significantEvents.shift();
  }
  
  // Check for trauma
  if (event.impact < -20) {
    this.memory.traumas.push({
      event: event,
      severity: Math.abs(event.impact),
      healingRate: 0.1 // Decreases over time
    });
  }
}

getBehaviorModifiers() {
  let modifiers = {
    bravery: 1.0,
    trust: 1.0,
    sociability: 1.0
  };
  
  // Apply trauma effects
  for (const trauma of this.memory.traumas) {
    if (trauma.event.type === 'combat') {
      modifiers.bravery *= (1 - trauma.severity / 100);
    }
    if (trauma.event.type === 'betrayal') {
      modifiers.trust *= (1 - trauma.severity / 100);
    }
  }
  
  return modifiers;
}
```

---

## 🎨 UI ENHANCEMENTS FOR PHASE 3

### New UI Panels:

1. **Faction Inspector** (click on agent or settlement):
```
┌─────────────────────────┐
│ Oakwood Defenders       │
│ Leader: Agent #42       │
│ Members: 12             │
├─────────────────────────┤
│ Beliefs:                │
│ Tradition: ████████░░ 80%│
│ Conquest: ████░░░░░░ 40%│
│ Piety:    ██░░░░░░░░ 20%│
├─────────────────────────┤
│ Relations:              │
│ ☮ Riverside Traders     │
│ ⚔ Mountain Clan         │
└─────────────────────────┘
```

2. **Event Log** (bottom right, scrollable):
```
Day 45: Earthquake strikes Oakwood Village!
Day 47: Harvest Festival begins in Riverside
Day 50: War declared: Oakwood vs Mountain Clan
Day 52: Battle at Northern Pass - Oakwood victorious
Day 55: Plague outbreak in Eastern settlements
```

3. **Divine Favor Meter** (top center):
```
Divine Favor: ████████░░ 80/100
Available Miracles: 3
```

4. **Culture Panel** (in settlement inspector):
```
Oakwood Culture:
- Work Ethic: High
- Hospitality: Moderate
- Spirituality: Low
Traditions: Annual Hunt, Harvest Dance
Taboos: Waste not want not
```

---

## 🔧 INTEGRATION CHECKLIST

### Modify `src/simulation/simulation.js`:
```javascript
// Add new systems
this.factionSystem = new FactionSystem();
this.cultureSystem = new CultureSystem();
this.combatSystem = new CombatSystem();
this.eventSystem = new EventSystem(this);

// In tick() method, add:
if (this.clock.tick % 50 === 0) {
  this.factionSystem.update(this.agents, this.settlementSystem);
  this.cultureSystem.update(this.agents, this.settlementSystem);
  this.eventSystem.checkForEvents();
}

if (this.clock.tick % 10 === 0) {
  this.combatSystem.updateActiveConflicts(this.factionSystem);
}

// Update serialization
serialize() {
  return {
    // ... existing fields
    factions: this.factionSystem.serialize(),
    cultures: this.cultureSystem.serialize(),
    activeEvents: this.eventSystem.serialize(),
    conflicts: this.combatSystem.serialize()
  };
}
```

### Modify `src/presentation/renderer.js`:
- Add faction color indicators to agents
- Draw event notifications
- Render divine power selection UI
- Show battle indicators on map

### Modify `index.html`:
- Add faction panel to UI
- Add event log container
- Add divine favor meter
- Add miracle selection buttons

---

## 📊 SUCCESS METRICS FOR PHASE 3

Phase 3 is complete when you observe:

✅ **Factions Form**: At least 2-3 distinct factions with different beliefs  
✅ **Wars Occur**: Factions occasionally go to war with visible battles  
✅ **Events Happen**: Random events (disasters, plagues, festivals) occur regularly  
✅ **Culture Diverges**: Different settlements develop unique cultural traits  
✅ **God Matters**: Using miracles noticeably affects agent behavior/beliefs  
✅ **Memories Persist**: Agents reference past events in decision-making  
✅ **Stories Emerge**: Console logs show complex narratives (wars, revenge, alliances)  

---

## 🐛 KNOWN CHALLENGES

1. **Balance Complexity**: Too many systems competing for attention
   - Solution: Tune probabilities carefully, ensure events don't overwhelm

2. **Performance**: More systems = more computation per tick
   - Solution: Use appropriate update frequencies, batch operations

3. **Readability**: Player needs to understand why things happen
   - Solution: Comprehensive event logging, clear UI feedback

4. **Determinism**: Random events make debugging harder
   - Solution: Seed-based RNG, event replay capability

---

## 🚀 POST-PHASE 3 ROADMAP

After completing Phase 3, remaining phases are:

### Phase 4: 3D Graphics (4-6 weeks)
- WebGL/WebGPU renderer
- 3D terrain and models
- Animations and VFX
- Audio system

### Phase 5: Performance & Scale (2-3 weeks)
- Web Workers for simulation
- Spatial optimization
- Support 1000+ agents

### Phase 6: Content & Replayability (ongoing)
- Scenario system
- Achievements
- Mod support

---

## 💡 DEVELOPMENT TIPS

1. **Start with Events**: Event system is most visible and fun to test
2. **Iterate on Factions**: Get basic faction formation working, then add complexity
3. **Test Combat Separately**: Create debug mode to spawn battles on demand
4. **Log Everything**: Phase 3 is about stories - make sure they're visible in console
5. **Playtest Frequently**: Run simulation for 100+ days to see emergent narratives

---

## 📁 FILE STRUCTURE AFTER PHASE 3

```
/workspace/src/
├── core/
│   ├── worldState.js
│   ├── rng.js
│   ├── eventBus.js
│   └── idGen.js
├── simulation/
│   ├── simulation.js
│   ├── agent.js (enhanced with culture, memories)
│   ├── clock.js
│   ├── entityStore.js
│   ├── resource.js
│   └── building.js
├── systems/
│   ├── relationshipSystem.js ✅
│   ├── settlementSystem.js ✅
│   ├── economySystem.js ✅
│   ├── factionSystem.js ⬜ NEW
│   ├── cultureSystem.js ⬜ NEW
│   ├── combatSystem.js ⬜ NEW
│   └── eventSystem.js ⬜ NEW
├── interaction/
│   ├── divinePowers.js ⬜ RENAMED/ENHANCED
│   └── godPowers.js (backup)
├── presentation/
│   ├── renderer.js (enhanced UI)
│   └── ui.js ⬜ NEW (dedicated UI manager)
└── data/
    ├── traits.js ⬜ NEW
    ├── jobs.js ⬜ NEW
    ├── beliefs.js ⬜ NEW
    ├── events.js ⬜ NEW
    └── miracles.js ⬜ NEW
```

---

## 🎯 READY TO BEGIN?

**Start with Step 5 (Event System)** - it's the most immediately rewarding and will make your simulation feel alive. Then add factions, combat, and finally deepen god powers.

Would you like me to implement any specific step first?
