import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewStyle,
} from 'react-native';
import { I18nManager } from 'react-native';

// Direction switches by a root `direction` style, without forceRTL's
// restart; FlatList reads I18nManager.isRTL to place horizontal items, so
// it must agree. Web version: layoutDirection.web.ts.
export function applyLayoutDirection(rtl: boolean, _language: string) {
  (I18nManager as { isRTL: boolean }).isRTL = rtl;
}

// A View laid out in the given direction
export function directionStyle(rtl: boolean): ViewStyle {
  return { direction: rtl ? 'rtl' : 'ltr' };
}

// Extra props for that View; native needs none
export function directionProps(_rtl: boolean) {
  return {};
}

type HorizontalListMirroring = { inverted?: boolean; style?: ViewStyle };

const NONE: HorizontalListMirroring = {};

// Native scroll views mirror themselves under an RTL parent
export function horizontalListMirroring(_rtl: boolean) {
  return NONE;
}

// Scroll position from the list's start edge. Native RTL scroll views
// report it from the left, as FlatList's own RTL handling expects.
export function scrollOffsetFromStart(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  horizontal: boolean,
  rtl: boolean,
) {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
  if (!horizontal) {
    return contentOffset.y;
  }
  return rtl
    ? contentSize.width - contentOffset.x - layoutMeasurement.width
    : contentOffset.x;
}
