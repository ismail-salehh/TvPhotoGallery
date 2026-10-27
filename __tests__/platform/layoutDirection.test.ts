import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { I18nManager } from 'react-native';

import * as native from '../../src/platform/layoutDirection';

const scroll = (x: number, y = 0) =>
  ({
    nativeEvent: {
      contentOffset: { x, y },
      contentSize: { width: 3000, height: 5000 },
      layoutMeasurement: { width: 1920, height: 1080 },
    },
  } as unknown as NativeSyntheticEvent<NativeScrollEvent>);

describe('native layoutDirection', () => {
  afterEach(() => native.applyLayoutDirection(false, 'en'));

  it('tells FlatList the direction, live', () => {
    native.applyLayoutDirection(true, 'ar');
    expect(I18nManager.isRTL).toBe(true);
    native.applyLayoutDirection(false, 'en');
    expect(I18nManager.isRTL).toBe(false);
  });

  it('uses the layout `direction` style and never mirrors lists itself', () => {
    expect(native.directionStyle(true)).toEqual({ direction: 'rtl' });
    expect(native.directionStyle(false)).toEqual({ direction: 'ltr' });
    expect(native.directionProps(true)).toEqual({});
    expect(native.horizontalListMirroring(true)).toEqual({});
    expect(native.horizontalListMirroring(false)).toEqual({});
  });

  it('measures scroll from the start edge: the right one in RTL', () => {
    // 3000 wide content, 1920 viewport: scrolled fully left is 1080 from
    // the right edge
    expect(native.scrollOffsetFromStart(scroll(0), true, true)).toBe(1080);
    expect(native.scrollOffsetFromStart(scroll(1080), true, true)).toBe(0);
    expect(native.scrollOffsetFromStart(scroll(300), true, false)).toBe(300);
    expect(native.scrollOffsetFromStart(scroll(300, 40), false, true)).toBe(40);
  });
});

describe('web layoutDirection', () => {
  type Web = typeof import('../../src/platform/layoutDirection.web');
  const documentElement = { lang: 'en', dir: 'ltr' };
  let web: Web;
  beforeAll(() => {
    (globalThis as { document?: unknown }).document = { documentElement };
    jest.isolateModules(() => {
      web = require('../../src/platform/layoutDirection.web');
    });
  });
  afterAll(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it('sets the page language and direction', () => {
    web.applyLayoutDirection(true, 'ar');
    expect(documentElement).toEqual({ lang: 'ar', dir: 'rtl' });
    web.applyLayoutDirection(false, 'en');
    expect(documentElement).toEqual({ lang: 'en', dir: 'ltr' });
  });

  it('uses writingDirection, the style react-native-web accepts', () => {
    expect(web.directionStyle(true)).toEqual({ writingDirection: 'rtl' });
    expect(web.directionStyle(false)).toEqual({ writingDirection: 'ltr' });
  });

  it('sets `dir`, which react-native-web resolves marginStart by', () => {
    expect(web.directionProps(true)).toEqual({ dir: 'rtl' });
    expect(web.directionProps(false)).toEqual({ dir: 'ltr' });
  });

  it('draws RTL horizontal lists as mirrored LTR lists', () => {
    expect(web.horizontalListMirroring(true)).toEqual({
      inverted: true,
      style: { writingDirection: 'ltr' },
    });
    expect(web.horizontalListMirroring(false)).toEqual({});
  });

  it('reads offsets as they come: the mirrored list is LTR inside', () => {
    expect(web.scrollOffsetFromStart(scroll(300), true, true)).toBe(300);
    expect(web.scrollOffsetFromStart(scroll(300, 40), false, true)).toBe(40);
  });
});
