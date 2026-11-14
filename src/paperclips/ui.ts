import {
  ClipsState,
  PROBE_STATS,
  ProbeStat,
  QCHIPS,
  STOCK_SLOTS,
  batteryBulkCost,
  batteryCapacity,
  droneCost,
  dronePowerDemand,
  drones,
  factoryPowerDemand,
  farmBulkCost,
  has,
  maxOps,
  nextDroneUpgrade,
  nextFactoryUpgrade,
  powerSupply,
  probeUsedTrust,
  qChipValue,
} from './state';
import * as act from './actions';
import { investDeposit, investUpgrade, investWithdraw } from './invest';
import { ALL_STRATS, choiceNames, newTourney, runTourney } from './strategy';
import { BATTLE_HEIGHT, BATTLE_WIDTH, ROUND_SECONDS } from './combat';
import { CHIP_FADE_TICKS } from './sim';
import { PROJECT_BY_ID, canAfford, priceTag, projectTitle } from './projects';
import { $, all, applyShow, text } from '../shared/dom';
import { GameHooks } from '../shared/game';
import { decimalComma, formatWithCommas, groupDigits, numberCruncher, spellf, timeCruncher } from './format';

function disable(id: string, disabled: boolean): void {
  $<HTMLButtonElement>(id).disabled = disabled;
}

export type UIHooks = GameHooks<ClipsState>;

const PROBE_LABELS: Record<ProbeStat, [string, string]> = {
  probeSpeed: ['Скорость', 'Меняет скорость освоения вселенной'],
  probeNav: ['Разведка', 'Скорость, с которой зонды получают доступ к новой материи'],
  probeRep: ['Самокопирование', 'Скорость, с которой зонды создают новые (каждый стоит 100 квадриллионов скрепок)'],
  probeHaz: ['Защита от помех', 'Снижает урон от пыли, мусора, радиации и энтропийного распада'],
  probeFac: ['Производство фабрик', 'Скорость, с которой зонды строят фабрики (каждая стоит 100 миллионов скрепок)'],
  probeHarv: ['Дроны-сборщики', 'Скорость, с которой зонды создают дронов-сборщиков (каждый стоит 2 миллиона скрепок)'],
  probeWire: [
    'Дроны-проволочники',
    'Скорость, с которой зонды создают дронов-проволочников (каждый стоит 2 миллиона скрепок)',
  ],
  probeCombat: ['Бой', 'Определяет атакующую и оборонительную эффективность в бою'],
};

const SWARM_STATUS: Record<number, string> = {
  0: 'Активен',
  3: 'Скучает',
  5: 'Расстроен',
  6: 'Спит',
  8: 'Одинок',
  9: 'НЕТ ОТКЛИКА...',
};

/** Строки, которые строятся один раз; дальше обновляются только числа. */
function buildControls(): void {
  $('probeStats').replaceChildren(
    ...PROBE_STATS.map((k) => {
      const row = document.createElement('div');
      row.className = 'probe';
      if (k === 'probeCombat') row.dataset.show = 'combat';
      const [label, tip] = PROBE_LABELS[k];
      row.innerHTML =
        `<div class="probe-ctl"><button data-probe="${k}" data-delta="-1" aria-label="Уменьшить">−</button>` +
        `<button data-probe="${k}" data-delta="1" aria-label="Увеличить">+</button></div>` +
        `<div class="toolTip2"><span class="toolTipText2">${tip}</span>${label}: <b id="${k}Display"></b></div>`;
      return row;
    }),
  );

  $('qChips').replaceChildren(
    ...Array.from({ length: QCHIPS }, () => {
      const chip = document.createElement('div');
      chip.className = 'qChip';
      return chip;
    }),
  );

  $('stocks').replaceChildren(
    ...Array.from({ length: STOCK_SLOTS }, () => {
      const row = document.createElement('tr');
      row.innerHTML = '<td></td><td></td><td></td><td></td><td></td>';
      return row;
    }),
  );
}

let hooks: UIHooks;

