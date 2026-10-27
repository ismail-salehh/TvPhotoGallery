import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { hydrateCache } from '../../api/cache';

type CacheGateProps = {
  children: ReactNode;
};

// Renders nothing until the saved responses are loaded, so the first screen
// can show them in its first frame
export function CacheGate({ children }: CacheGateProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrateCache().then(() => setReady(true));
  }, []);
  return ready ? <>{children}</> : null;
}
