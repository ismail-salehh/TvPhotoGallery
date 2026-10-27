import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { useSpatialNavigation } from '../../platform/spatialNavigation';
import { markActiveScreenNavigated } from './focusStore';

type FocusProviderProps = {
  children: ReactNode;
};

const FocusContext = createContext(true);

export function FocusProvider({ children }: FocusProviderProps) {
  // Arrow-key focus movement on web. On both, the first arrow press on a
  // screen ends its initial focus: from then on, focus is the user's.
  useSpatialNavigation(markActiveScreenNavigated);

  return <FocusContext.Provider value={true}>{children}</FocusContext.Provider>;
}

export function useFocusProvider() {
  const isInsideFocusProvider = useContext(FocusContext);

  if (!isInsideFocusProvider) {
    throw new Error('Focus components must be used inside a FocusProvider.');
  }
}
