import type { Language } from './index';

// Hand-written like the plural rules: TV engines' Intl support differs, and
// each language must read the same on every target
type NumberStyle = { digits: string; group: string; decimal: string };

const NUMBER_STYLES: Record<Language, NumberStyle> = {
  en: { digits: '0123456789', group: ',', decimal: '.' },
  ar: { digits: '٠١٢٣٤٥٦٧٨٩', group: '٬', decimal: '٫' },
};

const MONTHS: Record<Language, string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  ar: [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
};

export function formatNumber(language: Language, value: number) {
  const [whole, fraction] = String(Math.abs(value)).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+$)/g, ',');
  const text = fraction === undefined ? grouped : `${grouped}.${fraction}`;
  const localized = localizeDigits(language, text);
  return value < 0 ? `-${localized}` : localized;
}

// The calendar date of an ISO 8601 timestamp as written, without converting
// time zones; "" when it doesn't start with a valid YYYY-MM-DD
export function formatDate(language: Language, iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const month = match && MONTHS[language][Number(match[2]) - 1];
  if (!match || !month || match[3] === '00' || Number(match[3]) > 31) {
    return '';
  }
  // Years are not grouped: 2024, not 2,024
  const day = localizeDigits(language, String(Number(match[3])));
  const year = localizeDigits(language, match[1]);
  return language === 'en'
    ? `${month} ${day}, ${year}`
    : `${day} ${month} ${year}`;
}

// Western digits, "," and "." in `text` written in the language's style
function localizeDigits(language: Language, text: string) {
  const style = NUMBER_STYLES[language];
  return text.replace(/[0-9.,]/g, char =>
    char === ','
      ? style.group
      : char === '.'
      ? style.decimal
      : style.digits[+char],
  );
}
