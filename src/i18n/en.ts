import type { Entry } from './index';

// The source dictionary: every other language must have the same keys.
// `{name}` is filled from the params passed to t(); entries with plural
// forms pick one by the `count` param.
export const en = {
  'app.name': 'Photo Gallery',

  'common.back': '‹ Back',
  'common.retry': 'Retry',
  'common.photoCount': { one: '{count} photo', other: '{count} photos' },
  'common.photoCredit': 'Photo by {name} on Unsplash',
  // Where a photo is in its list, e.g. "4 / 40"
  'common.position': '{current} / {total}',

  // What a screen reader says for a photo: one item, with its title
  'a11y.photo': '{title}, photo by {name}',

  'status.loading.title': 'Loading…',
  'status.loading.slow': 'This is taking longer than usual.',
  'status.empty.title': 'Nothing here yet',
  'status.empty.message': 'There is nothing to show right now.',
  'status.error.title': 'Something went wrong',
  'status.error.message': 'Please try again.',
  'status.offline.title': "You're offline",
  'status.offline.message': 'Check your internet connection, then try again.',
  'status.timeout': 'The server took too long to answer. Try again.',
  'status.crash.title': 'Something went wrong here',
  'status.crash.message':
    'This part of the app hit a problem. The rest still works.',
  'status.rateLimited':
    'Too many requests to Unsplash. Wait a while, then try again.',

  'home.searchPlaceholder': 'Search albums',
  // One rail of albums, by their place in the list, e.g. "Albums 11–20"
  'home.rail': 'Albums {from}–{to}',
  'home.settings': 'Settings',
  'home.loading': 'Loading albums…',
  'home.loadFailed': "Couldn't load albums",
  'home.loadMoreFailed': "Couldn't load more albums",
  'home.emptyTitle': 'No albums yet',
  'home.emptyMessage': "Unsplash didn't return any albums.",

  'exit.title': 'Leave Photo Gallery?',
  'exit.confirm': 'Exit',
  'exit.cancel': 'Cancel',

  'album.untitled': 'Untitled album',
  'album.slideshow': '▶︎ Slideshow',
  'album.search': 'Search',
  'album.loading': 'Loading photos…',
  'album.loadFailed': "Couldn't load photos",
  'album.loadMoreFailed': "Couldn't load more photos",
  'album.emptyTitle': 'No photos to show',
  'album.emptyMessage': "The photos in this album aren't available.",

  'album.opening': 'Loading album…',
  'album.openFailed': "Couldn't load this album",
  'album.missingTitle': 'No album to show',
  'album.missingMessage': "This album isn't available.",

  'photo.emptyTitle': 'No photo to show',
  'photo.emptyMessage': "This photo isn't available.",
  'photo.unavailable': 'Photo unavailable',
  'photo.loadFailed': "Couldn't load this photo",
  // Title of a photo Unsplash gave no description
  'photo.untitled': 'Photo by {name}',
  'photo.loading': 'Loading photo…',

  'slideshow.previous': 'Previous',
  'slideshow.next': 'Next',
  'slideshow.play': 'Play',
  'slideshow.pause': 'Pause',
  'slideshow.every': 'Every {seconds}s',
  'slideshow.speedTitle': 'Slideshow speed',
  'slideshow.emptyTitle': 'No photos to show',
  'slideshow.emptyMessage': 'There are no photos to play in this album.',
  'slideshow.loadFailed': "Couldn't load these photos",

  'search.title': 'Search',
  'search.searching': 'Searching…',
  'search.loadMoreFailed': "Couldn't load more results",
  'search.emptyMessage': 'Try a different or shorter search.',
  'search.albums.placeholder': 'Search albums',
  'search.albums.hintTitle': 'Search Unsplash albums',
  'search.albums.hintMessage':
    'Type a word like “mountains” or “coffee” to find albums.',
  'search.albums.loadFailed': "Couldn't search albums",
  'search.albums.emptyTitle': 'No albums for “{query}”',
  // Searching inside one album; {album} is its title
  'search.photos.title': 'Search in “{album}”',
  'search.photos.placeholder': 'Search this album',
  'search.photos.hintTitle': 'Search this album',
  'search.photos.hintMessage':
    'Type a word like “tree” or “sky” to find photos in this album.',
  'search.photos.loadFailed': "Couldn't search photos",
  'search.photos.emptyTitle': 'No photos for “{query}” in this album',
  'search.space': 'Space',
  'search.delete': 'Delete',
  'search.clear': 'Clear',

  'settings.title': 'Settings',
  'settings.slideshow': 'Slideshow',
  'settings.speed': 'Starting speed',
  'settings.speedHint':
    'How long each photo stays on screen when a slideshow starts. You can still change it while the slideshow plays.',
  'settings.seconds': { one: '{count} second', other: '{count} seconds' },
  'settings.language': 'Language',
  'settings.languageHint':
    'The language of menus and messages. Photo and album titles stay as Unsplash provides them.',
  'settings.about': 'About',
  'settings.aboutDescription':
    'Browse, search and play photo albums as a slideshow on your TV.',
  'settings.version': 'Version {version}',
  'settings.device': 'Device',
  'settings.system': 'System',
  'settings.unknown': 'Unknown',
  'settings.photosCredit':
    'Photos are provided by Unsplash. Each photographer is credited next to their photos.',
  'settings.controls':
    'Use the arrows on your remote to move, OK to select and Back to go back.',
} satisfies Record<string, Entry>;
