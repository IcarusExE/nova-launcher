import { BookOpen, Compass, Grid2X2, Heart, List, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { games } from '../data/games';
import type { LibraryStore } from '../hooks/useLibrary';
import type { Game, Page } from '../lib/types';
import { EmptyState, GameCard, Loading } from '../components/ui';
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
  const [tab, setTab] = useState('Favorites');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState('Recently added');
  const ids =
    tab === 'Favorites'
      ? [...library.data.favorites].reverse()
      : library.data.recent.map((r) => r.gameId);
  const results = ids
    .map((id) => games.find((g) => g.id === id))
    .filter((g): g is Game => Boolean(g))
    .sort((a, b) => (sort === 'Name' ? a.name.localeCompare(b.name) : 0));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your library</h1>
          <p>A home for the experiences you love.</p>
        </div>
        <span className="storage-label">
          <span className="status-dot violet" />
          {storageLabel}
        </span>
      </div>
      <div className="library-toolbar">
        <div className="segmented" aria-label="Library collection">
          {['Favorites', 'Recently launched'].map((label) => (
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
              {label}
              <span>
                {label === 'Favorites'
                  ? library.data.favorites.length
                  : library.data.recent.length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select
            aria-label="Sort library"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option>Recently added</option>
            <option>Name</option>
          </select>
          <div className="segmented view-switch">
            <button
              className={view === 'grid' ? 'active' : ''}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <Grid2X2 size={17} />
            </button>
            <button
              className={view === 'list' ? 'active' : ''}
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>
      {library.loading ? (
        <Loading />
      ) : !library.ready ? (
        <EmptyState
          title="Could not load your library"
          action={
            <button className="button" onClick={() => void library.reload()}>
              Retry
            </button>
          }
        >
          Your saved data has not been overwritten. Resolve the storage error
          and try again.
        </EmptyState>
      ) : results.length ? (
        <>
          <p className="section-description library-description">
            {results.length}{' '}
            {results.length === 1 ? 'experience' : 'experiences'} · game details
            use development fixtures
          </p>
          <div
            className={
              view === 'grid' ? 'game-grid library-grid' : 'library-list'
            }
          >
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
            icon={
              tab === 'Favorites' ? (
                <BookOpen size={32} />
              ) : (
                <Clock3 size={32} />
              )
            }
            title={
              tab === 'Favorites'
                ? 'Good things belong here.'
                : 'Your next chapter starts here.'
            }
            action={
              <button
                className="button primary"
                onClick={() => navigate('discover')}
              >
                <Compass size={17} />
                Discover games
              </button>
            }
          >
            {tab === 'Favorites'
              ? 'Tap the heart on any game to save it to your library. Your favorites stay on this device.'
              : 'Recently launched games will appear here when native launching is available in a future milestone.'}
          </EmptyState>
        </div>
      )}
    </>
  );
}
