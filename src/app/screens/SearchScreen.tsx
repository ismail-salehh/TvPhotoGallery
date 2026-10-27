import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCanvas, useScreenMargins } from '../../ui-kit/layout/DesignCanvas';

import { searchAlbums, searchPhotos } from '../../api/photoApi';
import type { Album, Photo } from '../../api/types';
import { FocusGroup } from '../../ui-kit/focus/FocusGroup';
import { AlbumGrid } from '../components/album/AlbumGrid';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { BackButton } from '../components/common/BackButton';
import {
  KEYBOARD_WIDTH,
  OnScreenKeyboard,
} from '../components/search/OnScreenKeyboard';
import { PhotoGrid } from '../components/photo/PhotoGrid';
import { StatusView, statusForError } from '../components/common/StatusView';
import { useSearch } from '../hooks/useSearch';
import { LTR } from '../../ui-kit/layout/LayoutDirection';
import { useI18n } from '../hooks/useI18n';
import { colors, lineHeightFor, radius, spacing } from '../theme';

const COLUMNS = 3;
// Long enough for any real search, short enough to fit the query box
const MAX_QUERY_LENGTH = 40;

type SearchScreenProps = {
  // Searches this album's photos; without one, searches albums
  album?: Album;
  onBack: () => void;
  onOpenAlbum?: (album: Album) => void;
  // Opens the viewer on `index` with every result loaded so far
  onOpenPhoto?: (photos: Photo[], index: number) => void;
};

