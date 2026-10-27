import AsyncStorage from '@react-native-async-storage/async-storage';

import { hydrateCache, readCache, writeCache } from '../../src/api/cache';
import type { PaginatedResponse } from '../../src/api/types';
import type { CacheSlot } from '../../src/app/hooks/usePaginated';
import { usePaginated } from '../../src/app/hooks/usePaginated';
import { act } from 'react-test-renderer';

import { deferred, renderHook, settle } from '../helpers/renderHook';

type Item = { id: string };

const page = (ids: string[], hasNextPage = true): PaginatedResponse<Item> => ({
  items: ids.map(id => ({ id })),
  page: 1,
  pageSize: 2,
  totalItems: 10,
  hasNextPage,
});

type Props = {
  fetcher: (n: number) => Promise<PaginatedResponse<Item>>;
  cache: CacheSlot;
};

const useList = ({ fetcher, cache }: Props) => usePaginated(fetcher, cache);

// Clears the store and the in-memory entries alike
beforeEach(async () => {
  await AsyncStorage.clear();
  await hydrateCache();
});

describe('usePaginated with a cache slot', () => {
  it('shows the cached first page in its very first render, then the fresh one', async () => {
    writeCache('en', 'list-a', page(['old1', 'old2']));
    const fresh = deferred<PaginatedResponse<Item>>();
    const fetcher = jest.fn(() => fresh.promise);
    const { result, history } = renderHook(useList, {
      fetcher,
      cache: { language: 'en', key: 'list-a' },
    });

    // No frame of "empty" or a bare spinner before the cached items
    expect(history[0].items.map(i => i.id)).toEqual(['old1', 'old2']);
    expect(result.current.loading).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(1);

    fresh.resolve(page(['new1']));
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['new1']);
    expect(result.current.loading).toBe(false);
  });

  it('records the fresh first page under its language and key', async () => {
    const { result } = renderHook(useList, {
      fetcher: async () => page(['a', 'b'], false),
      cache: { language: 'ar', key: 'list-b' },
    });
    await settle();
    expect(result.current.hasNextPage).toBe(false);
    expect(readCache('ar', 'list-b')).toEqual(page(['a', 'b'], false));
    expect(readCache('en', 'list-b')).toBeUndefined();
  });

  it('records only page 1: later pages are not what a reopen shows', async () => {
    const fetcher = jest.fn(async (n: number) => page([`p${n}`]));
    const { result } = renderHook(useList, {
      fetcher,
      cache: { language: 'en', key: 'list-c' },
    });
    await settle();
    act(() => result.current.loadMore());
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['p1', 'p2']);
    expect(readCache('en', 'list-c')).toEqual(page(['p1']));
  });

  it('keeps the cached page on screen when the refresh fails', async () => {
    writeCache('en', 'list-d', page(['kept']));
    const { result } = renderHook(useList, {
      fetcher: async () => {
        throw new Error('offline');
      },
      cache: { language: 'en', key: 'list-d' },
    });
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['kept']);
    expect(result.current.error?.message).toBe('offline');
    expect(readCache('en', 'list-d')).toEqual(page(['kept']));
  });

  it('switching language shows only that language’s entry', async () => {
    writeCache('en', 'list-e', page(['english']));
    const never = () => new Promise<PaginatedResponse<Item>>(() => {});
    const { result, rerender } = renderHook(useList, {
      fetcher: never,
      cache: { language: 'en', key: 'list-e' },
    });
    expect(result.current.items.map(i => i.id)).toEqual(['english']);

    rerender({ fetcher: never, cache: { language: 'ar', key: 'list-e' } });
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('a response for the old slot is not recorded under the new one', async () => {
    const late = deferred<PaginatedResponse<Item>>();
    const { rerender } = renderHook(useList, {
      fetcher: () => late.promise,
      cache: { language: 'en', key: 'list-f' },
    });
    const never = () => new Promise<PaginatedResponse<Item>>(() => {});
    rerender({ fetcher: never, cache: { language: 'ar', key: 'list-f' } });
    late.resolve(page(['stale']));
    await settle();
    expect(readCache('en', 'list-f')).toBeUndefined();
    expect(readCache('ar', 'list-f')).toBeUndefined();
  });
});

describe('usePaginated without a cache slot', () => {
  it('starts empty and records nothing', async () => {
    const setItem = AsyncStorage.setItem as jest.Mock;
    setItem.mockClear();
    const { result, history } = renderHook(useList, {
      fetcher: async () => page(['x']),
      cache: null,
    });
    expect(history[0].items).toEqual([]);
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['x']);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('with no fetcher, does nothing at all', async () => {
    const { result } = renderHook(
      ({ cache }: { cache: CacheSlot }) => usePaginated<Item>(null, cache),
      { cache: { language: 'en', key: 'unused' } },
    );
    await settle();
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('a failed later page keeps what loaded; retry asks for that page again', async () => {
    let failPage2 = true;
    const fetcher = jest.fn(async (n: number) => {
      if (n === 2 && failPage2) {
        throw new Error('page 2 down');
      }
      return page([`p${n}`]);
    });
    const { result } = renderHook(useList, { fetcher, cache: null });
    await settle();
    act(() => result.current.loadMore());
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['p1']);
    expect(result.current.error?.message).toBe('page 2 down');
    // Blocked while the error stands
    act(() => result.current.loadMore());
    expect(fetcher).toHaveBeenCalledTimes(2);
    failPage2 = false;
    act(() => result.current.retry());
    await settle();
    expect(fetcher).toHaveBeenLastCalledWith(2);
    expect(result.current.items.map(i => i.id)).toEqual(['p1', 'p2']);
  });

  it('drops ids a later page repeats', async () => {
    const fetcher = async (n: number) =>
      page(n === 1 ? ['a', 'b'] : ['b', 'c']);
    const { result } = renderHook(useList, { fetcher, cache: null });
    await settle();
    act(() => result.current.loadMore());
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('takes no cache when given none, as search does', async () => {
    const { result } = renderHook(
      ({ f }: { f: () => Promise<PaginatedResponse<Item>> }) => usePaginated(f),
      { f: async () => page(['s']) },
    );
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['s']);
  });

  it('ignores a failure from a list it no longer shows', async () => {
    const late = deferred<PaginatedResponse<Item>>();
    const { result, rerender } = renderHook(useList, {
      fetcher: () => late.promise,
      cache: null,
    });
    rerender({ fetcher: async () => page(['now']), cache: null });
    await settle();
    late.reject(new Error('stale'));
    await settle();
    expect(result.current.error).toBeNull();
    expect(result.current.items.map(i => i.id)).toEqual(['now']);
  });

  it('retries the first page after it failed', async () => {
    let fail = true;
    const fetcher = jest.fn(async () => {
      if (fail) {
        throw new Error('down');
      }
      return page(['back']);
    });
    const { result } = renderHook(useList, { fetcher, cache: null });
    await settle();
    expect(result.current.error?.message).toBe('down');
    fail = false;
    act(() => result.current.retry());
    await settle();
    expect(result.current.items.map(i => i.id)).toEqual(['back']);
  });
});
