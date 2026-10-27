import { useCallback, useMemo } from 'react';
import { getAlbums } from '../../api/photoApi';
import { useI18n } from './useI18n';
import { usePaginated } from './usePaginated';

export function useAlbums(pageSize?: number) {
  const { language } = useI18n();
  const fetcher = useCallback(
    (page: number) => getAlbums(page, pageSize),
    [pageSize],
  );
  const cache = useMemo(
    () => ({ language, key: `albums:${pageSize ?? ''}` }),
    [language, pageSize],
  );
  const { items, ...rest } = usePaginated(fetcher, cache);
  return { albums: items, ...rest };
}
