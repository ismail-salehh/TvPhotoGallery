import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useScreenMargins } from '../../ui-kit/layout/DesignCanvas';

import type { Album } from '../../api/types';
import { FocusGroup } from '../../ui-kit/focus/FocusGroup';
import { AlbumRails, RAILS_HEIGHT } from '../components/album/AlbumRails';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AppBrand } from '../components/common/AppBrand';
import { FeaturedHero } from '../components/album/FeaturedHero';
import { SearchBar } from '../components/search/SearchBar';
import { StatusView, statusForError } from '../components/common/StatusView';
import { TextButton } from '../components/common/TextButton';
import { useAlbums } from '../hooks/useAlbums';
import { useI18n } from '../hooks/useI18n';
import { colors, spacing } from '../theme';

type HomeScreenProps = {
  onOpenSearch?: () => void;
  onOpenAlbum?: (album: Album) => void;
  onOpenSettings?: () => void;
};

export function HomeScreen({
  onOpenSearch,
  onOpenAlbum,
  onOpenSettings,
}: HomeScreenProps) {
  const { t } = useI18n();
  const margins = useScreenMargins();
  const gutterLeft = margins.left;
  const gutterRight = margins.right;

  const { albums, loading, error, loadMore, retry } = useAlbums();

  const [focusedAlbumId, setFocusedAlbumId] = useState<string | null>(null);
  const featuredAlbum =
    albums.find(album => album.id === focusedAlbumId) ?? albums[0] ?? null;

  // Stable callbacks keep the memoized rail and cards from re-rendering
  // when the featured album changes
  const handleAlbumFocus = useCallback((album: Album) => {
    setFocusedAlbumId(album.id);
  }, []);
  const handleAlbumPress = useCallback(
    (album: Album) => onOpenAlbum?.(album),
    [onOpenAlbum],
  );

  return (
    <View style={styles.container}>
      <FocusGroup
        style={[
          styles.header,
          {
            paddingTop: margins.top,
            paddingLeft: gutterLeft,
            paddingRight: gutterRight,
          },
        ]}
      >
        <AppBrand style={styles.brand} />
        <SearchBar style={styles.search} onPress={onOpenSearch} />
        <TextButton
          id="home-settings"
          label={t('home.settings')}
          onPress={() => onOpenSettings?.()}
          style={styles.settings}
        />
      </FocusGroup>

      {albums.length > 0 ? (
        <>
          <ErrorBoundary id="home-hero" style={styles.hero}>
            <FeaturedHero
              album={featuredAlbum}
              contentInset={gutterLeft}
              style={styles.hero}
            />
          </ErrorBoundary>

          {/* Runs to the bottom edge: the rail below the focused one is
              what sits in the overscan */}
          <View style={styles.rails}>
            <ErrorBoundary id="home-rail" variant="inline">
              <AlbumRails
                albums={albums}
                onAlbumFocus={handleAlbumFocus}
                onAlbumPress={handleAlbumPress}
                onEndReached={loadMore}
                footer={
                  // A later page failed: the loaded albums stay usable
                  error ? (
                    <StatusView
                      id="home-more"
                      variant="inline"
                      {...statusForError(error, t, t('home.loadMoreFailed'))}
                      preferFocus={false}
                      onRetry={retry}
                    />
                  ) : loading ? (
                    <StatusView
                      id="home-more"
                      kind="loading"
                      variant="inline"
                      preferFocus={false}
                      onRetry={retry}
                    />
                  ) : undefined
                }
              />
            </ErrorBoundary>
          </View>
        </>
      ) : (
        <StatusView
          id="home"
          onRetry={retry}
          style={{ paddingBottom: margins.bottom }}
          {...(error
            ? statusForError(error, t, t('home.loadFailed'))
            : loading
            ? { kind: 'loading' as const, title: t('home.loading') }
            : {
                kind: 'empty' as const,
                title: t('home.emptyTitle'),
                message: t('home.emptyMessage'),
              })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Exactly one screen tall; only the rails scroll vertically
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  // flex 1 : 5 splits the width left after the gap, so brand = 1/6
  brand: {
    flex: 1,
  },
  search: {
    flex: 5,
  },
  // Same height as the search bar beside it
  settings: {
    height: 56,
    justifyContent: 'center',
  },
  // Takes whatever height the header and rails leave, edge to edge
  hero: {
    flex: 1,
    marginBottom: spacing.md,
  },
  rails: {
    height: RAILS_HEIGHT,
  },
});
