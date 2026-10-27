import AsyncStorage from '@react-native-async-storage/async-storage';

import { hydrateCache, readCache, writeCache } from '../../src/api/cache';
import { useResource } from '../../src/app/hooks/useResource';
import type { Language } from '../../src/i18n';
import { act } from 'react-test-renderer';

import { deferred, renderHook, settle } from '../helpers/renderHook';

type Props = {
  fetcher: () => Promise<{ name: string }>;
  language: Language;
  id: string;
};
const useItem = ({ fetcher, language, id }: Props) =>
  useResource(fetcher, language, id);

// Clears the store and the in-memory entries alike
beforeEach(async () => {
  await AsyncStorage.clear();
  await hydrateCache();
});

describe('useResource', () => {
  it('shows the cached copy at once, then the fresh one, and records it', async () => {
    writeCache('en', 'photo:1', { name: 'cached' });
    const fresh = deferred<{ name: string }>();
    const { result, history } = renderHook(useItem, {
      fetcher: () => fresh.promise,
      language: 'en',
      id: 'photo:1',
    });
    expect(history[0]).toMatchObject({
      data: { name: 'cached' },
      loading: true,
    });

    fresh.resolve({ name: 'fresh' });
    await settle();
    expect(result.current).toMatchObject({
      data: { name: 'fresh' },
      loading: false,
      error: null,
    });
    expect(readCache('en', 'photo:1')).toEqual({ name: 'fresh' });
    expect(readCache('ar', 'photo:1')).toBeUndefined();
  });

  it('with nothing cached, loads; on failure keeps what it had and offers retry', async () => {
    let attempt = 0;
    const fetcher = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('timeout');
      }
      return { name: 'second try' };
    });
    const { result } = renderHook(useItem, {
      fetcher,
      language: 'ar',
      id: 'album:9',
    });
    expect(result.current).toMatchObject({ data: null, loading: true });
    await settle();
    expect(result.current).toMatchObject({ data: null, loading: false });
    expect(result.current.error?.message).toBe('timeout');

    act(() => result.current.retry());
    await settle();
    expect(result.current.data).toEqual({ name: 'second try' });
    expect(readCache('ar', 'album:9')).toEqual({ name: 'second try' });
  });

  it('a failed refresh leaves the cached copy on screen', async () => {
    writeCache('en', 'album:2', { name: 'cached' });
    const { result } = renderHook(useItem, {
      fetcher: async () => {
        throw new Error('offline');
      },
      language: 'en',
      id: 'album:2',
    });
    await settle();
    expect(result.current.data).toEqual({ name: 'cached' });
    expect(result.current.error?.message).toBe('offline');
  });

  it('ignores an answer for an item it no longer shows', async () => {
    const late = deferred<{ name: string }>();
    const { result, rerender } = renderHook(useItem, {
      fetcher: () => late.promise,
      language: 'en',
      id: 'photo:old',
    });
    const now = deferred<{ name: string }>();
    rerender({ fetcher: () => now.promise, language: 'en', id: 'photo:new' });
    late.resolve({ name: 'old' });
    await settle();
    expect(result.current.data).toBeNull();
    expect(readCache('en', 'photo:old')).toBeUndefined();

    now.reject(new Error('gone'));
    await settle();
    expect(result.current.error?.message).toBe('gone');
  });

  it('ignores a failure for an item it no longer shows', async () => {
    const late = deferred<{ name: string }>();
    const { result, rerender } = renderHook(useItem, {
      fetcher: () => late.promise,
      language: 'en',
      id: 'photo:a',
    });
    rerender({
      fetcher: async () => ({ name: 'b' }),
      language: 'en',
      id: 'photo:b',
    });
    await settle();
    late.reject(new Error('stale'));
    await settle();
    expect(result.current).toMatchObject({ data: { name: 'b' }, error: null });
  });

  it('records nothing once unmounted', async () => {
    const late = deferred<{ name: string }>();
    const { unmount } = renderHook(useItem, {
      fetcher: () => late.promise,
      language: 'en',
      id: 'photo:3',
    });
    unmount();
    late.resolve({ name: 'late' });
    await settle();
    expect(readCache('en', 'photo:3')).toBeUndefined();
  });
});
