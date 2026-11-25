export type ToolType =
  | 'inspect'
  | 'spawn_agent'
  | 'create_food'
  | 'create_water'
  | 'create_wood'
  | 'create_ore'
  | 'create_iron_mountain'
  | 'create_uranium_mountain'
  | 'create_bounty'
  | 'build_house'
  | 'build_workshop'
  | 'build_farm'
  | 'build_temple'
  | 'build_dock'
  | 'build_bridge'
  | 'build_wall'
  | 'build_tower'
  | 'rain'
  | 'lightning'
  | 'douse'
  | 'declare_war'
  | 'rally_army'
  | 'enforce_peace'
  | 'bless'
  | 'inspire_faith'
  | 'nuke'
  | 'smite'
  | 'remove';

export interface TimeState {
  days: number;
  hours: number;
  tick: number;
}

export interface ResourceSummary {
  food: number;
  wood: number;
  ore: number;
  water: number;
  total: number;
}

export interface NuclearInfraSummary {
  hasFactory: boolean;
  hasResearchLab: boolean;
  hasNuclearPlant: boolean;
  hasMissileSilo: boolean;
  factoryCount?: number;
  labCount?: number;
  plantCount?: number;
  siloCount?: number;
  canEnrich: boolean;
  canLaunch: boolean;
}

export interface NuclearProgramSummary {
  unlocked: boolean;
  progress: number;
  warheads: number;
  totalStrikes: number;
  doctrine?: string;
  infra?: NuclearInfraSummary;
}

export interface WonderSummary {
  key: string;
  name: string;
  icon: string;
  eraId: number;
  buffKey: string;
  buffLabel: string;
  stage: number;
  maxStage: number;
  progress: number;
  complete: boolean;
}

export interface GuildSummary {
  unlocked: { merchant: boolean; masons: boolean; shadows: boolean };
  influence: { merchant: number; masons: number; shadows: number };
  counterIntelUntil: number;
  opsSuccess: number;
  opsDetected: number;
}

export interface EspionageOpEntry {
  id: number;
  tick: number;
  opType: string;
  fromId: number;
  fromName: string;
  targetId: number;
  targetName: string;
  success: boolean;
  detected: boolean;
  title: string;
  what: string;
  why: string;
  drivers: string[];
  x?: number | null;
  y?: number | null;
}

export interface ChronicleEntrySummary {
  id: number;
  tick: number;
  date: string;
  kind: string;
  eraId?: number;
  eraName?: string;
  text: string;
  icon?: string;
  x?: number;
  y?: number;
  agentId?: number;
  killerId?: number;
  victimId?: number;
  builderId?: number;
  buildingId?: number;
}

export interface FortificationSummary {
  hasWalls: boolean;
  tierKey: string;
  tierName: string;
  totalSegments: number;
  intactWalls: number;
  gates: number;
  intactGates: number;
  breaches: number;
  towers: number;
  defenseMultiplier: number;
}

export interface SettlementSummary {
  id: number;
  name: string;
  tier: string;
  tierIcon: string;
  population: number;
  center: { x: number; y: number };
  stockpile: { food: number; wood: number; ore: number; stone?: number };
  leadership?: string;
  leadershipTitle?: string;
  buildingsCount: number;
  age?: {
    id: number;
    name: string;
    icon: string;
    color: string;
    description: string;
    monumentName?: string;
    monumentProgress?: number;
    hasMonument?: boolean;
    wonder?: WonderSummary | null;
    wonderBuffs?: { completedKeys: string[] };
  };
  nuclearProgram?: NuclearProgramSummary;
  guilds?: GuildSummary;
  fortifications?: FortificationSummary;
  culture?: {
    symbol?: string;
    ethos?: string;
    values?: {
      industriousness?: number;
      cooperation?: number;
      spirituality?: number;
      belligerence?: number;
      traditionalism?: number;
    };
    traditions?: string[];
  };
  growthTrend?: string;
}

export type ScenarioMode = 'modern_nuclear' | 'warring';

export interface WarSummary {
  attackerId: number;
  attackerName: string;
  defenderId: number;
  defenderName: string;
  casusBelli: string;
  whySummary?: string;
  drivers?: string[];
  warScore?: number;
  totalWar?: boolean;
  casualties: { [settlementId: number]: number };
  plundered: { food: number; wood: number; ore: number };
}

export interface TreatySummary {
  title: string;
  settlements: [number, number];
}

export interface RelationSummary {
  s1Id: number;
  s1Name: string;
  s2Id: number;
  s2Name: string;
  status: 'alliance' | 'war' | 'tension' | 'peace';
  score: number;
  sanctioned?: boolean;
  s1Warheads?: number;
  s2Warheads?: number;
}

