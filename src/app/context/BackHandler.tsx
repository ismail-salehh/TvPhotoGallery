import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { recordKey } from '../../diagnostics/diagnostics';
import {
  addBackPressListener,
  setBackPressWanted,
} from '../../platform/backPress';

// Return true when the back press was handled, false to pass it on
export type BackHandlerFn = () => boolean;

type BackHandlerContextValue = {
  register: (handler: { current: BackHandlerFn }) => () => void;
  // Runs a back press through the handlers, as the remote's button does
  dispatch: () => boolean;
};

// After a back press does something, further presses within this window
// are swallowed: a quick double press goes back one step, never two, and
// never falls through to the OS (exiting the app)
const BACK_COOLDOWN_MS = 400;

const BackHandlerContext = createContext<BackHandlerContextValue | null>(null);

type BackHandlerProviderProps = {
  children: ReactNode;
};

// Sole owner of the back / tvOS menu button (Escape or Backspace on web).
// Screens register through useBackHandler; the newest handler goes first,
// returning false passes it on, and unhandled presses go to the OS.
export function BackHandlerProvider({ children }: BackHandlerProviderProps) {
  const stack = useRef<{ current: BackHandlerFn }[]>([]);
  const lastHandledAt = useRef(-Infinity);

  const syncTVMenuKey = useCallback(() => {
    setBackPressWanted(stack.current.length > 0);
  }, []);

  const dispatch = useCallback(() => {
    recordKey('back');
    const now = Date.now();
    if (now - lastHandledAt.current < BACK_COOLDOWN_MS) {
      return true;
    }
    for (let i = stack.current.length - 1; i >= 0; i--) {
      if (stack.current[i].current()) {
        lastHandledAt.current = now;
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => addBackPressListener(dispatch), [dispatch]);

  const register = useCallback(
    (handler: { current: BackHandlerFn }) => {
      stack.current.push(handler);
      syncTVMenuKey();
      return () => {
        stack.current = stack.current.filter(h => h !== handler);
        syncTVMenuKey();
      };
    },
    [syncTVMenuKey],
  );

  const value = useMemo(() => ({ register, dispatch }), [register, dispatch]);

  return (
    <BackHandlerContext.Provider value={value}>
      {children}
    </BackHandlerContext.Provider>
  );
}

function useBackHandlerContext() {
  const context = useContext(BackHandlerContext);
  if (!context) {
    throw new Error(
      'useBackHandler must be used inside a BackHandlerProvider.',
    );
  }
  return context;
}

// Registers a back handler for as long as the component is mounted and
// `enabled` is true. The handler can change between renders without losing
// its place in the stack.
export function useBackHandler(handler: BackHandlerFn, enabled = true) {
  const context = useBackHandlerContext();

  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const { register } = context;
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return register(handlerRef);
  }, [register, enabled]);
}

// For back presses that reach the app some other way than the listener
// above, e.g. a native Modal's onRequestClose, so they get the same
// handlers and the same double-press protection
export function useBackDispatch() {
  return useBackHandlerContext().dispatch;
}
