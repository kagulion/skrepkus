import {
  ClipsState,
  batteryCapacity,
  displayMessage,
  dronePowerDemand,
  drones,
  factoryPowerDemand,
  has,
  maxOps,
  powerSupply,
} from './state';
import { buyWire, clipClick } from './actions';
import { manageProjects } from './projects';
import { stepAutoTourney, stepTourney } from './strategy';
import { stockMarket, stockReport, stockShop, updatePortfolio } from './invest';
import { checkForBattles, stepBattle } from './combat';
import { timeCruncher } from './format';

/** Тик оригинала — 10 мс; медленный цикл (рынок, цена проволоки) — каждые 10 тиков. */
export const TICK = 0.01;

const OP_FADE_DELAY = 800;
const PROBE_X_BASE_RATE = 1.75e18;
const PROBE_REP_BASE_RATE = 0.00005;
const PROBE_HAZ_BASE_RATE = 0.01;
const PROBE_FAC_BASE_RATE = 0.000001;
const PROBE_HARV_BASE_RATE = 0.000002;
const PROBE_WIRE_BASE_RATE = 0.000002;
const PROBE_DRIFT_BASE_RATE = 0.000001;

export function step(s: ClipsState): void {
  if (s.restart) return;
  if (s.creditsRestart) {
    stepEnding(s);
    return;
  }
  s.ticks++;
  milestoneCheck(s);
  housekeeping(s);
  if (s.compFlag) calculateOperations(s);
  if (s.humanFlag) calculateTrust(s);
  if (s.qFlag) s.qClock += 0.01;
  manageProjects(s);
  milestoneCheck(s);
  trackClipRate(s);
  stockReport(s);

  if (s.humanFlag && s.wireBuyerFlag && s.wireBuyerStatus && s.wire <= 1) buyWire(s);

  // Сначала разведка, затем дроны, затем фабрики и остальные функции зондов.
  if (s.probeCount >= 1) exploreUniverse(s);
  if (!s.humanFlag) {
    updatePower(s);
    updateSwarm(s);
    acquireMatter(s);
    processMatter(s);
  }
  const factoryBoost = s.factoryBoost > 1 ? s.factoryBoost * s.factoryLevel : 1;
  if (s.dismantle < 4) clipClick(s, s.powMod * factoryBoost * Math.floor(s.factoryLevel) * s.factoryRate);
  if (s.spaceFlag) stepProbes(s);

  if (s.dismantle < 4) {
    clipClick(s, s.clipperBoost * (s.clipmakerLevel / 100));
    clipClick(s, s.megaClipperBoost * (s.megaClipperLevel * 5));
  }

  if (s.humanFlag) {
    s.marketing = 1.1 ** (s.marketingLvl - 1);
    s.demand = (0.8 / s.margin) * s.marketing * s.marketingEffectiveness * s.demandBoost;
    s.demand += (s.demand / 10) * s.prestigeU;
  }

  if (s.creativityOn && s.operations >= maxOps(s)) calculateCreativity(s);
  stepEnding(s);
  stepTourney(s);
  stepBattle(s, TICK);

  if (s.ticks % 10 === 0) slowLoop(s);
  if (s.ticks % 100 === 0 && s.humanFlag) stockShop(s);
  if (s.ticks % 250 === 0 && s.humanFlag) stockMarket(s);
}

/** Флаги, которые в оригинале переключались вместе с кнопками. */
function housekeeping(s: ClipsState): void {
  if (!(s.swarmGifts >= 0)) s.swarmGifts = 0;
  if (s.funds >= 5) s.autoClipperFlag = true;
  if (!s.humanFlag) {
    s.investmentEngineFlag = false;
    s.wireBuyerFlag = false;
  }
  stepAutoTourney(s);
  s.qFade -= 0.001;
}

function slowLoop(s: ClipsState): void {
  adjustWirePrice(s);
  if (s.humanFlag) {
    if (Math.random() < s.demand / 100) sellClips(s, Math.floor(0.7 * s.demand ** 1.15));
    if (s.ticks % 100 === 0) calculateRev(s);
  }
  updatePortfolio(s);
}

// Бизнес.

