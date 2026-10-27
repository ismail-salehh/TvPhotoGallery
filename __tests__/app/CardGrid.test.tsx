import React from 'react';
import { FlatList, View } from 'react-native';
import { act } from 'react-test-renderer';

import type { Album, Photo } from '../../src/api/types';
import {
  AlbumCard,
  albumCardHeight,
} from '../../src/app/components/album/AlbumCard';
import { AlbumGrid } from '../../src/app/components/album/AlbumGrid';
import { AlbumRow } from '../../src/app/components/album/AlbumRow';
import { photoCardHeight } from '../../src/app/components/photo/PhotoCard';
import { PhotoGrid } from '../../src/app/components/photo/PhotoGrid';
import { FocusScreen } from '../../src/ui-kit/focus/FocusScreen';
import { useFocusStore } from '../../src/ui-kit/focus/focusStore';
import { renderInApp } from '../helpers/renderApp';

const album = (id: string): Album => ({
  id,
  title: id,
  description: '',
  coverPhotoId: '',
  coverPhoto: null,
  photoCount: 2,
});
const photo = (id: string): Photo => ({
  id,
  albumId: '',
  title: '',
  imageUrl: '',
  thumbnailUrl: '',
  photographer: 'Ann',
  width: 1,
  height: 1,
  createdAt: '',
});

const flat = (style: unknown) =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));

// The grid renders its list once its space has a height
async function laidOut(ui: React.ReactElement) {
  const r = await renderInApp(ui);
  const space = r.root.findAll(
    n => n.type === View && typeof n.props.onLayout === 'function',
  )[0];
  act(() =>
    space.props.onLayout({
      nativeEvent: { layout: { width: 1000, height: 800 } },
    }),
  );
  return r;
}
const pressable = (
  r: Awaited<ReturnType<typeof renderInApp>>,
  testID: string,
) => r.root.findAll(n => n.props.testID === testID && 'onFocus' in n.props)[0];

describe('album card height', () => {
  it('is what its parts add up to, at any width', async () => {
    for (const width of [320, 431]) {
      const r = await renderInApp(
        <AlbumCard album={album('a')} width={width} />,
      );
      const root = pressable(r, 'album-card-a');
      const card = flat(root.props.style);
      const frame = root.findAll(
        n => n.type === View && flat(n.props.style).overflow === 'hidden',
      )[0];
      const image = flat(frame.props.children.props.style);
      const lines = root
        .findAll(n => (n.type as unknown) === 'Text')
        .map(n => flat(n.props.style).height);
      const sum =
        image.height +
        flat(frame.props.style).borderWidth * 2 +
        card.gap * 2 +
        lines[0] +
        lines[1];
      expect(card.width).toBe(width);
      expect(albumCardHeight(width)).toBe(sum);
    }
  });
});

describe('grids', () => {
  it('lay albums out in rows of their card height and open the one pressed', async () => {
    const onAlbumPress = jest.fn();
    const albums = ['a1', 'a2', 'a3', 'a4'].map(album);
    const r = await laidOut(
      <AlbumGrid
        albums={albums}
        onAlbumPress={onAlbumPress}
        columns={2}
        width={1000}
        contentInset={100}
      />,
    );
    const list = r.root.findByType(FlatList);
    // (1000 - 2 * 100 - 32) / 2
    const cardWidth = 384;
    expect(flat(pressable(r, 'album-card-a2').props.style).width).toBe(
      cardWidth,
    );
    expect(list.props.getItemLayout(null, 1).length).toBe(
      albumCardHeight(cardWidth) + 32,
    );
    act(() => pressable(r, 'album-card-a3').props.onPress());
    expect(onAlbumPress).toHaveBeenCalledWith(albums[2]);
  });

  it('do the same for photos, with the photo card’s height', async () => {
    const onPhotoPress = jest.fn();
    const photos = ['p1', 'p2'].map(photo);
    const r = await laidOut(
      <PhotoGrid
        photos={photos}
        onPhotoPress={onPhotoPress}
        columns={2}
        width={1000}
        contentInset={100}
      />,
    );
    expect(
      r.root.findByType(FlatList).props.getItemLayout(null, 0).length,
    ).toBe(photoCardHeight(384) + 32);
    act(() => pressable(r, 'photo-card-p2').props.onPress());
    expect(onPhotoPress).toHaveBeenCalledWith(photos[1]);
  });

  it('leave the opening focus alone when told to', async () => {
    const preferred = async (preferFirstFocus: boolean) => {
      const r = await laidOut(
        <AlbumGrid
          albums={[album('a1')]}
          preferFirstFocus={preferFirstFocus}
        />,
      );
      return pressable(r, 'album-card-a1').props.hasTVPreferredFocus;
    };
    expect(await preferred(true)).toBe(true);
    expect(await preferred(false)).toBe(false);
  });
});

