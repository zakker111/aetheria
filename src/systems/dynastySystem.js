/**
 * Dynasty System
 * Manages noble houses, monarchies, hereditary succession laws,
 * royal genealogy trees, legitimacy, and diplomatic inter-dynastic marriages.
 */

export class DynastySystem {
  constructor(simulation) {
    this.sim = simulation;
    // Map of dynastyId -> Dynasty
    this.dynasties = new Map();
    // Map of settlementId -> dynastyId
    this.settlementDynastyMap = new Map();
    // Map of agentId -> dynastyId
    this.agentDynastyMap = new Map();
    this.nextDynastyId = 1;
    this.lastUpdateTick = -999;

    this.houseMottos = [
      "Steadfast & Unbroken",
      "From Fire We Rise",
      "Iron in the Blood",
      "Guardians of the Dawn",
      "Honor Above Glory",
      "Roots Deep as the Mountain",
      "Swift as the Winter Wind",
      "Through Shadow We Endure",
      "By Stone & Blood",
      "Eternal as the Sun"
    ];

    this.houseSigils = ["🦁", "🦅", "🐉", "🐺", "👑", "🛡️", "⚔️", "🌲", "🔥", "⚡"];
  }

  /**
   * Initializes or gets the dynasty ruling a settlement.
   */
  ensureSettlementDynasty(settlement) {
    if (!settlement) return null;
    if (this.settlementDynastyMap.has(settlement.id)) {
      return this.dynasties.get(this.settlementDynastyMap.get(settlement.id));
    }

    // Find the current leader or elder of the settlement
    let founder = null;
    if (settlement.leadership) {
      founder = this.sim.agents.find(a => a.name === settlement.leadership && a.alive && a.settlementId === settlement.id && !this.agentDynastyMap.has(a.id));
    }
    if (!founder && settlement.agentIds && settlement.agentIds.size > 0) {
      for (const id of settlement.agentIds) {
        const a = this.sim._agentById(id);
        if (a && a.alive && a.settlementId === settlement.id && !this.agentDynastyMap.has(a.id)) {
          if (!founder || (a.age || 20) > (founder.age || 20)) {
            founder = a;
          }
        }
      }
    }
    if (!founder) return null;

    const dynastyId = this.nextDynastyId++;
    const sigilIndex = (dynastyId - 1) % this.houseSigils.length;
    const mottoIndex = (dynastyId - 1) % this.houseMottos.length;
    const houseName = `House of ${founder.name}`;

    const title = (settlement.population || 1) >= 15 ? "King" : (settlement.population || 1) >= 8 ? "High Chieftain" : "Lord Elder";

    const dynasty = {
      id: dynastyId,
      name: houseName,
      settlementId: settlement.id,
      settlementName: settlement.name,
      coatOfArms: {
        symbol: this.houseSigils[sigilIndex],
        bannerColor: settlement.bannerColor || "#38bdf8",
        pattern: "quartered"
      },
      motto: this.houseMottos[mottoIndex],
      founderId: founder.id,
      founderName: founder.name,
      monarchId: founder.id,
      monarchName: founder.name,
      monarchTitle: title,
      consortId: null,
      consortName: null,
      heirId: null,
      heirName: null,
      legitimacy: 85,
      prestige: 100,
      successionLaw: "primogeniture", // primogeniture | elective
      foundedTick: this.sim?.clock?.tick || 0,
      members: [founder.id],
      lineage: [
        {
          id: founder.id,
          name: founder.name,
          gender: founder.gender || "male",
          generation: 1,
          parents: [],
          spouseId: null,
          birthTick: founder.birthTick ?? 0,
          deathTick: null,
          alive: true,
          causeOfDeath: null,
          reignStart: this.sim?.clock?.tick || 0,
          reignEnd: null,
          title: `${title} ${founder.name} I`
        }
      ],
      marriages: []
    };

    founder.isMonarch = true;
    founder.dynastyId = dynastyId;
    this.dynasties.set(dynastyId, dynasty);
    this.settlementDynastyMap.set(settlement.id, dynastyId);
    this.agentDynastyMap.set(founder.id, dynastyId);

    // Look for initial spouse or children
    this.linkSpouseAndChildren(dynasty, founder);

    if (this.sim?.eventBus) {
      this.sim.eventBus.emit("DYNASTY_FOUNDED", {
        dynastyId,
        houseName,
        monarchName: founder.name,
        settlementName: settlement.name
      });
    }

    return dynasty;
  }

