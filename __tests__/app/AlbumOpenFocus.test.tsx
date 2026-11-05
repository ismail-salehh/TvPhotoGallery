import React from 'react';
import { View } from 'react-native';
import { act } from 'react-test-renderer';

import { Router } from '../../src/app/navigation/Router';
import { renderInApp } from '../helpers/renderApp';

const albumOf = (id: string) => ({
  id,
  title: id,
  description: '',
  coverPhotoId: '',
  coverPhoto: null,
  photoCount: 3,
});
const photoOf = (id: string) => ({
  id,
  albumId: 'a1',
  title: '',
  imageUrl: '',
  thumbnailUrl: '',
  photographer: 'Ann',
  width: 1,
  height: 1,
  createdAt: '',
});
const page = <T,>(items: T[]) => ({
  items,
  page: 1,
  pageSize: 20,
  totalItems: items.length,
  hasNextPage: false,
});
jest.mock('../../src/api/photoApi', () => ({
  getAlbums: async () => page([albumOf('a1'), albumOf('a2')]),
  getAlbumPhotos: async () => page(['p1', 'p2', 'p3'].map(photoOf)),
}));
jest.mock('../../src/platform/deepLink', () => ({
  getInitialLink: () => Promise.resolve(null),
  addLinkListener: () => () => {},
}));

const flush = () =>
  act(async () => {
    await new Promise<void>(r => setImmediate(() => r()));
  });

// Regression: the route's stack position was passed as the photo to focus
it('an album opened from Home gives the opening focus to its first photo', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(100_000);
  const r = await renderInApp(<Router />);
  await flush();
  const pressable = (testID: string) =>
    r.root.findAll(
      n => n.props.testID === testID && 'hasTVPreferredFocus' in n.props,
    )[0];
  act(() => pressable('album-card-a1').props.onPress());
  await flush();
  // The grid renders once its space is measured
  for (const space of r.root.findAll(
    n => n.type === View && typeof n.props.onLayout === 'function',
  )) {
    act(() =>
      space.props.onLayout({
        nativeEvent: { layout: { width: 1920, height: 800 } },
      }),
    );
  }
  const preferred = r.root
    .findAll(
      n =>
        /^photo-card-/.test(n.props.testID ?? '') &&
        n.props.hasTVPreferredFocus === true,
    )
    .map(n => n.props.testID);
  expect(new Set(preferred)).toEqual(new Set(['photo-card-p1']));
});
