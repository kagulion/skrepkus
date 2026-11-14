import { ClipsState, ProbeStat, displayMessage, droneCost, drones, probeTrustCostFor, probeUsedTrust } from './state';
import { PROJECT_BY_ID, canAfford, projectCost } from './projects';
import { formatWithCommas } from './format';

/** Изготовление скрепок — и по кнопке, и автостанками, и фабриками. Ограничено запасом проволоки. */
export function clipClick(s: ClipsState, number: number): void {
  if (s.dismantle >= 4) s.finalClips++;
  if (s.wire < 1) return;
  const n = Math.min(number, s.wire);
  s.clips += n;
  s.unsoldClips += n;
  s.unusedClips += n;
  s.wire -= n;
}

export function buyWire(s: ClipsState): void {
  if (s.funds < s.wireCost) return;
  s.wirePriceTimer = 0;
  s.wire += s.wireSupply;
  s.funds -= s.wireCost;
  s.wirePurchase++;
  s.wireBasePrice += 0.05;
}

export function toggleWireBuyer(s: ClipsState): void {
  s.wireBuyerStatus = !s.wireBuyerStatus;
}

export function makeClipper(s: ClipsState): void {
  if (s.funds >= s.clipperCost) {
    s.clipmakerLevel++;
    s.funds -= s.clipperCost;
  }
  s.clipperCost = 1.1 ** s.clipmakerLevel + 5;
}

export function makeMegaClipper(s: ClipsState): void {
  if (s.funds >= s.megaClipperCost) {
    s.megaClipperLevel++;
    s.funds -= s.megaClipperCost;
  }
  s.megaClipperCost = 1.07 ** s.megaClipperLevel * 1000;
}

export function buyAds(s: ClipsState): void {
  if (s.funds < s.adCost) return;
  s.marketingLvl++;
  s.funds -= s.adCost;
  s.adCost = Math.floor(s.adCost * 2);
}

export function raisePrice(s: ClipsState): void {
  s.margin = Math.round((s.margin + 0.01) * 100) / 100;
}

export function lowerPrice(s: ClipsState): void {
  if (s.margin > 0.01) s.margin = Math.round((s.margin - 0.01) * 100) / 100;
}

/** Процессор или память: за свободное доверие, а после освобождения гипнодронов — за подарки роя. */
const canAllocate = (s: ClipsState) => s.trust > s.processors + s.memory || s.swarmGifts > 0;

export function addProc(s: ClipsState): void {
  if (!canAllocate(s)) return;
  s.processors++;
  s.creativitySpeed = Math.log10(s.processors) * s.processors ** 1.1 + s.processors - 1;
  displayMessage(
    s,
    s.creativityOn
      ? 'Процессор добавлен, операций (или креативности) в секунду стало больше'
      : 'Процессор добавлен, операций в секунду стало больше',
  );
  if (!s.humanFlag) s.swarmGifts--;
}

export function addMem(s: ClipsState): void {
  if (!canAllocate(s)) return;
  s.memory++;
  displayMessage(s, 'Память добавлена, максимум операций увеличен');
  if (!s.humanFlag) s.swarmGifts--;
}

/** Квантовые вычисления: сумма фаз чипов даёт операции сверх памяти, которые постепенно сгорают. */
export function qComp(s: ClipsState, chipValues: number[]): void {
  s.qFade = 1;
  if (s.nextQchip === 0) {
    s.qMessage = 'Нужны фотонные чипы';
    return;
  }
  const q = chipValues.reduce((a, b) => a + b, 0);
  let qq = Math.ceil(q * 360);
  const buffer = s.memory * 1000 - s.standardOps;
  const damper = s.tempOps / 100 + 5;
  if (qq > buffer) {
    s.tempOps += Math.ceil(qq / damper) - buffer;
    qq = buffer;
    s.opFade = 0.01;
    s.opFadeTimer = 0;
  }
  s.standardOps += qq;
  s.qMessage = `Операции: ${formatWithCommas(Math.ceil(q * 360))}`;
}

// Земля: фабрики, дроны, энергия.

export function makeFactory(s: ClipsState): void {
  if (s.unusedClips < s.factoryCost) return;
  s.unusedClips -= s.factoryCost;
  s.factoryBill += s.factoryCost;
  s.factoryLevel++;
  const l = s.factoryLevel;
  const mod = l < 8 ? 11 - l : l < 13 ? 2 : l < 20 ? 1.5 : l < 39 ? 1.25 : l < 79 ? 1.15 : 1.1;
  s.maxFactoryLevel = Math.max(s.maxFactoryLevel, l);
  s.factoryCost *= mod;
}

function buyDrones(s: ClipsState, amount: number, kind: 'harvester' | 'wireDrone'): void {
  const level = `${kind}Level` as const;
  const cost = `${kind}Cost` as const;
  const bill = `${kind}Bill` as const;
  for (let i = 0; i < amount && s.unusedClips >= s[cost]; i++) {
    s.unusedClips -= s[cost];
    s[bill] += s[cost];
    s[level]++;
    s[cost] = droneCost(s[level], 1);
  }
  s.maxDroneLevel = Math.max(s.maxDroneLevel, drones(s));
}

