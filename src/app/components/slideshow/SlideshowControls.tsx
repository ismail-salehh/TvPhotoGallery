import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useScreenMargins } from '../../../ui-kit/layout/DesignCanvas';

import type { Photo } from '../../../api/types';
import { useI18n } from '../../hooks/useI18n';
import { colors, lineHeightFor, spacing } from '../../theme';
import { BackButton } from '../common/BackButton';
import { TextButton } from '../common/TextButton';

const FADE_MS = 300;
// A press this soon after the controls appeared is the press that revealed
// them: with a pointer, focusing the button (which reveals) precedes the click
const REVEAL_GRACE_MS = 300;

type SlideshowControlsProps = {
  photo: Photo;
  // e.g. "4 / 40"
  position: string;
  playing: boolean;
  intervalMs: number;
  visible: boolean;
  // Any focus or press: shows the controls and restarts their hide timer
  onInteract: () => void;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  // Opens the speed picker
  onOpenSpeedPicker: () => void;
  onBack: () => void;
};

// Overlay on top of the slides. It fades out rather than unmounting, so the
// buttons keep TV focus while hidden: the first D-pad move or press only
// brings the controls back, it never skips or pauses by accident.
export function SlideshowControls({
  photo,
  position,
  playing,
  intervalMs,
  visible,
  onInteract,
  onTogglePlay,
  onPrevious,
  onNext,
  onOpenSpeedPicker,
  onBack,
}: SlideshowControlsProps) {
  const { t, photoTitle } = useI18n();
  const margins = useScreenMargins();
  const gutterLeft = margins.left;
  const gutterRight = margins.right;

  const opacity = useRef(new Animated.Value(1)).current;
  const revealedAt = useRef(0);
  useEffect(() => {
    if (visible) {
      revealedAt.current = Date.now();
    }
  }, [visible]);
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  // While hidden a press only reveals; once visible it acts
  const act = (action: () => void) => () => {
    if (visible && Date.now() - revealedAt.current > REVEAL_GRACE_MS) {
      action();
    }
    onInteract();
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.top,
          {
            paddingTop: margins.top,
            paddingStart: margins.start,
          },
        ]}
      >
        <BackButton
          id="slideshow-back"
          onPress={act(onBack)}
          onFocus={onInteract}
        />
      </View>

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: margins.bottom,
            paddingLeft: gutterLeft,
            paddingRight: gutterRight,
          },
        ]}
      >
        <View style={styles.caption}>
          <Text style={styles.title} numberOfLines={1}>
            {photoTitle(photo)}
          </Text>
          {/* Unsplash requires crediting the photographer */}
          <Text style={styles.meta} numberOfLines={1}>
            {t('common.photoCredit', { name: photo.photographer })}
          </Text>
        </View>

        <View style={styles.buttons}>
          <TextButton
            id="slideshow-previous"
            label={t('slideshow.previous')}
            onPress={act(onPrevious)}
            onFocus={onInteract}
          />
          <TextButton
            id="slideshow-play"
            label={playing ? t('slideshow.pause') : t('slideshow.play')}
            hasTVPreferredFocus
            onPress={act(onTogglePlay)}
            onFocus={onInteract}
            style={styles.playButton}
          />
          <TextButton
            id="slideshow-next"
            label={t('slideshow.next')}
            onPress={act(onNext)}
            onFocus={onInteract}
          />
        </View>

        <View style={styles.side}>
          <TextButton
            id="slideshow-interval"
            label={t('slideshow.every', { seconds: intervalMs / 1000 })}
            onPress={act(onOpenSpeedPicker)}
            onFocus={onInteract}
          />
          <Text style={styles.position}>{position}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
    // Over the photo: readable whether it is bright or dark
    backgroundColor: colors.scrim,
  },
  // Caption and side column share the width equally, which keeps the
  // playback buttons centered on screen
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
    color: colors.textOnScrim,
    fontSize: 16,
    lineHeight: lineHeightFor(16),
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playButton: {
    minWidth: 120,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  position: {
    color: colors.textOnScrim,
    fontSize: 20,
    lineHeight: lineHeightFor(20),
    // Same-width digits, so "9 / 40" to "10 / 40" doesn't shift things
    fontVariant: ['tabular-nums'],
  },
});
