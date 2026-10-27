import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewStyle,
} from 'react-native';

import { domDocument } from './webDom';

// The page's lang and dir pick Arabic fonts and the scrollbar side
export function applyLayoutDirection(rtl: boolean, language: string) {
  const root = domDocument.documentElement;
  root.lang = language;
  root.dir = rtl ? 'rtl' : 'ltr';
}

// react-native-web rejects `direction` on a View; its writingDirection
// sets the CSS direction, which flexbox rows follow
export function directionStyle(rtl: boolean): ViewStyle {
  return { writingDirection: rtl ? 'rtl' : 'ltr' } as ViewStyle;
}

// react-native-web resolves marginStart and the like by the `dir` of the
// nearest element that sets one, not by the CSS direction
export function directionProps(rtl: boolean) {
  return { dir: rtl ? 'rtl' : 'ltr' };
}

type HorizontalListMirroring = { inverted?: boolean; style?: ViewStyle };

const NONE: HorizontalListMirroring = {};
// react-native-web's FlatList has no RTL support: an RTL scroll offset is
// negative, which breaks its windowing and onEndReached. An LTR list drawn
// mirrored keeps offsets positive; focus follows the mirrored boxes.
const MIRRORED: HorizontalListMirroring = {
  inverted: true,
  style: directionStyle(false),
};

export function horizontalListMirroring(rtl: boolean) {
  return rtl ? MIRRORED : NONE;
}

// With the list mirrored, the offset is already from its start edge
export function scrollOffsetFromStart(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  horizontal: boolean,
  _rtl: boolean,
) {
  const { contentOffset } = event.nativeEvent;
  return horizontal ? contentOffset.x : contentOffset.y;
}
