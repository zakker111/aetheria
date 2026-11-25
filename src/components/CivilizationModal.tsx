import React, { useState } from 'react';
import { DynastiesTab } from './civilization/DynastiesTab';
import { DiplomacyTab } from './civilization/DiplomacyTab';
import { WarRoomTab } from './civilization/WarRoomTab';
import { WondersTab } from './civilization/WondersTab';
import { HeroesAndArchivesTab } from './civilization/HeroesAndArchivesTab';
import { StatisticsTab } from './civilization/StatisticsTab';

export interface CivilizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulation: any;
  onSelectAgent?: (id: number) => void;
  onSelectBuilding?: (buildingId: number) => void;
  onImposeSanctions?: (fromId: number, targetId: number) => void;
  onIssueUltimatum?: (fromId: number, targetId: number, demand?: string) => void;
  onLaunchNuke?: (attackerId: number, targetId: number) => void;
  onLaunchSpyOp?: (fromId: number, targetId: number, opType?: string) => void;
  onAdvanceWonder?: (settlementId: number) => void;
  onCommissionWonder?: (settlementId: number, wonderKey: string) => void;
  onExportWorld?: () => void;
  onExportChronicle?: () => void;
  onImportWorld?: (file: File) => void;
  onPanTo?: (x: number, y: number) => void;
  onFollowAgent?: (id: number) => void;
}

type ModalTab = 'dynasties' | 'diplomacy' | 'warroom' | 'wonders' | 'heroes' | 'statistics';

const simInstanceIds = new WeakMap<object, number>();
let nextSimInstanceId = 1;

function getSimInstanceKey(sim: object): number {
  let id = simInstanceIds.get(sim);
  if (id === undefined) {
    id = nextSimInstanceId++;
    simInstanceIds.set(sim, id);
  }
  return id;
}