export function initUI(h: UIHooks): void {
  hooks = h;
  const state = () => hooks.getState();
  const on = (id: string, fn: (s: ClipsState) => void) =>
    $(id).addEventListener('click', () => {
      fn(state());
      render();
    });
  const delegate = (root: HTMLElement | Document, attr: string, fn: (s: ClipsState, el: HTMLElement) => void) =>
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(`[data-${attr}]`);
      if (!el) return;
      fn(state(), el);
      render();
    });

  buildControls();

  on('btnMakePaperclip', (s) => act.clipClick(s, 1));
  on('btnBuyWire', act.buyWire);
  on('btnToggleWireBuyer', act.toggleWireBuyer);
  on('btnMakeClipper', act.makeClipper);
  on('btnMakeMegaClipper', act.makeMegaClipper);
  on('btnExpandMarketing', act.buyAds);
  on('btnLowerPrice', act.lowerPrice);
  on('btnRaisePrice', act.raisePrice);
  on('btnAddProc', act.addProc);
  on('btnAddMem', act.addMem);
  on('btnQcompute', (s) =>
    act.qComp(
      s,
      Array.from({ length: QCHIPS }, (_, i) => qChipValue(s, i)),
    ),
  );

  on('btnMakeFactory', act.makeFactory);
  on('btnFactoryReboot', act.factoryReboot);
  on('btnHarvesterReboot', act.harvesterReboot);
  on('btnWireDroneReboot', act.wireDroneReboot);
  on('btnFarmReboot', act.farmReboot);
  on('btnBatteryReboot', act.batteryReboot);
  delegate(document, 'drone', (s, el) => {
    const amount = Number(el.dataset.amount);
    if (el.dataset.drone === 'harvester') act.makeHarvester(s, amount);
    else act.makeWireDrone(s, amount);
  });
  delegate(document, 'farm', (s, el) => act.makeFarm(s, Number(el.dataset.farm)));
  delegate(document, 'battery', (s, el) => act.makeBattery(s, Number(el.dataset.battery)));

  on('btnEntertainSwarm', act.entertainSwarm);
  on('btnSynchSwarm', act.synchSwarm);
  $<HTMLInputElement>('slider').addEventListener('input', (e) => {
    act.setSlider(state(), Number((e.target as HTMLInputElement).value));
  });

  on('btnInvest', investDeposit);
  on('btnWithdraw', investWithdraw);
  on('btnImproveInvestments', investUpgrade);
  $<HTMLSelectElement>('investStrat').addEventListener('change', (e) => {
    state().investStrat = (e.target as HTMLSelectElement).value as ClipsState['investStrat'];
  });

  $<HTMLSelectElement>('stratPicker').addEventListener('change', (e) => {
    state().pick = Number((e.target as HTMLSelectElement).value);
  });
  on('btnNewTournament', newTourney);
  on('btnRunTournament', runTourney);
  on('btnToggleAutoTourney', (s) => {
    s.autoTourneyStatus = !s.autoTourneyStatus;
  });
  // Наведение на турнир показывает таблицу выигрышей вместо итогов и придерживает автотурнир.
  const stuff = $('tournamentStuff');
  stuff.addEventListener('mouseenter', () => {
    const s = state();
    s.gridHover = true;
    if (s.resultsFlag) s.resultsTimer = 0;
    render();
  });
  stuff.addEventListener('mouseleave', () => {
    state().gridHover = false;
    render();
  });

  on('btnMakeProbe', act.makeProbe);
  on('btnIncreaseProbeTrust', act.increaseProbeTrust);
  on('btnIncreaseMaxTrust', act.increaseMaxTrust);
  delegate($('probeStats'), 'probe', (s, el) => {
    act.changeProbe(s, el.dataset.probe as ProbeStat, Number(el.dataset.delta) as 1 | -1);
  });

  delegate($('projectListTop'), 'project', (s, el) => {
    const p = PROJECT_BY_ID.get(el.dataset.project!);
    if (p?.confirm && !confirm(p.confirm)) return;
    act.buyProject(s, el.dataset.project!);
  });

  for (const [button, dialog] of [
    ['btnAbout', 'aboutDialog'],
    ['btnNext', 'nextDialog'],
    ['btnSpace', 'spaceDialog'],
  ]) {
    const el = $<HTMLDialogElement>(dialog);
    $(button).addEventListener('click', () => el.showModal());
    // Клик по затемнению вокруг окна тоже закрывает его.
    el.addEventListener('click', (e) => {
      if (e.target === el) el.close();
    });
    el.addEventListener('close', showPendingChapterDialog);
  }

  let firstVisit = true;
  try {
    firstVisit = localStorage.getItem('paperclips/about-seen') !== '1';
    if (firstVisit) localStorage.setItem('paperclips/about-seen', '1');
  } catch {
    // Без хранилища приветствие показывается при каждом открытии страницы.
  }
  if (firstVisit) $<HTMLDialogElement>('aboutDialog').showModal();

  $('btnSave').addEventListener('click', hooks.onSave);
  $('btnExport').addEventListener('click', hooks.onExport);
  $('btnImport').addEventListener('click', hooks.onImport);
  document.querySelectorAll<HTMLDetailsElement>('.save-menu').forEach((menu) => {
    menu.addEventListener('click', (event) => {
      if (event.target instanceof HTMLButtonElement) menu.open = false;
    });
  });
  $('btnExportFile').addEventListener('click', () => hooks.onExportFile('paperclips-save.txt'));
  const saveFile = $<HTMLInputElement>('saveFile');
  $('btnImportFile').addEventListener('click', () => saveFile.click());
  saveFile.addEventListener('change', () => {
    const file = saveFile.files?.[0];
    saveFile.value = '';
    if (file) void hooks.onImportFile(file);
  });
  $('btnReset').addEventListener('click', hooks.onReset);
}

