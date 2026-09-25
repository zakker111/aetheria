# Phase 8: Procedural Terrain & Hydrology Master Plan

## 🎯 Vision
Transform the flat 2D grid into a living, breathing **2.5D world** with realistic mountains, flowing rivers, dynamic waterfalls, and rich biome distribution. The map will be procedurally generated with natural hydrology where water always finds its way to the ocean.

---

## 🏗️ Core Architecture Changes

### 1. Data Structure Upgrade (2D → 2.5D)
- **Current**: `Tile { type, resource }`
- **New**: `Tile { x, y, height, waterLevel, biome, resource, slope }`
- **Map Size**: Expand from 64x64 to **128x128** or **256x256**
- **Height Range**: 0 (sea level) to 100 (mountain peaks)

### 2. Rendering Engine Overhaul
- Implement **height-based shading** (darker in valleys, brighter on peaks)
- Add **perspective projection** for 2.5D depth illusion
- Dynamic **water rendering** with flow animation
- **Biome-specific textures/colors**: Snow caps, forest greens, rocky grays

---

## 🌋 Procedural Generation Pipeline

### Step 1: Continental Noise (Base Heightmap)
- Use **Perlin/Simplex Noise** for natural terrain
- Multiple octaves for detail (large continents + small hills)
- Generate base height values for every tile

### Step 2: Biome Distribution
- **Height-based biomes**:
  - 0-5: Ocean/Lake (Water)
  - 6-15: Beach/Shallow Water
  - 16-40: Plains/Grassland
  - 41-70: Forest/Woodland
  - 71-90: Mountains/Rocky
  - 91-100: Snow Peaks
- **Moisture map** overlay for forest density

### Step 3: River Carving Algorithm
- **Source Selection**: Pick high-altitude points (mountains)
- **Flow Simulation**: Water flows to lowest neighbor
- **Path Carving**: Reduce height along river path to create valleys
- **Lake Formation**: Fill depressions that can't drain
- **Edge Connection**: Ensure all rivers reach map boundary (ocean)

### Step 4: Resource Placement
- **Mountains (Height 70+)**: Iron, Gold, Copper ores
- **Forests (Height 40-70)**: Trees (Wood), Herbs
- **Plains (Height 15-40)**: Wheat, Berries
- **Water (Height <15)**: Fish, Reeds
- **Volcanic Zones**: Rare gems, Sulfur

---

## 💧 Dynamic Water Physics

### Hydrology System
- **Flow Direction**: Each water tile calculates flow vector to lowest neighbor
- **Volume Simulation**: Track water volume per tile
- **Overflow Mechanics**: Excess water spills to neighbors
- **Evaporation**: Water loss in hot/dry biomes
- **Precipitation**: Rain adds water to highlands

### Waterfall Effects
- Detect height differences > threshold between adjacent tiles
- Render animated waterfall sprites/particles
- Sound effects for large drops
- Mist particles at base of waterfalls

### Edge Behavior
- Water reaching map edge flows "off-world" creating continuous waterfalls
- Visual horizon effect with distant falling water

---

## 🛠️ God Tools - Terraforming Suite

### New Divine Powers
1. **Raise Land**: Click/drag to increase height (create mountains)
2. **Lower Land**: Click/drag to decrease height (create valleys/lakes)
3. **Smooth Terrain**: Average heights in selected area
4. **Draw River**: Click start/end points, auto-carve natural path
5. **Create Lake**: Flood depression to specified level
6. **Volcano Eruption**: Create mountain spike + lava flow
7. **Flood**: Temporarily increase water levels globally
8. **Drought**: Decrease water levels globally
9. **Earthquake**: Randomly adjust heights in area (chaos tool)

### Tool UI
- New toolbar section: "Terraform"
- Brush size slider (small/medium/large areas)
- Strength slider (subtle vs dramatic changes)
- Real-time preview of height changes

---

## 📋 Implementation Steps

### Milestone 1: Data Foundation
- [ ] Update `Tile` class with `height`, `waterLevel`, `biome` properties
- [ ] Modify `WorldState` to support larger maps (128x128)
- [ ] Create serialization migration for existing saves

### Milestone 2: World Generator
- [ ] Implement `NoiseGenerator` (Perlin/Simplex)
- [ ] Create `BiomeMapper` based on height/moisture
- [ ] Build `RiverCarver` algorithm with flow simulation
- [ ] Develop `ResourcePlacer` with biome logic
- [ ] Add seed-based reproducibility

### Milestone 3: Renderer Upgrade
- [ ] Implement height-based color mapping
- [ ] Add 2.5D perspective projection
- [ ] Create water flow animation system
- [ ] Add biome-specific textures/sprites
- [ ] Optimize for larger map rendering

### Milestone 4: Hydrology System
- [ ] Build `WaterFlowSimulator` with cellular automata
- [ ] Implement overflow and erosion mechanics
- [ ] Create waterfall detection and rendering
- [ ] Add evaporation/precipitation cycle

### Milestone 5: God Tools
- [ ] Create terraforming brush system
- [ ] Implement raise/lower/smooth algorithms
- [ ] Build river drawing with auto-pathfinding
- [ ] Add volcano/flood/drought special tools
- [ ] Integrate with existing UI framework

### Milestone 6: Agent Adaptation
- [ ] Update pathfinding to consider slope costs
- [ ] Add climbing ability for steep terrain (or block it)
- [ ] Modify settlement placement logic for flat areas
- [ ] Update resource gathering for 3D positions

### Milestone 7: Polish & Performance
- [ ] LOD (Level of Detail) rendering for distant terrain
- [ ] Chunk-based updates for water simulation
- [ ] Multi-threaded generation for large maps
- [ ] Visual effects: mist, shadows, water reflections

---

## ✅ Verification Goals

- [ ] **Unique Worlds**: Every new game has distinct terrain
- [ ] **Natural Rivers**: All rivers flow logically to edges/oceans
- [ ] **Resource Logic**: Ores only in mountains, trees in forests
- [ ] **Waterfalls**: Visible at map edges and cliff drops
- [ ] **Performance**: Stable 30+ FPS on 128x128 maps
- [ ] **God Tools**: All terraforming powers functional and intuitive
- [ ] **Agent Navigation**: Agents successfully traverse varied terrain
- [ ] **Save/Load**: Heightmaps persist correctly

---

## 🔮 Future Extensions (Post-Phase 8)
- True 3D rendering with WebGL/Three.js
- Underground cave systems
- Tectonic plate simulation (continental drift over time)
- Advanced erosion (rain wearing down mountains)
- Dynamic vegetation growth based on climate

---

**Status**: Ready for Implementation  
**Priority**: High (Foundation for all future visual/gameplay improvements)  
**Estimated Complexity**: High (Core architecture changes required)
