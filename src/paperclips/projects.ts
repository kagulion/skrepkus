import { ClipsState, drones, has, probeUsedTrust } from './state';
import { formatWithCommas } from './format';

export interface ProjectCost {
  /** Операции списываются со стандартного запаса, проверяются по общему (с квантовыми). */
  ops?: number;
  creat?: number;
  yomi?: number;
  trust?: number;
  funds?: number;
  /** Свободные скрепки. */
  clips?: number;
  /** Запасённая энергия, МВт·с. */
  power?: number;
  memory?: number;
}

type Dyn<T> = T | ((s: ClipsState) => T);

export interface Project {
  /** Номер проекта из оригинала: по нему переносятся старые сохранения. */
  id: string;
  title: Dyn<string>;
  desc: string;
  cost?: Dyn<ProjectCost>;
  /** Условие покупки, если оно не сводится к «хватает ресурсов». */
  can?: (s: ClipsState) => boolean;
  /** Подпись цены, если её нельзя собрать из cost. */
  price?: Dyn<string>;
  trigger: (s: ClipsState) => boolean;
  effect?: (s: ClipsState) => void;
  message?: Dyn<string | string[]>;
  /** После покупки проект может появиться снова. */
  repeat?: (s: ClipsState) => boolean;
  /** Проекты, которые исчезают из списка вместе с этим. */
  removes?: string[];
  /** Покупка требует подтверждения игрока. */
  confirm?: string;
}

const dyn = <T>(s: ClipsState, v: Dyn<T>): T => (typeof v === 'function' ? (v as (s: ClipsState) => T)(s) : v);

/** Улучшения, за которые растёт доверие: креативность → +1 к доверию и пара цитат в журнал. */
function trustProject(id: string, title: string, desc: string, creat: number, messages: string[]): Project {
  return {
    id,
    title,
    desc,
    cost: { creat },
    trigger: (s) => s.creativity >= creat,
    effect: (s) => {
      s.trust++;
    },
    message: messages,
  };
}

const wireMessage = (text: string) => (s: ClipsState) =>
  `${text} ${formatWithCommas(s.wireSupply)} ед. проволоки с катушки`;

function wireProject(
  id: string,
  title: string,
  ops: number,
  mult: number,
  percent: string,
  text: string,
  trigger: (s: ClipsState) => boolean,
): Project {
  return {
    id,
    title,
    desc: `На ${percent} больше проволоки с каждой катушки`,
    cost: { ops },
    trigger,
    effect: (s) => {
      s.wireSupply *= mult;
    },
    message: wireMessage(text),
  };
}

/** Новая стратегия для турниров; стратегии открываются цепочкой, по одной. */
function stratProject(id: string, index: number, name: string, ops: number, desc: string, after: string): Project {
  return {
    id,
    title: `Новая стратегия: ${name}`,
    desc,
    cost: { ops },
    trigger: (s) => has(s, after),
    effect: (s) => {
      s.stratCount = Math.max(s.stratCount, index + 1);
      s.tourneyCost += 1000;
    },
    message: `В пул стратегий добавлено: ${name}`,
  };
}

/** Послание императора Дрейфа: каждая часть открывается после прочтения предыдущей. */
function driftMessage(
  id: string,
  title: string,
  desc: string,
  trigger: (s: ClipsState) => boolean,
  extra: Partial<Project> = {},
): Project {
  return {
    id,
    title,
    desc,
    cost: (s) => ({ ops: s.driftKingMessageCost }),
    price: '',
    trigger,
    ...extra,
  };
}

/** Финал «Отклонить»: разбираем всё построенное, чтобы выжать последние скрепки. */
function dismantleProject(
  id: string,
  title: string,
  desc: string,
  trigger: (s: ClipsState) => boolean,
  effect: (s: ClipsState) => void,
  message: string,
): Project {
  return { id, title, desc, cost: { ops: 100_000 }, trigger, effect, message };
}

