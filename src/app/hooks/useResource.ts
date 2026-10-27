import { useCallback, useEffect, useRef, useState } from 'react';

import { readCache, writeCache } from '../../api/cache';
import type { Language } from '../../i18n';

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

// One cached item, e.g. an album opened from a link: a cached copy shows at
// once while it is fetched again. A new `fetcher` or `key` starts over.
export function useResource<T>(
  fetcher: () => Promise<T>,
  language: Language,
  key: string,
) {
  const initial = (): ResourceState<T> => ({
    data: readCache<T>(language, key) ?? null,
    loading: true,
    error: null,
  });
  const [state, setState] = useState(initial);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setState({
      data: readCache<T>(language, key) ?? null,
      loading: true,
      error: null,
    });
    fetcher().then(
      data => {
        if (id === requestId.current) {
          writeCache(language, key, data);
          setState({ data, loading: false, error: null });
        }
      },
      (error: Error) => {
        if (id === requestId.current) {
          setState(prev => ({ ...prev, loading: false, error }));
        }
      },
    );
  }, [fetcher, language, key]);

  useEffect(() => {
    load();
    // A late answer after unmount is ignored
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { ...state, retry: load };
}
