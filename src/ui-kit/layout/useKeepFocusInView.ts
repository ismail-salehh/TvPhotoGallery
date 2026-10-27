import type { RefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { scrollOffsetFromStart } from '../../platform/layoutDirection';
import { useIsRTL } from './LayoutDirection';

type ScrollableList = {
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
};

type KeepFocusInViewOptions = {
  horizontal?: boolean;
  // Space to keep between the focused item and the list's start and end
  // edges: room for the focus highlight, and for the TV's overscan where
  // the list runs to the edge of the screen
  marginStart: number;
  marginEnd: number;
};

// Keeps the focused item, highlight included, inside the margins. Native and
// browser scrolling stop at the edge (highlight cut off, TV may crop it), so
// `listProps` turns them off and items call `keepInView` from onFocus.
export function useKeepFocusInView(
  listRef: RefObject<ScrollableList | null>,
  { horizontal = false, marginStart, marginEnd }: KeepFocusInViewOptions,
) {
  const rtl = useIsRTL();
  const scrollOffset = useRef(0);
  const viewportLength = useRef(0);

  // Offsets here are from the list's start edge, the right one in RTL
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = scrollOffsetFromStart(event, horizontal, rtl);
    },
    [horizontal, rtl],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      viewportLength.current = horizontal ? width : height;
    },
    [horizontal],
  );

  // `start` and `length` locate the item along the list, in content
  // coordinates
  const keepInView = useCallback(
    (start: number, length: number) => {
      // Not laid out yet: there is no viewport to fit the item into
      if (viewportLength.current === 0) {
        return;
      }
      const current = scrollOffset.current;
      const earliest = start + length + marginEnd - viewportLength.current;
      const latest = start - marginStart;
      // An item too big for the viewport aligns to the start
      const target = Math.max(
        0,
        current > latest ? latest : current < earliest ? earliest : current,
      );
      if (target !== current) {
        // Jumps: an animated scroll lags behind the key that caused it
        scrollOffset.current = target;
        listRef.current?.scrollToOffset({ offset: target, animated: false });
      }
    },
    [listRef, marginStart, marginEnd],
  );

  const listProps = useMemo(
    () => ({
      onScroll,
      onLayout,
      scrollEventThrottle: 16,
      // Android: don't scroll to the focused child natively.
      // Web: spatialNavigation.web leaves scrolling inside this to us.
      // Neither prop is in React Native's types.
      ...({
        scrollsChildToFocus: false,
        dataSet: { managedScroll: '' },
      } as object),
    }),
    [onScroll, onLayout],
  );

  return { keepInView, listProps };
}