  linkSpouseAndChildren(dynasty, monarch) {
    if (!monarch) return;
    // Find spouse in relationships
    if (monarch.relationships) {
      for (const [otherId, rel] of monarch.relationships.entries()) {
        if (rel.type === "spouse" || rel.score >= 80) {
          const spouse = this.sim._agentById(otherId);
          if (spouse && spouse.alive && !dynasty.consortId) {
            dynasty.consortId = spouse.id;
            dynasty.consortName = spouse.name;
            if (!dynasty.members.includes(spouse.id)) {
              dynasty.members.push(spouse.id);
              this.agentDynastyMap.set(spouse.id, dynasty.id);
            }
            if (!dynasty.lineage.some(n => n.id === spouse.id)) {
              dynasty.lineage.push({
                id: spouse.id,
                name: spouse.name,
                gender: spouse.gender || "female",
                generation: 1,
                parents: [],
                spouseId: monarch.id,
                birthTick: spouse.birthTick ?? 0,
                deathTick: null,
                alive: true,
                causeOfDeath: null,
                reignStart: null,
                reignEnd: null,
                title: `Consort ${spouse.name}`
              });
            }
            const monarchNode = dynasty.lineage.find(n => n.id === monarch.id);
            if (monarchNode) monarchNode.spouseId = spouse.id;
            break;
          }
        }
      }
    }

    // Designate heir
    this.updateHeir(dynasty);
  }

  updateHeir(dynasty) {
    if (!dynasty || !dynasty.monarchId) return;
    const monarch = this.sim._agentById(dynasty.monarchId);
    if (!monarch) return;

    const children = [];
    for (const node of dynasty.lineage) {
      if (node.alive && node.parents.includes(monarch.id)) {
        const agent = this.sim._agentById(node.id);
        if (agent && agent.alive) children.push(agent);
      }
    }

    // Eldest living child first
    if (children.length > 0) {
      children.sort((a, b) => (b.age || 0) - (a.age || 0));
      dynasty.heirId = children[0].id;
      dynasty.heirName = children[0].name;
      return;
    }

    // If no direct children, pick closest younger living noble
    for (const memberId of dynasty.members) {
      if (memberId === dynasty.monarchId || memberId === dynasty.consortId) continue;
      const m = this.sim._agentById(memberId);
      if (m && m.alive) {
        dynasty.heirId = m.id;
        dynasty.heirName = m.name;
        return;
      }
    }

    dynasty.heirId = null;
    dynasty.heirName = null;
  }

