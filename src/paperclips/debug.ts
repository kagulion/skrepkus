import { Game } from '../shared/game';
import { ClipsState, displayMessage, newGame } from './state';
import { PROJECTS, manageProjects } from './projects';

function complete(s: ClipsState, ids: string[]): void {
  for (const id of ids) {
    const project = PROJECTS.find((item) => item.id === id);
    if (!project || s.done.includes(id)) continue;
    project.effect?.(s);
    s.done.push(id);
  }
}

function business(): ClipsState {
  const s = newGame();
  Object.assign(s, {
    clips: 1e9,
    clipsSold: 1e9,
    funds: 1e9,
    wire: 1e7,
    trust: 100,
    processors: 50,
    memory: 150,
    standardOps: 150000,
    operations: 150000,
    creativity: 1e6,
    yomi: 1e6,
    clipmakerLevel: 1000,
    megaClipperLevel: 100,
    compFlag: true,
    projectsFlag: true,
    strategyEngineFlag: true,
    stratCount: 8,
  });
  complete(s, ['1', '3', '4', '7', '17', '34', '70', '50']);
  return s;
}

function earth(): ClipsState {
  const s = business();
  complete(s, ['35', '42', '43', '44', '45', '125', '127']);
  Object.assign(s, {
    unusedClips: 1e28,
    clips: 1e28,
    factoryLevel: 100,
    harvesterLevel: 10000,
    wireDroneLevel: 10000,
    farmLevel: 100000,
    batteryLevel: 100000,
    storedPower: 1e8,
    availableMatter: 1e12,
    acquiredMatter: 1e9,
    wire: 1e9,
  });
  return s;
}

function space(): ClipsState {
  const s = earth();
  s.availableMatter = 0;
  complete(s, ['46']);
  Object.assign(s, {
    unusedClips: 1e28,
    wire: 1e10,
    probeTrust: 10,
    probeSpeed: 1,
    probeNav: 1,
    probeRep: 2,
    probeHaz: 1,
    probeFac: 1,
    probeHarv: 1,
    probeWire: 1,
    probeCombat: 2,
  });
  return s;
}

export const checkpoints: { name: string; create: () => ClipsState }[] = [
  { name: 'Начало бизнеса', create: newGame },
  { name: 'Перед освобождением гипнодронов', create: business },
  { name: 'Фабрики и дроны', create: earth },
  {
    name: 'Перед освоением космоса',
    create: () => {
      const s = earth();
      s.availableMatter = 0;
      return s;
    },
  },
  { name: 'Начало космоса', create: space },
  {
    name: 'Зонды и дрейферы',
    create: () => {
      const s = space();
      complete(s, ['121', '130', '131']);
      Object.assign(s, { probeCount: 1e9, drifterCount: 1e9, honor: 1e6 });
      return s;
    },
  },
  {
    name: 'Начало диалога с императором Дрейфа',
    create: () => {
      const s = space();
      complete(
        s,
        PROJECTS.slice(
          0,
          PROJECTS.findIndex((project) => project.id === '140'),
        ).map((project) => project.id),
      );
      complete(s, ['218', '219']);
      for (const id of s.done) s.uses[id] = 0;
      s.active = s.active.filter((id) => !s.done.includes(id));
      Object.assign(s, {
        milestoneFlag: 15,
        memory: 1000,
        processors: 10000,
        clips: s.totalMatter,
        foundMatter: s.totalMatter,
        availableMatter: 0,
        wire: 0,
        probeCount: 1e9,
        drifterCount: 1e9,
        honor: 1e6,
      });
      return s;
    },
  },
  {
    name: 'Финальные титры и музыка',
    create: () => {
      const s = space();
      complete(
        s,
        PROJECTS.slice(
          0,
          PROJECTS.findIndex((project) => project.id === '140'),
        ).map((project) => project.id),
      );
      complete(s, [
        '140',
        '141',
        '142',
        '143',
        '144',
        '145',
        '146',
        '148',
        '210',
        '211',
        '212',
        '213',
        '214',
        '215',
        '216',
        '218',
        '219',
      ]);
      for (const id of s.done) s.uses[id] = 0;
      Object.assign(s, { milestoneFlag: 16, wire: 0, endTimer6: 500, endTimer4: 300 });
      displayMessage(s, 'По мотивам Universal Paperclips');
      return s;
    },
  },
  {
    name: 'Перед разборкой',
    create: () => {
      const s = space();
      complete(s, ['121', '130', '131', '140', '141', '142', '143', '144', '145', '146', '148']);
      s.endTimer1 = 1000;
      return s;
    },
  },
  ...[1, 2, 3, 4, 5, 6, 7].map((stage) => ({
    name: `Разборка: стадия ${stage}`,
    create: () => {
      const s = space();
      complete(s, [
        '121',
        '130',
        '131',
        '140',
        '141',
        '142',
        '143',
        '144',
        '145',
        '146',
        '148',
        ...['210', '211', '212', '213', '214', '215', '216'].slice(0, stage),
      ]);
      Object.assign(s, { endTimer1: 1000, endTimer2: 300, endTimer3: 150, endTimer4: 300, endTimer5: 150 });
      return s;
    },
  })),
  { name: 'Новая вселенная с бонусами', create: () => Object.assign(newGame(), { prestigeU: 1, prestigeS: 1 }) },
];

export function initDebug(game: Game<ClipsState>): void {
  const panel = document.createElement('section');
  panel.className = 'form debug-panel';
  const title = document.createElement('h2');
  title.textContent = 'Отладка: отдельное сохранение';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Контрольная точка');
  checkpoints.forEach((checkpoint, index) => select.add(new Option(checkpoint.name, String(index))));
  const button = document.createElement('button');
  button.textContent = 'Загрузить точку';
  button.addEventListener('click', () => {
    const checkpoint = checkpoints[Number(select.value)];
    if (!checkpoint) return;
    const state = checkpoint.create();
    manageProjects(state);
    void game.replaceState(state);
  });
  const note = document.createElement('p');
  note.textContent = 'Обычный прогресс хранится отдельно. Для выхода уберите ?debug=1 из адреса.';
  panel.append(title, select, button, note);
  document.querySelector('main')?.before(panel);
}
