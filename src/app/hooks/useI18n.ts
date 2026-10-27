import { useCallback } from 'react';

import type { Photo } from '../../api/types';
import type { TranslationKey, TranslationParams } from '../../i18n';
import { translate } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { useSettings } from '../context/Settings';

// The UI language comes from Settings, so changing it there re-renders
// everything that reads text through this hook
export function useI18n() {
  const { language } = useSettings().settings;
  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language],
  );
  // Unsplash's text where it has some, ours in the UI language where not
  const photoTitle = useCallback(
    (photo: Photo) =>
      photo.title || t('photo.untitled', { name: photo.photographer }),
    [t],
  );
  const date = useCallback(
    (iso: string) => formatDate(language, iso),
    [language],
  );
  return { t, language, photoTitle, formatDate: date };
}

export type Translate = ReturnType<typeof useI18n>['t'];
