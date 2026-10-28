import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Album, Photo } from '../../api/types';
import { exitApp } from '../../platform/backPress';
import { addLinkListener, getInitialLink } from '../../platform/deepLink';
import { FocusScreen } from '../../ui-kit/focus/FocusScreen';
import { useFocusStore } from '../../ui-kit/focus/focusStore';
import { Dialog } from '../components/common/Dialog';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { photoCardFocusId } from '../components/photo/PhotoCard';
import { TextButton } from '../components/common/TextButton';
import { useBackHandler } from '../context/BackHandler';
import { useI18n } from '../hooks/useI18n';
import { colors, spacing } from '../theme';
import { AlbumScreen } from '../screens/AlbumScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AlbumLinkScreen, PhotoLinkScreen } from '../screens/LinkScreens';
import { PhotoViewerScreen } from '../screens/PhotoViewerScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SlideshowScreen } from '../screens/SlideshowScreen';
import { parseLink } from './deepLinks';

export type Route =
  | { name: 'home' }
  | { name: 'album'; album: Album }
  // Opened from a link, which carries only the id
  | { name: 'albumLink'; albumId: string }
  | { name: 'photoLink'; photoId: string }
  // With an album, searches its photos; without, searches albums
  | { name: 'search'; album?: Album }
  | { name: 'settings' }
  | { name: 'viewer'; photos: Photo[]; index: number }
  | { name: 'slideshow'; photos: Photo[]; index: number };

type StackEntry = { key: string; route: Route };

// One screen change at a time: a second press before the first settles
// (OK twice, Back twice, Back button then remote) is ignored rather than
// opening or closing a second screen
const NAVIGATION_COOLDOWN_MS = 400;

// A minimal stack navigator. Screens below the top stay mounted (hidden), so
// going back returns to Home with its rail scroll position and data intact.
export function Router() {
  const { t } = useI18n();
  const [stack, setStack] = useState<StackEntry[]>([
    { key: 'home', route: { name: 'home' } },
  ]);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);

  const lastNavigationAt = useRef(-Infinity);
  const claimNavigation = useCallback(() => {
    const now = Date.now();
    if (now - lastNavigationAt.current < NAVIGATION_COOLDOWN_MS) {
      return false;
    }
    lastNavigationAt.current = now;
    return true;
  }, []);

  // Every pushed screen gets a fresh key, so it starts with its own focus
  // memory rather than the one left by the screen popped before it
  const nextKey = useRef(0);
  const push = useCallback(
    (route: Route) => {
      if (!claimNavigation()) {
        return;
      }
      const key = `${route.name}-${++nextKey.current}`;
      setStack(prev => [...prev, { key, route }]);
    },
    [claimNavigation],
  );
  // A link opens its photo or album on top of whatever is showing, so Back
  // returns there (to Home, when the link launched the app). It skips the
  // cooldown: it isn't a key press that could be a double press.
  const openLink = useCallback((url: string | null) => {
    const target = url ? parseLink(url) : null;
    if (!target) {
      return;
    }
    const route: Route =
      target.kind === 'album'
        ? { name: 'albumLink', albumId: target.id }
        : { name: 'photoLink', photoId: target.id };
    const key = `${route.name}-${++nextKey.current}`;
    setExitConfirmVisible(false);
    setStack(prev => [...prev, { key, route }]);
  }, []);
  useEffect(() => {
    let mounted = true;
    getInitialLink().then(url => mounted && openLink(url));
    const removeListener = addLinkListener(openLink);
    return () => {
      mounted = false;
      removeListener();
    };
  }, [openLink]);

  const pop = useCallback(() => {
    if (!claimNavigation()) {
      return;
    }
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, [claimNavigation]);

  // Back never falls through to the OS: one screen back, or on Home the
  // exit confirmation. A playing slideshow or an open dialog registers its
  // own handler, which runs first.
  useBackHandler(() => {
    if (stack.length > 1) {
      pop();
    } else {
      setExitConfirmVisible(true);
    }
    return true;
  });

  const openAlbum = useCallback(
    (album: Album) => push({ name: 'album', album }),
    [push],
  );
  const openSearch = useCallback(
    (album?: Album) => push({ name: 'search', album }),
    [push],
  );
  const openSettings = useCallback(() => push({ name: 'settings' }), [push]);
  const openPhoto = useCallback(
    (photos: Photo[], index: number) => push({ name: 'viewer', photos, index }),
    [push],
  );
  const openSlideshow = useCallback(
    (photos: Photo[], index: number) =>
      push({ name: 'slideshow', photos, index }),
    [push],
  );

  return (
    <View style={styles.container}>
      {stack.map(({ key, route }, index) => {
        const active = index === stack.length - 1;
        // The viewer keeps the screen below it pointed at the photo on
        // screen, so Back lands on that photo rather than the one opened
        const below = stack[index - 1]?.key;
        const onPhotoChange = below
          ? (photo: Photo) =>
              useFocusStore
                .getState()
                .setReturnFocus(below, photoCardFocusId(photo.id))
          : undefined;
        return (
          <View key={key} style={[styles.screen, !active && styles.hidden]}>
            <FocusScreen screenKey={key} active={active}>
              {/* A crash stays inside its screen; Back still works */}
              <ErrorBoundary id={key}>
                {renderRoute(route, {
                  openAlbum,
                  openSearch,
                  openSettings,
                  openPhoto,
                  openSlideshow,
                  goBack: pop,
                  onPhotoChange,
                })}
              </ErrorBoundary>
              {index === 0 && (
                <Dialog
                  id="exit"
                  visible={exitConfirmVisible}
                  title={t('exit.title')}
                  onClose={() => setExitConfirmVisible(false)}
                >
                  <TextButton
                    id="exit-cancel"
                    label={t('exit.cancel')}
                    hasTVPreferredFocus
                    onPress={() => setExitConfirmVisible(false)}
                    style={styles.dialogButton}
                  />
                  <TextButton
                    id="exit-confirm"
                    label={t('exit.confirm')}
                    onPress={exitApp}
                    style={styles.dialogButton}
                  />
                </Dialog>
              )}
            </FocusScreen>
          </View>
        );
      })}
    </View>
  );
}