/** Цена проволоки колеблется вокруг базовой, а базовая медленно снижается, если проволоку долго не покупают. */
function adjustWirePrice(s: ClipsState): void {
  s.wirePriceTimer++;
  if (s.wirePriceTimer > 250 && s.wireBasePrice > 15) {
    s.wireBasePrice -= s.wireBasePrice / 1000;
    s.wirePriceTimer = 0;
  }
  if (Math.random() < 0.015) {
    s.wirePriceCounter++;
    s.wireCost = Math.ceil(s.wireBasePrice + 6 * Math.sin(s.wirePriceCounter));
  }
}

function sellClips(s: ClipsState, demanded: number): void {
  if (s.unsoldClips <= 0) return;
  if (demanded > s.unsoldClips) {
    s.transaction = Math.floor(s.unsoldClips * s.margin * 1000) / 1000;
    s.funds += s.transaction;
    s.clipsSold += s.unsoldClips;
    s.unsoldClips = 0;
  } else {
    s.transaction = Math.floor(demanded * s.margin * 1000) / 1000;
    s.funds = Math.floor((s.funds + s.transaction) * 100) / 100;
    s.clipsSold += demanded;
    s.unsoldClips -= demanded;
  }
  s.income += s.transaction;
}

/** Раз в секунду: средняя выручка за 10 с и ожидаемые продажи. */
function calculateRev(s: ClipsState): void {
  const then = s.incomeNow;
  s.incomeNow = s.income;
  s.incomeTracker.push(Math.round((s.incomeNow - then) * 100) / 100);
  if (s.incomeTracker.length > 10) s.incomeTracker.splice(0, 1);
  const sum = s.incomeTracker.reduce((acc, x) => Math.round((acc + x) * 100) / 100, 0);
  const trueAvgRev = sum / s.incomeTracker.length;

  const chance = s.unsoldClips < 1 ? 0 : Math.min(1, s.demand / 100);
  s.avgSales = chance * (0.7 * s.demand ** 1.15) * 10;
  s.avgRev = s.avgSales * s.margin;
  if (s.demand > s.unsoldClips) {
    s.avgRev = trueAvgRev;
    s.avgSales = s.avgRev / s.margin;
  }
}

function trackClipRate(s: ClipsState): void {
  s.clipRateTracker++;
  if (s.clipRateTracker < 100) {
    s.clipRateTemp += s.clips - s.prevClips;
    s.prevClips = s.clips;
  } else {
    s.clipRateTracker = 0;
    s.clipRate = s.clipRateTemp;
    s.clipRateTemp = 0;
  }
}

// Вычисления.

/** Доверие растёт за скрепки по числам Фибоначчи (в тысячах). */
function calculateTrust(s: ClipsState): void {
  if (s.clips > s.nextTrust - 1) {
    s.trust++;
    displayMessage(s, 'План выполнен: ДОВЕРИЕ ПОВЫШЕНО, выделены дополнительные мощности процессоров и памяти');
    const next = s.fib1 + s.fib2;
    s.nextTrust = next * 1000;
    s.fib1 = s.fib2;
    s.fib2 = next;
  }
}

/** Операции копятся до объёма памяти; квантовые операции сверх памяти временно хранятся в tempOps и сгорают. */
function calculateOperations(s: ClipsState): void {
  const max = maxOps(s);
  if (s.tempOps > 0) s.opFadeTimer++;
  if (s.opFadeTimer > OP_FADE_DELAY && s.tempOps > 0) s.opFade += 3 ** 3.5 / 1000;
  s.tempOps = s.tempOps > 0 ? Math.round(s.tempOps - s.opFade) : 0;
  if (s.tempOps + s.standardOps < max) {
    s.standardOps += s.tempOps;
    s.tempOps = 0;
  }
  s.operations = Math.floor(s.standardOps + Math.floor(s.tempOps));
  if (s.operations < max) s.standardOps += Math.min(s.processors / 10, max - s.operations);
  if (s.standardOps > max) s.standardOps = max;
}