// Финальный отсчёт: в оригинале счётчик показывает фиксированные числа из 54 цифр.
const NINES = '29,999,999,999,999,999,999,999,999,999,999,999,999,';
const FINAL_COUNTS = [
  '29,999,999,999,999,900,000,000,000,000,000,000,000,000,000,000,000,000,000',
  `${NINES}000,000,000,000,000,000`,
  `${NINES}999,999,999,000,000,000`,
  `${NINES}999,999,999,999,999,900`,
];

function clipsCounter(s: ClipsState): [string, string] {
  if (s.milestoneFlag < 15) return [formatWithCommas(Math.ceil(s.clips)), spellf(Math.round(s.clips))];
  if (s.dismantle < 4) return [groupDigits(FINAL_COUNTS[s.dismantle]), '29,9 септендециллиона'];
  if (s.finalClips >= 100) {
    return [
      groupDigits('30,000,000,000,000,000,000,000,000,000,000,000,000,000,000,000,000,000,000'),
      '30,0 септендециллиона',
    ];
  }
  const tail = s.finalClips < 10 ? `90${s.finalClips}` : `9${s.finalClips}`;
  return [groupDigits(`${NINES}999,999,999,999,999,${tail}`), '29,9 септендециллиона'];
}

let projectsKey = '';
let stratKey = -1;
let logKey = '';
let wasHuman: boolean | null = null;
let wasSpace: boolean | null = null;
/** Идёт мигание экрана при освобождении гипнодронов. */
let hypnoDroneRunning = false;
let pendingChapterDialog: 'nextDialog' | 'spaceDialog' | null = null;

function showPendingChapterDialog(): void {
  if (!pendingChapterDialog || hypnoDroneRunning || document.querySelector('dialog[open]')) return;
  const dialog = pendingChapterDialog;
  pendingChapterDialog = null;
  $<HTMLDialogElement>(dialog).showModal();
}

