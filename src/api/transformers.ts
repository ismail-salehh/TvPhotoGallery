import { jpegUrl } from './imageUrl';
import type { Album, Photo, UnsplashCollection, UnsplashPhoto } from './types';

// `urls.full` is the original upload (often 5+ MB); size it for a 1080p TV
const TV_IMAGE_PARAMS = { w: 1920, q: 80, fit: 'max' };

// Holds only what Unsplash sent, never text in the UI language: these
// objects are cached, and a missing title is filled in when shown
export function toPhoto(photo: UnsplashPhoto, albumId = ''): Photo {
  return {
    id: photo.id,
    albumId,
    // Unsplash sends "" as well as null for a missing description
    title: photo.description || photo.alt_description || '',
    imageUrl: jpegUrl(photo.urls.raw, TV_IMAGE_PARAMS),
    thumbnailUrl: jpegUrl(photo.urls.small),
    photographer: photo.user.name,
    width: photo.width,
    height: photo.height,
    createdAt: photo.created_at ?? '',
  };
}

export function toAlbum(collection: UnsplashCollection): Album {
  return {
    id: collection.id,
    title: collection.title,
    description: collection.description ?? '',
    coverPhotoId: collection.cover_photo?.id ?? '',
    coverPhoto: collection.cover_photo
      ? toPhoto(collection.cover_photo, collection.id)
      : null,
    photoCount: collection.total_photos,
  };
}
