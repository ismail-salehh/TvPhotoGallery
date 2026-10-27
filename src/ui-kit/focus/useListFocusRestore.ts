import { useEffect, useRef } from 'react';

import { focusNode } from '../../platform/spatialNavigation';
import { useFocusScreenKey, usePendingFocusRestore } from './FocusScreen';
import { getFocusNode, useFocusStore } from './focusStore';

type ListFocusRestoreOptions = {
  // Focus ids of the list's items, in order
  itemIds: string[];
  // Whether a focus id is one of this list's items (loaded or not)
  ownsId: (id: string) => boolean;
  // Brings item `index` into the render window
  scrollToIndex: (index: number) => void;
  // Focus the first item when the remembered one is no longer in the list
  fallbackToFirst?: boolean;
};

// For virtualized lists. When the screen is coming back to one of the
// list's items, the item may not be mounted: it was scrolled out of the
// render window, or the list reloaded while the screen was hidden. This
// scrolls it back in (Focusable then takes focus as it mounts), or, if the
// reloaded list no longer has it, ends the wait so focus isn't left nowhere.
export function useListFocusRestore({
  itemIds,
  ownsId,
  scrollToIndex,
  fallbackToFirst = false,
}: ListFocusRestoreOptions) {
  const screenKey = useFocusScreenKey();
  const pendingId = usePendingFocusRestore();

  const scrollRef = useRef(scrollToIndex);
  useEffect(() => {
    scrollRef.current = scrollToIndex;
  });

  useEffect(() => {
    // An empty list is still loading; wait for it
    if (!screenKey || !pendingId || !ownsId(pendingId) || !itemIds.length) {
      return;
    }
    const index = itemIds.indexOf(pendingId);
    if (index !== -1) {
      if (!getFocusNode(screenKey, pendingId)) {
        scrollRef.current(index);
      }
      return;
    }
    useFocusStore.getState().clearPendingRestore(screenKey);
    if (fallbackToFirst) {
      focusNode(getFocusNode(screenKey, itemIds[0]));
    }
  }, [screenKey, pendingId, itemIds, ownsId, fallbackToFirst]);
}
