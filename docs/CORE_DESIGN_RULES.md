# AETHERIA — CORE DESIGN RULES

*The authoritative design constitution for this project. Every feature, refactor, and plan step must be checked against these rules.*

---

## 1. THE CORE IDEA

Aetheria is a god simulation game about watching societies live, grow, struggle, change, and collapse.

The player is not primarily a commander.
The player is not primarily a city builder.
The player is not primarily controlling individual agents.

**The player is a god observing a living world.**

The simulation should be interesting even when the player does absolutely nothing.

The player may occasionally intervene and then watch the consequences unfold.

---

## 2. THE MOST IMPORTANT DESIGN RULE

**THE WORLD MUST BE INTERESTING WITHOUT THE PLAYER.**

Aetheria should continue functioning if the player never interacts with it.

Agents should:

- find food
- find water
- work
- travel
- build
- trade
- socialize
- form relationships
- have children
- grow old
- die
- form settlements
- create factions
- compete
- cooperate
- migrate
- fight
- recover
- collapse
- rebuild

The player should be able to leave the simulation running and return later to discover that something happened.

**BAD:** The player must constantly issue orders for anything interesting to happen.

**GOOD:** The player watches something happen and thinks:

"Why did they do that?"

Then investigates.

---

## 3. THE PLAYER IS AN OBSERVER FIRST

The primary player actions should be:

1. Observe
2. Inspect
3. Understand
4. Intervene
5. Observe the consequences

The player should not need to constantly manage the world.

Aetheria should feel closer to:

"I am watching a civilization evolve."

than:

"I am controlling a civilization."

---

## 4. INSPECTION IS A MAJOR GAMEPLAY FEATURE

Inspection is not merely debugging. **It is gameplay.**

The player should be able to select:

- an individual
- a family
- a building
- a resource
- a farm
- a workplace
- a settlement
- a faction
- a war
- a region
- an event
- important historical events

The player should be able to understand:

- Who is this?
- What are they doing?
- Why are they doing it?
- Where are they going?
- Who do they know?
- Who do they like?
- Who do they dislike?
- What do they remember?
- What do they want?
- What are they afraid of?
- What happened to them?
- What is happening around them?

---

## 5. AGENTS SHOULD HAVE REASONS

Agents should not appear to move randomly.

Whenever practical, an agent's important actions should have an understandable reason.

Example:

> Erik is walking toward the farm.
> **Reason:** His farming job requires him to harvest the field.

Example:

> Anna is walking toward the market.
> **Reason:** She needs food and the household stockpile is empty.

Example:

> Markus left the settlement.
> **Reason:** Food shortages made the settlement unsuitable for his family.

The player should be able to inspect these reasons.

---

## 6. AGENTS SHOULD FEEL LIKE PEOPLE

Agents should not just be resource-processing machines.

Important agents should be able to develop:

- personality
- relationships
- memories
- family
- occupation
- wealth
- reputation
- beliefs
- loyalties
- fears
- ambitions
- rivalries
- important experiences

Not every agent needs maximum complexity.

The simulation should prioritize **meaningful complexity over unnecessary complexity**.

---

## 7. EMERGENT STORIES ARE THE MAIN PRODUCT

Aetheria should generate stories from systems interacting with each other.

The game should not require scripted stories for every interesting situation.

Example:

```
Food shortage
→ hunger increases
→ people compete for food
→ migration begins
→ population decreases
→ settlement becomes weaker
→ neighboring faction becomes aggressive
→ war begins
→ buildings are destroyed
→ survivors flee
→ new settlement forms.
```

None of this needs to be a manually scripted storyline.

**The systems create the story.**

---

## 8. CONSEQUENCES MATTER

Player actions should have consequences.

If the player gives a settlement enormous amounts of food, that should potentially change the settlement.

Example:

```
Food gift
→ population survives
→ population grows
→ settlement becomes wealthy
→ neighboring factions become interested
→ trade increases
```

Or:

```
Food gift
→ population grows too quickly
→ food demand increases
→ surrounding resources become depleted
→ famine eventually occurs.
```

The player should not simply press a button and receive an isolated effect.

**God actions should interact with the simulation.**

---

## 9. GOD POWERS SHOULD CREATE STORIES

God powers should be designed around:

"What happens if I do this?"

rather than:

"What button can I press?"

Examples:

- Bless an individual.
- Heal a group.
- Give food.
- Give resources.
- Create water.
- Change terrain.
- Start a fire.
- Cause drought.
- Kill an individual.
- Save an individual.
- End a war.
- Encourage a faction.
- Destroy a building.
- Create a miracle.

The important part is not the immediate effect.

**The important part is the chain reaction afterward.**

---

## 10. DO NOT TURN AETHERIA INTO AN RTS

