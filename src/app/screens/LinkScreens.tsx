import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Album, Photo } from '../../api/types';
import { isNotFound } from '../../api/unsplash';
import { StatusView, statusForError } from '../components/common/StatusView';
import { useAlbum } from '../hooks/useAlbum';
import { useI18n } from '../hooks/useI18n';
import { usePhoto } from '../hooks/usePhoto';
import { colors } from '../theme';
import { AlbumScreen } from './AlbumScreen';
import { PhotoViewerScreen } from './PhotoViewerScreen';

// Screens opened from a link, which carries only an id: they load the item
// (shown at once if cached) and then are the usual album or photo screen

type AlbumLinkScreenProps = {
  albumId: string;
  onBack: () => void;
  onOpenPhoto?: (photos: Photo[], index: number) => void;
  onPlaySlideshow?: (photos: Photo[], index: number) => void;
  onSearch?: (album: Album) => void;
};

export function AlbumLinkScreen({
  albumId,
  onBack,
  ...navigation
}: AlbumLinkScreenProps) {
  const { t } = useI18n();
  const { album, error, retry } = useAlbum(albumId);
  if (album) {
    return <AlbumScreen album={album} onBack={onBack} {...navigation} />;
  }
  return (
    <LinkStatus
      id="album-link"
      error={error}
      loadingTitle={t('album.opening')}
      failedTitle={t('album.openFailed')}
      missingTitle={t('album.missingTitle')}
      missingMessage={t('album.missingMessage')}
      onRetry={retry}
      onBack={onBack}
    />
  );
}

type PhotoLinkScreenProps = {
  photoId: string;
  onBack: () => void;
  onPlaySlideshow?: (photos: Photo[], index: number) => void;
  onPhotoChange?: (photo: Photo) => void;
};

export function PhotoLinkScreen({
  photoId,
  onBack,
  ...navigation
}: PhotoLinkScreenProps) {
  const { t } = useI18n();
  const { photo, error, retry } = usePhoto(photoId);
  // The viewer restarts its effects when given a new list
  const photos = useMemo(() => (photo ? [photo] : []), [photo]);
  if (photo) {
    return (
      <PhotoViewerScreen
        photos={photos}
        initialIndex={0}
        onBack={onBack}
        {...navigation}
      />
    );
  }
  return (
    <LinkStatus
      id="photo-link"
      error={error}
      loadingTitle={t('photo.loading')}
      failedTitle={t('photo.loadFailed')}
      missingTitle={t('photo.emptyTitle')}
      missingMessage={t('photo.emptyMessage')}
      onRetry={retry}
      onBack={onBack}
    />
  );
}

type LinkStatusProps = {
  id: string;
  error: Error | null;
  loadingTitle: string;
  failedTitle: string;
  missingTitle: string;
  missingMessage: string;
  onRetry: () => void;
  onBack: () => void;
};

// Loading, failed (retry), or gone (only Back can help)
function LinkStatus({
  id,
  error,
  loadingTitle,
  failedTitle,
  missingTitle,
  missingMessage,
  onRetry,
  onBack,
}: LinkStatusProps): ReactElement {
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <StatusView
        id={id}
        onRetry={onRetry}
        {...(!error
          ? { kind: 'loading' as const, title: loadingTitle }
          : isNotFound(error)
          ? {
              kind: 'empty' as const,
              title: missingTitle,
              message: missingMessage,
              retryLabel: t('common.back'),
              onRetry: onBack,
            }
          : statusForError(error, t, failedTitle))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
