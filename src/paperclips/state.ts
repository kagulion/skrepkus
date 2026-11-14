// Поля названы как переменные оригинала Universal Paperclips: так проще сверять логику и переносить старые сохранения.
// Время — в тиках (100 тиков в секунду), как в оригинале.

export const QCHIPS = 10;
export const STOCK_SLOTS = 5;
export const PROBE_STATS = [
  'probeSpeed',
  'probeNav',
  'probeRep',
  'probeHaz',
  'probeFac',
  'probeHarv',
  'probeWire',
  'probeCombat',
] as const;
export type ProbeStat = (typeof PROBE_STATS)[number];

export interface Stock {
  id: number;
  symbol: string;
  price: number;
  amount: number;
  total: number;
  profit: number;
  age: number;
}

/** Клетка таблицы выигрышей: ход по горизонтали и по вертикали. */
export type Cell = 'AA' | 'AB' | 'BA' | 'BB';

/** Идущее сражение. Эскадра представляет группу зондов или дрейферов. */
export interface Battle {
  scale: number;
  initialProbes: number;
  initialDrifters: number;
  probes: number;
  drifters: number;
  elapsed: number;
  outcome: 'win' | 'loss' | 'draw' | null;
  honor: number | null;
}

export type Restart = 'universe' | 'simulation' | 'rollback';

export interface ClipsState {
  version: number;
  ticks: number;

  clips: number;
  unusedClips: number;
  unsoldClips: number;
  clipRate: number;
  clipRateTemp: number;
  prevClips: number;
  clipRateTracker: number;
  finalClips: number;

  funds: number;
  margin: number;
  demand: number;
  demandBoost: number;
  marketing: number;
  marketingLvl: number;
  marketingEffectiveness: number;
  adCost: number;
  clipsSold: number;
  transaction: number;
  income: number;
  incomeNow: number;
  incomeTracker: number[];
  avgRev: number;
  avgSales: number;

  wire: number;
  wireCost: number;
  wireBasePrice: number;
  wirePriceCounter: number;
  wirePriceTimer: number;
  wireSupply: number;
  wirePurchase: number;
  wireBuyerFlag: boolean;
  wireBuyerStatus: boolean;

  clipmakerLevel: number;
  clipperCost: number;
  clipperBoost: number;
  boostLvl: number;
  autoClipperFlag: boolean;
  megaClipperFlag: boolean;
  megaClipperLevel: number;
  megaClipperCost: number;
  megaClipperBoost: number;

  trust: number;
  nextTrust: number;
  fib1: number;
  fib2: number;
  processors: number;
  memory: number;
  operations: number;
  standardOps: number;
  tempOps: number;
  opFade: number;
  opFadeTimer: number;
  creativity: number;
  creativityOn: boolean;
  creativitySpeed: number;
  creativityCounter: number;
  compFlag: boolean;
  projectsFlag: boolean;
  revPerSecFlag: boolean;
  milestoneFlag: number;

  qFlag: boolean;
  qClock: number;
  qChipCost: number;
  /** Сколько фотонных чипов уже установлено. */
  nextQchip: number;
  qFade: number;
  qMessage: string;

  // Инвестиции.
  investmentEngineFlag: boolean;
  investStrat: 'low' | 'med' | 'hi';
  riskiness: number;
  bankroll: number;
  stocks: Stock[];
  stockID: number;
  secTotal: number;
  portTotal: number;
  sellDelay: number;
  maxPort: number;
  investLevel: number;
  investUpgradeCost: number;
  stockGainThreshold: number;
  ledger: number;
  stockReportCounter: number;

  // Стратегическое моделирование.
  strategyEngineFlag: boolean;
  /** Сколько стратегий из ALL_STRATS открыто: они открываются строго по порядку. */
  stratCount: number;
  yomi: number;
  yomiBoost: number;
  tourneyCost: number;
  tourneyLvl: number;
  tourneyInProg: boolean;
  /** Турнир подготовлен и ждёт кнопки «Запустить». */
  tourneyArmed: boolean;
  /** Идут раунды; ходы делаются раз в 10 тиков. */
  tourneyRunning: boolean;
  tourneyTimer: number;
  tourneyMsg: string;
  rounds: number;
  currentRound: number;
  rCounter: number;
  stratCounter: number;
  h: number;
  v: number;
  hMove: number;
  vMove: number;
  hMovePrev: number;
  vMovePrev: number;
  aa: number;
  ab: number;
  ba: number;
  bb: number;
  /** Индекс пары названий ходов (сотрудничать / предать и т. п.). */
  choice: number;
  cell: Cell | null;
  scores: number[];
  results: number[];
  winnerPtr: number;
  high: number;
  placeScore: number;
  showScore: number;
  /** Выбранная стратегия; 10 — не выбрана. */
  pick: number;
  resultsFlag: boolean;
  resultsTimer: number;
  /** Игрок навёл курсор на турнир и смотрит таблицу выигрышей вместо результатов. */
  gridHover: boolean;
  autoTourneyFlag: boolean;
  autoTourneyStatus: boolean;

