import { Cell, ClipsState, displayMessage, has } from './state';

/** Ход стратегии: 1 — вариант A, 2 — вариант B. pos — 1 у горизонтального игрока, 2 у вертикального. */
interface Strategy {
  name: string;
  pickMove: (s: ClipsState, pos: number) => number;
}

/** Номер клетки с наибольшим выигрышем: 1 — AA, 2 — AB, 3 — BA, 4 — BB. */
function findBiggestPayoff(s: ClipsState): number {
  const { aa, ab, ba, bb } = s;
  if (aa >= ab && aa >= ba && aa >= bb) return 1;
  if (ab >= aa && ab >= ba && ab >= bb) return 2;
  if (ba >= aa && ba >= ab && ba >= bb) return 3;
  return 4;
}

function whatBeatsLast(s: ClipsState, myPos: number): number {
  const oppPrev = myPos === 1 ? s.vMovePrev : s.hMovePrev;
  return oppPrev === 1 ? (s.aa > s.ba ? 1 : 2) : s.ab > s.bb ? 1 : 2;
}

/** Стратегии открываются проектами строго по порядку; первая доступна сразу. */
export const ALL_STRATS: Strategy[] = [
  { name: 'СЛУЧАЙНО', pickMove: () => (Math.random() < 0.5 ? 1 : 2) },
  { name: 'A100', pickMove: () => 1 },
  { name: 'B100', pickMove: () => 2 },
  { name: 'ЖАДНЫЙ', pickMove: (s) => (findBiggestPayoff(s) < 3 ? 1 : 2) },
  { name: 'ЩЕДРЫЙ', pickMove: (s) => ([1, 3].includes(findBiggestPayoff(s)) ? 1 : 2) },
  { name: 'МИНИМАКС', pickMove: (s) => ([1, 3].includes(findBiggestPayoff(s)) ? 2 : 1) },
  { name: 'ОКО ЗА ОКО', pickMove: (s, pos) => (pos === 1 ? s.vMovePrev : s.hMovePrev) },
  { name: 'ПРОТИВ ПРОШЛОГО', pickMove: whatBeatsLast },
];

const CHOICE_A = [
  'сотрудничать',
  'свернуть',
  'макро',
  'бороться',
  'ставить',
  'поднять цену',
  'опера',
  'идти',
  'орёл',
  'частица',
  'дискретно',
  'мир',
  'искать',
  'вести',
  'принять',
  'принять',
  'атаковать',
];
const CHOICE_B = [
  'предать',
  'прямо',
  'микро',
  'отступить',
  'пас',
  'снизить цену',
  'футбол',
  'остаться',
  'решка',
  'волна',
  'непрерывно',
  'война',
  'оценить',
  'следовать',
  'отклонить',
  'отрицать',
  'распадаться',
];

export const choiceNames = (s: ClipsState) => [CHOICE_A[s.choice], CHOICE_B[s.choice]] as const;

/** Ходы в турнире делаются раз в 10 тиков; клетка подсвечивается первые 5. */
const MOVE_TICKS = 10;
const HIGHLIGHT_TICKS = 5;
const MOVES_PER_ROUND = 10;

export function newTourney(s: ClipsState): void {
  if (s.operations < s.tourneyCost || s.tourneyInProg) return;
  s.resultsFlag = false;
  s.high = 0;
  s.tourneyInProg = true;
  s.currentRound = 0;
  s.rounds = s.stratCount * s.stratCount;
  s.scores = Array(s.stratCount).fill(0);
  s.stratCounter = 0;
  s.standardOps -= s.tourneyCost;
  s.tourneyLvl++;
  s.aa = Math.ceil(Math.random() * 10);
  s.ab = Math.ceil(Math.random() * 10);
  s.ba = Math.ceil(Math.random() * 10);
  s.bb = Math.ceil(Math.random() * 10);
  s.choice = Math.floor(Math.random() * CHOICE_A.length);
  s.tourneyArmed = true;
  s.tourneyMsg = 'Выберите стратегию, запустите турнир, получите ёми';
}

/** Запуск подготовленного турнира; первый ход делается сразу, остальные — в stepTourney. */
export function runTourney(s: ClipsState): void {
  if (!s.tourneyArmed) return;
  s.tourneyArmed = false;
  s.tourneyRunning = true;
  s.tourneyTimer = 0;
  startRound(s);
  runMove(s);
}

/** Пары в раунде: сначала первая стратегия против каждой, затем остальные по кругу. */
function startRound(s: ClipsState): void {
  const n = s.stratCount;
  s.rCounter = 0;
  if (s.currentRound < n) {
    s.h = 0;
    s.v = s.currentRound;
  } else {
    s.stratCounter++;
    if (s.stratCounter >= n) s.stratCounter -= n;
    s.h = Math.floor(s.currentRound / n);
    s.v = s.stratCounter;
  }
  s.tourneyMsg = `Раунд ${s.currentRound + 1}`;
}

