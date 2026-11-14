const musicFiles = Object.entries(
  import.meta.glob<string>('../assets/music/*.mp3', { eager: true, query: '?url', import: 'default' }),
)
  // eslint-disable-next-line unicorn/no-array-sort
  .sort(([a], [b]) => a.localeCompare(b));
const tracks = musicFiles.map(([, url]) => url);
const creditsTracks = {
  '01': musicFiles.find(([path]) => path.endsWith(' - 01.mp3'))?.[1],
  '07': musicFiles.find(([path]) => path.endsWith(' - 07.mp3'))?.[1],
};

/** Музыка играет в случайном порядке, а титры запускают отдельный трек. */
export function initMusic(): (credits: '01' | '07' | null) => void {
  const button = document.querySelector<HTMLButtonElement>('#btnMusic');
  const previousButton = document.querySelector<HTMLButtonElement>('#btnPreviousTrack');
  const nextButton = document.querySelector<HTMLButtonElement>('#btnNextTrack');
  if (!button || !previousButton || !nextButton || tracks.length === 0) return () => {};
  document.querySelector('.header-controls')?.append(button, previousButton, nextButton);

  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.3;
  let queue: string[] = [];
  let previousTrack: string | undefined;
  const history: string[] = [];
  let position = -1;
  let enabled = false;
  let inCredits: '01' | '07' | null = null;

  const nextTrack = (): string => {
    if (queue.length === 0) {
      queue = [...tracks];
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      if (queue.length > 1 && queue[queue.length - 1] === previousTrack) {
        [queue[0], queue[queue.length - 1]] = [queue[queue.length - 1], queue[0]];
      }
    }
    previousTrack = queue.pop()!;
    return previousTrack;
  };

  const updateButton = (): void => {
    button.textContent = enabled ? 'Выключить музыку' : 'Включить музыку';
    button.setAttribute('aria-pressed', String(enabled));
    previousButton.disabled = position <= 0;
  };

  const play = (): void => {
    void audio.play().catch(() => {
      enabled = false;
      updateButton();
    });
  };

  const selectTrack = (track: string): void => {
    audio.src = track;
    previousTrack = track;
    updateButton();
    if (enabled) play();
  };

  const advance = (): void => {
    if (position < history.length - 1) position++;
    else {
      history.push(nextTrack());
      position++;
    }
    selectTrack(history[position]);
  };

  advance();
  audio.addEventListener('ended', () => {
    if (!enabled) return;
    advance();
  });
  previousButton.addEventListener('click', () => {
    if (position <= 0) return;
    selectTrack(history[--position]);
  });
  nextButton.addEventListener('click', advance);
  button.addEventListener('click', () => {
    enabled = !enabled;
    if (enabled) play();
    else audio.pause();
    updateButton();
  });
  return (credits) => {
    const creditsTrack = credits && creditsTracks[credits];
    if (credits && credits !== inCredits && creditsTrack) {
      history.splice(position + 1);
      history.push(creditsTrack);
      position++;
      queue = queue.filter((track) => track !== creditsTrack);
      enabled = true;
      selectTrack(creditsTrack);
    }
    inCredits = credits;
  };
}