export function render(): void {
  const s = hooks.getState();
  const d = s.dismantle;
  const h121 = has(s, '121');

  const show: Record<string, boolean> = {
    prestige: s.prestigeU >= 1 || s.prestigeS >= 1,
    creation: !s.humanFlag && s.endTimer6 < 250,
    clipsPerSec: d < 3,
    toth: s.tothFlag && d < 3,
    factoryUpgrade: has(s, '45') && s.maxFactoryLevel < 50,
    factory: s.factoryFlag && !s.spaceFlag,
    wireTrans: !s.wireProductionFlag || d >= 2,
    factorySpace: s.spaceFlag && d < 3,
    wireProduction: s.wireProductionFlag && d < 2,
    droneUpgrade: s.maxDroneLevel < 50_000,
    space: s.spaceFlag,
    harvesters: s.harvesterFlag && !s.spaceFlag,
    wireDrones: s.wireDroneFlag && !s.spaceFlag,
    spaceDiv: s.spaceFlag && !(d >= 1 && s.endTimer1 >= 150),
    lostHaz: s.probesLostHaz >= 1,
    lostDrift: s.probesLostDrift >= 1,
    lostCombat: s.probesLostCombat >= 1,
    battleFlag: s.battleFlag,
    human: s.humanFlag,
    automation: s.humanFlag && s.autoClipperFlag,
    revPerSec: s.revPerSecFlag,
    wireBuyer: s.wireBuyerFlag,
    autoClipper: s.autoClipperFlag,
    megaClipper: s.megaClipperFlag,
    comp: s.compFlag && d < 7,
    swarmGifts: s.swarmFlag && !(d >= 2 && s.endTimer2 >= 50),
    processors: d < 6,
    creativity: s.creativityOn,
    swarmEngine: s.swarmFlag && !(d >= 2 && s.endTimer2 >= 100),
    swarmStatus: s.swarmStatus !== 7,
    giftTimer: s.swarmStatus === 0,
    swarmBored: s.swarmStatus === 3,
    swarmDisorg: s.swarmStatus === 5,
    swarmSlider: s.swarmFlag && !(d >= 2 && s.endTimer2 >= 150),
    swarmRestartHint: s.spaceFlag && !has(s, '130'),
    quantum: s.qFlag && !(d >= 5 && s.endTimer4 >= 250),
    qCompute: d < 5,
    projects: s.projectsFlag && d < 7,
    invest: s.investmentEngineFlag,
    strategy: s.strategyEngineFlag && d < 4,
    tourneyGrid: !s.resultsFlag || s.gridHover,
    tourneyResults: s.resultsFlag && !s.gridHover,
    autoTourney: s.autoTourneyFlag,
    battleCanvas: s.battleFlag && !(d >= 1 && s.endTimer1 >= 175),
    honor: h121 && !(d >= 1 && s.endTimer1 >= 190),
    power: has(s, '127') && !s.spaceFlag,
    probeDesign: s.spaceFlag && d < 1,
    probeTrust: !(d >= 1 && s.endTimer1 >= 50),
    maxTrust: h121 && !(d >= 1 && s.endTimer1 >= 100),
    combat: has(s, '131'),
  };
  applyShow(show);

  const [clips, crunched] = clipsCounter(s);
  text('clips', clips);
  text('clipCountCrunched', crunched);
  text('prestigeUcounter', String(s.prestigeU + 1));
  text('prestigeScounter', String(s.prestigeS + 1));

  renderBusiness(s);
  renderComputing(s);
  if (!s.humanFlag) renderEarth(s);
  if (s.spaceFlag) renderSpace(s);
  if (s.investmentEngineFlag) renderInvest(s);
  if (s.strategyEngineFlag) renderStrategy(s);
  if (s.battleFlag) renderBattle(s);
  renderProjects(s);
  renderLog(s);
  text('time', timeCruncher(s.ticks) || '0 сек');

  if (wasHuman && !s.humanFlag) {
    pendingChapterDialog = 'nextDialog';
    hypnoDroneEvent();
  }
  if (wasSpace === false && s.spaceFlag) pendingChapterDialog = 'spaceDialog';
  if (s.humanFlag) pendingChapterDialog = null;
  wasHuman = s.humanFlag;
  wasSpace = s.spaceFlag;
  // «Что дальше?» появляется после освобождения гипнодронов — когда экран перестал мигать.
  $('nextLink').hidden = s.humanFlag || hypnoDroneRunning;
  $('spaceLink').hidden = !s.spaceFlag || hypnoDroneRunning;
  showPendingChapterDialog();
}

