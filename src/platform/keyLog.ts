import { TVEventHandler } from 'react-native';

// Back is left out: BackHandlerProvider records it, as it sees every Back
// (a native Modal's included). Focus events and touch pans are not keys.
const NOT_KEYS = new Set(['focus', 'blur', 'back', 'menu', 'pan']);
// Android sends key up (1) for every press, but key down (0) only when
// focus navigation doesn't take it; tvOS sends no action at all
const KEY_DOWN = 0;

// Every remote key pressed, by name ("up", "select"…). Web: keyLog.web.ts.
export function addKeyListener(listener: (key: string) => void) {
  const subscription = TVEventHandler?.addListener(event => {
    if (
      event?.eventType &&
      !NOT_KEYS.has(event.eventType) &&
      event.eventKeyAction !== KEY_DOWN
    ) {
      listener(event.eventType);
    }
  });
  return () => subscription?.remove();
}
