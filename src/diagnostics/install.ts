import { AppState } from 'react-native';

import { addCrashListener } from '../platform/crashHooks';
import { getDeviceDetails } from '../platform/deviceInfo';
import { addKeyListener } from '../platform/keyLog';
import { useFocusStore } from '../ui-kit/focus/focusStore';
import {
  recordFocus,
  recordKey,
  reportError,
  setSessionOpen,
  startDiagnostics,
} from './diagnostics';

let installed = false;

// Starts recording keys, focus and errors; safe to call more than once
export function installDiagnostics() {
  if (installed) {
    return;
  }
  installed = true;
  startDiagnostics(getDeviceDetails());
  addKeyListener(key => recordKey(key));
  addCrashListener((error, fatal) =>
    reportError(error, fatal ? 'fatal' : 'error'),
  );
  // The moment the app became usable, timed from when JavaScript started;
  // the log line's own timestamp gives it from the launch
  const startedAt = Date.now();
  let focusedOnce = false;
  useFocusStore.subscribe(state => {
    if (state.focusedId) {
      if (!focusedOnce) {
        focusedOnce = true;
        console.log(
          `[app] first focus on ${state.focusedId} after ${
            Date.now() - startedAt
          } ms`,
        );
      }
      recordFocus(state.focusedId);
    }
  });
  AppState.addEventListener('change', next =>
    setSessionOpen(next === 'active'),
  );
}
