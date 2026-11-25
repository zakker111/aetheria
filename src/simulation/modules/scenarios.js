import { Agent } from "../agent.js";
import { Building } from "../building.js";

// Step H: "Warring Kingdoms" starter scenario. Takes the towns founded at
// world init and makes them hereditary rivals: warlike cultures (raised
// belligerence, lowered cooperation) plus pre-seeded grievance feuds that
// resolve through the normal casus-belli pipeline within ~150 ticks —
// instantly watchable conflict without touching default-world behavior.
// Deterministic: no RNG draws; settlement ids are assigned in loop order.
export function applyWarringScenario(sim) {
  const settlements = [...sim.settlementSystem.settlements.values()]
    .sort((a, b) => a.id - b.id);
  for (const s of settlements) {
    const v = s.culture?.values;
    if (v) {
      v.belligerence = Math.min(0.9, (v.belligerence ?? 0.3) + 0.45);
      v.cooperation = Math.max(0.2, (v.cooperation ?? 0.8) - 0.4);
      s.culture.ethos = "Warring Kingdom";
    }
  }
  // Chain rivalries: town 1 vs 2, 2 vs 3, ... plus 1 vs last when possible.
  for (let i = 0; i + 1 < settlements.length; i++) {
    sim.diplomacySystem.seedFeud(settlements[i].id, settlements[i + 1].id, 100);
  }
  if (settlements.length >= 3) {
    sim.diplomacySystem.seedFeud(
      settlements[0].id, settlements[settlements.length - 1].id, 150);
  }
}

/**
 * "Modern & Nuclear Age" starter scenario for immediate late-era play & development.
 * Expands founding cities into fortified Era 6-7 powers with modern workshops, farms,
 * stockpiles, bastion walls, atomic warheads, and an active devastating Total War.
 */
