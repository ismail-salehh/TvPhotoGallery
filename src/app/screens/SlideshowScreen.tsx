import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, StyleSheet, View } from 'react-native';

import type { Photo } from '../../api/types';
import { isOnline } from '../../api/unsplash';
import { useKeepAwake } from '../../platform/keepAwake';
import { useFocusScreenActive } from '../../ui-kit/focus/FocusScreen';
import { Dialog } from '../components/common/Dialog';
import { RadioOption } from '../components/common/RadioOption';
import { SlideshowControls } from '../components/slideshow/SlideshowControls';
import { StatusView } from '../components/common/StatusView';
import { useAnyKeyPress } from '../hooks/useAnyKeyPress';
import { useBackHandler } from '../context/BackHandler';
import { useI18n } from '../hooks/useI18n';
import { SLIDESHOW_INTERVALS_MS, useSettings } from '../context/Settings';
import { colors, radius } from '../theme';

const CROSSFADE_MS = 800;
const CONTROLS_HIDE_MS = 4000;
// The loading indicator only appears when a slide is noticeably late
const SLOW_SLIDE_MS = 1500;
// Broken photos are skipped; this many in a row means something is wrong
const MAX_FAILURES_IN_A_ROW = 3;

type Status = 'playing' | 'error' | 'offline';

type SlideshowScreenProps = {
  photos: Photo[];
  initialIndex: number;
  onBack: () => void;
};

export function SlideshowScreen({
  photos,
  initialIndex,
  onBack,
}: SlideshowScreenProps) {
  const { t } = useI18n();
  const count = photos.length;
  const [index, setIndex] = useState(
    initialIndex >= 0 && initialIndex < count ? initialIndex : 0,
  );
  const [playing, setPlaying] = useState(true);
  // Starts at the speed chosen in Settings; changing it here only lasts for
  // this slideshow
  const { slideshowIntervalMs } = useSettings().settings;
  const [intervalMs, setIntervalMs] = useState(slideshowIntervalMs);
  const [status, setStatus] = useState<Status>('playing');
  const failuresInARow = useRef(0);

  // Same layering as the home hero: the shown slide stays until the target
  // has loaded and faded in on top of it, so there is never an empty frame
  const target = photos[index];
  const [shown, setShown] = useState<Photo | null>(null);
  const incoming =
    target && target.id !== shown?.id && status === 'playing' ? target : null;
  const layers = [shown, incoming].filter((p): p is Photo => p !== null);

  // Bumping a photo's count reloads it with a cache-busting URL, without
  // remounting the layer (which would restart its fade)
  const [reloads, setReloads] = useState<Record<string, number>>({});

  const step = useCallback(
    (delta: number) => setIndex(i => (i + delta + count) % count),
    [count],
  );

  // Auto-advance once the current slide is fully on screen
  useEffect(() => {
    if (!playing || status !== 'playing' || count < 2) {
      return;
    }
    if (!shown || shown.id !== target?.id) {
      return;
    }
    const timer = setTimeout(() => step(1), intervalMs);
    return () => clearTimeout(timer);
  }, [playing, status, count, shown, target, intervalMs, step]);

  // Load the next slide while this one is on screen
  useEffect(() => {
    const next = photos[(index + 1) % count];
    if (next && count > 1) {
      Image.prefetch(next.imageUrl).catch(() => {});
    }
  }, [photos, index, count]);

  const handleShown = useCallback((photo: Photo) => {
    failuresInARow.current = 0;
    setShown(photo);
  }, []);

  const handleError = useCallback(
    async (photo: Photo) => {
      if (!(await isOnline())) {
        setStatus('offline');
        setPlaying(false);
        return;
      }
      failuresInARow.current += 1;
      if (failuresInARow.current >= Math.min(MAX_FAILURES_IN_A_ROW, count)) {
        setStatus('error');
        setPlaying(false);
      } else if (photo.id === photos[index]?.id) {
        step(1);
      }
    },
    [count, index, photos, step],
  );

  const retry = useCallback(() => {
    failuresInARow.current = 0;
    if (target) {
      setReloads(r => ({ ...r, [target.id]: (r[target.id] ?? 0) + 1 }));
    }
    setStatus('playing');
    setPlaying(true);
  }, [target]);

  const slow = useDelayedFlag(incoming !== null, SLOW_SLIDE_MS, incoming?.id);

  const [speedPickerVisible, setSpeedPickerVisible] = useState(false);

  // Controls hide after a while, but only while the slides are moving and
  // nothing is open on top of them
  const [controlsVisible, setControlsVisible] = useState(true);
  const [interaction, setInteraction] = useState(0);
  const showControls = useCallback(() => {
    setControlsVisible(true);
    setInteraction(n => n + 1);
  }, []);
  useEffect(() => {
    if (
      !controlsVisible ||
      !playing ||
      status !== 'playing' ||
      speedPickerVisible
    ) {
      return;
    }
    const timer = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(timer);
  }, [controlsVisible, playing, status, interaction, speedPickerVisible]);

  // Any key brings the controls back, even one that moves nothing
  useAnyKeyPress(showControls);

  // Nobody touches the remote during a slideshow: keep the TV awake
  useKeepAwake(playing && status === 'playing');

  // Leaving for Home or standby pauses it; back in the app, the controls
  // show it paused and focus is where it was
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        setPlaying(false);
        setControlsVisible(true);
      }
    });
    return () => subscription.remove();
  }, []);

  // The first Back stops the slideshow where it is; the next one leaves
  const active = useFocusScreenActive();
  useBackHandler(() => {
    setPlaying(false);
    showControls();
    return true;
  }, active && playing && status === 'playing');

  const closeSpeedPicker = useCallback(() => {
    setSpeedPickerVisible(false);
    showControls();
  }, [showControls]);

  if (!target) {
    return (
      <View style={styles.container}>
        <StatusView
          id="slideshow"
          kind="empty"
          title={t('slideshow.emptyTitle')}
          message={t('slideshow.emptyMessage')}
          retryLabel={t('common.back')}
          onRetry={onBack}
        />
      </View>
    );
  }

  // Caption follows what is actually on screen, not the slide still loading
  const current = shown ?? target;
  const currentIndex = photos.indexOf(current);

  return (
    <View style={styles.container}>
      {layers.map(photo => (
        <SlideLayer
          key={photo.id}
          photo={photo}
          reload={reloads[photo.id] ?? 0}
          onShown={handleShown}
          onError={handleError}
        />
      ))}

      {(slow || !shown) && status === 'playing' && (
        <View style={styles.loadingOverlay} pointerEvents="box-none">
          <StatusView
            id="slideshow-loading"
            kind="loading"
            variant="inline"
            preferFocus={false}
            onRetry={retry}
            style={styles.loadingPill}
          />
        </View>
      )}

      {status !== 'playing' && (
        <StatusView
          id="slideshow"
          kind={status}
          title={status === 'error' ? t('slideshow.loadFailed') : undefined}
          onRetry={retry}
          style={styles.statusOverlay}
        />
      )}

      <SlideshowControls
        photo={current}
        position={t('common.position', {
          current: currentIndex + 1,
          total: count,
        })}
        playing={playing}
        intervalMs={intervalMs}
        visible={controlsVisible || status !== 'playing' || speedPickerVisible}
        onInteract={showControls}
        onTogglePlay={() => setPlaying(p => !p)}
        onPrevious={() => step(-1)}
        onNext={() => step(1)}
        onOpenSpeedPicker={() => setSpeedPickerVisible(true)}
        onBack={onBack}
      />

      <Dialog
        id="speed"
        visible={speedPickerVisible}
        title={t('slideshow.speedTitle')}
        onClose={closeSpeedPicker}
      >
        {SLIDESHOW_INTERVALS_MS.map(ms => (
          <RadioOption
            key={ms}
            id={`slideshow-speed-${ms}`}
            label={t('settings.seconds', { count: ms / 1000 })}
            selected={intervalMs === ms}
            // Opens on the current speed
            preferFocus={intervalMs === ms}
            onPress={() => {
              setIntervalMs(ms);
              closeSpeedPicker();
            }}
          />
        ))}
      </Dialog>
    </View>
  );
}