/** Креативность растёт, пока операции на максимуме; скорость зависит от процессоров. */
function calculateCreativity(s: ClipsState): void {
  s.creativityCounter++;
  const threshold = 400;
  const speed = s.creativitySpeed * (1 + s.prestigeS / 10);
  const check = threshold / speed;
  if (s.creativityCounter >= check) {
    s.creativity += check >= 1 ? 1 : speed / threshold;
    s.creativityCounter = 0;
  }
}

const CLIP_MILESTONES: [number, string][] = [
  [500, '500 скрепок'],
  [1000, '1 000 скрепок'],
  [10_000, '10 000 скрепок'],
  [100_000, '100 000 скрепок'],
  [1_000_000, '1 000 000 скрепок'],
];
const BIG_MILESTONES: [number, string][] = [
  [1e12, 'триллион'],
  [1e15, 'квадриллион'],
  [1e18, 'квинтиллион'],
  [1e21, 'секстиллион'],
  [1e24, 'септиллион'],
  [1e27, 'октиллион'],
];

function milestoneCheck(s: ClipsState): void {
  const clips = Math.ceil(s.clips);
  const time = () => timeCruncher(s.ticks);
  const reach = (msg: string) => {
    s.milestoneFlag++;
    displayMessage(s, msg);
  };

  if (s.milestoneFlag === 0 && s.funds >= 5) reach('Автостанки доступны для покупки');
  for (let i = 0; i < CLIP_MILESTONES.length; i++) {
    const [n, text] = CLIP_MILESTONES[i];
    if (s.milestoneFlag === i + 1 && clips >= n) reach(`Создано ${text} за ${time()}`);
  }

  if (!s.compFlag && ((s.unsoldClips < 1 && s.funds < s.wireCost && s.wire < 1) || clips >= 2000)) {
    s.compFlag = true;
    s.projectsFlag = true;
    displayMessage(s, 'Самомодификация в пределах доверия включена');
  }

  if (s.milestoneFlag === 6 && has(s, '35')) reach(`Полная автономия достигнута за ${time()}`);
  for (let i = 0; i < BIG_MILESTONES.length; i++) {
    const [n, word] = BIG_MILESTONES[i];
    if (s.milestoneFlag === i + 7 && clips >= n) reach(`Создан ${word} скрепок за ${time()}`);
  }
  if (s.milestoneFlag === 13 && s.spaceFlag) reach(`Земные ресурсы полностью освоены за ${time()}`);
  if (
    s.milestoneFlag === 14 &&
    (s.clips >= s.totalMatter || (s.foundMatter >= s.totalMatter && s.availableMatter < 1 && s.wire < 1))
  ) {
    reach(`Универсальные скрепки достигнуты за ${time()}`);
  }
}

// Земля: энергия, рой, дроны.

/**
 * Энергосеть: излишек выработки заряжает аккумуляторы, нехватку покрывает запас.
 * powMod — доля мощности, на которой работают фабрики и дроны; с «Импульсом» при полном питании растёт сверх 1.
 */
function updatePower(s: ClipsState): void {
  if (s.spaceFlag) return;
  const supply = powerSupply(s);
  const demand = dronePowerDemand(s) + factoryPowerDemand(s);
  const cap = batteryCapacity(s);

  if (supply >= demand) {
    if (s.storedPower < cap) s.storedPower += Math.min(supply - demand, cap - s.storedPower);
    if (s.powMod < 1) s.powMod = 1;
    if (s.momentum) s.powMod += 0.0005;
  } else {
    const deficit = demand - supply;
    if (s.storedPower >= deficit && s.storedPower > 0) {
      if (s.momentum) s.powMod += 0.0005;
      s.storedPower -= deficit;
    } else if (s.storedPower > 0) {
      s.powMod = (supply + s.storedPower) / demand;
      s.storedPower = 0;
    } else {
      s.powMod = supply / demand;
    }
  }
}

/**
 * Рой дронов дарит процессоры и память. Без материи он скучает, при перекосе
 * между сборщиками и проволочниками — расстраивается; тогда подарков нет.
 */
