import { en } from './en';
import { tr } from './tr';
import type {
  LanguagePreference,
  Locale,
  Message,
  MessageKey,
  Values,
} from './types';
export const resources = { en, tr };
export const pageKeys = {
  home: 'Home',
  discover: 'Discover',
  library: 'Library',
  profile: 'Profile',
  settings: 'Settings',
} as const;
export const accentKeys = {
  violet: 'Nova Violet',
  blue: 'Blue',
  teal: 'Teal',
  amber: 'Amber',
} as const;
export function detectLocale(locales: readonly string[]): Locale {
  // Use the primary OS/browser language; an English fallback in a preference
  // list must not override Turkish, nor a secondary Turkish override English.
  return /^tr(?:[-_.@]|$)/i.test(locales[0] ?? '') ? 'tr' : 'en';
}
export function resolveLocale(
  preference: LanguagePreference,
  system: Locale,
): Locale {
  return preference === 'system' ? system : preference;
}
export function translate(
  locale: Locale,
  key: MessageKey,
  values: Values = {},
): string {
  const message: Message = resources[locale][key];
  const text =
    typeof message === 'string'
      ? message
      : message[
          new Intl.PluralRules(locale).select(Number(values.count)) === 'one'
            ? 'one'
            : 'other'
        ];
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined)
      throw new Error(`Missing interpolation ${name} for ${key}`);
    return typeof value === 'number'
      ? new Intl.NumberFormat(locale).format(value)
      : value;
  });
}
export function formatDate(
  locale: Locale,
  value: string | number,
  includeTime = false,
): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? translate(locale, 'date unavailable')
    : new Intl.DateTimeFormat(
        locale,
        includeTime
          ? { dateStyle: 'medium', timeStyle: 'short' }
          : { dateStyle: 'medium' },
      ).format(date);
}
export function relativeTime(
  locale: Locale,
  time: number,
  now = Date.now(),
): string {
  const seconds = (time - now) / 1000;
  const [unit, size] =
    Math.abs(seconds) >= 86400
      ? (['day', 86400] as const)
      : Math.abs(seconds) >= 3600
        ? (['hour', 3600] as const)
        : Math.abs(seconds) >= 60
          ? (['minute', 60] as const)
          : (['second', 1] as const);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    Math.round(seconds / size),
    unit,
  );
}
