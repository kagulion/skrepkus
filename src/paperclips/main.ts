import '../shared/style.css';
import './style.css';
import { runGame } from '../shared/game';
import { TICK, step } from './sim';
import { debugPrestige, debugSlot, freshGame, prestige, slot } from './save';
import { newGame } from './state';
import { initDebug } from './debug';
import { initUI, invalidate, render } from './ui';
import { initMusic } from './music';

const debug = import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === '1';
const activePrestige = debug ? debugPrestige : prestige;
let syncMusic: (credits: '01' | '07' | null) => void = () => {};
let gameState: (() => ReturnType<typeof newGame>) | undefined;
const creditsTrack = (s: ReturnType<typeof newGame>): '01' | '07' | null =>
  s.endTimer6 < 500 ? null : s.creditsRestart ? '01' : '07';
const game = runGame({
  slot: debug ? debugSlot : slot,
  fresh: debug ? () => Object.assign(newGame(), activePrestige.load()) : freshGame,
  step,
  tick: TICK,
  frame: 33,
  maxSteps: 2000,
  resetQuestion: 'Начать заново? Прогресс этой вселенной будет удалён.',
  onImport: (s) => activePrestige.save({ prestigeU: s.prestigeU, prestigeS: s.prestigeS }),
  // Проекты финала перезапускают игру: в соседней вселенной (+10% спроса) или в симуляции (+10% креативности).
  wantsRestart: (s) => !!s.restart,
  onRestart: (s) => {
    const p = activePrestige.load();
    if (s.restart === 'universe') p.prestigeU++;
    if (s.restart === 'simulation') p.prestigeS++;
    activePrestige.save(p);
  },
  ui: {
    init: initUI,
    invalidate,
    render: () => {
      render();
      if (gameState) syncMusic(creditsTrack(gameState()));
    },
  },
});
gameState = () => game.state;
syncMusic = initMusic();
syncMusic(creditsTrack(game.state));
if (debug) initDebug(game);
