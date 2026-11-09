import { SlidersHorizontal, Search, X, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { filterGames, apiError } from '../lib/roblox';
import type { ApiError } from '../lib/roblox';
import { useCatalog } from '../hooks/useCatalog';
import type { LibraryStore } from '../hooks/useLibrary';
import {
  EmptyState,
  DataBadge,
  GameCard,
  GameDetails,
  CatalogFeedback,
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
  const catalog = useCatalog();
  const [category, setCategory] = useState('All games');
  const [sort, setSort] = useState('Playing');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [universe, setUniverse] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<ApiError | null>(null);
  const lookupVersion = useRef(0);
  useEffect(
    () => () => {
      ++lookupVersion.current;
    },
    [],
  );
  const results = filterGames(
    catalog.experiences,
    query,
    category,
    sort,
    favoritesOnly ? library.data.favorites : undefined,
  );
  const selected =
    catalog.experiences.find((g) => g.id === selectedId) ?? results[0];
  const categories = [
    'All games',
    ...new Set(
      catalog.experiences.flatMap((g) => (g.category ? [g.category] : [])),
    ),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Discover</h1>
          <p>Explore fetched experiences or look up a Universe ID.</p>
        </div>
        <DataBadge />
      </div>
      <div className="discover-layout">
        <div className="discover-catalog">
          <div className="search-input">
            <Search size={19} />
            <input
              id="discover-search"
              aria-label="Search games"
              placeholder="Filter loaded games or creators…"
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
          <p className="quiet-label">
            <a
              className="text-link"
              href="https://www.roblox.com/discover"
              target="_blank"
              rel="noreferrer"
            >
              Open Roblox Discover
            </a>{' '}
            · Filters loaded metadata only. General Roblox experience search is
            unavailable through verified anonymous APIs.
          </p>
          <form
            className="universe-lookup"
            onSubmit={(e) => {
              e.preventDefault();
              const version = ++lookupVersion.current;
              setLookupLoading(true);
              setLookupError(null);
              void catalog
                .lookupUniverse(universe)
                .then((game) => {
                  if (version === lookupVersion.current) {
                    setSelectedId(game.id);
                    setQuery('');
                    setCategory('All games');
                    setFavoritesOnly(false);
                  }
                })
                .catch((e) => {
                  if (version === lookupVersion.current)
                    setLookupError(apiError(e));
                })
                .finally(() => {
                  if (version === lookupVersion.current)
                    setLookupLoading(false);
                });
            }}
          >
            <label htmlFor="universe-id">Universe ID</label>
            <input
              id="universe-id"
              inputMode="numeric"
              pattern="[1-9][0-9]{0,19}"
              maxLength={20}
              required
              placeholder="e.g. 994732206"
              value={universe}
              onChange={(e) => {
                ++lookupVersion.current;
                setLookupLoading(false);
                setUniverse(e.target.value);
              }}
            />
            <button className="button" disabled={lookupLoading}>
              {lookupLoading ? 'Looking up…' : 'Look up experience'}
            </button>
          </form>
          {lookupError && (
            <p role="alert" className="inline-error">
              {lookupError.message}
            </p>
          )}
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
                <option>Playing</option>
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
          <CatalogFeedback />
          {results.length ? (
            <div className="game-grid discover-grid">
              {results.map((game) => (
                <div
                  className={selected?.id === game.id ? 'selected-game' : ''}
                  key={game.id}
                >
                  <GameCard
                    game={game}
                    library={library}
                    onSelect={(g) => setSelectedId(g.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            !catalog.loading && (
              <EmptyState
                title={
                  catalog.experiences.length
                    ? 'No games found'
                    : 'No experience data available'
                }
                action={
                  catalog.experiences.length ? (
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
                  ) : undefined
                }
              >
                Try another filter or a verified Universe ID. No sample results
                are substituted.
              </EmptyState>
            )
          )}
          <div className="catalog-bottom">
            <span>
              Player and rating values are snapshots when supplied by Roblox.
            </span>
          </div>
        </div>
        <aside
          className="panel discover-detail"
          aria-label="Selected game details"
        >
          {selected ? (
            <GameDetails game={selected} library={library} />
          ) : (
            <EmptyState title="Choose an experience">
              Public metadata will appear here.
            </EmptyState>
          )}
        </aside>
      </div>
    </>
  );
}
