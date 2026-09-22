/**
 * Beliefs Database
 * Defines all religious/cultural belief systems in Aetheria.
 */

export const BELIEFS = {
    // Nature Worship
    NATURE_WORSHIP: {
        id: 'nature_worship',
        name: 'Nature Worship',
        description: 'Reverence for the natural world and its spirits',
        icon: '🌿',
        bonuses: {
            farming: 1.2, // +20% farming efficiency
            foraging: 1.3, // +30% foraging
            combat: 0.9 // -10% combat (pacifist leanings)
        },
        colors: ['#2ecc71', '#27ae60', '#1e8449'],
        rituals: ['harvest_festival', 'rain_dance', 'tree_blessing']
    },

    // War God
    WAR_DEITY: {
        id: 'war_deity',
        name: 'War Deity',
        description: 'Might makes right; glory through conquest',
        icon: '⚔️',
        bonuses: {
            combat: 1.25, // +25% combat effectiveness
            morale: 1.2, // +20% morale in battle
            production: 0.9 // -10% production (focused on war)
        },
        colors: ['#e74c3c', '#c0392b', '#922b21'],
        rituals: ['war_chant', 'victory_ceremony', 'weapon_blessing']
    },

    // Knowledge Seekers
    KNOWLEDGE: {
        id: 'knowledge',
        name: 'Seekers of Knowledge',
        description: 'Wisdom and learning above all',
        icon: '📚',
        bonuses: {
            crafting: 1.3, // +30% crafting quality/speed
            research: 1.5, // +50% research (if implemented)
            trade: 1.1 // +10% trade efficiency
        },
        colors: ['#3498db', '#2980b9', '#1a5276'],
        rituals: ['meditation', 'scholar_lecture', 'library_consecration']
    },

    // Trade Guilds
    TRADE_PROSPERITY: {
        id: 'trade_prosperity',
        name: 'Goddess of Prosperity',
        description: 'Wealth and commerce bring happiness',
        icon: '💰',
        bonuses: {
            trade: 1.4, // +40% trade efficiency
            market_prices: 0.9, // -10% prices (better deals)
            happiness: 1.1 // +10% happiness from wealth
        },
        colors: ['#f1c40f', '#f39c12', '#b7950b'],
        rituals: ['coin_blessing', 'market_opening', 'wealth_prayer']
    },

    // Ancestor Veneration
    ANCESTORS: {
        id: 'ancestors',
        name: 'Ancestor Veneration',
        description: 'Honor those who came before; they guide us',
        icon: '👻',
        bonuses: {
            stability: 1.3, // +30% faction stability
            experience: 1.2, // +20% XP gain
            death_comfort: 1.5 // Less morale loss on death
        },
        colors: ['#9b59b6', '#8e44ad', '#6c3483'],
        rituals: ['ancestor_offering', 'memorial_service', 'spirit_communion']
    },

    // Sun Cult
    SUN_CULT: {
        id: 'sun_cult',
        name: 'Cult of the Sun',
        description: 'The sun gives life; bask in its glory',
        icon: '☀️',
        bonuses: {
            daytime_production: 1.3, // +30% production during day
            faith_regeneration: 1.2, // +20% faith regen
            health: 1.1 // +10% health regeneration
        },
        colors: ['#f39c12', '#e67e22', '#d35400'],
        rituals: ['sunrise_prayer', 'noon_blessing', 'sunset_gratitude']
    },

    // Moon Mystics
    MOON_MYSTERIES: {
        id: 'moon_mysteries',
        name: 'Moon Mysteries',
        description: 'Secrets revealed in moonlight; intuition over reason',
        icon: '🌙',
        bonuses: {
            nighttime_stealth: 1.4, // +40% stealth at night
            intuition: 1.3, // Better decision making
            magic_affinity: 1.5 // If magic system added
        },
        colors: ['#ecf0f1', '#bdc3c7', '#7f8c8d'],
        rituals: ['full_moon_ceremony', 'dream_interpretation', 'lunar_blessing']
    },

    // Elemental Balance
    ELEMENTAL: {
        id: 'elemental',
        name: 'Elemental Balance',
        description: 'Earth, Air, Fire, Water must remain in harmony',
        icon: '🌀',
        bonuses: {
            terraforming: 1.3, // +30% god power efficiency
            environmental_resist: 1.2, // Resist disasters better
            resource_diversity: 1.1 // +10% all resources
        },
        colors: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12'],
        rituals: ['elemental_invocation', 'balance_ceremony', 'storm_calling']
    }
};

/**
 * Get belief by ID
 */
export function getBelief(id) {
    return Object.values(BELIEFS).find(b => b.id === id) || null;
}

/**
 * Get random belief
 */
export function getRandomBelief() {
    const beliefs = Object.values(BELIEFS);
    return beliefs[Math.floor(Math.random() * beliefs.length)];
}

/**
 * Get beliefs compatible with faction personality
 */
export function getCompatibleBeliefs(factionPersonality) {
    const compatible = [];
    
    if (factionPersonality.aggressive > 7) {
        compatible.push(BELIEFS.WAR_DEITY);
    }
    if (factionPersonality.peaceful > 7) {
        compatible.push(BELIEFS.NATURE_WORSHIP);
    }
    if (factionPersonality.curious > 7) {
        compatible.push(BELIEFS.KNOWLEDGE);
    }
    if (factionPersonality.greedy > 7) {
        compatible.push(BELIEFS.TRADE_PROSPERITY);
    }
    if (factionPersonality.traditional > 7) {
        compatible.push(BELIEFS.ANCESTORS);
    }
    
    // Always add some random options
    const randomCount = Math.floor(Math.random() * 3) + 2;
    const shuffled = Object.values(BELIEFS).sort(() => Math.random() - 0.5);
    
    for (const belief of shuffled) {
        if (!compatible.includes(belief) && compatible.length < 5) {
            compatible.push(belief);
        }
        if (compatible.length >= randomCount) break;
    }
    
    return compatible;
}