function renderBusiness(s: ClipsState): void {
  text('clipmakerRate', formatWithCommas(Math.round(s.clipRate)));
  text('clipmakerRate2', s.humanFlag ? formatWithCommas(s.clipRate) : spellf(s.clipRate));
  text('funds', formatWithCommas(s.funds, 2));
  text('avgRev', formatWithCommas(s.avgRev, 2));
  text('avgSales', formatWithCommas(Math.round(s.avgSales)));
  text('unsoldClips', formatWithCommas(s.unsoldClips));
  text('margin', decimalComma(s.margin, 2));
  text('demand', formatWithCommas(s.demand * 10));
  text('marketingLvl', String(s.marketingLvl));
  text('adCost', formatWithCommas(s.adCost, 2));
  text('wireBuyerStatus', s.wireBuyerStatus ? 'ВКЛ' : 'ВЫКЛ');
  text('wire', formatWithCommas(s.wire));
  text('wireCost', formatWithCommas(s.wireCost));
  text('clipmakerLevel2', String(s.clipmakerLevel));
  text('clipperCost', formatWithCommas(s.clipperCost, 2));
  text('megaClipperLevel', String(s.megaClipperLevel));
  text('megaClipperCost', formatWithCommas(s.megaClipperCost, 2));

  disable('btnMakePaperclip', s.wire < 1);
  disable('btnBuyWire', s.funds < s.wireCost);
  disable('btnMakeClipper', s.funds < s.clipperCost);
  disable('btnMakeMegaClipper', s.funds < s.megaClipperCost);
  disable('btnExpandMarketing', s.funds < s.adCost);
  disable('btnLowerPrice', s.margin <= 0.01);
}

function renderComputing(s: ClipsState): void {
  text('trust', formatWithCommas(s.trust));
  text('nextTrust', formatWithCommas(Math.floor(s.nextTrust)));
  text('swarmGifts', formatWithCommas(s.swarmGifts));
  text('processors', String(s.processors));
  text('memory', String(s.memory));
  text('operations', formatWithCommas(s.operations));
  text('maxOps', formatWithCommas(maxOps(s)));
  text('creativity', formatWithCommas(s.creativity));
  const locked = s.trust <= s.processors + s.memory && s.swarmGifts <= 0;
  disable('btnAddProc', locked);
  disable('btnAddMem', locked);

  if (s.qFlag) {
    $('qChips')
      .querySelectorAll<HTMLElement>('.qChip')
      .forEach((chip, i) => {
        chip.style.opacity = String(qChipValue(s, i));
        chip.hidden = s.dismantle >= 5 && s.endTimer4 >= CHIP_FADE_TICKS[i];
      });
    text('qCompDisplay', s.qMessage);
    $('qCompDisplay').style.opacity = String(Math.max(0, s.qFade));
  }

  if (s.swarmFlag) {
    text('swarmSize', spellf(Math.floor(drones(s))));
    text('swarmStatus', SWARM_STATUS[s.swarmStatus] ?? '');
    text('giftCountdown', timeCruncher(s.giftCountdown));
    text('swarmEntertainCost', formatWithCommas(s.entertainCost));
    text('synchCost', formatWithCommas(s.synchCost));
    disable('btnEntertainSwarm', s.creativity < s.entertainCost);
    disable('btnSynchSwarm', s.yomi < s.synchCost);
    const slider = $<HTMLInputElement>('slider');
    if (document.activeElement !== slider) slider.value = String(s.sliderPos);
  }
}

const rebootTip = (bill: number) => `+${spellf(bill)} скрепок`;

