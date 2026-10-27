import { useEffect, useRef } from 'react';

import type {
  DomElement,
  DomFocusEvent,
  DomKeyboardEvent,
  Rect,
} from './webDom';
import { domDocument, domWindow, isTextInput } from './webDom';

// Makes the keyboard behave like a TV remote: arrows move focus to the
// nearest focusable in that direction, Enter presses it (react-native-web's
// Pressable already does that), and Escape/Backspace is back (backPress.web).
// Tab and Space are swallowed so there is exactly one way to move around.

// react-native-web renders every focusable Pressable with tabindex="0"
const FOCUSABLE_SELECTOR = '[tabindex="0"]';
// FocusGroup.web marks its view with this, standing in for TVFocusGuideView
const GROUP_SELECTOR = '[data-focus-group]';
// react-native-web's Modal; while one is open nothing outside it is reachable
const MODAL_SELECTOR = '[aria-modal="true"]';
// Lists that scroll their focused item into view themselves
// (useKeepFocusInView); the browser's own scrolling would fight them
const MANAGED_SCROLL_SELECTOR = '[data-managed-scroll]';
const HISTORY_SIZE = 50;
// Leaving a screen (back, or opening another) drops focus; give React a
// moment to show the next screen before putting it back
const RESTORE_DELAY_MS = 50;

// Larger than any on-screen distance
const OUT_OF_LINE_PENALTY = 100000;

type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// Most recently focused last. Screens below the top of the stack stay
// mounted (just hidden), so their last focused element is still here when
// the user comes back to them.
const history: DomElement[] = [];

