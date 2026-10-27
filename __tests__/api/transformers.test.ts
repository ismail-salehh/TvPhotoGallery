import { toAlbum, toPhoto } from '../../src/api/transformers';
import type { UnsplashCollection, UnsplashPhoto } from '../../src/api/types';

const photo = (overrides: Partial<UnsplashPhoto> = {}): UnsplashPhoto => ({
  id: 'p1',
  width: 4000,
  height: 3000,
  description: 'A lake',
  alt_description: 'water',
  created_at: '2024-03-12T10:00:00Z',
  urls: {
    raw: 'https://images.unsplash.com/photo-1?ixlib=rb-4.1.0',
    full: 'https://images.unsplash.com/photo-1?fm=jpg&q=85',
    regular: 'https://images.unsplash.com/photo-1?w=1080&fm=jpg',
    small: 'https://images.unsplash.com/photo-1?w=400&fm=avif&auto=format',
    thumb: 'https://images.unsplash.com/photo-1?w=200&fm=jpg',
  },
  user: { name: 'Ann Lee', username: 'ann' },
  ...overrides,
});

describe('toPhoto', () => {
  it('keeps what Unsplash sent', () => {
    expect(toPhoto(photo(), 'a1')).toEqual({
      id: 'p1',
      albumId: 'a1',
      title: 'A lake',
      imageUrl:
        'https://images.unsplash.com/photo-1?ixlib=rb-4.1.0&w=1920&q=80&fit=max&fm=jpg',
      thumbnailUrl: 'https://images.unsplash.com/photo-1?w=400&fm=jpg',
      photographer: 'Ann Lee',
      width: 4000,
      height: 3000,
      createdAt: '2024-03-12T10:00:00Z',
    });
  });

  it('falls back to the alt text, then to no title at all', () => {
    expect(toPhoto(photo({ description: '' })).title).toBe('water');
    expect(toPhoto(photo({ description: null })).title).toBe('water');
    expect(
      toPhoto(photo({ description: null, alt_description: null })).title,
    ).toBe('');
  });

  it('records no UI-language text: the cache must not hold any', () => {
    const untitled = toPhoto(photo({ description: null, alt_description: '' }));
    expect(untitled.title).toBe('');
    expect(JSON.stringify(untitled)).not.toMatch(/Photo by|تصوير/);
  });

  it('has an empty date when Unsplash gives none, and no album by default', () => {
    const result = toPhoto(photo({ created_at: undefined }));
    expect(result.createdAt).toBe('');
    expect(result.albumId).toBe('');
  });
});

describe('toAlbum', () => {
  const collection = (
    overrides: Partial<UnsplashCollection> = {},
  ): UnsplashCollection => ({
    id: 'a1',
    title: 'Lakes',
    description: 'Calm water',
    total_photos: 12,
    cover_photo: photo(),
    ...overrides,
  });

  it('carries the cover photo, tagged with the album', () => {
    const album = toAlbum(collection());
    expect(album).toMatchObject({
      id: 'a1',
      title: 'Lakes',
      description: 'Calm water',
      coverPhotoId: 'p1',
      photoCount: 12,
    });
    expect(album.coverPhoto?.albumId).toBe('a1');
  });

  it('handles a missing cover and description', () => {
    const album = toAlbum(collection({ cover_photo: null, description: null }));
    expect(album.coverPhoto).toBeNull();
    expect(album.coverPhotoId).toBe('');
    expect(album.description).toBe('');
  });
});
