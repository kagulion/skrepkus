import { toast } from './dom';
import { initTheme } from './theme';
import { SaveSlot } from './storage';

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
  fresh: () => S;
  step: (s: S) => void;
  /** Длительность тика симуляции, с. */
  tick: number;
  /** Период таймера отрисовки, мс. */
  frame: number;
  /** Сколько тиков догонять за один кадр, чтобы долгий догон не подвешивал открытую вкладку. */
  maxSteps: number;
  resetQuestion?: string;
  /** Состояние просит перезапуска (финал «Скрепкуса») — симуляция останавливается и вызывается `onRestart`. */
  wantsRestart?: (s: S) => boolean;
  onRestart?: (s: S) => void;
  /** Восстанавливает данные, которые игра хранит отдельно от основного состояния. */
  onImport?: (s: S) => void;
  ui: {
    init: (hooks: GameHooks<S>, game: Game<S>) => void;
    invalidate: () => void;
    render: () => void;
  };
}

export interface Game<S> {
  readonly state: S;
  replaceState: (state: S) => void;
  /** Удаляет сохранение и начинает новую игру с бонусами финала. */
  newGame: () => void;
}

/** Точка входа игры: загрузка, кнопки сохранения, игровой цикл и автосохранение. */
export function runGame<S>(o: GameOptions<S>): Game<S> {
  initTheme();

  let state = o.slot.load() ?? o.fresh();

  function replaceState(next: S): void {
    state = next;
    o.ui.invalidate();
    o.slot.save(state);
    o.ui.render();
  }

  function importCode(code: string): void {
    const imported = o.slot.import(code);
    o.onImport?.(imported);
    replaceState(imported);
    toast('Сохранение импортировано');
  }

  const game: Game<S> = {
    replaceState,
    get state() {
      return state;
    },
    newGame() {
      o.slot.clear();
      replaceState(o.fresh());
    },
  };

  o.ui.init(
    {
      getState: () => state,
      onSave: () => {
        o.slot.save(state);
        toast('Игра сохранена');
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
      onImport: () => {
        const code = prompt('Вставьте код сохранения:');
        if (!code) return;
        try {
          importCode(code);
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
          importCode(await file.text());
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

  function advance(): void {
    const now = performance.now();
    acc = Math.min(acc + (now - last) / 1000, 3600);
    last = now;
    const limit = document.hidden ? Infinity : o.maxSteps;
    let steps = 0;
    while (acc >= o.tick && steps < limit) {
      o.step(state);
      acc -= o.tick;
      steps++;
      if (o.wantsRestart?.(state)) {
        o.onRestart?.(state);
        game.newGame();
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) o.slot.save(state);
    else o.ui.render();
  });
  window.addEventListener('pagehide', () => o.slot.save(state));
  setInterval(() => o.slot.save(state), 10_000);
  o.ui.render();

  return game;
}
