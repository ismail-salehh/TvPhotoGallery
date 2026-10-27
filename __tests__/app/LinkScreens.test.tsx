import React from 'react';
import { act } from 'react-test-renderer';

import { NetworkError, UnsplashError } from '../../src/api/unsplash';
import {
  AlbumLinkScreen,
  PhotoLinkScreen,
} from '../../src/app/screens/LinkScreens';
import { renderInApp, texts } from '../helpers/renderApp';

const mockAlbum = jest.fn();
const mockPhoto = jest.fn();
jest.mock('../../src/app/hooks/useAlbum', () => ({
  useAlbum: (id: string) => mockAlbum(id),
}));
jest.mock('../../src/app/hooks/usePhoto', () => ({
  usePhoto: (id: string) => mockPhoto(id),
}));
// The real screens are tested on their own; here only what they are given
jest.mock('../../src/app/screens/AlbumScreen', () => ({
  AlbumScreen: (props: object) => {
    const { Text } = require('react-native');
    return <Text>{`AlbumScreen ${JSON.stringify(props)}`}</Text>;
  },
}));
jest.mock('../../src/app/screens/PhotoViewerScreen', () => ({
  PhotoViewerScreen: (props: object) => {
    const { Text } = require('react-native');
    return <Text>{`Viewer ${JSON.stringify(props)}`}</Text>;
  },
}));

const album = { id: 'a1', title: 'Lakes' };
const photo = { id: 'p1', title: '' };
const state = (over: object) => ({
  album: null,
  photo: null,
  loading: true,
  error: null,
  retry: jest.fn(),
  ...over,
});

function pressButton(
  renderer: Awaited<ReturnType<typeof renderInApp>>,
  label: string,
) {
  const button = renderer.root.find(
    node =>
      typeof node.props.onPress === 'function' &&
      texts({ root: node } as never).includes(label),
  );
  act(() => button.props.onPress());
}

describe('AlbumLinkScreen', () => {
  it('loads the album by id, then is the usual album screen', async () => {
    mockAlbum.mockReturnValue(state({ album, loading: false }));
    const r = await renderInApp(
      <AlbumLinkScreen albumId="a1" onBack={() => {}} />,
    );
    expect(mockAlbum).toHaveBeenCalledWith('a1');
    expect(texts(r).join()).toContain(
      'AlbumScreen {"album":{"id":"a1","title":"Lakes"}}',
    );
  });

  it('says it is loading, in the UI language', async () => {
    mockAlbum.mockReturnValue(state({}));
    expect(
      texts(
        await renderInApp(<AlbumLinkScreen albumId="a1" onBack={() => {}} />),
      ),
    ).toContain('Loading album…');
    expect(
      texts(
        await renderInApp(
          <AlbumLinkScreen albumId="a1" onBack={() => {}} />,
          'ar',
        ),
      ),
    ).toContain('جارٍ تحميل الألبوم…');
  });

  it('for an album that is gone, offers only Back', async () => {
    const onBack = jest.fn();
    const retry = jest.fn();
    mockAlbum.mockReturnValue(
      state({ loading: false, error: new UnsplashError(404, 'nope'), retry }),
    );
    const r = await renderInApp(
      <AlbumLinkScreen albumId="zz" onBack={onBack} />,
    );
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'No album to show',
        "This album isn't available.",
      ]),
    );
    pressButton(r, '‹ Back');
    expect(onBack).toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it('when loading failed, offers Retry', async () => {
    const retry = jest.fn();
    mockAlbum.mockReturnValue(
      state({ loading: false, error: new UnsplashError(500, 'down'), retry }),
    );
    const r = await renderInApp(
      <AlbumLinkScreen albumId="a1" onBack={() => {}} />,
    );
    expect(texts(r)).toContain("Couldn't load this album");
    pressButton(r, 'Retry');
    expect(retry).toHaveBeenCalled();
  });
});

describe('PhotoLinkScreen', () => {
  it('shows the one photo in the viewer', async () => {
    mockPhoto.mockReturnValue(state({ photo, loading: false }));
    const r = await renderInApp(
      <PhotoLinkScreen photoId="p1" onBack={() => {}} />,
    );
    expect(mockPhoto).toHaveBeenCalledWith('p1');
    expect(texts(r).join()).toContain(
      'Viewer {"photos":[{"id":"p1","title":""}],"initialIndex":0}',
    );
  });

  it('loading, offline and gone each say so', async () => {
    mockPhoto.mockReturnValue(state({}));
    expect(
      texts(
        await renderInApp(<PhotoLinkScreen photoId="p" onBack={() => {}} />),
      ),
    ).toContain('Loading photo…');
    mockPhoto.mockReturnValue(
      state({ loading: false, error: new NetworkError('x') }),
    );
    expect(
      texts(
        await renderInApp(<PhotoLinkScreen photoId="p" onBack={() => {}} />),
      ),
    ).toContain("You're offline");
    mockPhoto.mockReturnValue(
      state({ loading: false, error: new UnsplashError(404, 'x') }),
    );
    expect(
      texts(
        await renderInApp(
          <PhotoLinkScreen photoId="p" onBack={() => {}} />,
          'ar',
        ),
      ),
    ).toContain('لا توجد صورة لعرضها');
  });
});
