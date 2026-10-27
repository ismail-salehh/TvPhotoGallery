import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResponse } from '../../api/types';
import { usePaginated } from './usePaginated';

const DEBOUNCE_MS = 400;

type Search<T> = (query: string, page: number) => Promise<PaginatedResponse<T>>;

// `search` must be stable (module level, or useCallback): a new one starts
// the results over
export function useSearch<T extends { id: string }>(
  query: string,
  search: Search<T>,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(query.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  // No request for an empty query
  const fetcher = useCallback(
    (page: number) => search(debouncedQuery, page),
    [debouncedQuery, search],
  );
  const { items, ...rest } = usePaginated(debouncedQuery ? fetcher : null);
  return { results: debouncedQuery ? items : [], ...rest };
}