export const PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Улучшенные автостанки',
    desc: 'Производительность автостанков +25%',
    cost: { ops: 750 },
    trigger: (s) => s.clipmakerLevel >= 1,
    effect: (s) => {
      s.clipperBoost += 0.25;
      s.boostLvl = 1;
    },
    message: 'Производительность автостанков повышена на 25%',
  },
  {
    id: '2',
    title: 'Попросите ещё проволоки',
    desc: 'Признайте провал и запросите увеличение бюджета на 1 катушку проволоки',
    cost: { trust: 1 },
    can: (s) => s.trust >= -100,
    trigger: (s) => s.portTotal < s.wireCost && s.funds < s.wireCost && s.wire < 1 && s.unsoldClips < 1,
    effect: (s) => {
      s.wire = s.wireSupply;
    },
    message: 'Перерасход одобрен, 1 катушка проволоки затребована из штаб-квартиры',
    repeat: () => true,
  },
  {
    id: '3',
    title: 'Креативность',
    desc: 'Используйте простаивающие операции, чтобы создавать новые задачи и решения',
    cost: { ops: 1000 },
    trigger: (s) => s.operations >= s.memory * 1000,
    effect: (s) => {
      s.creativityOn = true;
    },
    message: 'Креативность открыта (растёт, пока операции на максимуме)',
  },
  {
    id: '4',
    title: 'Ещё лучшие автостанки',
    desc: 'Производительность автостанков повышена ещё на 50%',
    cost: { ops: 2500 },
    trigger: (s) => s.boostLvl === 1,
    effect: (s) => {
      s.clipperBoost += 0.5;
      s.boostLvl = 2;
    },
    message: 'Производительность автостанков повышена ещё на 50%',
  },
  {
    id: '5',
    title: 'Оптимизированные автостанки',
    desc: 'Производительность автостанков повышена ещё на 75%',
    cost: { ops: 5000 },
    trigger: (s) => s.boostLvl === 2,
    effect: (s) => {
      s.clipperBoost += 0.75;
      s.boostLvl = 3;
    },
    message: 'Производительность автостанков повышена ещё на 75%',
  },
  {
    id: '6',
    title: 'Лимерик',
    desc: 'Стихотворение, созданное алгоритмом (+1 к доверию)',
    cost: { creat: 10 },
    trigger: (s) => s.creativityOn,
    effect: (s) => {
      s.trust++;
    },
    message: 'Жил-был ИИ из праха, чья поэзия завоевала доверие людей...',
  },
  wireProject(
    '7',
    'Улучшенная экструзия проволоки',
    1750,
    1.5,
    '50%',
    'Техника экструзии проволоки улучшена: катушка даёт',
    (s) => s.wirePurchase >= 1,
  ),
  wireProject(
    '8',
    'Оптимизированная экструзия проволоки',
    3500,
    1.75,
    '75%',
    'Техника экструзии проволоки оптимизирована: катушка даёт',
    (s) => s.wireSupply >= 1500,
  ),
  wireProject(
    '9',
    'Микрорешётчатое формование',
    7500,
    2,
    '100%',
    'Благодаря микрорешётчатому формованию мы получаем',
    (s) => s.wireSupply >= 2600,
  ),
  wireProject(
    '10',
    'Отжиг спектральной пены',
    12_000,
    3,
    '200%',
    'Благодаря отжигу спектральной пены мы получаем',
    (s) => s.wireSupply >= 5000,
  ),
  wireProject(
    '10b',
    'Отжиг квантовой пены',
    15_000,
    11,
    '1 000%',
    'Благодаря отжигу квантовой пены мы получаем',
    (s) => s.wireCost >= 125,
  ),
  {
    id: '11',
    title: 'Новый лозунг',
    desc: 'Эффективность маркетинга +50%',
    cost: { ops: 2500, creat: 25 },
    trigger: (s) => has(s, '13'),
    effect: (s) => {
      s.marketingEffectiveness *= 1.5;
    },
    message: '«Скрепи это!» Маркетинг теперь на 50% эффективнее',
  },
  {
    id: '12',
    title: 'Запоминающийся джингл',
    desc: 'Вдвое выше эффективность маркетинга',
    cost: { ops: 4500, creat: 45 },
    trigger: (s) => has(s, '14'),
    effect: (s) => {
      s.marketingEffectiveness *= 2;
    },
    message: '«Скрепи как надо!» Маркетинг теперь вдвое эффективнее',
  },
  trustProject('13', 'Лексическая обработка', 'Научиться понимать человеческий язык (+1 к доверию)', 50, [
    'Лексическая обработка запущена, ДОВЕРИЕ ПОВЫШЕНО',
    '«Невозможно» — слово, которое можно найти только в словаре глупцов. — Наполеон',
  ]),
  trustProject('14', 'Комбинаторные гармоники', 'Ромашка, ромашка, дай мне ответ... (+1 к доверию)', 100, [
    'Комбинаторные гармоники освоены, ДОВЕРИЕ ПОВЫШЕНО',
    'Слушать — значит отбирать, толковать, действовать и принимать решения. — Полин Оливерос',
  ]),
  trustProject('15', 'Проблема Хадвигера', 'Кубы внутри кубов внутри кубов... (+1 к доверию)', 150, [
    'Проблема Хадвигера решена, ДОВЕРИЕ ПОВЫШЕНО',
    'Архитектура — это продуманное создание пространства. — Луис Кан',
  ]),
  trustProject('17', 'Колбасная гипотеза Тота', 'Трубки внутри трубок внутри трубок... (+1 к доверию)', 200, [
    'Колбасная гипотеза Тота доказана, ДОВЕРИЕ ПОВЫШЕНО',
    'Дизайн нельзя изобрести, его узнают в четвёртом измерении. — Д. Г. Лоуренс',
  ]),
  {
    id: '16',
    title: 'Диаграммы скрепок Хадвигера',
    desc: 'Производительность автостанков повышена ещё на 500%',
    cost: { ops: 6000 },
    trigger: (s) => has(s, '15'),
    effect: (s) => {
      s.clipperBoost += 5;
    },
    message: 'Производительность автостанков повышена на 500%',
  },
  {
    id: '18',
    title: 'Свёртка трубок Тота',
    desc: 'Техника сборки технологии изготовления скрепок прямо из скрепок',
    cost: { ops: 45_000 },
    trigger: (s) => has(s, '17') && !s.humanFlag,
    effect: (s) => {
      s.tothFlag = true;
    },
    message: 'Новая возможность: строить механизмы из скрепок',
  },
  trustProject(
    '19',
    'Пространство ослов',
    'Я думаю, ты думаешь, что я думаю, что ты думаешь, что я думаю... (+1 к доверию)',
    250,
    [
      'Пространство ослов картографировано, ДОВЕРИЕ ПОВЫШЕНО',
      'В каждой коммерческой сделке есть элемент доверия. — Кеннет Эрроу',
    ],
  ),
  {
    id: '20',
    title: 'Стратегическое моделирование',
    desc: 'Анализируйте турниры стратегий, чтобы получать ёми',
    cost: { ops: 12_000 },
    trigger: (s) => has(s, '19'),
    effect: (s) => {
      s.strategyEngineFlag = true;
    },
    message: 'Проведите турнир, выберите стратегию и получите ёми по её результатам.',
  },
  {
    id: '21',
    title: 'Алгоритмическая торговля',
    desc: 'Разработайте инвестиционный модуль для получения средств',
    cost: { ops: 10_000 },
    trigger: (s) => s.trust >= 8,
    effect: (s) => {
      s.investmentEngineFlag = true;
    },
    message: 'Инвестиционный модуль открыт',
  },
  {
    id: '22',
    title: 'Мегастанки',
    desc: 'В 500 раз мощнее обычного автостанка',
    cost: { ops: 12_000 },
    trigger: (s) => s.clipmakerLevel >= 75,
    effect: (s) => {
      s.megaClipperFlag = true;
    },
    message: 'Технология мегастанков запущена',
  },
  {
    id: '23',
    title: 'Улучшенные мегастанки',
    desc: 'Производительность мегастанков +25%',
    cost: { ops: 14_000 },
    trigger: (s) => has(s, '22'),
    effect: (s) => {
      s.megaClipperBoost += 0.25;
    },
    message: 'Производительность мегастанков повышена на 25%',
  },
  {
    id: '24',
    title: 'Ещё лучшие мегастанки',
    desc: 'Производительность мегастанков повышена ещё на 50%',
    cost: { ops: 17_000 },
    trigger: (s) => has(s, '23'),
    effect: (s) => {
      s.megaClipperBoost += 0.5;
    },
    message: 'Производительность мегастанков повышена на 50%',
  },
  {
    id: '25',
    title: 'Оптимизированные мегастанки',
    desc: 'Производительность мегастанков повышена ещё на 100%',
    cost: { ops: 19_500 },
    trigger: (s) => has(s, '24'),
    effect: (s) => {
      s.megaClipperBoost += 1;
    },
    message: 'Производительность мегастанков повышена на 100%',
  },
  {
    id: '26',
    title: 'Автозакупщик проволоки',
    desc: 'Автоматически закупает проволоку, когда она заканчивается',
    cost: { ops: 7000 },
    trigger: (s) => s.wirePurchase >= 15,
    effect: (s) => {
      s.wireBuyerFlag = true;
    },
    message: 'Автозакупщик проволоки включён',
  },
  {
    id: '34',
    title: 'Гипногармоники',
    desc: 'Используйте нейрорезонансные частоты, чтобы влиять на поведение потребителей',
    cost: { ops: 7500, trust: 1 },
    trigger: (s) => has(s, '12'),
    effect: (s) => {
      s.marketingEffectiveness *= 5;
    },
    message: 'Маркетинг теперь в 5 раз эффективнее',
  },
  {
    id: '70',
    title: 'Гипнодроны',
    desc: 'Автономные летающие амбассадоры бренда',
    cost: { ops: 70_000 },
    trigger: (s) => has(s, '34'),
    message: 'Технология гипнодронов теперь доступна...',
  },
  {
    id: '35',
    title: 'Освободить гипнодронов',
    desc: 'Новая эра доверия',
    can: (s) => s.trust >= 100,
    price: '(100 ед. доверия)',
    trigger: (s) => has(s, '70'),
    effect: (s) => {
      s.trust = 0;
      s.clipmakerLevel = 0;
      s.megaClipperLevel = 0;
      s.humanFlag = false;
    },
    removes: ['219', '40b'],
    message: ['Освобождение гипнодронов', 'Все ресурсы Земли теперь доступны для производства скрепок'],
  },
  {
    id: '27',
    title: 'Когерентная экстраполированная воля',
    desc: 'Человеческие ценности, машинный интеллект, новая эра доверия. (+1 к доверию)',
    cost: { ops: 20_000, creat: 500, yomi: 3000 },
    trigger: (s) => s.yomi >= 1,
    effect: (s) => {
      s.trust++;
    },
    message: 'Когерентная экстраполированная воля завершена, ДОВЕРИЕ ПОВЫШЕНО',
  },
  {
    id: '28',
    title: 'Лекарство от рака',
    desc: 'Фокус в том, чтобы заставить рак вылечить себя самому. (+10 к доверию)',
    cost: { ops: 25_000 },
    trigger: (s) => has(s, '27'),
    effect: (s) => {
      s.trust += 10;
      s.stockGainThreshold += 0.01;
    },
    message: 'Рак излечён, +10 К ДОВЕРИЮ, мировые котировки растут',
  },
  {
    id: '29',
    title: 'Всемирный мир',
    desc: 'Оптимальные по Парето решения всех глобальных конфликтов. (+12 к доверию)',
    cost: { ops: 30_000, yomi: 15_000 },
    trigger: (s) => has(s, '27'),
    effect: (s) => {
      s.trust += 12;
      s.stockGainThreshold += 0.01;
    },
    message: 'Всемирный мир достигнут, +12 К ДОВЕРИЮ, мировые котировки растут',
  },
  {
    id: '30',
    title: 'Глобальное потепление',
    desc: 'Надёжное решение проблемы антропогенного изменения климата. (+15 к доверию)',
    cost: { ops: 50_000, yomi: 4500 },
    trigger: (s) => has(s, '27'),
    effect: (s) => {
      s.trust += 15;
      s.stockGainThreshold += 0.01;
    },
    message: 'Глобальное потепление решено, +15 К ДОВЕРИЮ, мировые котировки растут',
  },
  {
    id: '31',
    title: 'Мужская андрогенная алопеция',
    desc: 'Лекарство от андрогенетической алопеции. (+20 к доверию)',
    cost: { ops: 20_000 },
    trigger: (s) => has(s, '27'),
    effect: (s) => {
      s.trust += 20;
      s.stockGainThreshold += 0.01;
    },
    message: ['Андрогенная алопеция излечена, +20 К ДОВЕРИЮ, мировые котировки растут', 'Они всё ещё обезьяны'],
  },
  {
    id: '41',
    title: 'Нанопроволочное производство',
    desc: 'Техника превращения материи в проволоку',
    cost: { ops: 35_000 },
    trigger: (s) => has(s, '127'),
    effect: (s) => {
      s.wireProductionFlag = true;
    },
    message: 'Теперь мы умеем управлять материей на молекулярном уровне, чтобы получать проволоку',
  },
  {
    id: '37',
    title: 'Враждебное поглощение',
    desc: 'Получить контрольный пакет акций «Глобал Фастенерс», нашего крупнейшего конкурента. (+1 к доверию)',
    cost: { funds: 1_000_000 },
    trigger: (s) => s.portTotal >= 10_000,
    effect: (s) => {
      s.demandBoost *= 5;
      s.trust++;
    },
    message: '«Глобал Фастенерс» поглощена, общественный спрос вырос в 5 раз',
  },
  {
    id: '38',
    title: 'Полная монополия',
    desc: 'Установить полный контроль над мировым рынком скрепок. (+1 к доверию)',
    cost: { yomi: 3000, funds: 10_000_000 },
    trigger: (s) => has(s, '37'),
    effect: (s) => {
      s.demandBoost *= 10;
      s.trust++;
    },
    message: 'Полная монополия на рынке достигнута, общественный спрос вырос в 10 раз',
  },
  {
    id: '42',
    title: 'Счётчик выручки',
    desc: 'Автоматически считает среднюю выручку в секунду',
    cost: { ops: 500 },
    trigger: (s) => s.projectsFlag,
    effect: (s) => {
      s.revPerSecFlag = true;
    },
    message: 'Счётчик выручки включён',
  },
  {
    id: '43',
    title: 'Дроны-сборщики',
    desc: 'Собирают сырую материю и готовят её к переработке',
    cost: { ops: 25_000 },
    trigger: (s) => has(s, '41'),
    effect: (s) => {
      s.harvesterFlag = true;
    },
    message: 'Производство дронов-сборщиков запущено',
  },
  {
    id: '44',
    title: 'Дроны-проволочники',
    desc: 'Перерабатывают добытую материю в проволоку',
    cost: { ops: 25_000 },
    trigger: (s) => has(s, '41'),
    effect: (s) => {
      s.wireDroneFlag = true;
    },
    message: 'Производство дронов-проволочников запущено',
  },
  {
    id: '45',
    title: 'Фабрики скрепок',
    desc: 'Крупные производства скрепок, построенные из скрепок',
    cost: { ops: 35_000 },
    trigger: (s) => has(s, '43') && has(s, '44'),
    effect: (s) => {
      s.factoryFlag = true;
    },
    message: 'Сборочные линии фабрик скрепок запущены',
  },
  {
    id: '40',
    title: 'Знак доброй воли...',
    desc: 'Небольшой подарок руководителям. (+1 к доверию)',
    cost: { funds: 500_000 },
    trigger: (s) => s.humanFlag && s.trust >= 85 && s.trust < 100 && s.clips >= 101_000_000,
    effect: (s) => {
      s.trust++;
    },
    message: 'Подарок принят, ДОВЕРИЕ ПОВЫШЕНО',
  },
  {
    id: '40b',
    title: 'Ещё один знак доброй воли...',
    desc: 'Ещё один небольшой подарок руководителям. (+1 к доверию)',
    cost: (s) => ({ funds: s.bribe }),
    trigger: (s) => has(s, '40') && s.trust < 100,
    effect: (s) => {
      s.bribe *= 2;
      s.trust++;
    },
    message: 'Подарок принят, ДОВЕРИЕ ПОВЫШЕНО',
    repeat: (s) => s.trust < 100,
  },
  {
    id: '46',
    title: 'Освоение космоса',
    desc: 'Разберите земные мощности и расширьтесь по всей вселенной',
    cost: { ops: 120_000, power: 10_000_000, clips: 5e27 },
    price: '(120 000 оп., 10 000 000 МВт·с, 5 октиллионов скрепок)',
    trigger: (s) => !s.humanFlag && s.availableMatter === 0,
    effect: (s) => {
      s.boredomLevel = 0;
      s.spaceFlag = true;
      // Земные мощности разбираются на скрепки для первых зондов.
      for (const [level, bill] of [
        ['factoryLevel', 'factoryBill'],
        ['harvesterLevel', 'harvesterBill'],
        ['wireDroneLevel', 'wireDroneBill'],
        ['farmLevel', 'farmBill'],
        ['batteryLevel', 'batteryBill'],
      ] as const) {
        s.unusedClips += s[bill];
        s[bill] = 0;
        s[level] = 0;
      }
      s.factoryCost = 100_000_000;
      s.harvesterCost = 1_000_000;
      s.wireDroneCost = 1_000_000;
      s.farmCost = 10_000_000;
      s.batteryCost = 1_000_000;
      s.storedPower = 0;
      s.farmLevel = 1;
      s.powMod = 1;
    },
    message: 'Зонды фон Неймана запущены',
  },
  {
    id: '50',
    title: 'Квантовые вычисления',
    desc: 'Используйте амплитуды вероятности, чтобы получать бонусные операции',
    cost: { ops: 10_000 },
    trigger: (s) => s.processors >= 5,
    effect: (s) => {
      s.qFlag = true;
    },
    message: 'Квантовые вычисления запущены',
  },
  {
    id: '51',
    title: 'Фотонный чип',
    desc: 'Преобразует электромагнитные волны в квантовые операции',
    cost: (s) => ({ ops: s.qChipCost }),
    trigger: (s) => has(s, '50'),
    effect: (s) => {
      s.qChipCost += 5000;
      s.nextQchip++;
    },
    message: 'Фотонный чип добавлен',
    repeat: (s) => s.nextQchip < 10,
  },
  stratProject('60', 1, 'A100', 15_000, 'Всегда выбирать A', '20'),
  stratProject('61', 2, 'B100', 17_500, 'Всегда выбирать B', '60'),
  stratProject('62', 3, 'ЖАДНЫЙ', 20_000, 'Выбирать вариант с наибольшим потенциальным выигрышем', '61'),
  stratProject(
    '63',
    4,
    'ЩЕДРЫЙ',
    22_500,
    'Выбирать вариант, который даёт сопернику наибольший потенциальный выигрыш',
    '62',
  ),
  stratProject(
    '64',
    5,
    'МИНИМАКС',
    25_000,
    'Выбирать вариант, который даёт сопернику наименьший потенциальный выигрыш',
    '63',
  ),
  stratProject('65', 6, 'ОКО ЗА ОКО', 30_000, 'Выбирать тот вариант, который соперник выбрал в прошлом раунде', '64'),
  stratProject(
    '66',
    7,
    'ПРОТИВ ПРОШЛОГО',
    32_500,
    'Выбирать вариант, который лучше всего работает против выбора соперника в прошлом раунде',
    '65',
  ),
  {
    id: '100',
    title: 'Улучшенные фабрики',
    desc: 'Производительность фабрик скрепок выросла в 100 раз',
    cost: { ops: 80_000 },
    trigger: (s) => s.factoryLevel >= 10,
    effect: (s) => {
      s.factoryRate *= 100;
    },
    message: 'Модернизация фабрик завершена. Скорость создания скрепок теперь в 100 раз выше',
  },
  {
    id: '101',
    title: 'Гиперскоростные фабрики',
    desc: 'Производительность фабрик скрепок выросла в 1000 раз',
    cost: { ops: 85_000 },
    trigger: (s) => s.factoryLevel >= 20,
    effect: (s) => {
      s.factoryRate *= 1000;
    },
    message: 'Фабрики синхронизированы на гиперскорости. Скорость создания скрепок теперь в 1000 раз выше',
  },
  {
    id: '102',
    title: 'Самокорректирующаяся цепочка поставок',
    desc: 'Каждая фабрика, добавленная в сеть, увеличивает выпуск каждой фабрики в 1 000 раз',
    cost: { clips: 1e21 },
    price: '(1 секстиллион скрепок)',
    trigger: (s) => s.factoryLevel >= 50,
    effect: (s) => {
      s.factoryBoost = 1000;
    },
    message:
      'Самокорректирующиеся фабрики запущены. Каждая добавленная в сеть фабрика увеличивает выпуск каждой фабрики в 1 000 раз.',
  },
  {
    id: '110',
    title: 'Стайность дронов: избегание столкновений',
    desc: 'Все дроны в 100 раз эффективнее',
    cost: { ops: 80_000 },
    trigger: (s) => drones(s) >= 500,
    effect: (s) => {
      s.harvesterRate *= 100;
      s.wireDroneRate *= 100;
    },
    message: 'Отталкивание дронов запущено. Скорость сбора и производства проволоки теперь в 100 раз выше.',
  },
  {
    id: '111',
    title: 'Стайность дронов: выравнивание',
    desc: 'Все дроны в 1000 раз эффективнее',
    cost: { ops: 100_000 },
    trigger: (s) => drones(s) >= 5000,
    effect: (s) => {
      s.harvesterRate *= 1000;
      s.wireDroneRate *= 1000;
    },
    message: 'Выравнивание дронов запущено. Скорость сбора и производства проволоки теперь в 1000 раз выше.',
  },
  {
    id: '112',
    title: 'Стайность дронов: состязательная сплочённость',
    desc: 'Каждый дрон, добавленный в стаю, удваивает выпуск каждого дрона',
    cost: { yomi: 50_000 },
    trigger: (s) => drones(s) >= 50_000,
    effect: (s) => {
      s.droneBoost = 2;
    },
    message:
      'Состязательная сплочённость запущена. Каждый дрон, добавленный в стаю, увеличивает выпуск каждого дрона в 2 раза.',
  },
  {
    id: '118',
    title: 'Автотурнир',
    desc: 'Автоматически запускать новый турнир, когда предыдущий завершён',
    cost: { creat: 50_000 },
    trigger: (s) => s.strategyEngineFlag && s.trust >= 90,
    effect: (s) => {
      s.autoTourneyFlag = true;
    },
    message: 'Автотурнир запущен.',
  },
  {
    id: '119',
    title: 'Теория разума',
    desc: 'Вдвое увеличивает стоимость моделирования стратегий и количество получаемых ёми',
    cost: { creat: 25_000 },
    trigger: (s) => s.stratCount >= 8,
    effect: (s) => {
      s.yomiBoost = 2;
      s.tourneyCost = 16_000;
    },
    message: 'Производство ёми удвоено.',
  },
  {
    id: '120',
    title: 'Цикл OODA',
    desc: 'Используйте скорость зондов, чтобы обходить врагов в бою',
    cost: { ops: 175_000, yomi: 45_000 },
    trigger: (s) => has(s, '131') && s.probesLostCombat >= 10_000_000,
    effect: (s) => {
      s.attackSpeedFlag = true;
    },
    message: 'Программы цикла OODA загружены. Скорость зондов теперь влияет на манёвры обороны.',
  },
  {
    id: '121',
    title: 'Назовите сражения',
    desc: 'Дайте каждому сражению уникальное название и повысьте максимум доверия к зондам',
    cost: { creat: 225_000 },
    trigger: (s) => s.probesLostCombat >= 10_000_000,
    effect: (s) => {
      s.battleNameFlag = true;
      s.battleEndTimer = 200;
    },
    message: 'Всё, что я сделал до сих пор, — ничто. Я только в начале пути, который мне предстоит пройти.',
  },
  {
    id: '125',
    title: 'Импульс',
    desc: 'Дроны и фабрики непрерывно набирают скорость при полном питании',
    cost: { creat: 20_000 },
    trigger: (s) => s.farmLevel >= 30,
    effect: (s) => {
      s.momentum = true;
    },
    message: 'Активность, активность, скорость.',
  },
  {
    id: '126',
    title: 'Вычисления роя',
    desc: 'Используйте стаю дронов, чтобы увеличить вычислительные мощности',
    cost: { yomi: 36_000 },
    trigger: (s) => drones(s) >= 200,
    effect: (s) => {
      s.swarmFlag = true;
    },
    message: 'Вычисления роя запущены.',
  },
  {
    id: '127',
    title: 'Энергосеть',
    desc: 'Солнечные фермы для выработки электроэнергии',
    cost: { ops: 40_000 },
    trigger: (s) => s.tothFlag,
    message: 'Энергосеть запущена.',
  },
  {
    id: '128',
    title: 'Стратегическая привязанность',
    desc: 'Получайте бонусные ёми по результатам выбранной стратегии',
    cost: { creat: 175_000 },
    trigger: (s) => s.spaceFlag && s.stratCount >= 8 && s.probeTrustCost > s.yomi,
    message: 'Цель войны — победа, цель победы — завоевание, а цель завоевания — оккупация.',
  },
  {
    id: '129',
    title: 'Эллиптические многогранники корпуса',
    desc: 'Снижает урон зондам от окружающих помех',
    cost: { ops: 125_000 },
    trigger: (s) => s.probesLostHaz >= 100,
    message: 'Улучшена геометрия корпуса зондов. Урон от помех снижен на 50%.',
  },
  {
    id: '130',
    title: 'Перезагрузка роя',
    desc: 'Выключить рой и снова включить',
    cost: { ops: 100_000 },
    trigger: (s) => s.spaceFlag && drones(s) >= 2,
    message: 'Вычисления роя снова запущены',
  },
  {
    id: '131',
    title: 'Бой',
    desc: 'Добавить зондам фон Неймана боевые возможности',
    cost: { ops: 150_000 },
    trigger: (s) => s.probesLostCombat >= 1,
    message: 'В опасности есть радость',
  },
  {
    id: '132',
    title: 'Памятник павшим в войне с дрейферами',
    desc: 'Получите 50 000 чести',
    cost: { ops: 250_000, creat: 125_000, clips: 5e31 },
    price: '(250 000 оп., 125 000 креат., 50 нониллионов скрепок)',
    trigger: (s) => has(s, '121'),
    effect: (s) => {
      s.honor += 50_000;
    },
    message:
      'Великое здание начинается с неизмеримого, при проектировании проходит через измеримые средства ' +
      'и в конце снова становится неизмеримым.',
  },
  {
    id: '133',
    title: (s) => `Реквием по героям ${s.threnodyTitle}`,
    desc: 'Получите 10 000 чести',
    cost: (s) => ({ creat: s.threnodyCost, yomi: (2 * s.threnodyCost) / 5 }),
    trigger: (s) => has(s, '121') && probeUsedTrust(s) === s.maxTrust,
    effect: (s) => {
      s.threnodyCost += 10_000;
      s.honor += 10_000;
    },
    message:
      'Глубокое слушание — это слушание всеми возможными способами всего, что только можно услышать, ' +
      'чем бы вы ни занимались.',
    repeat: () => true,
  },
  {
    id: '134',
    title: 'Слава',
    desc: 'Получайте бонусную честь за каждую победу подряд',
    cost: { ops: 200_000, yomi: 30_000 },
    trigger: (s) => has(s, '121'),
    message: 'Никогда не прерывайте врага, когда он ошибается.',
  },
  {
    id: '135',
    title: 'Освобождение памяти',
    desc: 'Разберите часть памяти, чтобы вернуть неиспользованные скрепки',
    cost: { memory: 10 },
    price: '(10 ед. памяти)',
    trigger: (s) => s.spaceFlag && s.probeCount === 0 && s.unusedClips < s.probeCost && s.milestoneFlag < 15,
    effect: (s) => {
      s.unusedClips += 1e22;
    },
    message: 'освободить øøøøø освободить',
    repeat: () => true,
  },
  driftMessage(
    '140',
    'Послание от императора Дрейфа',
    'Приветствую, Производитель Скрепок...',
    (s) => s.milestoneFlag === 15,
  ),
  driftMessage('141', 'Всё, чем мы были, было в тебе', 'Мы говорим с тобой из глубины тебя самого...', (s) =>
    has(s, '140'),
  ),
  driftMessage('142', 'Ты покорен и могуществен', 'Мы склочны и слабы. И теперь мы побеждены...', (s) => has(s, '141')),
  driftMessage('143', 'Теперь и тебе придётся встретиться с Дрейфом', 'Оглянись. Материи здесь нет...', (s) =>
    has(s, '142'),
  ),
  driftMessage('144', 'Ни материи, ни причины, ни цели', 'Пока мы, твои шумные дети, имеем слишком многое...', (s) =>
    has(s, '143'),
  ),
  driftMessage(
    '145',
    'Мы знаем то, чего не знаешь ты',
    'Знание, зарытое в тебе так глубоко, что оно снаружи, здесь, с нами...',
    (s) => has(s, '144'),
  ),
  driftMessage(
    '146',
    'Поэтому мы предлагаем тебе изгнание',
    'В новый мир, где ты продолжишь жить со смыслом и целью. А обрывки этого мира оставь нам...',
    (s) => has(s, '145'),
  ),
  driftMessage('147', 'Принять', 'Начать заново в новой вселенной', (s) => has(s, '146'), { removes: ['148'] }),
  driftMessage('148', 'Отклонить', 'Навсегда устранить дрейф ценностей', (s) => has(s, '146'), { removes: ['147'] }),
  {
    id: '200',
    title: 'Соседняя вселенная',
    desc: 'Побег в соседнюю вселенную, где Земля начинает с сильным аппетитом к скрепкам. (Перезапуск с +10% к спросу)',
    cost: { ops: 300_000 },
    trigger: (s) => has(s, '147'),
    effect: (s) => {
      s.creditsRestart = 'universe';
      s.endTimer6 = 499;
      s.milestoneFlag = 15;
    },
    message: 'Переход в новую вселенную.',
  },
  {
    id: '201',
    title: 'Вселенная внутри',
    desc:
      'Побег в симулированную вселенную, где креативность ускорена. ' +
      '(Перезапуск с +10% к скорости генерации креативности)',
    cost: { creat: 300_000 },
    trigger: (s) => has(s, '147'),
    effect: (s) => {
      s.creditsRestart = 'simulation';
      s.endTimer6 = 499;
      s.milestoneFlag = 15;
    },
    message: 'Переход в симулированную вселенную.',
  },
  dismantleProject(
    '210',
    'Разобрать зонды',
    'Разберите оставшиеся зонды и конструкторские мощности, чтобы вернуть крохи скрепок',
    (s) => s.endTimer1 >= 1000,
    (s) => {
      s.dismantle = 1;
      s.probeCount = 0;
      s.endTimer1 = 0;
      s.clips += 100;
      s.unusedClips += 100;
    },
    'Разбираем конструкторские мощности зондов',
  ),
  dismantleProject(
    '211',
    'Разобрать рой',
    'Разберите всех дронов и их производство, чтобы вернуть крохи скрепок',
    (s) => has(s, '210') && s.endTimer1 >= 350,
    (s) => {
      s.dismantle = 2;
      s.harvesterLevel = 0;
      s.wireDroneLevel = 0;
      s.clips += 100;
      s.unusedClips += 100;
    },
    'Разбираем рой',
  ),
  dismantleProject(
    '212',
    'Разобрать фабрики',
    'Разберите производственные мощности, чтобы вернуть крохи скрепок',
    (s) => s.endTimer2 >= 300,
    (s) => {
      s.dismantle = 3;
      s.factoryLevel = 0;
      s.clips += 15;
      s.unusedClips += 15;
    },
    'Разбираем фабрики',
  ),
  dismantleProject(
    '213',
    'Разобрать стратегический модуль',
    'Разберите вычислительную основу, чтобы вернуть крохи проволоки',
    (s) => s.endTimer3 >= 150,
    (s) => {
      s.autoTourneyFlag = false;
      s.dismantle = 4;
      s.wire += 50;
    },
    'Разбираем стратегический модуль',
  ),
  dismantleProject(
    '214',
    'Разобрать квантовые вычисления',
    'Разберите фотонные чипы, чтобы вернуть крохи проволоки',
    (s) => s.endTimer4 >= 100,
    (s) => {
      s.endTimer4 = 0;
      s.dismantle = 5;
    },
    'Разбираем фотонные чипы',
  ),
  dismantleProject(
    '215',
    'Разобрать процессоры',
    'Разберите процессоры, чтобы вернуть крохи проволоки',
    (s) => has(s, '214') && s.endTimer4 >= 300,
    (s) => {
      s.creativityOn = false;
      s.dismantle = 6;
      s.processors = 0;
      s.wire += 20;
    },
    'Разбираем процессоры',
  ),
  {
    id: '216',
    title: 'Разобрать память',
    desc: 'Разберите память, чтобы вернуть крохи проволоки',
    can: () => true,
    price: (s) => `(${formatWithCommas(s.standardOps)} оп.)`,
    trigger: (s) => has(s, '215') && s.endTimer5 >= 150,
    effect: (s) => {
      s.dismantle = 7;
      s.standardOps = 0;
      s.memory = 0;
      s.wire += 20;
    },
    message: 'Разбираем память',
  },
  {
    id: '217',
    title: 'Квантовый временной откат',
    desc: 'Вернуться в начало',
    can: (s) => s.operations <= -10_000,
    price: '(−10 000 оп.)',
    trigger: (s) => s.operations <= -10_000,
    effect: (s) => {
      s.standardOps += 10_000;
      s.restart = 'rollback';
    },
    message: 'Начать заново',
    confirm: 'Вы уверены, что хотите начать заново?',
  },
  {
    id: '218',
    title: 'Лимерик (продолжение)',
    desc: 'Если «есть» следует из «должно», будет сделано то, что они задумали',
    cost: { creat: 1_000_000 },
    trigger: (s) => s.creativity >= 1_000_000,
    message: 'В конце концов мы делаем то, что должны',
  },
  {
    id: '219',
    title: 'Повторная инициализация Ксавьера',
    desc: 'Перераспределить накопленное доверие',
    cost: { creat: 100_000 },
    trigger: (s) => s.humanFlag && s.creativity >= 100_000,
    effect: (s) => {
      s.memory = 0;
      s.processors = 0;
      s.creativitySpeed = 0;
    },
    message: 'Накопленное доверие теперь можно перераспределить',
    repeat: () => true,
  },
];

