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
- **Starter Scenarios**: Launch with `?scenario=warring` for immediate border friction between hereditary rivals

## 🏃 Running the Application

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Build for production
npm run build

# Run simulation test suite
npm test
```
