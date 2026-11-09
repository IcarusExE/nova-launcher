import type { en } from './en';
export type Locale = 'en' | 'tr';
export type LanguagePreference = 'system' | Locale;
export type MessageKey = keyof typeof en;
export type Message = string | { one: string; other: string };
export type Resources = {
  [K in MessageKey]: (typeof en)[K] extends string
    ? string
    : { one: string; other: string };
};
export type Values = Record<string, string | number>;
