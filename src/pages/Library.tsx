import { useI18n } from '../i18n';
import { BookOpen, Compass, Grid2X2, Heart, List, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { officialPage } from '../lib/roblox';
import { useCatalog } from '../hooks/useCatalog';
import type { LibraryStore } from '../hooks/useLibrary';
import type { Game, Page } from '../lib/types';
import { EmptyState, GameCard, Loading } from '../components/ui';
import { RequestHistory } from '../components/RequestHistory';
import { useLauncher } from '../hooks/useLauncher';
import { storageLabel } from '../lib/storage';

export function Library({
  library,
  navigate,
  selectGame,
}: {
  library: LibraryStore;
  navigate: (page: Page) => void;
  selectGame: (game: Game) => void;
}) {
  const { t, number, locale } = useI18n();
  const launcher = useLauncher();
  const { experiences: games } = useCatalog();
  const unknownIds = library.data.favorites.filter(
    (id) => !games.some((g) => g.id === id),
  );
  const [tab, setTab] = useState('Favorites');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Recently added');
  const ids = [...library.data.favorites].reverse();
  const results = ids
    .map((id) => games.find((g) => g.id === id))
    .filter((g): g is Game => Boolean(g))
    .sort((a, b) =>
      sort === 'Name' ? a.name.localeCompare(b.name, locale) : 0,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('Your library')}</h1>
          <p>{t('A home for the experiences you love.')}</p>
        </div>
        <span className="storage-label">
          <span className="status-dot violet" />
          {t(storageLabel)}
        </span>
      </div>
      <div className="library-toolbar">
        <div className="segmented" aria-label={t('Library collection')}>
          {(['Favorites', 'Recent requests'] as const).map((label) => (
            <button
              key={label}
              className={tab === label ? 'active' : ''}
              aria-pressed={tab === label}
              onClick={() => setTab(label)}
            >
              {label === 'Favorites' ? (
                <Heart size={16} />
              ) : (
                <Clock3 size={16} />
              )}
              {t(label)}
              <span>
                {label === 'Favorites'
                  ? number(library.data.favorites.length)
                  : number(launcher.history.length)}
              </span>
            </button>
          ))}
        </div>
        {tab === 'Favorites' && (
          <div className="flex items-center gap-3">
            <select
              aria-label={t('Sort library')}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="Recently added">{t('Recently added')}</option>
              <option value="Name">{t('Name')}</option>
            </select>
            <div className="segmented view-switch">
              <button
                className={view === 'grid' ? 'active' : ''}
                aria-label={t('Grid view')}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                className={view === 'list' ? 'active' : ''}
                aria-label={t('List view')}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
      {tab === 'Recent requests' ? (
        <RequestHistory selectGame={selectGame} />
      ) : library.loading ? (
        <Loading />
      ) : !library.ready ? (
        <EmptyState
          title={t('Could not load your library')}
          action={
            <button className="button" onClick={() => void library.reload()}>
              {t('Retry')}
            </button>
          }
        >
          {t(
            'Your saved data has not been overwritten. Resolve the storage error and try again.',
          )}
        </EmptyState>
      ) : ids.length ? (
        <>
          <p className="section-description library-description">
            {t('experiences.count', { count: ids.length })}{' '}
            {t(
              '· game details from Roblox snapshots; unrecognized Place IDs are preserved',
            )}
          </p>
          <div
            className={
              view === 'grid' ? 'game-grid library-grid' : 'library-list'
            }
          >
            {unknownIds.map((id) => (
              <article className="panel unknown-experience" key={id}>
                <h3>{t('Place {id}', { id })}</h3>
                <p>
                  {t(
                    'Metadata unavailable. Look up its Universe ID in Discover; Place and Universe IDs are different.',
                  )}
                </p>
                {officialPage('games', id) ? (
                  <a
                    className="text-link"
                    href={officialPage('games', id)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Open official experience page')}
                  </a>
                ) : (
                  <p>
                    {t(
                      'Stored identifier cannot form a valid Roblox Place URL. The record has been preserved.',
                    )}
                  </p>
                )}
                <button
                  className="text-button"
                  disabled={!library.ready || library.saving}
                  onClick={() => void library.toggleFavorite(id)}
                  aria-label={t('Remove Place {id} from favorites', { id })}
                >
                  {t('Remove favorite')}
                </button>
              </article>
            ))}
            {results.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                library={library}
                onSelect={selectGame}
                list={view === 'list'}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="panel library-empty">
          <EmptyState
            icon={<BookOpen size={32} />}
            title={t('Good things belong here.')}
            action={
              <button
                className="button primary"
                onClick={() => navigate('discover')}
              >
                <Compass size={17} />
                {t('Discover games')}
              </button>
            }
          >
            {t(
              'Tap the heart on any game to save it to your library. Your favorites stay on this device.',
            )}
          </EmptyState>
        </div>
      )}
    </>
  );
}
