# Aetheria: Civilization Ages, Dynamic Weather & Spectator Radar

A major feature expansion that transforms Aetheria into an immersive, drama-filled spectator simulation with multi-tier civilization ages, monumental wonders, living weather systems with wildfires, and an interactive mini-map radar with territory and population heatmaps.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core directions were confirmed through our interactive planning consultation:
> 
> - **Confirmed Feature Direction**: Deeper civilization ages, technology progression, and monumental wonder construction.
> - **Confirmed Spectator Feature**: Interactive Mini-Map Radar with live camera viewport rect, settlement territory overlays, and switchable heatmaps (Population density, Resource wealth, Diplomatic tension).
> - **Confirmed Weather & Environment**: Full dynamic weather cycles (Rain, Lightning strikes, Wildfire ignition & spread, Droughts) that physically interact with biomes, crops, and wooden structures.

---

## 1. Overview & Core Concept

### What It Delivers
1. **Civilization Ages & Wonder Monuments**:
   - Settlements advance through distinct historical epochs: **Tribal Era** → **Bronze Age** → **Classical Era** → **Imperial Age**.
   - Each Age unlocks specialized architectures, clothing tints, cultural traditions, and grand **Monumental Wonders** (e.g., *Great Pyramidal Shrine*, *Colosseum of Champions*, *Grand Citadel*, *Astronomical Monolith*).
   - Citizens rally to construct wonders that project spiritual dominance, boost harvest yields, or deter enemy aggression.

2. **Interactive Mini-Map Radar & Heatmaps**:
   - A sleek, floating mini-radar in the bottom-left corner providing an instant 128×128 tactical overview.
   - Click or drag on the mini-map to instantly pan the main 2.5D camera.
   - Switchable overlay modes: **Territory Borders**, **Population Density Heatmap**, **Resource Wealth Heatmap**, and **War/Tension Danger Heatmap**.

3. **Dynamic Weather Systems & Cataclysms**:
   - Ambient weather states: **Clear Skies**, **Gentle Rain** (speeds crop growth, replenishes dry springs), **Thunderstorm** (lightning flashes with procedural thunder audio effects, striking trees and flammable buildings), **Drought** (parches farmland, dries wells), and **Wildfire Outbreak** (flames propagate across dry forest tiles, requiring fire-fighting or divine dousing).
   - New divine miracle tools in the dock: **Raincloud**, **Lightning Strike**, and **Douse Fire**.

---

## 2. User Experience & Visual Design

### Key User Flows
- **The Ages Progression Flow**:
  - As a settlement's population grows, stockpiles accumulate, and buildings thrive, its council initiates an **Age Advancement**.
  - A celebration chronicle banner announces the advancement (e.g., *"Oakwood Town has entered the Classical Era!"*).
  - A Monument blueprint is automatically surveyed and placed at the town center; builders and citizens gather stone and wood to construct it tile-by-tile.
- **The Mini-Map Radar Flow**:
  - The player sees a radar display in the bottom-left corner with glowing realm crests, active warband dots, and the camera's trapezoidal viewport bounding box.
  - Tapping **Density**, **Wealth**, or **Conflict** toggles color-coded canvas heat overlays across the mini-radar.
  - Clicking any spot on the mini-radar glides the main camera directly to that location.
- **The Weather & Disaster Flow**:
  - Clouds darken during thunderstorms; rain particles streak across the 2.5D viewport with ambient wind motion.
  - Lightning strikes hit an ungrounded tree or workshop, sparking an amber-orange flame tile that spreads based on wind and timber density.
  - Citizens sound the alarm and rush with water buckets from town wells to extinguish the blaze, or the player intervenes with a Rain miracle.

### Visual Identity & Theme
- **Color Palette & Discipline**:
  - Background Canvas: Slate black (`#0f172a`) with blurred backdrop filters (`rgba(15, 23, 42, 0.88)`).
  - Age Colors: Tribal (Earth Ochre `#b45309`), Bronze (Copper Bronze `#d97706`), Classical (Imperial Azure `#38bdf8`), Imperial (Regal Gold `#eab308`).
  - Weather Visuals: Soft rain streaks (`rgba(186, 230, 253, 0.65)`), lightning flashes (`#ffffff` frame illumination), and burning embers (`#f97316` and `#ef4444`).
