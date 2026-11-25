import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { WorldHudSnapshot } from '../simulation/worldSnapshot';
import type { InspectedEntityData } from '../types';

export interface GodEffectEvent {
  type: 'bless' | 'bounty' | 'smite' | 'nuke';
  x: number;
  y: number;
  duration?: number;
}

export interface WorldClickEvent {
  x: number;
  y: number;
}

type Listener<T> = (payload: T) => void;

export const EMPTY_HUD_SNAPSHOT: WorldHudSnapshot = {
  time: { days: 0, hours: 0, tick: 0 },
  agentCount: 0,
  births: 0,
  deaths: 0,
  avgDeathAge: 0,
  speed: 1,
  isPaused: false,
  lodStats: null,
  weather: null,
  dominantAge: null,
  resources: { food: 0, wood: 0, ore: 0, water: 0, total: 0 },
  societiesCount: 0,
  societies: null,
  wars: [],
  treaties: [],
  relations: [],
  diplomaticHistory: [],
  chronicleEntries: [],
};

let currentHudSnapshot: WorldHudSnapshot = EMPTY_HUD_SNAPSHOT;
const hudListeners = new Set<() => void>();
const godEffectListeners = new Set<Listener<GodEffectEvent>>();
const notificationListeners = new Set<Listener<string>>();
const inspectListeners = new Set<Listener<InspectedEntityData | null>>();
const worldClickListeners = new Set<Listener<WorldClickEvent>>();

export function publishWorldHudSnapshot(next: WorldHudSnapshot): void {
  currentHudSnapshot = next;
  for (const listener of hudListeners) {
    listener();
  }
}

export function resetWorldHudSnapshot(): void {
  currentHudSnapshot = EMPTY_HUD_SNAPSHOT;
  for (const listener of hudListeners) {
    listener();
  }
}

export function getWorldHudSnapshot(): WorldHudSnapshot {
  return currentHudSnapshot;
}

export function subscribeWorldHudSnapshot(listener: () => void): () => void {
  hudListeners.add(listener);
  return () => {
    hudListeners.delete(listener);
  };
}

export function useWorldHudSelector<T>(
  selector: (snap: WorldHudSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const cacheRef = useRef<{
    initialized: boolean;
    value: T;
  }>({
    initialized: false,
    value: undefined as unknown as T,
  });

  const getSelected = useCallback((): T => {
    const cache = cacheRef.current;
    const nextValue = selector(currentHudSnapshot);
    if (cache.initialized && isEqual(cache.value, nextValue)) {
      return cache.value;
    }
    cache.initialized = true;
    cache.value = nextValue;
    return nextValue;
  }, [selector, isEqual]);

  return useSyncExternalStore(subscribeWorldHudSnapshot, getSelected, getSelected);
}

export function emitGodEffect(effect: GodEffectEvent): void {
  for (const listener of godEffectListeners) {
    listener(effect);
  }
}

export function subscribeGodEffects(listener: Listener<GodEffectEvent>): () => void {
  godEffectListeners.add(listener);
  return () => {
    godEffectListeners.delete(listener);
  };
}

export function emitNotification(message: string): void {
  for (const listener of notificationListeners) {
    listener(message);
  }
}

export function subscribeNotifications(listener: Listener<string>): () => void {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

export function emitInspectEntity(entity: InspectedEntityData | null): void {
  for (const listener of inspectListeners) {
    listener(entity);
  }
}

export function subscribeEntityInspect(
  listener: Listener<InspectedEntityData | null>
): () => void {
  inspectListeners.add(listener);
  return () => {
    inspectListeners.delete(listener);
  };
}

export function emitWorldClick(pos: WorldClickEvent): void {
  for (const listener of worldClickListeners) {
    listener(pos);
  }
}

export function subscribeWorldClick(listener: Listener<WorldClickEvent>): () => void {
  worldClickListeners.add(listener);
  return () => {
    worldClickListeners.delete(listener);
  };
}