describe('grid focus', () => {
  it('scrolls the focused card’s row into view', async () => {
    const albums = ['a1', 'a2', 'a3', 'a4', 'a5'].map(album);
    const r = await laidOut(<AlbumGrid albums={albums} columns={2} />);
    const list = r.root.findByType(FlatList);
    act(() =>
      list.props.onLayout({
        nativeEvent: { layout: { width: 1000, height: 300 } },
      }),
    );
    const scrollToOffset = jest.fn();
    list.instance.scrollToOffset = scrollToOffset;
    act(() => pressable(r, 'album-card-a5').props.onFocus());
    // Row 2 sits below a 300-tall view: it scrolls so the row fits
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(scrollToOffset.mock.calls[0][0].offset).toBeGreaterThan(0);
  });

  it('brings the row of an item to restore into its render window', async () => {
    const photos = Array.from({ length: 200 }, (_, i) => photo(`p${i}`));
    const r = await renderInApp(
      <FocusScreen screenKey="grid" active>
        <PhotoGrid photos={photos} columns={4} />
      </FocusScreen>,
    );
    const space = r.root.findAll(
      n => n.type === View && typeof n.props.onLayout === 'function',
    )[0];
    act(() =>
      space.props.onLayout({
        nativeEvent: { layout: { width: 1000, height: 800 } },
      }),
    );
    const list = r.root.findByType(FlatList);
    const scrollToIndex = jest.fn();
    list.instance.scrollToIndex = scrollToIndex;
    // The probe needs an item that is not rendered
    expect(pressable(r, 'photo-card-p190')).toBeUndefined();
    act(() =>
      useFocusStore.getState().setPendingRestore('grid', 'photo-card-p190'),
    );
    expect(scrollToIndex).toHaveBeenCalledWith({
      index: 47,
      animated: false,
      viewPosition: 0.5,
    });
    useFocusStore.getState().forgetScreen('grid');
  });
});

describe('album card and rail', () => {
  it('highlights the card only while focused', async () => {
    const r = await renderInApp(<AlbumCard album={album('a')} />);
    const scale = () =>
      flat(pressable(r, 'album-card-a').props.style).transform;
    expect(scale()).toBeUndefined();
    act(() => pressable(r, 'album-card-a').props.onFocus());
    expect(scale()).toEqual([{ scale: 1.05 }]);
    act(() => pressable(r, 'album-card-a').props.onBlur());
    expect(scale()).toBeUndefined();
  });

  it('places rail cards after the leading inset, and renders all of them', async () => {
    // More than FlatList renders by default (10)
    const albums = Array.from({ length: 15 }, (_, i) => album(`a${i}`));
    const r = await renderInApp(
      <AlbumRow
        albums={albums}
        onAlbumFocus={() => {}}
        onAlbumPress={() => {}}
        contentInset={96}
      />,
    );
    const list = r.root.findByType(FlatList);
    expect(list.props.getItemLayout(null, 2)).toEqual({
      length: 352,
      offset: 96 + 352 * 2,
      index: 2,
    });
    expect(pressable(r, 'album-card-a14')).toBeDefined();
  });
});