  /**
   * Called when a birth occurs in the simulation.
   */
  onAgentBorn(child, parent1, parent2) {
    if (!child) return;
    let targetDynasty = null;
    let royalParent = null;

    if (parent1 && this.agentDynastyMap.has(parent1.id)) {
      targetDynasty = this.dynasties.get(this.agentDynastyMap.get(parent1.id));
      royalParent = parent1;
    } else if (parent2 && this.agentDynastyMap.has(parent2.id)) {
      targetDynasty = this.dynasties.get(this.agentDynastyMap.get(parent2.id));
      royalParent = parent2;
    }

    if (!targetDynasty) return;

    // Add child to dynasty
    if (!targetDynasty.members.includes(child.id)) {
      targetDynasty.members.push(child.id);
    }
    this.agentDynastyMap.set(child.id, targetDynasty.id);
    child.dynastyId = targetDynasty.id;

    const parentNode = targetDynasty.lineage.find(n => n.id === royalParent.id);
    const gen = parentNode ? parentNode.generation + 1 : 2;

    targetDynasty.lineage.push({
      id: child.id,
      name: child.name,
      gender: child.gender || "neutral",
      generation: gen,
      parents: [parent1?.id, parent2?.id].filter(Boolean),
      spouseId: null,
      birthTick: this.sim?.clock?.tick || 0,
      deathTick: null,
      alive: true,
      causeOfDeath: null,
      reignStart: null,
      reignEnd: null,
      title: `Prince/Princess ${child.name}`
    });

    // Update heir if current monarch has none
    this.updateHeir(targetDynasty);

    if (this.sim?.eventBus) {
      this.sim.eventBus.emit("ROYAL_HEIR_BORN", {
        childName: child.name,
        dynastyName: targetDynasty.name,
        settlementId: targetDynasty.settlementId
      });
    }
  }

  /**
   * Called when an agent dies.
   */
  onAgentDied(agent, cause = "natural") {
    if (!agent) return;
    const dynastyId = this.agentDynastyMap.get(agent.id);
    if (!dynastyId) return;

    const dynasty = this.dynasties.get(dynastyId);
    if (!dynasty) return;

    const node = dynasty.lineage.find(n => n.id === agent.id);
    if (node) {
      node.alive = false;
      node.deathTick = this.sim?.clock?.tick || 0;
      node.causeOfDeath = cause;
      if (node.reignStart && !node.reignEnd) {
        node.reignEnd = node.deathTick;
      }
    }

    // Was this agent the reigning monarch?
    if (dynasty.monarchId === agent.id) {
      this.handleMonarchDeath(dynasty, agent, cause);
    } else if (dynasty.heirId === agent.id) {
      // Re-evaluate heir
      this.updateHeir(dynasty);
    }
  }

  /**
   * Successor ascends to throne or succession crisis occurs.
   */
  handleMonarchDeath(dynasty, oldMonarch, cause) {
    const tick = this.sim?.clock?.tick || 0;
    let successor = null;

    // 1. Check designated heir
    if (dynasty.heirId) {
      const h = this.sim._agentById(dynasty.heirId);
      if (h && h.alive) successor = h;
    }

    // 2. Primogeniture fallback: living descendants
    if (!successor) {
      const livingLineage = dynasty.lineage.filter(n => n.alive && n.id !== oldMonarch.id);
      for (const node of livingLineage) {
        const candidate = this.sim._agentById(node.id);
        if (candidate && candidate.alive) {
          successor = candidate;
          break;
        }
      }
    }

    // 3. Elective fallback: pick best champion/elder in the settlement
    if (!successor) {
      const settlement = this.sim.settlementSystem?.settlements.get(dynasty.settlementId);
      if (settlement && settlement.agentIds) {
        let bestScore = -1;
        for (const aid of settlement.agentIds) {
          const a = this.sim._agentById(aid);
          if (a && a.alive && a.id !== oldMonarch.id) {
            const score = (a.combat?.level || 1) * 2 + (a.age || 20);
            if (score > bestScore) {
              bestScore = score;
              successor = a;
            }
          }
        }
      }
    }

    if (successor) {
      dynasty.monarchId = successor.id;
      dynasty.monarchName = successor.name;
      successor.isMonarch = true;

      const settlement = this.sim.settlementSystem?.settlements.get(dynasty.settlementId);
      const title = (settlement?.population || 1) >= 15 ? "King" : (settlement?.population || 1) >= 8 ? "High Chieftain" : "Lord Elder";
      dynasty.monarchTitle = title;

      // Update or add lineage node
      let node = dynasty.lineage.find(n => n.id === successor.id);
      if (!node) {
        node = {
          id: successor.id,
          name: successor.name,
          gender: successor.gender || "male",
          generation: 2,
          parents: [],
          spouseId: null,
          birthTick: successor.birthTick ?? 0,
          deathTick: null,
          alive: true,
          causeOfDeath: null,
          reignStart: tick,
          reignEnd: null,
          title: `${title} ${successor.name}`
        };
        dynasty.lineage.push(node);
        if (!dynasty.members.includes(successor.id)) {
          dynasty.members.push(successor.id);
        }
        this.agentDynastyMap.set(successor.id, dynasty.id);
      } else {
        node.reignStart = tick;
        node.title = `${title} ${successor.name}`;
      }

      // Succession legitimacy fluctuation
      dynasty.legitimacy = Math.max(30, Math.min(100, dynasty.legitimacy + 5));
      dynasty.prestige += 15;

      this.updateHeir(dynasty);

      if (this.sim?.eventBus) {
        this.sim.eventBus.emit("CORONATION", {
          dynastyId: dynasty.id,
          dynastyName: dynasty.name,
          newMonarchId: successor.id,
          newMonarchName: successor.name,
          title,
          settlementId: dynasty.settlementId
        });
      }

      if (this.sim?.chronicleSystem?.addEntry) {
        this.sim.chronicleSystem.addEntry(
          "CORONATION",
          `👑 ${oldMonarch.name} has died (${cause}). All hail ${title} ${successor.name} of ${dynasty.name}!`
        );
      }
    } else {
      // Dynasty collapsed
      dynasty.monarchId = null;
      dynasty.monarchName = "Interregnum";
      dynasty.legitimacy = 10;
      if (this.sim?.chronicleSystem?.addEntry) {
        this.sim.chronicleSystem.addEntry(
          "DYNASTY_CRISIS",
          `⚠️ ${dynasty.name} faces an Interregnum! No living heir to claim the crown.`
        );
      }
    }
  }

