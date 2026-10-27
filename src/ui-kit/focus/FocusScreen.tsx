import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { focusNode } from '../../platform/spatialNavigation';
import {
  getFocusNode,
  pushActiveFocusScreen,
  useFocusStore,
} from './focusStore';

type FocusScreenContextValue = {
  screenKey: string;
  active: boolean;
};

const FocusScreenContext = createContext<FocusScreenContextValue | undefined>(
  undefined,
);

type FocusScreenProps = {
  // Unique per screen instance, so two albums opened one after the other
  // don't share a memory
  screenKey: string;
  // False while another screen is on top of this one
  active: boolean;
  children: ReactNode;
};

// Remembers the last focused item of every Focusable inside it, and puts
// focus back on that item when the screen is shown again (e.g. going back
// from an album to Home). Hiding a screen with display: none drops its
// focus, and the TV focus engine doesn't bring it back by itself.
// Dialogs are FocusScreens too, nested inside the screen that opened them.
export function FocusScreen({ screenKey, active, children }: FocusScreenProps) {
  const wasActive = useRef(active);

  // Before the native side reacts to the screen change, so focus moves on
  // the screen being hidden are already ignored
  useLayoutEffect(() => {
    if (active) {
      return pushActiveFocusScreen(screenKey);
    }
  }, [active, screenKey]);

  useEffect(() => {
    const returning = active && !wasActive.current;
    wasActive.current = active;
    if (!returning) {
      return;
    }
    return restoreScreenFocus(screenKey);
  }, [active, screenKey]);

  useEffect(
    () => () => useFocusStore.getState().forgetScreen(screenKey),
    [screenKey],
  );

  const value = useMemo(() => ({ screenKey, active }), [screenKey, active]);

  return (
    <FocusScreenContext.Provider value={value}>
      {children}
    </FocusScreenContext.Provider>
  );
}

// Puts focus back on the screen's remembered item. If that item isn't
// mounted (its list is reloading, or scrolled out of the render window),
// the restore stays pending until it mounts or its list reports it gone.
// Returns a cleanup that cancels the attempt.
export function restoreScreenFocus(screenKey: string) {
  const store = useFocusStore.getState();
  const id = store.lastFocusedByScreen[screenKey];
  if (!id) {
    return;
  }
  store.restoreFocus(screenKey);
  store.setPendingRestore(screenKey, id);
  // Wait for the screen to be laid out again; a view that is still
  // display: none can't take focus
  const frame = requestAnimationFrame(() => {
    const node = getFocusNode(screenKey, id);
    if (node) {
      focusNode(node);
    }
  });
  return () => cancelAnimationFrame(frame);
}

export function useFocusScreenKey() {
  return useContext(FocusScreenContext)?.screenKey;
}

export function useFocusScreenActive() {
  return useContext(FocusScreenContext)?.active ?? true;
}

// The id the screen is waiting to put focus back on, if any. Lists use it
// to scroll that item into their render window.
export function usePendingFocusRestore() {
  const screenKey = useFocusScreenKey();
  return useFocusStore(state =>
    screenKey ? state.pendingRestoreByScreen[screenKey] : undefined,
  );
}
