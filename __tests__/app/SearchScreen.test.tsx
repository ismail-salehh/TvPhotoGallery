import React from 'react';
import { View } from 'react-native';
import { act } from 'react-test-renderer';

import { NetworkError } from '../../src/api/unsplash';
import { SearchScreen } from '../../src/app/screens/SearchScreen';
import { renderInApp, texts } from '../helpers/renderApp';

const mockSearchAlbums = jest.fn();
const mockSearchPhotos = jest.fn();
jest.mock('../../src/api/photoApi', () => ({
  searchAlbums: (...args: unknown[]) => mockSearchAlbums(...args),
  searchPhotos: (...args: unknown[]) => mockSearchPhotos(...args),
}));

const page = <T,>(items: T[]) => ({
  items,
  page: 1,
  pageSize: 20,
  totalItems: items.length,
  hasNextPage: false,
});
const foundAlbum = {
  id: 'c1',
  title: 'Red things',
  description: '',
  coverPhotoId: '',
  coverPhoto: null,
  photoCount: 3,
};
const foundPhoto = {
  id: 'p1',
  albumId: 'a1',
  title: '',
  imageUrl: '',
  thumbnailUrl: '',
  photographer: 'Ann',
  width: 1,
  height: 1,
  createdAt: '',
};
const fall = { ...foundAlbum, id: 'a1', title: 'Fall' };

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  mockSearchAlbums.mockReset();
  mockSearchPhotos.mockReset();
});
afterEach(() => jest.useRealTimers());

type Rendered = Awaited<ReturnType<typeof renderInApp>>;
const pressable = (r: Rendered, testID: string) =>
  r.root.findAll(n => n.props.testID === testID && 'onFocus' in n.props)[0];

// Types `word` on the on-screen keyboard and lets the search go out
async function type(r: Rendered, word: string) {
  for (const c of word) {
    act(() => pressable(r, `key-${c}`).props.onPress());
  }
  act(() => jest.advanceTimersByTime(400));
  await act(async () => {
    await new Promise<void>(done => setImmediate(() => done()));
  });
  // Results lay out once their space has a height
  for (const space of r.root.findAll(
    n => n.type === View && typeof n.props.onLayout === 'function',
  )) {
    act(() =>
      space.props.onLayout({
        nativeEvent: { layout: { width: 1000, height: 800 } },
      }),
    );
  }
}

describe('Search from Home', () => {
  it('searches albums, shows them, and opens the one pressed', async () => {
    mockSearchAlbums.mockResolvedValue(page([foundAlbum]));
    const onOpenAlbum = jest.fn();
    const r = await renderInApp(
      <SearchScreen onBack={() => {}} onOpenAlbum={onOpenAlbum} />,
    );
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'Search',
        'Search albums',
        'Search Unsplash albums',
      ]),
    );
    await type(r, 'red');
    expect(mockSearchAlbums).toHaveBeenCalledTimes(1);
    expect(mockSearchAlbums).toHaveBeenCalledWith('red', 1);
    expect(mockSearchPhotos).not.toHaveBeenCalled();
    act(() => pressable(r, 'album-card-c1').props.onPress());
    expect(onOpenAlbum).toHaveBeenCalledWith(foundAlbum);
  });

  it('says when no album matches, and when the search failed', async () => {
    mockSearchAlbums.mockResolvedValueOnce(page([]));
    const r = await renderInApp(<SearchScreen onBack={() => {}} />);
    await type(r, 'red');
    expect(texts(r)).toContain('No albums for “red”');

    mockSearchAlbums.mockRejectedValueOnce(new NetworkError('down'));
    const failed = await renderInApp(<SearchScreen onBack={() => {}} />);
    await type(failed, 'sky');
    expect(texts(failed)).toContain("You're offline");
  });
});

describe('Search in an album', () => {
  it('searches only that album’s photos and opens the one pressed', async () => {
    mockSearchPhotos.mockResolvedValue(page([foundPhoto]));
    const onOpenPhoto = jest.fn();
    const r = await renderInApp(
      <SearchScreen album={fall} onBack={() => {}} onOpenPhoto={onOpenPhoto} />,
    );
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Search in “Fall”', 'Search this album']),
    );
    await type(r, 'red');
    expect(mockSearchPhotos).toHaveBeenCalledTimes(1);
    expect(mockSearchPhotos).toHaveBeenCalledWith('red', 1, undefined, 'a1');
    expect(mockSearchAlbums).not.toHaveBeenCalled();
    act(() => pressable(r, 'photo-card-p1').props.onPress());
    expect(onOpenPhoto).toHaveBeenCalledWith([foundPhoto], 0);
  });

  it('names an untitled album, and says when nothing in it matches', async () => {
    mockSearchPhotos.mockResolvedValue(page([]));
    const r = await renderInApp(
      <SearchScreen album={{ ...fall, title: '' }} onBack={() => {}} />,
      'ar',
    );
    expect(texts(r)).toContain('بحث في “ألبوم بلا عنوان”');
    await type(r, 'red');
    expect(texts(r)).toContain('لا توجد صور لـ “red” في هذا الألبوم');
  });

  it('says when the search failed', async () => {
    mockSearchPhotos.mockRejectedValue(new Error('500'));
    const r = await renderInApp(
      <SearchScreen album={fall} onBack={() => {}} />,
    );
    await type(r, 'red');
    expect(texts(r)).toContain("Couldn't search photos");
  });
});

describe('Search keyboard and paging', () => {
  it('Space, Delete and Clear edit the query; it stops at 40 characters', async () => {
    mockSearchAlbums.mockResolvedValue(page([]));
    const r = await renderInApp(<SearchScreen onBack={() => {}} />);
    const press = (id: string) => act(() => pressable(r, id).props.onPress());
    const query = () => texts(r)[2];
    press('key-space');
    expect(query()).toBe('Search albums');
    press('key-a');
    press('key-space');
    press('key-space');
    press('key-b');
    expect(query()).toBe('a b');
    press('key-delete');
    expect(query()).toBe('a ');
    press('key-clear');
    expect(query()).toBe('Search albums');
    for (let i = 0; i < 45; i++) {
      press('key-z');
    }
    expect(query()).toBe('z'.repeat(40));
  });

  it('loads more results at the end, and keeps them when that fails', async () => {
    mockSearchAlbums.mockResolvedValueOnce({
      ...page([foundAlbum]),
      hasNextPage: true,
    });
    let fail!: (e: Error) => void;
    mockSearchAlbums.mockReturnValueOnce(
      new Promise((_, reject) => (fail = reject)),
    );
    const r = await renderInApp(<SearchScreen onBack={() => {}} />);
    await type(r, 'red');
    const grid = r.root.findAll(
      n => typeof n.props.onEndReached === 'function' && n.props.numColumns,
    )[0];
    act(() => grid.props.onEndReached());
    expect(mockSearchAlbums).toHaveBeenLastCalledWith('red', 2);
    expect(pressable(r, 'search-more-retry')).toBeDefined();
    await act(async () => {
      fail(new Error('500'));
    });
    expect(texts(r)).toContain("Couldn't load more results");
    expect(pressable(r, 'album-card-c1')).toBeDefined();
  });
});