type Navigation = {
  openAlbum: (album: Album) => void;
  openSearch: (album?: Album) => void;
  openSettings: () => void;
  openPhoto: (photos: Photo[], index: number) => void;
  openSlideshow: (photos: Photo[], index: number) => void;
  goBack: () => void;
  onPhotoChange?: (photo: Photo) => void;
};

function renderRoute(route: Route, navigation: Navigation) {
  switch (route.name) {
    case 'home':
      return (
        <HomeScreen
          onOpenAlbum={navigation.openAlbum}
          onOpenSearch={() => navigation.openSearch()}
          onOpenSettings={navigation.openSettings}
        />
      );
    case 'album':
      return (
        <AlbumScreen
          album={route.album}
          onBack={navigation.goBack}
          onOpenPhoto={navigation.openPhoto}
          onPlaySlideshow={navigation.openSlideshow}
          onSearch={navigation.openSearch}
        />
      );
    case 'albumLink':
      return (
        <AlbumLinkScreen
          albumId={route.albumId}
          onBack={navigation.goBack}
          onOpenPhoto={navigation.openPhoto}
          onPlaySlideshow={navigation.openSlideshow}
          onSearch={navigation.openSearch}
        />
      );
    case 'photoLink':
      return (
        // No onPhotoChange: the screen below doesn't list this photo
        <PhotoLinkScreen
          photoId={route.photoId}
          onBack={navigation.goBack}
          onPlaySlideshow={navigation.openSlideshow}
        />
      );
    case 'search':
      return (
        <SearchScreen
          album={route.album}
          onBack={navigation.goBack}
          onOpenAlbum={navigation.openAlbum}
          onOpenPhoto={navigation.openPhoto}
        />
      );
    case 'settings':
      return <SettingsScreen onBack={navigation.goBack} />;
    case 'viewer':
      return (
        <PhotoViewerScreen
          photos={route.photos}
          initialIndex={route.index}
          onBack={navigation.goBack}
          onPlaySlideshow={navigation.openSlideshow}
          onPhotoChange={navigation.onPhotoChange}
        />
      );
    case 'slideshow':
      return (
        <SlideshowScreen
          photos={route.photos}
          initialIndex={route.index}
          onBack={navigation.goBack}
        />
      );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  // display: none also takes the hidden screen's items out of TV focus search
  hidden: {
    display: 'none',
  },
  // Darker than the dialog panel, so the choices read as buttons
  dialogButton: {
    minWidth: 160,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
});