- **Typography & Clean Metadata**:
  - Strict anti-slop rules: No unnecessary pills, clean unboxed text metadata with `·` separators, tabular numbers for all resource and age countdowns.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Organic Civilization Ages vs. Hardcoded Timers**
  - *Chosen Approach*: Age progression is earned through settlement milestones (minimum population, diverse completed structures, and granary stockpile thresholds).
  - *Why*: Makes watching the world rewarding—prosperous trading kingdoms advance to the Classical Era while war-torn tribes remain struggling in the Bronze Age.
- **Decision 2: High-Performance Canvas Mini-Map vs. DOM Grid**
  - *Chosen Approach*: Offscreen canvas buffer rendering the mini-map at 128×128 resolution, drawn smoothly to an interactive radar widget with zero DOM overhead.
  - *Why*: Keeps 60 FPS performance even during massive battles and weather simulations.
- **Decision 3: Non-Destructive Wildfire Containment**
  - *Chosen Approach*: Wildfires consume vegetation and cause structure damage, but citizens can fetch well water to extinguish them, and burnt land regenerates fertile ash soil after 150 ticks.
  - *Why*: Adds high-stakes drama and visual excitement without destroying the player's world irreversibly.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Aetheria App                              │
│                                                                        │
│  ┌────────────────────┐   ┌───────────────────┐   ┌─────────────────┐  │
│  │ TopBar & Telemetry │   │ ControlsHeader    │   │ SidePanels      │  │
│  │ (Ages, Epochs, HUD)│   │ (Weather, Ages)   │   │ (Societies, War)│  │
│  └─────────┬──────────┘   └─────────┬─────────┘   └────────┬────────┘  │
│            │                        │                      │           │
│  ┌─────────┴────────────────────────┴──────────────────────┴────────┐  │
│  │                   Simulation Orchestrator                        │  │
│  │  - CivilizationAgeSystem (Tech trees, Ages, Monument tracking)    │  │
│  │  - WeatherSystem (Rain, Thunder, Drought, Wildfire grid)         │  │
│  │  - SettlementSystem & DiplomacySystem                           │  │
│  │  - Spatial Grid & Deterministic RNG                             │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             │                                          │
│         ┌───────────────────┴───────────────────┐                      │
│         ▼                                       ▼                      │
│  ┌─────────────────────────────┐   ┌────────────────────────────────┐  │
│  │ Main 2.5D / 2D Canvas View  │   │ MiniMapRadar Component         │  │
│  │ - Weather particle overlays │   │ - Interactive click-to-pan     │  │
│  │ - Monuments 3D rendering    │   │ - Territory borders & heatmaps │  │
│  │ - Lightning & fire shaders  │   │ - Active warband blips         │  │
│  └─────────────────────────────┘   └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### New & Modified Modules
1. `src/systems/civilizationAgeSystem.ts`:
   - Tracks settlement epoch: `Tribal`, `Bronze`, `Classical`, `Imperial`.
   - Age thresholds, unlocked perks, and monument blueprints.
2. `src/systems/weatherSystem.ts`:
   - Manages ambient weather state (`clear`, `rain`, `storm`, `drought`).
   - Fire simulation grid (`fireGrid: Uint8Array`) with deterministic burn spread, rain quenching, and ash regeneration.
3. `src/components/MiniMapRadar.tsx`:
   - Dedicated 140×140 canvas displaying world terrain, settlement boundaries, camera viewport box, and selectable heatmap overlays.
4. `src/presentation/renderer.js`:
   - Extended to render 2.5D Monument models, falling rain streaks, lightning ambient flashes, and flame particles.
5. `src/components/Dock.tsx`:
   - Expanded with weather miracles: `rain`, `lightning`, and `douse`.