export const makeHarvester = (s: ClipsState, amount: number) => buyDrones(s, amount, 'harvester');
export const makeWireDrone = (s: ClipsState, amount: number) => buyDrones(s, amount, 'wireDrone');

/** «Разобрать всё»: мощности разбираются, потраченные на них скрепки возвращаются. */
export function harvesterReboot(s: ClipsState): void {
  s.harvesterLevel = 0;
  s.unusedClips += s.harvesterBill;
  s.harvesterBill = 0;
  s.harvesterCost = 1_000_000;
}

export function wireDroneReboot(s: ClipsState): void {
  s.wireDroneLevel = 0;
  s.unusedClips += s.wireDroneBill;
  s.wireDroneBill = 0;
  s.wireDroneCost = 1_000_000;
}

export function factoryReboot(s: ClipsState): void {
  s.factoryLevel = 0;
  s.unusedClips += s.factoryBill;
  s.factoryBill = 0;
  s.factoryCost = 100_000_000;
}

export function makeFarm(s: ClipsState, amount: number): void {
  for (let i = 0; i < amount && s.unusedClips >= s.farmCost; i++) {
    s.unusedClips -= s.farmCost;
    s.farmBill += s.farmCost;
    s.farmLevel++;
    s.farmCost = (s.farmLevel + 1) ** 2.78 * 100_000_000;
  }
}

export function farmReboot(s: ClipsState): void {
  s.farmLevel = 0;
  s.unusedClips += s.farmBill;
  s.farmBill = 0;
  s.farmCost = 10_000_000;
}

export function makeBattery(s: ClipsState, amount: number): void {
  for (let i = 0; i < amount && s.unusedClips >= s.batteryCost; i++) {
    s.unusedClips -= s.batteryCost;
    s.batteryBill += s.batteryCost;
    s.batteryLevel++;
    s.batteryCost = (s.batteryLevel + 1) ** 2.54 * 10_000_000;
  }
}

export function batteryReboot(s: ClipsState): void {
  s.batteryLevel = 0;
  s.unusedClips += s.batteryBill;
  s.batteryBill = 0;
  s.storedPower = 0;
  s.batteryCost = 1_000_000;
}

export function synchSwarm(s: ClipsState): void {
  if (s.yomi < s.synchCost) return;
  s.yomi -= s.synchCost;
  s.disorgFlag = false;
  s.disorgCounter = 0;
  s.disorgMsg = false;
}

export function entertainSwarm(s: ClipsState): void {
  if (s.creativity < s.entertainCost) return;
  s.creativity -= s.entertainCost;
  s.entertainCost += 10_000;
  s.boredomFlag = false;
  s.boredomLevel = 0;
  s.boredomMsg = false;
}

export function setSlider(s: ClipsState, pos: number): void {
  s.sliderPos = Math.max(0, Math.min(200, pos));
}

// Космос.

export function makeProbe(s: ClipsState): void {
  if (s.unusedClips < s.probeCost) return;
  s.unusedClips -= s.probeCost;
  s.probeLaunchLevel++;
  s.probeCount++;
}

export function increaseProbeTrust(s: ClipsState): void {
  if (s.yomi < s.probeTrustCost || s.probeTrust >= s.maxTrust) return;
  s.yomi -= s.probeTrustCost;
  s.probeTrust++;
  s.probeTrustCost = probeTrustCostFor(s.probeTrust);
  displayMessage(s, 'ВНИМАНИЕ: риск дрейфа ценностей возрос');
}

export function increaseMaxTrust(s: ClipsState): void {
  if (s.honor < s.maxTrustCost) return;
  s.honor -= s.maxTrustCost;
  s.maxTrust += 10;
  displayMessage(s, 'Максимум доверия повышен, пространство конструкции зондов расширено');
}

/** Распределение доверия к зондам между характеристиками. */
export function changeProbe(s: ClipsState, stat: ProbeStat, delta: 1 | -1): void {
  if (delta > 0 && probeUsedTrust(s) >= s.probeTrust) return;
  if (delta < 0 && s[stat] <= 0) return;
  s[stat] += delta;
}

export function buyProject(s: ClipsState, id: string): void {
  if (s.creditsRestart) return;
  const p = PROJECT_BY_ID.get(id);
  if (!p || !s.active.includes(id) || !canAfford(s, p)) return;
  const c = projectCost(s, p);
  s.standardOps -= c.ops ?? 0;
  s.creativity -= c.creat ?? 0;
  s.yomi -= c.yomi ?? 0;
  s.trust -= c.trust ?? 0;
  s.funds -= c.funds ?? 0;
  s.unusedClips -= c.clips ?? 0;
  s.storedPower -= c.power ?? 0;
  s.memory -= c.memory ?? 0;
  if (!s.done.includes(id)) s.done.push(id);
  s.active = s.active.filter((x) => x !== id && !p.removes?.includes(x));
  p.effect?.(s);
  const message = typeof p.message === 'function' ? p.message(s) : p.message;
  for (const msg of [message ?? []].flat()) displayMessage(s, msg);
  if (p.repeat?.(s)) s.uses[id] = (s.uses[id] ?? 1) + 1;
}
