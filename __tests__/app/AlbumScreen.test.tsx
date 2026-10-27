import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { TVFocusGuideView, View } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { act } from 'react-test-renderer';

import { hydrateCache } from '../../src/api/cache';
import type { Album } from '../../src/api/types';
import { AlbumScreen } from '../../src/app/screens/AlbumScreen';
import { renderInApp, texts } from '../helpers/renderApp';

const threePhotos = (hasNextPage = false) => ({
  items: ['p1', 'p2', 'p3'].map(id => ({
    id,
    albumId: 'a1',
    title: '',
    imageUrl: '',
    thumbnailUrl: '',
    photographer: 'Ann',
    width: 1,
    height: 1,
    createdAt: '',
  })),
  page: 1,
  pageSize: 20,
  totalItems: 3,
  hasNextPage,
});
const mockGetAlbumPhotos = jest.fn();
jest.mock('../../src/api/photoApi', () => ({
  getAlbumPhotos: (...args: unknown[]) => mockGetAlbumPhotos(...args),
}));
beforeEach(async () => {
  await AsyncStorage.clear();
  await hydrateCache();
  mockGetAlbumPhotos.mockReset();
  mockGetAlbumPhotos.mockImplementation(async () => threePhotos());
});

const album: Album = {
  id: 'a1',
  title: 'Fall',
  description: '',
  coverPhotoId: '',
  coverPhoto: null,
  photoCount: 3,
};

async function render(onSearch?: (a: Album) => void) {
  const r = await renderInApp(
    <AlbumScreen
      album={album}
      onBack={() => {}}
      onPlaySlideshow={() => {}}
      onSearch={onSearch}
    />,
  );
  for (const space of r.root.findAll(
    n => n.type === View && typeof n.props.onLayout === 'function',
  )) {
    act(() =>
      space.props.onLayout({
        nativeEvent: { layout: { width: 1920, height: 800 } },
      }),
    );
  }
  return r;
}

// Focus ids inside a node
const ids = (node: ReactTestInstance) =>
  new Set(
    node
      .findAll(n => typeof n.props.testID === 'string' && 'onFocus' in n.props)
      .map(n => n.props.testID as string),
  );
// The remembering focus groups (autoFocus guides) and what each holds
const groups = (r: Awaited<ReturnType<typeof render>>) =>
  r.root
    .findAll(n => n.type === TVFocusGuideView && n.props.autoFocus === true)
    .map(ids);

describe('Album screen', () => {
  it('has a Search button that searches this album', async () => {
    const onSearch = jest.fn();
    const r = await render(onSearch);
    const button = r.root.findAll(
      n => n.props.testID === 'album-search' && 'onFocus' in n.props,
    )[0];
    act(() => button.props.onPress());
    expect(onSearch).toHaveBeenCalledWith(album);
    expect(
      (await render()).root.findAll(n => n.props.testID === 'album-search'),
    ).toEqual([]);
  });

  it('remembers focus separately in the header and in the grid', async () => {
    const all = groups(await render(() => {}));
    const header = all.find(g => g.has('album-back'));
    expect(header).toEqual(
      new Set(['album-back', 'album-search', 'album-slideshow']),
    );
    const grid = all.find(g => g.has('photo-card-p1'));
    expect(grid).toEqual(
      new Set(['photo-card-p1', 'photo-card-p2', 'photo-card-p3']),
    );
  });
});

describe('Album screen buttons', () => {
  it('open the photo pressed with the photos loaded, and play from the first', async () => {
    const onOpenPhoto = jest.fn();
    const onPlaySlideshow = jest.fn();
    const r = await renderInApp(
      <AlbumScreen
        album={album}
        onBack={() => {}}
        onOpenPhoto={onOpenPhoto}
        onPlaySlideshow={onPlaySlideshow}
      />,
    );
    for (const space of r.root.findAll(
      n => n.type === View && typeof n.props.onLayout === 'function',
    )) {
      act(() =>
        space.props.onLayout({
          nativeEvent: { layout: { width: 1920, height: 800 } },
        }),
      );
    }
    const press = (id: string) =>
      act(() =>
        r.root
          .findAll(n => n.props.testID === id && 'onFocus' in n.props)[0]
          .props.onPress(),
      );
    press('photo-card-p2');
    expect(onOpenPhoto.mock.calls[0][1]).toBe(1);
    expect(
      onOpenPhoto.mock.calls[0][0].map((p: { id: string }) => p.id),
    ).toEqual(['p1', 'p2', 'p3']);
    press('album-slideshow');
    expect(onPlaySlideshow.mock.calls[0][1]).toBe(0);
  });
});

describe('Album screen states', () => {
  const flush = () =>
    act(async () => {
      await new Promise<void>(done => setImmediate(() => done()));
    });

  it('shows the description, or a name for an untitled album', async () => {
    const described = await renderInApp(
      <AlbumScreen
        album={{ ...album, description: 'Leaves turning' }}
        onBack={() => {}}
      />,
    );
    expect(texts(described)).toEqual(
      expect.arrayContaining(['Fall', 'Leaves turning', '3 photos']),
    );
    const untitled = await renderInApp(
      <AlbumScreen album={{ ...album, title: '' }} onBack={() => {}} />,
    );
    expect(texts(untitled)).toContain('Untitled album');
  });

  it('first page: says it is loading, that it failed, or that there is nothing', async () => {
    let fail!: (e: Error) => void;
    mockGetAlbumPhotos.mockReturnValueOnce(
      new Promise((_, reject) => (fail = reject)),
    );
    const r = await renderInApp(
      <AlbumScreen album={album} onBack={() => {}} />,
    );
    expect(texts(r)).toContain('Loading photos…');
    await act(async () => fail(new Error('500')));
    expect(texts(r)).toContain("Couldn't load photos");

    await AsyncStorage.clear();
    await hydrateCache();
    mockGetAlbumPhotos.mockResolvedValueOnce({
      ...threePhotos(),
      items: [],
      totalItems: 0,
    });
    const onBack = jest.fn();
    const empty = await renderInApp(
      <AlbumScreen album={{ ...album, id: 'a2' }} onBack={onBack} />,
    );
    await flush();
    expect(texts(empty)).toContain('No photos to show');
    act(() =>
      empty.root
        .findAll(
          n => n.props.testID === 'album-retry' && 'onFocus' in n.props,
        )[0]
        .props.onPress(),
    );
    expect(onBack).toHaveBeenCalled();
  });

  it('a later page: shows it loading, and keeps the photos when it fails', async () => {
    mockGetAlbumPhotos.mockResolvedValueOnce(threePhotos(true));
    let fail!: (e: Error) => void;
    mockGetAlbumPhotos.mockReturnValueOnce(
      new Promise((_, reject) => (fail = reject)),
    );
    const r = await render();
    const grid = r.root.findAll(
      n => typeof n.props.onEndReached === 'function' && n.props.numColumns,
    )[0];
    act(() => grid.props.onEndReached());
    expect(
      r.root.findAll(n => n.props.testID === 'album-more-retry').length,
    ).toBeGreaterThan(0);
    await act(async () => fail(new Error('500')));
    expect(texts(r)).toContain("Couldn't load more photos");
    expect(texts(r)).toContain('Ann');
  });
});