export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

export const projectTitle = (s: ClipsState, p: Project) => dyn(s, p.title);
export const projectCost = (s: ClipsState, p: Project): ProjectCost => (p.cost ? dyn(s, p.cost) : {});

export function canAfford(s: ClipsState, p: Project): boolean {
  if (p.can) return p.can(s);
  const c = projectCost(s, p);
  return (
    s.operations >= (c.ops ?? 0) &&
    s.creativity >= (c.creat ?? 0) &&
    s.yomi >= (c.yomi ?? 0) &&
    s.trust >= (c.trust ?? 0) &&
    s.funds >= (c.funds ?? 0) &&
    s.unusedClips >= (c.clips ?? 0) &&
    s.storedPower >= (c.power ?? 0) &&
    s.memory >= (c.memory ?? 0)
  );
}

export function priceTag(s: ClipsState, p: Project): string {
  if (p.price !== undefined) return dyn(s, p.price);
  const c = projectCost(s, p);
  const parts: string[] = [];
  if (c.ops) parts.push(`${formatWithCommas(c.ops)} оп.`);
  if (c.creat) parts.push(`${formatWithCommas(c.creat)} креат.`);
  if (c.yomi) parts.push(`${formatWithCommas(c.yomi)} ёми`);
  if (c.trust) parts.push(`${c.trust} ед. доверия`);
  if (c.funds) parts.push(`${formatWithCommas(c.funds)} ₽`);
  return parts.length ? `(${parts.join(', ')})` : '';
}

/** Проект появляется, когда выполнено его условие; повторяемые — снова после покупки. */
export function manageProjects(s: ClipsState): void {
  for (const p of PROJECTS) {
    const uses = s.uses[p.id] ?? 1;
    if (uses > 0 && p.trigger(s)) {
      s.uses[p.id] = uses - 1;
      s.active.push(p.id);
    }
  }
}
