import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Simulation } from './simulation/simulation.js';
import { CanvasRenderer } from './presentation/renderer.js';
import { Interaction } from './interaction/godPowers.js';
import { TopBar } from './components/TopBar';
import { ControlsHeader } from './components/ControlsHeader';
import { Dock } from './components/Dock';
import { SocietiesPanel } from './components/SocietiesPanel';
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { ChroniclePanel } from './components/ChroniclePanel';
import { GuideModal } from './components/GuideModal';
import { CivilizationModal } from './components/CivilizationModal';
import { NotificationToast } from './components/NotificationToast';
import { MiniMapRadar } from './components/MiniMapRadar';
import { StartScreen, SavedWorldMeta } from './components/StartScreen';
import { soundManager } from './systems/audio';
import packageJson from '../package.json';
import {
  ToolType,
  TimeState,
  ResourceSummary,
  SettlementSummary,
  WarSummary,
  TreatySummary,
  RelationSummary,
  DiplomaticLogEntry,
  ChronicleEntrySummary,
  InspectedEntityData,
} from './types';

function readSavedWorldMeta(): SavedWorldMeta | null {
  try {
    const raw = localStorage.getItem('aetheria_save');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || (!parsed.world && !parsed.agents)) return null;
    const tick = Number(parsed.clock?.tick || 0);
    const settlementsArr = parsed.settlements?.settlements;
    const settlementsCount = Array.isArray(settlementsArr) ? settlementsArr.length : 0;
    const agentsCount = Array.isArray(parsed.agents) ? parsed.agents.length : 0;
    return {
      exists: true,
      days: Math.floor(tick / 24),
      settlementsCount,
      agentsCount,
      scenario: parsed.scenario === 'modern_nuclear' ? 'modern_nuclear' : 'warring',
    };
  } catch {
    return null;
  }
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const interactionRef = useRef<any>(null);

  const [simInstance, setSimInstance] = useState<any>(null);
  const [rendererInstance, setRendererInstance] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(() => soundManager.isMuted());

  // Title / Active play state
  const [gameScreen, setGameScreen] = useState<'title' | 'playing'>(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.screen = 'title';
    }
    return 'title';
  });
  const gameScreenRef = useRef(gameScreen);
  gameScreenRef.current = gameScreen;
  const [savedMeta, setSavedMeta] = useState<SavedWorldMeta | null>(() => readSavedWorldMeta());

  // Scenario - default to Tribal Warring Kingdoms (switchable via StartScreen or ControlsHeader)
  const [scenario, setScenario] = useState<'modern_nuclear' | 'warring'>('warring');
  const pendingScenarioRef = useRef<'modern_nuclear' | 'warring'>(scenario);
  const [worldNonce, setWorldNonce] = useState(0);

  // UI state
  const [currentTool, setCurrentTool] = useState<ToolType>('inspect');
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [is25D, setIs25D] = useState(true);
  const [heightScaleLabel, setHeightScaleLabel] = useState('Heights: Normal');

  const [timeState, setTimeState] = useState<TimeState>({ days: 0, hours: 0, tick: 0 });
  const [agentCount, setAgentCount] = useState(0);
  const [births, setBirths] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [avgDeathAge, setAvgDeathAge] = useState(0);
  const [lodStats, setLodStats] = useState<{ tier0: number; tier1: number; tier2: number; avgTickMs: number } | null>(null);
  const [resources, setResources] = useState<ResourceSummary>({
    food: 0,
    wood: 0,
    ore: 0,
    water: 0,
    total: 0,
  });

  const [societies, setSocieties] = useState<SettlementSummary[]>([]);
  const [societiesCount, setSocietiesCount] = useState(0);
  const [wars, setWars] = useState<WarSummary[]>([]);
  const [treaties, setTreaties] = useState<TreatySummary[]>([]);
  const [relations, setRelations] = useState<RelationSummary[]>([]);
  const [diplomaticHistory, setDiplomaticHistory] = useState<DiplomaticLogEntry[]>([]);
  const [followAgentId, setFollowAgentId] = useState<number | null>(null);

  const [societiesOpen, setSocietiesOpen] = useState(true);
  const [diplomacyOpen, setDiplomacyOpen] = useState(true);
  const societiesOpenRef = useRef(societiesOpen);
  societiesOpenRef.current = societiesOpen;
  const [civilizationOpen, setCivilizationOpen] = useState(false);
  const civilizationOpenRef = useRef(civilizationOpen);
  civilizationOpenRef.current = civilizationOpen;
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(helpOpen);
  helpOpenRef.current = helpOpen;
  const [currentWeather, setCurrentWeather] = useState<{
    name: string;
    icon: string;
    description: string;
  } | null>(null);
  const [dominantAge, setDominantAge] = useState<{
    name: string;
    icon: string;
    color: string;
  } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [chronicleEvents, setChronicleEvents] = useState<string[]>([
    'World awakened with 128×128 terrain and biomes.',
  ]);
  const [chronicleEntries, setChronicleEntries] = useState<ChronicleEntrySummary[]>([]);
  const [inspectedEntity, setInspectedEntity] = useState<InspectedEntityData | null>(null);

  const notificationTimeoutRef = useRef<any>(null);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
    }, 2500);
  }, []);

  const addChronicleEntry = useCallback((entry: string) => {
    setChronicleEvents((prev) => [entry, ...prev.slice(0, 24)]);
  }, []);

  useEffect(() => {
    document.body.dataset.screen = gameScreen;
  }, [gameScreen]);

  // Initialize simulation and renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const activeScenario = pendingScenarioRef.current;
    const sim = new Simulation(Date.now(), 128, 128, { scenario: activeScenario });
    simRef.current = sim;

    if (gameScreenRef.current === 'playing') {
      setTimeout(() => {
        showNotification(
          activeScenario === 'modern_nuclear'
            ? '☢️ Modern & Nuclear Age: Atomic arsenals armed — devastating Total Wars active!'
            : '⚔️ Warring Kingdoms: hereditary rivalries active — wars always on'
        );
      }, 350);
    }

    const renderer = new CanvasRenderer(canvas, sim.world, sim);
    rendererRef.current = renderer;

    const interaction = new Interaction(sim, renderer);
    interactionRef.current = interaction;

    setSimInstance(sim);
    setRendererInstance(renderer);

    if (sim.agents.length > 0) {
      renderer.centerOn(sim.agents[0].x, sim.agents[0].y, 14, true);
    }

    // Reset React HUD state cleanly for fresh world initialization
    setCurrentTool('inspect');
    setChronicleEvents(['World awakened with 128×128 terrain and biomes.']);
    setChronicleEntries([]);
    setDiplomaticHistory([]);
    setWars([]);
    setTreaties([]);
    setRelations([]);

    // Set initial tool
    interaction.setTool('inspect');

    // Attach event bus listeners
    const handleAgentCreated = (e: any) => {
      const name = e.name || `Citizen #${e.agentId}`;
      if (e.reason === 'divine') {
        addChronicleEntry(`✨ Pioneer: ${name} appeared in the realm.`);
      } else {
        addChronicleEntry(`👶 Newborn: ${name} entered the world.`);
      }
    };

    const handleAgentDied = (e: any) => {
      const name = e.name || `Citizen #${e.agentId}`;
      addChronicleEntry(
        `🕊️ Death: ${name} passed away at age ${e.age || 'natural'} (${e.cause || 'natural'}).`
      );
    };

    const handleConstruction = (e: any) => {
      addChronicleEntry(`🏛️ Building completed: ${e.buildingType} at (${e.x}, ${e.y})!`);
    };

    const handleBlueprint = (e: any) => {
      addChronicleEntry(`📐 New blueprint: ${e.type} planned in ${e.settlementName || 'society'}.`);
    };

    const handleDiplomatic = (e: any) => {
      addChronicleEntry(`${e.title}: ${e.description}`);
      showNotification(e.title);
    };

    const handleWarband = (e: any) => {
      addChronicleEntry(`🛡️ ${e.settlementName} mobilized a ${e.role} warband of ${e.size} warriors!`);
    };

    const handlePlundered = (e: any) => {
      addChronicleEntry(`🔥 ${e.attackerName} sacked ${e.defenderName} and plundered stockpiles!`);
      showNotification(`🔥 ${e.attackerName} sacked ${e.defenderName}!`);
    };

    const handleAgeAdvanced = (e: any) => {
      addChronicleEntry(`🌟 Age Advancement: ${e.settlementName} stepped into the ${e.age}!`);
      showNotification(`🌟 ${e.settlementName} advanced to ${e.icon || ''} ${e.age}!`);
    };

    const handleMonumentSurveyed = (e: any) => {
      addChronicleEntry(`🏛️ Great Wonder: Foundation laid for ${e.monumentName} in ${e.settlementName}!`);
      showNotification(`🏛️ ${e.settlementName} began ${e.monumentName}!`);
    };

    const handleWeatherChanged = (e: any) => {
      addChronicleEntry(`🌤️ Weather Shift: ${e.icon || ''} ${e.name} has settled across the world.`);
    };

    const handleLightning = (e: any) => {
      if (!e.manual) {
        addChronicleEntry(`⚡ Thunderclap! Lightning struck at (${e.x}, ${e.y}).`);
      }
    };

    const handleSuccessionCrisis = (e: any) => {
      addChronicleEntry(`👑 Succession Crisis in ${e.settlementName || 'a realm'}: ${e.claimantName} challenges ${e.monarchName || 'the crown'}!`);
      showNotification(`👑 Civil War in ${e.settlementName || 'a realm'}!`);
    };

    const handleCrownUsurped = (e: any) => {
      addChronicleEntry(`👑 Usurpation! ${e.usurperName} seized the throne of ${e.settlementName}!`);
      showNotification(`👑 ${e.usurperName} seized ${e.settlementName}!`);
    };

    const handleRebellionCrushed = (e: any) => {
      addChronicleEntry(`🛡️ Loyalists crushed the claimant uprising in ${e.settlementName}.`);
      showNotification(`🛡️ Rebellion crushed in ${e.settlementName}`);
    };

    const handleAmphibiousLaunch = (e: any) => {
      addChronicleEntry(`⛵ ${e.settlementName} launched an amphibious raid of ${e.size} warriors toward ${e.targetSettlementName || 'enemy shores'}!`);
      showNotification(`⛵ ${e.settlementName} launched amphibious raid!`);
    };

    const handleAmphibiousLanding = (e: any) => {
      addChronicleEntry(`⚔️ ${e.settlementName} raiders stormed ashore at (${Math.round(e.x || 0)}, ${Math.round(e.y || 0)})!`);
    };

    const handleBargeTrade = (e: any) => {
      addChronicleEntry(`⛴️ River barge delivered ${e.amount} ${e.resource} from ${e.from} to ${e.to}.`);
    };

    const handleSettlementsMerged = (e: any) => {
      addChronicleEntry(`🌆 Grand Civic Union: ${e.secondaryName} united into ${e.primaryName} (${e.tier}, Pop ${e.population})!`);
      showNotification(`🌆 ${e.secondaryName} united into ${e.primaryName}!`);
    };

    const handleNuclearStrike = (e: any) => {
      addChronicleEntry(
        `☢️ NUCLEAR STRIKE! ${e.attackerName || 'Atomic Power'} hit ${e.targetName || 'frontier'} (${e.casualties || e.deaths || 0} dead, ${e.buildingsRuined || 0} ruined) — Why: ${e.reason || 'Escalation'}.`
      );
      showNotification(`☢️ Nuclear strike on ${e.targetName || 'target'}!`);
    };

    const handleNuclearWarheadBuilt = (e: any) => {
      addChronicleEntry(`☢️ ${e.settlementName || 'A power'} assembled Nuclear Warhead #${e.warheads || 1}.`);
      showNotification(`☢️ ${e.settlementName || 'A power'} armed a Nuclear Warhead!`);
    };

    const handleUrbanRebellion = (e: any) => {
      addChronicleEntry(`🔥 Urban Uprising in ${e.settlementName || 'a city'}${e.reason ? ` (${e.reason})` : ''}!`);
      showNotification(`🔥 Urban rebellion erupted in ${e.settlementName || 'a city'}!`);
    };

    const handleSettlementCollapsed = (e: any) => {
      addChronicleEntry(`🏚️ TOTAL COLLAPSE: ${e.name || 'A city'} fell completely into ruins (${e.reason || 'devastation'}).`);
      showNotification(`🏚️ ${e.name || 'A city'} collapsed completely!`);
    };

    const handleSanctionsImposed = (e: any) => {
      addChronicleEntry(`🚫 ${e.fromName || 'A realm'} imposed trade sanctions on ${e.targetName || 'a rival'} — ${e.reason || 'border friction'}.`);
    };

    const handleUltimatumIssued = (e: any) => {
      addChronicleEntry(`📜 Ultimatum: ${e.fromName || 'A power'} demanded ${String(e.demand || 'tribute').replace(/_/g, ' ')} from ${e.targetName || 'a neighbor'} (${e.outcome || 'rejected'}).`);
    };

    const handleEspionageOp = (e: any) => {
      addChronicleEntry(`🕵️ ${e.title || 'Covert Op'}: ${e.what || ''}`);
      if (e.detected || e.success) {
        showNotification(`🕵️ ${e.title || 'Covert Operation'}`);
      }
    };

    const handleGuildFounded = (e: any) => {
      addChronicleEntry(`🏛️ Guild Charter: ${e.guildName || 'Guild'} established in ${e.settlementName || 'a realm'}.`);
    };

    const handleWonderStage = (e: any) => {
      addChronicleEntry(`🏗️ Wonder Stage ${e.stage}/${e.maxStage}: ${e.settlementName} advanced ${e.wonderName}!`);
    };

    const handleWonderCompleted = (e: any) => {
      addChronicleEntry(`🏆 Great Wonder Completed: ${e.settlementName} finished ${e.wonderName} (${e.buffLabel})!`);
      showNotification(`🏆 ${e.settlementName} completed ${e.wonderName}!`);
    };

    const handleFortificationsBuilt = (e: any) => {
      addChronicleEntry(`🧱 ${e.settlementName || 'A city'} raised ${e.tierName || 'perimeter fortifications'} (${e.segmentsCount || 0} walls, ${e.towersCount || 0} watchtowers).`);
    };

    const handleWallBreached = (e: any) => {
      addChronicleEntry(`💥 ${e.attackerName || 'Besiegers'} breached ${e.settlementName || 'a city'}'s ${e.wasGate ? 'gatehouse' : 'wall'} at (${e.x}, ${e.y})!`);
      showNotification(`💥 Wall breached at ${e.settlementName || 'the frontier'}!`);
    };

    const handleBuildingUpgraded = (e: any) => {
      addChronicleEntry(`🏛️ ${e.settlementName || 'A realm'} upgraded ${e.levelTitle || e.buildingType} to Lv ${e.level}!`);
      if (e.byPlayer) {
        showNotification(`⬆️ Upgraded to ${e.levelTitle || `Lv ${e.level}`}!`);
      }
    };

    sim.eventBus.on('AGENT_CREATED', handleAgentCreated);
    sim.eventBus.on('AGENT_DIED', handleAgentDied);
    sim.eventBus.on('CONSTRUCTION_COMPLETED', handleConstruction);
    sim.eventBus.on('BLUEPRINT_PLACED', handleBlueprint);
    sim.eventBus.on('DIPLOMATIC_EVENT', handleDiplomatic);
    sim.eventBus.on('WARBAND_MOBILIZED', handleWarband);
    sim.eventBus.on('SETTLEMENT_PLUNDERED', handlePlundered);
    sim.eventBus.on('CIVILIZATION_AGE_ADVANCED', handleAgeAdvanced);
    sim.eventBus.on('MONUMENT_SURVEYED', handleMonumentSurveyed);
    sim.eventBus.on('WEATHER_CHANGED', handleWeatherChanged);
    sim.eventBus.on('LIGHTNING_STRIKE', handleLightning);
    sim.eventBus.on('SUCCESSION_CRISIS_STARTED', handleSuccessionCrisis);
    sim.eventBus.on('CROWN_USURPED', handleCrownUsurped);
    sim.eventBus.on('REBELLION_CRUSHED', handleRebellionCrushed);
    sim.eventBus.on('AMPHIBIOUS_RAID_LAUNCHED', handleAmphibiousLaunch);
    sim.eventBus.on('AMPHIBIOUS_LANDING', handleAmphibiousLanding);
    sim.eventBus.on('BARGE_TRADE_COMPLETED', handleBargeTrade);
    sim.eventBus.on('SETTLEMENTS_MERGED', handleSettlementsMerged);
    sim.eventBus.on('NUCLEAR_STRIKE', handleNuclearStrike);
    sim.eventBus.on('NUCLEAR_WARHEAD_BUILT', handleNuclearWarheadBuilt);
    sim.eventBus.on('URBAN_REBELLION', handleUrbanRebellion);
    sim.eventBus.on('SETTLEMENT_COLLAPSED', handleSettlementCollapsed);
    sim.eventBus.on('SANCTIONS_IMPOSED', handleSanctionsImposed);
    sim.eventBus.on('ULTIMATUM_ISSUED', handleUltimatumIssued);
    sim.eventBus.on('ESPIONAGE_OPERATION', handleEspionageOp);
    sim.eventBus.on('GUILD_FOUNDED', handleGuildFounded);
    sim.eventBus.on('WONDER_STAGE_COMPLETED', handleWonderStage);
    sim.eventBus.on('WONDER_COMPLETED', handleWonderCompleted);
    sim.eventBus.on('FORTIFICATIONS_BUILT', handleFortificationsBuilt);
    sim.eventBus.on('WALL_BREACHED', handleWallBreached);
    sim.eventBus.on('BUILDING_UPGRADED', handleBuildingUpgraded);

    // Custom window events
    const handleEntityInspected = (e: CustomEvent) => {
      const detail = e.detail;
      if (detail?.kind === 'agent' && detail.entity?.id != null && typeof sim.getAgentDossier === 'function') {
        setInspectedEntity({ kind: 'agent', entity: detail.entity, dossier: sim.getAgentDossier(detail.entity.id) });
      } else if (detail?.kind === 'settlement' && detail.entity?.id != null) {
        const s = sim.settlementSystem?.settlements.get(detail.entity.id) || detail.entity;
        const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary(s.id);
        const nuclearProgram = sim.civilizationAgeSystem?.getNuclearProgram?.(s.id);
        const guilds = sim.espionageSystem?.getSettlementGuilds?.(s.id);
        const fortifications = sim.fortificationSystem?.getSettlementFortificationSummary?.(s.id);
        setInspectedEntity({ kind: 'settlement', entity: { ...s, age: ageSummary, nuclearProgram, guilds, fortifications } });
      } else if (detail?.kind === 'building' && detail.entity) {
        const b = detail.entity;
        const sName = b.settlementId != null ? sim.settlementSystem?.settlements?.get(b.settlementId)?.name : null;
        const upgradeReq = typeof sim.getUpgradeRequirements === 'function' ? sim.getUpgradeRequirements(b) : null;
        setInspectedEntity({ kind: 'building', entity: { ...b, settlementName: sName }, upgradeReq });
      } else {
        setInspectedEntity(detail);
      }
    };

    const handleShowNotification = (e: CustomEvent) => {
      if (e.detail) showNotification(e.detail);
    };

    window.addEventListener('entity_inspected', handleEntityInspected as EventListener);
    window.addEventListener('show_notification', handleShowNotification as EventListener);

    // Game animation loop with fixed-timestep accumulator for 60/120Hz smooth interpolation
    let lastTime = 0;
    let accumulator = 0;
    let lastUiUpdate = 0;
    let animationFrameId: number;
    const TICK_RATE = 350; // ms per tick at 1x speed

    const gameLoop = (currentTime: number) => {
      if (!lastTime) lastTime = currentTime;
      const rawDelta = currentTime - lastTime;
      const frameDt = Math.min(250, Math.max(0, rawDelta));
      lastTime = currentTime;
      const isPlaying = gameScreenRef.current === 'playing';
      const currentSpeed = isPlaying ? sim.clock.speed : 0;

      let tickAlpha = 1;
      if (isPlaying && currentSpeed > 0) {
        const stepInterval = TICK_RATE / currentSpeed;
        accumulator += frameDt;
        let steps = 0;
        while (accumulator >= stepInterval && steps < 4) {
          sim.tick();
          accumulator -= stepInterval;
          steps++;
        }
        if (accumulator >= stepInterval) {
          accumulator = stepInterval * 0.99;
        }
        tickAlpha = Math.max(0, Math.min(1, accumulator / stepInterval));
      } else {
        accumulator = 0;
      }

      renderer.setFrameTiming(tickAlpha, isPlaying ? frameDt : 0, currentSpeed);
      renderer.render();

      // UI state refresh throttle (4 times/sec)
      if (currentTime - lastUiUpdate > 250) {
        const t = sim.clock.getTime();
        setTimeState((prev) => (prev.days === t.days && prev.hours === t.hours && prev.tick === t.tick ? prev : t));
        setAgentCount(sim.agents.length);
        setBirths(sim.birthsThisSession || 0);
        setDeaths(sim.deathsThisSession || 0);
        setAvgDeathAge(sim.mortalityStats?.averageAgeAtDeath || 0);
        setSpeed(sim.clock.speed);
        setIsPaused(sim.clock.speed === 0);

        if (sim.lodStats) {
          setLodStats((prev) => {
            const ls = sim.lodStats;
            if (
              prev &&
              prev.tier0 === ls.tier0 &&
              prev.tier1 === ls.tier1 &&
              prev.tier2 === ls.tier2 &&
              Math.abs(prev.avgTickMs - (ls.avgTickMs || 0)) < 0.2
            ) {
              return prev;
            }
            return {
              tier0: ls.tier0,
              tier1: ls.tier1,
              tier2: ls.tier2,
              avgTickMs: ls.avgTickMs || 0,
            };
          });
        }

        if (sim.weatherSystem) {
          const wInfo = sim.weatherSystem.getWeatherInfo();
          setCurrentWeather((prev) => (prev && prev.name === wInfo.name ? prev : wInfo));
        }
        if (sim.civilizationAgeSystem) {
          const aInfo = sim.civilizationAgeSystem.getDominantAge();
          setDominantAge((prev) => (prev && prev.name === aInfo?.name ? prev : aInfo));
        }

        // Count resources
        let food = 0,
          wood = 0,
          ore = 0,
          water = 0;
        const resList = sim.resources;
        if (resList) {
          for (let i = 0; i < resList.length; i++) {
            const r = resList[i];
            if (r.destroyed) continue;
            if (r.resourceType === 'food') food++;
            else if (r.resourceType === 'wood') wood++;
            else if (r.resourceType === 'ore') ore++;
            else if (r.resourceType === 'water') water++;
          }
        }
        const totalRes = resList ? resList.length : 0;
        setResources((prev) => (prev.food === food && prev.wood === wood && prev.ore === ore && prev.water === water && prev.total === totalRes ? prev : { food, wood, ore, water, total: totalRes }));

        // Settlements
        const settlementMap = sim.settlementSystem?.settlements;
        if (settlementMap) {
          const sCount = settlementMap.size;
          setSocietiesCount((prev) => (prev === sCount ? prev : sCount));

          if (societiesOpenRef.current) {
            const sArr: SettlementSummary[] = [];
            for (const s of settlementMap.values()) {
              sArr.push({
                id: s.id,
                name: s.name,
                tier: s.tier || 'Village',
                tierIcon: s.tierIcon || '🏡',
                population: s.population || (s.agentIds ? s.agentIds.size : 0),
                center: { x: s.center?.x || 0, y: s.center?.y || 0 },
                stockpile: {
                  food: s.stockpile?.food || 0,
                  wood: s.stockpile?.wood || 0,
                  ore: s.stockpile?.ore || 0,
                  stone: s.stockpile?.stone || 0,
                },
                leadership: s.leadership,
                leadershipTitle: s.leadershipTitle,
                buildingsCount: s.buildings ? s.buildings.length : 0,
                age: sim.civilizationAgeSystem?.getSettlementAgeSummary(s.id),
                nuclearProgram: sim.civilizationAgeSystem?.getNuclearProgram?.(s.id),
                guilds: sim.espionageSystem?.getSettlementGuilds?.(s.id),
                fortifications: sim.fortificationSystem?.getSettlementFortificationSummary?.(s.id),
                culture: s.culture,
                growthTrend: s.growthTrend,
              });
            }
            setSocieties(sArr);
          }

          // Diplomacy data — keep live for panel, header badges, and Chancellery
          const diplomacy = sim.diplomacySystem;
          if (diplomacy) {
            const tickNow = sim.clock?.tick ?? 0;
            setWars(
              (diplomacy.activeWars || []).map((w: any) => ({
                attackerId: w.attackerId,
                attackerName: w.attackerName,
                defenderId: w.defenderId,
                defenderName: w.defenderName,
                casusBelli: w.casusBelli,
                whySummary: w.whySummary,
                drivers: w.drivers,
                warScore: diplomacy.calculateWarScore ? diplomacy.calculateWarScore(w) : 0,
                totalWar: Boolean(w.totalWar),
                casualties: w.casualties || {},
                plundered: w.plundered || { food: 0, wood: 0, ore: 0 },
              }))
            );

            setTreaties(
              (diplomacy.treaties || []).map((tr: any) => ({
                title: tr.title || 'Defensive Alliance',
                settlements: tr.settlements,
              }))
            );

            const allSettlements = Array.from(settlementMap.values());
            const relArr: RelationSummary[] = [];
            for (let i = 0; i < allSettlements.length; i++) {
              for (let j = i + 1; j < allSettlements.length; j++) {
                const s1: any = allSettlements[i];
                const s2: any = allSettlements[j];
                const rel = diplomacy.getRelation(s1.id, s2.id);
                if (rel) {
                  relArr.push({
                    s1Id: s1.id,
                    s1Name: s1.name,
                    s2Id: s2.id,
                    s2Name: s2.name,
                    status: rel.status,
                    score: rel.score,
                    sanctioned: (rel.sanctionedUntil || 0) > tickNow,
                    s1Warheads: sim.civilizationAgeSystem?.getNuclearProgram?.(s1.id)?.warheads || 0,
                    s2Warheads: sim.civilizationAgeSystem?.getNuclearProgram?.(s2.id)?.warheads || 0,
                  });
                }
              }
            }
            setRelations(relArr);
            // DiplomacySystem.recordDiplomaticEvent uses unshift(), so index 0 is newest
            setDiplomaticHistory(Array.isArray(diplomacy.diplomaticHistory) ? diplomacy.diplomaticHistory.slice(0, 40) : []);
          }
        }

        // Sync follow state if renderer cleared it on manual drag or agent death
        if (rendererRef.current) {
          const rFollow = rendererRef.current.followAgentId ?? null;
          setFollowAgentId((prev) => (prev === rFollow ? prev : rFollow));
        }

        // Live inspector refresh (retains Fallen Memorial dossier if inspected agent died)
        setInspectedEntity((currentInspect) => {
          if (!currentInspect || !currentInspect.entity) return null;
          if (currentInspect.kind === 'agent') {
            const aid = currentInspect.entity.id;
            const stillAlive =
              typeof sim._agentById === 'function'
                ? sim._agentById(aid)
                : sim.agents.find((a: any) => a.id === aid);
            const dossier = typeof sim.getAgentDossier === 'function' ? sim.getAgentDossier(aid) : null;
            if (stillAlive && stillAlive.alive) {
              return { kind: 'agent', entity: stillAlive, dossier };
            }
            if (dossier) {
              return {
                kind: 'agent',
                entity: { ...currentInspect.entity, ...dossier, alive: false },
                dossier,
              };
            }
            return {
              kind: 'agent',
              entity: { ...currentInspect.entity, alive: false },
              dossier: currentInspect.dossier || null,
            };
          } else if (currentInspect.kind === 'settlement') {
            const updated = sim.settlementSystem?.settlements.get(currentInspect.entity.id);
            if (updated) {
              const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary(updated.id);
              const nuclearProgram = sim.civilizationAgeSystem?.getNuclearProgram?.(updated.id);
              const guilds = sim.espionageSystem?.getSettlementGuilds?.(updated.id);
              const fortifications = sim.fortificationSystem?.getSettlementFortificationSummary?.(updated.id);
              const docksCount = (sim.buildings || []).filter((b: any) => b.settlementId === updated.id && b.buildingType === 'dock' && !b.isRuined).length;
              const vesselsCount = (sim.navalSystem?.vessels || []).filter((v: any) => v.settlementId === updated.id).length;
              return { kind: 'settlement', entity: { ...updated, age: ageSummary, nuclearProgram, guilds, fortifications, docksCount, vesselsCount } };
            }
            return null;
          } else if (currentInspect.kind === 'building') {
            const bId = currentInspect.entity.id;
            const stillBuilding = sim.buildings.find((b: any) => b.id === bId);
            if (stillBuilding) {
              const sName = stillBuilding.settlementId != null
                ? sim.settlementSystem?.settlements?.get(stillBuilding.settlementId)?.name
                : null;
              const upgradeReq = typeof sim.getUpgradeRequirements === 'function'
                ? sim.getUpgradeRequirements(stillBuilding)
                : null;
              return { kind: 'building', entity: { ...stillBuilding, settlementName: sName }, upgradeReq };
            }
            return null;
          } else if (currentInspect.kind === 'resource') {
            const rId = currentInspect.entity.id;
            const stillRes = sim.resources.find((r: any) => r.id === rId && !r.destroyed);
            if (stillRes) {
              return { kind: 'resource', entity: stillRes };
            }
            return null;
          }
          return currentInspect;
        });

        if (sim.chronicleSystem?.getHighlights) {
          const latestEntries = sim.chronicleSystem.getHighlights(80);
          setChronicleEntries((prev) => {
            if (
              prev.length === latestEntries.length &&
              prev[0]?.id === latestEntries[0]?.id &&
              prev[0]?.tick === latestEntries[0]?.tick
            ) {
              return prev;
            }
            return latestEntries;
          });
        }

        lastUiUpdate = currentTime;
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('entity_inspected', handleEntityInspected as EventListener);
      window.removeEventListener('show_notification', handleShowNotification as EventListener);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      interaction.destroy?.();
      renderer.destroy?.();
    };
  }, [addChronicleEntry, showNotification, worldNonce]);

  // Keyboard shortcut listener (stable single subscription)
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (gameScreenRef.current !== 'playing') {
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      return;
    }

    if (e.key === 'Escape') {
      setCivilizationOpen(false);
      setHelpOpen(false);
      return;
    }
    if (e.key === 'c' || e.key === 'C') {
      if (!helpOpenRef.current) {
        setCivilizationOpen((prev) => !prev);
      }
      return;
    }
    if (civilizationOpenRef.current || helpOpenRef.current) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      handleTogglePause();
    } else if (e.key === 'w' || e.key === 'W') {
      setDiplomacyOpen((prev) => !prev);
    } else {
      const keyMap: { [k: string]: ToolType } = {
        '1': 'inspect',
        '2': 'spawn_agent',
        '3': 'create_food',
        '4': 'create_water',
        '5': 'create_wood',
        '6': 'create_ore',
        '7': 'build_house',
        '8': 'build_workshop',
        '9': 'build_farm',
        '0': 'bless',
      };
      if (keyMap[e.key]) {
        handleSelectTool(keyMap[e.key]);
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Action handlers
  const handleToggleView = () => {
    if (rendererRef.current) {
      const mode = rendererRef.current.toggle25D();
      setIs25D(mode);
    }
  };

  const handleCycleHeight = () => {
    if (rendererRef.current) {
      rendererRef.current.cycleHeightScale();
      const scale = rendererRef.current.camera.heightScale;
      const label =
        scale === 0.08
          ? 'Heights: Low'
          : scale === 0.22
            ? 'Heights: Gentle'
            : scale === 0.38
              ? 'Heights: Normal'
              : 'Heights: Peaks';
      setHeightScaleLabel(label);
    }
  };

  const handleTogglePause = () => {
    if (!simRef.current) return;
    if (simRef.current.clock.speed > 0) {
      simRef.current.clock.pause();
      setIsPaused(true);
      setSpeed(0);
    } else {
      simRef.current.clock.setSpeed(1);
      setIsPaused(false);
      setSpeed(1);
    }
  };

  const handleCycleSpeed = () => {
    if (!simRef.current) return;
    const speeds = [0.5, 1, 2, 4];
    const currIdx = speeds.indexOf(simRef.current.clock.speed);
    const nextIdx = (currIdx + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    simRef.current.clock.setSpeed(newSpeed);
    setSpeed(newSpeed);
    setIsPaused(false);
    showNotification(
      `Time speed set to ${newSpeed}x${
        newSpeed === 0.5 ? ' (Relaxed pace)' : newSpeed === 1 ? ' (Normal pace)' : ' (Fast forward)'
      }`
    );
  };

  const handleCenterCamera = () => {
    if (!simRef.current || !rendererRef.current) return;
    const agents = simRef.current.agents;
    if (agents.length > 0) {
      let ax = 0,
        ay = 0;
      for (const a of agents) {
        ax += a.x;
        ay += a.y;
      }
      rendererRef.current.camera.x = ax / agents.length;
      rendererRef.current.camera.y = ay / agents.length;
      rendererRef.current.camera.zoom = 18;
      showNotification('🎯 Camera centered on citizens!');
    }
  };

  const handleSpawnResources = () => {
    if (!simRef.current || !rendererRef.current) return;
    const cx = rendererRef.current.camera.x;
    const cy = rendererRef.current.camera.y;
    simRef.current.spawnAbundantBounty(cx, cy);

    for (const s of simRef.current.settlementSystem.settlements.values()) {
      if (s.center) {
        simRef.current.spawnResourceCluster(s.center.x - 3, s.center.y, 'wood', 4, 3.0);
        simRef.current.spawnResourceCluster(s.center.x + 3, s.center.y, 'ore', 4, 3.0);
        simRef.current.spawnResourceCluster(s.center.x, s.center.y + 3, 'water', 3, 2.5);
      }
    }
    showNotification('🌱 Abundant Wood, Water & Ore sprouted across the realm!');
  };

  const handleSelectTool = (tool: ToolType) => {
    setCurrentTool(tool);
    if (interactionRef.current) {
      interactionRef.current.setTool(tool);
    }
  };

  const handlePanTo = useCallback((x: number, y: number) => {
    if (rendererRef.current) {
      rendererRef.current.centerOn(x, y);
    }
  }, []);

  const handleSelectSettlement = (s: SettlementSummary) => {
    if (!rendererRef.current || !simRef.current) return;
    rendererRef.current.centerOn(s.center.x, s.center.y, 14);

    const fullSettlement = simRef.current.settlementSystem?.settlements.get(s.id);
    if (fullSettlement) {
      const ageSummary = simRef.current.civilizationAgeSystem?.getSettlementAgeSummary(s.id);
      const nuclearProgram = simRef.current.civilizationAgeSystem?.getNuclearProgram?.(s.id);
      const guilds = simRef.current.espionageSystem?.getSettlementGuilds?.(s.id);
      const fortifications = simRef.current.fortificationSystem?.getSettlementFortificationSummary?.(s.id);
      const target: InspectedEntityData = {
        entity: { ...fullSettlement, age: ageSummary, nuclearProgram, guilds, fortifications },
        kind: 'settlement',
      };
      rendererRef.current.selectedEntity = target;
      setInspectedEntity(target);
    }
    showNotification(`View centered on ${s.name}`);
  };

  const handleFollowAgent = useCallback((agentId: number | null) => {
    if (!rendererRef.current) return;
    const nextId = rendererRef.current.followAgentId === agentId ? null : agentId;
    rendererRef.current.followAgentId = nextId;
    setFollowAgentId(nextId);
    if (nextId != null && simRef.current) {
      const ag = simRef.current._agentById?.(nextId) || simRef.current.agents?.find((a: any) => a.id === nextId);
      if (ag && ag.alive) {
        rendererRef.current.centerOn(ag.x, ag.y, Math.max(rendererRef.current.camera.zoom, 16), false, true);
        showNotification(`Following ${ag.name}`);
      }
    }
  }, [showNotification]);

  const handleSelectAgentById = useCallback((agentId: number) => {
    const sim = simRef.current;
    if (!sim) return;
    const live = typeof sim._agentById === 'function' ? sim._agentById(agentId) : sim.agents?.find((a: any) => a.id === agentId);
    const dossier = typeof sim.getAgentDossier === 'function' ? sim.getAgentDossier(agentId) : null;
    if (!live && !dossier) return;
    const target: InspectedEntityData = {
      kind: 'agent',
      entity: live || { ...dossier, alive: false },
      dossier,
    };
    setInspectedEntity(target);
    if (rendererRef.current) {
      rendererRef.current.selectedEntity = live ? target : null;
      if (live && live.alive) {
        rendererRef.current.centerOn(live.x, live.y, Math.max(rendererRef.current.camera.zoom, 15));
      }
    }
  }, []);

  const handleSelectBuildingById = useCallback((buildingId: number) => {
    const sim = simRef.current;
    if (!sim || !Array.isArray(sim.buildings)) return;
    const b = sim.buildings.find((item: any) => item && item.id === buildingId);
    if (!b) return;
    const sName = b.settlementId != null ? sim.settlementSystem?.settlements?.get(b.settlementId)?.name : null;
    const upgradeReq = typeof sim.getUpgradeRequirements === 'function' ? sim.getUpgradeRequirements(b) : null;
    const target: InspectedEntityData = {
      kind: 'building',
      entity: { ...b, settlementName: sName },
      upgradeReq,
    };
    setInspectedEntity(target);
    if (rendererRef.current) {
      rendererRef.current.selectedEntity = target;
      rendererRef.current.centerOn(b.x, b.y, Math.max(rendererRef.current.camera.zoom, 16));
    }
  }, []);

  const handleNextBattle = useCallback(() => {
    if (!rendererRef.current) return;
    const res = rendererRef.current.focusNextBattle?.();
    if (res) {
      showNotification(`⚔️ Focusing: ${res.label}`);
    } else {
      showNotification('🕊️ No active battles or scars to focus on yet.');
    }
  }, [showNotification]);

  const handleSignPeace = (s1: number, s2: number) => {
    if (simRef.current?.diplomacySystem) {
      simRef.current.diplomacySystem.signPeace(s1, s2, null);
      showNotification('🕊️ Peace concordat established!');
    }
  };

  const handleEnforceAllPeace = () => {
    if (simRef.current?.diplomacySystem) {
      const activeWars = [...simRef.current.diplomacySystem.activeWars];
      for (const w of activeWars) {
        simRef.current.diplomacySystem.signPeace(w.attackerId, w.defenderId, null);
      }
      showNotification('🕊️ Universal peace declared across all realms!');
    }
  };

  const handleProvokeWar = (s1: number, s2: number) => {
    if (simRef.current?.diplomacySystem) {
      simRef.current.diplomacySystem.declareWar(s1, s2, 'Militarist Aggression — Territorial Expansion');
      showNotification('⚔️ War ignited between realms!');
    }
  };

  const handleFormAlliance = (s1: number, s2: number) => {
    if (simRef.current?.diplomacySystem) {
      simRef.current.diplomacySystem.formAlliance(s1, s2, simRef.current.clock.tick);
      showNotification('🤝 Grand Alliance pact sworn!');
    }
  };

  const handleImposeSanctions = (fromId: number, targetId: number, reason = 'Trade embargo over border hostility') => {
    if (simRef.current?.diplomacySystem?.imposeSanctions) {
      const ok = simRef.current.diplomacySystem.imposeSanctions(fromId, targetId, reason, simRef.current.clock.tick);
      if (ok) showNotification('🚫 Trade sanctions enacted!');
    }
  };

  const handleIssueUltimatum = (fromId: number, targetId: number, demand = 'tribute') => {
    if (simRef.current?.diplomacySystem?.issueUltimatum) {
      const res = simRef.current.diplomacySystem.issueUltimatum(fromId, targetId, demand, 'Diplomatic Brinkmanship', simRef.current.clock.tick);
      if (res) showNotification(`📜 Ultimatum ${res.outcome === 'accepted' ? 'accepted' : 'rejected — war ignited!'}`);
    }
  };

  const handleLaunchNuke = (attackerId: number, targetId: number) => {
    const sim = simRef.current;
    if (!sim || !sim.detonateNuclearStrike) return;
    const target = sim.settlementSystem?.settlements?.get(targetId);
    const attacker = sim.settlementSystem?.settlements?.get(attackerId);
    const prog = sim.civilizationAgeSystem?.getNuclearProgram?.(attackerId);
    if (!target?.center || !prog || prog.warheads <= 0) {
      showNotification('Requires an active Modern Era target and an assembled nuclear warhead.');
      return;
    }
    prog.warheads = Math.max(0, prog.warheads - 1);
    prog.totalStrikes = (prog.totalStrikes || 0) + 1;
    prog.lastStrikeTick = sim.clock?.tick ?? 0;
    sim.detonateNuclearStrike({
      x: target.center.x,
      y: target.center.y,
      attackerSettlementId: attackerId,
      targetSettlementId: targetId,
      reason: `${attacker?.name || 'Nuclear Power'} launched a strategic atomic strike against ${target.name}`,
      isGodPower: false,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('god_effect', { detail: { type: 'nuke', x: target.center.x, y: target.center.y, duration: 2400 } }));
    }
  };

  const handleRallyWarband = (settlementId: number) => {
    if (!simRef.current?.warfareSystem) return;
    const enemies = simRef.current.diplomacySystem
      ? simRef.current.diplomacySystem.getEnemies(settlementId)
      : [];
    const targetId = enemies.length > 0 ? enemies[0] : null;
    const wb = simRef.current.warfareSystem.mobilizeWarband(
      settlementId,
      targetId,
      targetId ? 'assault' : 'defense'
    );
    const sName = simRef.current.settlementSystem?.settlements.get(settlementId)?.name || 'Settlement';
    if (wb) {
      showNotification(`🛡️ Warband mobilized for ${sName} (${wb.soldiers.length} soldiers)!`);
      const sim = simRef.current;
      const updated = sim.settlementSystem?.settlements.get(settlementId);
      if (updated) {
        const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary?.(updated.id);
        const nuclearProgram = sim.civilizationAgeSystem?.getNuclearProgram?.(updated.id);
        const guilds = sim.espionageSystem?.getSettlementGuilds?.(updated.id);
        const fortifications = sim.fortificationSystem?.getSettlementFortificationSummary?.(updated.id);
        setInspectedEntity({ kind: 'settlement', entity: { ...updated, age: ageSummary, nuclearProgram, guilds, fortifications } });
      }
    } else {
      showNotification(`Not enough healthy adult citizens in ${sName}.`);
    }
  };

  const handleSpawnSettlementCitizens = (settlementId: number, count: number) => {
    const sim = simRef.current;
    if (!sim || !sim.settlementSystem) return;
    const s = sim.settlementSystem.settlements.get(settlementId);
    if (!s || s.ruined || !s.center) return;

    if (sim.agents.length + count > (sim.maxAgents ?? 360)) {
      sim.maxAgents = Math.min(1200, sim.agents.length + count + 20);
    }

    const jobs = ['farmer', 'miner', 'lumberjack', 'builder', 'craftsman', 'soldier'];
    let spawned = 0;
    const w = sim.world?.width || 128;
    const h = sim.world?.height || 128;

    for (let i = 0; i < count; i++) {
      let sx = Math.floor(s.center.x);
      let sy = Math.floor(s.center.y);
      let placed = false;
      for (let attempt = 0; attempt < 24; attempt++) {
        const ang = ((i * 2.39996 + attempt * 0.7) % (Math.PI * 2));
        const rad = 1.5 + (attempt % 5);
        const cx = Math.max(2, Math.min(w - 3, Math.floor(s.center.x + Math.cos(ang) * rad)));
        const cy = Math.max(2, Math.min(h - 3, Math.floor(s.center.y + Math.sin(ang) * rad)));
        if (sim.world.isWalkable(cx, cy) && !sim.fortificationSystem?.isBlockedForAgent?.(cx, cy, { settlementId: s.id })) {
          sx = cx + 0.5;
          sy = cy + 0.5;
          placed = true;
          break;
        }
      }
      if (!placed && !sim.world.isWalkable(sx, sy)) continue;

      const agent = sim.spawnAgent(sx, sy);
      agent.pioneer = false;
      agent.settlementId = s.id;
      agent.factionId = s.factionId ?? null;
      const job = jobs[(s.agentIds.size + i) % jobs.length];
      agent.job = job;
      agent.jobTitle = job.charAt(0).toUpperCase() + job.slice(1);
      s.agentIds.add(agent.id);
      sim.settlementSystem.agentSettlementMap.set(agent.id, s.id);
      sim.economySystem?.agentJobs?.set(agent.id, { job, salary: 14, satisfaction: 85, assignedAt: sim.clock?.tick ?? 0 });
      sim.religionSystem?.initReligionEntity?.(agent);
      spawned++;
    }

    s.population = s.agentIds.size;
    if (spawned > 0) {
      soundManager.playBless();
      showNotification(`👤 Added ${spawned} citizen${spawned > 1 ? 's' : ''} to ${s.name} (Pop ${s.population})!`);
      const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary?.(s.id);
      const nuclearProgram = sim.civilizationAgeSystem?.getNuclearProgram?.(s.id);
      const guilds = sim.espionageSystem?.getSettlementGuilds?.(s.id);
      const fortifications = sim.fortificationSystem?.getSettlementFortificationSummary?.(s.id);
      setInspectedEntity({ kind: 'settlement', entity: { ...s, age: ageSummary, nuclearProgram, guilds, fortifications } });
    }
  };

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setIsMuted(next);
    showNotification(next ? '🔇 Sound muted' : '🔊 Sound enabled');
  };

  const handleLaunchSpyOp = (fromId: number, targetId: number, opType = 'sabotage_granary') => {
    const sim = simRef.current;
    if (!sim?.espionageSystem) return;
    const res = sim.espionageSystem.launchOperation(fromId, targetId, opType, sim.clock?.tick ?? 0, {
      reason: 'Player-directed intelligence directive',
    });
    if (res) {
      showNotification(`${res.success ? '🕵️' : '🚨'} ${res.title}`);
    }
  };

  const handleCommissionWonder = (settlementId: number, wonderKey: string) => {
    const sim = simRef.current;
    if (!sim?.civilizationAgeSystem?.commissionWonder) return;
    const w = sim.civilizationAgeSystem.commissionWonder(settlementId, wonderKey, sim.clock?.tick ?? 0);
    if (w) {
      showNotification(`${w.icon} Commissioned ${w.name}!`);
      const s = sim.settlementSystem?.settlements.get(settlementId);
      if (s && inspectedEntity?.kind === 'settlement' && inspectedEntity.entity?.id === settlementId) {
        const ageSummary = sim.civilizationAgeSystem.getSettlementAgeSummary(settlementId);
        const nuclearProgram = sim.civilizationAgeSystem.getNuclearProgram?.(settlementId);
        const guilds = sim.espionageSystem?.getSettlementGuilds?.(settlementId);
        setInspectedEntity({ kind: 'settlement', entity: { ...s, age: ageSummary, nuclearProgram, guilds } });
      }
    }
  };

  const handleAdvanceWonder = (settlementId: number) => {
    const sim = simRef.current;
    if (!sim?.civilizationAgeSystem?.advanceWonderProgress) return;
    const w = sim.civilizationAgeSystem.advanceWonderProgress(settlementId, 34, sim.clock?.tick ?? 0);
    if (w) {
      showNotification(`${w.icon} ${w.name}: ${w.complete ? 'Completed!' : `Stage ${w.stage}/${w.maxStage} (${w.progress}%)`}`);
      const s = sim.settlementSystem?.settlements.get(settlementId);
      if (s && inspectedEntity?.kind === 'settlement' && inspectedEntity.entity?.id === settlementId) {
        const ageSummary = sim.civilizationAgeSystem.getSettlementAgeSummary(settlementId);
        const nuclearProgram = sim.civilizationAgeSystem.getNuclearProgram?.(settlementId);
        const guilds = sim.espionageSystem?.getSettlementGuilds?.(settlementId);
        const fortifications = sim.fortificationSystem?.getSettlementFortificationSummary?.(settlementId);
        setInspectedEntity({ kind: 'settlement', entity: { ...s, age: ageSummary, nuclearProgram, guilds, fortifications } });
      }
    }
  };

  const handleFortifySettlement = (settlementId: number) => {
    const sim = simRef.current;
    if (!sim?.fortificationSystem?.fortifySettlement) return;
    const res = sim.fortificationSystem.fortifySettlement(settlementId, {
      repairExisting: true,
      tick: sim.clock?.tick ?? 0,
    });
    if (res) {
      soundManager.playBuild();
      const s = sim.settlementSystem?.settlements.get(settlementId);
      const sName = s?.name || 'Settlement';
      showNotification(
        `🧱 ${sName}: ${res.summary.intactWalls} walls, ${res.summary.intactGates} gates, ${res.summary.towers} watchtowers!`
      );
      if (s && inspectedEntity?.kind === 'settlement' && inspectedEntity.entity?.id === settlementId) {
        const ageSummary = sim.civilizationAgeSystem.getSettlementAgeSummary(settlementId);
        const nuclearProgram = sim.civilizationAgeSystem.getNuclearProgram?.(settlementId);
        const guilds = sim.espionageSystem?.getSettlementGuilds?.(settlementId);
        setInspectedEntity({
          kind: 'settlement',
          entity: { ...s, age: ageSummary, nuclearProgram, guilds, fortifications: res.summary },
        });
      }
    }
  };

  const handleUpgradeBuilding = (buildingId: number) => {
    const sim = simRef.current;
    if (!sim || typeof sim.upgradeBuilding !== 'function') return;
    const res = sim.upgradeBuilding(buildingId, { byPlayer: true, tick: sim.clock?.tick ?? 0 });
    if (res?.ok && res.building) {
      soundManager.playBuild();
      const sName = res.building.settlementId != null
        ? sim.settlementSystem?.settlements?.get(res.building.settlementId)?.name
        : null;
      const upgradeReq = typeof sim.getUpgradeRequirements === 'function'
        ? sim.getUpgradeRequirements(res.building)
        : null;
      setInspectedEntity({ kind: 'building', entity: { ...res.building, settlementName: sName }, upgradeReq });
    } else if (res?.reason) {
      showNotification(`⚠️ ${res.reason}`);
    }
  };

  const handleCommissionBuilding = (settlementId: number, buildingType: string) => {
    const sim = simRef.current;
    if (!sim || typeof sim.commissionSettlementBuilding !== 'function') return;
    const res = sim.commissionSettlementBuilding(settlementId, buildingType, { byPlayer: true });
    if (res?.ok && res.building) {
      soundManager.playBuild();
      showNotification(`📐 Commissioned ${res.meta?.icon || '🏗️'} ${res.meta?.name || buildingType}!`);
      const s = sim.settlementSystem?.settlements.get(settlementId);
      if (s && inspectedEntity?.kind === 'settlement' && inspectedEntity.entity?.id === settlementId) {
        const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary?.(settlementId);
        const nuclearProgram = sim.civilizationAgeSystem?.getNuclearProgram?.(settlementId);
        const guilds = sim.espionageSystem?.getSettlementGuilds?.(settlementId);
        const fortifications = sim.fortificationSystem?.getSettlementFortificationSummary?.(settlementId);
        setInspectedEntity({ kind: 'settlement', entity: { ...s, age: ageSummary, nuclearProgram, guilds, fortifications } });
      }
    } else if (res?.reason) {
      showNotification(`⚠️ ${res.reason}`);
    }
  };

  const downloadJsonFile = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (!simRef.current) return;
    try {
      const data = simRef.current.serialize();
      localStorage.setItem('aetheria_save', JSON.stringify(data));
      setSavedMeta(readSavedWorldMeta());
      soundManager.playClick();
      showNotification('Game progress saved to local storage!');
    } catch (err) {
      console.error('Failed to save game to localStorage:', err);
      showNotification('⚠️ Save failed: browser storage quota exceeded or unavailable. Use Export JSON instead.');
    }
  };

  const applyLoadedSimulation = (loaded: Simulation, toastMsg: string) => {
    const loadedScenario = loaded._scenario === 'modern_nuclear' ? 'modern_nuclear' : 'warring';
    pendingScenarioRef.current = loadedScenario;
    setScenario(loadedScenario);

    simRef.current = loaded;
    if (rendererRef.current) {
      rendererRef.current.world = loaded.world;
      rendererRef.current.simulation = loaded;
      rendererRef.current.selectedEntity = null;
      rendererRef.current.followAgentId = null;
      if (loaded.agents && loaded.agents.length > 0) {
        rendererRef.current.centerOn(loaded.agents[0].x, loaded.agents[0].y, 14, true);
      } else {
        const firstSettlement = loaded.settlementSystem?.settlements?.values()?.next()?.value;
        if (firstSettlement?.center) {
          rendererRef.current.centerOn(firstSettlement.center.x, firstSettlement.center.y, 14, true);
        }
      }
      setRendererInstance(rendererRef.current);
    }
    if (interactionRef.current) {
      interactionRef.current.simulation = loaded;
      interactionRef.current.renderer = rendererRef.current;
      interactionRef.current.selectedEntity = null;
      interactionRef.current.setTool('inspect');
    }
    setCurrentTool('inspect');
    setSimInstance(loaded);
    setInspectedEntity(null);
    setFollowAgentId(null);
    setSpeed(loaded.clock?.speed ?? 1);
    setIsPaused((loaded.clock?.speed ?? 1) === 0);
    setChronicleEvents([]);
    setChronicleEntries(loaded.chronicleSystem?.getHighlights?.(80) || []);
    setDiplomaticHistory(Array.isArray(loaded.diplomacySystem?.diplomaticHistory) ? loaded.diplomacySystem.diplomaticHistory.slice(0, 40) : []);
    if (typeof document !== 'undefined') {
      document.body.dataset.screen = 'playing';
    }
    gameScreenRef.current = 'playing';
    setGameScreen('playing');
    soundManager.playClick();
    showNotification(toastMsg);
  };

  const handleLoad = (): boolean => {
    const data = localStorage.getItem('aetheria_save');
    if (data && simRef.current && rendererRef.current) {
      try {
        const loaded = Simulation.deserialize(JSON.parse(data));
        applyLoadedSimulation(loaded, 'Saved world loaded successfully!');
        return true;
      } catch (err) {
        console.error('Failed to load save file:', err);
        showNotification('Error loading save file.');
        return false;
      }
    } else {
      showNotification('No previous save file found!');
      return false;
    }
  };

  const handlePlayNewGame = (chosenScenario: 'warring' | 'modern_nuclear') => {
    if (typeof document !== 'undefined') {
      document.body.dataset.screen = 'playing';
    }
    gameScreenRef.current = 'playing';
    setGameScreen('playing');
    soundManager.playClick();
    pendingScenarioRef.current = chosenScenario;
    setScenario(chosenScenario);
    setInspectedEntity(null);
    setFollowAgentId(null);
    setCivilizationOpen(false);
    setHelpOpen(false);
    setWorldNonce((n) => n + 1);
  };

  const handleContinueSavedGame = () => {
    handleLoad();
  };

  const handleReturnToMenu = () => {
    setSavedMeta(readSavedWorldMeta());
    setCivilizationOpen(false);
    setHelpOpen(false);
    setGameScreen('title');
  };

  const handleExportWorld = () => {
    const sim = simRef.current;
    if (!sim) return;
    const snapshot = sim.serialize();
    downloadJsonFile(`aetheria-world-tick-${sim.clock?.tick ?? 0}.json`, snapshot);
    soundManager.playClick();
    showNotification('💾 World snapshot JSON downloaded!');
  };

  const handleExportChronicle = () => {
    const sim = simRef.current;
    if (!sim) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      seed: sim.seed,
      tick: sim.clock?.tick ?? 0,
      dominantAge: sim.civilizationAgeSystem?.getDominantAge?.() || null,
      entries: sim.chronicleSystem?.entries || [],
      diplomaticHistory: sim.diplomacySystem?.diplomaticHistory || [],
      warHistory: sim.diplomacySystem?.warHistory || [],
      fallenHeroes: sim.fallenHeroes || [],
      espionageOps: sim.espionageSystem?.operationsLog || [],
    };
    downloadJsonFile(`aetheria-chronicle-tick-${sim.clock?.tick ?? 0}.json`, payload);
    soundManager.playClick();
    showNotification('📜 Historical chronicle replay JSON downloaded!');
  };

  const handleImportWorld = async (file: File): Promise<boolean> => {
    if (!file || !simRef.current || !rendererRef.current) return false;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || (!parsed.world && !parsed.clock && !parsed.agents)) {
        showNotification('Invalid Aetheria world save JSON file.');
        return false;
      }
      const loaded = Simulation.deserialize(parsed);
      applyLoadedSimulation(loaded, `📂 Imported "${file.name}" successfully!`);
      return true;
    } catch (err) {
      console.error('Failed to import world file:', err);
      showNotification('Could not parse save file JSON.');
      return false;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 2.5D / 2D Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          cursor: 'crosshair',
        }}
      />

      {gameScreen === 'title' && (
        <StartScreen
          version={packageJson.version}
          selectedScenario={scenario}
          onSelectScenario={setScenario}
          savedMeta={savedMeta}
          onPlayNewGame={handlePlayNewGame}
          onContinueSavedGame={handleContinueSavedGame}
          onImportWorldFile={handleImportWorld}
        />
      )}

      {gameScreen === 'playing' && (
        <>
          {/* Two-Row Desktop HUD Shell (TopBar + ControlsHeader in Row 1; Side Panels in Row 2) */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              bottom: '74px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            {/* Row 1: Top-Left Telemetry & Top-Right Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                flexShrink: 0,
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <TopBar
                  time={timeState}
                  agentCount={agentCount}
                  births={births}
                  deaths={deaths}
                  avgDeathAge={avgDeathAge}
                  resources={resources}
                  societiesCount={societiesCount || societies.length}
                  speed={speed}
                  is25D={is25D}
                  weather={currentWeather || undefined}
                  dominantAge={dominantAge || undefined}
                  lodStats={lodStats || undefined}
                />
              </div>

              <div style={{ flex: '0 1 auto', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <ControlsHeader
                  is25D={is25D}
                  heightScaleLabel={heightScaleLabel}
                  isPaused={isPaused}
                  speed={speed}
                  onToggleView={handleToggleView}
                  onCycleHeight={handleCycleHeight}
                  onTogglePause={handleTogglePause}
                  onCycleSpeed={handleCycleSpeed}
                  onCenterCamera={handleCenterCamera}
                  onNextBattle={handleNextBattle}
                  onSpawnResources={handleSpawnResources}
                  onToggleSocieties={() => setSocietiesOpen((prev) => !prev)}
                  onToggleDiplomacy={() => setDiplomacyOpen((prev) => !prev)}
                  onToggleCivilization={() => setCivilizationOpen((prev) => !prev)}
                  onSave={handleSave}
                  onLoad={handleLoad}
                  onExportWorld={handleExportWorld}
                  onImportWorld={handleImportWorld}
                  onToggleHelp={() => setHelpOpen((prev) => !prev)}
                  societiesOpen={societiesOpen}
                  diplomacyOpen={diplomacyOpen}
                  civilizationOpen={civilizationOpen}
                  isMuted={isMuted}
                  onToggleMute={handleToggleMute}
                  warsCount={wars.length}
                  treatiesCount={treaties.length}
                  scenario={scenario}
                  onChangeScenario={(nextScenario) => {
                    pendingScenarioRef.current = nextScenario;
                    setInspectedEntity(null);
                    setFollowAgentId(null);
                    setScenario(nextScenario);
                    setWorldNonce((n) => n + 1);
                  }}
                  onReturnToMenu={handleReturnToMenu}
                />
              </div>
            </div>

            {/* Row 2: Right Side Panels (dynamically below Row 1, above Dock) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'stretch',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '348px',
                  maxWidth: '100%',
                  height: '100%',
                  overflowY: 'auto',
                  paddingRight: '2px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  pointerEvents: 'none',
                }}
              >
                {inspectedEntity && (
                  <div style={{ flexShrink: 0 }}>
                    <InspectorPanel
                      data={inspectedEntity}
                      isFollowing={
                        inspectedEntity.kind === 'agent' &&
                        followAgentId != null &&
                        followAgentId === inspectedEntity.entity?.id
                      }
                      onFollowAgent={handleFollowAgent}
                      onSelectAgent={handleSelectAgentById}
                      onSelectBuilding={handleSelectBuildingById}
                      onPanTo={handlePanTo}
                      onRallyWarband={handleRallyWarband}
                      onSpawnCitizens={handleSpawnSettlementCitizens}
                      onAdvanceWonder={handleAdvanceWonder}
                      onFortifySettlement={handleFortifySettlement}
                      onUpgradeBuilding={handleUpgradeBuilding}
                      onCommissionBuilding={handleCommissionBuilding}
                      onClose={() => {
                        setInspectedEntity(null);
                        if (rendererRef.current) {
                          rendererRef.current.selectedEntity = null;
                          rendererRef.current.followAgentId = null;
                        }
                        setFollowAgentId(null);
                      }}
                    />
                  </div>
                )}

                {societiesOpen && (
                  <div style={{ flexShrink: 0 }}>
                    <SocietiesPanel
                      settlements={societies}
                      onSelectSettlement={handleSelectSettlement}
                      onClose={() => setSocietiesOpen(false)}
                    />
                  </div>
                )}

                {diplomacyOpen && (
                  <div style={{ flexShrink: 0 }}>
                    <DiplomacyPanel
                      wars={wars}
                      treaties={treaties}
                      relations={relations}
                      diplomaticHistory={diplomaticHistory}
                      onSignPeace={handleSignPeace}
                      onEnforceAllPeace={handleEnforceAllPeace}
                      onProvokeWar={handleProvokeWar}
                      onFormAlliance={handleFormAlliance}
                      onImposeSanctions={handleImposeSanctions}
                      onIssueUltimatum={handleIssueUltimatum}
                      onLaunchNuke={handleLaunchNuke}
                      onLaunchSpyOp={handleLaunchSpyOp}
                      onPanTo={handlePanTo}
                      onClose={() => setDiplomacyOpen(false)}
                    />
                  </div>
                )}

                <div style={{ flexShrink: 0 }}>
                  <ChroniclePanel
                    events={chronicleEvents}
                    structuredEntries={chronicleEntries}
                    onExportWorld={handleExportWorld}
                    onExportChronicle={handleExportChronicle}
                    onPanTo={handlePanTo}
                    onSelectAgent={handleSelectAgentById}
                    onSelectBuilding={handleSelectBuildingById}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divine Powers Dock */}
          <Dock currentTool={currentTool} onSelectTool={handleSelectTool} />

          {/* Mini-Map Radar with Tactical Heatmaps */}
          <MiniMapRadar
            simulation={simInstance || simRef.current}
            renderer={rendererInstance || rendererRef.current}
            onPanTo={handlePanTo}
          />

          {/* Divine Guide Modal */}
          <GuideModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

          {/* Full-Screen Civilization, Dynasties & War Room Modal */}
          <CivilizationModal
            isOpen={civilizationOpen}
            onClose={() => setCivilizationOpen(false)}
            simulation={simInstance || simRef.current}
            onSelectAgent={handleSelectAgentById}
            onSelectBuilding={handleSelectBuildingById}
            onFollowAgent={handleFollowAgent}
            onImposeSanctions={handleImposeSanctions}
            onIssueUltimatum={handleIssueUltimatum}
            onLaunchNuke={handleLaunchNuke}
            onLaunchSpyOp={handleLaunchSpyOp}
            onAdvanceWonder={handleAdvanceWonder}
            onCommissionWonder={handleCommissionWonder}
            onExportWorld={handleExportWorld}
            onExportChronicle={handleExportChronicle}
            onImportWorld={handleImportWorld}
            onPanTo={handlePanTo}
          />
        </>
      )}

      {/* Notification Toast */}
      <NotificationToast
        message={notification}
        placement={gameScreen === 'title' ? 'title' : 'hud'}
        onDismiss={() => {
          if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
          setNotification(null);
        }}
      />
    </div>
  );
};

export default App;
