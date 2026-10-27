import AsyncStorage from '@react-native-async-storage/async-storage';

import { jpegUrl } from '../../src/api/imageUrl';
import {
  getAlbum,
  getAlbumPhotos,
  getAlbums,
  getPhoto,
  searchAlbums,
  searchPhotos,
} from '../../src/api/photoApi';
import { isNotFound } from '../../src/api/unsplash';
import { parseLink } from '../../src/app/navigation/deepLinks';

type CacheModule = typeof import('../../src/api/cache');
const freshCache = (): CacheModule => {
  let mod!: CacheModule;
  jest.isolateModules(() => {
    mod = require('../../src/api/cache');
  });
  return mod;
};

// One album list for the whole run, to spare the hourly quota
let albums: Awaited<ReturnType<typeof getAlbums>>;
beforeAll(async () => {
  albums = await getAlbums(1, 10);
});

describe('live Unsplash', () => {
  it('every image the app will show is asked for as JPEG, once', () => {
    const urls = albums.items.flatMap(a =>
      a.coverPhoto ? [a.coverPhoto.imageUrl, a.coverPhoto.thumbnailUrl] : [],
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.match(/[?&]fm=/g)).toHaveLength(1);
      expect(url).toMatch(/[?&]fm=jpg(&|#|$)/);
      expect(url).not.toMatch(/[?&]auto=/);
    }
  });

  it('the server answers those URLs with a JPEG, even to a browser that accepts AVIF', async () => {
    const cover = albums.items.find(a => a.coverPhoto)!.coverPhoto!;
    for (const url of [cover.thumbnailUrl, cover.imageUrl]) {
      const response = await fetch(url, {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
      const bytes = new Uint8Array(await response.arrayBuffer());
      // JPEG files start FF D8 FF
      expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    }
  });

  it('left to negotiate, the server sends AVIF; jpegUrl takes that away', async () => {
    const cover = albums.items.find(a => a.coverPhoto)!.coverPhoto!;
    const negotiated = cover.thumbnailUrl.replace('fm=jpg', 'auto=format');
    const typeOf = async (url: string) =>
      (
        await fetch(url, {
          headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
        })
      ).headers.get('content-type');
    // The probe can see a non-JPEG answer when there is one
    expect(await typeOf(negotiated)).toMatch(/^image\/(avif|webp)$/);
    expect(await typeOf(jpegUrl(negotiated))).toBe('image/jpeg');
  });

  it('a photo link opens that photo, and an album link that album', async () => {
    const cover = albums.items.find(a => a.coverPhoto)!;
    const photoTarget = parseLink(
      `tvphotogallery://photo/${cover.coverPhoto!.id}`,
    )!;
    expect((await getPhoto(photoTarget.id)).id).toBe(cover.coverPhoto!.id);
    const albumTarget = parseLink(`https://tv.example/#/album/${cover.id}`)!;
    expect((await getAlbum(albumTarget.id)).title).toBe(cover.title);
  });

  it('a link to a photo that does not exist is a "not found", not a crash', async () => {
    const error = await getPhoto('doesNotExist0000').catch(e => e);
    expect(isNotFound(error)).toBe(true);
  });

  it('a real response survives a restart through the cache, in its language only', async () => {
    await AsyncStorage.clear();
    const first = freshCache();
    first.writeCache('ar', 'albums:10', albums);
    await new Promise<void>(resolve => setImmediate(() => resolve()));
    const second = freshCache();
    await second.hydrateCache();
    expect(second.readCache('ar', 'albums:10')).toEqual(
      JSON.parse(JSON.stringify(albums)),
    );
    expect(second.readCache('en', 'albums:10')).toBeUndefined();
    // Only Unsplash's own text was recorded, nothing in a UI language
    expect(JSON.stringify(albums)).not.toMatch(/Photo by|تصوير/);
  });

  it('searching albums finds albums, with what the rails show', async () => {
    const found = await searchAlbums('autumn', 1);
    expect(found.items.length).toBeGreaterThan(0);
    expect(found.totalItems).toBeGreaterThan(found.items.length);
    for (const album of found.items) {
      expect(album.id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(typeof album.photoCount).toBe('number');
    }
  });

  it('searching in an album finds only that album’s photos', async () => {
    // Small enough that one page lists every photo in it
    const small = albums.items
      .filter(a => a.photoCount > 0 && a.photoCount <= 30)
      .sort((a, b) => a.photoCount - b.photoCount)[0];
    expect(small).toBeDefined();
    const inAlbum = await getAlbumPhotos(small.id, 1, 30);
    const ids = new Set(inAlbum.items.map(p => p.id));
    const word = inAlbum.items
      .flatMap(p => p.title.toLowerCase().match(/[a-z]{4,}/g) ?? [])
      .sort((a, b) => b.length - a.length)[0];
    expect(word).toBeDefined();

    const scoped = await searchPhotos(word, 1, 30, small.id);
    // The probe finds something, and all of it is in the album
    expect(scoped.items.length).toBeGreaterThan(0);
    expect(scoped.items.filter(p => !ids.has(p.id))).toEqual([]);
    // Unscoped, the same word reaches beyond it: the album is what limits
    const everywhere = await searchPhotos(word, 1, 30);
    expect(everywhere.items.some(p => !ids.has(p.id))).toBe(true);
  });
});
