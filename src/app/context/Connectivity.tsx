import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { isOnline } from '../../api/unsplash';

// While offline, how often to look for the connection coming back
const POLL_MS = 5000;

type ConnectivityValue = {
  // Bumped when the connection comes back and when the app returns to the
  // foreground: anything that failed should try again
  retrySignal: number;
  // Something failed in a way that may mean the device is offline
  checkConnection: () => void;
};

const ConnectivityContext = createContext<ConnectivityValue | null>(null);

type ConnectivityProviderProps = {
  children: ReactNode;
};

// Lets failed content recover on its own once the network is back, or
// after a return from Home or standby, without restarting the app
export function ConnectivityProvider({ children }: ConnectivityProviderProps) {
  const [retrySignal, setRetrySignal] = useState(0);
  const offline = useRef(false);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signalRetry = useCallback(() => setRetrySignal(n => n + 1), []);

  const checkConnection = useCallback(() => {
    if (offline.current) {
      return;
    }
    isOnline().then(online => {
      if (online || offline.current) {
        return;
      }
      offline.current = true;
      const tick = () => {
        poll.current = setTimeout(async () => {
          if (await isOnline()) {
            offline.current = false;
            poll.current = null;
            signalRetry();
          } else {
            tick();
          }
        }, POLL_MS);
      };
      tick();
    });
  }, [signalRetry]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        signalRetry();
      }
    });
    return () => {
      subscription.remove();
      if (poll.current) {
        clearTimeout(poll.current);
      }
    };
  }, [signalRetry]);

  const value = useMemo(
    () => ({ retrySignal, checkConnection }),
    [retrySignal, checkConnection],
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error(
      'useConnectivity must be used inside a ConnectivityProvider.',
    );
  }
  return context;
}

// Calls `retry` whenever failed content should try again (connection back,
// app back in the foreground), while `failed` is true
export function useRetryOnRecovery(failed: boolean, retry: () => void) {
  const { retrySignal, checkConnection } = useConnectivity();
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });
  useEffect(() => {
    if (failed) {
      checkConnection();
    }
  }, [failed, checkConnection]);
  const seen = useRef(retrySignal);
  useEffect(() => {
    if (retrySignal !== seen.current) {
      seen.current = retrySignal;
      if (failed) {
        retryRef.current();
      }
    }
  }, [retrySignal, failed]);
}