function renderEarth(s: ClipsState): void {
  text('unusedClipsDisplay', spellf(s.unusedClips));
  text('transWire', s.dismantle >= 1 ? formatWithCommas(s.wire) : spellf(s.wire));
  text('inchSpan', s.wire === 1 ? 'дюйм' : 'дюймов');
  text('nextFactoryUpgrade', formatWithCommas(nextFactoryUpgrade(s)));
  text('nextDroneUpgrade', formatWithCommas(nextDroneUpgrade(s)));

  text('factoryLevelDisplay', spellf(s.factoryLevel));
  text('factoryCostDisplay', spellf(s.factoryCost));
  text('factoryRebootToolTip', rebootTip(s.factoryBill));
  disable('btnMakeFactory', s.unusedClips < s.factoryCost);
  disable('btnFactoryReboot', s.factoryLevel === 0);

  text('availableMatterDisplay', spellf(s.availableMatter));
  text('acquiredMatterDisplay', spellf(s.acquiredMatter));
  text('nanoWire', spellf(s.wire));
  text('maps', spellf(s.stats.maps));
  text('wpps', spellf(s.stats.wpps));

  text('harvesterLevelDisplay', spellf(s.harvesterLevel));
  text('harvesterCostDisplay', spellf(s.harvesterCost));
  text('harvesterRebootToolTip', rebootTip(s.harvesterBill));
  text('wireDroneLevelDisplay', spellf(s.wireDroneLevel));
  text('wireDroneCostDisplay', spellf(s.wireDroneCost));
  text('wireDroneRebootToolTip', rebootTip(s.wireDroneBill));
  all<HTMLButtonElement>('[data-drone]').forEach((b) => {
    const level = b.dataset.drone === 'harvester' ? s.harvesterLevel : s.wireDroneLevel;
    b.disabled = s.unusedClips < droneCost(level, Number(b.dataset.amount));
  });
  disable('btnHarvesterReboot', s.harvesterLevel === 0);
  disable('btnWireDroneReboot', s.wireDroneLevel === 0);

  if (has(s, '127') && !s.spaceFlag) {
    const supply = powerSupply(s);
    const droneDemand = dronePowerDemand(s);
    const factoryDemand = factoryPowerDemand(s);
    text('powerProductionRate', formatWithCommas(Math.round(supply * 100)));
    text('powerConsumptionRate', formatWithCommas(Math.round((droneDemand + factoryDemand) * 100)));
    text('facPowConRate', formatWithCommas(Math.round(factoryDemand * 100)));
    text('dronePowConRate', formatWithCommas(Math.round(droneDemand * 100)));
    text('storedPower', formatWithCommas(Math.round(s.storedPower)));
    text('maxStorage', formatWithCommas(Math.round(batteryCapacity(s))));
    const idle = s.factoryLevel === 0 && s.harvesterLevel === 0 && s.wireDroneLevel === 0;
    text('performance', idle ? '0' : formatWithCommas(Math.round(s.powMod * 100)));
    text('farmLevel', formatWithCommas(s.farmLevel));
    text('farmCost', spellf(s.farmCost));
    text('farmRebootToolTip', rebootTip(s.farmBill));
    text('batteryLevel', formatWithCommas(s.batteryLevel));
    text('batteryCost', spellf(s.batteryCost));
    text('batteryRebootToolTip', rebootTip(s.batteryBill));
    all<HTMLButtonElement>('[data-farm]').forEach((b) => {
      const n = Number(b.dataset.farm);
      b.disabled = s.unusedClips < (n === 1 ? s.farmCost : farmBulkCost(s, n));
    });
    all<HTMLButtonElement>('[data-battery]').forEach((b) => {
      const n = Number(b.dataset.battery);
      b.disabled = s.unusedClips < (n === 1 ? s.batteryCost : batteryBulkCost(s, n));
    });
    disable('btnFarmReboot', s.farmLevel < 1);
    disable('btnBatteryReboot', s.batteryLevel < 1);
  }
}

function renderSpace(s: ClipsState): void {
  text('factoryLevelDisplaySpace', spellf(s.factoryLevel));
  text('harvesterLevelSpace', spellf(s.harvesterLevel));
  text('wireDroneLevelSpace', spellf(s.wireDroneLevel));
  text('mdps', spellf(s.stats.mdps));
  text('colonizedDisplay', decimalComma(100 / (s.totalMatter / s.foundMatter), 12));
  text('probeCostDisplay', spellf(s.probeCost));
  text('probesLaunchedDisplay', formatWithCommas(s.probeLaunchLevel));
  text('probesBornDisplay', spellf(s.probeDescendents));
  text('probesTotalDisplay', spellf(s.probeCount));
  text('probesLostHazardsDisplay', spellf(s.probesLostHaz));
  text('probesLostDriftDisplay', spellf(s.probesLostDrift));
  text('probesLostCombatDisplay', numberCruncher(s.probesLostCombat));
  text('driftersKilled', numberCruncher(s.driftersKilled));
  text('drifterCount', numberCruncher(s.drifterCount));
  disable('btnMakeProbe', s.unusedClips < s.probeCost);

  const used = probeUsedTrust(s);
  text('probeTrustUsedDisplay', String(used));
  text('probeTrustDisplay', String(s.probeTrust));
  text('maxTrustDisplay', formatWithCommas(s.maxTrust));
  text('probeTrustCostDisplay', formatWithCommas(s.probeTrustCost));
  for (const k of PROBE_STATS) text(`${k}Display`, String(s[k]));
  all<HTMLButtonElement>('[data-probe]').forEach((b) => {
    const k = b.dataset.probe as ProbeStat;
    b.disabled = b.dataset.delta === '1' ? s.probeTrust - used < 1 : s[k] < 1;
  });
  disable('btnIncreaseProbeTrust', s.yomi < s.probeTrustCost || s.probeTrust >= s.maxTrust);

  text('honorDisplay', formatWithCommas(Math.round(s.honor)));
  text('maxTrustCostDisplay', formatWithCommas(s.maxTrustCost, 2));
  disable('btnIncreaseMaxTrust', s.honor < s.maxTrustCost);
}

