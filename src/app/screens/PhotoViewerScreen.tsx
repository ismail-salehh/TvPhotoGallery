import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useScreenMargins } from '../../ui-kit/layout/DesignCanvas';

import type { Photo } from '../../api/types';
import { isOnline } from '../../api/unsplash';
import { BackButton } from '../components/common/BackButton';
import { TextButton } from '../components/common/TextButton';
import { Filmstrip } from '../components/photo/Filmstrip';
import { StatusView } from '../components/common/StatusView';
import { useI18n } from '../hooks/useI18n';
import { colors, lineHeightFor, radius, spacing } from '../theme';

type ImageStatus = 'loading' | 'loaded' | 'error' | 'offline';

type PhotoViewerScreenProps = {
  photos: Photo[];
  initialIndex: number;
  onBack: () => void;
  onPlaySlideshow?: (photos: Photo[], index: number) => void;
  // Told the photo on screen whenever it changes
  onPhotoChange?: (photo: Photo) => void;
};

export function PhotoViewerScreen({
  photos,
  initialIndex,
  onBack,
  onPlaySlideshow,
  onPhotoChange,
}: PhotoViewerScreenProps) {
  const { t, photoTitle, formatDate } = useI18n();
  const margins = useScreenMargins();
  const gutterLeft = margins.left;
  const gutterRight = margins.right;

  const [index, setIndex] = useState(initialIndex);
  const [attempt, setAttempt] = useState(0);
  const photo = photos[index];

  const select = useCallback(
    (next: number) => setIndex(Math.min(Math.max(next, 0), photos.length - 1)),
    [photos.length],
  );

  const onPhotoChangeRef = useRef(onPhotoChange);
  useEffect(() => {
    onPhotoChangeRef.current = onPhotoChange;
  });
  useEffect(() => {
    if (photo) {
      onPhotoChangeRef.current?.(photo);
    }
  }, [photo]);

  // Warm the cache for the neighbours, so stepping either way is instant
  useEffect(() => {
    for (const neighbour of [photos[index - 1], photos[index + 1]]) {
      if (neighbour) {
        Image.prefetch(neighbour.imageUrl).catch(() => {});
      }
    }
  }, [photos, index]);

  // Full-size image state, tagged with the photo and attempt it belongs to,
  // so a late load/error event from a previous photo is ignored
  const imageKey = photo ? `${photo.id}:${attempt}` : '';
  const [image, setImage] = useState<{ key: string; status: ImageStatus }>({
    key: '',
    status: 'loading',
  });
  const imageStatus: ImageStatus =
    image.key === imageKey ? image.status : 'loading';

  const handleImageError = useCallback(async () => {
    const online = await isOnline();
    setImage({ key: imageKey, status: online ? 'error' : 'offline' });
  }, [imageKey]);

  const retryImage = useCallback(() => setAttempt(a => a + 1), []);

  // Only reachable if the screen is opened without a valid photo
  if (!photo) {
    return (
      <View style={styles.container}>
        <StatusView
          id="photo"
          kind="empty"
          title={t('photo.emptyTitle')}
          message={t('photo.emptyMessage')}
          retryLabel={t('common.back')}
          onRetry={onBack}
        />
      </View>
    );
  }

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
        <BackButton id="photo-back" onPress={onBack} />
        <View style={styles.caption}>
          <Text style={styles.title} numberOfLines={1}>
            {photoTitle(photo)}
          </Text>
          {/* Unsplash requires crediting the photographer */}
          <Text style={styles.meta} numberOfLines={1}>
            {t('common.photoCredit', { name: photo.photographer })}
            {!!photo.createdAt && ` · ${formatDate(photo.createdAt)}`}
          </Text>
        </View>
        <Text style={styles.position}>
          {t('common.position', { current: index + 1, total: photos.length })}
        </Text>
        {onPlaySlideshow && (
          <TextButton
            id="photo-slideshow"
            label={t('album.slideshow')}
            onPress={() => onPlaySlideshow(photos, index)}
          />
        )}
      </View>

      {/* The thumbnail is usually cached already, so it shows instantly
          and the full-size image sharpens it once loaded */}
      {/* Read as one image with its title by a screen reader */}
      <View
        style={styles.stage}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('a11y.photo', {
          title: photoTitle(photo),
          name: photo.photographer,
        })}
      >
        <Image
          source={{ uri: photo.thumbnailUrl }}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
        />
        {imageStatus === 'loading' || imageStatus === 'loaded' ? (
          <Image
            key={imageKey}
            source={{ uri: photo.imageUrl }}
            resizeMode="contain"
            style={StyleSheet.absoluteFill}
            onLoad={() => setImage({ key: imageKey, status: 'loaded' })}
            onError={handleImageError}
          />
        ) : (
          <StatusView
            id="photo"
            kind={imageStatus}
            title={imageStatus === 'error' ? t('photo.loadFailed') : undefined}
            onRetry={retryImage}
            // The filmstrip keeps focus, so the remote can still move on
            preferFocus={false}
            style={styles.stageStatus}
          />
        )}
        {imageStatus === 'loading' && (
          <View style={styles.loadingOverlay} pointerEvents="box-none">
            <StatusView
              id="photo-loading"
              kind="loading"
              variant="inline"
              onRetry={retryImage}
              preferFocus={false}
              style={styles.loadingPill}
            />
          </View>
        )}
      </View>

      <View style={[styles.bar, { paddingBottom: margins.bottom }]}>
        <Filmstrip photos={photos} index={index} onSelect={select} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  caption: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: lineHeightFor(24),
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: lineHeightFor(16),
  },
  position: {
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    // Same-width digits, so stepping from 9 to 10 doesn't shift the title
    fontVariant: ['tabular-nums'],
  },
  // Takes whatever height the header and filmstrip leave
  stage: {
    flex: 1,
  },
  // Covers the thumbnail, which may be the stale low-res of a broken image
  stageStatus: {
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingPill: {
    borderRadius: radius.md,
    backgroundColor: colors.scrim,
  },
  bar: {
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
});
