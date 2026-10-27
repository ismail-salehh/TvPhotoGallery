import React from 'react';
import { act } from 'react-test-renderer';

import { Router } from '../../src/app/navigation/Router';
import { renderInApp, texts } from '../helpers/renderApp';

let mockInitial: Promise<string | null>;
let mockListener: ((url: string) => void) | null = null;
const mockRemove = jest.fn();
jest.mock('../../src/platform/deepLink', () => ({
  getInitialLink: () => mockInitial,
  addLinkListener: (listener: (url: string) => void) => {
    mockListener = listener;
    return mockRemove;
  },
}));

// Each screen shows its name and the id it was opened for
jest.mock('../../src/app/screens/HomeScreen', () => ({
  HomeScreen: () => {
    const { Text } = require('react-native');
    return <Text>home</Text>;
  },
}));
let mockAlbumLinkProps: Record<string, unknown> = {};
jest.mock('../../src/app/screens/LinkScreens', () => {
  const { Text } = require('react-native');
  return {
    AlbumLinkScreen: (props: { albumId: string }) => {
      mockAlbumLinkProps = props;
      return <Text>{`albumLink:${props.albumId}`}</Text>;
    },
    PhotoLinkScreen: ({ photoId }: { photoId: string }) => (
      <Text>{`photoLink:${photoId}`}</Text>
    ),
  };
});

// The screen on top: hidden screens below stay mounted with display none
function top(renderer: Awaited<ReturnType<typeof renderInApp>>) {
  const all = texts(renderer).filter(t =>
    /^(home|albumLink|photoLink)/.test(t),
  );
  return all[all.length - 1];
}

const flush = () =>
  act(async () => {
    await new Promise<void>(resolve => setImmediate(() => resolve()));
  });

beforeEach(() => {
  mockListener = null;
  mockRemove.mockClear();
});

describe('Router links', () => {
  it('a launch link opens its photo on top of Home', async () => {
    mockInitial = Promise.resolve('tvphotogallery://photo/abc');
    const r = await renderInApp(<Router />);
    await flush();
    expect(texts(r)).toEqual(expect.arrayContaining(['home', 'photoLink:abc']));
    expect(top(r)).toBe('photoLink:abc');
  });

  it('an album opened from a link can be searched like any other', async () => {
    mockInitial = Promise.resolve('tvphotogallery://album/a7');
    await renderInApp(<Router />);
    await flush();
    expect(mockAlbumLinkProps.albumId).toBe('a7');
    expect(typeof mockAlbumLinkProps.onSearch).toBe('function');
  });

  it('a launch without a link, or with a bad one, stays on Home', async () => {
    for (const url of [
      null,
      'tvphotogallery://user/x',
      'https://evil.test/#/photo/../me',
    ]) {
      mockInitial = Promise.resolve(url);
      const r = await renderInApp(<Router />);
      await flush();
      expect(texts(r).filter(t => t !== 'home' && /Link/.test(t))).toEqual([]);
      expect(top(r)).toBe('home');
    }
  });

  it('a link opened while running goes on top of what is showing, each time', async () => {
    mockInitial = Promise.resolve(null);
    const r = await renderInApp(<Router />);
    await flush();
    act(() => mockListener?.('tvphotogallery://album/a1'));
    expect(top(r)).toBe('albumLink:a1');
    // Straight after another: not swallowed as a double press
    act(() => mockListener?.('tvphotogallery://photo/p2'));
    expect(top(r)).toBe('photoLink:p2');
    expect(texts(r)).toEqual(
      expect.arrayContaining(['home', 'albumLink:a1', 'photoLink:p2']),
    );
  });

  it('a link closes the exit question, so the photo is not hidden behind it', async () => {
    mockInitial = Promise.resolve(null);
    const { useBackDispatch } = require('../../src/app/context/BackHandler');
    let back!: () => boolean;
    function BackProbe() {
      back = useBackDispatch();
      return null;
    }
    const r = await renderInApp(
      <>
        <Router />
        <BackProbe />
      </>,
    );
    await flush();
    act(() => {
      back();
    });
    expect(texts(r)).toContain('Leave Photo Gallery?');
    act(() => mockListener?.('tvphotogallery://photo/p9'));
    expect(texts(r)).not.toContain('Leave Photo Gallery?');
    expect(top(r)).toBe('photoLink:p9');
  });

  it('stops listening when it goes away, and ignores a late launch link', async () => {
    let resolveInitial!: (url: string | null) => void;
    mockInitial = new Promise(resolve => {
      resolveInitial = resolve;
    });
    const r = await renderInApp(<Router />);
    act(() => r.unmount());
    expect(mockRemove).toHaveBeenCalled();
    resolveInitial('tvphotogallery://photo/late');
    await flush();
  });
});
