import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { act } from 'react-test-renderer';

import { hydrateCache, readCache } from '../../src/api/cache';
import { useAlbum } from '../../src/app/hooks/useAlbum';
import { useAlbumPhotos } from '../../src/app/hooks/useAlbumPhotos';
import { useAlbums } from '../../src/app/hooks/useAlbums';
import { usePhoto } from '../../src/app/hooks/usePhoto';
import { useSettings } from '../../src/app/context/Settings';
import { renderInApp } from '../helpers/renderApp';

jest.mock('../../src/api/photoApi', () => ({
  getAlbums: jest.fn(async (page: number) => ({
    items: [{ id: `album-p${page}` }],
    page,
    pageSize: 20,
    totalItems: 40,
    hasNextPage: page < 2,
  })),
  getAlbumPhotos: jest.fn(async (albumId: string, page: number) => ({
    items: [{ id: `${albumId}-photo-p${page}` }],
    page,
    pageSize: 20,
    totalItems: 1,
    hasNextPage: false,
  })),
  getAlbum: jest.fn(async (id: string) => ({ id, title: 'T' })),
  getPhoto: jest.fn(async (id: string) => ({ id, title: '' })),
}));

// Clears the store and the in-memory entries alike
beforeEach(async () => {
  await AsyncStorage.clear();
  await hydrateCache();
});

const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setImmediate(() => resolve()));
  });

function Probe() {
  useAlbums();
  useAlbumPhotos('a1');
  useAlbum('a2');
  usePhoto('p3');
  return null;
}

describe('data hooks', () => {
  it('record what they fetched under the UI language, keyed by what it is', async () => {
    await renderInApp(<Probe />, 'ar');
    await settle();
    expect(readCache('ar', 'albums:')).toMatchObject({
      items: [{ id: 'album-p1' }],
    });
    expect(readCache('ar', 'album-photos:a1:')).toMatchObject({
      items: [{ id: 'a1-photo-p1' }],
    });
    expect(readCache('ar', 'album:a2')).toEqual({ id: 'a2', title: 'T' });
    expect(readCache('ar', 'photo:p3')).toEqual({ id: 'p3', title: '' });
    for (const key of ['albums:', 'album-photos:a1:', 'album:a2', 'photo:p3']) {
      expect(readCache('en', key)).toBeUndefined();
    }
  });

  it('a page size is part of the key: lists of other sizes are not mixed up', async () => {
    function Sized() {
      useAlbums(5);
      useAlbumPhotos('a1', 7);
      return null;
    }
    await renderInApp(<Sized />);
    await settle();
    expect(readCache('en', 'albums:5')).toBeDefined();
    expect(readCache('en', 'album-photos:a1:7')).toBeDefined();
    expect(readCache('en', 'albums:')).toBeUndefined();
  });

  it('after a language change, record under the new language', async () => {
    let update!: ReturnType<typeof useSettings>['updateSettings'];
    function Switcher() {
      update = useSettings().updateSettings;
      useAlbums();
      return null;
    }
    await renderInApp(<Switcher />, 'en');
    await settle();
    expect(readCache('ar', 'albums:')).toBeUndefined();
    act(() => update({ language: 'ar' }));
    await settle();
    expect(readCache('ar', 'albums:')).toMatchObject({
      items: [{ id: 'album-p1' }],
    });
  });
});
