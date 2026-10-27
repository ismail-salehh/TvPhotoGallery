import { useCallback } from 'react';

import { getPhoto } from '../../api/photoApi';
import { useI18n } from './useI18n';
import { useResource } from './useResource';

export function usePhoto(photoId: string) {
  const { language } = useI18n();
  const fetcher = useCallback(() => getPhoto(photoId), [photoId]);
  const { data, ...rest } = useResource(fetcher, language, `photo:${photoId}`);
  return { photo: data, ...rest };
}
