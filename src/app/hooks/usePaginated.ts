import { useCallback, useEffect, useRef, useState } from 'react';

import { readCache, writeCache } from '../../api/cache';
import type { PaginatedResponse } from '../../api/types';
import type { Language } from '../../i18n';

type Fetcher<T> = (page: number) => Promise<PaginatedResponse<T>>;

// Where the first page is cached; null for lists not worth keeping
export type CacheSlot = { language: Language; key: string } | null;

function cachedPage<T>(language?: Language, key?: string) {
  return language && key
    ? readCache<PaginatedResponse<T>>(language, key)
    : undefined;
}

// Shared pagination state for list endpoints. `fetcher` must be memoized
// (useCallback): a new fetcher, or a new cache slot, starts again from page 1.
// A cached first page shows at once and is replaced when page 1 arrives.
export function usePaginated<T extends { id: string }>(
  fetcher: Fetcher<T> | null,
  cache: CacheSlot = null,
) {
  const cacheLanguage = cache?.language;
  const cacheKey = cache?.key;
  // From the cache in the very first render, so there is no loading frame
  const [items, setItems] = useState<T[]>(
    () => cachedPage<T>(cacheLanguage, cacheKey)?.items ?? [],
  );
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(true);
  // Starts true when there is something to fetch, so the first render shows
  // the loading state rather than a flash of "empty"
  const [loading, setLoading] = useState(fetcher !== null);
  const [error, setError] = useState<Error | null>(null);
  // Bumped on every reset so responses from a stale fetcher are ignored
  const requestId = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      if (!fetcher) {
        return;
      }
      const id = requestId.current;
      setLoading(true);
      setError(null);
      try {
        const response = await fetcher(nextPage);
        if (id !== requestId.current) {
          return;
        }
        if (nextPage === 1 && cacheLanguage && cacheKey) {
          writeCache(cacheLanguage, cacheKey, response);
        }
        // Unsplash pages can overlap when new content is published between
        // requests, and duplicate ids break list keys
        setItems(prev => {
          if (nextPage === 1) {
            return response.items;
          }
          const seen = new Set(prev.map(item => item.id));
          return [
            ...prev,
            ...response.items.filter(item => !seen.has(item.id)),
          ];
        });
        setPage(nextPage);
        setHasNextPage(response.hasNextPage);
      } catch (e) {
        if (id === requestId.current) {
          setError(e as Error);
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
        }
      }
    },
    [fetcher, cacheLanguage, cacheKey],
  );

  const refresh = useCallback(() => {
    requestId.current += 1;
    const cached = cachedPage<T>(cacheLanguage, cacheKey);
    setItems(cached?.items ?? []);
    setPage(0);
    setHasNextPage(cached?.hasNextPage ?? true);
    load(1);
  }, [load, cacheLanguage, cacheKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(() => {
    if (!loading && hasNextPage && !error) {
      load(page + 1);
    }
  }, [load, loading, hasNextPage, error, page]);

  // Retries whatever failed: the first page, or the next page when a "load
  // more" failed (loadMore itself stays blocked while there is an error)
  const retry = useCallback(() => {
    if (page === 0) {
      refresh();
    } else {
      load(page + 1);
    }
  }, [load, page, refresh]);

  return { items, loading, error, hasNextPage, loadMore, refresh, retry };
}
