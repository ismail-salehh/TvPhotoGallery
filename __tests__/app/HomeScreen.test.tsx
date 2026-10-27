import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Image } from 'react-native';
import { act } from 'react-test-renderer';

import { hydrateCache } from '../../src/api/cache';
import { HomeScreen } from '../../src/app/screens/HomeScreen';
import { renderInApp, texts } from '../helpers/renderApp';

const cover = (id: string) => ({
  id,
  albumId: '',
  title: '',
  imageUrl: `https://images.unsplash.com/${id}?w=1920`,
  thumbnailUrl: `https://images.unsplash.com/${id}?w=400`,
  photographer: `By ${id}`,
  width: 1,
  height: 1,
  createdAt: '',
});
let mockUntitled = false;
const mockGetAlbums = jest.fn();
jest.mock('../../src/api/photoApi', () => ({
  getAlbums: (...args: unknown[]) => mockGetAlbums(...args),
}));
const threeAlbums = async () => ({
  items: [1, 2, 3].map(n => ({
    id: `a${n}`,
    title: mockUntitled ? '' : `Album ${n}`,
    description: '',
    coverPhotoId: `c${n}`,
    coverPhoto: cover(`c${n}`),
    photoCount: n,
  })),
  page: 1,
  pageSize: 20,
  totalItems: 3,
  hasNextPage: false,
});

beforeEach(async () => {
  await AsyncStorage.clear();
  await hydrateCache();
  mockGetAlbums.mockReset();
  mockGetAlbums.mockImplementation(threeAlbums);
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const card = (r: Awaited<ReturnType<typeof renderInApp>>, id: string) =>
  r.root.findAll(
    n => n.props.testID === `album-card-${id}` && 'onFocus' in n.props,
  )[0];
// The hero's full-size photo layers (each image is several nodes deep)
const heroPhotos = (r: Awaited<ReturnType<typeof renderInApp>>) => [
  ...new Set(
    r.root
      .findAll(n => typeof n.props.source?.uri === 'string')
      .map(n => n.props.source.uri as string)
      .filter(uri => uri.includes('w=1920')),
  ),
];

describe('Home', () => {
  it('shows the albums in rails, and downloads no cover ahead of time', async () => {
    const r = await renderInApp(
      <HomeScreen onOpenAlbum={() => {}} onOpenSearch={() => {}} />,
    );
    await act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });
    expect(texts(r)).toContain('Albums 1–3');
    expect(card(r, 'a3')).toBeDefined();
    expect(Image.prefetch).not.toHaveBeenCalled();
  });

  it('changes the hero only once focus rests, keeping the last photo up meanwhile', async () => {
    const r = await renderInApp(
      <HomeScreen onOpenAlbum={() => {}} onOpenSearch={() => {}} />,
    );
    await act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    const layer = (uri: string) =>
      r.root.findAll(
        n =>
          n.props.source?.uri === uri && typeof n.props.onLoad === 'function',
      )[0];
    // The first cover loads and fades in
    act(() => layer(cover('c1').imageUrl).props.onLoad());
    act(() => jest.advanceTimersByTime(1000));

    act(() => card(r, 'a2').props.onFocus());
    act(() => card(r, 'a3').props.onFocus());
    act(() => jest.advanceTimersByTime(499));
    expect(heroPhotos(r)).toEqual([cover('c1').imageUrl]);
    expect(texts(r)).not.toContain('Photo by By c3 on Unsplash');
    act(() => jest.advanceTimersByTime(1));
    // The album passed on the way never loads; the last photo stays up
    // until the new one has loaded and faded in
    expect(heroPhotos(r)).toEqual([cover('c1').imageUrl, cover('c3').imageUrl]);
    act(() => layer(cover('c3').imageUrl).props.onLoad());
    act(() => jest.advanceTimersByTime(1000));
    expect(heroPhotos(r)).toEqual([cover('c3').imageUrl]);
  });
});

describe('Home buttons', () => {
  it('open the album pressed, and Settings', async () => {
    const onOpenAlbum = jest.fn();
    const onOpenSettings = jest.fn();
    const r = await renderInApp(
      <HomeScreen onOpenAlbum={onOpenAlbum} onOpenSettings={onOpenSettings} />,
    );
    await act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });
    act(() => card(r, 'a2').props.onPress());
    expect(onOpenAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a2' }),
    );
    act(() =>
      r.root
        .findAll(
          n => n.props.testID === 'home-settings' && 'onFocus' in n.props,
        )[0]
        .props.onPress(),
    );
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('gives an untitled album a name in the hero, and stops a fade cut short', async () => {
    mockUntitled = true;
    const r = await renderInApp(
      <HomeScreen onOpenAlbum={() => {}} onOpenSearch={() => {}} />,
    );
    await act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });
    mockUntitled = false;
    // The hero and each of the three cards
    expect(texts(r).filter(t => t === 'Untitled album').length).toBe(4);
    const layer = r.root.findAll(
      n =>
        typeof n.props.source?.uri === 'string' &&
        typeof n.props.onLoad === 'function',
    )[0];
    act(() => layer.props.onLoad());
    // Leaving mid-fade must not mark the photo as shown after unmount
    const error = jest.spyOn(console, 'error');
    act(() => r.unmount());
    await act(async () => {
      await new Promise<void>(done => setTimeout(() => done(), 300));
    });
    expect(error).not.toHaveBeenCalled();
  });
});

describe('Home states', () => {
  it('first page: says it is loading, that it failed, or that there is nothing', async () => {
    let fail!: (e: Error) => void;
    mockGetAlbums.mockReturnValueOnce(
      new Promise((_, reject) => (fail = reject)),
    );
    const r = await renderInApp(<HomeScreen />);
    expect(texts(r)).toContain('Loading albums…');
    await act(async () => fail(new Error('500')));
    expect(texts(r)).toContain("Couldn't load albums");

    await AsyncStorage.clear();
    await hydrateCache();
    mockGetAlbums.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      hasNextPage: false,
    });
    const empty = await renderInApp(<HomeScreen />);
    await act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });
    expect(texts(empty)).toContain('No albums yet');
  });

  it('a later page: shows it loading under the rails, and keeps them when it fails', async () => {
    mockGetAlbums.mockImplementationOnce(async () => ({
      ...(await threeAlbums()),
      hasNextPage: true,
    }));
    let fail!: (e: Error) => void;
    mockGetAlbums.mockReturnValueOnce(
      new Promise((_, reject) => (fail = reject)),
    );
    const r = await renderInApp(<HomeScreen />);
    await act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });
    const rails = r.root.findAll(
      n =>
        typeof n.props.onEndReached === 'function' &&
        Array.isArray(n.props.data?.[0]),
    )[0];
    act(() => rails.props.onEndReached());
    expect(mockGetAlbums).toHaveBeenLastCalledWith(2, undefined);
    expect(
      r.root.findAll(n => n.props.testID === 'home-more-retry').length,
    ).toBeGreaterThan(0);
    await act(async () => fail(new Error('500')));
    expect(texts(r)).toContain("Couldn't load more albums");
    expect(card(r, 'a3')).toBeDefined();
  });
});
