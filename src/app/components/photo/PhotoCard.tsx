import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Photo } from '../../../api/types';
import { Focusable } from '../../../ui-kit/focus/Focusable';
import { useI18n } from '../../hooks/useI18n';
import { PhotoImage } from '../common/PhotoImage';
import { colors, radius, spacing } from '../../theme';

type PhotoCardProps = {
  photo: Photo;
  width: number;
  onPress?: (photo: Photo) => void;
  onFocus?: (photo: Photo) => void;
  hasTVPreferredFocus?: boolean;
};

// Focus state lives in the card, so moving around the grid only re-renders
// the two cards involved
export const PhotoCard = memo(function PhotoCardView({
  photo,
  width,
  onPress,
  onFocus,
  hasTVPreferredFocus,
}: PhotoCardProps) {
  const { t, photoTitle } = useI18n();
  const [focused, setFocused] = useState(false);

  return (
    <Focusable
      id={photoCardFocusId(photo.id)}
      accessibilityLabel={t('a11y.photo', {
        title: photoTitle(photo),
        name: photo.photographer,
      })}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => {
        setFocused(true);
        onFocus?.(photo);
      }}
      onBlur={() => setFocused(false)}
      onPress={() => onPress?.(photo)}
      style={[styles.card, { width }, focused && styles.cardFocused]}
    >
      <View style={[styles.imageFrame, focused && styles.imageFrameFocused]}>
        <PhotoImage
          uri={photo.thumbnailUrl}
          style={[styles.image, { height: photoCardImageHeight(width) }]}
        />
      </View>
      {/* Unsplash requires crediting the photographer */}
      <Text
        style={[styles.credit, focused && styles.creditFocused]}
        numberOfLines={1}
      >
        {photo.photographer}
      </Text>
    </Focusable>
  );
});

// Lets the viewer point the screen behind it at the photo last viewed
const PHOTO_CARD_PREFIX = 'photo-card-';
export const photoCardFocusId = (photoId: string) =>
  `${PHOTO_CARD_PREFIX}${photoId}`;
export const isPhotoCardFocusId = (id: string) =>
  id.startsWith(PHOTO_CARD_PREFIX);

// Thumbnails are cropped to 16:9 so rows line up regardless of orientation
export const photoCardImageHeight = (width: number) => (width * 9) / 16;

const FRAME_BORDER = 3;
const CREDIT_LINE_HEIGHT = 22;

// Every card of a given width is exactly this tall (the credit is always
// one line), so a grid can place its rows without measuring them
export const photoCardHeight = (width: number) =>
  photoCardImageHeight(width) +
  FRAME_BORDER * 2 +
  spacing.xs +
  CREDIT_LINE_HEIGHT;

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
    backgroundColor: colors.surface,
  },
  imageFrameFocused: {
    borderColor: colors.focus,
  },
  image: {
    width: '100%',
  },
  credit: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: CREDIT_LINE_HEIGHT,
    height: CREDIT_LINE_HEIGHT,
  },
  creditFocused: {
    color: colors.text,
  },
});
