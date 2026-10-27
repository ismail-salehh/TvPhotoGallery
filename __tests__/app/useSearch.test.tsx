import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';

import { hydrateCache } from '../../src/api/cache';
import { useSearch } from '../../src/app/hooks/useSearch';
import { renderHook, settle } from '../helpers/renderHook';

const page = (query: string, n: number) => ({
  items: [{ id: `${query}-${n}` }],
  page: n,
  pageSize: 1,
  totalItems: 2,
  hasNextPage: n < 2,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await hydrateCache();
  // settle() waits on setImmediate
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
});
afterEach(() => jest.useRealTimers());

describe('useSearch', () => {
  it('asks the given search once typing pauses, with the trimmed query', async () => {
    const search = jest.fn(async (q: string, n: number) => page(q, n));
    const { result, rerender } = renderHook(
      ({ query }) => useSearch(query, search),
      { query: '' },
    );
    rerender({ query: 'r' });
    rerender({ query: 're' });
    rerender({ query: 'red ' });
    act(() => jest.advanceTimersByTime(399));
    expect(search).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('red', 1);
    expect(result.current.results).toEqual([{ id: 'red-1' }]);

    act(() => result.current.loadMore());
    await settle();
    expect(search).toHaveBeenLastCalledWith('red', 2);
  });

  it('sends nothing for an empty query, and has no results once emptied', async () => {
    const search = jest.fn(async (q: string, n: number) => page(q, n));
    const { result, rerender } = renderHook(
      ({ query }) => useSearch(query, search),
      { query: '  ' },
    );
    act(() => jest.advanceTimersByTime(1000));
    await settle();
    expect(search).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);

    rerender({ query: 'sky' });
    act(() => jest.advanceTimersByTime(400));
    await settle();
    expect(result.current.results).toHaveLength(1);
    rerender({ query: '' });
    act(() => jest.advanceTimersByTime(400));
    expect(result.current.results).toEqual([]);
  });

  it('starts over with a new search function', async () => {
    const first = jest.fn(async (q: string, n: number) => page(`1${q}`, n));
    const second = jest.fn(async (q: string, n: number) => page(`2${q}`, n));
    const { result, rerender } = renderHook(
      ({ search }) => useSearch('sky', search),
      { search: first },
    );
    await settle();
    expect(result.current.results).toEqual([{ id: '1sky-1' }]);
    rerender({ search: second });
    await settle();
    expect(result.current.results).toEqual([{ id: '2sky-1' }]);
  });

  it('never records results in the response cache', async () => {
    const search = jest.fn(async (q: string, n: number) => page(q, n));
    renderHook(() => useSearch('sky', search), undefined);
    await settle();
    expect(search).toHaveBeenCalled();
    expect(await AsyncStorage.getItem('responseCache')).toBeNull();
  });
});
