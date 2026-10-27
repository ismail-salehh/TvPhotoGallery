import type { DomKeyboardEvent } from './webDom';
import { domWindow } from './webDom';

// The keyboard keys that stand in for the remote, by the remote's names
const NAMES: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  ' ': 'space',
};

// Escape and Backspace (Back) are recorded by BackHandlerProvider. Typed
// characters are logged as "char", never as what was typed.
export function addKeyListener(listener: (key: string) => void) {
  const onKeyDown = (event: DomKeyboardEvent) => {
    const name =
      NAMES[event.key] ?? (event.key.length === 1 ? 'char' : undefined);
    if (name && !event.repeat) {
      listener(name);
    }
  };
  domWindow.addEventListener('keydown', onKeyDown, true);
  return () => domWindow.removeEventListener('keydown', onKeyDown, true);
}