  /**
   * Arranges a royal marriage between two noble houses.
   */
  arrangeRoyalMarriage(dynastyAId, dynastyBId, agentAId = null, agentBId = null) {
    const dynA = this.dynasties.get(dynastyAId);
    const dynB = this.dynasties.get(dynastyBId);
    if (!dynA || !dynB || dynA.id === dynB.id) return null;

    let agentA = agentAId ? this.sim._agentById(agentAId) : null;
    let agentB = agentBId ? this.sim._agentById(agentBId) : null;

    if (!agentA) {
      for (const id of dynA.members) {
        const a = this.sim._agentById(id);
        if (a && a.alive && (!a.relationships || !a.relationships.has("spouse"))) {
          agentA = a;
          break;
        }
      }
    }
    if (!agentB) {
      for (const id of dynB.members) {
        const b = this.sim._agentById(id);
        if (b && b.alive && (!b.relationships || !b.relationships.has("spouse")) && b.id !== agentA?.id) {
          agentB = b;
          break;
        }
      }
    }

    if (!agentA || !agentB) return null;

    const tick = this.sim?.clock?.tick || 0;
    const pactDuration = 600;

    const marriageRecord = {
      dynastyAId: dynA.id,
      dynastyBId: dynB.id,
      agentAId: agentA.id,
      agentAName: agentA.name,
      agentBId: agentB.id,
      agentBName: agentB.name,
      tick,
      nonAggressionUntil: tick + pactDuration
    };

    dynA.marriages.push(marriageRecord);
    dynB.marriages.push(marriageRecord);

    // Couple bonds
    if (!agentA.relationships) agentA.relationships = new Map();
    if (!agentB.relationships) agentB.relationships = new Map();
    agentA.relationships.set(agentB.id, { type: "spouse", score: 95 });
    agentB.relationships.set(agentA.id, { type: "spouse", score: 95 });

    // Update lineage nodes
    const nodeA = dynA.lineage.find(n => n.id === agentA.id);
    const nodeB = dynB.lineage.find(n => n.id === agentB.id);
    if (nodeA) nodeA.spouseId = agentB.id;
    if (nodeB) nodeB.spouseId = agentA.id;

    // Diplomatic pact in diplomacy system
    if (this.sim?.diplomacySystem) {
      const rel = this.sim.diplomacySystem.getRelation(dynA.settlementId, dynB.settlementId);
      if (rel) {
        rel.score = Math.min(100, rel.score + 35);
        if (rel.status === "war" || rel.status === "tension") {
          rel.status = "peace";
        }
      }
      this.sim.diplomacySystem.treaties.push({
        id: this.sim.diplomacySystem.nextTreatyId++,
        type: "Royal Marriage & Non-Aggression",
        settlements: [dynA.settlementId, dynB.settlementId],
        duration: pactDuration,
        startTick: tick,
        terms: `Royal marriage between ${agentA.name} (${dynA.name}) and ${agentB.name} (${dynB.name}).`
      });
    }

    if (this.sim?.eventBus) {
      this.sim.eventBus.emit("ROYAL_MARRIAGE", {
        dynastyAName: dynA.name,
        dynastyBName: dynB.name,
        agentAName: agentA.name,
        agentBName: agentB.name
      });
    }

    if (this.sim?.chronicleSystem?.addEntry) {
      this.sim.chronicleSystem.addEntry(
        "ROYAL_MARRIAGE",
        `💍 Royal Wedding! ${agentA.name} of ${dynA.name} wed ${agentB.name} of ${dynB.name}, sealing a solemn non-aggression alliance.`
      );
    }

    return marriageRecord;
  }