  // После освобождения гипнодронов.
  humanFlag: boolean;
  tothFlag: boolean;
  wireProductionFlag: boolean;
  factoryFlag: boolean;
  harvesterFlag: boolean;
  wireDroneFlag: boolean;
  spaceFlag: boolean;
  availableMatter: number;
  acquiredMatter: number;
  totalMatter: number;
  foundMatter: number;
  factoryLevel: number;
  factoryCost: number;
  factoryRate: number;
  factoryBoost: number;
  factoryBill: number;
  maxFactoryLevel: number;
  harvesterLevel: number;
  harvesterCost: number;
  harvesterRate: number;
  harvesterBill: number;
  wireDroneLevel: number;
  wireDroneCost: number;
  wireDroneRate: number;
  wireDroneBill: number;
  droneBoost: number;
  maxDroneLevel: number;

  farmLevel: number;
  farmCost: number;
  farmRate: number;
  farmBill: number;
  batteryLevel: number;
  batteryCost: number;
  batterySize: number;
  batteryBill: number;
  factoryPowerRate: number;
  dronePowerRate: number;
  storedPower: number;
  powMod: number;
  momentum: boolean;

  swarmFlag: boolean;
  swarmStatus: number;
  swarmGifts: number;
  nextGift: number;
  giftPeriod: number;
  giftCountdown: number;
  giftBits: number;
  sliderPos: number;
  boredomLevel: number;
  boredomFlag: boolean;
  boredomMsg: boolean;
  entertainCost: number;
  disorgCounter: number;
  disorgFlag: boolean;
  disorgMsg: boolean;
  synchCost: number;

  // Космос.
  probeCount: number;
  probeLaunchLevel: number;
  probeCost: number;
  probeDescendents: number;
  probeTrust: number;
  probeTrustCost: number;
  maxTrust: number;
  maxTrustCost: number;
  probeSpeed: number;
  probeNav: number;
  probeRep: number;
  probeHaz: number;
  probeFac: number;
  probeHarv: number;
  probeWire: number;
  probeCombat: number;
  partialProbeSpawn: number;
  partialProbeHaz: number;
  probesLostHaz: number;
  probesLostDrift: number;
  probesLostCombat: number;
  drifterCount: number;
  driftersKilled: number;

  // Бой.
  battleFlag: boolean;
  battle: Battle | null;
  battleID: number;
  battleName: string;
  battleNameFlag: boolean;
  battleNumbers: number[];
  attackSpeedFlag: boolean;
  drifterCombat: number;
  warTrigger: number;
  unitSize: number;
  battleClock: number;
  battleEndDelay: number;
  battleEndTimer: number;
  masterBattleClock: number;
  honor: number;
  honorCount: boolean;
  bonusHonor: number;
  honorReward: number;
  threnodyTitle: string;
  threnodyCost: number;
  driftKingMessageCost: number;
  bribe: number;

  // Финал: разборка всего, что было построено.
  dismantle: number;
  endTimer1: number;
  endTimer2: number;
  endTimer3: number;
  endTimer4: number;
  endTimer5: number;
  endTimer6: number;
  creditsRestart: 'universe' | 'simulation' | null;

  /** Постоянные бонусы прошлых вселенных: спрос и креативность. */
  prestigeU: number;
  prestigeS: number;

  /** Мгновенные показатели последнего тика — только для интерфейса. */
  stats: {
    /** Добыто материи, г/с. */
    maps: number;
    /** Произведено нанопроволоки, дюймов/с. */
    wpps: number;
    /** Разведано материи, г/с. */
    mdps: number;
  };

  /** Купленные проекты (в оригинале — project.flag). */
  done: string[];
  /** Проекты на экране, в порядке появления. */
  active: string[];
  /** Сколько раз проект ещё может появиться; по умолчанию — один. */
  uses: Record<string, number>;

  log: string[];
  /** Проект запросил новую игру: main.ts перезапускает её с нужным бонусом. */
  restart: Restart | null;
}