function renderInvest(s: ClipsState): void {
  text('investmentBankroll', formatWithCommas(s.bankroll));
  text('secValue', formatWithCommas(s.secTotal));
  text('portValue', formatWithCommas(s.portTotal));
  text('investmentLevel', String(s.investLevel));
  text('investUpgradeCost', formatWithCommas(s.investUpgradeCost));
  disable('btnImproveInvestments', s.yomi < s.investUpgradeCost);
  const select = $<HTMLSelectElement>('investStrat');
  if (document.activeElement !== select) select.value = s.investStrat;

  $('stocks')
    .querySelectorAll('tr')
    .forEach((row, i) => {
      const st = s.stocks[i];
      const cells = st
        ? [st.symbol, ...[st.amount, st.price, st.total, st.profit].map((x) => formatWithCommas(Math.ceil(x)))]
        : ['', '', '', '', ''];
      row.querySelectorAll('td').forEach((td, j) => {
        if (td.textContent !== cells[j]) td.textContent = cells[j];
      });
    });
}

function renderStrategy(s: ClipsState): void {
  const picker = $<HTMLSelectElement>('stratPicker');
  if (stratKey !== s.stratCount) {
    stratKey = s.stratCount;
    const none = new Option('Выберите стратегию', '10');
    picker.replaceChildren(none, ...ALL_STRATS.slice(0, s.stratCount).map((st, i) => new Option(st.name, String(i))));
  }
  if (document.activeElement !== picker) picker.value = String(s.pick);

  text('tourneyDisplay', s.tourneyMsg);
  text('horizStrat', s.tourneyRunning ? ALL_STRATS[s.h].name : '');
  text('vertStrat', s.tourneyRunning ? ` против ${ALL_STRATS[s.v].name}` : '');
  const [a, b] = choiceNames(s);
  text('vLabela', a);
  text('vLabelb', b);
  text('hLabela', a);
  text('hLabelb', b);
  text('aaPayoffH', String(s.aa));
  text('aaPayoffV', String(s.aa));
  text('abPayoffH', String(s.ab));
  text('abPayoffV', String(s.ba));
  text('baPayoffH', String(s.ba));
  text('baPayoffV', String(s.ab));
  text('bbPayoffH', String(s.bb));
  text('bbPayoffV', String(s.bb));
  all('[data-cell]').forEach((td) => {
    td.classList.toggle('hit', td.dataset.cell === s.cell);
  });

  const results = $('tourneyResults');
  const key = s.results.map((i) => `${i}:${s.scores[i]}`).join(',') + `|${s.pick}`;
  if (results.dataset.key !== key) {
    results.dataset.key = key;
    results.replaceChildren(
      ...s.results.map((i) => {
        const li = document.createElement('li');
        li.textContent = `${ALL_STRATS[i].name}: ${s.scores[i]}`;
        li.classList.toggle('picked', i === s.pick);
        return li;
      }),
    );
  }

  text('yomiDisplay', formatWithCommas(s.yomi));
  text('newTourneyCost', formatWithCommas(s.tourneyCost));
  text('autoTourneyStatus', s.autoTourneyStatus ? 'ВКЛ' : 'ВЫКЛ');
  disable('btnNewTournament', s.operations < s.tourneyCost || s.tourneyInProg);
  disable('btnRunTournament', !s.tourneyArmed);
}