  update(tick) {
    if (tick - this.lastUpdateTick < 30) return;
    this.lastUpdateTick = tick;

    // Ensure all living settlements have active dynasties
    const settlements = this.sim.settlementSystem?.settlements;
    if (settlements) {
      for (const s of settlements.values()) {
        if (!s || s.ruined) continue;
        this.ensureSettlementDynasty(s);
      }
    }

    // Verify living monarchs
    for (const dynasty of this.dynasties.values()) {
      if (dynasty.monarchId) {
        const monarch = this.sim._agentById(dynasty.monarchId);
        if (!monarch || !monarch.alive) {
          this.handleMonarchDeath(dynasty, { id: dynasty.monarchId, name: dynasty.monarchName }, "natural causes");
        }
      }

      // Prestige growth from longevity & settlement tier
      const settlement = settlements?.get(dynasty.settlementId);
      if (settlement && !settlement.ruined) {
        dynasty.prestige += 0.05;
      }
    }
  }

  serialize() {
    return {
      nextDynastyId: this.nextDynastyId,
      lastUpdateTick: this.lastUpdateTick,
      dynasties: Array.from(this.dynasties.entries()).map(([k, d]) => [
        k,
        {
          ...d,
          members: Array.from(d.members || [])
        }
      ]),
      settlementDynastyMap: Array.from(this.settlementDynastyMap.entries()),
      agentDynastyMap: Array.from(this.agentDynastyMap.entries())
    };
  }

  static deserialize(data, sim) {
    const system = new DynastySystem(sim);
    if (!data) return system;

    system.nextDynastyId = data.nextDynastyId || 1;
    system.lastUpdateTick = data.lastUpdateTick || 0;

    if (data.dynasties) {
      for (const [k, d] of data.dynasties) {
        system.dynasties.set(k, {
          ...d,
          members: d.members || []
        });
      }
    }
    if (data.settlementDynastyMap) {
      system.settlementDynastyMap = new Map(data.settlementDynastyMap);
    }
    if (data.agentDynastyMap) {
      system.agentDynastyMap = new Map(data.agentDynastyMap);
    }

    // Restore isMonarch flag on agents
    for (const d of system.dynasties.values()) {
      if (d.monarchId && sim?._agentById) {
        const monarch = sim._agentById(d.monarchId);
        if (monarch) monarch.isMonarch = true;
      }
    }

    return system;
  }
}
