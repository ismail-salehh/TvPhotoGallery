import { parseLink } from '../../src/app/navigation/deepLinks';

describe('parseLink', () => {
  it.each([
    ['tvphotogallery://photo/abc_D-1', { kind: 'photo', id: 'abc_D-1' }],
    ['tvphotogallery://album/1967040', { kind: 'album', id: '1967040' }],
    ['tvphotogallery://album/x/', { kind: 'album', id: 'x' }],
    ['tvphotogallery://photo/x?utm=tv', { kind: 'photo', id: 'x' }],
    ['https://tv.test/#/photo/abc', { kind: 'photo', id: 'abc' }],
    ['http://localhost:8080/app/?q=1#/album/a1/', { kind: 'album', id: 'a1' }],
    ['file:///index.html#/photo/p#more', { kind: 'photo', id: 'p' }],
  ])('opens %s', (url, target) => {
    expect(parseLink(url)).toEqual(target);
  });

  it.each([
    '',
    'tvphotogallery://',
    'tvphotogallery://photo/',
    'tvphotogallery://user/abc',
    'otherapp://photo/abc',
    'https://tv.test/photo/abc',
    // Anything that could reach another API path is refused
    'tvphotogallery://photo/../users/me',
    'tvphotogallery://photo/a%2F..%2Fme',
    'tvphotogallery://photo/a/b',
    'tvphotogallery://photo/a b',
    `tvphotogallery://photo/${'a'.repeat(65)}`,
  ])('ignores %s', url => {
    expect(parseLink(url)).toBeNull();
  });
});
