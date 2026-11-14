import { initClickSound, isSoundEnabled, setSoundEnabled } from './sound';

type Theme = 'light' | 'dark';

const KEY = 'paper-company:theme';
const dark = window.matchMedia('(prefers-color-scheme: dark)');

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function current(): Theme {
  const chosen = document.documentElement.dataset.theme;
  return chosen === 'dark' || (chosen !== 'light' && dark.matches) ? 'dark' : 'light';
}

function apply(theme: Theme | null): void {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function label(): string {
  return current() === 'dark' ? 'Светлая тема' : 'Тёмная тема';
}

/** Применяет сохранённую тему сразу, а переключатель добавляет в шапку, если она есть на странице. */
export function initTheme(): void {
  initClickSound();
  apply(stored());

  const masthead = document.querySelector('.masthead');
  if (!masthead) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  button.textContent = label();
  button.addEventListener('click', () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Хранилище недоступно (приватный режим и т. п.) — тема сменится до перезагрузки.
    }
    button.textContent = label();
  });
  // Пока тема не выбрана вручную, она следует за системной.
  dark.addEventListener('change', () => {
    button.textContent = label();
  });
  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  const updateSoundButton = (): void => {
    const enabled = isSoundEnabled();
    const action = enabled ? 'Выключить звук' : 'Включить звук';
    soundButton.textContent = enabled ? '🔊' : '🔇';
    soundButton.title = action;
    soundButton.setAttribute('aria-label', action);
    soundButton.setAttribute('aria-pressed', String(enabled));
  };
  updateSoundButton();
  soundButton.addEventListener('click', () => {
    setSoundEnabled(!isSoundEnabled());
    updateSoundButton();
  });

  const controls = document.createElement('div');
  controls.className = 'header-controls';
  controls.append(button, soundButton);
  masthead.append(controls);
}
