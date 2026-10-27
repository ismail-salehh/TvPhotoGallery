import type { ReactElement } from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';
import type { ListRenderItem } from 'react-native';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { Album } from '../../../api/types';
import { useListFocusRestore } from '../../../ui-kit/focus/useListFocusRestore';
import { useScreenMargins } from '../../../ui-kit/layout/DesignCanvas';
import { useKeepFocusInView } from '../../../ui-kit/layout/useKeepFocusInView';
import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor, spacing } from '../../theme';
import { albumCardFocusId, isAlbumCardFocusId } from './AlbumCard';
import { ALBUM_ROW_HEIGHT, AlbumRow } from './AlbumRow';

// Unsplash has no way to group collections, so rails split the list by
// position: a page of 20 makes two rails
export const RAIL_SIZE = 10;
const TITLE_SIZE = 26;
const TITLE_HEIGHT = lineHeightFor(TITLE_SIZE) + spacing.xs;
export const RAIL_HEIGHT = TITLE_HEIGHT + ALBUM_ROW_HEIGHT + spacing.sm;
// The focused rail sits at the top, with the next one's title and the top
// of its cards showing below it
export const RAILS_HEIGHT = RAIL_HEIGHT + 140;

type AlbumRailsProps = {
  albums: Album[];
  onAlbumFocus: (album: Album) => void;
  onAlbumPress: (album: Album) => void;
  onEndReached?: () => void;
  // Under the last rail, e.g. loading or retrying the next page
  footer?: ReactElement;
};

export const AlbumRails = memo(function AlbumRailsView({
  albums,
  onAlbumFocus,
  onAlbumPress,
  onEndReached,
  footer,
}: AlbumRailsProps) {
  const rails = useRails(albums);

  // Margins that put the focused rail exactly at the top
  const listRef = useRef<FlatList<Album[]>>(null);
  const { keepInView, listProps } = useKeepFocusInView(listRef, {
    marginStart: 0,
    marginEnd: RAILS_HEIGHT - RAIL_HEIGHT,
  });

  const albumsRef = useRef(albums);
  albumsRef.current = albums;
  const handleAlbumFocus = useCallback(
    (album: Album) => {
      const rail = Math.floor(albumsRef.current.indexOf(album) / RAIL_SIZE);
      keepInView(rail * RAIL_HEIGHT, RAIL_HEIGHT);
      onAlbumFocus(album);
    },
    [keepInView, onAlbumFocus],
  );

  const renderItem = useCallback<ListRenderItem<Album[]>>(
    ({ item, index }) => (
      <Rail
        albums={item}
        index={index}
        onAlbumFocus={handleAlbumFocus}
        onAlbumPress={onAlbumPress}
      />
    ),
    [handleAlbumFocus, onAlbumPress],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: RAIL_HEIGHT,
      offset: RAIL_HEIGHT * index,
      index,
    }),
    [],
  );

  // Back on Home: bring the rail of the album last opened into the render
  // window (its row then finds the card), or focus the first album if the
  // reloaded list no longer has it
  const itemIds = useMemo(
    () => albums.map(album => albumCardFocusId(album.id)),
    [albums],
  );
  useListFocusRestore({
    itemIds,
    ownsId: isAlbumCardFocusId,
    scrollToIndex: index =>
      listRef.current?.scrollToIndex({
        index: Math.floor(index / RAIL_SIZE),
        animated: false,
      }),
    fallbackToFirst: true,
  });

  return (
    <FlatList
      ref={listRef}
      {...listProps}
      data={rails}
      keyExtractor={railKey}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      onEndReached={onEndReached}
      onEndReachedThreshold={1}
      // About two screens of rails mounted: ten thumbnails each
      windowSize={3}
      initialNumToRender={2}
      // Android detaches rails scrolled out of view, and the focused one
      // sits at the top: Up would find no rail above to go to
      removeClippedSubviews={false}
      ListFooterComponent={footer}
      showsVerticalScrollIndicator={false}
      // A measured height: react-native-tvos's focus guide can't flex
      style={styles.list}
    />
  );
});

type RailProps = {
  albums: Album[];
  index: number;
  onAlbumFocus: (album: Album) => void;
  onAlbumPress: (album: Album) => void;
};

const Rail = memo(function RailView({
  albums,
  index,
  onAlbumFocus,
  onAlbumPress,
}: RailProps) {
  const { t } = useI18n();
  const margins = useScreenMargins();
  const from = index * RAIL_SIZE + 1;
  return (
    <View style={styles.rail}>
      {/* Both margins: Arabic text aligns to the right edge */}
      <Text
        style={[
          styles.title,
          { marginLeft: margins.left, marginRight: margins.right },
        ]}
      >
        {t('home.rail', { from, to: from + albums.length - 1 })}
      </Text>
      <AlbumRow
        albums={albums}
        onAlbumFocus={onAlbumFocus}
        onAlbumPress={onAlbumPress}
        contentInset={margins.start}
        preferFirstFocus={index === 0}
      />
    </View>
  );
});

// Chunks of RAIL_SIZE. A rail whose albums haven't changed keeps its array,
// so loading another page only re-renders the rails it touches.
function useRails(albums: Album[]) {
  const previous = useRef<Album[][]>([]);
  return useMemo(() => {
    const rails: Album[][] = [];
    for (let start = 0; start < albums.length; start += RAIL_SIZE) {
      const rail = albums.slice(start, start + RAIL_SIZE);
      const old = previous.current[rails.length];
      const same =
        old?.length === rail.length && old.every((a, i) => a === rail[i]);
      rails.push(same ? old : rail);
    }
    previous.current = rails;
    return rails;
  }, [albums]);
}

const railKey = (_: Album[], index: number) => `rail-${index}`;

const styles = StyleSheet.create({
  list: {
    height: RAILS_HEIGHT,
  },
  rail: {
    height: RAIL_HEIGHT,
  },
  title: {
    color: colors.text,
    fontSize: TITLE_SIZE,
    lineHeight: lineHeightFor(TITLE_SIZE),
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
});
