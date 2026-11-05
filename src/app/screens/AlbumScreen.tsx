import { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useScreenMargins } from '../../ui-kit/layout/DesignCanvas';

import type { Album, Photo } from '../../api/types';
import { FocusGroup } from '../../ui-kit/focus/FocusGroup';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { BackButton } from '../components/common/BackButton';
import { TextButton } from '../components/common/TextButton';
import { PhotoGrid } from '../components/photo/PhotoGrid';
import { StatusView, statusForError } from '../components/common/StatusView';
import { useAlbumPhotos } from '../hooks/useAlbumPhotos';
import { useI18n } from '../hooks/useI18n';
import { colors, lineHeightFor, spacing } from '../theme';

type AlbumScreenProps = {
  // Passed from the card that opened it, so the header shows immediately
  album: Album;
  onBack: () => void;
  // Opens the viewer on `index` with every photo loaded so far
  onOpenPhoto?: (photos: Photo[], index: number) => void;
  onPlaySlideshow?: (photos: Photo[], index: number) => void;
  onSearch?: (album: Album) => void;
};

export function AlbumScreen({
  album,
  onBack,
  onOpenPhoto,
  onPlaySlideshow,
  onSearch,
}: AlbumScreenProps) {
  const { t } = useI18n();
  const margins = useScreenMargins();
  const gutterLeft = margins.left;
  const gutterRight = margins.right;

  const { photos, loading, error, loadMore, retry } = useAlbumPhotos(album.id);
  const footerStyle = { marginBottom: margins.bottom };

  // Read through a ref so the press handler stays stable while pages load,
  // which keeps the memoized cards from re-rendering
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      const list = photosRef.current;
      onOpenPhoto?.(list, list.indexOf(photo));
    },
    [onOpenPhoto],
  );

  return (
    <View style={styles.container}>
      {/* Up from the grid lands on the header button last used, and down
          from the header on the photo last focused (the grid's group) */}
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
        <BackButton id="album-back" onPress={onBack} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {album.title || t('album.untitled')}
          </Text>
          {!!album.description && (
            <Text style={styles.description} numberOfLines={2}>
              {album.description}
            </Text>
          )}
          <Text style={styles.meta}>
            {t('common.photoCount', { count: album.photoCount })}
          </Text>
        </View>
        {onSearch && (
          <TextButton
            id="album-search"
            label={t('album.search')}
            onPress={() => onSearch(album)}
          />
        )}
        {/* There from the start, so the header doesn't change when the
            photos arrive; it can be used once there is something to play */}
        {onPlaySlideshow && (
          <TextButton
            id="album-slideshow"
            label={t('album.slideshow')}
            disabled={photos.length === 0}
            onPress={() => onPlaySlideshow(photos, 0)}
          />
        )}
      </FocusGroup>

      <FocusGroup style={styles.content}>
        {photos.length > 0 ? (
          <ErrorBoundary id="album-grid">
            <PhotoGrid
              photos={photos}
              onPhotoPress={handlePhotoPress}
              onEndReached={loadMore}
              contentInset={gutterLeft}
              footer={
                // A later page failed: the loaded photos stay usable
                error ? (
                  <StatusView
                    id="album-more"
                    variant="inline"
                    {...statusForError(error, t, t('album.loadMoreFailed'))}
                    preferFocus={false}
                    onRetry={retry}
                    style={footerStyle}
                  />
                ) : loading ? (
                  <StatusView
                    id="album-more"
                    kind="loading"
                    variant="inline"
                    preferFocus={false}
                    onRetry={retry}
                    style={footerStyle}
                  />
                ) : undefined
              }
            />
          </ErrorBoundary>
        ) : (
          <StatusView
            id="album"
            onRetry={retry}
            style={footerStyle}
            {...(error
              ? statusForError(error, t, t('album.loadFailed'))
              : loading
              ? { kind: 'loading' as const, title: t('album.loading') }
              : {
                  // Unsplash+ collections report a photo count but list no
                  // photos to a free API key
                  kind: 'empty' as const,
                  title: t('album.emptyTitle'),
                  message: t('album.emptyMessage'),
                  // Nothing to retry: the useful action is leaving
                  retryLabel: t('common.back'),
                  onRetry: onBack,
                })}
          />
        )}
      </FocusGroup>
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
    paddingBottom: spacing.sm,
  },
  content: {
    flex: 1,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    lineHeight: lineHeightFor(40),
    fontWeight: '700',
  },
  description: {
    color: colors.text,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    maxWidth: '70%',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: lineHeightFor(18),
  },
});
