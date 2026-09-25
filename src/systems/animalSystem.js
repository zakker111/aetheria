// Animal System — wildlife ecology: deer, boars and wolves roam the wild
// biomes, graze/breed, flee danger, and can hunt (wolves) or be hunted by
// agents. Fully deterministic: every random draw comes from the seeded world
// RNG (sim.world.rng). Animals are plain data objects registered in the world
// entity registry so they are spatially queryable like other entities.

const SPECIES = {
  deer:   { speed: 0.42, herd: [3, 7], weight: 5, foodGain: 30, hostile: false },
  boar:   { speed: 0.30, herd: [1, 3], weight: 6, foodGain: 38, hostile: false },
  wolf:   { speed: 0.48, herd: [2, 4], weight: 8, foodGain: 0,  hostile: true }
};

export class AnimalSystem {
  constructor(sim = null) {
    this.sim = sim;
    this.animals = [];
    this.nextId = 1;
    // Population caps keep the ecology self-limiting and performance bounded.
    this.targetTotal = 90;
    this.maxTotal = 140;
  }

  _rng() {
    return this.sim?.world?.rng || { next: () => 0.5 };
  }

  _biomeAt(x, y) {
    const w = this.sim?.world;
    if (!w) return 'plains';
    return w.biome[Math.floor(y) * w.width + Math.floor(x)] || 'plains';
  }

  _spawnBiomesFor(species) {
    if (species === 'wolf') {
      return ['forest', 'jungle', 'highland', 'tundra', 'mountain', 'snow'];
    }
    return ['forest', 'jungle', 'grassland', 'plains', 'savanna'];
  }

