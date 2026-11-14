/** Сохранение игры в `localStorage`: недоступное хранилище не ломает игру, а повреждённое — даёт новую. */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(...keys: string[]): void {
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Разбирает JSON по ключу; нет записи или она повреждена — `null`. */
export function readJSON(key: string): unknown {
  const raw = read(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** UTF-8 в base64. Байты собираются кусками: spread большого массива в `fromCharCode` переполняет стек. */
function encode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function decode(code: string): unknown {
  const bytes = Uint8Array.from(atob(code.trim()), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export type SaveResult = 'saved' | 'conflict' | 'unavailable';

type Recovery = { base: string | null; snapshot: string; time: number; id: string };

function parseRecord<T>(raw: string | null): Partial<T> | null {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function currentRecovery(raw: string | null, primary: string | null): string | null {
  const recovery = parseRecord<Recovery>(raw);
  const saved = parseRecord<{
    format: string;
    revision: string;
    previous: string | null;
    recovery: string;
    consumed: string[];
  }>(primary);
  const wrapped = saved?.format === 'save-slot';
  const savedRevision = wrapped ? saved.revision : primary;
  if (
    typeof recovery?.snapshot === 'string' &&
    (recovery.base === savedRevision ||
      (wrapped &&
        recovery.base === saved.previous &&
        recovery.snapshot !== saved.recovery &&
        !saved.consumed?.includes(recovery.id ?? raw!)))
  ) {
    return recovery.snapshot;
  }
  return null;
}

function revision(raw: string | null): string | null {
  const saved = parseRecord<{ format: string; revision: string }>(raw);
  return saved?.format === 'save-slot' && typeof saved.revision === 'string' ? saved.revision : raw;
}

function primaryData(raw: string | null): string | null {
  const saved = parseRecord<{ format: string; data: string }>(raw);
  return saved?.format === 'save-slot' && typeof saved.data === 'string' ? saved.data : raw;
}

function findRecovery(prefix: string, primary: string | null) {
  const entries: { key: string; raw: string; snapshot: string; time: number; id: string }[] = [];
  for (const key of Object.keys(localStorage)) {
    if (key !== prefix && !key.startsWith(`${prefix}/`)) continue;
    const raw = localStorage.getItem(key);
    const snapshot = currentRecovery(raw, primary);
    if (raw === null || snapshot === null) continue;
    const record = parseRecord<Recovery>(raw);
    entries.push({ key, raw, snapshot, time: record?.time ?? 0, id: record?.id ?? raw });
  }
  entries.sort((a, b) => b.time - a.time || b.key.localeCompare(a.key));
  return entries;
}

export interface SaveSlot<S> {
  /** Сохранение из хранилища или `null`, если его нет или оно не читается. */
  load(): S | null;
  save(s: S, reset?: boolean): Promise<SaveResult>;
  checkpoint(s: S): void;
  /** Код сохранения для переноса строкой. */
  export(s: S): string;
  /** Бросает исключение, если код не распознан. */
  import(code: string): S;
}

/**
 * Слот сохранения игры. `hydrate` накладывает данные на свежее состояние и мигрирует старые версии,
 * `serialize` позволяет не сохранять то, что не переживает перезагрузку.
 */
export function saveSlot<S, D = Partial<S>>(
  key: string,
  hydrate: (data: D) => S,
  serialize: (s: S) => string = JSON.stringify,
): SaveSlot<S> {
  let lastSaved: string | null = null;
  let lastRecovery: string | null = null;
  const recoveryKey = `${key}/recovery`;
  const ownRecoveryKey = `${recoveryKey}/${Date.now()}-${Math.random()}`;
  return {
    load() {
      lastSaved = read(key);
      try {
        const [recovery] = findRecovery(recoveryKey, lastSaved);
        lastRecovery = recovery?.raw ?? null;
        const raw = recovery?.snapshot ?? primaryData(lastSaved);
        if (raw === null) return null;
        const data: unknown = JSON.parse(raw);
        if (!data || typeof data !== 'object') return null;
        return hydrate(data as D);
      } catch {
        return null;
      }
    },
    async save(s) {
      try {
        const next = serialize(s);
        const commit = (): SaveResult => {
          if (localStorage.getItem(key) !== lastSaved) return 'conflict';
          const recoveries = findRecovery(recoveryKey, lastSaved);
          const [recovery] = recoveries;
          if (recovery && recovery.raw !== lastRecovery) return 'conflict';
          const entry = JSON.stringify({
            format: 'save-slot',
            revision: `${Date.now()}-${Math.random()}`,
            previous: revision(lastSaved),
            consumed: recoveries.map(({ id }) => id),
            data: next,
          });
          localStorage.setItem(key, entry);
          lastSaved = entry;
          lastRecovery = null;
          remove(ownRecoveryKey);
          return 'saved';
        };
        return navigator.locks ? await navigator.locks.request(`save:${key}`, commit) : commit();
      } catch {
        return 'unavailable';
      }
    },
    checkpoint(s) {
      try {
        if (localStorage.getItem(key) !== lastSaved) return;
        const snapshot = serialize(s);
        const [recovery] = findRecovery(recoveryKey, lastSaved);
        if (recovery && recovery.raw !== lastRecovery) return;
        if (snapshot === (recovery?.snapshot ?? primaryData(lastSaved))) return;
        const entry = JSON.stringify({
          base: revision(lastSaved),
          snapshot,
          time: Date.now(),
          id: String(Math.random()),
        });
        if (write(ownRecoveryKey, entry)) lastRecovery = entry;
      } catch {
        // The last successful save remains available.
      }
    },
    export: (s) => encode(serialize(s)),
    import: (code) => hydrate(decode(code) as D),
  };
}

export interface PrestigeSlot<P> {
  load(): P;
  save(p: P): void;
}

/** Постоянные бонусы финала: хранятся отдельно от сохранения и переживают новую игру. */
export function prestigeSlot<P extends object>(key: string, defaults: P, legacyKey?: string): PrestigeSlot<P> {
  return {
    load() {
      const data = readJSON(key) ?? (legacyKey ? readJSON(legacyKey) : null);
      return data && typeof data === 'object' ? { ...defaults, ...data } : { ...defaults };
    },
    save: (p) => write(key, JSON.stringify(p)),
  };
}
