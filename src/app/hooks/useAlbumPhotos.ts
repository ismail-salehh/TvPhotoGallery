import { useCallback, useMemo } from 'react';
import { getAlbumPhotos } from '../../api/photoApi';
import { useI18n } from './useI18n';
import { usePaginated } from './usePaginated';

export function useAlbumPhotos(albumId: string, pageSize?: number) {
  const { language } = useI18n();
  const fetcher = useCallback(
    (page: number) => getAlbumPhotos(albumId, page, pageSize),
    [albumId, pageSize],
  );
  const cache = useMemo(
    () => ({ language, key: `album-photos:${albumId}:${pageSize ?? ''}` }),
    [language, albumId, pageSize],
  );
  const { items, ...rest } = usePaginated(fetcher, cache);
  return { photos: items, ...rest };
}
