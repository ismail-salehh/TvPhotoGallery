import type { ComponentRef, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

import { useEffect, useRef, useState } from 'react';
import { claimInitialFocus, focusNode } from '../../platform/spatialNavigation';
import {
  getActiveFocusScreen,
  getFallbackFocusNode,
  getFocusNode,
  hasNavigated,
  registerFocusNode,
  useFocusStore,
} from './focusStore';
import { useFocusProvider } from './FocusProvider';
import { useFocusScreenActive, useFocusScreenKey } from './FocusScreen';

type FocusableProps = {
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  // Takes focus when it mounts, as long as the user hasn't started moving
  // around the screen yet (or is being returned to a remembered item)
  hasTVPreferredFocus?: boolean;
  screenKey?: string;
  // Keeps its place on screen but can't be focused or pressed
  disabled?: boolean;
  // What a screen reader says for the whole item (it is read as one item,
  // not as its separate texts and images)
  accessibilityLabel?: string;
};

export function Focusable({
  id,
  children,
  style,
  focusedStyle,
  onPress,
  onFocus,
  onBlur,
  hasTVPreferredFocus = false,
  screenKey: screenKeyProp,
  disabled = false,
  accessibilityLabel,
}: FocusableProps) {
  useFocusProvider();
  // Belongs to the screen it is rendered in unless told otherwise
  const contextScreenKey = useFocusScreenKey();
  const screenKey = screenKeyProp ?? contextScreenKey;
  const screenActive = useFocusScreenActive();

  // Select a boolean so only the items gaining/losing focus re-render
  const isFocused = useFocusStore(state => state.focusedId === id);
  const setFocusedId = useFocusStore(state => state.setFocusedId);
  const rememberFocus = useFocusStore(state => state.rememberFocus);

  // Decided once, when the item can first take focus: a list item that
  // remounts later (scrolled back in, or reloaded) must not pull focus
  // away from where the user is
  const preference = { hasTVPreferredFocus, screenActive, screenKey };
  const latestPreference = useRef(preference);
  latestPreference.current = preference;
  const [preferred, setPreferred] = useState(
    () => !disabled && wantsInitialFocus(preference),
  );
  const decided = useRef(!disabled);
  useEffect(() => {
    if (!disabled && !decided.current) {
      decided.current = true;
      setPreferred(wantsInitialFocus(latestPreference.current));
    }
  }, [disabled]);

  // A screen covered before it ever took focus (by a link opened at launch)
  // starts like a new one when shown: its preferred item takes focus
  const wasScreenActive = useRef(screenActive);
  useEffect(() => {
    const shown = screenActive && !wasScreenActive.current;
    wasScreenActive.current = screenActive;
    if (
      shown &&
      hasTVPreferredFocus &&
      !disabled &&
      screenKey &&
      !useFocusStore.getState().lastFocusedByScreen[screenKey] &&
      !hasNavigated(screenKey)
    ) {
      setPreferred(true);
      // Asked directly too: a preference already set doesn't ask again
      const frame = requestAnimationFrame(() => focusNode(ref.current));
      return () => cancelAnimationFrame(frame);
    }
  }, [screenActive, hasTVPreferredFocus, disabled, screenKey]);

  // The TV focus engine handles hasTVPreferredFocus itself; the browser
  // needs it done by hand
  const ref = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => {
    if (preferred) {
      claimInitialFocus(ref.current);
    }
  }, [preferred]);

  useEffect(() => {
    if (!screenKey) {
      return;
    }
    const unregister = registerFocusNode(screenKey, id, ref.current);
    // The item the screen is waiting to put focus back on has arrived
    let frame: number | undefined;
    if (
      useFocusStore.getState().pendingRestoreByScreen[screenKey] === id &&
      getActiveFocusScreen() === screenKey
    ) {
      frame = requestAnimationFrame(() => focusNode(ref.current));
    }
    return () => {
      unregister();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      // Removed while focused (e.g. a Retry button turning into a spinner):
      // don't leave the remote with nothing focused
      if (
        useFocusStore.getState().focusedId === id &&
        getActiveFocusScreen() === screenKey
      ) {
        requestAnimationFrame(() => {
          if (useFocusStore.getState().focusedId === id) {
            // A replacement with the same id (loading Retry → error Retry)
            // keeps focus; otherwise go back to where the user just was
            focusNode(
              getFocusNode(screenKey, id) ??
                getFallbackFocusNode(screenKey, id),
            );
          }
        });
      }
    };
  }, [id, screenKey]);

  return (
    <Pressable
      ref={ref}
      // Lets QA tools and logs name the focused item (Android resource-id,
      // web data-testid)
      testID={id}
      focusable={!disabled}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hasTVPreferredFocus={preferred && !disabled}
      onFocus={() => {
        setFocusedId(id);
        if (screenKey) {
          rememberFocus(screenKey, id);
          if (
            useFocusStore.getState().pendingRestoreByScreen[screenKey] === id
          ) {
            useFocusStore.getState().clearPendingRestore(screenKey);
          }
        }
        onFocus?.();
      }}
      onBlur={onBlur}
      onPress={onPress}
      style={[style, isFocused && focusedStyle]}
    >
      {children}
    </Pressable>
  );
}

type Preference = {
  hasTVPreferredFocus: boolean;
  screenActive: boolean;
  screenKey: string | undefined;
};

// Preferred focus only applies while the screen is still settling: the
// user hasn't moved yet, and isn't being returned to a remembered item
function wantsInitialFocus({
  hasTVPreferredFocus,
  screenActive,
  screenKey,
}: Preference) {
  return (
    hasTVPreferredFocus &&
    screenActive &&
    !(
      screenKey &&
      (hasNavigated(screenKey) ||
        useFocusStore.getState().pendingRestoreByScreen[screenKey])
    )
  );
}
