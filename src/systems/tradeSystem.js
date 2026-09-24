/**
 * Trade System (Phase 1 Completion)
 * Handles automated trade caravans between settlements to balance resources.
 */

import { EventBus } from '../core/eventBus.js';
import { RNG } from '../core/rng.js';

export class TradeSystem {
    constructor(simulation) {
        this.sim = simulation;
        this.caravans = []; // Active trade caravans
        this.tradeRoutes = []; // Established routes
        this.eventBus = EventBus.getInstance();
        
        // Configuration
        this.CARAVAN_SIZE = 3; // Agents per caravan
        this.TRADE_CHECK_INTERVAL = 2000; // Ticks between trade checks
        this.MIN_SURPLUS = 50; // Minimum surplus to trigger trade
        this.MIN_DEFICIT = 10; // Minimum deficit to request trade
        
        this.lastCheckTick = 0;
    }

    getAgent(agentId) {
        if (this.sim.agents) {
            return this.sim.agents.find(a => a.id === agentId);
        }
        if (this.sim.entities?.agents?.get) {
            return this.sim.entities.agents.get(agentId);
        }
        return null;
    }

    update() {
        const currentTick = this.sim.clock.tick;
        
        if (currentTick - this.lastCheckTick >= this.TRADE_CHECK_INTERVAL) {
            this.lastCheckTick = currentTick;
            this.analyzeMarket();
            this.updateCaravans();
        }
    }

    /**
     * Analyze settlement stockpiles to find trade opportunities
     */
    analyzeMarket() {
        const settlements = Array.from(this.sim.settlementSystem.settlements.values());
        if (settlements.length < 2) return;

        // Calculate surplus/deficit for each settlement
        settlements.forEach(settlement => {
            settlement.tradeProfile = {
                surplus: [],
                deficit: []
            };

            const stockpile = settlement.stockpile || {};
            // Check key resources
            ['food', 'wood', 'stone', 'ore'].forEach(res => {
                const amount = stockpile[res] || 0;
                const consumption = this.sim.settlementSystem.getConsumptionRate(settlement.id, res);
                
                if (amount > this.MIN_SURPLUS && (!consumption || amount > consumption * 5)) {
                    settlement.tradeProfile.surplus.push({ resource: res, amount });
                } else if (amount < this.MIN_DEFICIT) {
                    settlement.tradeProfile.deficit.push({ resource: res, needed: this.MIN_DEFICIT - amount });
                }
            });
        });

        // Establish routes between complementary settlements
        this.establishRoutes(settlements);
    }

    establishRoutes(settlements) {
        for (let i = 0; i < settlements.length; i++) {
            for (let j = i + 1; j < settlements.length; j++) {
                const s1 = settlements[i];
                const s2 = settlements[j];

                // Diplomatic gate: trade only flows in friendly relations.
                // At-war pairs never route; hostile (low-score) pairs are blocked too.
                const diplomacy = this.sim.diplomacySystem;
                if (diplomacy) {
                    try {
                        const rel = diplomacy.getRelation(s1.id, s2.id);
                        if (!rel || rel.status === 'war') continue;
                        if (rel.score < 40) continue; // not friendly enough for commerce
                    } catch { continue; }
                }

                // Check if s1 has what s2 needs and vice versa
                const s1HasForS2 = s1.tradeProfile.surplus.find(item => 
                    s2.tradeProfile.deficit.some(d => d.resource === item.resource)
                );
                const s2HasForS1 = s2.tradeProfile.surplus.find(item => 
                    s1.tradeProfile.deficit.some(d => d.resource === item.resource)
                );

                if ((s1HasForS2 || s2HasForS1) && !this.routeExists(s1.id, s2.id)) {
                    this.createTradeRoute(s1, s2);
                }
            }
        }
    }

    routeExists(id1, id2) {
        return this.tradeRoutes.some(r => 
            (r.from === id1 && r.to === id2) || (r.from === id2 && r.to === id1)
        );
    }

    createTradeRoute(s1, s2) {
        const route = {
            id: `route_${s1.id}_${s2.id}`,
            from: s1.id,
            to: s2.id,
            distance: this.calculateDistance(s1, s2),
            active: true
        };
        this.tradeRoutes.push(route);
        
        this.eventBus.emit('trade:route_established', { 
            from: s1.name, 
            to: s2.name, 
            distance: route.distance 
        });

        // Spawn initial caravan if resources allow
        this.spawnCaravan(route);
    }

    spawnCaravan(route) {
        const fromSettlement = this.sim.settlementSystem.settlements.get(route.from);
        if (!fromSettlement) return;

        // Verify surplus exists
        const itemToTrade = fromSettlement.tradeProfile.surplus[0];
        if (!itemToTrade || fromSettlement.stockpile[itemToTrade.resource] < itemToTrade.amount / 2) {
            return; // Not enough to trade yet
        }

        // Spawn agents as merchants/guards
        const caravanAgents = [];
        for (let i = 0; i < this.CARAVAN_SIZE; i++) {
            const agent = this.sim.spawnAgent(
                fromSettlement.center.x + (RNG.random() - 0.5) * 10,
                fromSettlement.center.y + (RNG.random() - 0.5) * 10,
                fromSettlement.factionId
            );
            if (agent) {
                agent.role = 'merchant';
                agent.cargo = { resource: itemToTrade.resource, amount: 0 };
                agent.targetRoute = route.id;
                caravanAgents.push(agent.id);
            }
        }

        if (caravanAgents.length > 0) {
            this.caravans.push({
                id: `caravan_${this.caravanSeq = (this.caravanSeq || 0) + 1}`,
                routeId: route.id,
                agents: caravanAgents,
                progress: 0,
                tradeTicksLeft: 0,
                state: 'traveling_to_market' // traveling_to_market, trading, returning
            });
            
            this.eventBus.emit('trade:caravan_spawned', { route: route.id, size: caravanAgents.length });
        }
    }

