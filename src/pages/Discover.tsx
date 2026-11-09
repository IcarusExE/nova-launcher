import { useI18n } from '../i18n';
import { SlidersHorizontal, Search, X, Heart } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LocalizedError } from '../components/LocalizedError';
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
  const { t, locale } = useI18n();
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
  const invalidateLookup = () => {
    ++lookupVersion.current;
    setLookupLoading(false);
    setLookupError(null);
  };
  useLayoutEffect(() => {
    invalidateLookup();
  }, [
    query,
    category,
    sort,
    favoritesOnly,
    favoritesOnly ? library.data.favorites : null,
  ]);
  const results = useMemo(
    () =>
      filterGames(
        catalog.experiences,
        query,
        category,
        sort,
        favoritesOnly ? library.data.favorites : undefined,
        locale,
      ),
    [
      catalog.experiences,
      query,
      category,
      sort,
      favoritesOnly,
      library.data.favorites,
      locale,
    ],
  );
  const selected = results.find((g) => g.id === selectedId) ?? results[0];
  // Commit the fallback so clearing/reordering filters cannot resurrect an older
  // out-of-filter selection. Stable IDs survive unrelated catalog/locale changes.
  useEffect(() => {
    setSelectedId((current) =>
      results.some((g) => g.id === current)
        ? current
        : (results[0]?.id ?? null),
    );
  }, [results]);
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
          <h1>{t('Discover')}</h1>
          <p>{t('Explore fetched experiences or look up a Universe ID.')}</p>
        </div>
        <DataBadge />
      </div>
      <div className="discover-layout">
        <div className="discover-catalog">
          <div className="search-input">
            <Search size={19} />
            <input
              id="discover-search"
              aria-label={t('Search games')}
              placeholder={t('Filter loaded games or creators…')}
              value={query}
              onChange={(e) => {
                invalidateLookup();
                setQuery(e.target.value);
              }}
            />
            {query && (
              <button
                aria-label={t('Clear search')}
                className="icon-button"
                onClick={() => {
                  invalidateLookup();
                  setQuery('');
                }}
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
              {t('Open Roblox Discover')}
            </a>{' '}
            {t(
              '· Filters loaded metadata only. General Roblox experience search is unavailable through verified anonymous APIs.',
            )}
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
            <label htmlFor="universe-id">{t('Universe ID')}</label>
            <input
              id="universe-id"
              inputMode="numeric"
              pattern="[1-9][0-9]{0,19}"
              maxLength={20}
              required
              placeholder={t('e.g. 994732206')}
              onInvalid={(e) =>
                e.currentTarget.setCustomValidity(
                  t(
                    'Enter a positive numeric Universe ID (up to 64 bits), without spaces or a URL.',
                  ),
                )
              }
              value={universe}
              onChange={(e) => {
                invalidateLookup();
                e.target.setCustomValidity('');
                setUniverse(e.target.value);
              }}
            />
            <button className="button" disabled={lookupLoading}>
              {lookupLoading ? t('Looking up…') : t('Look up experience')}
            </button>
          </form>
          {lookupError && (
            <div role="alert" className="inline-error">
              <LocalizedError error={lookupError} />
            </div>
          )}
          <div className="category-tabs" aria-label={t('Game categories')}>
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? 'active' : ''}
                onClick={() => {
                  invalidateLookup();
                  setCategory(c);
                }}
              >
                {c === 'All games' ? t('All games') : c}
              </button>
            ))}
          </div>
          <div className="catalog-toolbar">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} />
              <label className="sr-only" htmlFor="sort-games">
                {t('Sort games')}
              </label>
              <select
                id="sort-games"
                value={sort}
                onChange={(e) => {
                  invalidateLookup();
                  setSort(e.target.value);
                }}
              >
                <option value="Playing">{t('Playing')}</option>
                <option value="Top rated">{t('Top rated')}</option>
                <option value="Name">{t('Name')}</option>
              </select>
              <span className="quiet-label">
                {t('games.count', { count: results.length })}
              </span>
            </div>
            <button
              className={`filter-chip ${favoritesOnly ? 'active' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => {
                invalidateLookup();
                setFavoritesOnly(!favoritesOnly);
              }}
            >
              <Heart size={14} />
              {t('Favorites')}
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
                    onSelect={(g) => {
                      invalidateLookup();
                      setSelectedId(g.id);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            !catalog.loading && (
              <EmptyState
                title={
                  catalog.experiences.length
                    ? t('No games found')
                    : t('No experience data available')
                }
                action={
                  catalog.experiences.length ? (
                    <button
                      className="button"
                      onClick={() => {
                        invalidateLookup();
                        setQuery('');
                        setCategory('All games');
                        setFavoritesOnly(false);
                      }}
                    >
                      {t('Clear filters')}
                    </button>
                  ) : undefined
                }
              >
                {t(
                  'Try another filter or a verified Universe ID. No sample results are substituted.',
                )}
              </EmptyState>
            )
          )}
          <div className="catalog-bottom">
            <span>
              {t(
                'Player and rating values are snapshots when supplied by Roblox.',
              )}
            </span>
          </div>
        </div>
        <aside
          className="panel discover-detail"
          aria-label={t('Selected game details')}
        >
          {selected ? (
            <GameDetails game={selected} library={library} />
          ) : (
            <EmptyState title={t('Choose an experience')}>
              {t('Public metadata will appear here.')}
            </EmptyState>
          )}
        </aside>
      </div>
    </>
  );
}