function isVisible(element: DomElement) {
  if (!element.isConnected || element.offsetParent === null) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// The open modal (the last one, if they stack), or null
function openModal() {
  const modals = domDocument.querySelectorAll(MODAL_SELECTOR);
  return modals.length > 0 ? modals[modals.length - 1] : null;
}

// Whether the remote may reach `element`: anywhere, unless a modal is open
function isReachable(element: DomElement) {
  const modal = openModal();
  return !modal || modal.contains(element);
}

function visibleFocusables() {
  const scope = openModal() ?? domDocument;
  return Array.from(scope.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    isVisible,
  );
}

function isFocusIdle() {
  const active = domDocument.activeElement;
  return (
    !active ||
    active === domDocument.body ||
    !isVisible(active) ||
    !isReachable(active)
  );
}

function focusElement(element: DomElement) {
  element.focus({ preventScroll: true });
  if (!element.closest(MANAGED_SCROLL_SELECTOR)) {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

// The element focused most recently that the remote can still reach,
// optionally only among those inside `within`
function lastFocused(within?: DomElement) {
  for (let i = history.length - 1; i >= 0; i--) {
    const element = history[i];
    if (
      isVisible(element) &&
      isReachable(element) &&
      (!within || within.contains(element))
    ) {
      return element;
    }
  }
  return null;
}

// Back to where the user was on this screen, like the TV focus engine does
function restoreFocus() {
  const target = lastFocused() ?? visibleFocusables()[0];
  if (target) {
    focusElement(target);
  }
}

const center = (r: Rect) => ({
  x: r.left + r.width / 2,
  y: r.top + r.height / 2,
});

// Lower is better; null when `to` is not in that direction at all
function score(from: Rect, to: Rect, direction: Direction) {
  const a = center(from);
  const b = center(to);
  const horizontal = direction === 'left' || direction === 'right';

  const ahead =
    direction === 'right'
      ? b.x > a.x && to.left > from.left
      : direction === 'left'
      ? b.x < a.x && to.right < from.right
      : direction === 'down'
      ? b.y > a.y && to.top > from.top
      : b.y < a.y && to.bottom < from.bottom;
  if (!ahead) {
    return null;
  }

  // Gap along the direction of travel (0 when the boxes overlap)
  const along = Math.max(
    0,
    direction === 'right'
      ? to.left - from.right
      : direction === 'left'
      ? from.left - to.right
      : direction === 'down'
      ? to.top - from.bottom
      : from.top - to.bottom,
  );
  // Gap across it: 0 when the boxes share a row (or column)
  const across = horizontal
    ? Math.max(0, to.top - from.bottom, from.top - to.bottom)
    : Math.max(0, to.left - from.right, from.left - to.right);
  const offset = horizontal ? Math.abs(b.y - a.y) : Math.abs(b.x - a.x);

  if (across > 0) {
    // Not lined up with the current element. Left/right never leave the
    // row: at its end, pressing on does nothing rather than jumping
    // diagonally into another row.
    if (horizontal) {
      return null;
    }
    // Up/down may reach something off to the side (e.g. a header button
    // above a grid), but only if it is entirely past the edge
    const beyond =
      direction === 'down' ? to.top >= from.bottom : to.bottom <= from.top;
    if (!beyond) {
      return null;
    }
  }

  // Like the TV focus engines: anything lined up with the current element
  // (sharing its row or column) wins over anything that is not, however
  // close; among the rest, staying near the row/column matters most
  const outOfLine = across > 0 ? OUT_OF_LINE_PENALTY : 0;
  return outOfLine + along + across * 10 + offset * 0.1;
}

function move(direction: Direction) {
  const current = domDocument.activeElement;
  if (!current) {
    return;
  }
  const from = current.getBoundingClientRect();

  let best: DomElement | null = null;
  let bestScore = Infinity;
  for (const candidate of visibleFocusables()) {
    if (candidate === current) {
      continue;
    }
    const s = score(from, candidate.getBoundingClientRect(), direction);
    if (s !== null && s < bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  if (!best) {
    return;
  }

  // Entering a group from outside lands on the item last focused in it,
  // like TVFocusGuideView's autoFocus, rather than whichever item happens
  // to be nearest (e.g. coming down from the header onto the filmstrip)
  const group = best.closest(GROUP_SELECTOR);
  if (group && !group.contains(current)) {
    best = lastFocused(group) ?? best;
  }
  focusElement(best);
}

function onFocusIn(event: DomFocusEvent) {
  const element = event.target as DomElement;
  const existing = history.indexOf(element);
  if (existing !== -1) {
    history.splice(existing, 1);
  }
  history.push(element);
  if (history.length > HISTORY_SIZE) {
    history.shift();
  }
}

// `onNavigate` is told whenever the user moves focus with the arrows
export function useSpatialNavigation(onNavigate: () => void) {
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    const onKeyDown = (event: DomKeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const typing = isTextInput(event.target);
      const direction = DIRECTIONS[event.key];

      if (direction) {
        // Left/right move the caret inside a text field
        if (typing && (direction === 'left' || direction === 'right')) {
          return;
        }
        event.preventDefault();
        onNavigateRef.current();
        if (isFocusIdle()) {
          restoreFocus();
        } else {
          move(direction);
        }
      } else if (event.key === 'Tab') {
        event.preventDefault();
      } else if (event.key === ' ' && !typing) {
        // Space would otherwise press the focused button, like Enter
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === 'Enter' && event.repeat) {
        // Holding OK presses once, as on a remote
        event.preventDefault();
        event.stopPropagation();
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        setTimeout(() => {
          if (isFocusIdle()) {
            restoreFocus();
          }
        }, RESTORE_DELAY_MS);
      }
    };

    // Capture phase, so Tab/Space are stopped before anything else sees them
    domWindow.addEventListener('keydown', onKeyDown, true);
    domWindow.addEventListener('focusin', onFocusIn);
    return () => {
      domWindow.removeEventListener('keydown', onKeyDown, true);
      domWindow.removeEventListener('focusin', onFocusIn);
    };
  }, []);
}

// hasTVPreferredFocus on web. Focusable only asks while the screen is
// still settling (the user hasn't moved yet), as the TV focus engines do;
// an open modal keeps focus whatever happens behind it.
export function claimInitialFocus(node: unknown) {
  const element = node as DomElement | null;
  if (element && isReachable(element)) {
    element.focus({ preventScroll: true });
  }
}

export function focusNode(node: unknown) {
  const element = node as DomElement | null;
  if (element && isVisible(element) && isReachable(element)) {
    focusElement(element);
  }
}