export function applyModernNuclearScenario(sim) {
  const settlements = [...sim.settlementSystem.settlements.values()]
    .filter((s) => s && !s.ruined && s.center)
    .sort((a, b) => a.id - b.id);
  if (settlements.length === 0) return;

  const jobs = ["soldier", "soldier", "farmer", "miner", "lumberjack", "craftsman", "builder"];

  for (let idx = 0; idx < settlements.length; idx++) {
    const s = settlements[idx];
    const cx = Math.floor(s.center.x);
    const cy = Math.floor(s.center.y);

    // Expand population to ~18 adults per city
    const targetPop = 18;
    let attempts = 0;
    while ((s.agentIds?.size || 0) < targetPop && attempts < 140) {
      attempts++;
      const ax = cx + (sim._rng().next() - 0.5) * 12;
      const ay = cy + (sim._rng().next() - 0.5) * 12;
      const tx = Math.floor(ax);
      const ty = Math.floor(ay);
      if (tx < 3 || ty < 3 || tx >= sim.world.width - 3 || ty >= sim.world.height - 3) continue;
      if (!sim.world.isWalkable(tx, ty)) continue;
      const agent = new Agent(ax, ay, sim.idGen, null, sim.world.rng);
      agent.settlementId = s.id;
      agent.factionId = s.factionId ?? null;
      agent.age = 20 + ((agent.id * 7) % 18);
      agent.lifeStage = "adult";
      const job = jobs[(s.agentIds.size + idx) % jobs.length];
      agent.job = job;
      agent.jobTitle = job.charAt(0).toUpperCase() + job.slice(1);
      sim.addAgent(agent);
      sim.world.addToSpatialIndex(tx, ty, agent);
      s.agentIds.add(agent.id);
      sim.settlementSystem?.agentSettlementMap?.set(agent.id, s.id);
      sim.economySystem?.agentJobs?.set(agent.id, { job, salary: 16, satisfaction: 88, assignedAt: 0 });
      agent.addLifeEvent?.("ORIGIN", `Modern citizen of ${s.name}`, 0, "🏙️", true);
    }
    s.population = s.agentIds?.size || 0;

    // Seed modern civic, industrial & nuclear complexes PLUS surviving ancient Era 1-4 Heritage Landmarks
    // showing monumental architecture enduring from early civilization right into the Modern Era.
    const heritageOffsets = idx === 0
      ? [
          { dx: -5, dy: -4, type: "monument_pyramid", builtInEra: 2, customName: "Great Pyramidal Shrine", upgradeTo: 3 },
          { dx: 6, dy: -1, type: "monument_atomic_dome", builtInEra: 7, customName: "Orbital & Atomic Complex", upgradeTo: 2 },
        ]
      : idx === 1
      ? [
          { dx: -5, dy: 4, type: "monument_colosseum", builtInEra: 3, customName: "Colosseum of Champions", upgradeTo: 3 },
          { dx: 5, dy: 4, type: "monument_atomic_dome", builtInEra: 7, customName: "Orbital & Atomic Complex", upgradeTo: 1 },
        ]
      : [
          { dx: -5, dy: -3, type: "monument_cairn", builtInEra: 1, customName: "Stonehenge Hearth Circle", upgradeTo: 3 },
          { dx: 5, dy: -4, type: "monument_citadel", builtInEra: 4, customName: "Grand Imperial Citadel", upgradeTo: 2 },
          { dx: 5, dy: 3, type: "monument_monolith", builtInEra: 6, customName: "Tactical Sky-Spire Monolith", upgradeTo: 1 },
        ];
    const offsets = [
      { dx: -2, dy: -2, type: "workshop", upgradeTo: idx < 2 ? 3 : 2 },
      { dx: 3, dy: -2, type: "farm", upgradeTo: 2 },
      { dx: -3, dy: 0, type: "house", upgradeTo: idx < 2 ? 3 : 2 },
      { dx: 3, dy: 1, type: "house", upgradeTo: 2 },
      { dx: 0, dy: -3, type: "granary", upgradeTo: 2 },
      { dx: 0, dy: 3, type: "barracks", upgradeTo: 2 },
      { dx: -2, dy: 2, type: "factory", upgradeTo: idx < 2 ? 2 : 1 },
      { dx: 2, dy: 3, type: "market", upgradeTo: 2 },
      { dx: 5, dy: -2, type: "windmill", upgradeTo: 2 },
      { dx: -4, dy: 2, type: "inn", upgradeTo: 2 },
      { dx: 2, dy: -4, type: "library", upgradeTo: idx < 2 ? 3 : 2 },
      { dx: -2, dy: -4, type: "apothecary", upgradeTo: 2 },
      { dx: 4, dy: 0, type: "bank", upgradeTo: 2 },
      { dx: -4, dy: 4, type: "radar_station", upgradeTo: 1 },
      ...(idx < 2 ? [
        { dx: 3, dy: -4, type: "research_lab", upgradeTo: 2 },
        { dx: -4, dy: -2, type: "nuclear_plant", upgradeTo: 1 },
        { dx: 4, dy: 3, type: "missile_silo", upgradeTo: 1 },
      ] : []),
      ...heritageOffsets,
    ];
    for (const off of offsets) {
      const bx = cx + off.dx;
      const by = cy + off.dy;
      if (bx < 3 || by < 3 || bx >= sim.world.width - 3 || by >= sim.world.height - 3) continue;
      if (!sim.world.isWalkable(bx, by)) continue;
      if (sim.buildings.some((b) => b && !b.isRuined && Math.floor(b.x) === bx && Math.floor(b.y) === by)) continue;
      const b = new Building(bx, by, off.type, sim.idGen, s.id, s.factionId ?? null);
      b.complete = true;
      b.isComplete = true;
      b.constructionProgress = 100;
      if (off.builtInEra != null) b.builtInEra = off.builtInEra;
      if (off.customName) b.customName = off.customName;
      if (off.upgradeTo && off.upgradeTo > 1) {
        for (let lv = 1; lv < off.upgradeTo; lv++) {
          b.applyUpgrade?.(0);
        }
      }
      sim.buildings.push(b);
      sim.world.addToSpatialIndex(bx, by, b);
      sim.world.entityRegistry?.set(b.id, b);
      if (!s.buildings) s.buildings = [];
      s.buildings.push(b);
      if (b.isHeritage || String(b.buildingType || "").startsWith("monument_")) {
        sim.civilizationAgeSystem?.registerHeritageMonument?.(s.id, b, b.builtInEra, null, 0);
      }
    }

    // Rich industrial & military stockpiles
    s.stockpile = {
      ...(s.stockpile || {}),
      food: 165,
      wood: 145,
      ore: 120,
      weapon_sword: 4,
      weapon_bow: 6,
      armor_shield: 4,
    };

    // Militarized modern culture
    if (s.culture?.values) {
      s.culture.values.belligerence = idx < 2 ? 0.84 : 0.72;
      s.culture.values.cooperation = 0.25;
      s.culture.ethos = idx < 2 ? "Nuclear Superpower" : "Modern Republic";
    }

    // Advance first two powers into Era 7 (Nuclear Age) & others into Era 6 (Modern Tactical)
    const targetEra = idx < 2 ? 7 : 6;
    sim.civilizationAgeSystem?.setSettlementAge?.(s.id, targetEra, true);
    const prog = sim.civilizationAgeSystem?.getNuclearProgram?.(s.id);
    if (prog) {
      prog.unlocked = true;
      prog.warheads = idx < 2 ? 2 : 1;
      prog.progress = 55;
      prog.doctrine = "deterrence";
    }

    // Fortify perimeter with Reinforced Bastion Walls & Corner Watchtowers
    sim.fortificationSystem?.fortifySettlement?.(s.id, { tick: 0 });
  }

  // Seed geopolitical web: Conventional Combined-Arms Total War (Tanks, Planes, Artillery), Alliance Pact, and Sanctions
  if (settlements.length >= 2 && sim.diplomacySystem) {
    if (settlements.length >= 3) {
      // Forge an active Defensive Alliance & impose trade sanctions so diplomacy immediately has alliances, embargoes, and wars
      sim.diplomacySystem.formAlliance(settlements[1].id, settlements[2].id, 0);
      sim.diplomacySystem.imposeSanctions(
        settlements[0].id,
        settlements[2].id,
        "Strategic containment & atomic non-proliferation embargo",
        0
      );
      sim.diplomacySystem.seedFeud(settlements[0].id, settlements[2].id, 80);
    }
    sim.diplomacySystem.seedFeud(settlements[0].id, settlements[1].id, 0);
    sim.diplomacySystem.declareWar(
      settlements[0].id,
      settlements[1].id,
      "Mechanized Total War — Armored & Air Offensive",
      0,
      {
        totalWar: true,
        why: `${settlements[0].name} and ${settlements[1].name} mobilized tanks, strike aircraft, and rocket artillery while keeping atomic weapons in last-resort reserve.`,
        drivers: ["Armored & Air Divisions", "Conventional Total War", "Atomic Last-Resort Deterrence"],
        skipAllyCall: true,
      }
    );
  }
}
