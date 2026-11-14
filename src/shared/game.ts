import { toast } from './dom';
import { initTheme } from './theme';
import { SaveResult, SaveSlot } from './storage';

/** Хуки, общие для интерфейса всех игр. */
export interface GameHooks<S> {
  getState: () => S;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onExportFile: (filename: string) => void;
  onImportFile: (file: File) => Promise<void>;
  onReset: () => void;
}

export interface GameOptions<S> {
  slot: SaveSlot<S>;
  /** Новая игра с постоянными бонусами финала. */
  fresh: (previous?: S) => S;
  step: (s: S) => void;
  /** Длительность тика симуляции, с. */
  tick: number;
  /** Период таймера отрисовки, мс. */
  frame: number;
  /** Сколько тиков догонять за один кадр, чтобы долгий догон не подвешивал открытую вкладку. */
  maxSteps: number;
  resetQuestion?: string;
  /** Состояние просит перезапуска (финал «Скрепкуса»). */
  wantsRestart?: (s: S) => boolean;
  restart?: (s: S) => S;
  ui: {
    init: (hooks: GameHooks<S>, game: Game<S>) => void;
    invalidate: () => void;
    render: () => void;
  };
}

export interface Game<S> {
  readonly state: S;
  replaceState: (state: S) => Promise<void>;
  /** Начинает новую игру с бонусами финала. */
  newGame: () => Promise<void>;
}

/** Точка входа игры: загрузка, кнопки сохранения, игровой цикл и автосохранение. */
export function runGame<S>(o: GameOptions<S>): Game<S> {
  initTheme();

  let state = o.slot.load() ?? o.fresh();
  let previousSaveResult: SaveResult = 'saved';
  let replacing = false;

  async function save(next = state, manual = false, reset = false, replacingState = false): Promise<SaveResult> {
    const result = await o.slot.save(next, reset);
    if (result === 'saved') {
      if (manual) toast('Игра сохранена');
    } else if (manual || replacingState || result !== previousSaveResult) {
      toast(
        result === 'conflict'
          ? 'Сохранение изменилось в другой вкладке. Экспортируйте прогресс или перезагрузите страницу.'
          : 'Не удалось сохранить игру в браузере. Экспортируйте прогресс, чтобы не потерять его.',
      );
    }
    previousSaveResult = result;
    return result;
  }

  async function replaceState(next: S, reset = false, imported = false): Promise<void> {
    if (replacing) return;
    replacing = true;
    try {
      const result = await save(next, false, reset, true);
      if (result !== 'saved') return;
      state = next;
      o.ui.invalidate();
      o.ui.render();
      if (imported) toast('Сохранение импортировано');
    } finally {
      replacing = false;
    }
  }

  function importCode(code: string): Promise<void> {
    return replaceState(o.slot.import(code), false, true);
  }

  const game: Game<S> = {
    replaceState,
    get state() {
      return state;
    },
    newGame() {
      return replaceState(o.fresh(state), true);
    },
  };

  o.ui.init(
    {
      getState: () => state,
      onSave: () => {
        if (replacing) return;
        if (o.wantsRestart?.(state)) void restart();
        else void save(state, true);
      },
      onExport: async () => {
        const code = o.slot.export(state);
        try {
          await navigator.clipboard.writeText(code);
          toast('Сохранение скопировано в буфер обмена');
        } catch {
          prompt('Скопируйте код сохранения:', code);
        }
      },
      onImport: async () => {
        const code = prompt('Вставьте код сохранения:');
        if (!code) return;
        try {
          await importCode(code);
        } catch {
          alert('Код сохранения не распознан.');
        }
      },
      onExportFile: (filename) => {
        const url = URL.createObjectURL(new Blob([o.slot.export(state)], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      onImportFile: async (file) => {
        try {
          await importCode(await file.text());
        } catch {
          alert('Не удалось прочитать файл сохранения или его содержимое не распознано.');
        }
      },
      onReset: () => {
        if (!confirm(o.resetQuestion ?? 'Начать заново? Весь прогресс будет удалён.')) return;
        game.newGame();
      },
    },
    game,
  );

  // Симуляция идёт фиксированными тиками по реально прошедшему времени: замедление таймеров
  // в фоновой вкладке не теряет прогресс, а долгий простой (до часа) догоняется порциями.
  // Скрытую вкладку догоняем целиком: подвисание там никто не увидит, а браузер будит её редко.
  let last = performance.now();
  let acc = 0;

  function restart(): Promise<void> {
    return replaceState(o.restart?.(state) ?? o.fresh(state), true);
  }

  function advance(): void {
    const now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, 3600);
    last = now;
    if (replacing || o.wantsRestart?.(state)) {
      acc = 0;
      return;
    }
    const limit = document.hidden ? Infinity : o.maxSteps;
    let steps = 0;
    while (acc >= o.tick && steps < limit) {
      o.step(state);
      acc -= o.tick;
      steps++;
      if (o.wantsRestart?.(state)) {
        void restart();
        acc = 0;
        break;
      }
    }
  }

  // Таймер, а не requestAnimationFrame: тот засыпает, когда страница не видна, и игра бы вставала.
  // Скрытую вкладку не перерисовываем: симуляция идёт, а интерфейс обновится, как только её откроют.
  setInterval(() => {
    advance();
    if (!document.hidden) o.ui.render();
  }, o.frame);
  // Сохраняемся, когда вкладку прячут: на телефоне её потом могут выгрузить без `beforeunload`.
  const autosave = () => {
    if (!replacing && !o.wantsRestart?.(state)) void save();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!replacing && !o.wantsRestart?.(state)) o.slot.checkpoint(state);
      autosave();
    } else o.ui.render();
  });
  window.addEventListener('pagehide', () => {
    if (!replacing && !o.wantsRestart?.(state)) o.slot.checkpoint(state);
  });
  setInterval(autosave, 10_000);
  o.ui.render();

  return game;
}
