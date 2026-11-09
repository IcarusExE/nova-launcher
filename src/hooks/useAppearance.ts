import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Preferences } from '../lib/types';
import { errorMessage } from '../lib/launcher';

export function useAppearance(
  preferences: Preferences,
  loaded: boolean,
  onError: (message: string) => void,
) {
  const [hydrated, setHydrated] = useState(false);
  const revealed = useRef(false);
  useLayoutEffect(() => {
    if (!loaded) return;
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme =
        preferences.theme === 'system'
          ? system.matches
            ? 'dark'
            : 'light'
          : preferences.theme;
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.accent = preferences.accent;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'light' ? '#f4f4f7' : '#111115');
    };
    apply();
    setHydrated(true);
    system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [loaded, preferences.theme, preferences.accent]);

  useEffect(() => {
    if (!hydrated || revealed.current || !isTauri()) return;
    // The native window starts hidden. Reveal only after SQLite hydration and
    // appearance application, including the readable fallback on a read error.
    // Do not wait for requestAnimationFrame here: hidden WebKit windows can
    // suspend frame callbacks, which would prevent the window ever appearing.
    revealed.current = true;
    void invoke('reveal_main_window', {
      theme: document.documentElement.dataset.theme,
    }).catch((error) =>
      onError(errorMessage(error, 'Could not show the Nova window.')),
    );
  }, [hydrated, onError]);
  return hydrated;
}
