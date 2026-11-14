import { afterEach, expect, it, vi } from 'vitest';
import { saveSlot } from './storage';

afterEach(() => vi.unstubAllGlobals());

const makeSlot = () => saveSlot('game', (data: { clips: number }) => data);

it('reads and writes under one lock and refuses a stale tab', async () => {
  let value: string | null = null;
  let locked = false;
  let queue = Promise.resolve();
  const request = (name: string, operation: () => unknown) => {
    expect(name).toBe('save:game');
    const result = queue.then(() => {
      locked = true;
      try {
        return operation();
      } finally {
        locked = false;
      }
    });
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const getItem = vi.fn<(key: string) => string | null>((key) => (key === 'game' ? value : null));
  const setItem = vi.fn<(key: string, next: string) => void>((_key, next) => {
    expect(locked).toBe(true);
    value = next;
  });
  vi.stubGlobal('navigator', { locks: { request } });
  vi.stubGlobal('localStorage', { getItem, setItem });
  const first = saveSlot('game', (data: { clips: number }) => data);
  const second = saveSlot('game', (data: { clips: number }) => data);

  expect(await first.save({ clips: 1 })).toBe('saved');
  expect(second.load()).toEqual({ clips: 1 });
  getItem.mockImplementation((key) => {
    expect(locked).toBe(true);
    return key === 'game' ? value : null;
  });

  await expect(Promise.all([first.save({ clips: 2 }), second.save({ clips: 3 })])).resolves.toEqual([
    'saved',
    'conflict',
  ]);
  const committed = value;
  expect(JSON.parse(committed!).data).toBe('{"clips":2}');

  setItem.mockImplementationOnce(() => {
    throw new Error('Quota exceeded');
  });
  await expect(first.save({ clips: 4 })).resolves.toBe('unavailable');
  expect(value).toBe(committed);
  await expect(first.save({ clips: 5 })).resolves.toBe('saved');
});

it('recovers a checkpoint written after a concurrent save checked for it', async () => {
  const values: Record<string, string> = {};
  let beforeCommit: (() => void) | undefined;
  vi.stubGlobal('navigator', {});
  vi.stubGlobal(
    'localStorage',
    Object.assign(values, {
      getItem: (key: string) => values[key] ?? null,
      setItem(key: string, value: string) {
        if (key === 'game') beforeCommit?.();
        values[key] = value;
      },
    }),
  );
  const first = saveSlot('game', (data: { clips: number }) => data);
  const second = saveSlot('game', (data: { clips: number }) => data);

  expect(await first.save({ clips: 1 })).toBe('saved');
  expect(second.load()).toEqual({ clips: 1 });
  beforeCommit = () => second.checkpoint({ clips: 3 });
  expect(await first.save({ clips: 2 })).toBe('saved');
  beforeCommit = undefined;
  expect(await first.save({ clips: 4 })).toBe('conflict');
  expect(second.load()).toEqual({ clips: 3 });
  expect(await second.save({ clips: 5 })).toBe('saved');
  expect(first.load()).toEqual({ clips: 5 });
});

it('recovers a closing tab without Web Locks and protects its checkpoint from a stale tab', async () => {
  const values: Record<string, string> = {};
  vi.stubGlobal('navigator', {});
  vi.stubGlobal(
    'localStorage',
    Object.assign(values, {
      getItem: (key: string) => values[key] ?? null,
      setItem: (key: string, value: string) => (values[key] = value),
      removeItem: (key: string) => delete values[key],
    }),
  );

  const first = saveSlot('game', (data: { clips: number }) => data);
  const second = saveSlot('game', (data: { clips: number }) => data);
  expect(await first.save({ clips: 1 })).toBe('saved');
  expect(second.load()).toEqual({ clips: 1 });
  first.checkpoint({ clips: 2 });
  second.checkpoint({ clips: 3 });
  expect(await second.save({ clips: 3 })).toBe('conflict');
  expect(second.load()).toEqual({ clips: 2 });
  expect(await second.save({ clips: 4 })).toBe('saved');
  expect(first.load()).toEqual({ clips: 4 });
});

it('keeps concurrent closing snapshots separate and consumes both when saving recovered progress', async () => {
  const values: Record<string, string> = {};
  let interleave: (() => void) | undefined;
  vi.stubGlobal('navigator', {});
  vi.stubGlobal(
    'localStorage',
    Object.assign(values, {
      getItem: (key: string) => values[key] ?? null,
      setItem(key: string, value: string) {
        const callback = interleave;
        interleave = undefined;
        callback?.();
        values[key] = value;
      },
      removeItem: (key: string) => delete values[key],
    }),
  );
  const first = makeSlot();
  const second = makeSlot();
  expect(await first.save({ clips: 1 })).toBe('saved');
  expect(second.load()).toEqual({ clips: 1 });

  interleave = () => second.checkpoint({ clips: 3 });
  first.checkpoint({ clips: 2 });
  const snapshots = Object.keys(values)
    .filter((key) => key.startsWith('game/recovery/'))
    .map((key) => JSON.parse(values[key]).snapshot);
  expect(new Set(snapshots)).toEqual(new Set(['{"clips":2}', '{"clips":3}']));

  const reopened = makeSlot();
  expect([2, 3]).toContain(reopened.load()?.clips);
  expect(await reopened.save({ clips: 4 })).toBe('saved');
  expect(makeSlot().load()).toEqual({ clips: 4 });
});
