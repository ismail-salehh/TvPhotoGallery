import { ar } from './ar';
import { en } from './en';
import { formatNumber } from './format';

export type Language = 'en' | 'ar';

export const LANGUAGES: Language[] = ['en', 'ar'];

// Each language's name in that language, so it can be recognized by
// someone who can't read the current one
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ar: 'العربية',
};

// CLDR plural categories; a language only fills the ones it uses
type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export type Entry = string | PluralForms;
export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, Entry>;
export type TranslationParams = Record<string, string | number>;

const DICTIONARIES: Record<Language, Dictionary> = { en, ar };

// Hand-written rather than Intl.PluralRules, which not every TV's
// JavaScript engine ships
function pluralCategory(language: Language, count: number): keyof PluralForms {
  if (language === 'ar') {
    const lastTwo = count % 100;
    if (count === 0) {
      return 'zero';
    }
    if (count === 1) {
      return 'one';
    }
    if (count === 2) {
      return 'two';
    }
    if (lastTwo >= 3 && lastTwo <= 10) {
      return 'few';
    }
    if (lastTwo >= 11) {
      return 'many';
    }
    return 'other';
  }
  return count === 1 ? 'one' : 'other';
}

export function translate(
  language: Language,
  key: TranslationKey,
  params: TranslationParams = {},
) {
  // Every dictionary has every key (Dictionary type, and a test)
  const entry = DICTIONARIES[language][key];
  const template =
    typeof entry === 'string'
      ? entry
      : entry[pluralCategory(language, Number(params.count ?? 0))] ??
        entry.other;
  // Numbers are written in the language's digits; strings go in as given
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      return match;
    }
    return typeof value === 'number' ? formatNumber(language, value) : value;
  });
}

// Text direction of each language
export const RTL_LANGUAGES: ReadonlySet<Language> = new Set(['ar']);
