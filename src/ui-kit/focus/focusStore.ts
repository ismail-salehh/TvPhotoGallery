import { create } from 'zustand';

type FocusState = {
  focusedId: string | null;
  lastFocusedByScreen: Record<string, string>;
  // Screens waiting to put focus back on their remembered item, which may
  // not be mounted yet (e.g. a list still reloading)
  pendingRestoreByScreen: Record<string, string>;

  setFocusedId: (id: string) => void;
  rememberFocus: (screenKey: string, id: string) => void;
  // Overrides what a screen below the top will restore when it is shown
  // again, e.g. the viewer pointing the album at the photo last viewed
  setReturnFocus: (screenKey: string, id: string) => void;
  restoreFocus: (screenKey: string) => void;
  setPendingRestore: (screenKey: string, id: string) => void;
  clearPendingRestore: (screenKey: string) => void;
  forgetScreen: (screenKey: string) => void;
  clearFocus: () => void;
};

export const useFocusStore = create<FocusState>((set, get) => ({
  focusedId: null,
  lastFocusedByScreen: {},
  pendingRestoreByScreen: {},

  setFocusedId: id => {
    set({ focusedId: id });
  },

  rememberFocus: (screenKey, id) => {
    // Hiding a screen makes the TV focus engine move focus to one of its
    // own views on the way out; that isn't where the user was
    if (
      getActiveFocusScreen() !== undefined &&
      screenKey !== getActiveFocusScreen()
    ) {
      return;
    }
    rememberInHistory(screenKey, id);
    set(state => ({
      lastFocusedByScreen: {
        ...state.lastFocusedByScreen,
        [screenKey]: id,
      },
    }));
  },

  setReturnFocus: (screenKey, id) => {
    rememberInHistory(screenKey, id);
    set(state => ({
      lastFocusedByScreen: {
        ...state.lastFocusedByScreen,
        [screenKey]: id,
      },
    }));
  },

  restoreFocus: screenKey => {
    const id = get().lastFocusedByScreen[screenKey];

    set({ focusedId: id ?? null });
  },

  setPendingRestore: (screenKey, id) => {
    set(state => ({
      pendingRestoreByScreen: {
        ...state.pendingRestoreByScreen,
        [screenKey]: id,
      },
    }));
  },

  clearPendingRestore: screenKey => {
    if (!(screenKey in get().pendingRestoreByScreen)) {
      return;
    }
    set(state => {
      const rest = { ...state.pendingRestoreByScreen };
      delete rest[screenKey];
      return { pendingRestoreByScreen: rest };
    });
  },

  forgetScreen: screenKey => {
    history.delete(screenKey);
    navigatedScreens.delete(screenKey);
    set(state => {
      const rest = { ...state.lastFocusedByScreen };
      delete rest[screenKey];
      const pending = { ...state.pendingRestoreByScreen };
      delete pending[screenKey];
      return { lastFocusedByScreen: rest, pendingRestoreByScreen: pending };
    });
  },

  clearFocus: () => {
    set({ focusedId: null });
  },
}));

// Screens that are showing, innermost last: a dialog sits above the screen
// that opened it. Only the top one's focus changes are remembered.
// Empty (remember everything) until a FocusScreen mounts.
const activeScreens: string[] = [];

export function getActiveFocusScreen(): string | undefined {
  return activeScreens[activeScreens.length - 1];
}

export function pushActiveFocusScreen(screenKey: string) {
  activeScreens.push(screenKey);
  return () => {
    const index = activeScreens.lastIndexOf(screenKey);
    if (index !== -1) {
      activeScreens.splice(index, 1);
    }
  };
}

// Screens where the user has moved or pressed something. Until then a
// screen is still settling (content loading in), and preferred focus may
// move to whatever arrives; after that, nothing takes focus away.
const navigatedScreens = new Set<string>();

export function markActiveScreenNavigated() {
  const screenKey = getActiveFocusScreen();
  if (screenKey !== undefined) {
    navigatedScreens.add(screenKey);
    // The user went somewhere else; don't pull them back later
    useFocusStore.getState().clearPendingRestore(screenKey);
  }
}

export function hasNavigated(screenKey: string) {
  return navigatedScreens.has(screenKey);
}

// Recently focused ids per screen, most recent last, so focus can fall
// back to where the user just was when the focused item disappears
const HISTORY_SIZE = 20;
const history = new Map<string, string[]>();

function rememberInHistory(screenKey: string, id: string) {
  const ids = (history.get(screenKey) ?? []).filter(other => other !== id);
  ids.push(id);
  history.set(screenKey, ids.slice(-HISTORY_SIZE));
}

// The most recently focused item of a screen that is still mounted
export function getFallbackFocusNode(screenKey: string, excludeId: string) {
  const ids = history.get(screenKey) ?? [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const node = ids[i] !== excludeId && getFocusNode(screenKey, ids[i]);
    if (node) {
      return node;
    }
  }
  // Nothing visited yet: the first item on the screen
  for (const [key, node] of nodes) {
    const [nodeScreen, id] = key.split('\u0000');
    if (nodeScreen === screenKey && id !== excludeId) {
      return node;
    }
  }
  return undefined;
}

// Mounted focusables by screen and id, so a screen can hand focus back to
// its remembered item. Native views don't belong in React state.
const nodes = new Map<string, unknown>();
const nodeKey = (screenKey: string, id: string) => `${screenKey}\u0000${id}`;

export function registerFocusNode(
  screenKey: string,
  id: string,
  node: unknown,
) {
  const key = nodeKey(screenKey, id);
  nodes.set(key, node);
  return () => {
    if (nodes.get(key) === node) {
      nodes.delete(key);
    }
  };
}

export function getFocusNode(screenKey: string, id: string) {
  return nodes.get(nodeKey(screenKey, id));
}
