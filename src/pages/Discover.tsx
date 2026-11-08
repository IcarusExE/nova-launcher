import { SlidersHorizontal, Search, X, Heart, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { categories, filterGames, games } from '../data/games';
import type { Category, Game } from '../lib/types';
import type { LibraryStore } from '../hooks/useLibrary';
import {
  EmptyState,
  FixtureBadge,
  GameCard,
  GameDetails,
  Loading,
} from '../components/ui';

export function Discover({
  library,
  query,
  setQuery,
}: {
  library: LibraryStore;
  query: string;
  setQuery: (value: string) => void;
}) {
  const [category, setCategory] = useState<Category>('All games');
  const [sort, setSort] = useState('Popular');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<Game>(games[0]);
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>(
    'loading',
  );
  useEffect(() => {
    const timer = setTimeout(() => setStatus('ready'), 300);
    return () => clearTimeout(timer);
  }, []);
  const results = filterGames(
    query,
    category,
    sort,
    favoritesOnly ? library.data.favorites : undefined,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Discover</h1>
          <p>Find a new world to get lost in.</p>
        </div>
        <FixtureBadge />
      </div>
      <div className="discover-layout">
        <div className="discover-catalog">
          <div className="search-input">
            <Search size={19} />
            <input
              id="discover-search"
              aria-label="Search games"
              placeholder="Search games or creators…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                aria-label="Clear search"
                className="icon-button"
                onClick={() => setQuery('')}
              >
                <X size={17} />
              </button>
            )}
          </div>
          <div className="category-tabs" aria-label="Game categories">
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? 'active' : ''}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="catalog-toolbar">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} />
              <label className="sr-only" htmlFor="sort-games">
                Sort games
              </label>
              <select
                id="sort-games"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option>Popular</option>
                <option>Top rated</option>
                <option>Name</option>
              </select>
              <span className="quiet-label">{results.length} games</span>
            </div>
            <button
              className={`filter-chip ${favoritesOnly ? 'active' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly(!favoritesOnly)}
            >
              <Heart size={14} />
              Favorites
            </button>
          </div>
          {status === 'loading' ? (
            <Loading label="Loading development catalog…" />
          ) : status === 'error' ? (
            <EmptyState
              title="Catalog preview interrupted"
              icon={<RefreshCw size={28} />}
              action={
                <button className="button" onClick={() => setStatus('ready')}>
                  Try again
                </button>
              }
            >
              This is the simulated error state. Reload the local fixture
              catalog to continue.
            </EmptyState>
          ) : results.length ? (
            <div className="game-grid discover-grid">
              {results.map((game) => (
                <div
                  className={selected.id === game.id ? 'selected-game' : ''}
                  key={game.id}
                >
                  <GameCard
                    game={game}
                    library={library}
                    onSelect={setSelected}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No games found"
              action={
                <button
                  className="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('All games');
                    setFavoritesOnly(false);
                  }}
                >
                  Clear filters
                </button>
              }
            >
              Try another search or category, or add games to your favorites.
            </EmptyState>
          )}
          <div className="catalog-bottom">
            <span>Local fixture catalog · no live connection</span>
            <details className="preview-tools">
              <summary>Preview states</summary>
              <div>
                <button onClick={() => setStatus('loading')}>Loading</button>
                <button onClick={() => setStatus('error')}>Error</button>
                <button onClick={() => setStatus('ready')}>Ready</button>
              </div>
            </details>
          </div>
        </div>
        <aside
          className="panel discover-detail"
          aria-label="Selected game details"
        >
          <GameDetails game={selected} library={library} />
        </aside>
      </div>
    </>
  );
}
