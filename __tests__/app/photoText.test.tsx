import React from 'react';
import { Animated, Image } from 'react-native';

import type { Photo } from '../../src/api/types';
import { PhotoCard } from '../../src/app/components/photo/PhotoCard';
import { SlideshowScreen } from '../../src/app/screens/SlideshowScreen';
import { renderInApp, texts } from '../helpers/renderApp';

const photo = (id: string, title = ''): Photo => ({
  id,
  albumId: 'a',
  title,
  imageUrl: `https://images.unsplash.com/${id}?fm=jpg`,
  thumbnailUrl: `https://images.unsplash.com/${id}?w=400&fm=jpg`,
  photographer: 'Ann Lee',
  width: 4,
  height: 3,
  createdAt: '',
});

beforeEach(() => {
  jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('photo text in the UI language', () => {
  it('a photo card reads out the fallback title in Arabic', async () => {
    const r = await renderInApp(
      <PhotoCard photo={photo('p1')} width={300} />,
      'ar',
    );
    const labels = r.root
      .findAll(n => typeof n.props.accessibilityLabel === 'string')
      .map(n => n.props.accessibilityLabel);
    expect(labels).toContain('صورة من تصوير Ann Lee، تصوير Ann Lee');
  });

  it('the slideshow shows its position in Arabic digits and labels slides in Arabic', async () => {
    const r = await renderInApp(
      <SlideshowScreen
        photos={[photo('p1'), photo('p2', 'A lake'), photo('p3')]}
        initialIndex={1}
        onBack={() => {}}
      />,
      'ar',
    );
    expect(texts(r)).toEqual(expect.arrayContaining(['٢ / ٣', 'A lake']));
    const slide = r.root.findAll(
      n => n.type === Animated.Image && n.props.accessibilityLabel,
    );
    expect(slide.map(n => n.props.accessibilityLabel)).toContain(
      'A lake، تصوير Ann Lee',
    );
  });
});
