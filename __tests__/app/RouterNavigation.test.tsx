import React from 'react';
import { BackHandler } from 'react-native';
import { act } from 'react-test-renderer';

import { photoCardFocusId } from '../../src/app/components/photo/PhotoCard';
import { useBackDispatch } from '../../src/app/context/BackHandler';
import { Router } from '../../src/app/navigation/Router';
import { useFocusStore } from '../../src/ui-kit/focus/focusStore';
import { renderInApp, texts } from '../helpers/renderApp';

jest.mock('../../src/platform/deepLink', () => ({
  getInitialLink: () => Promise.resolve(null),
  addLinkListener: () => () => {},
}));

// Every screen is a stub that shows its name and hands its props to the test
const mockProps: Record<
  string,
  Record<string, (...args: unknown[]) => void>
> = {};
jest.mock('../../src/app/screens/HomeScreen', () => ({
  HomeScreen: (p: never) => require('./routerStub').stub('home', p),
}));
jest.mock('../../src/app/screens/AlbumScreen', () => ({
  AlbumScreen: (p: never) => require('./routerStub').stub('album', p),
}));
jest.mock('../../src/app/screens/SearchScreen', () => ({
  SearchScreen: (p: never) => require('./routerStub').stub('search', p),
}));
jest.mock('../../src/app/screens/SettingsScreen', () => ({
  SettingsScreen: (p: never) => require('./routerStub').stub('settings', p),
}));
jest.mock('../../src/app/screens/PhotoViewerScreen', () => ({
  PhotoViewerScreen: (p: never) => require('./routerStub').stub('viewer', p),
}));
jest.mock('../../src/app/screens/SlideshowScreen', () => ({
  SlideshowScreen: (p: never) => require('./routerStub').stub('slideshow', p),
}));
jest.mock(
  './routerStub',
  () => ({
    stub: (
      name: string,
      props: Record<string, (...args: unknown[]) => void>,
    ) => {
      const { Text } = require('react-native');
      mockProps[name] = props;
      return <Text>{`screen:${name}`}</Text>;
    },
  }),
  { virtual: true },
);

let now = 0;
let back!: () => boolean;
function BackProbe() {
  back = useBackDispatch();
  return null;
}

async function render() {
  const r = await renderInApp(
    <>
      <Router />
      <BackProbe />
    </>,
  );
  // The screen on top: screens below stay mounted, hidden
  const top = () =>
    texts(r)
      .filter(t => t.startsWith('screen:'))
      .pop();
  return { r, top };
}

// Past both the navigation and the back-press cooldowns
const later = () => {
  now += 1000;
};

beforeEach(() => {
  now = 10_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

const album = { id: 'a1', title: 'Lakes' };
const photos = [{ id: 'p1' }, { id: 'p2' }];

describe('Router', () => {
  it('opens each screen from the one below and goes back one at a time', async () => {
    const { top } = await render();
    expect(top()).toBe('screen:home');

    act(() => mockProps.home.onOpenAlbum(album));
    expect(top()).toBe('screen:album');
    later();
    act(() => mockProps.album.onOpenPhoto(photos, 1));
    expect(top()).toBe('screen:viewer');
    later();
    act(() => mockProps.viewer.onPlaySlideshow(photos, 1));
    expect(top()).toBe('screen:slideshow');

    later();
    act(() => mockProps.slideshow.onBack());
    expect(top()).toBe('screen:viewer');
    later();
    act(() => {
      back();
    });
    expect(top()).toBe('screen:album');
    later();
    act(() => mockProps.album.onBack());
    expect(top()).toBe('screen:home');

    later();
    act(() => mockProps.home.onOpenSearch());
    expect(top()).toBe('screen:search');
    later();
    act(() => mockProps.search.onBack());
    later();
    act(() => mockProps.home.onOpenSettings());
    expect(top()).toBe('screen:settings');
  });

  it('a late Back from a screen already closed never closes Home', async () => {
    const { top } = await render();
    act(() => mockProps.home.onOpenAlbum(album));
    const staleBack = mockProps.album.onBack;
    later();
    act(() => staleBack());
    expect(top()).toBe('screen:home');
    later();
    act(() => staleBack());
    expect(top()).toBe('screen:home');
  });

  it('ignores a second press that lands within the cooldown', async () => {
    const { r, top } = await render();
    act(() => mockProps.home.onOpenAlbum(album));
    act(() => mockProps.home.onOpenSearch());
    expect(top()).toBe('screen:album');
    expect(texts(r)).not.toContain('screen:search');
    act(() => mockProps.album.onBack());
    expect(top()).toBe('screen:album');
  });

  it('points the screen below at the photo on screen, so Back lands there', async () => {
    await render();
    act(() => mockProps.home.onOpenAlbum(album));
    later();
    act(() => mockProps.album.onOpenPhoto(photos, 0));
    act(() => mockProps.viewer.onPhotoChange?.({ id: 'p2' }));
    expect(useFocusStore.getState().lastFocusedByScreen['album-1']).toBe(
      photoCardFocusId('p2'),
    );
    expect(mockProps.home.onPhotoChange).toBeUndefined();
  });

  it('on Home, Back asks before leaving; Cancel stays, Exit leaves', async () => {
    const exitApp = jest
      .spyOn(BackHandler, 'exitApp')
      .mockImplementation(() => {});
    const { r } = await render();
    act(() => {
      back();
    });
    expect(texts(r)).toContain('Leave Photo Gallery?');
    const press = (label: string) =>
      act(() =>
        r.root
          .find(
            n =>
              typeof n.props.onPress === 'function' &&
              texts({ root: n } as never).includes(label),
          )
          .props.onPress(),
      );
    press('Cancel');
    expect(texts(r)).not.toContain('Leave Photo Gallery?');
    // Back closes the question too
    later();
    act(() => {
      back();
    });
    later();
    act(() => {
      back();
    });
    expect(texts(r)).not.toContain('Leave Photo Gallery?');
    later();
    act(() => {
      back();
    });
    press('Exit');
    expect(exitApp).toHaveBeenCalled();
  });
});

describe('Router search', () => {
  it('searches albums from Home and that album’s photos from an album', async () => {
    const { top } = await render();
    act(() => mockProps.home.onOpenSearch());
    expect(top()).toBe('screen:search');
    expect(mockProps.search.album).toBeUndefined();
    later();
    act(() => mockProps.search.onOpenAlbum(album));
    expect(top()).toBe('screen:album');
    later();
    act(() => mockProps.album.onSearch(album));
    expect(top()).toBe('screen:search');
    expect(mockProps.search.album).toBe(album);
    later();
    act(() => mockProps.search.onOpenPhoto(photos, 1));
    expect(top()).toBe('screen:viewer');
  });
});
