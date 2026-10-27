import { RTL_LANGUAGES, translate } from '../../src/i18n';
import { ar } from '../../src/i18n/ar';
import { en } from '../../src/i18n/en';

describe('translate', () => {
  it('writes number params in the language’s digits', () => {
    expect(translate('en', 'common.photoCount', { count: 1500 })).toBe(
      '1,500 photos',
    );
    expect(translate('ar', 'common.photoCount', { count: 1500 })).toBe(
      '١٬٥٠٠ صورة',
    );
    expect(translate('ar', 'common.position', { current: 4, total: 40 })).toBe(
      '٤ / ٤٠',
    );
  });

  it('puts string params in as given, digits and all', () => {
    expect(translate('ar', 'settings.version', { version: '1.0 (2)' })).toBe(
      'الإصدار 1.0 (2)',
    );
  });

  it('leaves a placeholder without a param as it is', () => {
    expect(translate('en', 'common.position', { current: 1 })).toBe(
      '1 / {total}',
    );
  });

  it('picks the Arabic plural form by count', () => {
    expect(translate('ar', 'common.photoCount', { count: 0 })).toBe(
      'لا توجد صور',
    );
    expect(translate('ar', 'common.photoCount', { count: 3 })).toBe('٣ صور');
    expect(translate('ar', 'common.photoCount', { count: 11 })).toBe('١١ صورة');
    expect(translate('ar', 'common.photoCount', { count: 1 })).toBe(
      'صورة واحدة',
    );
    expect(translate('ar', 'common.photoCount', { count: 2 })).toBe('صورتان');
    expect(translate('ar', 'common.photoCount', { count: 100 })).toBe(
      '١٠٠ صورة',
    );
    // "seconds" has no zero form: it falls back to "other"
    expect(translate('ar', 'settings.seconds', { count: 0 })).toBe('٠ ثانية');
    expect(translate('en', 'common.photoCount', { count: 1 })).toBe('1 photo');
    expect(translate('en', 'common.photoCount')).toBe('{count} photos');
  });

  it('lays Arabic out right to left and English left to right', () => {
    expect(RTL_LANGUAGES.has('ar')).toBe(true);
    expect(RTL_LANGUAGES.has('en')).toBe(false);
  });
});

describe('dictionaries', () => {
  it('have the same keys, so no Arabic screen shows an English string', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
});
