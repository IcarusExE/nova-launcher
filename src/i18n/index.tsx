import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  detectLocale,
  formatDate,
  relativeTime,
  resolveLocale,
  translate,
} from './core';
import type { LanguagePreference, Locale, MessageKey, Values } from './types';
export { accentKeys, pageKeys } from './core';
export type { Locale, MessageKey, LanguagePreference } from './types';
const browserLocale = () =>
  detectLocale(
    navigator.languages?.length ? navigator.languages : [navigator.language],
  );
function createLocale(locale: Locale, ready: boolean) {
  return {
    locale,
    ready,
    t: (key: MessageKey, values?: Values) => translate(locale, key, values),
    number: (value: number, compact = false) =>
      new Intl.NumberFormat(
        locale,
        compact ? { notation: 'compact', maximumFractionDigits: 1 } : {},
      ).format(value),
    percent: (value: number) =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 0,
      }).format(value / 100),
    date: (value: string | number, time = false) =>
      formatDate(locale, value, time),
    relative: (value: number) => relativeTime(locale, value),
  };
}
// Defaults support isolated shared-component rendering; the app always provides
// its persisted preference through one stable provider, never a language key.
const Context = createContext(createLocale('en', true));
let systemRequest: Promise<string> | undefined;
export function I18nProvider({
  preference,
  loaded,
  children,
}: {
  preference: LanguagePreference;
  loaded: boolean;
  children: ReactNode;
}) {
  const [system, setSystem] = useState(browserLocale);
  const [systemReady, setSystemReady] = useState(!isTauri());
  useEffect(() => {
    if (!isTauri()) {
      const changed = () => setSystem(browserLocale());
      window.addEventListener('languagechange', changed);
      return () => window.removeEventListener('languagechange', changed);
    }
    let active = true;
    systemRequest ??= invoke<string>('system_locale');
    void systemRequest
      .then((value) => {
        if (active) setSystem(detectLocale([value]));
      })
      .catch(() => {
        /* Navigator is a safe fallback when OS locale detection is unavailable. */
      })
      .finally(() => {
        if (active) setSystemReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const locale = resolveLocale(preference, system);
  const ready = loaded && (preference !== 'system' || systemReady);
  const value = useMemo(() => createLocale(locale, ready), [locale, ready]);
  useLayoutEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        value.t(
          'Nova Launcher — your space to discover and collect Roblox experiences.',
        ),
      );
  }, [locale, ready, value]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);