    updateCaravans() {
        for (let i = this.caravans.length - 1; i >= 0; i--) {
            const caravan = this.caravans[i];
            const route = this.tradeRoutes.find(r => r.id === caravan.routeId);
            
            if (!route) {
                this.dissolveCaravan(caravan);
                continue;
            }

            const fromSettlement = this.sim.settlementSystem.settlements.get(route.from);
            const toSettlement = this.sim.settlementSystem.settlements.get(route.to);

            if (!fromSettlement || !toSettlement) {
                this.dissolveCaravan(caravan);
                continue;
            }

            // Move caravan logic (simplified pathfinding along vector)
            const speed = 0.5;
            const dx = toSettlement.center.x - fromSettlement.center.x;
            const dy = toSettlement.center.y - fromSettlement.center.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Update progress (0 to 1)
            if (caravan.state === 'traveling_to_market') {
                caravan.progress += speed / dist;
                if (caravan.progress >= 1) {
                    this.executeTrade(caravan, fromSettlement, toSettlement);
                }
            } else if (caravan.state === 'trading') {
                if (--caravan.tradeTicksLeft <= 0) {
                    caravan.state = 'returning';
                    caravan.progress = 1;
                    const trader = this.getAgent(caravan.agents[0]);
                    if (trader && trader.cargo && trader.cargo.amount > 0) {
                        const cargoResource = trader.cargo.resource;
                        const cargoAmount = trader.cargo.amount;
                        to.stockpile[cargoResource] = (to.stockpile[cargoResource] || 0) + cargoAmount;
                        trader.cargo.amount = 0;
                        this.eventBus.emit('trade:completed', {
                            from: from.name,
                            to: to.name,
                            resource: cargoResource,
                            amount: cargoAmount
                        });
                    }
                }
            } else if (caravan.state === 'returning') {
                caravan.progress -= speed / dist;
                if (caravan.progress <= 0) {
                    this.completeTrade(caravan, fromSettlement, toSettlement);
                    this.caravans.splice(i, 1); // Remove completed caravan
                }
            }

            // Update agent positions visually (keep spatial index consistent)
            caravan.agents.forEach(agentId => {
                const agent = this.getAgent(agentId);
                if (agent) {
                    const curX = fromSettlement.center.x + (dx * caravan.progress);
                    const curY = fromSettlement.center.y + (dy * caravan.progress);
                    const oldTx = Math.floor(agent.x), oldTy = Math.floor(agent.y);
                    const newTx = Math.floor(curX), newTy = Math.floor(curY);
                    if (oldTx !== newTx || oldTy !== newTy) {
                        this.sim.world.removeFromSpatialIndex(oldTx, oldTy, agent);
                        this.sim.world.addToSpatialIndex(newTx, newTy, agent);
                    }
                    agent.x = curX;
                    agent.y = curY;
                    agent.state = 'trading'; // Override state temporarily
                }
            });
        }
    }

    executeTrade(caravan, from, to) {
        caravan.state = 'trading';
        
        // Identify goods
        const agent = this.getAgent(caravan.agents[0]);
        if (!agent || !agent.cargo) {
            // Load goods if not loaded
            const item = from.tradeProfile.surplus[0];
            if (item) {
                const amount = Math.min(20, from.stockpile[item.resource]);
                from.stockpile[item.resource] -= amount;
                if (agent && agent.cargo) {
                    agent.cargo.resource = item.resource;
                    agent.cargo.amount = amount;
                }
            }
        }

        // Trade pause modeled in sim ticks (deterministic; survives save/load)
        caravan.tradeTicksLeft = 120; // ~2s at 60tps, but driven by update loop
    }

    completeTrade(caravan, from, to) {
        // Caravan returns, agents revert to normal or stay as merchants
        caravan.agents.forEach(agentId => {
            const agent = this.getAgent(agentId);
            if (agent) {
                agent.state = 'idle';
                agent.role = 'settler'; // Revert role
            }
        });
        
        this.eventBus.emit('trade:caravan_returned', { route: caravan.routeId });
    }

    dissolveCaravan(caravan) {
        caravan.agents.forEach(agentId => {
            const agent = this.getAgent(agentId);
            if (agent) {
                agent.state = 'idle';
                agent.role = 'settler';
            }
        });
    }

    calculateDistance(s1, s2) {
        const dx = s1.center.x - s2.center.x;
        const dy = s1.center.y - s2.center.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    serialize() {
        return {
            caravans: this.caravans,
            tradeRoutes: this.tradeRoutes
        };
    }

    deserialize(data) {
        if (data.caravans) this.caravans = data.caravans;
        if (data.tradeRoutes) this.tradeRoutes = data.tradeRoutes;
    }

    static deserialize(data, sim) {
        const sys = new TradeSystem(sim);
        sys.deserialize(data);
        return sys;
    }
}
