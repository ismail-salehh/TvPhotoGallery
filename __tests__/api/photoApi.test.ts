import {
  getAlbum,
  getAlbumPhotos,
  getAlbums,
  getPhoto,
  searchAlbums,
  searchPhotos,
} from '../../src/api/photoApi';

const unsplashPhoto = (id: string) => ({
  id,
  width: 4,
  height: 3,
  description: null,
  alt_description: `photo ${id}`,
  urls: {
    raw: `https://images.unsplash.com/${id}`,
    full: '',
    regular: '',
    small: `https://images.unsplash.com/${id}?w=400`,
    thumb: '',
  },
  user: { name: 'Ann Lee', username: 'ann' },
});

let answer: unknown;
let total: string | null = null;
const fetchMock = globalThis.fetch as jest.Mock;
beforeEach(() => {
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    json: async () => answer,
    headers: { get: (name: string) => (name === 'X-Total' ? total : null) },
  }));
});
afterEach(() => {
  fetchMock.mockReset();
  total = null;
});

const requested = () => new URL(fetchMock.mock.calls[0][0]);

describe('searchPhotos', () => {
  it('searches everywhere without an album', async () => {
    answer = { total: 1, total_pages: 1, results: [unsplashPhoto('p1')] };
    const page = await searchPhotos('red', 1);
    expect(requested().pathname).toBe('/search/photos');
    expect(requested().searchParams.has('collections')).toBe(false);
    expect(page.items[0]).toMatchObject({ id: 'p1', albumId: '' });
  });

  it('with an album, asks for that album only and tags results with it', async () => {
    answer = { total: 45, total_pages: 3, results: [unsplashPhoto('p1')] };
    const page = await searchPhotos('red', 2, 20, 'a1');
    expect(requested().searchParams.get('collections')).toBe('a1');
    expect(requested().searchParams.get('page')).toBe('2');
    expect(page).toMatchObject({
      items: [{ id: 'p1', albumId: 'a1' }],
      totalItems: 45,
      hasNextPage: true,
    });
  });

  it('a typed query cannot change which album is searched', async () => {
    answer = { total: 0, total_pages: 0, results: [] };
    await searchPhotos('red&collections=other', 1, 20, 'a1');
    expect(requested().searchParams.getAll('collections')).toEqual(['a1']);
    expect(requested().searchParams.get('query')).toBe('red&collections=other');
  });
});

describe('searchAlbums', () => {
  it('asks the collection search and maps its results to albums', async () => {
    answer = {
      total: 21,
      total_pages: 2,
      results: [
        {
          id: 'c1',
          title: 'Red things',
          description: null,
          total_photos: 7,
          cover_photo: unsplashPhoto('p9'),
        },
      ],
    };
    const page = await searchAlbums('red', 1);
    expect(requested().pathname).toBe('/search/collections');
    expect(requested().searchParams.get('query')).toBe('red');
    expect(requested().searchParams.get('per_page')).toBe('20');
    expect(page).toMatchObject({
      items: [
        {
          id: 'c1',
          title: 'Red things',
          description: '',
          photoCount: 7,
          coverPhoto: { id: 'p9', albumId: 'c1' },
        },
      ],
      totalItems: 21,
      hasNextPage: true,
    });
  });
});

describe('albums and photos', () => {
  it('lists albums a page at a time, with the total from X-Total', async () => {
    answer = [
      {
        id: 'c1',
        title: 'Lakes',
        description: 'Still water',
        total_photos: 7,
        cover_photo: unsplashPhoto('p9'),
      },
    ];
    total = '41';
    const page = await getAlbums(3);
    expect(requested().pathname).toBe('/collections');
    expect(requested().searchParams.get('page')).toBe('3');
    expect(requested().searchParams.get('per_page')).toBe('20');
    expect(page).toMatchObject({
      items: [{ id: 'c1', title: 'Lakes', photoCount: 7 }],
      totalItems: 41,
      hasNextPage: false,
    });
  });

  it('gets one album, and an album’s photos tagged with it', async () => {
    answer = {
      id: 'c1',
      title: 'Lakes',
      description: 'Still water',
      total_photos: 7,
      cover_photo: unsplashPhoto('p9'),
    };
    expect(await getAlbum('c1')).toMatchObject({ id: 'c1', title: 'Lakes' });
    expect(requested().pathname).toBe('/collections/c1');

    fetchMock.mockClear();
    answer = [unsplashPhoto('p1'), unsplashPhoto('p2')];
    total = '22';
    const page = await getAlbumPhotos('c1', 1);
    expect(requested().pathname).toBe('/collections/c1/photos');
    expect(page).toMatchObject({
      items: [
        { id: 'p1', albumId: 'c1' },
        { id: 'p2', albumId: 'c1' },
      ],
      hasNextPage: true,
    });
  });

  it('gets one photo, belonging to no album', async () => {
    answer = unsplashPhoto('p5');
    expect(await getPhoto('p5')).toMatchObject({ id: 'p5', albumId: '' });
    expect(requested().pathname).toBe('/photos/p5');
  });
});
