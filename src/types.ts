export type ToolType =
  | 'inspect'
  | 'spawn_agent'
  | 'create_food'
  | 'create_water'
  | 'create_wood'
  | 'create_ore'
  | 'create_bounty'
  | 'build_house'
  | 'build_workshop'
  | 'build_farm'
  | 'rain'
  | 'lightning'
  | 'douse'
  | 'declare_war'
  | 'rally_army'
  | 'enforce_peace'
  | 'bless'
  | 'smite'
  | 'remove';

export interface TimeState {
  days: number;
  hours: number;
  ticks: number;
}

export interface ResourceSummary {
  food: number;
  wood: number;
  ore: number;
  water: number;
  total: number;
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
  };
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

export interface WarSummary {
  attackerId: number;
  attackerName: string;
  defenderId: number;
  defenderName: string;
  casusBelli: string;
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
}

export interface InspectedEntityData {
  kind: 'agent' | 'settlement' | 'building' | 'resource';
  entity: any;
}
