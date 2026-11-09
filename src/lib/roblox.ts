import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Game } from './types';

export interface ApiError {
  code:
    | 'invalidInput'
    | 'offline'
    | 'timeout'
    | 'rateLimited'
    | 'forbidden'
    | 'notFound'
    | 'invalidResponse'
    | 'unavailable'
    | 'cache'
    | 'busy'
    | 'desktopRequired';
  message: string;
  retryAfterSeconds?: number | null;
}
export interface Catalog {
  experiences: Game[];
  startingPlaceIds: string[];
  warnings: ApiError[];
}
export interface ExperienceResult {
  experience: Game;
  warnings: ApiError[];
}
export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  description: string;
  createdAt: string;
  isBanned: boolean;
  verified: boolean;
  avatarUrl: string | null;
  observedAt: number;
  warnings: ApiError[];
}
export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  verified: boolean;
}
export interface UserPage {
  users: UserSummary[];
  nextCursor: string | null;
  retryAfterSeconds: number;
}
export type ApiRequest =
  | { action: 'catalog' | 'cachedCatalog' }
  | { action: 'lookupUniverse'; universeId: string }
  | { action: 'lookupUsername'; username: string }
  | { action: 'lookupUser'; userId: string }
  | { action: 'searchUsers'; keyword: string; cursor: string | null };
type Responses = {
  catalog: Catalog;
  experience: ExperienceResult;
  profile: PublicProfile | null;
  users: UserPage;
};
const pending = new Map<string, Promise<unknown>>();
export function apiError(error: unknown): ApiError {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error as ApiError;
  return {
    code: 'unavailable',
    message: 'Roblox data could not be loaded. Try again later.',
  };
}
/** Only typed actions reach Rust. No URL, executable, credential or header input. */
export async function robloxRequest<K extends keyof Responses>(
  request: ApiRequest,
  kind: K,
): Promise<Responses[K]> {
  if (!isTauri())
    throw {
      code: 'desktopRequired',
      message:
        'Live Roblox data requires the Nova desktop app. Browser preview does not include a development catalog.',
    } satisfies ApiError;
  const key = JSON.stringify(request);
  let task = pending.get(key);
  if (!task) {
    task = invoke<{ kind: string; data: unknown }>('roblox_data', { request });
    pending.set(key, task);
  }
  try {
    const response = (await task) as { kind: string; data: Responses[K] };
    if (response.kind !== kind)
      throw {
        code: 'invalidResponse',
        message: 'The native data service returned an unsupported response.',
      };
    return response.data;
  } catch (error) {
    throw apiError(error);
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
export function rating(game: Game): number | null {
  if (game.upVotes === null || game.downVotes === null) return null;
  const total = game.upVotes + game.downVotes;
  return total > 0 ? Math.round((game.upVotes / total) * 100) : null;
}
export function filterGames(
  games: Game[],
  query: string,
  category: string,
  sort: string,
  favorites?: string[],
  locale = 'en',
) {
  return games
    .filter(
      (g) =>
        (!favorites || favorites.includes(g.id)) &&
        (category === 'All games' || g.category === category) &&
        `${g.name} ${g.creator}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'Name'
        ? a.name.localeCompare(b.name, locale)
        : sort === 'Top rated'
          ? (rating(b) ?? -1) - (rating(a) ?? -1)
          : (b.players ?? -1) - (a.players ?? -1),
    );
}

/** Legacy records remain intact even when an ID cannot form a safe page URL. */
export function officialPage(
  kind: 'games' | 'users',
  id: string,
): string | null {
  if (!/^[1-9][0-9]{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
    return null;
  return `https://www.roblox.com/${kind}/${id}${kind === 'users' ? '/profile' : ''}`;
}
