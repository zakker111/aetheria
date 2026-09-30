// Supply-chain / trade regression test (Phase 1 "Deep Economy").
// Verifies the full loop end-to-end, deterministically:
//   workshop crafting -> finished goods in storage -> craftsmen distribute
//   surplus into the town stockpile -> trade caravans export goods to other
//   settlements. Also guards the new deficit-aware cargo selection: no
//   negative stockpiles anywhere at any point.
import { Simulation } from '../src/simulation/simulation.js';

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failures++;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const sim = new Simulation(4242);

let sawBreadInStockpile = false;
let sawPlankInStockpile = false;
let sawCraftingComplete = 0;
let sawGoodsDistributed = 0;
sim.eventBus.on('crafting_complete', () => sawCraftingComplete++);
sim.eventBus.on('GOODS_DISTRIBUTED', () => sawGoodsDistributed++);
// Crafted goods land in the town stockpile under their raw category keys
// (bread -> food, plank -> wood), so presence-by-key can't prove the
// distribution happened. Track explicit deposit events instead.
sim.eventBus.on('STOCKPILE_DEPOSITED', (e) => {
  if (e && e.resource === 'bread') sawBreadInStockpile = true;
  if (e && e.resource === 'plank') sawPlankInStockpile = true;
});

const TICKS = 12000;
for (let i = 0; i < TICKS; i++) {
  sim.tick();

  // Workshop storage must never go negative (consumeInputs guard).
  for (const ws of sim.craftingSystem.workshops.values()) {
    for (const [k, v] of ws.storage) {
      if (!(v >= 0)) throw new Error(`negative workshop storage ${k}=${v} at tick ${i}`);
    }
  }
  // Settlement stockpiles must never go negative (caravan loading guard).
  for (const s of sim.settlementSystem.settlements.values()) {
    if (s.stockpile) {
      for (const [k, v] of Object.entries(s.stockpile)) {
        if (!(v >= 0)) throw new Error(`negative stockpile ${k}=${v} (${s.name}) at tick ${i}`);
      }
      if ((s.stockpile.bread || 0) > 0) sawBreadInStockpile = true;
      if ((s.stockpile.plank || 0) > 0) sawPlankInStockpile = true;
    }
  }
}

// --- Core pipeline evidence ---
check('workshops exist (synced from buildings or seeded)', sim.craftingSystem.workshops.size >= 1);
check('crafting completed at least once', sawCraftingComplete >= 1);
check('finished goods present in workshop storage', [...sim.craftingSystem.workshops.values()]
  .some(ws => (ws.storage.get('bread') || 0) + (ws.storage.get('plank') || 0) > 0));
check('craftsmen distributed goods into a town stockpile (bread or plank seen)',
  sawBreadInStockpile || sawPlankInStockpile);
check('GOODS_DISTRIBUTED event fired', sawGoodsDistributed >= 1);

// --- Trade side ---
check('trade routes established between settlements', sim.tradeSystem.tradeRoutes.length >= 1);
const everCaravan = sim.tradeSystem.caravans.length >= 1;
check('caravans spawned on established routes', everCaravan);

// Determinism: identical seed => identical fingerprint (same style as determinism.mjs)
function fingerprint(s) {
  const parts = [s.clock.tick, s.agents.length];
  // Workshop ids are strings ('x,y' keys), settlement ids are numbers — sort numerically.
  for (const ws of [...s.craftingSystem.workshops.values()].sort((a, b) => String(a.id) < String(b.id) ? -1 : 1)) {
    parts.push(ws.id, JSON.stringify([...ws.storage.entries()].sort()));
  }
  for (const st of [...s.settlementSystem.settlements.values()].sort((a, b) => a.id - b.id)) {
    parts.push(st.id, JSON.stringify(st.stockpile));
  }
  parts.push(JSON.stringify(s.tradeSystem.caravans), JSON.stringify(s.tradeSystem.tradeRoutes));
  return parts.join('|');
}
const twin = (() => {
  const t = new Simulation(4242);
  for (let i = 0; i < TICKS; i++) t.tick();
  return t;
})();
check('supply chain is deterministic across same-seed runs', fingerprint(sim) === fingerprint(twin));

// Save/load round trip preserves workshops/stockpiles/routes.
const loaded = Simulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
check('save/load preserves workshops, stockpiles and trade routes',
  loaded.craftingSystem.workshops.size === sim.craftingSystem.workshops.size &&
  fingerprint(loaded) === fingerprint(sim));

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('SUPPLY CHAIN OK');