export interface DiplomaticLogEntry {
  id: number;
  tick: number;
  type: string;
  outcome: string;
  title: string;
  what: string;
  why: string;
  drivers: string[];
  actors: number[];
  actorNames: string[];
  x?: number | null;
  y?: number | null;
}

export interface AgentLifeEvent {
  tick: number;
  year: number;
  kind: string;
  icon?: string;
  text: string;
  milestone?: boolean;
  eraId?: number;
  eraName?: string;
  eraIcon?: string;
}

export interface AgentHeirloom {
  name: string;
  kind: string;
  originName?: string;
  originYear?: number;
  inheritedFrom?: string;
  generationsHeld?: number;
}

export interface AgentRelativeRef {
  id: number;
  name: string;
  alive: boolean;
  score?: number;
  label?: string;
}

export interface BuildingUpgradeRecord {
  level: number;
  byAgentId?: number | null;
  byName: string;
  year: number;
  eraId: number;
  eraName: string;
}

export interface BuiltStructureRef {
  id: number;
  buildingType: string;
  name: string;
  customName?: string | null;
  level: number;
  maxLevel: number;
  settlementName?: string | null;
  builtYear?: number | null;
  builtInEra?: number | null;
  builtEraName?: string | null;
  isHeritage: boolean;
  isRuined: boolean;
  role: 'lead' | 'renovator' | 'contributor';
  x: number;
  y: number;
}

export interface AgentDossier {
  id: number;
  name: string;
  surname?: string | null;
  fullName?: string;
  epithet?: string | null;
  age: number;
  maxAge: number;
  lifeStage: string;
  gender: string;
  alive: boolean;
  deathCause?: string | null;
  deathTick?: number | null;
  job: string;
  jobTitle: string;
  settlementId?: number | null;
  settlementName: string;
  generation: number;
  buildingsBuilt?: number;
  builtStructures?: BuiltStructureRef[];
  heirloom?: AgentHeirloom | null;
  biography?: string;
  x?: number;
  y?: number;
  traits: Record<string, number>;
  skills: Record<string, number>;
  kills: number;
  battlesFought: number;
  veteranCampaigns: number;
  legendaryWeapon?: string | null;
  isMonarch: boolean;
  isRebel: boolean;
  captive: boolean;
  combatRole?: string | null;
  faith: number;
  beliefId?: string | null;
  reputation: number;
  parents: AgentRelativeRef[];
  spouse?: AgentRelativeRef | null;
  children: AgentRelativeRef[];
  siblings: AgentRelativeRef[];
  friends: AgentRelativeRef[];
  rivals: AgentRelativeRef[];
  lifeHistory: AgentLifeEvent[];
}

export interface HistoricalPersonSummary {
  id: number;
  name: string;
  surname?: string | null;
  fullName: string;
  epithet?: string | null;
  age: number;
  job?: string;
  jobTitle: string;
  settlementId?: number | null;
  settlementName: string;
  generation: number;
  isMonarch: boolean;
  kills: number;
  battlesFought: number;
  buildingsBuilt: number;
  legendaryWeapon?: string | null;
  heirloom?: AgentHeirloom | null;
  biography: string;
  x?: number | null;
  y?: number | null;
  deathCause?: string | null;
  deathTick?: number | null;
  lifeHistoryCount?: number;
}

export interface HouseHeirloomRef extends AgentHeirloom {
  holderId: number;
  holderName: string;
  holderAlive: boolean;
}

export interface FamilyBloodlineSummary {
  surname: string;
  livingCount: number;
  fallenCount: number;
  maxGeneration: number;
  totalKills?: number;
  totalBuildingsBuilt?: number;
  originSettlement?: string | null;
  totalMembersCount?: number;
  activeSettlements: string[];
  heirloomNames: string[];
  heirlooms?: HouseHeirloomRef[];
  members: Array<{
    id: number;
    fullName: string;
    alive: boolean;
    age: number;
    generation: number;
    isMonarch: boolean;
    jobTitle: string;
    settlementName?: string;
    epithet?: string | null;
    kills: number;
    buildingsBuilt: number;
    heirloomName?: string | null;
    heirloom?: AgentHeirloom | null;
  }>;
}

export interface HistoricalPeopleRoster {
  livingLegends: HistoricalPersonSummary[];
  familyLines: FamilyBloodlineSummary[];
  fallenArchives: HistoricalPersonSummary[];
}

export interface InspectedEntityData {
  kind: 'agent' | 'settlement' | 'building' | 'resource';
  entity: any;
  dossier?: AgentDossier | null;
  upgradeReq?: any;
}
