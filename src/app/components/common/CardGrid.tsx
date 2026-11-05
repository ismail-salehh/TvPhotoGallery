import type { ReactElement } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import { useListFocusRestore } from '../../../ui-kit/focus/useListFocusRestore';
import {
  SAFE_AREA_X,
  SAFE_AREA_Y,
  useCanvas,
} from '../../../ui-kit/layout/DesignCanvas';
import { useKeepFocusInView } from '../../../ui-kit/layout/useKeepFocusInView';
import { spacing } from '../../theme';

const DEFAULT_COLUMNS = 5;
const GAP = spacing.lg;
// Above the first row: room for the focused card's scale-up
const PADDING_TOP = spacing.md;

export type GridCardProps<T> = {
  item: T;
  width: number;
  onFocus: (item: T) => void;
  onPress?: (item: T) => void;
  hasTVPreferredFocus: boolean;
};

type CardGridProps<T> = {
  items: T[];
  // A component defined once, not per render, or every card remounts
  Card: (props: GridCardProps<T>) => ReactElement;
  onItemPress?: (item: T) => void;
  // Every card of a given width is this tall, so rows need no measuring
  cardHeight: (width: number) => number;
  focusId: (item: T) => string;
  ownsFocusId: (id: string) => boolean;
  onEndReached?: () => void;
  contentInset?: number;
  // Shown under the last row, e.g. a loading spinner for the next page
  footer?: ReactElement;
  columns?: number;
  // Width the grid lays out in; the whole canvas when not given
  width?: number;
  // Off when something else on the screen should keep focus, e.g. the
  // search keyboard while results update under it
  preferFirstFocus?: boolean;
};

function CardGridView<T extends { id: string }>({
  items,
  Card,
  onItemPress,
  cardHeight,
  focusId,
  ownsFocusId,
  onEndReached,
  contentInset = SAFE_AREA_X,
  footer,
  columns = DEFAULT_COLUMNS,
  width,
  preferFirstFocus = true,
}: CardGridProps<T>) {
  const { width: canvasWidth } = useCanvas();
  const gridWidth = width ?? canvasWidth;
  const cardWidth = Math.floor(
    (gridWidth - contentInset * 2 - GAP * (columns - 1)) / columns,
  );
  const rowHeight = cardHeight(cardWidth);

  // The grid runs to the bottom of the screen: the focused row stops short
  // of the bottom overscan, and its scaled-up highlight is never cut off
  const listRef = useRef<FlatList<T>>(null);
  const { keepInView, listProps } = useKeepFocusInView(listRef, {
    marginStart: PADDING_TOP,
    marginEnd: SAFE_AREA_Y + spacing.sm,
  });

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const handleFocus = useCallback(
    (item: T) => {
      const row = Math.floor(itemsRef.current.indexOf(item) / columns);
      keepInView(PADDING_TOP + row * (rowHeight + GAP), rowHeight);
    },
    [columns, keepInView, rowHeight],
  );

  const renderItem = useCallback<ListRenderItem<T>>(
    ({ item, index }) => (
      <Card
        item={item}
        width={cardWidth}
        onFocus={handleFocus}
        onPress={onItemPress}
        hasTVPreferredFocus={preferFirstFocus && index === 0}
      />
    ),
    [Card, cardWidth, handleFocus, onItemPress, preferFirstFocus],
  );

  // The list's items are rows. Every row is the same height, so any row
  // can be scrolled to before it has ever been rendered.
  const getItemLayout = useCallback(
    (_: unknown, row: number) => ({
      length: rowHeight + GAP,
      offset: PADDING_TOP + (rowHeight + GAP) * row,
      index: row,
    }),
    [rowHeight],
  );

  // Coming back from the viewer lands on the item last viewed, which may
  // be far below what the grid has rendered
  const itemIds = useMemo(() => items.map(focusId), [items, focusId]);
  useListFocusRestore({
    itemIds,
    ownsId: ownsFocusId,
    scrollToIndex: index =>
      listRef.current?.scrollToIndex({
        index: Math.floor(index / columns),
        animated: false,
        viewPosition: 0.5,
      }),
    fallbackToFirst: preferFirstFocus,
  });

  // react-native-tvos wraps the scroll view in an unstyled focus guide, so
  // `flex: 1` can't size it (it ran off the screen and never scrolled).
  // The list gets the measured height of its space instead.
  const [height, setHeight] = useState(0);

  return (
    <View
      style={styles.container}
      onLayout={event => setHeight(event.nativeEvent.layout.height)}
    >
      {height > 0 && (
        <FlatList
          ref={listRef}
          {...listProps}
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          // A FlatList can't change numColumns in place
          key={columns}
          numColumns={columns}
          onEndReached={onEndReached}
          // Fetch three screens ahead, so a held arrow doesn't outrun it
          onEndReachedThreshold={3}
          // Rows kept rendered: 7 screens' worth, not the default 21
          windowSize={7}
          ListFooterComponent={footer}
          showsVerticalScrollIndicator={false}
          style={{ height }}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: contentInset },
          ]}
        />
      )}
    </View>
  );
}

// memo() drops the type parameter; the cast puts it back
export const CardGrid = memo(CardGridView) as typeof CardGridView;

const keyExtractor = (item: { id: string }) => item.id;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    gap: GAP,
  },
  content: {
    gap: GAP,
    paddingTop: PADDING_TOP,
    // Lets the last row scroll clear of the bottom overscan
    paddingBottom: SAFE_AREA_Y + spacing.sm,
  },
});