Avoid making the player responsible for:

- managing every worker
- assigning every individual
- controlling armies directly
- manually placing every building
- constantly optimizing resources
- micromanaging production
- giving constant movement orders

The societies should manage themselves.

The player should be able to interfere, but does not need to.

---

## 11. DO NOT TURN AETHERIA INTO A CITY BUILDER

The player should not personally design every city.

Settlements should emerge from the simulation.

Agents should decide where practical buildings belong based on:

- available resources
- jobs
- population
- terrain
- roads
- water
- existing buildings
- economic needs
- safety

The player can influence this indirectly.

---

## 12. SOCIETIES MUST BE ABLE TO FAIL

Do not design the simulation so that every settlement naturally becomes bigger and stronger.

Settlements should sometimes:

- shrink
- become poor
- lose population
- lose territory
- suffer disasters
- lose wars
- split
- migrate
- revolt
- collapse
- disappear

Likewise, new settlements should sometimes appear.

**The world should constantly change.**

---

## 13. SUCCESS IS NOT ALWAYS THE GOAL

Aetheria does not need a traditional "win state."

A settlement becoming huge is not automatically better than a small settlement.

A faction conquering everything is not automatically the intended outcome.

**Interesting outcomes are more important than optimal outcomes.**

A tiny village surviving for 200 years can be more interesting than a giant empire.

---

## 14. HISTORY SHOULD MATTER

The world should remember important events.

Important events can include:

- settlement founded
- settlement abandoned
- major war
- peace treaty
- important leader death
- famine
- drought
- fire
- major migration
- faction created
- faction destroyed
- important birth
- important death
- major god intervention

The player should eventually be able to look back and understand:

"This is how this society became what it is."

---

## 15. THE WORLD SHOULD HAVE MEMORY

The simulation should not feel like everything resets every tick.

Agents should remember meaningful experiences.

Societies should have histories.

Factions should have relationships.

Places should have histories.

Wars should have consequences.

A character whose family was killed by another faction should potentially have a different attitude toward that faction later.

**History should influence future behavior where practical.**

---

## 16. MAKE EVENTS DISCOVERABLE

The player should not need to constantly watch every corner of the world.

Important events should attract attention.

Examples:

- 🔥 Major fire in Oak Valley
- ⚔️ War started between River Town and Oak Valley
- 👑 New leader elected
- 👶 Important family has a new child
- 💀 Settlement leader died
- 🏘️ New settlement founded
- 🌾 Severe food shortage
- 🧭 Large migration detected

These events give the player a reason to investigate.

---

## 17. ZOOM SHOULD CHANGE THE EXPERIENCE

The player should be able to move between different scales.

**WORLD SCALE** — See:

- regions
- settlements
- factions
- wars
- migration
- major events

**SETTLEMENT SCALE** — See:

- buildings
- roads
- farms
- workplaces
- population
- activity

**INDIVIDUAL SCALE** — See:

- agent
- family
- job
- relationships
- needs
- memories
- current actions

The player should be able to move naturally between these levels.

---

## 18. VISUAL ACTIVITY MATTERS

The world should not feel like a spreadsheet.

Whenever possible, the player should be able to visually see:

- agents walking
- workers working
- people gathering
- markets operating
- construction happening
- animals moving
- groups traveling
- armies marching
- fires spreading
- settlements growing
- people leaving settlements
- new settlements forming

**Watching the simulation should itself be enjoyable.**

---

## 19. PERFORMANCE SHOULD SUPPORT WATCHING

The simulation must remain stable while many things happen simultaneously.

The game should prioritize:

- smooth observation
- stable simulation
- useful visual activity
- deterministic behavior where appropriate
- efficient updates

Do not add simulation complexity that makes the game substantially less enjoyable to watch unless the feature provides meaningful gameplay value.

---

## 20. DO NOT ADD FEATURES JUST BECAUSE THEY ARE POSSIBLE

Every new system should answer at least one question:

- Does this make the world more believable?
- Does this create interesting emergent behavior?
- Does this make inspection more interesting?
- Does this create interesting consequences?
- Does this give the player something interesting to observe?

If the answer is no to all of them, the feature probably does not belong in Aetheria yet.

---

## 21. COMPLEXITY SHOULD SERVE THE EXPERIENCE

Do not make systems complicated merely because complexity is technically impressive.

Prefer:

> simple systems interacting in interesting ways

over:

> huge isolated systems with little visible effect.

Example:

A simple hunger system + farming + trade + migration + family relationships

can create more interesting gameplay than a highly complicated hunger simulation that nobody notices.

---

## 22. PRESERVE THE EMERGENT CHAIN

When modifying a system, consider what happens before and after it.

Example:

**Building system:**

