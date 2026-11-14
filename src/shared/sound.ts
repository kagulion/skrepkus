import clickUrl from '../assets/click.wav';

let initialized = false;
const SOUND_KEY = 'paper-company:sound';
let enabled = true;

try {
  enabled = localStorage.getItem(SOUND_KEY) !== 'off';
} catch {
  // Если хранилище недоступно, используем настройку до закрытия страницы.
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  try {
    localStorage.setItem(SOUND_KEY, value ? 'on' : 'off');
  } catch {
    // Настройка действует до закрытия страницы.
  }
}

/** Звук для обычных и динамически добавленных кнопок и ссылок. */
export function initClickSound(): void {
  if (initialized) return;
  initialized = true;

  const sound = new Audio(clickUrl);
  sound.preload = 'auto';
  sound.volume = 0.2;

  document.addEventListener('click', (event) => {
    if (!enabled || event.defaultPrevented || !(event.target instanceof Element)) return;
    const control = event.target.closest('button, a[href]');
    if (!control || (control instanceof HTMLButtonElement && control.disabled)) return;

    sound.currentTime = 0;
    void sound.play().catch(() => {});

    // Даём звуку начаться до перехода в той же вкладке; остальные способы открытия ссылки не меняем.
    if (
      control instanceof HTMLAnchorElement &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      (!control.target || control.target === '_self') &&
      !control.hasAttribute('download') &&
      (control.protocol === 'http:' || control.protocol === 'https:') &&
      !(
        control.origin === location.origin &&
        control.pathname === location.pathname &&
        control.search === location.search &&
        control.hash
      )
    ) {
      event.preventDefault();
      window.setTimeout(() => location.assign(control.href), 150);
    }
  });
}
