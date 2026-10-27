import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { Album, Photo } from '../../../api/types';
import { useI18n } from '../../hooks/useI18n';
import { colors, spacing } from '../../theme';

const FADE_MS = 180;
// The hero changes only once focus has rested on an album this long: the
// albums passed on the way are never downloaded or decoded, which is what
// low-end TVs can't keep up with
const SETTLE_MS = 500;
const DESCRIPTION_LINE_HEIGHT = 28;

type FeaturedHeroProps = {
  album: Album | null;
  // Horizontal padding for the text so it lines up with the rest of the page
  contentInset: number;
  style?: StyleProp<ViewStyle>;
};

// Shows the focused album's cover. Images are stacked layers keyed by photo
// id: the current one stays on screen until the newest target has loaded
// and faded in on top, so fast focus changes never flash an empty frame —
// targets that get skipped before loading are simply dropped.
export function FeaturedHero({
  album: focusedAlbum,
  contentInset,
  style,
}: FeaturedHeroProps) {
  const { t } = useI18n();
  // Caption and photo both follow this, so they always match
  const album = useSettled(focusedAlbum, SETTLE_MS);
  const target = album?.coverPhoto ?? null;
  const [shown, setShown] = useState<Photo | null>(null);
  const incoming = target && target.id !== shown?.id ? target : null;

  const layers = [shown, incoming].filter((p): p is Photo => p !== null);

  return (
    <View style={[styles.container, style]}>
      {layers.map(photo => (
        <HeroLayer
          key={photo.id}
          photo={photo}
          onShown={() => setShown(photo)}
        />
      ))}

      {album && (
        <View style={[styles.caption, { paddingHorizontal: contentInset }]}>
          <Text style={styles.title} numberOfLines={1}>
            {album.title || t('album.untitled')}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {t('common.photoCount', { count: album.photoCount })}
            {target &&
              ` · ${t('common.photoCredit', { name: target.photographer })}`}
          </Text>
          {/* Always two lines tall, so the caption keeps its height as
              focus moves between albums with and without a description;
              last, so a missing one just leaves space at the bottom */}
          <Text style={styles.description} numberOfLines={2}>
            {album.description}
          </Text>
        </View>
      )}
    </View>
  );
}

// `value` once it has stayed the same for `settleMs`. The first value that
// isn't null passes at once, so the screen doesn't open empty.
export function useSettled<T>(value: T, settleMs: number) {
  const [settled, setSettled] = useState(value);
  const waiting = settled !== null && value !== settled;
  useEffect(() => {
    if (!waiting) {
      setSettled(value);
      return;
    }
    const timer = setTimeout(() => setSettled(value), settleMs);
    return () => clearTimeout(timer);
  }, [value, settleMs, waiting]);
  return settled;
}

type HeroLayerProps = {
  photo: Photo;
  onShown: () => void;
};

// The same layer instance goes from "incoming" to "shown", so it keeps its
// opacity and never remounts once it is visible
function HeroLayer({ photo, onShown }: HeroLayerProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  // Unmounted before finishing (focus moved on) → stop, and the
  // `finished: false` callback below won't promote it
  useEffect(() => () => opacity.stopAnimation(), [opacity]);

  return (
    <Animated.Image
      source={{ uri: photo.imageUrl }}
      resizeMode="cover"
      style={[StyleSheet.absoluteFill, { opacity }]}
      onLoad={() => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            onShown();
          }
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'flex-end',
  },
  caption: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    // Over the photo: readable whether it is bright or dark
    backgroundColor: colors.scrim,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
    height: 48,
  },
  description: {
    color: colors.text,
    fontSize: 20,
    lineHeight: DESCRIPTION_LINE_HEIGHT,
    height: DESCRIPTION_LINE_HEIGHT * 2,
    maxWidth: '60%',
  },
  meta: {
    color: colors.textOnScrim,
    fontSize: 18,
    lineHeight: 24,
    height: 24,
  },
});
