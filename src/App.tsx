import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { I18nProvider, useI18n, pageKeys } from './i18n';
import { LocalizedError } from './components/LocalizedError';
import type { LibraryStore } from './hooks/useLibrary';
import { CatalogProvider } from './hooks/useCatalog';
import { Shell } from './components/Shell';
import { GameDialog } from './components/ui';
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Library } from './pages/Library';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { useAppearance } from './hooks/useAppearance';
import { useLibrary } from './hooks/useLibrary';
import { LauncherContext, useLaunchController } from './hooks/useLauncher';
import type { Game, Page } from './lib/types';

export function App() {
  const library = useLibrary();
  return (
    <I18nProvider
      preference={library.data.preferences.language}
      loaded={!library.loading}
    >
      <LauncherApp library={library} />
    </I18nProvider>
  );
}
function LauncherApp({ library }: { library: LibraryStore }) {
  const { ready: localeReady, locale, t } = useI18n();
  const [page, setPage] = useState<Page>('home');
  const [query, setQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [windowError, setWindowError] = useState<string | null>(null);
  const appearanceReady = useAppearance(
    library.data.preferences,
    !library.loading && localeReady,
    setWindowError,
  );
  const startPageApplied = useRef(false);
  const launcher = useLaunchController(
    library.data.preferences.preferredAdapter,
    library.ready,
  );
  useEffect(() => {
    if (!library.loading && !startPageApplied.current) {
      setPage(library.data.preferences.startPage);
      startPageApplied.current = true;
    }
  }, [library.loading, library.data.preferences.startPage]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSelectedGame(null);
        setPage('discover');
        requestAnimationFrame(() =>
          document.querySelector<HTMLInputElement>('#discover-search')?.focus(),
        );
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    document.title = `Nova Launcher · ${t(pageKeys[page])}`;
  }, [page, locale, t]);
  const installation = launcher;
  const navigate = (next: Page) => {
    startPageApplied.current = true;
    setSelectedGame(null);
    setPage(next);
    document.getElementById('main-content')?.scrollTo(0, 0);
  };
  return (
    <CatalogProvider>
      <LauncherContext.Provider value={launcher}>
        <div
          className={`${appearanceReady ? '' : 'appearance-pending'} ${library.data.preferences.compactCards ? 'compact' : ''} ${library.data.preferences.reduceMotion ? 'reduce-motion' : ''}`}
          onClickCapture={(event) => {
            const anchor = (event.target as HTMLElement).closest('a');
            if (
              isTauri() &&
              anchor?.href.startsWith('https://www.roblox.com/')
            ) {
              event.preventDefault();
              void openUrl(anchor.href).catch(() =>
                setWindowError(
                  'Could not open the Roblox website in your browser.',
                ),
              );
            }
          }}
        >
          <a className="skip-link" href="#main-content">
            {t('Skip to content')}
          </a>
          <Shell
            page={page}
            navigate={navigate}
            onSearch={setQuery}
            favoriteCount={library.data.favorites.length}
            onError={setWindowError}
          >
            {(library.error || windowError) && (
              <div role="alert" className="error-banner">
                <AlertTriangle size={18} />
                <LocalizedError
                  error={library.error || windowError}
                  context={
                    library.error
                      ? library.errorOperation === 'read'
                        ? 'storageRead'
                        : 'storageSave'
                      : 'window'
                  }
                />
                {library.error ? (
                  <button
                    className="text-button"
                    onClick={() => void library.reload()}
                    disabled={library.loading}
                  >
                    <RefreshCw size={14} />
                    {t('Reload saved data')}
                  </button>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => setWindowError(null)}
                  >
                    {t('Dismiss')}
                  </button>
                )}
              </div>
            )}
            {page === 'home' && (
              <Home
                library={library}
                installation={installation}
                navigate={navigate}
                selectGame={setSelectedGame}
              />
            )}
            {page === 'discover' && (
              <Discover library={library} query={query} setQuery={setQuery} />
            )}
            {page === 'library' && (
              <Library
                library={library}
                navigate={navigate}
                selectGame={setSelectedGame}
              />
            )}
            {page === 'profile' && <Profile />}
            {page === 'settings' && (
              <Settings library={library} installation={installation} />
            )}
          </Shell>
          <GameDialog
            game={selectedGame}
            library={library}
            onClose={() => setSelectedGame(null)}
          />
        </div>
      </LauncherContext.Provider>
    </CatalogProvider>
  );
}
