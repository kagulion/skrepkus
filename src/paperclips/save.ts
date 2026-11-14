import { prestigeSlot, readJSON, remove, saveSlot } from '../shared/storage';
import { ClipsState, newGame } from './state';
import { PROJECTS } from './projects';

const KEY = 'paperclips/save';
const PRESTIGE_KEY = 'paperclips/prestige';

/** Ключи прежней версии на классических скриптах: их сохранения переносятся при первой загрузке. */
const LEGACY = {
  game: 'paperclips/saveGame',
  uses: 'paperclips/saveProjectsUses',
  flags: 'paperclips/saveProjectsFlags',
  active: 'paperclips/saveProjectsActive',
  strats: 'paperclips/saveStratsActive',
  prestige: 'paperclips/savePrestige',
};

export interface Prestige {
  prestigeU: number;
  prestigeS: number;
}

type Loose = Record<string, unknown>;

/** Накладывает сохранение на свежее состояние, чтобы новые поля получали значения по умолчанию. */
function hydrate(data: Partial<ClipsState>): ClipsState {
  const base = newGame();
  const s: ClipsState = {
    ...base,
    ...data,
    stats: { ...base.stats, ...data.stats },
    uses: { ...data.uses },
    version: base.version,
  };
  // Бой и турнир не переживают перезагрузку — как и в оригинале.
  s.battle = null;
  s.tourneyInProg = false;
  s.tourneyRunning = false;
  s.tourneyArmed = false;
  s.cell = null;
  s.gridHover = false;
  s.restart = null;
  return s;
}

function validateImport(data: Partial<ClipsState>): ClipsState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid save');
  const base = newGame();
  if (typeof data.version !== 'number' || typeof data.clips !== 'number') throw new Error('Invalid save');
  for (const [key, value] of Object.entries(data)) {
    if (!(key in base)) continue;
    const expected = (base as unknown as Loose)[key];
    if (expected === null) continue;
    if (
      Array.isArray(expected)
        ? !Array.isArray(value)
        : typeof value !== typeof expected || value === null || Array.isArray(value)
    ) {
      throw new Error('Invalid save');
    }
  }
  for (const list of [data.done, data.active, data.log]) {
    if (list && !list.every((value) => typeof value === 'string')) throw new Error('Invalid save');
  }
  for (const list of [data.incomeTracker, data.results, data.battleNumbers]) {
    if (list && !list.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('Invalid save');
    }
  }
  if (data.uses && Object.values(data.uses).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Invalid save');
  }
  if (data.stats && Object.values(data.stats).some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Invalid save');
  }
  if (
    data.stocks?.some(
      (stock) =>
        !stock ||
        typeof stock !== 'object' ||
        typeof stock.symbol !== 'string' ||
        ['id', 'price', 'amount', 'total', 'profit', 'age'].some(
          (key) =>
            typeof (stock as unknown as Loose)[key] !== 'number' || !Number.isFinite((stock as unknown as Loose)[key]),
        ),
    )
  )
    throw new Error('Invalid save');
  for (const value of [data.prestigeU, data.prestigeS]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid prestige');
  }
  return hydrate(data);
}

/** Переносит сохранение прежней версии: имена полей совпадают, флаги были числами 0/1. */
export function fromLegacy(
  game: Loose,
  uses: unknown[],
  flags: unknown[],
  active: unknown[],
  strats: unknown[],
): ClipsState {
  const s = newGame() as unknown as Loose;
  for (const key of Object.keys(s)) {
    const v = game[key];
    if (v === undefined || v === null) continue;
    const def = s[key];
    if (typeof def === 'boolean') s[key] = !!v;
    else if (typeof def === 'number' && Number.isFinite(Number(v))) s[key] = Number(v);
    else if (typeof def === 'string' && typeof v === 'string') s[key] = v;
  }
  const state = s as unknown as ClipsState;
  if (Array.isArray(game.stocks)) state.stocks = game.stocks;
  if (Array.isArray(game.battleNumbers)) state.battleNumbers = game.battleNumbers;
  if (Array.isArray(game.incomeTracker)) {
    state.incomeTracker = game.incomeTracker.filter((x): x is number => typeof x === 'number');
  }
  state.stratCount = Math.max(1, strats.filter((x) => Number(x) === 1).length);

  const activeIds = new Set(active.map((x) => String(x).replace('projectButton', '')));
  PROJECTS.forEach((p, i) => {
    if (typeof uses[i] === 'number') state.uses[p.id] = uses[i] as number;
    if (Number(flags[i]) === 1) state.done.push(p.id);
    if (activeIds.has(p.id)) state.active.push(p.id);
  });
  state.log = ['Сохранение прежней версии перенесено'];
  return hydrate(state);
}

function readList(key: string): unknown[] {
  const v = readJSON(key);
  return Array.isArray(v) ? v : [];
}

function loadLegacy(): ClipsState | null {
  const game = readJSON(LEGACY.game);
  if (!game || typeof game !== 'object') return null;
  try {
    return fromLegacy(
      game as Loose,
      readList(LEGACY.uses),
      readList(LEGACY.flags),
      readList(LEGACY.active),
      readList(LEGACY.strats),
    );
  } catch {
    return null;
  }
}

export const prestige = prestigeSlot<Prestige>(PRESTIGE_KEY, { prestigeU: 0, prestigeS: 0 }, LEGACY.prestige);

function withPrestige(s: ClipsState): ClipsState {
  const p = prestige.load();
  s.prestigeU = p.prestigeU;
  s.prestigeS = p.prestigeS;
  return s;
}

/** Новая игра с постоянными бонусами прошлых вселенных. */
export const freshGame = (): ClipsState => withPrestige(newGame());

const main = saveSlot(KEY, hydrate, (s) => JSON.stringify({ ...s, battle: null }));
const importSlot = saveSlot(KEY, validateImport);
export const debugSlot = {
  ...saveSlot('paperclips/debug-save', hydrate, (s) => JSON.stringify({ ...s, battle: null })),
  import: importSlot.import,
};
export const debugPrestige = prestigeSlot<Prestige>('paperclips/debug-prestige', { prestigeU: 0, prestigeS: 0 });

/** Слот сохранения; при первой загрузке подхватывает сохранение прежней версии. */
export const slot: typeof main = {
  ...main,
  import: importSlot.import,
  load() {
    const s = main.load();
    if (s) return s;
    const legacy = loadLegacy();
    return legacy && withPrestige(legacy);
  },
  async save(s, reset) {
    const result = await main.save(s);
    if (result === 'saved' && reset) remove(...Object.values(LEGACY).filter((key) => key !== LEGACY.prestige));
    return result;
  },
};

export const exportSave = slot.export;
export const importSave = slot.import;