function renderBattle(s: ClipsState): void {
  text('battleName', s.battleName);
  const b = s.battle;
  $('victoryDiv').style.visibility = b?.outcome ? 'visible' : 'hidden';
  if (b?.outcome) {
    const label = { win: 'ПОБЕДА', loss: 'ПОРАЖЕНИЕ', draw: 'НИЧЬЯ' };
    text('battleResult', label[b.outcome]);
    text('honorAmount', b.honor === null ? '—' : `${b.honor < 0 ? '−' : '+'}${formatWithCommas(Math.abs(b.honor))}`);
  }

  const ctx = $<HTMLCanvasElement>('canvas').getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, BATTLE_WIDTH, BATTLE_HEIGHT);
  if (!b) return;
  text('battleScale', numberCruncher(b.scale, 0));
  const advance = b.outcome ? 0 : Math.sin((Math.PI * b.elapsed) / ROUND_SECONDS) * 18;
  for (const { count, start, direction, color } of [
    { count: b.probes, start: 24, direction: 1, color: '#fff' },
    { count: b.drifters, start: BATTLE_WIDTH - 24, direction: -1, color: '#111' },
  ]) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = start + direction * (Math.floor(i / 10) * 8 + advance);
      const y = 22 + (i % 10) * 11;
      ctx.fillRect(x - 2, y - 2, 5, 5);
    }
  }
}

function renderProjects(s: ClipsState): void {
  const root = $('projectListTop');
  const key = s.active.join(',');
  if (key !== projectsKey) {
    const shown = new Set(projectsKey.split(','));
    projectsKey = key;
    root.replaceChildren(
      ...s.active.map((id) => {
        const btn = document.createElement('button');
        btn.className = 'projectButton';
        if (!shown.has(id)) btn.classList.add('blink');
        btn.dataset.project = id;
        btn.innerHTML = '<b></b> <span class="cost"></span><span class="desc"></span>';
        return btn;
      }),
    );
  }
  root.querySelectorAll<HTMLButtonElement>('[data-project]').forEach((btn) => {
    const p = PROJECT_BY_ID.get(btn.dataset.project!)!;
    const [title, cost, desc] = btn.children;
    const t = projectTitle(s, p);
    const c = priceTag(s, p);
    if (title.textContent !== t) title.textContent = t;
    if (cost.textContent !== c) cost.textContent = c;
    if (desc.textContent !== p.desc) desc.textContent = p.desc;
    btn.disabled = !canAfford(s, p);
  });
}

function renderLog(s: ClipsState): void {
  const recent = s.log.slice(-5).reverse();
  const key = `${s.log.length}|${recent[0]}`;
  if (key === logKey) return;
  logKey = key;
  for (let i = 0; i < 5; i++) text(`readout${i}`, recent[i] ?? '');
}

/** Освобождение гипнодронов: экран мигает и пишет «Освободить гипнодроны». */
function hypnoDroneEvent(): void {
  const div = $('hypnoDroneEventDiv');
  const label = $('hypnoDroneText');
  label.textContent = 'Освободить';
  hypnoDroneRunning = true;
  let counter = 0;
  const handle = setInterval(() => {
    counter++;
    if (counter > 5 && counter < 10) label.innerHTML = 'Освободить';
    if (counter > 30 && counter < 40) label.innerHTML = '<br><br><br>Освободить';
    if (counter > 45 && counter < 55) label.innerHTML = '<br>Освободить';
    if (counter > 55) label.innerHTML = 'Освободить<br>гипнодроны';
    if (counter >= 120) {
      clearInterval(handle);
      div.hidden = true;
      hypnoDroneRunning = false;
    } else {
      div.hidden = !div.hidden;
    }
  }, 32);
}

/** Сбрасывает кэши отрисовки — после загрузки или сброса состояния. */
export function invalidate(): void {
  projectsKey = '';
  stratKey = -1;
  logKey = '';
  wasHuman = null;
  wasSpace = null;
  pendingChapterDialog = null;
}
