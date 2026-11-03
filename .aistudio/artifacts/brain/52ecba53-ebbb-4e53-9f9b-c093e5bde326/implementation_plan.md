# Civilization Dynasties, Warfare Sieges & Diplomacy System

## Overview & Objectives
This plan outlines the architecture and execution for expanding civilization systems in **Aetheria** with:
1. **Ruling Dynasties & Lineage Trees**: Noble houses, succession laws (Primogeniture, Elective, Royal Marriages), royal legitimacy, and genealogy tracking.
2. **Deepened Warfare & Siege Mechanics**: Multi-phase town sieges (encirclement, wall breaches, town hall storming), dynamic War Score (-100 to +100), siege equipment (rams/catapults), and formalized Peace Conferences (hostage exchange, reparations, territorial cession, dynastic pacts).
3. **Full-Screen Interactive Civilization Modal (`CivilizationModal.tsx`)**:
   - **Dynasty Tree Viewer**: Interactive SVG tree showing royal family lineages, living monarchs, pretenders, and marriages.
   - **Diplomatic Realpolitik Graph**: Force-directed SVG network map showing realms, alliances, treaties, rivalries, and trade pacts.
   - **War Room & Siege Tracker**: Live active wars, siege progress bars, battle casualties, and peace negotiation treaty terms.
   - **Treaty & Demilitarization Ledger**: Signed pacts, tribute payments, and demilitarized buffer zones.
4. **Strict Determinism & Test Coverage**: Fully serialized in save/load with 100% deterministic replayability and comprehensive automated test suites.

---

## Architectural Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Simulation Engine                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
[DynastySystem]                [WarfareSystem]               [DiplomacySystem]
- House Banners & Names        - Multi-phase Sieges           - War Score (-100..+100)
- Royal Marriages              - Wall breaches & storming     - Peace Conferences
- Succession Laws              - Siege engines (rams)         - Hostage/Heir exchanges
- Legitimacy & Pretenders      - Casus Belli escalation       - Demilitarized zones
       │                               │                               │
       └───────────────────────────────┼───────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CivilizationModal Component                          │
│  (Full-Screen Modal with Tabs, Interactive SVG Lineage & Realpolitik Graph) │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│    [Dynasties Tab]           │       [Diplomacy Tab]        │  [War Room]   │
│ - Interactive SVG Tree       │ - Force-Directed Realm Graph │ - Siege Status│
│ - Monarch details & traits   │ - Treaty & Tribute Ledger    │ - War Scores  │
│ - Succession list & claims   │ - Casus Belli list           │ - Peace Terms │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

---

## Proposed Changes & Phased Execution

### Phase 1: Dynastic Lineages & Royal Houses (`src/systems/dynastySystem.js`)
- **Noble Houses**:
  - Each settlement founds or pledges allegiance to a Royal House (House Name, Sigil, Motto, Primary Colors).
  - Track sovereign rulers (King/Queen/Chieftain) and heirs.
- **Genealogy & Succession**:
  - Link parent-child lineages across generations via agent relationship and genealogy records.
  - Implement Succession Laws: Primogeniture (eldest child inherits), Elective (nobles choose highest-prestige warrior), or Agnation.
  - Royal Marriages: Diplomatic unions between rival settlements to forge 500-tick non-aggression pacts.
- **Determinism & Persistence**:
  - Add full `serialize()` and `deserialize()` with zero random seed deviation.

### Phase 2: Multi-Stage Sieges & Dynamic Peace Treaties (`src/systems/warfareSystem.js` & `diplomacySystem.js`)
- **Multi-Stage Town Sieges**:
  - **Stage 1: Encirclement**: Warband surrounds enemy town center, cutting off food caravans and trade routes.
  - **Stage 2: Breach**: Siege rams attack town gates and defensive structures (`health` depletion and fire ignition).
  - **Stage 3: Storming & Surrender**: Warbands duel defending garrison at Town Hall. If garrison falls or morale breaks, town capitulates.
- **War Score & Peace Conferences**:
  - Track War Score (-100 to +100) based on casualty ratio, successful raids, and besieged structures.
  - When War Score exceeds threshold or War Weariness maxes out, parties convene a Peace Conference:
    - **Treaty Options**: Gold/food reparations, vassalage tribute, dynastic royal marriage, demilitarized buffer zone cooldown, or prisoner exchange.
- **Event Bus Integration**:
  - Emit rich events: `SIEGE_BEGUN`, `GATE_BREACHED`, `TOWN_CAPITULATED`, `PEACE_CONFERENCE_CONCLUDED`, `ROYAL_WEDDING`.

### Phase 3: Full-Screen Civilization Modal (`src/components/CivilizationModal.tsx`)
- **Presentation & UX**:
  - Full-screen modal accessed via high-visibility HUD button or shortcut key (`C` or crown icon).
  - Dark-slate architectural aesthetic with crisp typographic hierarchy (`Fraunces` / `Cinzel` serif headers, clean tabular numerals).
- **Tab 1: Dynasties & Lineages**:
  - Interactive SVG family tree rendering ancestry nodes, current monarchs, spouses, children, and claimants.
  - Click any royal agent to view their age, combat stats, legitimacy rating, and current location on the map.
- **Tab 2: Realpolitik & Diplomacy Network**:
  - Interactive SVG force-directed realm graph: nodes represent settlements sized by population/wealth; links indicate Alliances (cyan), Wars (crimson), Vassalage (gold), and Neutrality (dashed gray).
  - Dynamic tooltip showing mutual grievances, casus belli, and trade volumes.
- **Tab 3: War Room & Active Campaigns**:
  - Tactical card view of all active conflicts with live War Score progress bars, siege status indicators, commander portraits, and casualty tolls.
  - Treaty history archive documenting historic peace agreements and past conquered territories.

### Phase 4: Verification, Automated Testing & Visual Polish
- **Automated Test Suite (`tests/dynasty_warfare.mjs`)**:
  - Royal house creation and hereditary succession test on ruler death.
  - Royal marriage non-aggression verification.
  - Multi-stage siege execution from encirclement to town capitulation.
  - War score calculation and peace treaty enforcement.
  - Determinism verification: save/load state matches uninterrupted simulation run.
- **Integration with Existing Tests**:
  - Ensure `npm test` runs all existing 8 tests (`soak`, `determinism`, `gossip`, `supplychain`, `warvisible`, `scenario_warring`, `stress_population`, `war_phase3b`) plus the new suite without failures.
- **Build & Lint Verification**:
  - Run `compile_applet` and `lint_applet` to guarantee clean TypeScript compilation and zero warnings.

---

## User Review & Approval
Please review this implementation plan. Click **Proceed** to begin execution of the dynasty lineages, siege warfare mechanics, and the interactive civilization modal.
