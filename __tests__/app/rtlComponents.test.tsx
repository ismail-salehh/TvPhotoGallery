import React from 'react';
import { FlatList, Image, View } from 'react-native';
import { act } from 'react-test-renderer';

import type { Album, Photo } from '../../src/api/types';
import { AlbumRow } from '../../src/app/components/album/AlbumRow';
import { Filmstrip } from '../../src/app/components/photo/Filmstrip';
import { OnScreenKeyboard } from '../../src/app/components/search/OnScreenKeyboard';
import { SearchBar } from '../../src/app/components/search/SearchBar';
import { SlideshowControls } from '../../src/app/components/slideshow/SlideshowControls';
import { PhotoViewerScreen } from '../../src/app/screens/PhotoViewerScreen';
import { SearchScreen } from '../../src/app/screens/SearchScreen';
import { renderInApp, texts } from '../helpers/renderApp';

const photo = (id: string, title = '', createdAt = ''): Photo => ({
  id,
  albumId: 'a',
  title,
  imageUrl: `https://images.unsplash.com/${id}?fm=jpg`,
  thumbnailUrl: `https://images.unsplash.com/${id}?w=400&fm=jpg`,
  photographer: 'Ann Lee',
  width: 4,
  height: 3,
  createdAt,
});
const photos = [
  photo('p1', 'A lake', '2024-03-12T00:00:00Z'),
  photo('p2'),
  photo('p3'),
];

const flat = (style: unknown) =>
  Object.assign({}, ...[style].flat(5).filter(Boolean));

describe('photo viewer caption', () => {
  // The Jest mock of Image.prefetch returns nothing; the app expects a promise
  beforeEach(() => {
    jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('in English: Unsplash title, credit with date, position', async () => {
    const r = await renderInApp(
      <PhotoViewerScreen photos={photos} initialIndex={0} onBack={() => {}} />,
    );
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'A lake',
        'Photo by Ann Lee on Unsplash · March 12, 2024',
        '1 / 3',
      ]),
    );
  });

  it('in Arabic: translated fallback title, Arabic date and digits', async () => {
    const r = await renderInApp(
      <PhotoViewerScreen photos={photos} initialIndex={1} onBack={() => {}} />,
      'ar',
    );
    expect(texts(r)).toEqual(
      expect.arrayContaining(['صورة من تصوير Ann Lee', '٢ / ٣']),
    );
    // No date for a photo without one, and no stray separator
    expect(texts(r).join('|')).not.toMatch(/·/);
  });
});

describe('slideshow controls', () => {
  it('show the fallback title in the UI language and the position given', async () => {
    const r = await renderInApp(
      <SlideshowControls
        photo={photos[1]}
        position="٢ / ٣"
        playing
        intervalMs={5000}
        visible
        onInteract={() => {}}
        onTogglePlay={() => {}}
        onPrevious={() => {}}
        onNext={() => {}}
        onOpenSpeedPicker={() => {}}
        onBack={() => {}}
      />,
      'ar',
    );
    expect(texts(r)).toEqual(
      expect.arrayContaining(['صورة من تصوير Ann Lee', '٢ / ٣', 'كل ٥ ث']),
    );
  });
});

describe('filmstrip', () => {
  it('places itself on the current photo once its content is measured', async () => {
    const r = await renderInApp(
      <Filmstrip photos={photos} index={2} onSelect={() => {}} />,
      'ar',
    );
    const list = r.root.findByType(FlatList);
    const scrollToOffset = jest.fn();
    list.instance.scrollToOffset = scrollToOffset;
    act(() => list.props.onContentSizeChange(1000, 144));
    // Box 2 starts after two boxes: 176 (adjacent) + 120 (rest) + 2 gaps
    expect(scrollToOffset).toHaveBeenCalledWith({
      offset: 320,
      animated: false,
    });
    // Only the first measurement: later ones are size changes from moving
    act(() => list.props.onContentSizeChange(1100, 144));
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    expect(list.props.inverted).toBeUndefined();
  });

  it('jumps, without a slide, when the photo changes', async () => {
    let setIndex!: (index: number) => void;
    function Strip() {
      const [index, set] = React.useState(0);
      setIndex = set;
      return <Filmstrip photos={photos} index={index} onSelect={() => {}} />;
    }
    const r = await renderInApp(<Strip />);
    const scrollToOffset = jest.fn();
    r.root.findByType(FlatList).instance.scrollToOffset = scrollToOffset;
    act(() => setIndex(2));
    expect(scrollToOffset).toHaveBeenCalledWith({
      offset: 320,
      animated: false,
    });
  });
});

describe('album rail', () => {
  const albums: Album[] = [
    {
      id: 'a1',
      title: 'One',
      description: '',
      coverPhotoId: '',
      coverPhoto: null,
      photoCount: 3,
    },
  ];

  it('remounts when the direction changes', async () => {
    const en = await renderInApp(
      <AlbumRow
        albums={albums}
        onAlbumFocus={() => {}}
        onAlbumPress={() => {}}
      />,
    );
    const ar = await renderInApp(
      <AlbumRow
        albums={albums}
        onAlbumFocus={() => {}}
        onAlbumPress={() => {}}
      />,
      'ar',
    );
    const key = (r: typeof en) => r.root.findByType(FlatList).parent?.props;
    expect(key(en)).not.toEqual(key(ar));
  });
});

describe('Latin parts stay LTR in Arabic', () => {
  it('the keyboard keeps a–f left to right', async () => {
    const r = await renderInApp(
      <OnScreenKeyboard
        onKey={() => {}}
        onSpace={() => {}}
        onDelete={() => {}}
        onClear={() => {}}
      />,
      'ar',
    );
    const root = r.root
      .findAllByType(View)
      .find(v => flat(v.props.style).width === 376);
    expect(flat(root?.props.style).direction).toBe('ltr');
  });

  it('the magnifier drawing keeps its shape', async () => {
    const r = await renderInApp(<SearchBar onPress={() => {}} />, 'ar');
    const icon = r.root
      .findAllByType(View)
      .find(v => flat(v.props.style).width === 24);
    expect(flat(icon?.props.style).direction).toBe('ltr');
  });

  it('the search box is LTR once something is typed, RTL for its Arabic placeholder', async () => {
    const r = await renderInApp(<SearchScreen onBack={() => {}} />, 'ar');
    const box = () =>
      r.root
        .findAllByType(View)
        .find(
          v =>
            flat(v.props.style).height === 56 &&
            flat(v.props.style).paddingHorizontal,
        );
    expect(flat(box()?.props.style).direction).toBeUndefined();
    const keyA = r.root.find(
      n =>
        typeof n.props.onPress === 'function' &&
        texts({ root: n } as never).includes('a'),
    );
    act(() => keyA.props.onPress());
    expect(flat(box()?.props.style).direction).toBe('ltr');
  });
});
