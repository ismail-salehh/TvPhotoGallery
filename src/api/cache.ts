import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '../i18n';
import { LANGUAGES } from '../i18n';

// What was last fetched, kept on the device so a screen opened before shows
// it at once while it refreshes. Every entry belongs to one UI language and
// is never read under another.

const STORAGE_KEY = 'responseCache';
// Bump when a cached shape changes: entries saved under another version
// are dropped rather than read as the new shape
const VERSION = 1;
// Least recently used entries go first; ~20 KB each at most
const MAX_ENTRIES = 40;

type Entry = { language: Language; key: string; value: unknown };

// Most recently used last
let entries: Entry[] = [];

function isEntry(entry: unknown): entry is Entry {
  const candidate = entry as Partial<Entry> | null;
  return (
    !!candidate &&
    LANGUAGES.includes(candidate.language as Language) &&
    typeof candidate.key === 'string' &&
    candidate.value !== undefined
  );
}

// Loads what earlier sessions saved. Call once before the first read; an
// unreadable store starts empty.
export async function hydrateCache() {
  try {
    const stored = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}',
    );
    entries =
      stored.version === VERSION && Array.isArray(stored.entries)
        ? stored.entries.filter(isEntry).slice(-MAX_ENTRIES)
        : [];
  } catch {
    entries = [];
  }
}

export function readCache<T>(language: Language, key: string): T | undefined {
  const index = entries.findIndex(
    e => e.language === language && e.key === key,
  );
  if (index === -1) {
    return undefined;
  }
  // Now the most recently used; saved with the next write
  const [entry] = entries.splice(index, 1);
  entries.push(entry);
  return entry.value as T;
}

// Saves a copy of `value`, so later changes to the caller's object don't
// reach the cache. Only JSON survives a restart, so only JSON is accepted.
export function writeCache(language: Language, key: string, value: unknown) {
  if (!LANGUAGES.includes(language)) {
    throw new Error(`Cache entry for unknown language: ${language}`);
  }
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new Error(`Cache value for ${key} is not JSON`);
  }
  entries = entries.filter(e => !(e.language === language && e.key === key));
  entries.push({ language, key, value: JSON.parse(json) });
  entries = entries.slice(-MAX_ENTRIES);
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: VERSION, entries }),
  ).catch(() => {});
}
