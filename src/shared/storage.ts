/** Сохранение игры в `localStorage`: недоступное хранилище не ломает игру, а повреждённое — даёт новую. */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Хранилище недоступно (приватный режим и т. п.) — игра продолжается без сохранения.
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

export interface SaveSlot<S> {
  /** Сохранение из хранилища или `null`, если его нет или оно не читается. */
  load(): S | null;
  save(s: S): void;
  clear(): void;
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
  return {
    load() {
      const data = readJSON(key);
      if (!data || typeof data !== 'object') return null;
      try {
        return hydrate(data as D);
      } catch {
        return null;
      }
    },
    save: (s) => write(key, serialize(s)),
    clear: () => remove(key),
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
