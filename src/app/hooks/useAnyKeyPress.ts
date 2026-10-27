import { useEffect, useRef } from 'react';
import { TVEventHandler } from 'react-native';

// The remote's buttons, as opposed to the focus/blur events the same
// emitter also reports
const KEYS = new Set(['up', 'down', 'left', 'right', 'select', 'playPause']);

// Every remote press, including ones that move nothing (an arrow at the
// edge of the screen). Web version: useAnyKeyPress.web.ts.
export function useAnyKeyPress(onKeyPress: () => void) {
  const handlerRef = useRef(onKeyPress);
  useEffect(() => {
    handlerRef.current = onKeyPress;
  });

  useEffect(() => {
    const subscription = TVEventHandler?.addListener(event => {
      if (KEYS.has(event.eventType)) {
        handlerRef.current();
      }
    });
    return () => subscription?.remove();
  }, []);
}
