import { describe, expect, it } from 'vitest';
import { ClipsState, newGame, probeUsedTrust } from './state';
import { step } from './sim';
import * as act from './actions';
import { PROJECTS, canAfford, manageProjects, priceTag } from './projects';
import { newTourney, runTourney } from './strategy';
import { exportSave, fromLegacy, importSave } from './save';
import { checkpoints } from './debug';
import { checkForBattles, ROUND_SECONDS, stepBattle } from './combat';
import { formatWithCommas, spellf, timeCruncher } from './format';

/** Порядок проектов в оригинале: по нему переносятся старые сохранения. */
const LEGACY_ORDER = (
  '1 2 3 4 5 6 7 8 9 10 10b 11 12 13 14 15 17 16 18 19 20 21 22 23 24 25 26 34 70 35 27 28 29 30 31 ' +
  '41 37 38 42 43 44 45 40 40b 46 50 51 60 61 62 63 64 65 66 100 101 102 110 111 112 118 119 120 121 125 126 127 ' +
  '128 129 130 131 132 133 134 135 140 141 142 143 144 145 146 147 148 200 201 210 211 212 213 214 215 216 217 218 ' +
  '219'
).split(' ');

const run = (s: ClipsState, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s);
};

/** Простой бот первой фазы: делает скрепки, держит проволоку, станки и цену, покупает проекты. */
function bot(s: ClipsState): void {
  act.clipClick(s, 1);
  if (s.wire < 100) act.buyWire(s);
  if (s.funds - s.clipperCost > s.wireCost * 2) act.makeClipper(s);
  if (s.megaClipperFlag && s.funds - s.megaClipperCost > s.wireCost * 2) act.makeMegaClipper(s);
  if (s.funds - s.adCost > s.wireCost * 3) act.buyAds(s);
  if (s.unsoldClips > s.clipRate * 5 + 100) act.lowerPrice(s);
  else if (s.unsoldClips < s.clipRate + 10) act.raisePrice(s);
  while (s.trust > s.processors + s.memory) {
    if (s.memory < s.processors * 2 || s.memory < 10) act.addMem(s);
    else act.addProc(s);
  }
  for (const id of s.active) {
    const p = PROJECTS.find((x) => x.id === id)!;
    if (canAfford(s, p) && id !== '2') act.buyProject(s, id);
  }
}

