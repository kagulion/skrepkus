export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Меняет текст, только если он изменился: лишние записи в DOM заставляют браузер перерисовывать страницу. */
export function text(id: string, value: string): void {
  const el = $(id);
  if (el.textContent !== value) el.textContent = value;
}

let toastEl: HTMLElement | undefined;
let toastTimer: number | undefined;

/** Короткое уведомление внизу экрана: исчезает само, повторный вызов продлевает показ. */
export function toast(message: string): void {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('show'), 1800);
}

const lists = new Map<string, HTMLElement[]>();

/**
 * Элементы по селектору, найденные один раз: отрисовка идёт много раз в секунду, а поиск по DOM не бесплатный.
 * Только для элементов, которые не меняются после `initUI`.
 */
export function all<T extends HTMLElement = HTMLElement>(selector: string): T[] {
  let list = lists.get(selector);
  if (!list) {
    list = [...document.querySelectorAll<HTMLElement>(selector)];
    lists.set(selector, list);
  }
  return list as T[];
}

/** Показывает панели `[data-show]` по флагам; `hide` может дополнительно скрыть элемент. */
export function applyShow(show: Record<string, boolean | undefined>, hide?: (el: HTMLElement) => boolean): void {
  for (const el of all('[data-show]')) el.hidden = !show[el.dataset.show!] || (hide?.(el) ?? false);
}

/** Журнал событий, новые сверху; список перестраивается, только когда журнал изменился. */
export function logView(id: string): { render: (log: string[]) => void; invalidate: () => void } {
  let length = -1;
  let first: string | undefined;
  return {
    render(log) {
      if (log.length === length && log[0] === first) return;
      length = log.length;
      first = log[0];
      $(id).replaceChildren(
        ...[...log].reverse().map((msg) => {
          const li = document.createElement('li');
          li.textContent = msg;
          return li;
        }),
      );
    },
    invalidate() {
      length = -1;
    },
  };
}
