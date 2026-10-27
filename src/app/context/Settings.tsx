import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Language } from '../../i18n';
import { LANGUAGES } from '../../i18n';

// The speeds offered in Settings and in the slideshow's speed picker
export const SLIDESHOW_INTERVALS_MS = [3000, 5000, 10000, 20000];

export type Settings = {
  // How long each slide stays up when a slideshow starts
  slideshowIntervalMs: number;
  language: Language;
};

const DEFAULTS: Settings = {
  slideshowIntervalMs: 5000,
  language: 'en',
};

const STORAGE_KEY = 'settings';

// Keeps only values this version understands, so a stale or hand-edited
// entry can't put the app in a broken state
function sanitize(stored: unknown): Settings {
  const value = (stored ?? {}) as Partial<Settings>;
  return {
    slideshowIntervalMs: SLIDESHOW_INTERVALS_MS.includes(
      value.slideshowIntervalMs as number,
    )
      ? (value.slideshowIntervalMs as number)
      : DEFAULTS.slideshowIntervalMs,
    language: LANGUAGES.includes(value.language as Language)
      ? (value.language as Language)
      : DEFAULTS.language,
  };
}

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  children: ReactNode;
};

// App-wide preferences, saved on the device
export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(json => setSettings(sanitize(json ? JSON.parse(json) : null)))
      .catch(() => setSettings(DEFAULTS));
  }, []);

  useEffect(() => {
    if (settings) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(
        () => {},
      );
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => (settings ? { settings, updateSettings } : null),
    [settings, updateSettings],
  );

  // Storage answers within a frame or two; waiting avoids a flash of the
  // wrong language on launch
  if (!value) {
    return null;
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider.');
  }
  return context;
}
