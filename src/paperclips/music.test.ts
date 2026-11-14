import { afterEach, expect, it, vi } from 'vitest';
import { initMusic } from './music';

afterEach(() => vi.unstubAllGlobals());

it('navigates playback history without starting paused music', () => {
  const music = new EventTarget() as EventTarget & { textContent: string; setAttribute: () => void };
  music.setAttribute = () => {};
  const previous = new EventTarget() as EventTarget & { disabled: boolean };
  const next = new EventTarget();
  const controls = { append: vi.fn<() => void>() };
  const elements: Record<string, unknown> = {
    '#btnMusic': music,
    '#btnPreviousTrack': previous,
    '#btnNextTrack': next,
    '.header-controls': controls,
  };
  vi.stubGlobal('document', { querySelector: (selector: string) => elements[selector] });

  class AudioMock extends EventTarget {
    static instance: AudioMock;
    src = '';
    preload = '';
    volume = 0;
    play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    pause = vi.fn<() => void>();
    constructor() {
      super();
      AudioMock.instance = this;
    }
  }
  vi.stubGlobal('Audio', AudioMock);
  const syncCredits = initMusic();
  const audio = AudioMock.instance;
  const first = audio.src;
  expect(previous.disabled).toBe(true);
  next.dispatchEvent(new Event('click'));
  const second = audio.src;
  expect(second).not.toBe(first);
  expect(audio.play).not.toHaveBeenCalled();
  previous.dispatchEvent(new Event('click'));
  expect(audio.src).toBe(first);
  next.dispatchEvent(new Event('click'));
  expect(audio.src).toBe(second);
  music.dispatchEvent(new Event('click'));
  expect(audio.play).toHaveBeenCalledTimes(1);
  audio.dispatchEvent(new Event('ended'));
  expect(audio.play).toHaveBeenCalledTimes(2);
  const third = audio.src;
  previous.dispatchEvent(new Event('click'));
  expect(audio.src).toBe(second);
  next.dispatchEvent(new Event('click'));
  expect(audio.src).toBe(third);
  syncCredits('01');
  expect(audio.src).toMatch(/paperclips.*01/);
  previous.dispatchEvent(new Event('click'));
  expect(audio.src).toBe(third);
});
