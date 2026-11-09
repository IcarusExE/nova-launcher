import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Game } from '../lib/types';
import { apiError, robloxRequest } from '../lib/roblox';
import type { ApiError, Catalog } from '../lib/roblox';

/** Slow cache/refresh responses must not replace a newer verified observation. */
export function mergeExperiences(existing: Game[], incoming: Game[]): Game[] {
  const byId = new Map(existing.map((game) => [game.id, game]));
  for (const game of incoming) {
    const previous = byId.get(game.id);
    if (
      !previous ||
      game.observedAt > previous.observedAt ||
      (game.observedAt === previous.observedAt &&
        (!game.cached || previous.cached))
    )
      byId.set(game.id, game);
  }
  return [...byId.values()];
}
interface CatalogStore extends Catalog {
  loading: boolean;
  error: ApiError | null;
  refresh: () => Promise<void>;
  lookupUniverse: (id: string) => Promise<Game>;
}
const Context = createContext<CatalogStore | null>(null);
const empty: Catalog = { experiences: [], startingPlaceIds: [], warnings: [] };
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await robloxRequest({ action: 'catalog' }, 'catalog');
      if (mounted.current && version === generation.current)
        setCatalog((previous) => ({
          ...result,
          experiences: mergeExperiences(
            previous.experiences,
            result.experiences,
          ),
        }));
    } catch (e) {
      if (mounted.current && version === generation.current)
        setError(apiError(e));
    } finally {
      if (mounted.current && version === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void (async () => {
      try {
        const saved = await robloxRequest(
          { action: 'cachedCatalog' },
          'catalog',
        );
        if (active)
          setCatalog((previous) => ({
            ...saved,
            experiences: mergeExperiences(
              previous.experiences,
              saved.experiences,
            ),
          }));
      } catch {
        /* A damaged disposable cache must not block a fresh request. */
      }
      if (active) void refresh();
    })();
    return () => {
      active = false;
      mounted.current = false;
      ++generation.current;
    };
  }, [refresh]);
  const lookupUniverse = useCallback(async (universeId: string) => {
    const result = await robloxRequest(
      { action: 'lookupUniverse', universeId },
      'experience',
    );
    if (mounted.current)
      setCatalog((previous) => ({
        ...previous,
        warnings: result.warnings,
        experiences: mergeExperiences(previous.experiences, [
          result.experience,
        ]),
      }));
    return result.experience;
  }, []);
  return (
    <Context.Provider
      value={{ ...catalog, loading, error, refresh, lookupUniverse }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCatalog() {
  const value = useContext(Context);
  if (!value) throw new Error('CatalogProvider is missing');
  return value;
}
