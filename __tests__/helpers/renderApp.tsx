import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactNode } from 'react';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { BackHandlerProvider } from '../../src/app/context/BackHandler';
import { ConnectivityProvider } from '../../src/app/context/Connectivity';
import { LanguageDirection } from '../../src/app/context/LanguageDirection';
import { SettingsProvider } from '../../src/app/context/Settings';
import type { Language } from '../../src/i18n';
import { FocusProvider } from '../../src/ui-kit/focus/FocusProvider';
import { DesignCanvas } from '../../src/ui-kit/layout/DesignCanvas';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

// Unmounted after each test, so no timer outlives it
afterEach(() => {
  act(() => mounted.splice(0).forEach(r => r.unmount()));
});

// The app's providers around `ui`, in `language`, as App.tsx sets them up
export async function renderInApp(ui: ReactNode, language: Language = 'en') {
  await AsyncStorage.setItem(
    'settings',
    JSON.stringify({ slideshowIntervalMs: 5000, language }),
  );
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 1920, height: 1080 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <SettingsProvider>
          <BackHandlerProvider>
            <ConnectivityProvider>
              <FocusProvider>
                <DesignCanvas>
                  <LanguageDirection>{ui}</LanguageDirection>
                </DesignCanvas>
              </FocusProvider>
            </ConnectivityProvider>
          </BackHandlerProvider>
        </SettingsProvider>
      </SafeAreaProvider>,
    );
  });
  mounted.push(renderer);
  await act(async () => {
    await new Promise<void>(resolve => setImmediate(() => resolve()));
  });
  return renderer;
}

// Every string rendered, in order
export function texts(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node =>
      ([] as unknown[])
        .concat(node.props.children)
        .filter(c => typeof c === 'string' || typeof c === 'number')
        .join(''),
    );
}
