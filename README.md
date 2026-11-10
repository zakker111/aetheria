# 🌍 Aetheria — 2.5D Emergent Civilization & History Simulator

[![Build & Tests](https://img.shields.io/badge/tests-10%2F10%20passing-brightgreen)](#-automated-test-suites)
[![React 19](https://img.shields.io/badge/React-19.3-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> *"Aetheria is not about controlling the world. It is about watching the world become a story."*  
> The core loop: **WATCH → NOTICE → INSPECT → UNDERSTAND → INTERVENE → WAIT → DISCOVER**.

**Aetheria** is an open-source, browser-based emergent civilization and history simulation game built with **React 19, TypeScript, Tailwind CSS, and HTML5 Canvas**. Watch autonomous citizens gather resources, establish craft workshops, forge dynastic houses, negotiate royal marriages, fight wars with military formations, and conquer enemy holdings—all rendered in an interactive 2.5D isometric world with procedural 3D elevation relief.

---

## ✨ Key Features

### 📐 2.5D Isometric Engine & Dynamic Atmosphere
- **Dual Viewport Perspectives**: Seamlessly toggle between **2.5D Isometric View** (with depth sorting and terrain height projection) and **2D Top-Down View**.
- **Adjustable Terrain Relief**: Cycle elevation heights from gentle rolling hills to dramatic alpine peaks.
- **Cinematic Day/Night Cycle**: Smooth sinusoidal ambient lighting and smoothstep sky color gradients transitioning across dawn, noon, golden sunset, and starry midnight.
- **Dynamic Resource Depletion & Recovery**: Chopped forests leave stumps, mined veins leave spent seams, and harvested grain leaves fallow patches that regenerate over natural seasons.

### 👤 Autonomous Citizens & Social Dynamics
- **Needs & Psychology Hierarchy**: Food, Water, Rest, and Social fulfillment driving real-time agent decisions.
- **Directional Locomotion**: Velocity-aware glide interpolation with animated footstep bobbing, limping wounded gaits, and directional sprite facing.
- **Gossip & Reputations**: Citizens converse at hearths and market squares, propagating gossip and rivalries across communities.
- **Heroic Titles & Slayers**: Combatants earn cultural epithets (*"the Blooded"*, *"the Slayer"*, *"the Fierce"*, *"the Undefeated"*) upon triumphing in lethal combat.

### 🔨 Multi-Tier Economy & Supply Chains
- **Crafting Workshops**: Woodcutters and miners deliver raw timber and iron ore to workshops; dedicated craftsmen forge planks, flour, bread, tools, weapons, and shields.
- **Communal Granaries & Stockpiles**: Settlement-wide resource management with automated emergency rations to protect hungry citizens.
- **Trade Routes & Caravans**: Automated pairing between surplus and deficit settlements; merchant caravans navigate roads to exchange commodities.

### 👑 Dynasties, Warfare & Grand Strategy
- **Noble Houses & Lineages**: Hereditary monarchies with custom royal houses, mottos, coats of arms, and genealogical succession trees.
- **Royal Marriages**: Dynastic weddings forging bilateral non-aggression treaties and military alliances.
- **Casus Belli Engine**: Territorial friction, resource jealousy, and ideological disputes generate justified wars.
- **Tactical Warfare**: Armies equip swords, spears, bows, and shields, organizing into tactical roles (commanders, archers, shieldbearers, vanguards).
- **Lethal Sieges & Peace Conferences**: Clashes generate named historical battles (*"Battle of Oakhaven Ridge"*). Victors can annex holdings or impose seasonal tributary vassalage.

### ⚡ Spatial LOD Architecture (1,500–2,500 Agents)
- **High-Performance Multi-Tier Simulation**:
  - **Tier 0 (Focus)**: Full 60Hz cognitive steering and micro-movement for viewport-visible citizens.
  - **Tier 1 (Periphery)**: Sub-sampled updates every 3 ticks for nearby off-screen agents.
  - **Tier 2 (Macro)**: Lightweight demographic simulation every 12 ticks for distant wilderness wanderers.
- **O(1) Spatial Partitioning**: Cell-based spatial hashing maintaining under **25ms per tick** at 1,800+ living agents with zero memory leaks.

---

## 🕹️ Controls & Hotkeys

| Action | Control / Hotkey | Description |
| :--- | :--- | :--- |
| **Pan Camera** | `Right-Click Drag` or `WASD` / `Arrow Keys` | Move the camera across the world map |
| **Zoom View** | `Mouse Wheel` or `+` / `-` | Zoom in and out |
| **Inspect Entity** | `Left-Click` on citizen, building, or town | Opens detailed telemetry in the Inspector Panel |
| **Jump to Front Line** | Click on `⚔️ Battle Banner` in HUD | Centers camera directly on active battlefield |
| **Toggle Wars Panel** | `W` or click **Wars** in TopBar | View active wars, casualties, casus belli, and treaties |
| **Toggle Societies Panel** | Click **Societies** in TopBar | Inspect kingdoms, populations, leaders, and stockpile reserves |
| **Toggle Chronicle** | Click **Chronicle** in TopBar | Browse world history, declarations, and great deeds |
| **Pause / Resume** | `Spacebar` | Toggle simulation time pause |
| **Speed Controls** | `0.5x`, `1x`, `2x`, `4x` buttons | Speed up or slow down the simulation clock |
| **Toggle 2.5D Mode** | Click `📐 2.5D View` button | Toggle between 2.5D Isometric and 2D Top-Down rendering |
| **Cycle 3D Relief** | Click `⛰️ Relief` button | Cycle vertical elevation accentuation |

### ⚡ Divine Powers Dock (Hotkeys `1`–`0`)
- **`1` Inspect**: Inspect any citizen, building, resource node, or territory.
- **`2` Citizen**: Spawn a new autonomous citizen with randomized traits.
- **`3` Food / `4` Water**: Create fertile berry bushes or freshwater springs.
- **`5` Wood / `6` Ore**: Plant ancient groves or seed rich iron veins.
- **`7` House / `8` Workshop / `9` Farm**: Place building foundations.
- **`0` Bless / Smite**: Bestow divine abundance or cast lightning down upon heretics.
- **Provoke War / Enforce Peace**: Instigate casus belli or compel belligerents to sign a peace concordat.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 20 or higher recommended)
- `npm` (bundled with Node.js)

### Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/aetheria.git

# Enter project directory
cd aetheria

# Install dependencies
npm install

# Start the local development server (runs on port 3000)
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

---

## 🧪 Automated Test Suites

Aetheria maintains 10 comprehensive automated test suites enforcing 100% save/load determinism, economic loops, warfare rules, and high-population performance:

```bash
# Run all 10 automated test suites
npm test

# Run code style and lint check
npm run lint

# Build production bundle
npm run build
```

| Test Suite | File | Focus |
| :--- | :--- | :--- |
| **Determinism** | `tests/determinism.mjs` | Bit-exact RNG reproducibility across identical seeds and save/load resume |
| **Gossip & Memory** | `tests/gossip.mjs` | Gossip exchange network and emotional memory persistence |
| **Supply Chain** | `tests/supplychain.mjs` | 9-phase economic loop: harvest, workshops, finished goods, trade routes, caravans |
| **War Visibility** | `tests/warvisible.mjs` | Grievance accumulation, Casus Belli triggers, and warband formation |
| **Warring Kingdoms** | `tests/scenario_warring.mjs` | Default Warring Kingdoms seed and continuous border clashes |
| **Longevity Soak** | `tests/soak.mjs` | 1,000+ tick stability benchmark ensuring zero crashes and demographic health |
| **Population Stress** | `tests/stress_population.mjs` | 1,500+ agent benchmark validating <25ms/tick with Spatial LOD |
| **Conquest & Sieges** | `tests/war_phase3b.mjs` | Equipment crafting, plunder wagons, annexation, and seasonal tribute |
| **Dynasties & Peace** | `tests/dynasty_warfare.mjs` | Dynastic lineages, royal marriages, battering rams, and peace conferences |
| **Combat Lethality & Lore** | `tests/combat_lethality_lore.mjs` | Mortal combat deaths, slayer titles, named battles, and lore serialization |

---

## 🌐 Deploying to GitHub & GitHub Pages

This repository includes pre-configured GitHub Actions workflows for automated continuous integration and zero-config deployment to GitHub Pages.

### 1. Push to your GitHub Repository
```bash
# Initialize git if starting fresh
git init
git add .
git commit -m "feat: initial commit of Aetheria simulation"

# Set main branch and remote
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# Push to GitHub
git push -u origin main
```

### 2. Enable GitHub Pages
1. Go to your repository on GitHub.
2. Navigate to **Settings** → **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish your game to:  
   `https://<your-username>.github.io/<your-repo-name>/`

---

## 🏗️ Project Architecture

```
├── .github/workflows/     # Automated CI and GitHub Pages deployment workflows
├── docs/                  # Architectural guidelines and game design constitution
├── src/
│   ├── components/        # React UI panels (Inspector, Wars, Societies, TopBar, Controls)
│   ├── core/              # Constants, biomes, and game configurations
│   ├── presentation/      # 2.5D Isometric Canvas Renderer, lighting, and camera
│   ├── simulation/        # Core tick loop, clock, agents, and spatial LOD management
│   ├── systems/           # Modular simulation systems:
│   │   ├── combatSystem.js     # Health, melee damage, and lethal blow resolution
│   │   ├── warfareSystem.js    # Warbands, tactics, sieges, and plunder
│   │   ├── diplomacySystem.js  # Casus Belli, alliances, and peace conferences
│   │   ├── dynastySystem.js    # Royal lineages, monarchs, and royal marriages
│   │   ├── craftingSystem.js   # Multi-tier recipes, workshops, and craftsmen
│   │   ├── settlementSystem.js # Communal stockpiles, territories, and housing
│   │   ├── tradeSystem.js      # Commercial trade routes and caravan logistics
│   │   ├── chronicleSystem.js  # Living historical chronicle and event logger
│   │   └── religionSystem.js   # Beliefs, temples, missionaries, and inquisitions
│   └── utils/             # Deterministic PRNG, math, and spatial hashing
├── tests/                 # 10 automated test suites verifying engine integrity
├── index.html             # HTML5 entry point
├── package.json           # Scripts and dependencies
└── vite.config.ts         # Vite bundler configuration (relative base for Pages)
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