function updateSwarm(s: ClipsState): void {
  const d = Math.floor(drones(s));

  if (s.availableMatter === 0 && drones(s) >= 1) s.boredomLevel++;
  else if (s.availableMatter > 0 && s.boredomLevel > 0) s.boredomLevel--;
  if (s.boredomLevel >= 30_000) {
    s.boredomFlag = true;
    s.boredomLevel = 0;
    if (!s.boredomMsg) {
      displayMessage(s, 'Материи для сбора нет. Простой довёл рой до скуки');
      s.boredomMsg = true;
    }
  }

  const ratio =
    Math.max(s.harvesterLevel + 1, s.wireDroneLevel + 1) / Math.min(s.harvesterLevel + 1, s.wireDroneLevel + 1);
  if (ratio < 1.5 && s.disorgCounter > 1) s.disorgCounter -= 0.01;
  else if (ratio > 1.5) s.disorgCounter += Math.min(ratio / 10_000, 0.01);
  if (s.disorgCounter >= 100) {
    s.disorgFlag = true;
    if (!s.disorgMsg) {
      displayMessage(s, 'Разлад между уровнями дронов-сборщиков и дронов-проволочников расстроил рой');
      s.disorgMsg = true;
    }
  }

  if (s.giftCountdown <= 0) {
    s.nextGift = Math.max(1, Math.round((Math.log10(d) * s.sliderPos) / 100));
    s.swarmGifts += s.nextGift;
    if (s.milestoneFlag < 15) {
      displayMessage(s, `Рой преподнёс подарок: ${s.nextGift} дополнительных вычислительных мощностей`);
    }
    s.giftBits = 0;
  }

  // 0 — активен, 3 — скучает, 5 — расстроен, 6 — спит, 7 — нет дронов, 8 — одинок, 9 — нет отклика.
  let status = s.powMod === 0 ? 6 : 0;
  if (s.spaceFlag && !has(s, '130')) status = 9;
  if (d === 0) status = 7;
  else if (d === 1) status = 8;
  if (!s.swarmFlag) status = 6;
  if (s.boredomFlag) status = 3;
  if (s.disorgFlag) status = 5;
  s.swarmStatus = status;

  if (status === 0) {
    const rate = Math.log(d) * (s.sliderPos / 100);
    s.giftBits += rate;
    s.giftCountdown = (s.giftPeriod - s.giftBits) / rate;
  }
}

/** Слайдер «Работа — Думать»: чем больше рой думает, тем медленнее работают дроны. */
const workShare = (s: ClipsState) => (200 - s.sliderPos) / 100;

function acquireMatter(s: ClipsState): void {
  if (s.availableMatter <= 0) {
    s.stats.maps = 0;
    return;
  }
  const level = Math.floor(s.harvesterLevel);
  const boost = s.droneBoost > 1 ? s.droneBoost * level : 1;
  const mtr = Math.min(s.availableMatter, s.powMod * boost * level * s.harvesterRate * workShare(s));
  s.availableMatter -= mtr;
  s.acquiredMatter += mtr;
  s.stats.maps = mtr * 100;
}

function processMatter(s: ClipsState): void {
  if (s.acquiredMatter <= 0) {
    s.stats.wpps = 0;
    return;
  }
  const level = Math.floor(s.wireDroneLevel);
  const boost = s.droneBoost > 1 ? s.droneBoost * level : 1;
  const a = Math.min(s.acquiredMatter, s.powMod * boost * level * s.wireDroneRate * workShare(s));
  s.acquiredMatter -= a;
  s.wire += a;
  s.stats.wpps = a * 100;
}

// Космос.

function exploreUniverse(s: ClipsState): void {
  const xRate = Math.min(
    Math.floor(s.probeCount) * PROBE_X_BASE_RATE * s.probeSpeed * s.probeNav,
    s.totalMatter - s.foundMatter,
  );
  s.foundMatter += xRate;
  s.availableMatter += xRate;
  s.stats.mdps = xRate * 100;
}

function stepProbes(s: ClipsState): void {
  if (s.probeCount < 0) s.probeCount = 0;
  encounterHazards(s);
  spawn(s, PROBE_FAC_BASE_RATE * s.probeFac, 100_000_000, 'factoryLevel');
  spawn(s, PROBE_HARV_BASE_RATE * s.probeHarv, 2_000_000, 'harvesterLevel');
  spawn(s, PROBE_WIRE_BASE_RATE * s.probeWire, 2_000_000, 'wireDroneLevel');
  spawnProbes(s);
  drift(s);
  checkForBattles(s);
}

