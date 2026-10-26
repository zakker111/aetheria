# Aetheria - God Simulation Game (React)

A browser-based god simulation game rewritten as a modern **React + Vite** application with TypeScript and Tailwind CSS, where players observe and influence autonomous agents, resources, and civilizations across 2.5D isometric terrain.

> **Design constitution:** all features are governed by [docs/CORE_DESIGN_RULES.md](docs/CORE_DESIGN_RULES.md) — *"Aetheria is not about controlling the world. It is about watching the world become a story."* The loop: **WATCH → NOTICE → INSPECT → UNDERSTAND → INTERVENE → WAIT → DISCOVER**.

## 🎮 Project Overview

Aetheria features a deterministic entity-component-system simulation engine rendered to an interactive HTML5 Canvas with procedural 3D terrain elevation and full 2.5D isometric graphics. Autonomous citizens form settlements, cultivate culture, harvest resources, establish trade, declare wars, and negotiate alliances.

## 🚀 Technology Stack

- **Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite (host `0.0.0.0`, port `3000`)
- **Styling**: Tailwind CSS
- **Simulation Engine**: Modular ES entity store with deterministic RNG stream and tick clock
- **Rendering**: 2.5D Isometric & 2D Top-Down canvas renderer with procedural terrain heights

## 🛠️ Features & Controls

- **2.5D Isometric & 2D Modes**: Switch viewpoints dynamically with the `📐 2.5D View` button
- **Terrain Relief Cycling**: Adjust vertical elevation accentuation (Low Relief, Gentle Hills, Standard 3D, Peaks)
- **Time Controls**: Pause (`Spacebar`), 0.5x, 1x, 2x, and 4x speed multipliers
- **Civilization Oversight**:
  - **Societies Panel**: Inspect emerging tribes, leaders, stockpiles, and cultural ethos
  - **Diplomacy & Warfare Panel**: Monitor Casus Belli, active wars, casualties, and bilateral relations (`W` key shortcut)
  - **Entity Inspector**: Live telemetry on citizen needs (Food, Water, Rest, Social), jobs, actions, and settlements
  - **World Chronicle**: Real-time ticker for births, deaths, building completions, and diplomatic milestones
- **Divine Powers Dock** (Keyboard shortcuts `1-0`):
  - Inspect (`1`), Citizen (`2`), Food (`3`), Water (`4`), Wood (`5`), Ore (`6`), Bounty
  - House (`7`), Workshop (`8`), Farm (`9`)
  - Provoke War, Muster Army, Enforce Peace
  - Bless (`0`), Smite, Remove
- **Persistence**: Save and load world state directly to browser `localStorage`
- **Default Warring Kingdoms Simulation**: Autonomous feuds, early casus belli friction, military mobilization, and border skirmishes are active by default and run continuously across emerging settlements.

## 🏃 Running and Testing Locally

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Run linting check
npm run lint

# Build production assets (outputs to dist/ with relative paths)
npm run build

# Run all 6 automated test suites
npm test
```

### Automated Test Suites

The test suite thoroughly verifies engine mechanics, economy, and deterministic reproducibility:
1. `tests/determinism.mjs`: Verifies identical tick-by-tick RNG and simulation state progression from identical seeds.
2. `tests/gossip.mjs`: Verifies full save/load round-trip determinism (fresh vs resumed simulation equivalence).
3. `tests/supplychain.mjs`: Validates 9-phase supply chain loop (harvesting, workshop queues, bread/plank distribution, trade routes, and caravans).
4. `tests/warvisible.mjs`: Validates grievance ledger decay, casus belli triggers, war declarations, and warband formation.
5. `tests/scenario_warring.mjs`: Validates default Warring Kingdoms initialization, accelerated rivalry, and combat events.
6. `tests/soak.mjs`: Long-run soak test (1000+ ticks) ensuring 0 crashes, 0 NaN anomalies, stable demographics, and active settlements.

## 🚀 GitHub Push & GitHub Pages Deployment

The repository is fully configured for automated GitHub CI and GitHub Pages deployment:

### Ready-to-Use GitHub Actions Workflows
- **`/.github/workflows/deploy.yml`**: Triggers on push to `main` or `master`. Checks out the code, installs dependencies, builds the production app with relative paths, and deploys directly to GitHub Pages using the official `actions/deploy-pages@v4`.
- **`/.github/workflows/ci.yml`**: Runs `npm run lint`, `npm run build`, and all 6 automated test suites on pull requests and pushes.

### Deploying to GitHub
1. Add your GitHub remote repository:
   ```bash
   git remote add origin https://github.com/<username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```
2. Enable GitHub Actions for Pages:
   - On GitHub, navigate to your repository **Settings** → **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Push to `main` and your game will be live at `https://<username>.github.io/<repo-name>/`.
