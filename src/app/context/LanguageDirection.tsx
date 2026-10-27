import type { ReactNode } from 'react';

import { RTL_LANGUAGES } from '../../i18n';
import { LayoutDirectionProvider } from '../../ui-kit/layout/LayoutDirection';
import { useI18n } from '../hooks/useI18n';

type LanguageDirectionProps = {
  children: ReactNode;
};

// The layout direction of the language chosen in Settings
export function LanguageDirection({ children }: LanguageDirectionProps) {
  const { language } = useI18n();
  return (
    <LayoutDirectionProvider
      rtl={RTL_LANGUAGES.has(language)}
      language={language}
    >
      {children}
    </LayoutDirectionProvider>
  );
}
