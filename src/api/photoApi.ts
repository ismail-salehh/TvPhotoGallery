import { unsplashGet } from './unsplash';
import { toAlbum, toPhoto } from './transformers';
import type {
  Album,
  PaginatedResponse,
  Photo,
  UnsplashCollection,
  UnsplashPhoto,
  UnsplashSearchResponse,
} from './types';

const DEFAULT_PAGE_SIZE = 20;

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
  totalItems: number,
): PaginatedResponse<T> {
  return {
    items,
    page,
    pageSize,
    totalItems,
    hasNextPage: page * pageSize < totalItems,
  };
}

// Albums map to Unsplash collections

export async function getAlbums(
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResponse<Album>> {
  const { data, total } = await unsplashGet<UnsplashCollection[]>(
    '/collections',
    { page, per_page: pageSize },
  );
  return paginate(data.map(toAlbum), page, pageSize, total);
}

export async function getAlbum(albumId: string): Promise<Album> {
  const { data } = await unsplashGet<UnsplashCollection>(
    `/collections/${albumId}`,
  );
  return toAlbum(data);
}

export async function getAlbumPhotos(
  albumId: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResponse<Photo>> {
  const { data, total } = await unsplashGet<UnsplashPhoto[]>(
    `/collections/${albumId}/photos`,
    { page, per_page: pageSize },
  );
  return paginate(
    data.map(photo => toPhoto(photo, albumId)),
    page,
    pageSize,
    total,
  );
}

// Photos

export async function getPhoto(photoId: string): Promise<Photo> {
  const { data } = await unsplashGet<UnsplashPhoto>(`/photos/${photoId}`);
  return toPhoto(data);
}

// `albumId` limits the search to that album's photos
export async function searchPhotos(
  query: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
  albumId?: string,
): Promise<PaginatedResponse<Photo>> {
  const { data } = await unsplashGet<UnsplashSearchResponse<UnsplashPhoto>>(
    '/search/photos',
    {
      query,
      page,
      per_page: pageSize,
      ...(albumId ? { collections: albumId } : {}),
    },
  );
  return paginate(
    data.results.map(photo => toPhoto(photo, albumId)),
    page,
    pageSize,
    data.total,
  );
}

export async function searchAlbums(
  query: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResponse<Album>> {
  const { data } = await unsplashGet<
    UnsplashSearchResponse<UnsplashCollection>
  >('/search/collections', { query, page, per_page: pageSize });
  return paginate(data.results.map(toAlbum), page, pageSize, data.total);
}
