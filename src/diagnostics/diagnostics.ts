import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeviceDetails } from '../platform/deviceInfo';
import { REPORT_URL } from './config';

// What a failure on a TV nobody can touch needs: the app version, the
// device, and the keys pressed before it. Reports go to the log, stay on
// the device until sent, and go to REPORT_URL when one is set.

const STORAGE_KEY = 'diagnostics';
const MAX_KEYS = 30;
const MAX_FOCUS = 10;
const MAX_REPORTS = 5;
// The same key again within this long counts as one held/repeated press
const REPEAT_MS = 1000;
// Key presses reach storage at most this late, so a native crash or the
// OS killing the app still leaves them for the next launch's report
const SAVE_DELAY_MS = 1000;

export type KeyPress = { key: string; at: string; count: number };

export type ReportKind = 'fatal' | 'error' | 'contained' | 'unexpected-exit';

export type Report = {
  kind: ReportKind;
  at: string;
  app: string;
  device: string;
  system: string;
  message: string;
  stack: string;
  // The error boundary that contained it, if one did
  where: string;
  sessionStartedAt: string;
  // Oldest first
  keys: KeyPress[];
  focus: string[];
};

type Stored = {
  // `clean`: the session's end is accounted for (left the app, or a fatal
  // error already reported), so the next launch reports nothing for it
  session: { startedAt: string; clean: boolean } | null;
  keys: KeyPress[];
  focus: string[];
  reports: Report[];
};

const EMPTY: Stored = { session: null, keys: [], focus: [], reports: [] };

let state: Stored = EMPTY;
let device: DeviceDetails = { model: '', system: '', appVersion: '' };
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastKeyAt = 0;

function save() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(
    () => {},
  );
}

function saveSoon() {
  if (!saveTimer) {
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  }
}

export function recordKey(key: string, now = Date.now()) {
  const last = state.keys[state.keys.length - 1];
  if (last && last.key === key && now - lastKeyAt < REPEAT_MS) {
    last.count += 1;
  } else {
    state.keys = [
      ...state.keys,
      { key, at: new Date(now).toISOString(), count: 1 },
    ].slice(-MAX_KEYS);
  }
  lastKeyAt = now;
  saveSoon();
}

export function recordFocus(id: string) {
  if (state.focus[state.focus.length - 1] !== id) {
    state.focus = [...state.focus, id].slice(-MAX_FOCUS);
    saveSoon();
  }
}

function describe(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack ?? '' };
  }
  return { message: String(error), stack: '' };
}

function buildReport(
  kind: ReportKind,
  error: unknown,
  where: string,
  from: Stored,
  componentStack?: string | null,
): Report {
  const { message, stack } = describe(error);
  return {
    kind,
    at: new Date().toISOString(),
    app: device.appVersion,
    device: device.model,
    system: device.system,
    message,
    stack: componentStack ? `${stack}\nComponents:${componentStack}` : stack,
    where,
    sessionStartedAt: from.session?.startedAt ?? '',
    keys: from.keys,
    focus: from.focus,
  };
}

// One line, so a log search for "[report]" finds every report whole
function log(report: Report) {
  const line = `[report] ${JSON.stringify(report)}`;
  if (report.kind === 'contained') {
    console.warn(line);
  } else {
    console.error(line);
  }
}

// Sends what is waiting, oldest first; what fails stays for next time
async function send() {
  if (!REPORT_URL) {
    return;
  }
  for (const report of [...state.reports]) {
    try {
      const response = await fetch(REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (!response.ok) {
        return;
      }
    } catch {
      return;
    }
    state.reports = state.reports.filter(r => r !== report);
    await save();
  }
}

async function keep(report: Report) {
  log(report);
  state.reports = [...state.reports, report].slice(-MAX_REPORTS);
  await save();
  send();
}

export function reportError(
  error: unknown,
  kind: Exclude<ReportKind, 'unexpected-exit'>,
  where = '',
  // React's, for a crash an error boundary contained
  componentStack?: string | null,
) {
  const report = buildReport(kind, error, where, state, componentStack);
  if (kind === 'fatal' && state.session) {
    state.session = { ...state.session, clean: true };
  }
  return keep(report);
}

// Called once at launch. Reports the last session if it ended without
// going to the background first (native crash, freeze, OS kill).
export async function startDiagnostics(details: DeviceDetails) {
  device = details;
  let previous: Stored = EMPTY;
  try {
    previous = {
      ...EMPTY,
      ...JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}'),
    };
  } catch {}
  state = {
    session: { startedAt: new Date().toISOString(), clean: false },
    keys: [],
    focus: [],
    reports: Array.isArray(previous.reports) ? previous.reports : [],
  };
  console.log(
    `[app] TvPhotoGallery ${device.appVersion} on ${device.model}, ${device.system}`,
  );
  if (previous.session && !previous.session.clean) {
    await keep(
      buildReport(
        'unexpected-exit',
        new Error('The last session ended without leaving the app'),
        '',
        previous,
      ),
    );
  } else {
    await save();
    send();
  }
}

// In the foreground the session is open; leaving the app closes it cleanly
export function setSessionOpen(open: boolean) {
  if (state.session) {
    state.session = { ...state.session, clean: !open };
    save();
  }
}

// The state as it would be written, for tests and a support screen
export function diagnosticsSnapshot(): Readonly<Stored> {
  return state;
}
