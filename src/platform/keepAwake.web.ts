import { useEffect } from 'react';

type WakeLock = { release: () => Promise<void> };
type WakeLockNavigator = {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLock> };
};

// Screen Wake Lock API; browsers without it just let the screen sleep
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    const api = (globalThis as { navigator?: WakeLockNavigator }).navigator
      ?.wakeLock;
    if (!active || !api) {
      return;
    }
    let lock: WakeLock | null = null;
    let cancelled = false;
    api
      .request('screen')
      .then(l => {
        if (cancelled) {
          l.release().catch(() => {});
        } else {
          lock = l;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
    };
  }, [active]);
}
