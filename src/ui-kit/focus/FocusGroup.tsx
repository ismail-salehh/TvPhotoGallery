import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { TVFocusGuideView } from 'react-native';

type FocusGroupProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
  trapFocusUp?: boolean;
  trapFocusDown?: boolean;
};

export function FocusGroup({
  children,
  style,
  autoFocus = true,
  trapFocusLeft = false,
  trapFocusRight = false,
  trapFocusUp = false,
  trapFocusDown = false,
}: FocusGroupProps) {
  return (
    <TVFocusGuideView
      autoFocus={autoFocus}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      trapFocusUp={trapFocusUp}
      trapFocusDown={trapFocusDown}
      style={style}
    >
      {children}
    </TVFocusGuideView>
  );
}
