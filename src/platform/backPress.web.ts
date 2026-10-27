import type { DomKeyboardEvent } from './webDom';
import { domWindow, isTextInput } from './webDom';

// In a browser the keyboard stands in for the remote: Escape or Backspace is
// the back button
export function addBackPressListener(listener: () => boolean) {
  const onKeyDown = (event: DomKeyboardEvent) => {
    if (event.key !== 'Escape' && event.key !== 'Backspace') {
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

// The Escape key-down already went through the back handlers; the Modal's
// own Escape-on-key-up would be a second Back
export const modalRequestCloseIsBack = false;