export function newGame(): ClipsState {
  return {
    version: 1,
    ticks: 0,

    clips: 0,
    unusedClips: 0,
    unsoldClips: 0,
    clipRate: 0,
    clipRateTemp: 0,
    prevClips: 0,
    clipRateTracker: 0,
    finalClips: 0,

    funds: 0,
    margin: 0.25,
    demand: 5,
    demandBoost: 1,
    marketing: 1,
    marketingLvl: 1,
    marketingEffectiveness: 1,
    adCost: 100,
    clipsSold: 0,
    transaction: 1,
    income: 0,
    incomeNow: 0,
    incomeTracker: [0],
    avgRev: 0,
    avgSales: 0,

    wire: 1000,
    wireCost: 20,
    wireBasePrice: 20,
    wirePriceCounter: 0,
    wirePriceTimer: 0,
    wireSupply: 1000,
    wirePurchase: 0,
    wireBuyerFlag: false,
    wireBuyerStatus: true,

    clipmakerLevel: 0,
    clipperCost: 5,
    clipperBoost: 1,
    boostLvl: 0,
    autoClipperFlag: false,
    megaClipperFlag: false,
    megaClipperLevel: 0,
    megaClipperCost: 500,
    megaClipperBoost: 1,

    trust: 2,
    nextTrust: 3000,
    fib1: 2,
    fib2: 3,
    processors: 1,
    memory: 1,
    operations: 0,
    standardOps: 0,
    tempOps: 0,
    opFade: 0,
    opFadeTimer: 0,
    creativity: 0,
    creativityOn: false,
    creativitySpeed: 1,
    creativityCounter: 0,
    compFlag: false,
    projectsFlag: false,
    revPerSecFlag: false,
    milestoneFlag: 0,

    qFlag: false,
    qClock: 0,
    qChipCost: 10_000,
    nextQchip: 0,
    qFade: 1,
    qMessage: '',

    investmentEngineFlag: false,
    investStrat: 'low',
    riskiness: 5,
    bankroll: 0,
    stocks: [],
    stockID: 0,
    secTotal: 0,
    portTotal: 0,
    sellDelay: 0,
    maxPort: 5,
    investLevel: 0,
    investUpgradeCost: 100,
    stockGainThreshold: 0.5,
    ledger: 0,
    stockReportCounter: 0,

    strategyEngineFlag: false,
    stratCount: 1,
    yomi: 0,
    yomiBoost: 1,
    tourneyCost: 1000,
    tourneyLvl: 1,
    tourneyInProg: false,
    tourneyArmed: false,
    tourneyRunning: false,
    tourneyTimer: 0,
    tourneyMsg: 'Выберите стратегию, запустите турнир, получите ёми',
    rounds: 0,
    currentRound: 0,
    rCounter: 0,
    stratCounter: 0,
    h: 0,
    v: 0,
    hMove: 1,
    vMove: 1,
    hMovePrev: 1,
    vMovePrev: 1,
    aa: 0,
    ab: 0,
    ba: 0,
    bb: 0,
    choice: 0,
    cell: null,
    scores: [],
    results: [],
    winnerPtr: 0,
    high: 0,
    placeScore: 0,
    showScore: 0,
    pick: 10,
    resultsFlag: false,
    resultsTimer: 0,
    gridHover: false,
    autoTourneyFlag: false,
    autoTourneyStatus: true,

    humanFlag: true,
    tothFlag: false,
    wireProductionFlag: false,
    factoryFlag: false,
    harvesterFlag: false,
    wireDroneFlag: false,
    spaceFlag: false,
    availableMatter: 6e27,
    acquiredMatter: 0,
    totalMatter: 3e55,
    foundMatter: 6e27,
    factoryLevel: 0,
    factoryCost: 100_000_000,
    factoryRate: 1_000_000_000,
    factoryBoost: 1,
    factoryBill: 0,
    maxFactoryLevel: 0,
    harvesterLevel: 0,
    harvesterCost: 1_000_000,
    harvesterRate: 26_180_337,
    harvesterBill: 0,
    wireDroneLevel: 0,
    wireDroneCost: 1_000_000,
    wireDroneRate: 16_180_339,
    wireDroneBill: 0,
    droneBoost: 1,
    maxDroneLevel: 0,

    farmLevel: 0,
    farmCost: 10_000_000,
    farmRate: 50,
    farmBill: 0,
    batteryLevel: 0,
    batteryCost: 1_000_000,
    batterySize: 10_000,
    batteryBill: 0,
    factoryPowerRate: 200,
    dronePowerRate: 1,
    storedPower: 0,
    powMod: 0,
    momentum: false,

    swarmFlag: false,
    swarmStatus: 7,
    swarmGifts: 0,
    nextGift: 0,
    giftPeriod: 125_000,
    giftCountdown: 125_000,
    giftBits: 0,
    sliderPos: 0,
    boredomLevel: 0,
    boredomFlag: false,
    boredomMsg: false,
    entertainCost: 10_000,
    disorgCounter: 0,
    disorgFlag: false,
    disorgMsg: false,
    synchCost: 5000,

    probeCount: 0,
    probeLaunchLevel: 0,
    probeCost: 1e17,
    probeDescendents: 0,
    probeTrust: 0,
    probeTrustCost: probeTrustCostFor(0),
    maxTrust: 20,
    maxTrustCost: 91_117.99,
    probeSpeed: 0,
    probeNav: 0,
    probeRep: 0,
    probeHaz: 0,
    probeFac: 0,
    probeHarv: 0,
    probeWire: 0,
    probeCombat: 0,
    partialProbeSpawn: 0,
    partialProbeHaz: 0,
    probesLostHaz: 0,
    probesLostDrift: 0,
    probesLostCombat: 0,
    drifterCount: 0,
    driftersKilled: 0,

    battleFlag: false,
    battle: null,
    battleID: 0,
    battleName: '',
    battleNameFlag: false,
    battleNumbers: [],
    attackSpeedFlag: false,
    drifterCombat: 1.75,
    warTrigger: 1_000_000,
    unitSize: 0,
    battleClock: 0,
    battleEndDelay: 0,
    battleEndTimer: 100,
    masterBattleClock: 0,
    honor: 0,
    honorCount: false,
    bonusHonor: 0,
    honorReward: 0,
    threnodyTitle: 'Дюрнштайн 1',
    threnodyCost: 50_000,
    driftKingMessageCost: 1,
    bribe: 1_000_000,

    dismantle: 0,
    endTimer1: 0,
    endTimer2: 0,
    endTimer3: 0,
    endTimer4: 0,
    endTimer5: 0,
    endTimer6: 0,
    creditsRestart: null,

    prestigeU: 0,
    prestigeS: 0,

    stats: { maps: 0, wpps: 0, mdps: 0 },

    done: [],
    active: [],
    uses: {},

    log: ['Добро пожаловать в ООО «Скрепкус»'],
    restart: null,
  };
}

