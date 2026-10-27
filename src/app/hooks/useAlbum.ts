import { useCallback } from 'react';

import { getAlbum } from '../../api/photoApi';
import { useI18n } from './useI18n';
import { useResource } from './useResource';

export function useAlbum(albumId: string) {
  const { language } = useI18n();
  const fetcher = useCallback(() => getAlbum(albumId), [albumId]);
  const { data, ...rest } = useResource(fetcher, language, `album:${albumId}`);
  return { album: data, ...rest };
}
