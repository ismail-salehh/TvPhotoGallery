// The project's TypeScript config has no DOM lib (it targets native), so the
// web-only modules type just the browser APIs they use. Import this only
// from *.web.ts files.

export type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type DomElement = {
  tagName: string;
  isConnected: boolean;
  isContentEditable: boolean;
  // null when the element or an ancestor is display: none
  offsetParent: unknown;
  getBoundingClientRect: () => Rect;
  focus: (options?: { preventScroll?: boolean }) => void;
  scrollIntoView: (options?: { block?: string; inline?: string }) => void;
  contains: (other: unknown) => boolean;
  closest: (selector: string) => DomElement | null;
  querySelectorAll: (selector: string) => ArrayLike<DomElement>;
};

export type DomKeyboardEvent = {
  key: string;
  // Legacy code; TV remotes' own keys are often only identified by it
  keyCode?: number;
  // True for the automatic repeats while a key is held down
  repeat: boolean;
  target: unknown;
  defaultPrevented: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export type DomFocusEvent = {
  target: unknown;
};

type DomListen = <E>(
  type: string,
  listener: (event: E) => void,
  capture?: boolean,
) => void;

type DomDocument = {
  activeElement: DomElement | null;
  body: DomElement;
  documentElement: { lang: string; dir: string };
  querySelectorAll: (selector: string) => ArrayLike<DomElement>;
  addEventListener: DomListen;
  removeEventListener: DomListen;
};

type DomWindow = {
  close: () => void;
  location: { hash: string; href: string; pathname: string; search: string };
  history: { replaceState: (state: null, title: string, url: string) => void };
  addEventListener: <E>(
    type: string,
    listener: (event: E) => void,
    capture?: boolean,
  ) => void;
  removeEventListener: <E>(
    type: string,
    listener: (event: E) => void,
    capture?: boolean,
  ) => void;
};

export const domDocument = (globalThis as unknown as { document: DomDocument })
  .document;
export const domWindow = globalThis as unknown as DomWindow;

// Keys typed into a text field belong to the field, not to navigation
export function isTextInput(target: unknown) {
  const element = target as Partial<DomElement> | null;
  return (
    !!element &&
    (element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.isContentEditable === true)
  );
}
