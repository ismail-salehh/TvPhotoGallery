import { memo, useCallback, useRef } from 'react';
import type { ListRenderItem } from 'react-native';
import { FlatList, StyleSheet } from 'react-native';

import type { Album } from '../../../api/types';
import { FocusGroup } from '../../../ui-kit/focus/FocusGroup';
import { SAFE_AREA_X } from '../../../ui-kit/layout/DesignCanvas';
import { useHorizontalList } from '../../../ui-kit/layout/LayoutDirection';
import { useKeepFocusInView } from '../../../ui-kit/layout/useKeepFocusInView';
import { spacing } from '../../theme';
import { ALBUM_CARD_WIDTH, AlbumCard, albumCardHeight } from './AlbumCard';

const GAP = spacing.lg;
// Room above and below the cards for the focused one's scale-up
const PADDING_Y = spacing.sm;
export const ALBUM_ROW_HEIGHT =
  albumCardHeight(ALBUM_CARD_WIDTH) + PADDING_Y * 2;

type AlbumRowProps = {
  albums: Album[];
  onAlbumFocus: (album: Album) => void;
  onAlbumPress: (album: Album) => void;
  contentInset?: number;
  // Its first card takes focus when the screen opens
  preferFirstFocus?: boolean;
};

export const AlbumRow = memo(function AlbumRowView({
  albums,
  onAlbumFocus,
  onAlbumPress,
  contentInset = SAFE_AREA_X,
  preferFirstFocus = false,
}: AlbumRowProps) {
  // The rail runs edge to edge: the focused card stays inside the side
  // margins, clear of the TV's overscan, with its highlight in full view
  const listRef = useRef<FlatList<Album>>(null);
  const { key: directionKey, inverted, style } = useHorizontalList();
  const { keepInView, listProps } = useKeepFocusInView(listRef, {
    horizontal: true,
    marginStart: contentInset,
    marginEnd: contentInset,
  });

  const albumsRef = useRef(albums);
  albumsRef.current = albums;
  const handleAlbumFocus = useCallback(
    (album: Album) => {
      const index = albumsRef.current.indexOf(album);
      keepInView(
        contentInset + (ALBUM_CARD_WIDTH + GAP) * index,
        ALBUM_CARD_WIDTH,
      );
      onAlbumFocus(album);
    },
    [contentInset, keepInView, onAlbumFocus],
  );

  const renderItem = useCallback<ListRenderItem<Album>>(
    ({ item, index }) => (
      <AlbumCard
        album={item}
        onFocus={handleAlbumFocus}
        onPress={onAlbumPress}
        hasTVPreferredFocus={preferFirstFocus && index === 0}
      />
    ),
    [handleAlbumFocus, onAlbumPress, preferFirstFocus],
  );

  // Offsets include the leading padding of the content container
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ALBUM_CARD_WIDTH + GAP,
      offset: contentInset + (ALBUM_CARD_WIDTH + GAP) * index,
      index,
    }),
    [contentInset],
  );

  return (
    // Entering the rail from above or below lands on its last focused card;
    // left/right never leave it
    <FocusGroup trapFocusLeft trapFocusRight>
      <FlatList
        key={directionKey}
        ref={listRef}
        {...listProps}
        horizontal
        inverted={inverted}
        style={style}
        data={albums}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        // A rail is short: every card stays rendered, so the album to
        // restore on coming back is always there to take focus
        initialNumToRender={albums.length}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: contentInset },
        ]}
      />
    </FocusGroup>
  );
});

const keyExtractor = (album: Album) => album.id;

const styles = StyleSheet.create({
  content: {
    gap: GAP,
    paddingVertical: PADDING_Y,
  },
});
