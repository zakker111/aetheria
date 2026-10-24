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
import { NotificationToast } from './components/NotificationToast';
import { MiniMapRadar } from './components/MiniMapRadar';
import { soundManager } from './systems/audio';
import {
  ToolType,
  TimeState,
  ResourceSummary,
  SettlementSummary,
  WarSummary,
  TreatySummary,
  RelationSummary,
  InspectedEntityData,
} from './types';

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const interactionRef = useRef<any>(null);

  const [simInstance, setSimInstance] = useState<any>(null);
  const [rendererInstance, setRendererInstance] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(() => soundManager.isMuted());

  // Scenario
  const [scenario, setScenario] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('scenario') || null;
    }
    return null;
  });

  // UI state
  const [currentTool, setCurrentTool] = useState<ToolType>('inspect');
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [is25D, setIs25D] = useState(true);
  const [heightScaleLabel, setHeightScaleLabel] = useState('Heights: Normal');

  const [timeState, setTimeState] = useState<TimeState>({ days: 0, hours: 0, ticks: 0 });
  const [agentCount, setAgentCount] = useState(0);
  const [births, setBirths] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [resources, setResources] = useState<ResourceSummary>({
    food: 0,
    wood: 0,
    ore: 0,
    water: 0,
    total: 0,
  });

  const [societies, setSocieties] = useState<SettlementSummary[]>([]);
  const [wars, setWars] = useState<WarSummary[]>([]);
  const [treaties, setTreaties] = useState<TreatySummary[]>([]);
  const [relations, setRelations] = useState<RelationSummary[]>([]);

  const [societiesOpen, setSocietiesOpen] = useState(true);
  const [diplomacyOpen, setDiplomacyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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

  // Initialize simulation and renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const sim = new Simulation(Date.now(), 128, 128, scenario ? { scenario } : {});
    simRef.current = sim;

    if (scenario === 'warring') {
      setTimeout(() => {
        showNotification('⚔️ Warring Kingdoms: your founding towns are hereditary rivals');
      }, 500);
    }

    const renderer = new CanvasRenderer(canvas, sim.world, sim);
    rendererRef.current = renderer;

    const interaction = new Interaction(sim, renderer);
    interactionRef.current = interaction;

    setSimInstance(sim);
    setRendererInstance(renderer);

    if (sim.agents.length > 0) {
      renderer.camera.x = sim.agents[0].x;
      renderer.camera.y = sim.agents[0].y;
      renderer.camera.zoom = 14;
    }

    // Set initial tool
    interaction.setTool('inspect');

    // Attach event bus listeners
    const handleAgentCreated = (e: any) => {
      const name = e.name || `Citizen #${e.agentId}`;
      addChronicleEntry(`👶 Newborn: ${name} entered the world.`);
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
      showNotification(`${e.icon || '🌤️'} Weather: ${e.name}`);
    };

    const handleLightning = (e: any) => {
      if (!e.manual) {
        addChronicleEntry(`⚡ Thunderclap! Lightning struck at (${e.x}, ${e.y}).`);
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

    // Custom window events
    const handleEntityInspected = (e: CustomEvent) => {
      setInspectedEntity(e.detail);
    };

    const handleShowNotification = (e: CustomEvent) => {
      if (e.detail) showNotification(e.detail);
    };

    window.addEventListener('entity_inspected', handleEntityInspected as EventListener);
    window.addEventListener('show_notification', handleShowNotification as EventListener);

    // Game animation loop
    let lastTime = 0;
    let lastUiUpdate = 0;
    let animationFrameId: number;
    const TICK_RATE = 350; // ms per tick at 1x speed

    const gameLoop = (currentTime: number) => {
      if (!lastTime) lastTime = currentTime;
      const deltaTime = currentTime - lastTime;
      const currentSpeed = sim.clock.speed;

      if (currentSpeed > 0) {
        const stepInterval = TICK_RATE / currentSpeed;
        if (deltaTime >= stepInterval) {
          const maxSteps = Math.min(2, Math.floor(deltaTime / stepInterval));
          for (let s = 0; s < maxSteps; s++) {
            sim.tick();
          }
          lastTime = currentTime;
        }
      } else {
        lastTime = currentTime;
      }

      renderer.render();

      // UI state refresh throttle (4 times/sec)
      if (currentTime - lastUiUpdate > 250) {
        const t = sim.clock.getTime();
        setTimeState(t);
        setAgentCount(sim.agents.length);
        setBirths(sim.birthsThisSession || 0);
        setDeaths(sim.deathsThisSession || 0);
        setSpeed(sim.clock.speed);
        setIsPaused(sim.clock.speed === 0);

        if (sim.weatherSystem) {
          setCurrentWeather(sim.weatherSystem.getWeatherInfo());
        }
        if (sim.civilizationAgeSystem) {
          setDominantAge(sim.civilizationAgeSystem.getDominantAge());
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
        setResources({ food, wood, ore, water, total: resList ? resList.length : 0 });

        // Settlements
        const settlementMap = sim.settlementSystem?.settlements;
        if (settlementMap) {
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
              culture: s.culture,
              growthTrend: s.growthTrend,
            });
          }
          setSocieties(sArr);

          // Diplomacy data
          const diplomacy = sim.diplomacySystem;
          if (diplomacy) {
            setWars(
              (diplomacy.activeWars || []).map((w: any) => ({
                attackerId: w.attackerId,
                attackerName: w.attackerName,
                defenderId: w.defenderId,
                defenderName: w.defenderName,
                casusBelli: w.casusBelli,
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
                  });
                }
              }
            }
            setRelations(relArr);
          }
        }

        // Live inspector refresh
        setInspectedEntity((currentInspect) => {
          if (!currentInspect || !currentInspect.entity) return null;
          if (currentInspect.kind === 'agent') {
            const stillAlive =
              typeof sim._agentById === 'function'
                ? sim._agentById(currentInspect.entity.id)
                : sim.agents.find((a: any) => a.id === currentInspect.entity.id);
            if (stillAlive && stillAlive.alive) {
              return { kind: 'agent', entity: stillAlive };
            }
            return null;
          } else if (currentInspect.kind === 'settlement') {
            const updated = sim.settlementSystem?.settlements.get(currentInspect.entity.id);
            if (updated) {
              const ageSummary = sim.civilizationAgeSystem?.getSettlementAgeSummary(updated.id);
              return { kind: 'settlement', entity: { ...updated, age: ageSummary } };
            }
            return null;
          } else if (currentInspect.kind === 'building') {
            const bId = currentInspect.entity.id;
            const stillBuilding = sim.buildings.find((b: any) => b.id === bId);
            if (stillBuilding && (stillBuilding.health === undefined || stillBuilding.health > 0)) {
              return { kind: 'building', entity: stillBuilding };
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
    };
  }, [addChronicleEntry, showNotification, scenario]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Action handlers
  const handleToggleScenario = () => {
    const nextScenario = scenario === 'warring' ? null : 'warring';
    setScenario(nextScenario);

    const url = new URL(window.location.href);
    if (nextScenario) {
      url.searchParams.set('scenario', nextScenario);
    } else {
      url.searchParams.delete('scenario');
    }
    window.history.replaceState({}, '', url.toString());

    if (nextScenario === 'warring') {
      showNotification('⚔️ Warring Kingdoms: founding towns initialized as hereditary rivals!');
      setChronicleEvents((prev) => [
        '⚔️ Warring Kingdoms era begins! Founding settlements declare immediate blood feuds.',
        ...prev,
      ]);
    } else {
      showNotification('🌿 Peaceful World: civilizations awaken in tranquil harmony.');
      setChronicleEvents((prev) => [
        '🌿 Peaceful World awakened. Autonomous tribes gather and build harmoniously.',
        ...prev,
      ]);
    }
  };

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
      const target: InspectedEntityData = {
        entity: { ...fullSettlement, age: ageSummary },
        kind: 'settlement',
      };
      rendererRef.current.selectedEntity = target;
      setInspectedEntity(target);
    }
    showNotification(`View centered on ${s.name}`);
  };

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
      simRef.current.diplomacySystem.declareWar(s1, s2, 'Territorial Expansion');
      showNotification('⚔️ War ignited between realms!');
    }
  };

  const handleFormAlliance = (s1: number, s2: number) => {
    if (simRef.current?.diplomacySystem) {
      simRef.current.diplomacySystem.formAlliance(s1, s2, simRef.current.clock.tick);
      showNotification('🤝 Grand Alliance pact sworn!');
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
      const updated = simRef.current.settlementSystem?.settlements.get(settlementId);
      if (updated) {
        setInspectedEntity({ kind: 'settlement', entity: updated });
      }
    } else {
      showNotification(`Not enough healthy adult citizens in ${sName}.`);
    }
  };

  const handleToggleMute = () => {
    const next = soundManager.toggleMute();
    setIsMuted(next);
    showNotification(next ? '🔇 Sound muted' : '🔊 Sound enabled');
  };

  const handleSave = () => {
    if (!simRef.current) return;
    const data = simRef.current.serialize();
    localStorage.setItem('aetheria_save', JSON.stringify(data));
    soundManager.playClick();
    showNotification('Game progress saved to local storage!');
  };

  const handleLoad = () => {
    const data = localStorage.getItem('aetheria_save');
    if (data && simRef.current && rendererRef.current) {
      try {
        const loaded = Simulation.deserialize(JSON.parse(data));
        simRef.current = loaded;
        rendererRef.current.world = loaded.world;
        rendererRef.current.simulation = loaded;
        if (interactionRef.current) {
          interactionRef.current.simulation = loaded;
          interactionRef.current.renderer = rendererRef.current;
        }
        setSimInstance(loaded);
        setRendererInstance(rendererRef.current);
        soundManager.playClick();
        showNotification('Saved world loaded successfully!');
      } catch (err) {
        console.error('Failed to load save file:', err);
        showNotification('Error loading save file.');
      }
    } else {
      showNotification('No previous save file found!');
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

      {/* Top Bar & Controls */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
          zIndex: 20,
          gap: '12px',
        }}
      >
        <TopBar
          time={timeState}
          agentCount={agentCount}
          births={births}
          deaths={deaths}
          resources={resources}
          societiesCount={societies.length}
          speed={speed}
          is25D={is25D}
          weather={currentWeather || undefined}
          dominantAge={dominantAge || undefined}
        />

        <ControlsHeader
          is25D={is25D}
          heightScaleLabel={heightScaleLabel}
          isPaused={isPaused}
          speed={speed}
          scenario={scenario}
          onToggleScenario={handleToggleScenario}
          onToggleView={handleToggleView}
          onCycleHeight={handleCycleHeight}
          onTogglePause={handleTogglePause}
          onCycleSpeed={handleCycleSpeed}
          onCenterCamera={handleCenterCamera}
          onSpawnResources={handleSpawnResources}
          onToggleSocieties={() => setSocietiesOpen((prev) => !prev)}
          onToggleDiplomacy={() => setDiplomacyOpen((prev) => !prev)}
          onSave={handleSave}
          onLoad={handleLoad}
          onToggleHelp={() => setHelpOpen((prev) => !prev)}
          societiesOpen={societiesOpen}
          diplomacyOpen={diplomacyOpen}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      </div>

      {/* Right Side Panels */}
      <div
        style={{
          position: 'absolute',
          top: '76px',
          right: '12px',
          width: '320px',
          maxHeight: 'calc(100vh - 170px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 15,
          pointerEvents: 'none',
        }}
      >
        {societiesOpen && (
          <SocietiesPanel
            settlements={societies}
            onSelectSettlement={handleSelectSettlement}
            onClose={() => setSocietiesOpen(false)}
          />
        )}

        {diplomacyOpen && (
          <DiplomacyPanel
            wars={wars}
            treaties={treaties}
            relations={relations}
            onSignPeace={handleSignPeace}
            onEnforceAllPeace={handleEnforceAllPeace}
            onProvokeWar={handleProvokeWar}
            onFormAlliance={handleFormAlliance}
            onClose={() => setDiplomacyOpen(false)}
          />
        )}

        {inspectedEntity && (
          <InspectorPanel
            data={inspectedEntity}
            onRallyWarband={handleRallyWarband}
            onClose={() => {
              setInspectedEntity(null);
              if (rendererRef.current) rendererRef.current.selectedEntity = null;
            }}
          />
        )}

        <ChroniclePanel events={chronicleEvents} />
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

      {/* Notification Toast */}
      <NotificationToast message={notification} />
    </div>
  );
};

export default App;
