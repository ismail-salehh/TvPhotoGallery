import React, { useState } from 'react';
import { FlatList } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { act } from 'react-test-renderer';

import type { Album } from '../../src/api/types';
import {
  AlbumRails,
  RAIL_HEIGHT,
  RAILS_HEIGHT,
} from '../../src/app/components/album/AlbumRails';
import { AlbumRow } from '../../src/app/components/album/AlbumRow';
import { FocusScreen } from '../../src/ui-kit/focus/FocusScreen';
import { useFocusStore } from '../../src/ui-kit/focus/focusStore';
import { renderInApp, texts } from '../helpers/renderApp';

const album = (n: number): Album => ({
  id: `a${n}`,
  title: `T${n}`,
  description: '',
  coverPhotoId: '',
  coverPhoto: null,
  photoCount: 1,
});
const albums = (count: number) =>
  Array.from({ length: count }, (_, i) => album(i + 1));

let setAlbums: (albums: Album[]) => void;
function Harness({ initial }: { initial: Album[] }) {
  const [list, set] = useState(initial);
  setAlbums = set;
  return (
    <FocusScreen screenKey="home" active>
      <AlbumRails
        albums={list}
        onAlbumFocus={() => {}}
        onAlbumPress={() => {}}
      />
    </FocusScreen>
  );
}

// The vertical list: its items are rails (arrays of albums)
const railList = (r: Awaited<ReturnType<typeof renderInApp>>) =>
  r.root
    .findAllByType(FlatList)
    .find(l => Array.isArray(l.props.data[0])) as ReactTestInstance;
const card = (r: Awaited<ReturnType<typeof renderInApp>>, id: string) =>
  r.root.findAll(
    n => n.props.testID === `album-card-${id}` && 'onFocus' in n.props,
  )[0];

afterEach(() => {
  useFocusStore.getState().forgetScreen('home');
  jest.restoreAllMocks();
});

describe('Home album rails', () => {
  it('split the list into rails of ten, titled by position', async () => {
    const r = await renderInApp(<Harness initial={albums(15)} />);
    expect(railList(r).props.data.map((rail: Album[]) => rail.length)).toEqual([
      10, 5,
    ]);
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Albums 1–10', 'Albums 11–15']),
    );
    const ar = await renderInApp(<Harness initial={albums(15)} />, 'ar');
    expect(texts(ar)).toEqual(
      expect.arrayContaining(['الألبومات ١–١٠', 'الألبومات ١١–١٥']),
    );
  });

  it('give only the first rail’s first card the opening focus', async () => {
    const r = await renderInApp(<Harness initial={albums(20)} />);
    const preferred = r.root
      .findAll(
        n =>
          /^album-card-/.test(n.props.testID ?? '') &&
          n.props.hasTVPreferredFocus === true,
      )
      .map(n => n.props.testID);
    expect(new Set(preferred)).toEqual(new Set(['album-card-a1']));
  });

  it('keep rails scrolled out of view attached, so Up can reach them on Android', async () => {
    const r = await renderInApp(<Harness initial={albums(30)} />);
    expect(railList(r).props.removeClippedSubviews).toBe(false);
  });

  it('put the focused card’s rail at the top of the rails', async () => {
    const r = await renderInApp(<Harness initial={albums(30)} />);
    const list = railList(r);
    act(() =>
      list.props.onLayout({
        nativeEvent: { layout: { width: 1920, height: RAILS_HEIGHT } },
      }),
    );
    const scrollToOffset = jest.fn();
    list.instance.scrollToOffset = scrollToOffset;
    act(() => card(r, 'a12').props.onFocus());
    expect(scrollToOffset).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: RAIL_HEIGHT }),
    );
    act(() => card(r, 'a3').props.onFocus());
    expect(scrollToOffset).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 0 }),
    );
  });

  it('keep each full rail as it was when another page loads', async () => {
    const first = albums(20);
    const r = await renderInApp(<Harness initial={first} />);
    const before = railList(r).props.data;
    act(() => setAlbums([...first, ...albums(25).slice(20)]));
    const after = railList(r).props.data;
    expect(after.map((rail: Album[]) => rail.length)).toEqual([10, 10, 5]);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    // What the rows themselves were given
    const rowAlbums = r.root
      .findAll(n => n.type === AlbumRow.type)
      .map(n => n.props.albums);
    expect(rowAlbums[0]).toBe(before[0]);
  });

  it('leave an album in another rail to that rail when coming back', async () => {
    const r = await renderInApp(<Harness initial={albums(20)} />);
    expect(card(r, 'a15')).toBeDefined();
    act(() =>
      useFocusStore.getState().setPendingRestore('home', 'album-card-a15'),
    );
    // Neither the first rail nor the list gave up on it
    expect(useFocusStore.getState().pendingRestoreByScreen.home).toBe(
      'album-card-a15',
    );
  });

  it('scroll a rail that isn’t rendered into view for the album to restore', async () => {
    const r = await renderInApp(<Harness initial={albums(100)} />);
    const list = railList(r);
    const scrollToIndex = jest.fn();
    list.instance.scrollToIndex = scrollToIndex;
    // The probe needs an album whose rail is not rendered
    expect(card(r, 'a95')).toBeUndefined();
    act(() =>
      useFocusStore.getState().setPendingRestore('home', 'album-card-a95'),
    );
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 9, animated: false });
  });

  it('focus the first album when the one to restore is gone', async () => {
    const spatial = require('../../src/platform/spatialNavigation');
    const focusNode = jest.spyOn(spatial, 'focusNode');
    await renderInApp(<Harness initial={albums(20)} />);
    act(() =>
      useFocusStore.getState().setPendingRestore('home', 'album-card-gone'),
    );
    expect(useFocusStore.getState().pendingRestoreByScreen.home).toBe(
      undefined,
    );
    expect(focusNode).toHaveBeenCalledTimes(1);
    expect((focusNode.mock.calls[0][0] as ReactTestInstance).props.testID).toBe(
      'album-card-a1',
    );
  });
});
