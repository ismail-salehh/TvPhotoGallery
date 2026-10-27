import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { readCache } from '../../src/api/cache';
import { CacheGate } from '../../src/app/context/CacheGate';

describe('CacheGate', () => {
  it('shows nothing until the saved responses are loaded, then the app', async () => {
    await AsyncStorage.setItem(
      'responseCache',
      JSON.stringify({
        version: 1,
        entries: [{ language: 'en', key: 'albums:', value: { items: [] } }],
      }),
    );
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <CacheGate>
          <Text>app</Text>
        </CacheGate>,
      );
    });
    expect(renderer.toJSON()).toBeNull();
    await act(async () => {
      await new Promise<void>(resolve => setImmediate(() => resolve()));
    });
    expect(renderer.root.findByType(Text).props.children).toBe('app');
    expect(readCache('en', 'albums:')).toEqual({ items: [] });
  });
});
