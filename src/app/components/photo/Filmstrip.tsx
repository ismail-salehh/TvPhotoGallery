import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import { FlatList, StyleSheet, View } from 'react-native';

import type { Photo } from '../../../api/types';
import { FocusGroup } from '../../../ui-kit/focus/FocusGroup';
import { Focusable } from '../../../ui-kit/focus/Focusable';
import { useCanvas } from '../../../ui-kit/layout/DesignCanvas';
import { useHorizontalList } from '../../../ui-kit/layout/LayoutDirection';
import { useI18n } from '../../hooks/useI18n';
import { PhotoImage } from '../common/PhotoImage';
import { colors, radius, spacing } from '../../theme';

// Box widths by distance from the current photo; all boxes are 16:9
const CURRENT_WIDTH = 256;
const ADJACENT_WIDTH = 176;
const REST_WIDTH = 120;
const GAP = spacing.sm;

export const FILMSTRIP_HEIGHT = (CURRENT_WIDTH * 9) / 16;

type Size = 'current' | 'adjacent' | 'rest';

const WIDTHS: Record<Size, number> = {
  current: CURRENT_WIDTH,
  adjacent: ADJACENT_WIDTH,
  rest: REST_WIDTH,
};

function sizeAt(index: number, current: number): Size {
  const distance = Math.abs(index - current);
  return distance === 0 ? 'current' : distance === 1 ? 'adjacent' : 'rest';
}

// Distance from the start of the first box to the start of box `index`.
// Every box is REST_WIDTH except the current one and its two neighbours,
// so only those need correcting for.
function startOf(index: number, current: number) {
  let start = index * (REST_WIDTH + GAP);
  if (current - 1 >= 0 && current - 1 < index) {
    start += ADJACENT_WIDTH - REST_WIDTH;
  }
  if (current < index) {
    start += CURRENT_WIDTH - REST_WIDTH;
  }
  if (current + 1 < index) {
    start += ADJACENT_WIDTH - REST_WIDTH;
  }
  return start;
}

type FilmstripProps = {
  photos: Photo[];
  index: number;
  onSelect: (index: number) => void;
};

// The current photo is always centered: the list is padded by half a
// screen on each side, so even the first and last photo can sit in the
// middle, and the strip jumps underneath as the selection moves
export function Filmstrip({ photos, index, onSelect }: FilmstripProps) {
  const { width: windowWidth } = useCanvas();
  const sidePadding = (windowWidth - CURRENT_WIDTH) / 2;

  const listRef = useRef<FlatList<Photo>>(null);
  const { key: directionKey, inverted, style } = useHorizontalList();

  useEffect(() => {
    // No slide: an animated scroll lags behind the key that caused it
    listRef.current?.scrollToOffset({
      offset: startOf(index, index),
      animated: false,
    });
  }, [index, windowWidth]);

  // An RTL list can't scroll before its content is measured: place it again
  // once it is
  const placed = useRef(false);
  const onContentSizeChange = useCallback(() => {
    if (!placed.current) {
      placed.current = true;
      listRef.current?.scrollToOffset({
        offset: startOf(index, index),
        animated: false,
      });
    }
  }, [index]);

  const renderItem = useCallback<ListRenderItem<Photo>>(
    ({ item, index: itemIndex }) => (
      <FilmstripItem
        photo={item}
        index={itemIndex}
        size={sizeAt(itemIndex, index)}
        onSelect={onSelect}
      />
    ),
    [index, onSelect],
  );

  const getItemLayout = useCallback(
    (_: unknown, itemIndex: number) => ({
      length: WIDTHS[sizeAt(itemIndex, index)] + GAP,
      offset: sidePadding + startOf(itemIndex, index),
      index: itemIndex,
    }),
    [index, sidePadding],
  );

  return (
    // Coming down from the header lands on the current photo, not on the
    // box under the button. Left/right never leave the strip.
    <FocusGroup trapFocusLeft trapFocusRight>
      <FlatList
        key={directionKey}
        ref={listRef}
        horizontal
        inverted={inverted}
        onContentSizeChange={onContentSizeChange}
        data={photos}
        extraData={index}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        // Opening photo 900 of 1,000 renders the boxes around it, not the
        // 900 before it
        initialScrollIndex={index}
        initialNumToRender={INITIAL_BOXES}
        showsHorizontalScrollIndicator={false}
        // Focus changes drive the scrolling; a free scroll would pull the
        // selection away from the center
        scrollEnabled={false}
        style={[styles.list, style]}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: sidePadding },
        ]}
      />
    </FocusGroup>
  );
}

const keyExtractor = (photo: Photo) => photo.id;
// Enough to fill the strip on either side of the current photo
const INITIAL_BOXES = 16;

type FilmstripItemProps = {
  photo: Photo;
  index: number;
  size: Size;
  onSelect: (index: number) => void;
};

// Memoized on `size`, so a move only re-renders the few boxes whose size
// changes (the old and new current photo and their neighbours)
const FilmstripItem = memo(function FilmstripItemView({
  photo,
  index,
  size,
  onSelect,
}: FilmstripItemProps) {
  const { t, photoTitle } = useI18n();
  const [focused, setFocused] = useState(false);
  const isCurrent = size === 'current';
  const width = WIDTHS[size];

  return (
    <Focusable
      id={`filmstrip-${photo.id}`}
      accessibilityLabel={t('a11y.photo', {
        title: photoTitle(photo),
        name: photo.photographer,
      })}
      // Opens on its photo; then the selection follows focus one box per
      // press or repeat, so it can neither skip a photo nor be pulled back
      // by a stale render
      hasTVPreferredFocus={isCurrent}
      onFocus={() => {
        setFocused(true);
        onSelect(index);
      }}
      onBlur={() => setFocused(false)}
      onPress={() => onSelect(index)}
      style={[
        styles.item,
        { width, height: (width * 9) / 16 },
        isCurrent && styles.itemCurrent,
        focused && styles.itemFocused,
        !isCurrent && styles.itemDimmed,
      ]}
    >
      <View style={styles.imageFrame}>
        <PhotoImage uri={photo.thumbnailUrl} style={styles.image} compact />
      </View>
    </Focusable>
  );
});

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  content: {
    alignItems: 'center',
    gap: GAP,
    height: FILMSTRIP_HEIGHT,
  },
  item: {
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  // The photo on screen, while focus is elsewhere (e.g. on the header):
  // white, so it never reads as a second focused item
  itemCurrent: {
    borderColor: colors.text,
  },
  itemFocused: {
    borderColor: colors.focus,
  },
  itemDimmed: {
    opacity: 0.6,
  },
  imageFrame: {
    flex: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
