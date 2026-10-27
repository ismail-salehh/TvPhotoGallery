import { act } from 'react-test-renderer';

import { useSettled } from '../../src/app/components/album/FeaturedHero';
import { renderHook } from '../helpers/renderHook';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useSettled (the Home hero follows focus once it rests)', () => {
  it('passes the first value at once', () => {
    const { result } = renderHook(({ v }) => useSettled(v, 500), { v: 'A' });
    expect(result.current).toBe('A');
  });

  it('passes the first non-null value at once', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string | null }) => useSettled(v, 500),
      { v: null as string | null },
    );
    rerender({ v: 'A' });
    expect(result.current).toBe('A');
  });

  it('a single move waits for the pause too', () => {
    const { result, rerender } = renderHook(({ v }) => useSettled(v, 500), {
      v: 'A',
    });
    rerender({ v: 'B' });
    act(() => jest.advanceTimersByTime(499));
    expect(result.current).toBe('A');
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('B');
  });

  it('skips every value passed on the way (a held arrow)', () => {
    const { result, history, rerender } = renderHook(
      ({ v }) => useSettled(v, 500),
      { v: 'A' },
    );
    for (const v of ['B', 'C', 'D', 'E']) {
      rerender({ v });
      act(() => jest.advanceTimersByTime(300));
    }
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe('E');
    expect(new Set(history)).toEqual(new Set(['A', 'E']));
  });

  it('coming back to the settled value before the pause changes nothing', () => {
    const { result, history, rerender } = renderHook(
      ({ v }) => useSettled(v, 500),
      { v: 'A' },
    );
    rerender({ v: 'B' });
    act(() => jest.advanceTimersByTime(300));
    rerender({ v: 'A' });
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe('A');
    expect(new Set(history)).toEqual(new Set(['A']));
  });
});
