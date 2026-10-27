import { useEffect } from 'react';
import { NativeModules } from 'react-native';

// Android: KeepAwakeModule.kt. Elsewhere (tvOS) not implemented yet: a no-op.
const KeepAwake = NativeModules.KeepAwake as
  | { setActive: (active: boolean) => void }
  | undefined;

// Stops the TV's screensaver and sleep while `active`
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    KeepAwake?.setActive(true);
    return () => KeepAwake?.setActive(false);
  }, [active]);
}