function calcPayoff(s: ClipsState, hm: number, vm: number): void {
  const cell = `${hm === 1 ? 'A' : 'B'}${vm === 1 ? 'A' : 'B'}` as Cell;
  const payoff: Record<Cell, [number, number]> = {
    AA: [s.aa, s.aa],
    AB: [s.ab, s.ba],
    BA: [s.ba, s.ab],
    BB: [s.bb, s.bb],
  };
  s.cell = cell;
  s.scores[s.h] += payoff[cell][0];
  s.scores[s.v] += payoff[cell][1];
}

function runMove(s: ClipsState): void {
  s.rCounter++;
  s.hMovePrev = s.hMove;
  s.vMovePrev = s.vMove;
  // Стратегия, играющая сама с собой, в оригинале считает себя вертикальным игроком.
  s.hMove = ALL_STRATS[s.h].pickMove(s, s.h === s.v ? 2 : 1);
  s.vMove = ALL_STRATS[s.v].pickMove(s, 2);
  calcPayoff(s, s.hMove, s.vMove);
}

export function stepTourney(s: ClipsState): void {
  if (!s.tourneyRunning) return;
  s.tourneyTimer++;
  if (s.tourneyTimer === HIGHLIGHT_TICKS) s.cell = null;
  if (s.tourneyTimer < MOVE_TICKS) return;
  s.tourneyTimer = 0;
  if (s.rCounter >= MOVES_PER_ROUND) {
    s.currentRound++;
    if (s.currentRound >= s.rounds) {
      finishTourney(s);
      return;
    }
    startRound(s);
  }
  runMove(s);
}

function finishTourney(s: ClipsState): void {
  s.tourneyRunning = false;
  s.tourneyInProg = false;
  s.cell = null;

  // Места: каждый раз берём первую стратегию с наибольшим счётом среди оставшихся.
  const rest = s.scores.map((_, i) => i);
  s.results = [];
  while (rest.length) {
    let best = 0;
    let bestScore = 0;
    rest.forEach((idx, i) => {
      if (s.scores[idx] > bestScore) {
        best = i;
        bestScore = s.scores[idx];
      }
    });
    s.results.push(rest.splice(best, 1)[0]);
  }
  s.scores.forEach((score, i) => {
    if (score > s.high) {
      s.winnerPtr = i;
      s.high = score;
    }
  });
  const ordered = s.results.map((i) => s.scores[i]);
  s.placeScore = ordered.find((x, i) => i > 0 && x < ordered[i - 1]) ?? 0;
  s.showScore = ordered.find((x, i) => i > 0 && x < s.placeScore) ?? 0;
  declareWinner(s);
}

function declareWinner(s: ClipsState): void {
  if (s.pick >= s.stratCount) return;
  const score = s.scores[s.pick];
  const beaten = s.results.length - s.results.indexOf(s.pick) - 1;
  const gain = score * s.yomiBoost * Math.max(beaten, 1);
  const talk = s.milestoneFlag < 15;

  s.tourneyMsg = 'РЕЗУЛЬТАТЫ ТУРНИРА (наведите для таблицы выигрышей)';
  s.yomi += gain;
  if (talk) {
    displayMessage(s, `${ALL_STRATS[s.pick].name} — очки: ${score}, обыграно: ${beaten} стр. Ёми увеличено на ${gain}`);
  }

  const bonus = has(s, '128');
  if (bonus && s.scores[s.winnerPtr] === score) {
    s.yomi += 50_000;
    if (talk) displayMessage(s, 'Выбранная стратегия победила в турнире (или разделила первое место). +50 000 ёми');
  } else if (bonus && s.placeScore === score) {
    s.yomi += 30_000;
    if (talk) displayMessage(s, 'Выбранная стратегия заняла второе место (или разделила его). +30 000 ёми');
  } else if (bonus && s.showScore === score) {
    s.yomi += 20_000;
    if (talk) displayMessage(s, 'Выбранная стратегия заняла третье место (или разделила его). +20 000 ёми');
  } else {
    s.tourneyMsg = 'РЕЗУЛЬТАТЫ ТУРНИРА (наведите для таблицы)';
  }
  s.resultsFlag = true;
}

/** Автотурнир: через 3 с после показа результатов запускает следующий. */
export function stepAutoTourney(s: ClipsState): void {
  if (!(s.resultsFlag && s.autoTourneyFlag && s.autoTourneyStatus && !s.gridHover)) return;
  s.resultsTimer++;
  if (s.resultsTimer >= 300 && s.operations >= s.tourneyCost) {
    newTourney(s);
    runTourney(s);
    s.resultsTimer = 0;
  }
}