describe('ООО «Скрепкус»', () => {
  it('отладочные точки проходят тики и переходы между этапами', () => {
    for (const checkpoint of checkpoints) {
      const s = checkpoint.create();
      run(s, 100);
      expect(Number.isFinite(s.clips)).toBe(true);
    }
    for (const [index, project, flag] of [
      [1, '35', 'humanFlag'],
      [3, '46', 'spaceFlag'],
    ] as const) {
      const s = checkpoints[index].create();
      manageProjects(s);
      expect(s.active).toContain(project);
      act.buyProject(s, project);
      expect(s[flag]).toBe(flag === 'spaceFlag');
    }
  });
  it('отладочная точка открывает диалог с императором Дрейфа с самого начала', () => {
    const s = checkpoints.find((checkpoint) => checkpoint.name === 'Начало диалога с императором Дрейфа')!.create();
    const earlierProjects = PROJECTS.slice(
      0,
      PROJECTS.findIndex((project) => project.id === '140'),
    );
    expect(s.done).toEqual(expect.arrayContaining(earlierProjects.map((project) => project.id)));
    manageProjects(s);
    expect(s.active).toEqual(['140']);
    run(s, 100);
    expect(s.active).toEqual(['140']);
    expect(s.done).not.toContain('140');
    act.buyProject(s, '140');
    manageProjects(s);
    expect(s.active).toContain('141');
  });
  it('после отказа в отладочной точке можно завершить разборку и увидеть титры', () => {
    const s = checkpoints.find((checkpoint) => checkpoint.name === 'Начало диалога с императором Дрейфа')!.create();
    for (const id of ['140', '141', '142', '143', '144', '145', '146', '148']) {
      manageProjects(s);
      expect(s.active).toContain(id);
      act.buyProject(s, id);
      expect(s.done).toContain(id);
    }
    for (const id of ['210', '211', '212', '213', '214', '215', '216']) {
      run(s, 1100);
      expect(s.active).toContain(id);
      expect(
        canAfford(
          s,
          PROJECTS.find((project) => project.id === id)!,
        ),
      ).toBe(true);
      act.buyProject(s, id);
      expect(s.done).toContain(id);
    }
    act.clipClick(s, s.wire);
    run(s, 1000);
    expect(s.milestoneFlag).toBe(20);
  });
  it('отладочная точка титров запускает финал с первой строки', () => {
    const s = checkpoints.find((checkpoint) => checkpoint.name === 'Финальные титры и музыка')!.create();
    expect(s.endTimer6).toBe(500);
    expect(s.milestoneFlag).toBe(16);
    expect(s.log.join(' ')).toContain('По мотивам Universal Paperclips');
    run(s, 400);
    expect(s.milestoneFlag).toBe(20);
    expect(s.log.slice(-5).reverse()).toEqual([
      '© 2026 Kagulion',
      'Universal Paperclips © 2017 Everybody House Games',
      'Код, музыка и оформление «Скрепкуса»',
      'Оригинальная игра — Фрэнк Лантц',
      'По мотивам Universal Paperclips',
    ]);
  });
  it('показывает титры перед переходом в каждую новую вселенную', () => {
    for (const [id, destination] of [
      ['200', 'universe'],
      ['201', 'simulation'],
    ] as const) {
      const s = newGame();
      Object.assign(s, { milestoneFlag: 15, operations: 300_000, standardOps: 300_000, creativity: 300_000 });
      s.done.push('147');
      manageProjects(s);
      act.buyProject(s, id);
      expect(s.creditsRestart).toBe(destination);
      expect(s.restart).toBeNull();
      const restored = importSave(exportSave(s));
      run(restored, 401);
      expect(restored.milestoneFlag).toBe(20);
      expect(restored.restart).toBeNull();
      run(restored, 300);
      expect(restored.restart).toBe(destination);
    }
  });
  it('проекты идут в порядке оригинала и с уникальными номерами', () => {
    expect(PROJECTS.map((p) => p.id)).toEqual(LEGACY_ORDER);
  });

  it('форматирует числа по-русски', () => {
    expect(formatWithCommas(1234567)).toBe('1 234 567');
    expect(formatWithCommas(5.678, 2)).toBe('5,67');
    expect(formatWithCommas(-4567890)).toBe('-4 567 890');
    expect(formatWithCommas(1e21)).toBe(`1${' 000'.repeat(7)}`);
    expect(spellf(2.5e15)).toBe('2,50 квадриллиона');
    expect(timeCruncher(366_100)).toBe('1 ч 1 мин 1 сек');
    expect(
      priceTag(
        newGame(),
        PROJECTS.find((p) => p.id === '34')!,
      ),
    ).toBe('(7 500 оп., 1 ед. доверия)');
  });

  it('продаёт скрепки и открывает вычисления', () => {
    const s = newGame();
    for (let i = 0; i < 1000; i++) act.clipClick(s, 1);
    expect(s.wire).toBe(0);
    expect(s.demand).toBe(5);
    run(s, 6000);
    expect(s.demand).toBeCloseTo(3.2);
    expect(s.clipsSold).toBeGreaterThan(0);
    expect(s.funds).toBeCloseTo(s.clipsSold * 0.25, 0);
    s.funds += 100;
    act.buyWire(s);
    expect(s.wirePurchase).toBe(1);
    for (let i = 0; i < 1000; i++) act.clipClick(s, 1);
    run(s, 10);
    expect(s.compFlag).toBe(true);
    run(s, 1000);
    expect(s.operations).toBeGreaterThan(0);
    expect(s.active).toContain('42');
  });

  it('бот за 20 минут разворачивает производство', () => {
    const s = newGame();
    for (let t = 0; t < 20 * 60 * 100; t++) {
      if (t % 10 === 0) bot(s);
      step(s);
    }
    expect(s.clips).toBeGreaterThan(20_000);
    expect(s.trust).toBeGreaterThanOrEqual(6);
    expect(s.clipmakerLevel).toBeGreaterThan(10);
    expect(s.done).toEqual(expect.arrayContaining(['1', '4', '7', '42']));
    expect(Number.isFinite(s.funds)).toBe(true);
  });

  it('списывает цену проекта и повторяет повторяемые', () => {
    const s = newGame();
    s.wire = 0;
    s.funds = 0;
    manageProjects(s);
    expect(s.active).toContain('2');
    act.buyProject(s, '2');
    expect(s.trust).toBe(1);
    expect(s.wire).toBe(s.wireSupply);
    expect(s.active).not.toContain('2');
    s.wire = 0;
    manageProjects(s);
    expect(s.active).toContain('2');

    s.creativity = 60;
    manageProjects(s);
    act.buyProject(s, '13');
    expect(s.creativity).toBe(10);
    expect(s.trust).toBe(2);
    expect(s.log.slice(-2)[0]).toContain('Лексическая обработка');
  });

  it('проводит турнир и начисляет ёми', () => {
    const s = newGame();
    s.strategyEngineFlag = true;
    s.compFlag = true;
    s.stratCount = 8;
    s.memory = 10;
    s.standardOps = 10_000;
    run(s, 1);
    s.pick = 3;
    newTourney(s);
    expect(s.tourneyArmed).toBe(true);
    runTourney(s);
    expect(s.tourneyRunning).toBe(true);
    // 64 раунда по 10 ходов, ход — раз в 10 тиков.
    run(s, 64 * 100 + 20);
    expect(s.tourneyInProg).toBe(false);
    expect(s.resultsFlag).toBe(true);
    expect(s.results).toHaveLength(8);
    expect(s.yomi).toBeGreaterThan(0);
  });

  it('остаток заряда питает производство без отрицательной мощности', () => {
    const s = newGame();
    Object.assign(s, {
      humanFlag: false,
      farmLevel: 1,
      factoryLevel: 1,
      harvesterLevel: 1,
      wireDroneLevel: 1,
      storedPower: 0.1,
      wire: 1000,
      acquiredMatter: 1000,
    });
    const availableMatter = s.availableMatter;
    step(s);
    // Выработка 0,5 и остаток заряда 0,1 покрывают часть потребления 2,02 за тик.
    expect(s.powMod).toBeCloseTo(0.6 / 2.02);
    expect(s.storedPower).toBe(0);
    expect(s.clips).toBeGreaterThan(0);
    expect(s.availableMatter).toBeLessThanOrEqual(availableMatter);
    expect(s.acquiredMatter).toBeGreaterThanOrEqual(0);
    expect(s.wire).toBeGreaterThanOrEqual(0);
  });

  it('накапливает дробное потомство и оплачивает только родившийся зонд', () => {
    const s = newGame();
    Object.assign(s, {
      humanFlag: false,
      spaceFlag: true,
      powMod: 1,
      probeCount: 10_000,
      probeRep: 1,
      probeHaz: 1_000_000,
      unusedClips: 10 * s.probeCost,
      done: ['148'],
    });
    const budget = s.unusedClips;
    step(s);
    expect(s.probeDescendents).toBe(0);
    expect(s.probeCount).toBe(10_000);
    expect(s.unusedClips).toBe(budget);
    step(s);
    expect(s.probeDescendents).toBe(1);
    expect(s.probeCount).toBe(10_001);
    expect(s.unusedClips).toBe(budget - s.probeCost);
  });

  it('запускает зонд при точной цене, но не при нехватке скрепок', () => {
    const s = newGame();
    s.unusedClips = s.probeCost / 2;
    act.makeProbe(s);
    expect(s.probeCount).toBe(0);
    expect(s.unusedClips).toBe(s.probeCost / 2);
    s.unusedClips = s.probeCost;
    act.makeProbe(s);
    expect(s.probeCount).toBe(1);
    expect(s.probeLaunchLevel).toBe(1);
    expect(s.unusedClips).toBe(0);
  });

  it('рассчитывает космическую фазу и сражения', () => {
    const s = newGame();
    s.humanFlag = false;
    s.spaceFlag = true;
    s.probeCount = 1e9;
    s.drifterCount = 1e9;
    s.probeTrust = 6;
    Object.assign(s, { probeSpeed: 1, probeNav: 1, probeRep: 1, probeCombat: 2, probeHaz: 1 });
    s.unusedClips = 1e30;
    expect(probeUsedTrust(s)).toBe(6);
    run(s, 2000);
    expect(s.battleFlag).toBe(true);
    expect(s.probesLostCombat + s.driftersKilled).toBeGreaterThan(0);
    expect(s.foundMatter).toBeGreaterThan(newGame().foundMatter);
    expect(s.probeDescendents).toBeGreaterThan(0);
  });

  it('начисляет честь за победу один раз и списывает потери из численности флота', () => {
    const s = newGame();
    s.done.push('121', '134');
    s.probeCount = 20;
    s.drifterCount = 1;
    s.warTrigger = 0;
    s.probeCombat = 5;
    checkForBattles(s);
    stepBattle(s, ROUND_SECONDS);

    expect(s.battle?.outcome).toBe('win');
    expect(s.probeCount).toBe(19);
    expect(s.probesLostCombat).toBe(1);
    expect(s.drifterCount).toBe(0);
    expect(s.driftersKilled).toBe(1);
    expect(s.honor).toBe(1);
    expect(s.bonusHonor).toBe(10);

    stepBattle(s, 10);
    expect(s.battle).toBeNull();
    expect(s.honor).toBe(1);
    expect(s.bonusHonor).toBe(10);
  });

  it('сохранение переживает экспорт и импорт', () => {
    const s = newGame();
    s.clips = 12345;
    s.prestigeU = 2;
    s.prestigeS = 3;
    s.done = ['1', '3'];
    s.uses = { 2: 0 };
    s.battle = {
      scale: 1,
      initialProbes: 1,
      initialDrifters: 1,
      probes: 1,
      drifters: 1,
      elapsed: 0,
      outcome: null,
      honor: null,
    };
    s.tourneyInProg = true;
    const back = importSave(exportSave(s));
    expect(back.clips).toBe(12345);
    expect(back.prestigeU).toBe(2);
    expect(back.prestigeS).toBe(3);
    expect(back.done).toEqual(['1', '3']);
    expect(back.uses).toEqual({ 2: 0 });
    expect(back.battle).toBeNull();
    expect(back.tourneyInProg).toBe(false);
  });

  it('отклоняет некорректные коды сохранения', () => {
    expect(() => importSave('not base64')).toThrow(Error);
    expect(() => importSave(btoa('{}'))).toThrow('Invalid save');
    const invalid = newGame();
    invalid.clips = 'invalid' as unknown as number;
    expect(() => importSave(exportSave(invalid))).toThrow('Invalid save');
    const badStocks = newGame();
    badStocks.stocks = [null as unknown as (typeof badStocks.stocks)[number]];
    expect(() => importSave(exportSave(badStocks))).toThrow('Invalid save');
    const badProjects = newGame();
    badProjects.active = [42 as unknown as string];
    expect(() => importSave(exportSave(badProjects))).toThrow('Invalid save');
  });

  it('переносит сохранение прежней версии', () => {
    const uses = LEGACY_ORDER.map(() => 1);
    const flags = LEGACY_ORDER.map(() => 0);
    const i3 = LEGACY_ORDER.indexOf('3');
    uses[i3] = 0;
    flags[i3] = 1;
    const s = fromLegacy(
      {
        clips: 5000,
        funds: 12.5,
        humanFlag: 1,
        compFlag: 1,
        creativityOn: true,
        wireBuyerStatus: 0,
        pick: '2',
        giftCountdown: null,
        incomeTracker: [0, null, 3],
      },
      uses,
      flags,
      ['projectButton42'],
      [1, 1, 1, 0, 0, 0, 0, 0],
    );
    expect(s.clips).toBe(5000);
    expect(s.compFlag).toBe(true);
    expect(s.wireBuyerStatus).toBe(false);
    expect(s.pick).toBe(2);
    expect(s.giftCountdown).toBe(newGame().giftCountdown);
    expect(s.incomeTracker).toEqual([0, 3]);
    expect(s.stratCount).toBe(3);
    expect(s.done).toEqual(['3']);
    expect(s.uses['3']).toBe(0);
    expect(s.active).toEqual(['42']);
  });
});
