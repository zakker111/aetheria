import { SavedWorldMeta } from '../components/StartScreen';

const DB_NAME = 'aetheria_db';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAVE_KEY = 'aetheria_save';
const META_KEY = 'aetheria_save_meta';

interface StoredSaveRecord {
  version: number;
  savedAt: number;
  compressed: boolean;
  payload: ArrayBuffer | Uint8Array | string;
  meta: SavedWorldMeta;
}

export interface SaveWorldResult {
  ok: boolean;
  storage: 'indexeddb' | 'localstorage';
  compressed: boolean;
  bytes: number;
  meta: SavedWorldMeta;
  error?: string;
}

export interface LoadWorldResult {
  data: any | null;
  storage: 'indexeddb' | 'localstorage' | null;
  compressed?: boolean;
}

export function extractSavedWorldMeta(parsed: any): SavedWorldMeta | null {
  if (!parsed || typeof parsed !== 'object' || (!parsed.world && !parsed.agents)) {
    return null;
  }
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
}

export function readLegacySavedWorldMetaSync(): SavedWorldMeta | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const compactMeta = localStorage.getItem(META_KEY);
    if (compactMeta) {
      const parsedMeta = JSON.parse(compactMeta);
      if (parsedMeta && parsedMeta.exists) {
        return {
          exists: true,
          days: Number(parsedMeta.days || 0),
          settlementsCount: Number(parsedMeta.settlementsCount || 0),
          agentsCount: Number(parsedMeta.agentsCount || 0),
          scenario: parsedMeta.scenario === 'modern_nuclear' ? 'modern_nuclear' : 'warring',
        };
      }
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return extractSavedWorldMeta(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCompactMeta(meta: SavedWorldMeta): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Non-critical if localStorage is full or unavailable
  }
}

async function compressJsonString(json: string): Promise<{ payload: ArrayBuffer | string; compressed: boolean; bytes: number }> {
  const rawBytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const compressedStream = new Blob([rawBytes.slice().buffer]).stream().pipeThrough(cs);
      const buf = await new Response(compressedStream).arrayBuffer();
      return { payload: buf, compressed: true, bytes: buf.byteLength };
    } catch {
      // Fallback to raw JSON string if gzip stream fails
    }
  }
  return { payload: json, compressed: false, bytes: rawBytes.byteLength };
}

async function decompressPayload(payload: ArrayBuffer | Uint8Array | string, compressed: boolean): Promise<string> {
  if (!compressed && typeof payload === 'string') {
    return payload;
  }
  let buf: ArrayBuffer;
  if (payload instanceof ArrayBuffer) {
    buf = payload;
  } else if (payload instanceof Uint8Array) {
    buf = payload.slice().buffer;
  } else {
    buf = new TextEncoder().encode(String(payload)).buffer;
  }

  if (compressed && typeof DecompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const decompressedStream = new Blob([buf]).stream().pipeThrough(ds);
    const outBuf = await new Response(decompressedStream).arrayBuffer();
    return new TextDecoder().decode(outBuf);
  }
  return new TextDecoder().decode(buf);
}

function openSaveDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function readIdbRecord(): Promise<StoredSaveRecord | null> {
  const db = await openSaveDatabase();
  try {
    return await new Promise<StoredSaveRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SAVE_KEY);
      req.onsuccess = () => resolve((req.result as StoredSaveRecord) || null);
      req.onerror = () => reject(req.error || new Error('Failed to read save from IndexedDB'));
    });
  } finally {
    db.close();
  }
}

async function writeIdbRecord(record: StoredSaveRecord): Promise<void> {
  const db = await openSaveDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record, SAVE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to write save to IndexedDB'));
    });
  } finally {
    db.close();
  }
}

export async function saveWorldToStorage(data: any): Promise<SaveWorldResult> {
  const meta: SavedWorldMeta = extractSavedWorldMeta(data) || {
    exists: true,
    days: 0,
    settlementsCount: 0,
    agentsCount: 0,
    scenario: data?.scenario === 'modern_nuclear' ? 'modern_nuclear' : 'warring',
  };
  const json = JSON.stringify(data);
  const { payload, compressed, bytes } = await compressJsonString(json);

  // 1. Primary path: Compressed IndexedDB storage (avoids ~5MB localStorage limit)
  try {
    await writeIdbRecord({
      version: 1,
      savedAt: Date.now(),
      compressed,
      payload,
      meta,
    });
    writeCompactMeta(meta);
    // Clean up legacy huge localStorage blob if IndexedDB write succeeded
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SAVE_KEY);
      }
    } catch {
      // Ignore cleanup errors
    }
    return {
      ok: true,
      storage: 'indexeddb',
      compressed,
      bytes,
      meta,
    };
  } catch (idbErr) {
    // 2. Fallback path: localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, json);
        writeCompactMeta(meta);
        return {
          ok: true,
          storage: 'localstorage',
          compressed: false,
          bytes: json.length,
          meta,
        };
      }
    } catch (lsErr) {
      return {
        ok: false,
        storage: 'localstorage',
        compressed: false,
        bytes: json.length,
        meta,
        error: String(lsErr || idbErr),
      };
    }
    return {
      ok: false,
      storage: 'indexeddb',
      compressed,
      bytes,
      meta,
      error: String(idbErr),
    };
  }
}

export async function loadWorldFromStorage(): Promise<LoadWorldResult> {
  // 1. Check IndexedDB first
  try {
    const record = await readIdbRecord();
    if (record && record.payload != null) {
      const json = await decompressPayload(record.payload, Boolean(record.compressed));
      const parsed = JSON.parse(json);
      return {
        data: parsed,
        storage: 'indexeddb',
        compressed: Boolean(record.compressed),
      };
    }
  } catch {
    // Fall back to localStorage below
  }

  // 2. Fallback to legacy localStorage save & opportunistically migrate into IndexedDB
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Opportunistically migrate legacy save to compressed IndexedDB
        void saveWorldToStorage(parsed);
        return {
          data: parsed,
          storage: 'localstorage',
          compressed: false,
        };
      }
    } catch {
      return { data: null, storage: null };
    }
  }

  return { data: null, storage: null };
}

export async function readSavedWorldMetaFromStorage(): Promise<SavedWorldMeta | null> {
  try {
    const record = await readIdbRecord();
    if (record) {
      if (record.meta && record.meta.exists) {
        writeCompactMeta(record.meta);
        return record.meta;
      }
      if (record.payload != null) {
        const json = await decompressPayload(record.payload, Boolean(record.compressed));
        const meta = extractSavedWorldMeta(JSON.parse(json));
        if (meta) {
          writeCompactMeta(meta);
          return meta;
        }
      }
    }
  } catch {
    // Fall back to localStorage meta
  }
  return readLegacySavedWorldMetaSync();
}
