import { BackHandler, Platform, TVEventControl } from 'react-native';

// The remote's back button (Android TV back, tvOS menu). The listener
// returns true when it handled the press. Web version: backPress.web.ts.
export function addBackPressListener(listener: () => boolean) {
  const subscription = BackHandler.addEventListener(
    'hardwareBackPress',
    listener,
  );
  return () => subscription.remove();
}

// On tvOS the menu key only reports presses while enabled, and an enabled
// menu key stops the app exiting: enable it only while someone listens
export function setBackPressWanted(wanted: boolean) {
  if (!Platform.isTV || Platform.OS !== 'ios') {
    return;
  }
  if (wanted) {
    TVEventControl.enableTVMenuKey();
  } else {
    TVEventControl.disableTVMenuKey();
  }
}

// A native Modal takes the back button itself and reports it through
// onRequestClose, which must then count as a back press
export const modalRequestCloseIsBack = true;

// Leaves the app (the exit dialog's Exit)
export const exitApp = () => BackHandler.exitApp();
