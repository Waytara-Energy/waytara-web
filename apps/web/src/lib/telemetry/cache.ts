// Browser-side cache for telemetry series, so a returning visit paints instantly from this device
// (stale-while-revalidate) instead of waiting on the network.
//
//  - IndexedDB when available, an in-memory Map otherwise (private windows, SSR, blocked storage) - every
//    failure degrades to "no cache", never to an error on screen.
//  - Everything is scoped by the signed-in user id and a schema version, and wiped on sign-out, so one
//    person's readings are never shown to another on a shared computer.
//  - Bounded: at most MAX_ENTRIES entries; the oldest are evicted first.

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "waytara-telemetry";
const STORE = "kv";
const VERSION = "v1";
const MAX_ENTRIES = 300;
const INDEX_KEY = "__index__";

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, v),
    delete: async (k) => void m.delete(k),
    clear: async () => m.clear(),
  };
}

export function idbKV(): KV {
  if (typeof indexedDB === "undefined") return memoryKV();
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  return {
    get: (k) => run("readonly", (s) => s.get(k)),
    set: (k, v) => run("readwrite", (s) => s.put(v, k)).then(() => undefined),
    delete: (k) => run("readwrite", (s) => s.delete(k)).then(() => undefined),
    clear: () => run("readwrite", (s) => s.clear()).then(() => undefined),
  };
}

interface Entry<T> {
  value: T;
  savedAt: number;
}
type Index = Record<string, number>;

export class PersistentCache {
  constructor(private readonly kv: KV, private readonly scope: string, private readonly now: () => number = Date.now) {}

  private k(key: string) {
    return `${VERSION}|${this.scope}|${key}`;
  }

  async load<T>(key: string): Promise<Entry<T> | undefined> {
    try {
      return (await this.kv.get(this.k(key))) as Entry<T> | undefined;
    } catch {
      return undefined;
    }
  }

  async save<T>(key: string, value: T): Promise<void> {
    try {
      const full = this.k(key);
      await this.kv.set(full, { value, savedAt: this.now() } satisfies Entry<T>);
      const index = ((await this.kv.get(INDEX_KEY)) as Index | undefined) ?? {};
      index[full] = this.now();
      const names = Object.keys(index);
      if (names.length > MAX_ENTRIES) {
        names.sort((a, b) => index[a] - index[b]);
        for (const old of names.slice(0, names.length - MAX_ENTRIES)) {
          delete index[old];
          await this.kv.delete(old);
        }
      }
      await this.kv.set(INDEX_KEY, index);
    } catch {
      /* storage full or unavailable: the cache is an optimisation only */
    }
  }

  async clear(): Promise<void> {
    try {
      await this.kv.clear();
    } catch {
      /* ignore */
    }
  }
}

/** Wipe every persisted telemetry entry (called on sign-out). */
export async function clearPersistedTelemetry(kv: KV = idbKV()): Promise<void> {
  try {
    await kv.clear();
  } catch {
    /* ignore */
  }
}
