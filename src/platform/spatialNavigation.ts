import { useEffect, useRef } from 'react';
import { TVEventHandler } from 'react-native';

// On TV the native focus engine moves focus with the D-pad and honours
// hasTVPreferredFocus, so there is little to do. The browser has neither;
// spatialNavigation.web.ts recreates them on top of the keyboard.

const ARROWS = new Set(['up', 'down', 'left', 'right']);

// `onNavigate` is told whenever the user presses an arrow on the remote
export function useSpatialNavigation(onNavigate: () => void) {
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    const subscription = TVEventHandler?.addListener(event => {
      if (ARROWS.has(event.eventType)) {
        onNavigateRef.current();
      }
    });
    return () => subscription?.remove();
  }, []);
}

// Called by focusables with hasTVPreferredFocus
export function claimInitialFocus(_node: unknown) {}

// Moves focus to a mounted focusable, e.g. a screen's remembered item when
// the user comes back to it
export function focusNode(node: unknown) {
  (node as { requestTVFocus?: () => void } | null)?.requestTVFocus?.();
}