```
Resources → construction → building → workplace → jobs → production → economy → settlement growth → population changes
```

Do not implement a feature as an isolated mechanic if it could naturally participate in the existing simulation.

---

## 23. PLAYER INTERVENTION SHOULD BE OPTIONAL

Aetheria should be fun in three different ways.

**PASSIVE GOD** — The player does almost nothing. They simply watch the world develop.

**CURIOUS GOD** — The player mostly investigates:

- "Who is that?"
- "Why is this settlement dying?"
- "Who started this war?"
- "Where did these people come from?"

**ACTIVE GOD** — The player frequently intervenes:

- "I'm going to save this village."
- "I'm going to help this faction."
- "I'm going to punish this king."
- "I'm going to destroy their food supply."
- "What happens if I do this?"

All three playstyles should be valid.

---

## 24. THE PLAYER SHOULD FEEL POWERFUL BUT NOT ALL-KNOWING

The player is a god, but the simulation should still have things worth discovering.

The player should be able to inspect a lot, but not necessarily receive every answer immediately.

Example:

"Why did Markus leave?"

The player might discover:

- food shortage
- argument with another agent
- low loyalty
- family moved away

The player pieces together the story.

This makes inspection feel like discovery rather than reading a database.

---

## 25. PRIORITIZE INTERESTING INDIVIDUALS

Not every agent needs equal simulation complexity.

Some agents naturally become important because they:

- become leaders
- have large families
- participate in wars
- become wealthy
- commit crimes
- found settlements
- become famous
- survive disasters
- interact with the god
- dramatically affect history

These agents can naturally become the "characters" of the simulation.

The player should be able to follow them.

---

## 26. FOLLOWING SHOULD BE FUN

The player should eventually be able to select an agent and simply follow their life.

Example:

**FOLLOW ERIK**

| When | What |
|---|---|
| Day 1 | Works on farm. |
| Day 3 | Visits market. |
| Day 7 | Marries Anna. |
| Year 4 | Has first child. |
| Year 12 | Joins militia. |
| Year 13 | Fights in war. |
| Year 14 | Returns home injured. |
| Year 20 | Becomes settlement leader. |
| Year 27 | Dies. |

The player should feel like they watched a life unfold.

---

## 27. DESIGN FOR "WHAT HAPPENS NEXT?"

Good Aetheria systems should make the player wonder:

"What happens next?"

Examples:

- This settlement is starving. Will they survive?
- This faction is getting powerful. Will they attack?
- This child is the leader's heir. What will happen to them?
- This town just lost a war. Will it recover?
- I gave this village gold. What will they do with it?
- I killed the leader. Who replaces them?
- Two factions hate each other. Will they eventually go to war?
- This family is migrating. Where will they settle?

**That curiosity is one of the game's primary rewards.**

---

## 28. DEBUGGING SHOULD NOT DESTROY THE SIMULATION DESIGN

Developer tools and debug information are useful.

However, development architecture should not turn the actual game into a technical dashboard.

Debug information can exist separately.

The player-facing experience should focus on:

**people, places, events, stories, and consequences.**

---

## 29. DO NOT REWRITE WORKING SYSTEMS WITHOUT A REASON

Aetheria already contains many interacting simulation systems.

When adding features:

1. Understand the existing system.
2. Reuse existing mechanics where possible.
3. Extend instead of replacing when practical.
4. Preserve existing emergent behavior.
5. Test that old systems still work.
6. Only refactor large systems when there is a clear benefit.

Do not rewrite the project merely to make the architecture look cleaner.

---

## 30. THE ULTIMATE TEST

Whenever a major feature is added, ask:

**"Would I actually enjoy watching this happen?"**

Then ask:

**"Would I want to click on something and understand what happened?"**

Then:

**"Could this create consequences that affect other parts of the world?"**

If the answer is yes, the feature probably fits Aetheria.

If the feature only adds technical complexity without creating something interesting to watch, inspect, or influence, it should probably wait.

---

## AETHERIA'S CORE EXPERIENCE

```
WATCH
The world lives by itself.
   ↓
NOTICE
Something unusual happens.
   ↓
INSPECT
The player investigates.
   ↓
UNDERSTAND
The player discovers the people, causes, relationships and history involved.
   ↓
INTERVENE
The god changes something.
   ↓
WAIT
The simulation reacts.
   ↓
WATCH
The consequences create new events.
   ↓
DISCOVER
The world becomes a story.
```

---

## FINAL DESIGN RULE

**AETHERIA IS NOT ABOUT CONTROLLING THE WORLD.**

**AETHERIA IS ABOUT WATCHING THE WORLD BECOME A STORY.**

The simulation should create the story.

The agents should create the story.

The societies should create the story.

The player should occasionally disturb the story.

And then the player should sit back and see what happens next.