export const CivilizationModal: React.FC<CivilizationModalProps> = ({
  isOpen,
  onClose,
  simulation,
  onSelectAgent,
  onSelectBuilding,
  onImposeSanctions,
  onIssueUltimatum,
  onLaunchNuke,
  onLaunchSpyOp,
  onAdvanceWonder,
  onCommissionWonder,
  onExportWorld,
  onExportChronicle,
  onImportWorld,
  onPanTo,
  onFollowAgent,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('dynasties');
  const [, setUiRevision] = useState(0);

  if (!isOpen || !simulation) return null;

  const sim = simulation;
  const simInstanceKey = getSimInstanceKey(sim);
  const dynasties: any[] = sim.dynastySystem ? Array.from(sim.dynastySystem.dynasties.values()) : [];
  const settlements: any[] = sim.settlementSystem
    ? Array.from(sim.settlementSystem.settlements.values())
    : [];
  const wars: any[] = sim.diplomacySystem ? sim.diplomacySystem.activeWars || [] : [];
  const warHistory: any[] = sim.diplomacySystem ? sim.diplomacySystem.warHistory || [] : [];
  const treaties: any[] = sim.diplomacySystem ? sim.diplomacySystem.treaties || [] : [];
  const activeCivilWars = dynasties.filter((d) => d.civilWar?.active);
  const bumpUi = () => setUiRevision((n) => n + 1);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col text-slate-50">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-7 md:py-4 border-b border-white/10 bg-slate-900/60">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center text-xl shadow-md shadow-amber-500/30 shrink-0">
            👑
          </div>
          <div className="min-w-0">
            <h1 className="m-0 text-base md:text-lg font-bold tracking-wide text-slate-50 truncate font-display">
              Imperial Chancellery &amp; Realm Chronicles
            </h1>
            <div className="text-xs text-slate-400 flex gap-2 flex-wrap">
              <span>{settlements.length} Sovereign Settlements</span>
              <span aria-hidden="true">·</span>
              <span>{dynasties.length} Ruling Dynasties</span>
              <span aria-hidden="true">·</span>
              <span>{wars.length} Active Wars</span>
              {sim.mortalityStats && sim.mortalityStats.totalDeaths > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300 font-mono-tabular">
                    💀 Avg Death Age:{' '}
                    <strong className="text-amber-400">
                      {sim.mortalityStats.averageAgeAtDeath.toFixed(1)}y
                    </strong>{' '}
                    ({sim.mortalityStats.totalDeaths} deaths)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/70 p-1 rounded-[10px] border border-white/8 overflow-x-auto max-w-[calc(100vw-88px)]">
            <button
              onClick={() => setActiveTab('dynasties')}
              className={`py-2 px-3 md:px-4 rounded-lg border-0 font-semibold text-xs md:text-[13px] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'dynasties'
                  ? 'bg-sky-400 text-slate-900'
                  : 'bg-transparent text-slate-300 hover:text-white'
              }`}
            >
              <span>👑</span>
              <span>Dynasties &amp; Lineages</span>
            </button>

            <button
              onClick={() => setActiveTab('diplomacy')}
              className={`py-2 px-3 md:px-4 rounded-lg border-0 font-semibold text-xs md:text-[13px] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'diplomacy'
                  ? 'bg-sky-400 text-slate-900'
                  : 'bg-transparent text-slate-300 hover:text-white'
              }`}
            >
              <span>🌐</span>
              <span>Realpolitik Network</span>
            </button>

            <button
              onClick={() => setActiveTab('warroom')}
              className={`py-2 px-3 md:px-4 rounded-lg border-0 font-semibold text-xs md:text-[13px] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'warroom'
                  ? 'bg-rose-500 text-white'
                  : 'bg-transparent text-slate-300 hover:text-white'
              }`}
            >
              <span>⚔️</span>
              <span>War Room ({wars.length + activeCivilWars.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('wonders')}
              className={`py-2 px-3 rounded-lg border-0 font-semibold text-xs md:text-[13px] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'wonders'
                  ? 'bg-emerald-500 text-slate-900'
                  : 'bg-transparent text-slate-300 hover:text-white'
              }`}
            >
              <span>🏛️</span>
              <span>Wonders &amp; Guilds</span>
            </button>

            <button
              onClick={() => setActiveTab('heroes')}
              className={`py-2 px-3 rounded-lg border-0 font-semibold text-xs md:text-[13px] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'heroes'
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-transparent text-slate-300 hover:text-white'
              }`}
            >
              <span>👑</span>
              <span>People &amp; Legends</span>
            </button>

            <button
              onClick={() => setActiveTab('statistics')}
              className={`py-2 px-3 rounded-lg border-0 font-semibold text-xs md:text-[13px] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'statistics'
                  ? 'bg-violet-400 text-slate-950'
                  : 'bg-transparent text-slate-300 hover:text-white'
              }`}
            >
              <span>📊</span>
              <span>Statistics &amp; Charts</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="bg-white/8 border border-white/12 text-slate-300 rounded-lg w-9 h-9 cursor-pointer flex items-center justify-center text-base hover:bg-white/16 shrink-0"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div key={simInstanceKey} className="flex-1 overflow-hidden flex">
        {activeTab === 'dynasties' && (
          <DynastiesTab
            simulation={sim}
            dynasties={dynasties}
            settlements={settlements}
            onPanTo={onPanTo}
            onRefresh={bumpUi}
          />
        )}

        {activeTab === 'diplomacy' && (
          <DiplomacyTab
            simulation={sim}
            settlements={settlements}
            treaties={treaties}
            onImposeSanctions={onImposeSanctions}
            onIssueUltimatum={onIssueUltimatum}
            onLaunchNuke={onLaunchNuke}
            onPanTo={onPanTo}
            onClose={onClose}
            onRefresh={bumpUi}
          />
        )}

        {activeTab === 'warroom' && (
          <WarRoomTab
            simulation={sim}
            settlements={settlements}
            wars={wars}
            warHistory={warHistory}
            activeCivilWars={activeCivilWars}
            onPanTo={onPanTo}
            onClose={onClose}
            onRefresh={bumpUi}
          />
        )}

        {activeTab === 'wonders' && (
          <WondersTab
            simulation={sim}
            settlements={settlements}
            onAdvanceWonder={onAdvanceWonder}
            onCommissionWonder={onCommissionWonder}
            onLaunchSpyOp={onLaunchSpyOp}
            onPanTo={onPanTo}
            onClose={onClose}
            onRefresh={bumpUi}
          />
        )}

        {activeTab === 'heroes' && (
          <HeroesAndArchivesTab
            simulation={sim}
            settlements={settlements}
            wars={wars}
            warHistory={warHistory}
            onSelectAgent={onSelectAgent}
            onSelectBuilding={onSelectBuilding}
            onExportWorld={onExportWorld}
            onExportChronicle={onExportChronicle}
            onImportWorld={onImportWorld}
            onPanTo={onPanTo}
            onFollowAgent={onFollowAgent}
            onClose={onClose}
          />
        )}

        {activeTab === 'statistics' && (
          <StatisticsTab
            simulation={sim}
            onPanTo={onPanTo}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
};

export default CivilizationModal;
