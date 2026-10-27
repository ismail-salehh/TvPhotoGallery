import { formatDate, formatNumber } from '../../src/i18n/format';

describe('formatNumber', () => {
  it('writes English with Western digits and comma groups', () => {
    expect(formatNumber('en', 0)).toBe('0');
    expect(formatNumber('en', 999)).toBe('999');
    expect(formatNumber('en', 1000)).toBe('1,000');
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatNumber('en', 2.5)).toBe('2.5');
    expect(formatNumber('en', -1500)).toBe('-1,500');
  });

  it('writes Arabic with Arabic-Indic digits and Arabic separators', () => {
    expect(formatNumber('ar', 0)).toBe('٠');
    expect(formatNumber('ar', 40)).toBe('٤٠');
    expect(formatNumber('ar', 1234567)).toBe('١٬٢٣٤٬٥٦٧');
    expect(formatNumber('ar', 2.5)).toBe('٢٫٥');
    expect(formatNumber('ar', -1500)).toBe('-١٬٥٠٠');
  });

  it('leaves no Western digit in Arabic', () => {
    for (let n = 0; n < 2000; n += 37) {
      expect(formatNumber('ar', n)).not.toMatch(/[0-9]/);
    }
  });
});

describe('formatDate', () => {
  it('writes the date in each language, year ungrouped', () => {
    expect(formatDate('en', '2024-03-12T10:00:00Z')).toBe('March 12, 2024');
    expect(formatDate('ar', '2024-03-12T10:00:00Z')).toBe('١٢ مارس ٢٠٢٤');
    expect(formatDate('en', '1999-12-01')).toBe('December 1, 1999');
    expect(formatDate('ar', '2025-01-31')).toBe('٣١ يناير ٢٠٢٥');
  });

  it('keeps the calendar date as written, whatever the time zone', () => {
    expect(formatDate('en', '2024-03-12T23:59:59-11:00')).toBe(
      'March 12, 2024',
    );
  });

  it('gives "" for anything that is not a date', () => {
    for (const bad of [
      '',
      'yesterday',
      '2024-3-12',
      '2024-00-10',
      '2024-13-10',
      '2024-05-00',
      '2024-05-32',
    ]) {
      expect(formatDate('en', bad)).toBe('');
    }
  });
});