export function SearchScreen({
  album,
  onBack,
  onOpenAlbum,
  onOpenPhoto,
}: SearchScreenProps) {
  const { t } = useI18n();
  const margins = useScreenMargins();
  const gutterLeft = margins.left;
  const gutterRight = margins.right;
  const { width: windowWidth } = useCanvas();

  const [query, setQuery] = useState('');
  // Debounced inside, so typing a word sends one request, not one per key.
  // Only the search for this screen's mode gets the query; the other stays
  // empty, which sends nothing.
  const albumId = album?.id;
  const searchInAlbum = useCallback(
    (q: string, page: number) => searchPhotos(q, page, undefined, albumId),
    [albumId],
  );
  const albumSearch = useSearch(album ? '' : query, searchAlbums);
  const photoSearch = useSearch(album ? query : '', searchInAlbum);
  const { loading, error, loadMore, retry } = album ? photoSearch : albumSearch;
  const resultCount = album
    ? photoSearch.results.length
    : albumSearch.results.length;
  const trimmed = query.trim();
  const text = album
    ? {
        title: t('search.photos.title', {
          album: album.title || t('album.untitled'),
        }),
        placeholder: t('search.photos.placeholder'),
        hintTitle: t('search.photos.hintTitle'),
        hintMessage: t('search.photos.hintMessage'),
        loadFailed: t('search.photos.loadFailed'),
        emptyTitle: t('search.photos.emptyTitle', { query: trimmed }),
      }
    : {
        title: t('search.title'),
        placeholder: t('search.albums.placeholder'),
        hintTitle: t('search.albums.hintTitle'),
        hintMessage: t('search.albums.hintMessage'),
        loadFailed: t('search.albums.loadFailed'),
        emptyTitle: t('search.albums.emptyTitle', { query: trimmed }),
      };
  const footerStyle = { marginBottom: margins.bottom };

  // Stable, so the memoized keyboard doesn't re-render on every key
  const handleKey = useCallback((character: string) => {
    setQuery(q => (q.length < MAX_QUERY_LENGTH ? q + character : q));
  }, []);
  const handleSpace = useCallback(() => {
    // No leading or doubled spaces; they would only confuse the debounce
    setQuery(q => (q && !q.endsWith(' ') ? q + ' ' : q));
  }, []);
  const handleDelete = useCallback(() => setQuery(q => q.slice(0, -1)), []);
  const handleClear = useCallback(() => setQuery(''), []);

  // Read through a ref so the press handler stays stable while pages load,
  // which keeps the memoized cards from re-rendering
  const photosRef = useRef(photoSearch.results);
  photosRef.current = photoSearch.results;
  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      const list = photosRef.current;
      onOpenPhoto?.(list, list.indexOf(photo));
    },
    [onOpenPhoto],
  );

  const renderResults = () => {
    if (!trimmed) {
      return (
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>{text.hintTitle}</Text>
          <Text style={styles.hintMessage}>{text.hintMessage}</Text>
        </View>
      );
    }
    if (resultCount > 0) {
      const footer =
        // A later page failed: the loaded results stay usable
        error ? (
          <StatusView
            id="search-more"
            variant="inline"
            {...statusForError(error, t, t('search.loadMoreFailed'))}
            preferFocus={false}
            onRetry={retry}
            style={footerStyle}
          />
        ) : loading ? (
          <StatusView
            id="search-more"
            kind="loading"
            variant="inline"
            preferFocus={false}
            onRetry={retry}
            style={footerStyle}
          />
        ) : undefined;
      const grid = {
        onEndReached: loadMore,
        columns: COLUMNS,
        width: windowWidth - margins.start - KEYBOARD_WIDTH,
        contentInset: margins.end,
        // Focus stays on the keyboard while results change under it
        preferFirstFocus: false,
        footer,
      };
      return album ? (
        <PhotoGrid
          {...grid}
          photos={photoSearch.results}
          onPhotoPress={handlePhotoPress}
        />
      ) : (
        <AlbumGrid
          {...grid}
          albums={albumSearch.results}
          onAlbumPress={onOpenAlbum}
        />
      );
    }
    return (
      <StatusView
        id="search"
        onRetry={retry}
        preferFocus={false}
        style={footerStyle}
        {...(error
          ? statusForError(error, t, text.loadFailed)
          : loading
          ? { kind: 'loading' as const, title: t('search.searching') }
          : {
              kind: 'empty' as const,
              title: text.emptyTitle,
              message: t('search.emptyMessage'),
            })}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: margins.top,
            paddingLeft: gutterLeft,
            paddingRight: gutterRight,
          },
        ]}
      >
        <BackButton id="search-back" onPress={onBack} />
        <Text style={styles.title} numberOfLines={1}>
          {text.title}
        </Text>
      </View>

      <View style={styles.body}>
        <View
          style={[
            styles.input,
            {
              marginStart: margins.start,
              paddingBottom: margins.bottom,
            },
          ]}
        >
          {/* What is typed is Latin, from the keyboard below */}
          <View style={[styles.queryBox, !!query && LTR]}>
            <Text
              style={[styles.query, !query && styles.placeholder]}
              numberOfLines={1}
            >
              {query || text.placeholder}
            </Text>
            <View style={styles.caret} />
          </View>
          {/* Coming back from the results lands on the last key used */}
          <FocusGroup>
            <OnScreenKeyboard
              onKey={handleKey}
              onSpace={handleSpace}
              onDelete={handleDelete}
              onClear={handleClear}
            />
          </FocusGroup>
        </View>

        {/* Coming back from the keyboard lands on the last result viewed */}
        <FocusGroup style={styles.results}>
          <ErrorBoundary id="search-results">{renderResults()}</ErrorBoundary>
        </FocusGroup>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 40,
    lineHeight: lineHeightFor(40),
    fontWeight: '700',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  input: {
    width: KEYBOARD_WIDTH,
    gap: spacing.md,
  },
  queryBox: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  query: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 22,
    lineHeight: lineHeightFor(22),
  },
  placeholder: {
    color: colors.textMuted,
  },
  caret: {
    width: 2,
    height: 28,
    marginStart: 2,
    backgroundColor: colors.focus,
  },
  results: {
    flex: 1,
  },
  hint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  hintTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: lineHeightFor(28),
    fontWeight: '600',
  },
  hintMessage: {
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    textAlign: 'center',
  },
});
