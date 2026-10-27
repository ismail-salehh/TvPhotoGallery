import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

type FocusGroupProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
  trapFocusUp?: boolean;
  trapFocusDown?: boolean;
};

// Rendered as data-focus-group by react-native-web; `dataSet` isn't in
// React Native's types
const GROUP_MARKER = { dataSet: { focusGroup: '' } } as object;

// TVFocusGuideView has no web equivalent, so on web the group is a plain
// View that spatialNavigation.web recognises: entering it from outside
// lands on the item last focused inside (autoFocus). The trap props are
// ignored; on web only a Modal confines focus.
export function FocusGroup({ children, style }: FocusGroupProps) {
  return (
    <View style={style} {...GROUP_MARKER}>
      {children}
    </View>
  );
}
