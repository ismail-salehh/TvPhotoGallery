import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import {
  applyLayoutDirection,
  directionProps,
  directionStyle,
  horizontalListMirroring,
} from '../../platform/layoutDirection';

const RtlContext = createContext(false);

const RTL = directionStyle(true);
// For what keeps its order in RTL, like Latin keys or a drawn icon
export const LTR = directionStyle(false);

type LayoutDirectionProviderProps = {
  rtl: boolean;
  // BCP 47 tag of the UI language
  language: string;
  children: ReactNode;
};

// Lays the app out right to left or left to right, and switches live: rows,
// start/end margins and the D-pad's left/right all follow
export function LayoutDirectionProvider({
  rtl,
  language,
  children,
}: LayoutDirectionProviderProps) {
  // During render, so lists below compute positions with the new direction
  applyLayoutDirection(rtl, language);
  return (
    <RtlContext.Provider value={rtl}>
      <DirectionView style={styles.fill}>{children}</DirectionView>
    </RtlContext.Provider>
  );
}

export function useIsRTL() {
  return useContext(RtlContext);
}

// Props for a horizontal FlatList. `key` remounts it when the direction
// changes, so no item positions measured in the old one are reused.
export function useHorizontalList() {
  const rtl = useIsRTL();
  return { key: rtl ? 'rtl' : 'ltr', ...horizontalListMirroring(rtl) };
}

type DirectionViewProps = {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// A View in the current direction. A native Modal is a root of its own and
// doesn't inherit it, so a dialog's content needs one.
export function DirectionView({ style, children }: DirectionViewProps) {
  const rtl = useIsRTL();
  return (
    <View {...directionProps(rtl)} style={[style, rtl ? RTL : LTR]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
