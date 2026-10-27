import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheModule = typeof import('../../src/api/cache');

// A fresh module per test: the cache lives in module state, like an app run
function loadCache(): CacheModule {
  let mod: CacheModule | undefined;
  jest.isolateModules(() => {
    mod = require('../../src/api/cache');
  });
  return mod as CacheModule;
}

const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

async function stored() {
  return JSON.parse((await AsyncStorage.getItem('responseCache')) as string);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('readCache / writeCache', () => {
  it('reads back what was written, and nothing for unknown keys', () => {
    const cache = loadCache();
    expect(cache.readCache('en', 'albums')).toBeUndefined();
    cache.writeCache('en', 'albums', { items: [1, 2] });
    expect(cache.readCache('en', 'albums')).toEqual({ items: [1, 2] });
    expect(cache.readCache('en', 'other')).toBeUndefined();
  });

  it('never returns an entry under another language', () => {
    const cache = loadCache();
    cache.writeCache('en', 'albums', { title: 'Photo by Ann' });
    expect(cache.readCache('ar', 'albums')).toBeUndefined();
    cache.writeCache('ar', 'albums', { title: 'صورة' });
    expect(cache.readCache('en', 'albums')).toEqual({ title: 'Photo by Ann' });
    expect(cache.readCache('ar', 'albums')).toEqual({ title: 'صورة' });
  });

  it('records a snapshot: later changes to the caller’s object do not leak in', () => {
    const cache = loadCache();
    const value = { items: [{ id: 'a' }] };
    cache.writeCache('en', 'k', value);
    value.items.push({ id: 'b' });
    expect(cache.readCache('en', 'k')).toEqual({ items: [{ id: 'a' }] });
  });

  it('refuses values that would not survive a restart', () => {
    const cache = loadCache();
    expect(() => cache.writeCache('en', 'k', undefined)).toThrow(
      'Cache value for k is not JSON',
    );
    expect(() => cache.writeCache('en', 'k', () => 1)).toThrow(
      'Cache value for k is not JSON',
    );
    expect(cache.readCache('en', 'k')).toBeUndefined();
  });

  it('refuses entries for a language the app does not have', () => {
    const cache = loadCache();
    expect(() => cache.writeCache('fr' as never, 'k', 1)).toThrow(
      'Cache entry for unknown language: fr',
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('replaces an entry rather than keeping two', async () => {
    const cache = loadCache();
    cache.writeCache('en', 'k', 1);
    cache.writeCache('en', 'k', 2);
    expect(cache.readCache('en', 'k')).toBe(2);
    await flush();
    expect((await stored()).entries).toEqual([
      { language: 'en', key: 'k', value: 2 },
    ]);
  });

  it('keeps the 40 most recently used entries', () => {
    const cache = loadCache();
    for (let i = 0; i < 40; i++) {
      cache.writeCache('en', `k${i}`, i);
    }
    // Reading k0 makes it recent, so k1 is the oldest when k40 arrives
    expect(cache.readCache('en', 'k0')).toBe(0);
    cache.writeCache('en', 'k40', 40);
    expect(cache.readCache('en', 'k0')).toBe(0);
    expect(cache.readCache('en', 'k1')).toBeUndefined();
    expect(cache.readCache('en', 'k40')).toBe(40);
  });

  it('saves every write under the current version', async () => {
    const cache = loadCache();
    cache.writeCache('ar', 'album:x', { id: 'x' });
    await flush();
    expect(await stored()).toEqual({
      version: 1,
      entries: [{ language: 'ar', key: 'album:x', value: { id: 'x' } }],
    });
  });

  it('keeps working when the device storage fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('full'),
    );
    const cache = loadCache();
    cache.writeCache('en', 'k', 1);
    await flush();
    expect(cache.readCache('en', 'k')).toBe(1);
  });
});

describe('hydrateCache', () => {
  it('brings back what an earlier run saved', async () => {
    const first = loadCache();
    first.writeCache('en', 'albums', { items: ['a'] });
    first.writeCache('ar', 'albums', { items: ['b'] });
    await flush();

    const second = loadCache();
    expect(second.readCache('en', 'albums')).toBeUndefined();
    await second.hydrateCache();
    expect(second.readCache('en', 'albums')).toEqual({ items: ['a'] });
    expect(second.readCache('ar', 'albums')).toEqual({ items: ['b'] });
  });

  it('drops a store saved under another version', async () => {
    await AsyncStorage.setItem(
      'responseCache',
      JSON.stringify({
        version: 0,
        entries: [{ language: 'en', key: 'k', value: 1 }],
      }),
    );
    const cache = loadCache();
    await cache.hydrateCache();
    expect(cache.readCache('en', 'k')).toBeUndefined();
  });

  it('drops entries it cannot trust and keeps the rest', async () => {
    await AsyncStorage.setItem(
      'responseCache',
      JSON.stringify({
        version: 1,
        entries: [
          { language: 'fr', key: 'k', value: 1 },
          { language: 'en', key: 7, value: 1 },
          { language: 'en', key: 'no-value' },
          null,
          { language: 'en', key: 'good', value: { ok: true } },
        ],
      }),
    );
    const cache = loadCache();
    await cache.hydrateCache();
    expect(cache.readCache('en', 'good')).toEqual({ ok: true });
    expect(cache.readCache('fr' as never, 'k')).toBeUndefined();
    expect(cache.readCache('en', 'no-value')).toBeUndefined();
  });

  it('starts empty from nothing, from garbage, or from entries that are not a list', async () => {
    for (const raw of [
      null,
      'not json',
      'null',
      '{"version":1,"entries":{}}',
    ]) {
      await AsyncStorage.clear();
      if (raw !== null) {
        await AsyncStorage.setItem('responseCache', raw);
      }
      const cache = loadCache();
      await cache.hydrateCache();
      cache.writeCache('en', 'probe', 1);
      await flush();
      expect((await stored()).entries).toEqual([
        { language: 'en', key: 'probe', value: 1 },
      ]);
    }
  });

  it('keeps at most 40 entries from an oversized store', async () => {
    const entries = Array.from({ length: 45 }, (_, i) => ({
      language: 'en',
      key: `k${i}`,
      value: i,
    }));
    await AsyncStorage.setItem(
      'responseCache',
      JSON.stringify({ version: 1, entries }),
    );
    const cache = loadCache();
    await cache.hydrateCache();
    expect(cache.readCache('en', 'k4')).toBeUndefined();
    expect(cache.readCache('en', 'k5')).toBe(5);
    expect(cache.readCache('en', 'k44')).toBe(44);
  });
});
