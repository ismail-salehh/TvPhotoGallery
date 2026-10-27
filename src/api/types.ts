export type Album = {
  id: string;
  title: string;
  description: string;
  coverPhotoId: string;
  // Comes with the album list, so the hero can show it without another request
  coverPhoto: Photo | null;
  photoCount: number;
};

export type Photo = {
  id: string;
  albumId: string;
  // "" when Unsplash has none; the UI shows a translated fallback
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  // Unsplash requires crediting the photographer wherever a photo is shown
  photographer: string;
  width: number;
  height: number;
  // ISO 8601 date the photo was published, "" if unknown
  createdAt: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
};

// Raw Unsplash API shapes (only the fields we use)

export type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
  created_at?: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
  };
};

export type UnsplashCollection = {
  id: string;
  title: string;
  description: string | null;
  total_photos: number;
  cover_photo: UnsplashPhoto | null;
};

export type UnsplashSearchResponse<T> = {
  total: number;
  total_pages: number;
  results: T[];
};
