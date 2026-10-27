import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Album } from '../../../api/types';
import { Focusable } from '../../../ui-kit/focus/Focusable';
import { useI18n } from '../../hooks/useI18n';
import { PhotoImage } from '../common/PhotoImage';
import { colors, radius, spacing } from '../../theme';

export const ALBUM_CARD_WIDTH = 320;
const imageHeight = (width: number) => (width * 9) / 16;
const FRAME_BORDER = 3;
// Fixed, so every card is the same height whatever its title: long ones
// are cut to one line, and an empty one still takes its line
const TITLE_LINE_HEIGHT = 26;
const COUNT_LINE_HEIGHT = 22;

// Exact, so a grid or a list of rails can place rows without measuring
export const albumCardHeight = (width: number) =>
  imageHeight(width) +
  FRAME_BORDER * 2 +
  spacing.xs * 2 +
  TITLE_LINE_HEIGHT +
  COUNT_LINE_HEIGHT;

type AlbumCardProps = {
  album: Album;
  width?: number;
  onFocus?: (album: Album) => void;
  onPress?: (album: Album) => void;
  hasTVPreferredFocus?: boolean;
};

const ALBUM_CARD_PREFIX = 'album-card-';
export const albumCardFocusId = (albumId: string) =>
  `${ALBUM_CARD_PREFIX}${albumId}`;
export const isAlbumCardFocusId = (id: string) =>
  id.startsWith(ALBUM_CARD_PREFIX);

// Focus state lives in the card, so moving along the rail only re-renders
// the two cards involved
export const AlbumCard = memo(function AlbumCardView({
  album,
  width = ALBUM_CARD_WIDTH,
  onFocus,
  onPress,
  hasTVPreferredFocus,
}: AlbumCardProps) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const title = album.title || t('album.untitled');

  return (
    <Focusable
      id={albumCardFocusId(album.id)}
      accessibilityLabel={`${title}, ${t('common.photoCount', {
        count: album.photoCount,
      })}`}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => {
        setFocused(true);
        onFocus?.(album);
      }}
      onBlur={() => setFocused(false)}
      onPress={() => onPress?.(album)}
      style={[styles.card, { width }, focused && styles.cardFocused]}
    >
      <View style={[styles.imageFrame, focused && styles.imageFrameFocused]}>
        {album.coverPhoto ? (
          <PhotoImage
            uri={album.coverPhoto.thumbnailUrl}
            style={[styles.image, { height: imageHeight(width) }]}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.imagePlaceholder,
              { height: imageHeight(width) },
            ]}
          />
        )}
      </View>
      <Text
        style={[styles.title, focused && styles.titleFocused]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text style={styles.count} numberOfLines={1}>
        {t('common.photoCount', { count: album.photoCount })}
      </Text>
    </Focusable>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  cardFocused: {
    transform: [{ scale: 1.05 }],
  },
  imageFrame: {
    borderRadius: radius.md,
    borderWidth: FRAME_BORDER,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  imageFrameFocused: {
    borderColor: colors.focus,
  },
  image: {
    width: '100%',
  },
  imagePlaceholder: {
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: TITLE_LINE_HEIGHT,
    height: TITLE_LINE_HEIGHT,
  },
  titleFocused: {
    color: colors.text,
  },
  count: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: COUNT_LINE_HEIGHT,
    height: COUNT_LINE_HEIGHT,
  },
});