type SlideLayerProps = {
  photo: Photo;
  reload: number;
  onShown: (photo: Photo) => void;
  onError: (photo: Photo) => void;
};

// One slide. It fades in once loaded and is promoted to "shown" when the
// fade completes; its black background hides the previous slide entirely,
// even where the new photo's shape leaves letterbox bars
function SlideLayer({ photo, reload, onShown, onError }: SlideLayerProps) {
  const { t, photoTitle } = useI18n();
  const opacity = useRef(new Animated.Value(0)).current;

  // Unmounted before finishing (user skipped ahead) → stop, and the
  // `finished: false` callback below won't promote it
  useEffect(() => () => opacity.stopAnimation(), [opacity]);

  const uri = reload ? `${photo.imageUrl}&reload=${reload}` : photo.imageUrl;

  return (
    <Animated.Image
      source={{ uri }}
      accessibilityLabel={t('a11y.photo', {
        title: photoTitle(photo),
        name: photo.photographer,
      })}
      resizeMode="contain"
      style={[StyleSheet.absoluteFill, styles.slide, { opacity }]}
      onLoad={() => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            onShown(photo);
          }
        });
      }}
      onError={() => onError(photo)}
    />
  );
}

// True once `active` has stayed true for `delayMs`; restarts when `key`
// changes
function useDelayedFlag(active: boolean, delayMs: number, key?: string) {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    setFlag(false);
    if (!active) {
      return;
    }
    const timer = setTimeout(() => setFlag(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs, key]);
  return flag;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  slide: {
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
  statusOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
  },
});
