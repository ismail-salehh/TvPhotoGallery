import type { DomKeyboardEvent } from './webDom';
import { domWindow, isTextInput } from './webDom';

// The LG webOS remote's Back key (the app sets disableBackHistoryAPI)
const WEBOS_BACK = 461;
const BACK_KEYS = new Set(['Escape', 'Backspace', 'GoBack', 'BrowserBack']);

// The remote's Back, or Escape/Backspace where a keyboard stands in for it
export const isBackKey = (event: DomKeyboardEvent) =>
  BACK_KEYS.has(event.key) || event.keyCode === WEBOS_BACK;

export function addBackPressListener(listener: () => boolean) {
  const onKeyDown = (event: DomKeyboardEvent) => {
    if (!isBackKey(event)) {
      return;
    }
    if (isTextInput(event.target)) {
      return;
    }
    // Holding the key presses Back once, as on a remote
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    if (listener()) {
      event.preventDefault();
    }
  };
  domWindow.addEventListener('keydown', onKeyDown);
  return () => domWindow.removeEventListener('keydown', onKeyDown);
}

// The keyboard has no menu key to enable
export function setBackPressWanted(_wanted: boolean) {}

// The Back key-down already went through the back handlers; the Modal's
// own Escape-on-key-up would be a second Back
export const modalRequestCloseIsBack = false;

// react-native-web's BackHandler.exitApp does nothing; a webOS app closes
// its own window
export const exitApp = () => domWindow.close();