  findSpawnTile(allowedBiomes) {
    const w = this.sim?.world;
    if (!w) return null;
    const rng = this._rng();
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = 2 + Math.floor(rng.next() * (w.width - 4));
      const y = 2 + Math.floor(rng.next() * (w.height - 4));
      const biome = w.biome[y * w.width + x];
      if (!allowedBiomes.includes(biome)) continue;
      if (!w.isWalkable(x, y)) continue;
      // Avoid spawning right on top of settlements (wildlife fears cities)
      let nearSettlement = false;
      for (const s of (this.sim.settlementSystem?.settlements?.values() || [])) {
        if (Math.hypot(s.center.x - x, s.center.y - y) < 10) { nearSettlement = true; break; }
      }
      if (nearSettlement) continue;
      return { x, y };
    }
    return null;
  }

  spawn(species, x, y) {
    const def = SPECIES[species];
    if (!def) return null;
    const rng = this._rng();
    const animal = {
      id: `a${this.nextId++}`,
      type: 'animal',
      species,
      x, y,
      alive: true,
      health: 100,
      age: 0,
      maxAge: 1200 + Math.floor(rng.next() * 800),
      speed: def.speed,
      breedCooldown: 200 + Math.floor(rng.next() * 200),
      wanderTicks: 0,
      fleeingTicks: 0,
      attackCooldown: 0
    };
    this.animals.push(animal);
    if (this.sim?.world) {
      this.sim.world.entityRegistry.set(animal.id, animal);
      this.sim.world.addToSpatialIndex(Math.floor(x), Math.floor(y), animal);
    }
    return animal;
  }

  initialPopulate() {
    const rng = this._rng();
    const plan = [
      ['deer', 26], ['boar', 12], ['wolf', 8]
    ];
    for (const [species, count] of plan) {
      const biomes = this._spawnBiomesFor(species);
      for (let i = 0; i < count; i++) {
        const tile = this.findSpawnTile(biomes);
        if (!tile) continue;
        const a = this.spawn(species, tile.x + (rng.next() - 0.5), tile.y + (rng.next() - 0.5));
        if (a) a.age = Math.floor(rng.next() * 300); // stagger maturity
      }
    }
  }

  removeAnimal(animal) {
    animal.alive = false;
    const w = this.sim?.world;
    if (w) {
      w.removeFromSpatialIndex(Math.floor(animal.x), Math.floor(animal.y), animal);
      w.entityRegistry.delete(animal.id);
    }
    const idx = this.animals.indexOf(animal);
    if (idx >= 0) this.animals.splice(idx, 1);
  }

  update(tick) {
    const sim = this.sim;
    const world = sim?.world;
    if (!world) return;
    const rng = this._rng();
    const agents = sim.agents || [];

    // --- Movement / behavior -------------------------------------------
    for (const a of [...this.animals]) {
      a.age++;
      if (a.breedCooldown > 0) a.breedCooldown--;
      if (a.attackCooldown > 0) a.attackCooldown--;

      // Old age death (wolves that live too long)
      if (a.age > a.maxAge) {
        this.removeAnimal(a);
        continue;
      }

      const def = SPECIES[a.species];

      // Danger check: nearby armed/hunting agents scare prey; wolves chase
      let threat = null;
      let nearestAgent = null;
      let nearestAgentD = Infinity;
      for (const ag of agents) {
        if (!ag.alive) continue;
        const d = Math.abs(ag.x - a.x) + Math.abs(ag.y - a.y);
        if (d < nearestAgentD) { nearestAgentD = d; nearestAgent = ag; }
        const scared = a.species !== 'wolf' && d < 6 &&
          (ag.job === 'hunter' || ag.currentAction?.type === 'hunt');
        if (scared) threat = ag;
      }
      // Prey also flees other loud things: fires
      if (!threat && a.species !== 'wolf' && world.isBurning(Math.floor(a.x), Math.floor(a.y))) {
        a.fleeingTicks = 30;
      }

      if (threat) {
        a.fleeingTicks = 25;
      }

      let nx = a.x, ny = a.y;
      if (a.fleeingTicks > 0) {
        a.fleeingTicks--;
        // Run away from last threat position (or current position drift)
        const ax = threat ? threat.x : a.x + (rng.next() - 0.5);
        const ay = threat ? threat.y : a.y + (rng.next() - 0.5);
        const dx = a.x - ax, dy = a.y - ay;
        const len = Math.hypot(dx, dy) || 1;
        nx = a.x + (dx / len) * a.speed * 2;
        ny = a.y + (dy / len) * a.speed * 2;
      } else if (def.hostile && tick % 2 === 0) {
        // Wolves hunt isolated agents or wounded animals
        let prey = null, preyD = 7;
        if (nearestAgent && nearestAgentD < preyD && (nearestAgent.lifeStage === 'child' || nearestAgent.health < 50)) {
          prey = nearestAgent; preyD = nearestAgentD;
        }
        for (const other of this.animals) {
          if (other === a || other.species === 'wolf') continue;
          const d = Math.hypot(other.x - a.x, other.y - a.y);
          if (d < preyD) { prey = other; preyD = d; }
        }
        if (prey && preyD < 1.2 && a.attackCooldown <= 0) {
          a.attackCooldown = 50;
          if (prey.type === 'agent') {
            if (prey.needs) prey.needs.health = Math.max(0, (prey.needs.health ?? 100) - 18);
            prey.health = Math.max(0, (prey.health ?? 100) - 18);
            prey.safety = undefined; // no-op guard
            if (prey.needs) prey.needs.safety = Math.max(0, (prey.needs.safety ?? 100) - 25);
            if (!prey.deathCause && prey.health <= 0) { prey.deathCause = 'mauled'; prey.alive = false; }
          } else if (prey.type === 'animal') {
            prey.health -= 60;
            if (prey.health <= 0) {
              this.removeAnimal(prey);
              this.sim.eventBus?.emit('ANIMAL_KILLED', { species: prey.species, x: prey.x, y: prey.y, by: 'wolf' });
            }
          }
        } else if (prey) {
          const dx = prey.x - a.x, dy = prey.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          nx = a.x + (dx / len) * a.speed;
          ny = a.y + (dy / len) * a.speed;
        } else {
          nx = a.x + (rng.next() - 0.5) * a.speed * 2;
          ny = a.y + (rng.next() - 0.5) * a.speed * 2;
        }
      } else {
        // Graze/wander with occasional directional persistence
        a.wanderTicks--;
        if (a.wanderTicks <= 0) {
          a.wanderTicks = 10 + Math.floor(rng.next() * 30);
          a.dirX = (rng.next() - 0.5);
          a.dirY = (rng.next() - 0.5);
        }
        nx = a.x + (a.dirX || 0) * a.speed + (rng.next() - 0.5) * 0.1;
        ny = a.y + (a.dirY || 0) * a.speed + (rng.next() - 0.5) * 0.1;
      }

      // Terrain constraints: stay in habitable biomes, avoid water/fire/buildings
      const tx = Math.floor(nx), ty = Math.floor(ny);
      const okBiome = this._spawnBiomesFor(a.species).includes(this._biomeAt(tx, ty));
      if (okBiome && world.isWalkable(tx, ty) && !world.isBurning(tx, ty)) {
        world.removeFromSpatialIndex(Math.floor(a.x), Math.floor(a.y), a);
        a.x = nx; a.y = ny;
        world.addToSpatialIndex(tx, ty, a);
      } else {
        a.wanderTicks = 0; // pick a new direction next tick
      }
    }

    // --- Breeding (herd species only, capped) --------------------------
    if (tick % 20 === 0 && this.animals.length < this.maxTotal) {
      for (const a of this.animals) {
        if (SPECIES[a.species].hostile) continue; // wolves breed rarely below
        if (a.age < 200 || a.breedCooldown > 0) continue;
        const mate = this.animals.find(o => o !== a && o.species === a.species &&
          o.age >= 200 && o.breedCooldown <= 0 &&
          Math.hypot(o.x - a.x, o.y - a.y) < 3);
        if (mate) {
          a.breedCooldown = mate.breedCooldown = 400;
          const baby = this.spawn(a.species, (a.x + mate.x) / 2, (a.y + mate.y) / 2);
          if (baby) baby.breedCooldown = 600;
          if (this.animals.length >= this.maxTotal) break;
        }
      }
    }

    // --- Natural growth toward target population -----------------------
    if (tick % 120 === 0) {
      const counts = { deer: 0, boar: 0, wolf: 0 };
      for (const a of this.animals) counts[a.species]++;
      for (const species of Object.keys(counts)) {
        const target = species === 'deer' ? 40 : species === 'boar' ? 18 : 10;
        if (counts[species] < target && this.animals.length < this.maxTotal) {
          const tile = this.findSpawnTile(this._spawnBiomesFor(species));
          if (tile) {
            const herd = SPECIES[species].herd;
            const n = Math.min(herd[0] + Math.floor(rng.next() * (herd[1] - herd[0] + 1)),
              this.maxTotal - this.animals.length);
            for (let i = 0; i < n; i++) {
              this.spawn(species, tile.x + (rng.next() - 0.5) * 3, tile.y + (rng.next() - 0.5) * 3);
            }
          }
        }
      }
    }
  }

  killAnimal(animal, byAgent = null) {
    if (!animal || animal.type !== 'animal') return null;
    const def = SPECIES[animal.species];
    this.removeAnimal(animal);
    this.sim?.eventBus?.emit('ANIMAL_KILLED', {
      species: animal.species, x: animal.x, y: animal.y,
      by: byAgent ? byAgent.id : null
    });
    return def;
  }

  serialize() {
    return {
      nextId: this.nextId,
      animals: this.animals.map(a => ({
        id: a.id, species: a.species, x: a.x, y: a.y,
        age: a.age, health: a.health, breedCooldown: a.breedCooldown,
        dirX: a.dirX || 0, dirY: a.dirY || 0,
        // Full internal timer state must survive save/load. These counters
        // branch on `<= 0` (fleeing, attacks) and gate RNG draws; resetting
        // them to 0 on load consumed extra random numbers on the first resumed
        // tick and desynced the whole world from an uninterrupted run.
        maxAge: a.maxAge ?? 1200,
        wanderTicks: a.wanderTicks || 0,
        fleeingTicks: a.fleeingTicks || 0,
        attackCooldown: a.attackCooldown || 0
      }))
    };
  }

  static deserialize(data, sim) {
    const system = new AnimalSystem(sim);
    if (!data) return system;
    system.nextId = data.nextId || 1;
    for (const ad of (data.animals || [])) {
      // Restore ALL timer state exactly as saved (serialize() persists
      // maxAge/wanderTicks/fleeingTicks/attackCooldown). Re-deriving or
      // zeroing them made the first resumed tick branch differently and
      // desynced the RNG stream from an uninterrupted run.
      const a = {
        ...ad,
        type: 'animal',
        alive: true,
        maxAge: ad.maxAge ?? 1200,
        speed: SPECIES[ad.species]?.speed || 0.3,
        wanderTicks: ad.wanderTicks || 0,
        fleeingTicks: ad.fleeingTicks || 0,
        attackCooldown: ad.attackCooldown || 0
      };
      system.animals.push(a);
      if (sim?.world) {
        sim.world.entityRegistry.set(a.id, a);
        sim.world.addToSpatialIndex(Math.floor(a.x), Math.floor(a.y), a);
      }
    }
    return system;
  }
}

export { SPECIES as ANIMAL_SPECIES };