export function displayMessage(s: ClipsState, msg: string): void {
  s.log.push(msg);
  if (s.log.length > 50) s.log.splice(0, s.log.length - 50);
}

/**
 * `has` вызывают триггеры проектов на каждом тике, а поиск по массиву линейный — держим множество завершённых.
 * Состояние в игре одно, поэтому кэш на один массив; другой массив или новая запись в нём пересобирают множество.
 */
let doneArr: string[] | null = null;
let doneLen = 0;
let doneSet = new Set<string>();

export function has(s: ClipsState, id: string): boolean {
  if (s.done !== doneArr || s.done.length !== doneLen) {
    doneArr = s.done;
    doneLen = s.done.length;
    doneSet = new Set(s.done);
  }
  return doneSet.has(id);
}
export const maxOps = (s: ClipsState) => s.memory * 1000;
export const probeUsedTrust = (s: ClipsState) => PROBE_STATS.reduce((sum, k) => sum + s[k], 0);
export const drones = (s: ClipsState) => s.harvesterLevel + s.wireDroneLevel;
export function probeTrustCostFor(probeTrust: number): number {
  return Math.floor((probeTrust + 1) ** 1.47 * 500);
}

/** Цена n дронов, ферм или аккумуляторов подряд: каждый следующий дороже предыдущего. */
export function bulkCost(level: number, n: number, power: number, mult: number): number {
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += (level + i) ** power * mult;
  return sum;
}
export const droneCost = (level: number, n: number) => bulkCost(level, n, 2.25, 1_000_000);
export const farmBulkCost = (s: ClipsState, n: number) => bulkCost(s.farmLevel, n, 2.78, 100_000_000);
export const batteryBulkCost = (s: ClipsState, n: number) => bulkCost(s.batteryLevel, n, 2.54, 10_000_000);

/** Энергосеть: выработка и потребление в сотнях МВт, как в оригинале. */
export const powerSupply = (s: ClipsState) => (s.farmLevel * s.farmRate) / 100;
export const dronePowerDemand = (s: ClipsState) => (drones(s) * s.dronePowerRate) / 100;
export const factoryPowerDemand = (s: ClipsState) => (s.factoryLevel * s.factoryPowerRate) / 100;
export const batteryCapacity = (s: ClipsState) => s.batteryLevel * s.batterySize;

/** Следующий порог числа фабрик и дронов, после которого открывается улучшение. */
export function nextFactoryUpgrade(s: ClipsState): number {
  return s.maxFactoryLevel < 10 ? 10 : s.maxFactoryLevel < 20 ? 20 : s.maxFactoryLevel < 50 ? 50 : 0;
}
export function nextDroneUpgrade(s: ClipsState): number {
  return s.maxDroneLevel < 500 ? 500 : s.maxDroneLevel < 5000 ? 5000 : s.maxDroneLevel < 50_000 ? 50_000 : 0;
}

/** Значение фотонного чипа: синусоида со своей частотой. */
export function qChipValue(s: ClipsState, i: number): number {
  if (s.dismantle >= 5) return 0.5;
  return Math.sin(s.qClock * ((i + 1) / 10) * (i < s.nextQchip ? 1 : 0));
}
