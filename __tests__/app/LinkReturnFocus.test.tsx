import React from 'react';
import { act } from 'react-test-renderer';

import { useBackDispatch } from '../../src/app/context/BackHandler';
import { Router } from '../../src/app/navigation/Router';
import { renderInApp } from '../helpers/renderApp';

let mockResolveAlbums: (v: unknown) => void = () => {};
jest.mock('../../src/api/photoApi', () => ({
  getAlbums: () => new Promise(resolve => (mockResolveAlbums = resolve)),
  getPhoto: async (id: string) => ({
    id,
    title: 'T',
    photographer: 'P',
    imageUrl: '',
    thumbnailUrl: '',
    createdAt: '',
  }),
}));
jest.mock('../../src/platform/deepLink', () => ({
  getInitialLink: () => Promise.resolve('tvphotogallery://photo/p1'),
  addLinkListener: () => () => {},
}));

const flush = () =>
  act(async () => {
    await new Promise<void>(r => setImmediate(() => r()));
  });

describe('Back from a screen a launch link opened', () => {
  it('lands on Home’s first album, as a newly opened Home would', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(100_000);
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
    // The albums arrive while the photo is on top
    mockResolveAlbums({
      items: [
        {
          id: 'a1',
          title: 'One',
          description: '',
          coverPhotoId: '',
          coverPhoto: null,
          photoCount: 1,
        },
        {
          id: 'a2',
          title: 'Two',
          description: '',
          coverPhotoId: '',
          coverPhoto: null,
          photoCount: 1,
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 2,
      hasNextPage: false,
    });
    await flush();
    const card = () =>
      r.root.findAll(
        n =>
          n.props.testID === 'album-card-a1' &&
          'hasTVPreferredFocus' in n.props,
      )[0];
    expect(card().props.hasTVPreferredFocus).toBe(false);
    const spatial = require('../../src/platform/spatialNavigation');
    const focusNode = jest.spyOn(spatial, 'focusNode');
    act(() => {
      back();
    });
    await flush();
    await act(async () => {
      await new Promise<void>(done => setTimeout(() => done(), 50));
    });
    expect(focusNode).toHaveBeenCalledWith(expect.anything());
    expect(card().props.hasTVPreferredFocus).toBe(true);
    // Home was never pointed at a photo it doesn't list
    const { useFocusStore } = require('../../src/ui-kit/focus/focusStore');
    expect(useFocusStore.getState().lastFocusedByScreen.home).toBeUndefined();
  });
});