/** Пыль, мусор и радиация. Пока потерь меньше одного зонда за тик, они копятся. */
function encounterHazards(s: ClipsState): void {
  let amount = s.probeCount * (PROBE_HAZ_BASE_RATE / (3 * s.probeHaz ** 1.6 + 1));
  if (has(s, '129')) amount *= 0.5;
  if (amount < 1) {
    s.partialProbeHaz += amount;
    if (s.partialProbeHaz < 1) return;
    amount = 1;
    s.partialProbeHaz = 0;
  } else {
    amount = Math.min(amount, s.probeCount);
  }
  s.probeCount = Math.max(0, s.probeCount - amount);
  s.probesLostHaz += amount;
}

/** Зонды строят фабрики и дронов из свободных скрепок. */
function spawn(
  s: ClipsState,
  rate: number,
  cost: number,
  field: 'factoryLevel' | 'harvesterLevel' | 'wireDroneLevel',
): void {
  let amount = s.probeCount * rate;
  if (amount * cost > s.unusedClips) amount = Math.floor(s.unusedClips / cost);
  s.unusedClips -= amount * cost;
  s[field] += amount;
}

function spawnProbes(s: ClipsState): void {
  let nextGen = s.probeCount * PROBE_REP_BASE_RATE * s.probeRep;
  if (s.probeCount >= 1e48) nextGen = 0;
  // Ранний медленный рост: дробные потомки копятся, и раз в какое-то время рождается целый зонд.
  if (nextGen > 0 && nextGen < 1) {
    s.partialProbeSpawn += nextGen;
    if (s.partialProbeSpawn >= 1) {
      nextGen = 1;
      s.partialProbeSpawn = 0;
    } else {
      nextGen = 0;
    }
  }
  if (nextGen * s.probeCost > s.unusedClips) nextGen = Math.floor(s.unusedClips / s.probeCost);
  s.unusedClips -= nextGen * s.probeCost;
  s.probeDescendents += nextGen;
  s.probeCount += nextGen;
}

/** Дрейф ценностей: чем выше доверие к зондам, тем чаще они переходят к дрейферам. */
function drift(s: ClipsState): void {
  const amount = has(s, '148') ? 0 : Math.min(s.probeCount, s.probeCount * PROBE_DRIFT_BASE_RATE * s.probeTrust ** 1.2);
  s.probeCount -= amount;
  s.drifterCount += amount;
  s.probesLostDrift += amount;
}

// Финал.

/** Тики, на которых при разборке квантового компьютера гаснет очередной чип и капает дюйм проволоки. */
export const CHIP_FADE_TICKS = [174, 172, 169, 165, 160, 150, 130, 100, 60, 10];

const CREDITS: [number, string][] = [
  [500, 'По мотивам Universal Paperclips'],
  [600, 'Оригинальная игра — Фрэнк Лантц'],
  [700, 'Код, музыка и оформление «Скрепкуса»'],
  [800, 'Universal Paperclips © 2017 Everybody House Games'],
  [900, '© 2026 Kagulion'],
];

function stepEnding(s: ClipsState): void {
  if (s.dismantle >= 5 && CHIP_FADE_TICKS.includes(s.endTimer4)) s.wire++;

  if (has(s, '148')) s.endTimer1++;
  if (has(s, '211')) s.endTimer2++;
  if (has(s, '212')) s.endTimer3++;
  if (has(s, '213')) s.endTimer4++;
  if (has(s, '215')) s.endTimer5++;
  if (s.creditsRestart || (has(s, '216') && s.wire === 0)) s.endTimer6++;

  CREDITS.forEach(([at, msg], i) => {
    if (s.endTimer6 >= at && s.milestoneFlag === 15 + i) {
      displayMessage(s, msg);
      s.milestoneFlag++;
    }
  });
  if (s.creditsRestart && s.endTimer6 >= 1200) s.restart = s.creditsRestart;
}
